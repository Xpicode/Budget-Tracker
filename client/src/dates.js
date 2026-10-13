// Local calendar date as 'YYYY-MM-DD'. en-CA is the one locale whose short date is in ISO order.
export const today = () => new Date().toLocaleDateString('en-CA');

const toYmd = (d) => d.toLocaleDateString('en-CA');
const parts = (ymd) => ymd.split('-').map(Number);

// '2026-10' + 1 -> '2026-11'; '2026-01' - 1 -> '2025-12'
export function shiftMonth(ym, delta) {
  const [y, m] = parts(ym);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function addDays(ymd, n) {
  const [y, m, d] = parts(ymd);
  return toYmd(new Date(y, m - 1, d + n));
}

// Same day next month, clamped to that month's length (Jan 31 + 1 -> Feb 28).
// ponytail: a rule on the 31st drifts to the 28th/30th after a short month; fine for v1.
export function addMonths(ymd, n) {
  const [y, m, d] = parts(ymd);
  const last = new Date(y, m - 1 + n + 1, 0).getDate();
  return toYmd(new Date(y, m - 1 + n, Math.min(d, last)));
}

// Budget period for 'YYYY-MM' starting on startDay (1 = calendar month): [from, to) as 'YYYY-MM-DD'.
export function period(ym, startDay = 1) {
  const d = String(Math.max(1, startDay)).padStart(2, '0');
  return { from: `${ym}-${d}`, to: `${shiftMonth(ym, 1)}-${d}` };
}

// The 'YYYY-MM' whose period contains `ymd` (with a start day of 25, Oct 13 belongs to "September").
export function currentMonth(ymd, startDay = 1) {
  const ym = ymd.slice(0, 7);
  return Number(ymd.slice(8)) < startDay ? shiftMonth(ym, -1) : ym;
}

// The T00:00 keeps the date local; a bare 'YYYY-MM-DD' string would parse as UTC and could shift a day.
export const formatDay = (ymd) =>
  new Date(ymd + 'T00:00').toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });

export const formatMonth = (ym) =>
  new Date(ym + '-01T00:00').toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
