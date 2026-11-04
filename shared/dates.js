// Date utilities. All calendar dates are plain 'YYYY-MM-DD' strings (local calendar day),
// computed with UTC arithmetic so time zones and DST can never shift a day.
const DAY = 86400000;
const pad = (n) => String(n).padStart(2, '0');

export const LOCALES = { en: 'en-IN', hi: 'hi-IN', pa: 'pa-IN' };

export function iso(y, m, d) { return `${y}-${pad(m)}-${pad(d)}`; }
export function isValidISO(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}
export function parseISO(s) { const [y, m, d] = s.split('-').map(Number); return { y, m, d }; }
const toUTC = (s) => { const { y, m, d } = parseISO(s); return Date.UTC(y, m - 1, d); };
const fromUTC = (ms) => { const t = new Date(ms); return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()); };

export function todayISO(now = new Date()) { return iso(now.getFullYear(), now.getMonth() + 1, now.getDate()); }
export function nowTime(now = new Date()) { return `${pad(now.getHours())}:${pad(now.getMinutes())}`; }
export function daysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
export function addDays(s, n) { return fromUTC(toUTC(s) + n * DAY); }
/** Add calendar months, clamping the day (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(s, n) {
  const { y, m, d } = parseISO(s);
  const t = y * 12 + (m - 1) + n;
  const ny = Math.floor(t / 12), nm = (t % 12 + 12) % 12 + 1;
  return iso(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}
/** Whole days from a to b (positive when b is later). */
export function diffDays(a, b) { return Math.round((toUTC(b) - toUTC(a)) / DAY); }
export function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
export function maxISO(...d) { return d.filter(Boolean).sort().pop() || null; }
export function minISO(...d) { return d.filter(Boolean).sort()[0] || null; }
export function inRange(s, from, to) { return s >= from && s <= to; }
export function monthKey(s) { return s.slice(0, 7); }
export function startOfMonth(s) { return s.slice(0, 8) + '01'; }
export function endOfMonth(s) { const { y, m } = parseISO(s); return iso(y, m, daysInMonth(y, m)); }
export function addMonthsKey(key, n) { return addMonths(key + '-01', n).slice(0, 7); }
export function weekday(s) { return new Date(toUTC(s)).getUTCDay(); }
/** Monday-based week containing s. */
export function weekRange(s) { const wd = (weekday(s) + 6) % 7; const start = addDays(s, -wd); return [start, addDays(start, 6)]; }

/** Next occurrence (on or after `from`) of the month/day of `date`. 29 Feb falls on 28 Feb in non-leap years. */
export function nextAnniversary(date, from) {
  const { m, d } = parseISO(date);
  const { y } = parseISO(from);
  const make = (yy) => iso(yy, m, Math.min(d, daysInMonth(yy, m)));
  const thisYear = make(y);
  return thisYear >= from ? thisYear : make(y + 1);
}
export function daysUntilAnniversary(date, from) { return diffDays(from, nextAnniversary(date, from)); }
export function ageOn(dob, on) {
  const a = parseISO(dob), b = parseISO(on);
  let age = b.y - a.y;
  if (b.m < a.m || (b.m === a.m && b.d < a.d)) age--;
  return age;
}
export function msUntilNextMidnight(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
  return next - now;
}
export function formatDate(s, lang = 'en', opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!s) return '';
  try { return new Intl.DateTimeFormat(LOCALES[lang] || 'en-IN', { ...opts, timeZone: 'UTC' }).format(new Date(toUTC(s))); }
  catch { return s; }
}
export function formatMonth(key, lang = 'en', long = false) {
  return formatDate(key + '-01', lang, { month: long ? 'long' : 'short', year: long ? 'numeric' : '2-digit' });
}
