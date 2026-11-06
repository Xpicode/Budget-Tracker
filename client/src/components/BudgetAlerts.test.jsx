import { test, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { budgetProgress } from '../reports';
import BudgetAlerts from './BudgetAlerts';

test('warnings appear at exact thresholds and ignore deleted spending', () => {
  const budget = { id: 'b', category_id: 'food', limit_cents: 10000 };
  const categories = [{ id: 'food', name: 'Food', type: 'expense' }];
  const render = (cents) => renderToStaticMarkup(<BudgetAlerts categories={categories} progress={budgetProgress([budget], [{ type: 'expense', category_id: 'food', amount_cents: cents }, { type: 'expense', category_id: 'food', amount_cents: 99999, deleted_at: 'x' }])} />);
  expect(render(7999)).toBe('');
  expect(render(8000)).toContain('Near limit (at least 80%)');
  expect(render(10000)).toContain('Limit reached (100%)');
  expect(render(10001)).toContain('Over budget');
});
