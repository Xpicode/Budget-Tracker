const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

// '-150.75' -> -15075. Any sign, zero allowed, at most 2 decimals; null if not a number.
// Parsed as two integers (whole + fraction) so no float math ever touches money.
export function parseCents(text) {
  const s = String(text).trim().replace(/,/g, '');
  const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const [, sign, whole, frac = ''] = m;
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  return sign ? -cents : cents;
}

// '150.75' -> 15075. Transactions only: must be above zero.
export function toCents(text) {
  const cents = parseCents(text);
  return cents > 0 ? cents : null;
}

// 15075 -> '₱150.75'. Display only; the stored value stays an integer.
export const formatPeso = (cents) => peso.format(cents / 100);

// 15075 -> '150.75', for prefilling an input.
export const centsToInput = (cents) => (cents / 100).toFixed(2);
