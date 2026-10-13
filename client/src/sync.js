import { db } from './db';
import { api } from './api';

// Parents first, so a transaction never reaches the server before its account or category.
export const TABLES = ['accounts', 'categories', 'budgets', 'recurring_rules', 'transactions'];
const BATCH = 100;

// synced | syncing | offline | error | signed-out
let status = navigator.onLine ? 'synced' : 'offline';
let running = false;
let timer;
const listeners = new Set();

export const getStatus = () => status;
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function setStatus(next) {
  status = next;
  for (const fn of listeners) fn();
}

async function push(table) {
  for (;;) {
    const batch = await db[table].where('dirty').equals(1).limit(BATCH).toArray();
    if (batch.length === 0) return;
    await api('/api/sync/push', { method: 'POST', body: { table, rows: batch.map((row) => ({ ...row, dirty: undefined })) } });
    // Clear dirty only where updated_at is unchanged, so an edit made during the request stays dirty.
    await db.transaction('rw', db[table], async () => {
      for (const row of batch) {
        const current = await db[table].get(row.id);
        if (current?.updated_at === row.updated_at) await db[table].update(row.id, { dirty: 0 });
      }
    });
    if (batch.length < BATCH) return;
  }
}

async function pull() {
  const since = (await db.meta.get('cursor'))?.value ?? '1970-01-01T00:00:00.000Z';
  const { rows, cursor } = await api(`/api/sync/pull?since=${encodeURIComponent(since)}`);
  await db.transaction('rw', [...TABLES.map((t) => db[t]), db.meta], async () => {
    for (const table of TABLES) {
      for (const row of rows[table] ?? []) {
        const local = await db[table].get(row.id);
        // Keep the local copy only if it is dirty AND newer; it will win on the next push.
        if (local?.dirty && local.updated_at > row.updated_at) continue;
        await db[table].put({ ...row, dirty: 0 });
      }
    }
    await db.meta.put({ key: 'cursor', value: cursor });
  });
}

export async function sync() {
  if (running) return;
  if (!navigator.onLine) {
    setStatus('offline');
    return;
  }
  running = true;
  setStatus('syncing');
  try {
    for (const table of TABLES) await push(table);
    await pull();
    setStatus('synced');
  } catch (err) {
    setStatus(err.status === 401 ? 'signed-out' : err instanceof TypeError ? 'offline' : 'error');
  } finally {
    running = false;
  }
}

// Called by repo.js after every write: one sync 2 s after the last change.
export function scheduleSync() {
  clearTimeout(timer);
  timer = setTimeout(sync, 2000);
}

// App start: sync now, when connectivity returns, and every 5 minutes. Returns a stop function.
export function startSync() {
  const offline = () => setStatus('offline');
  sync();
  window.addEventListener('online', sync);
  window.addEventListener('offline', offline);
  const interval = setInterval(sync, 5 * 60 * 1000);
  return () => {
    window.removeEventListener('online', sync);
    window.removeEventListener('offline', offline);
    clearInterval(interval);
  };
}

// Local changes not yet on the server. Logout is blocked while this is above zero.
export async function dirtyCount() {
  const counts = await Promise.all(TABLES.map((t) => db[t].where('dirty').equals(1).count()));
  return counts.reduce((a, b) => a + b, 0);
}
