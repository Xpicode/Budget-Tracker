import { db } from './db';

const now = () => new Date().toISOString();

// Every write sets updated_at and dirty = 1 so the sync service knows what to send.
// created_at is kept on edits because ...row comes after it.
export const save = (table, row) => {
  const t = now();
  return db[table].put({ created_at: t, ...row, id: row.id ?? crypto.randomUUID(), updated_at: t, dirty: 1 });
};

export const softDelete = (table, id) =>
  db[table].update(id, { deleted_at: now(), updated_at: now(), dirty: 1 });

const DEFAULT_CATEGORIES = [
  ['Food', 'expense'],
  ['Transport', 'expense'],
  ['Bills', 'expense'],
  ['Shopping', 'expense'],
  ['Salary', 'income'],
  ['Other', 'expense'],
];

// First run only: one account and the default categories, so the form has something to pick.
// Runs inside a transaction so two overlapping calls (React StrictMode) cannot both seed.
export const seedDefaults = () =>
  db.transaction('rw', db.accounts, db.categories, async () => {
    if (await db.accounts.count()) return;
    await save('accounts', { name: 'Cash', opening_balance_cents: 0, archived: false });
    for (const [name, type] of DEFAULT_CATEGORIES) {
      await save('categories', { name, type, icon: null, color: null });
    }
  });
