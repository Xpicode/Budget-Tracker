import { test, expect } from 'vitest';
import { merge } from './sync';

const remote = { id: 'r', amount_cents: 200, updated_at: '2026-10-13T02:00:00.000Z' };

test('remote newer overwrites a clean local row', () => {
  const local = { id: 'r', amount_cents: 100, updated_at: '2026-10-13T01:00:00.000Z', dirty: 0 };
  expect(merge(local, remote)).toEqual({ ...remote, dirty: 0 });
});

test('remote newer overwrites a dirty but older local row', () => {
  const local = { id: 'r', amount_cents: 100, updated_at: '2026-10-13T01:00:00.000Z', dirty: 1 };
  expect(merge(local, remote)).toEqual({ ...remote, dirty: 0 });
});

test('local dirty and newer is kept (it will win on the next push)', () => {
  const local = { id: 'r', amount_cents: 300, updated_at: '2026-10-13T03:00:00.000Z', dirty: 1 };
  expect(merge(local, remote)).toBeNull();
});

test('local clean and newer is still overwritten (nothing to push, server is the truth)', () => {
  const local = { id: 'r', amount_cents: 300, updated_at: '2026-10-13T03:00:00.000Z', dirty: 0 };
  expect(merge(local, remote)).toEqual({ ...remote, dirty: 0 });
});

test('a row with no local copy is stored clean', () => {
  expect(merge(undefined, remote)).toEqual({ ...remote, dirty: 0 });
});
