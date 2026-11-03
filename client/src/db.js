import Dexie from 'dexie';

export const db = new Dexie('budget');

// Only indexed fields are listed; Dexie stores every other field anyway.
// dirty is 1/0, not true/false, because IndexedDB cannot index booleans.
db.version(1).stores({
  accounts:        'id, dirty',
  categories:      'id, dirty',
  transactions:    'id, txn_date, account_id, category_id, dirty',
  budgets:         'id, [category_id+month], dirty',
  recurring_rules: 'id, next_run_date, dirty',
  meta:            'key',              // sync cursor, cached user, settings
});

// v2: transactions and recurring rules belong to a book, 'personal' or 'business'.
// Existing rows become personal; not marked dirty, the server's migration does the same.
db.version(2).upgrade(async (tx) => {
  for (const table of ['transactions', 'recurring_rules']) {
    await tx.table(table).toCollection().modify((row) => { row.book ??= 'personal'; });
  }
});

// v4: categories say which book they are offered in: 'personal', 'business' or 'both'.
// The existing ones (Food, Transport…) are personal. Marked dirty with a fresh updated_at so the change syncs.
db.version(4).upgrade((tx) => {
  const now = new Date().toISOString();
  return tx.table('categories').toCollection().modify((row) => {
    if (row.book && row.book !== 'both') return;
    row.book = 'personal';
    row.updated_at = now;
    row.dirty = 1;
  });
});

// v5: accounts belong to a book too. Existing ones are personal; not marked dirty, the server's migration does the same.
db.version(5).upgrade((tx) =>
  tx.table('accounts').toCollection().modify((row) => { row.book ??= 'personal'; }));
