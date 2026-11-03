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

// [name, type, book]. Business ones are a starter set for a wholesale streetwear shop; rename or delete freely.
const DEFAULT_CATEGORIES = [
  ['Food', 'expense', 'personal'],
  ['Transport', 'expense', 'personal'],
  ['Bills', 'expense', 'personal'],
  ['Shopping', 'expense', 'personal'],
  ['Salary', 'income', 'personal'],
  ['Other', 'expense', 'personal'],
  ['Restock: T-shirts', 'expense', 'business'],
  ['Restock: Hoodies', 'expense', 'business'],
  ['Shipping', 'expense', 'business'],
  ['Packaging', 'expense', 'business'],
  ['Platform fees', 'expense', 'business'],
  ['Wholesale sales', 'income', 'business'],
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

// One budget row per category + month: a fixed id means two devices setting the same
// budget offline produce the same row, and the newer limit wins instead of duplicating.
export const budgetId = (category_id, month) => uuidv5(`budget:${category_id}:${month}`, SEED_NS);

// Every start: a Cash account on first run, and any default category this device doesn't have yet
// (so existing installs get the business set). A default that was deleted still exists as a row and is
// left alone, and one whose name is already in use is skipped, so nothing is duplicated.
// Runs inside a transaction so two overlapping calls (React StrictMode) cannot both seed.
export const seedDefaults = () =>
  db.transaction('rw', db.accounts, db.categories, async () => {
    if (!(await db.accounts.count())) {
      await db.accounts.put(seedRow('accounts', 'Cash', { opening_balance_cents: 0, archived: false, book: 'personal' }));
    }
    // The business needs at least one account to pick in the form.
    const accounts = await db.accounts.toArray();
    const bizCash = seedRow('accounts', 'Business Cash', { opening_balance_cents: 0, archived: false, book: 'business' });
    if (!accounts.some((a) => a.id === bizCash.id || (!a.deleted_at && ['business', 'both'].includes(a.book)))) {
      await db.accounts.put(bizCash);
    }
    const existing = await db.categories.toArray();
    const ids = new Set(existing.map((c) => c.id));
    const names = new Set(existing.filter((c) => !c.deleted_at).map((c) => `${c.type}:${c.name.toLowerCase()}`));
    const missing = DEFAULT_CATEGORIES
      .map(([name, type, book]) => seedRow('categories', name, { type, icon: null, color: null, book }))
      .filter((c) => !ids.has(c.id) && !names.has(`${c.type}:${c.name.toLowerCase()}`));
    if (missing.length) await db.categories.bulkPut(missing);
  });
