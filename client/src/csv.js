// Quote a cell only when it needs it (comma, quote or newline inside).
const cell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Starts with a BOM so Excel reads it as UTF-8 and shows ₱ correctly.
export const toCsv = (header, rows) =>
  '﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');

export function downloadCsv(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
