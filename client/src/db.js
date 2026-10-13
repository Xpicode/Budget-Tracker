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
  meta:            'key',              // sync cursor, cached user
});
