import { test, expect, vi } from 'vitest';
import { restore } from './repo';
import { db } from './db';
import { scheduleSync } from './sync';

vi.mock('./db', () => ({ db: { transactions: { update: vi.fn().mockResolvedValue(1) } } }));
vi.mock('./sync', () => ({ scheduleSync: vi.fn() }));

test('restore clears only deletion metadata and marks the current stored row dirty', async () => {
  await restore('transactions', 'txn');
  expect(db.transactions.update).toHaveBeenCalledWith('txn', {
    deleted_at: null, updated_at: expect.any(String), dirty: 1,
  });
  expect(scheduleSync).toHaveBeenCalled();
});
