// Local calendar date as 'YYYY-MM-DD'. en-CA is the one locale whose short date is in ISO order.
export const today = () => new Date().toLocaleDateString('en-CA');

// '2026-10' + 1 -> '2026-11'; '2026-01' - 1 -> '2025-12'
export function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// The T00:00 keeps the date local; a bare 'YYYY-MM-DD' string would parse as UTC and could shift a day.
export const formatDay = (ymd) =>
  new Date(ymd + 'T00:00').toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });

export const formatMonth = (ym) =>
  new Date(ym + '-01T00:00').toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
