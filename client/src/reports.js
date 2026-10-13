// Pure functions over plain arrays, so Phase 9 can test them without IndexedDB.
// Callers pass rows that already exclude deleted_at.

// Month income / expense / net. Transfers move money between accounts and are not spending.
export function totals(txns) {
  let income = 0;
  let expense = 0;
  for (const t of txns) {
    if (t.type === 'income') income += t.amount_cents;
    else if (t.type === 'expense') expense += t.amount_cents;
  }
  return { income, expense, net: income - expense };
}

// Per account: opening + income − expense − transfers out + transfers in.
// Returns { [account_id]: cents }. Rows pointing at an unknown account are ignored.
export function balances(accounts, txns) {
  const out = Object.fromEntries(accounts.map((a) => [a.id, a.opening_balance_cents]));
  const add = (id, cents) => { if (id in out) out[id] += cents; };
  for (const t of txns) {
    if (t.type === 'income') add(t.account_id, t.amount_cents);
    else if (t.type === 'expense') add(t.account_id, -t.amount_cents);
    else if (t.type === 'transfer') {
      add(t.account_id, -t.amount_cents);
      add(t.to_account_id, t.amount_cents);
    }
  }
  return out;
}
