import { test, expect } from 'vitest';
import { catchUp } from './recurring';

const rent = {
  id: '11111111-1111-4111-8111-111111111111',
  account_id: 'bdo', category_id: 'bills', type: 'expense', amount_cents: 1500000,
  frequency: 'monthly', next_run_date: '2026-02-15', note: 'Rent',
};

test('a monthly rule due Feb 15 opened on Apr 16 creates Feb, Mar and Apr', () => {
  const { txns, next_run_date } = catchUp(rent, '2026-04-16');
  expect(txns.map((t) => t.txn_date)).toEqual(['2026-02-15', '2026-03-15', '2026-04-15']);
  expect(txns[0]).toMatchObject({ account_id: 'bdo', category_id: 'bills', type: 'expense', amount_cents: 1500000, note: 'Rent', to_account_id: null });
  expect(next_run_date).toBe('2026-05-15');
});

test('the same rule on two devices gives the same ids, and each date a different id', () => {
  const one = catchUp(rent, '2026-04-16').txns.map((t) => t.id);
  const two = catchUp(rent, '2026-04-16').txns.map((t) => t.id);
  expect(one).toEqual(two);
  expect(new Set(one).size).toBe(3);
});

test('nothing is created before the due date; weekly and daily step correctly', () => {
  expect(catchUp({ ...rent, next_run_date: '2026-04-17' }, '2026-04-16').txns).toHaveLength(0);
  expect(catchUp({ ...rent, frequency: 'weekly', next_run_date: '2026-04-01' }, '2026-04-16').txns.map((t) => t.txn_date))
    .toEqual(['2026-04-01', '2026-04-08', '2026-04-15']);
  expect(catchUp({ ...rent, frequency: 'daily', next_run_date: '2026-12-30' }, '2027-01-01').txns.map((t) => t.txn_date))
    .toEqual(['2026-12-30', '2026-12-31', '2027-01-01']);
});

test('a monthly rule on the 31st clamps to shorter months', () => {
  expect(catchUp({ ...rent, next_run_date: '2026-01-31' }, '2026-03-01').txns.map((t) => t.txn_date))
    .toEqual(['2026-01-31', '2026-02-28']);
});
