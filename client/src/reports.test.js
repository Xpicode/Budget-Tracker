import { test, expect } from 'vitest';
import { totals, balances, spendingByCategory, monthlyExpenses, budgetProgress, inBook, categoryFits, accountFits, filterTransactions } from './reports';

test('accountFits: an account is in its own book, "both" in either, no book means personal; All shows every one', () => {
  const list = [{ id: 'p', book: 'personal' }, { id: 'b', book: 'business' }, { id: 'x', book: 'both' }, { id: 'old' }];
  const ids = (book) => list.filter((a) => accountFits(a, book)).map((a) => a.id);
  expect(ids('personal')).toEqual(['p', 'x', 'old']);
  expect(ids('business')).toEqual(['b', 'x']);
  expect(ids('all')).toEqual(['p', 'b', 'x', 'old']);
});

test('categoryFits: a category is offered in its own book, "both" (or no book) in either', () => {
  const offered = (book) => [{ id: 'p', book: 'personal' }, { id: 'b', book: 'business' }, { id: 'x', book: 'both' }, { id: 'old' }]
    .filter((c) => categoryFits(c, book)).map((c) => c.id);
  expect(offered('personal')).toEqual(['p', 'x', 'old']);
  expect(offered('business')).toEqual(['b', 'x', 'old']);
});

const gcash = { id: 'gcash', opening_balance_cents: 500000 };
const cash = { id: 'cash', opening_balance_cents: 100000 };
const food = 'food';
const transport = 'transport';

const rows = [
  { type: 'income', account_id: 'gcash', category_id: 'salary', amount_cents: 2000000, txn_date: '2026-10-01' },
  { type: 'expense', account_id: 'cash', category_id: food, amount_cents: 350000, txn_date: '2026-10-10' },
  { type: 'expense', account_id: 'cash', category_id: transport, amount_cents: 30000, txn_date: '2026-10-05' },
  { type: 'transfer', account_id: 'gcash', to_account_id: 'cash', amount_cents: 100000, txn_date: '2026-10-12' },
  { type: 'expense', account_id: 'cash', category_id: food, amount_cents: 99999, txn_date: '2026-10-13', deleted_at: '2026-10-13T00:00:00.000Z' },
];

test('inBook: All shows everything; rows made before books existed count as personal', () => {
  const biz = { book: 'business' };
  const old = {};
  expect([biz, old].filter((t) => inBook(t, 'all'))).toEqual([biz, old]);
  expect([biz, old].filter((t) => inBook(t, 'business'))).toEqual([biz]);
  expect([biz, old].filter((t) => inBook(t, 'personal'))).toEqual([old]);
  // Business profit is just totals over business rows.
  const rows2 = [
    { type: 'income', amount_cents: 5000000, book: 'business' },
    { type: 'expense', amount_cents: 3200000, book: 'business' },
    { type: 'expense', amount_cents: 99999 },
  ];
  expect(totals(rows2.filter((t) => inBook(t, 'business')))).toEqual({ income: 5000000, expense: 3200000, net: 1800000 });
});

test('totals skip transfers and deleted rows', () => {
  expect(totals(rows)).toEqual({ income: 2000000, expense: 380000, net: 1620000 });
});

test('a transfer moves money between accounts without counting as spending', () => {
  const before = balances([gcash, cash], rows.filter((t) => t.type !== 'transfer'));
  const after = balances([gcash, cash], rows);
  expect(before).toEqual({ gcash: 2500000, cash: -280000 });
  expect(after).toEqual({ gcash: 2400000, cash: -180000 });
  expect(totals(rows).expense).toBe(380000); // unchanged by the transfer
});

test('balances ignore deleted rows and rows pointing at unknown accounts', () => {
  const deleted = [{ type: 'expense', account_id: 'cash', amount_cents: 1, deleted_at: 'x' }];
  const unknown = [{ type: 'expense', account_id: 'nope', amount_cents: 1 }];
  expect(balances([cash], deleted)).toEqual({ cash: 100000 });
  expect(balances([cash], unknown)).toEqual({ cash: 100000 });
});

test('spendingByCategory sums expenses per category, biggest first', () => {
  expect(spendingByCategory(rows)).toEqual([
    { category_id: food, cents: 350000 },
    { category_id: transport, cents: 30000 },
  ]);
});

test('monthlyExpenses sums each period, [from, to)', () => {
  const periods = [
    { month: '2026-09', from: '2026-09-01', to: '2026-10-01' },
    { month: '2026-10', from: '2026-10-01', to: '2026-11-01' },
  ];
  expect(monthlyExpenses(rows, periods)).toEqual([
    { month: '2026-09', cents: 0 },
    { month: '2026-10', cents: 380000 },
  ]);
});

test('budgetProgress levels: ok < 80%, warn 80–100%, over > 100% (by centavos, not rounded %)', () => {
  const budget = { category_id: food, month: '2026-10', limit_cents: 100000 };
  const spend = (cents) => [{ type: 'expense', category_id: food, amount_cents: cents }];
  expect(budgetProgress([budget], spend(79999))[0]).toMatchObject({ spent: 79999, pct: 80, level: 'ok' });
  expect(budgetProgress([budget], spend(80000))[0].level).toBe('warn');
  expect(budgetProgress([budget], spend(100000))[0].level).toBe('warn');
  expect(budgetProgress([budget], spend(100001))[0].level).toBe('over');
  expect(budgetProgress([budget], rows)[0]).toMatchObject({ spent: 350000, pct: 350, level: 'over' });
});

test('search matches notes, historical category names, and exact centavo amounts', () => {
  const list = [{ id: 'a', note: 'Lunch with team', category_id: food, amount_cents: 15075 }, { id: 'b', note: null, amount_cents: 15000 }, { id: 'c', note: 'Lunch', deleted_at: 'x' }];
  const cats = [{ id: food, name: 'Food', deleted_at: 'x' }];
  expect(filterTransactions(list, { search: ' TEAM ' }, cats).map((t) => t.id)).toEqual(['a']);
  expect(filterTransactions(list, { search: 'food' }, cats).map((t) => t.id)).toEqual(['a']);
  expect(filterTransactions(list, { search: '150.75' }).map((t) => t.id)).toEqual(['a']);
  expect(filterTransactions(list, { search: '150' }).map((t) => t.id)).toEqual(['b']);
  expect(filterTransactions(list, { search: '1.234' })).toEqual([]);
});

test('explicit filters combine and transfers match either account', () => {
  expect(filterTransactions(rows, { account_id: 'cash', category_id: food, type: 'expense' })).toEqual([rows[1]]);
  expect(filterTransactions(rows, { account_id: 'cash', type: 'transfer' })).toEqual([rows[3]]);
  expect(filterTransactions(rows, { account_id: 'gcash', type: 'transfer' })).toEqual([rows[3]]);
  expect(filterTransactions(rows, { account_id: 'cash', type: 'income' })).toEqual([]);
});
