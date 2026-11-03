import { test, expect } from 'vitest';
import { toCents, parseCents, formatPeso, centsToInput } from './money';

test('toCents turns pesos into integer centavos', () => {
  expect(toCents('150.75')).toBe(15075);
  expect(toCents('1,500')).toBe(150000);
  expect(toCents('0.5')).toBe(50);
  expect(toCents(' 7 ')).toBe(700);
});

test('toCents rejects more than 2 decimals, negatives, zero and junk', () => {
  for (const bad of ['1.234', '-5', '0', '0.00', 'abc', '', '1e3']) expect(toCents(bad)).toBeNull();
});

test('integer centavos never drift like floats', () => {
  expect(toCents('0.1') + toCents('0.2')).toBe(30);
});

test('parseCents allows zero and negatives (opening balances)', () => {
  expect(parseCents('0')).toBe(0);
  expect(parseCents('-1500.50')).toBe(-150050);
  expect(parseCents('1.234')).toBeNull();
});

test('formatPeso and centsToInput', () => {
  expect(formatPeso(15075)).toBe('₱150.75');
  expect(formatPeso(-15075)).toBe('-₱150.75');
  expect(formatPeso(0)).toBe('₱0.00');
  expect(centsToInput(15075)).toBe('150.75');
});
