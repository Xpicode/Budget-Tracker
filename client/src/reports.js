// Pure functions over plain arrays, so tests can run them without IndexedDB.
// Rows with deleted_at are ignored here too, so no caller can forget golden rule 3.

const live = (txns) => txns.filter((t) => !t.deleted_at);

// Month income / expense / net. Transfers move money between accounts and are not spending.
export function totals(txns) {
  let income = 0;
  let expense = 0;
  for (const t of live(txns)) {
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
  for (const t of live(txns)) {
    if (t.type === 'income') add(t.account_id, t.amount_cents);
    else if (t.type === 'expense') add(t.account_id, -t.amount_cents);
    else if (t.type === 'transfer') {
      add(t.account_id, -t.amount_cents);
      add(t.to_account_id, t.amount_cents);
    }
  }
  return out;
}

// Expenses per category, biggest first: [{ category_id, cents }].
export function spendingByCategory(txns) {
  const sums = {};
  for (const t of live(txns)) {
    if (t.type === 'expense') sums[t.category_id] = (sums[t.category_id] ?? 0) + t.amount_cents;
  }
  return Object.entries(sums)
    .map(([category_id, cents]) => ({ category_id, cents }))
    .sort((a, b) => b.cents - a.cents);
}

// Expense total per period: periods = [{ month, from, to }] with from inclusive, to exclusive.
export function monthlyExpenses(txns, periods) {
  const rows = live(txns);
  return periods.map(({ month, from, to }) => ({
    month,
    cents: rows.reduce((s, t) => (t.type === 'expense' && t.txn_date >= from && t.txn_date < to ? s + t.amount_cents : s), 0),
  }));
}

// Spent vs limit for each budget row, over the given period's rows (already filtered by date).
// level: ok (< 80%), warn (80–100%), over (> 100%).
export function budgetProgress(budgets, txns) {
  const rows = live(txns);
  return budgets.map((b) => {
    let spent = 0;
    for (const t of rows) {
      if (t.type === 'expense' && t.category_id === b.category_id) spent += t.amount_cents;
    }
    // Compare in integer centavos so ₱1,000.01 on a ₱1,000 limit is "over", not a rounded 100%.
    const level = spent > b.limit_cents ? 'over' : spent * 100 >= b.limit_cents * 80 ? 'warn' : 'ok';
    const pct = Math.round((spent / b.limit_cents) * 100);
    return { ...b, spent, pct, level };
  });
}
