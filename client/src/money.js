const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

// '150.75' -> 15075. Returns null for anything that is not a positive amount with at most 2 decimals.
// Parsed as two integers (whole + fraction) so no float math ever touches money.
export function toCents(text) {
  const s = String(text).trim().replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  return cents > 0 ? cents : null;
}

// 15075 -> '₱150.75'. Display only; the stored value stays an integer.
export const formatPeso = (cents) => peso.format(cents / 100);
