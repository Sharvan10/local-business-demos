// CSV export helpers (RFC 4180 quoting, UTF-8 BOM so Excel shows ₹ / Hindi / Punjabi correctly).
export function toCSV(rows, columns) {
  const cols = columns || (rows[0] ? Object.keys(rows[0]).map((k) => ({ key: k, label: k })) : []);
  const q = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = cols.map((c) => q(c.label)).join(',');
  const body = rows.map((r) => cols.map((c) => q(typeof c.value === 'function' ? c.value(r) : r[c.key])).join(','));
  return '﻿' + [head, ...body].join('\r\n');
}
