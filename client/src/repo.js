import { v5 as uuidv5 } from 'uuid';
import { db } from './db';
import { scheduleSync } from './sync';

const now = () => new Date().toISOString();

// Every write sets updated_at and dirty = 1 so the sync service knows what to send,
// then asks for a sync 2 s later. created_at is kept on edits because ...row comes after it.
export const save = (table, row) => {
  const t = now();
  const p = db[table].put({ created_at: t, ...row, id: row.id ?? crypto.randomUUID(), updated_at: t, dirty: 1 });
  p.then(scheduleSync, () => {});
  return p;
};

export const softDelete = (table, id) => {
  const p = db[table].update(id, { deleted_at: now(), updated_at: now(), dirty: 1 });
  p.then(scheduleSync, () => {});
  return p;
};

const DEFAULT_CATEGORIES = [
  ['Food', 'expense'],
  ['Transport', 'expense'],
  ['Bills', 'expense'],
  ['Shopping', 'expense'],
  ['Salary', 'income'],
  ['Other', 'expense'],
];

// Seed rows get a fixed id (UUID v5 of the name) and an old timestamp, so every device creates
// the same rows, and any real edit on any device wins over the seed when they sync.
const SEED_NS = 'd9b3f3a4-6c1e-4a0b-9f2e-1c3d5e7f9a1b';
const SEED_TIME = '2000-01-01T00:00:00.000Z';
const seedRow = (table, name, fields) => ({
  id: uuidv5(`${table}:${name}`, SEED_NS),
  name,
  ...fields,
  created_at: SEED_TIME,
  updated_at: SEED_TIME,
  deleted_at: null,
  dirty: 1,
});

// First run only. Runs inside a transaction so two overlapping calls (React StrictMode) cannot both seed.
export const seedDefaults = () =>
  db.transaction('rw', db.accounts, db.categories, async () => {
    if (await db.accounts.count()) return;
    await db.accounts.put(seedRow('accounts', 'Cash', { opening_balance_cents: 0, archived: false }));
    await db.categories.bulkPut(
      DEFAULT_CATEGORIES.map(([name, type]) => seedRow('categories', name, { type, icon: null, color: null })),
    );
  });
