// Fictional demo data, generated relative to "today" so the demo always looks alive.
// Phone numbers start with 5 — no Indian mobile number does — so no real person can ever be messaged.
import { addDays, addMonths, todayISO, weekday, diffDays } from '../../../shared/dates.js';
import { DEFAULT_SETTINGS, periodEnd } from './logic.js';

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const MEN = ['Gurpreet', 'Harjot', 'Jaskaran', 'Navjot', 'Rajveer', 'Arjun', 'Karan', 'Rohit', 'Ishaan', 'Tanvir', 'Sukhman', 'Vikram', 'Anmol', 'Sahil', 'Gagandeep', 'Inderjit', 'Kuldeep', 'Ekam', 'Manveer', 'Prabhjot', 'Harsh', 'Aryan', 'Jagdeep', 'Lovepreet', 'Kabir'];
const WOMEN = ['Simran', 'Manpreet', 'Kirandeep', 'Harleen', 'Neha', 'Priya', 'Mehak', 'Jasleen', 'Ravneet', 'Noor', 'Amrit', 'Sukhleen', 'Tanya', 'Gurleen', 'Pooja'];
const SURN = ['Sandhu', 'Gill', 'Sidhu', 'Dhillon', 'Brar', 'Grewal', 'Bains', 'Sharma', 'Arora', 'Malhotra', 'Bedi', 'Chahal', 'Virk', 'Mann', 'Randhawa', 'Bhullar', 'Saini', 'Kang'];
const NOTES = ['', '', '', 'Wants weight loss plan', 'Knee injury — avoid heavy squats', 'Morning batch', 'Evening batch', 'Prepping for police recruitment test', 'Referred by a member', 'Personal training on Tue/Thu'];

export function seedGym(today = todayISO()) {
  // days covered by a plan that started `back` days ago, used to place some renewals in the current week
  const D30 = (months) => diffDays(today, addDays(addMonths(today, months), -1));
  const r = rng(20261104);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const int = (a, b) => a + Math.floor(r() * (b - a + 1));
  const settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  const members = [];
  const payments = [];
  const attendance = [];
  let receipt = 0;
  const modes = ['Cash', 'UPI', 'UPI', 'UPI', 'Card'];
  // profile: [count, expiryOffsetMin, expiryOffsetMax]
  const profiles = [
    ...Array(24).fill('active'), ...Array(5).fill('due'), ...Array(5).fill('overdue'),
    ...Array(5).fill('expired'), 'left', 'left', 'new',
  ];
  profiles.forEach((profile, i) => {
    const female = r() < 0.36;
    const first = female ? pick(WOMEN) : pick(MEN);
    const last = female && r() < 0.55 ? 'Kaur' : (!female && r() < 0.45 ? 'Singh' : pick(SURN));
    const id = `IC${String(i + 1).padStart(4, '0')}`;
    const planIdx = (() => { const x = r(); return x < 0.5 ? 0 : x < 0.75 ? 1 : x < 0.9 ? 2 : 3; })();
    const plan = settings.plans[planIdx];
    let offset;
    if (profile === 'active') offset = i % 3 === 0 ? D30(plan.months) - int(1, 3) : int(6, plan.months * 30 - 3);
    else if (profile === 'due') offset = int(0, 5);
    else if (profile === 'overdue') offset = -int(1, 13);
    else if (profile === 'expired' || profile === 'left') offset = -int(20, 75);
    else offset = int(20, 28);
    const lastEnd = addDays(today, offset);
    const lastStart = addMonths(addDays(lastEnd, 1), -plan.months);
    const history = profile === 'new' ? 0 : int(0, planIdx >= 2 ? 1 : 4);
    const periods = [];
    let s = lastStart;
    for (let k = 0; k <= history; k++) {
      periods.unshift({ id: `${id}-p${history - k + 1}`, planId: plan.id, months: plan.months, price: plan.price, discount: 0, lateFee: 0, start: s, createdAt: s });
      s = addMonths(s, -plan.months);
    }
    const joinDate = periods[0].start;
    if (planIdx === 3 && r() < 0.6) periods[periods.length - 1].discount = 800;
    if (profile === 'new') periods[0].discount = 0;
    const dob = r() < 0.75 ? addDays(today, -int(17 * 365, 46 * 365)) : '';
    const m = {
      id, name: `${first} ${last}`, phone: `5${int(10000, 99999)}${int(10000, 99999)}`.slice(0, 10),
      gender: female ? 'F' : 'M', dob, photo: '', joinDate, notes: pick(NOTES), periods, freezes: [], reminders: [],
      createdAt: joinDate,
    };
    if (profile === 'left') { m.left = true; m.leftDate = addDays(lastEnd, int(5, 15)); m.leftReason = pick(['Moved to Chandigarh', 'Joined college hostel', 'Busy at work']); }
    // payments: each period paid on/around its start; a few latest periods only partly paid
    periods.forEach((p, k) => {
      const billed = p.price - p.discount + p.lateFee;
      const isLatest = k === periods.length - 1;
      const partial = isLatest && (i % 6 === 2) && profile !== 'left';
      const date = k === 0 ? p.start : addDays(p.start, -int(0, 2));
      const amt = partial ? Math.round(billed * 0.5 / 100) * 100 : billed;
      if (date <= today) {
        receipt++;
        payments.push({ id: `${id}-pay${k + 1}`, memberId: id, date, amount: amt, mode: pick(modes), periodId: p.id, periodStart: p.start, periodEnd: periodEnd(p), receiptNo: `IC-${date.slice(0, 4)}-${String(receipt).padStart(4, '0')}`, kind: k === 0 ? 'join' : 'renewal' });
      }
    });
    members.push(m);
  });
  // One member is on a freeze right now (travelling), one has an old freeze in history
  const frozen = members.find((m, i) => i > 3 && !m.left && m.periods.length > 1);
  if (frozen) {
    const p = frozen.periods[frozen.periods.length - 1];
    frozen.freezes.push({ id: 'fz1', periodId: p.id, from: addDays(today, -3), days: 14, reason: 'Travelling to Canada for a wedding', createdAt: addDays(today, -4) });
  }
  const oldFreeze = members[7];
  if (oldFreeze && oldFreeze.periods.length > 1) {
    const p = oldFreeze.periods[0];
    oldFreeze.freezes.push({ id: 'fz0', periodId: p.id, from: addDays(p.start, 10), days: 7, reason: 'Viral fever', createdAt: addDays(p.start, 10) });
  }
  // Birthdays this week for three members
  [2, 9, 15].forEach((i, k) => { const m = members[i]; if (m) { const target = addDays(today, k * 2 + 1); m.dob = `${Number(target.slice(0, 4)) - (22 + k * 5)}${target.slice(4)}`; if (m.dob.endsWith('02-29')) m.dob = m.dob.replace('02-29', '02-28'); } });

  // Attendance for the last 75 days
  const inactiveIdx = new Set([1, 5, 12, 20]);
  const expiredVisitors = new Set();
  members.forEach((m, i) => {
    const pVisit = 0.3 + r() * 0.55;
    const preferEvening = r() < 0.45;
    const lastPeriod = m.periods[m.periods.length - 1];
    const end = periodEnd(lastPeriod, m.freezes);
    const isExpiredVisitor = end < today && !m.left && expiredVisitors.size < 2 && diffDays(end, today) < 30;
    if (isExpiredVisitor) expiredVisitors.add(m.id);
    for (let d = 75; d >= 0; d--) {
      const day = addDays(today, -d);
      if (day < m.joinDate) continue;
      if (m.left && day > m.leftDate) continue;
      if (inactiveIdx.has(i) && d < 11) continue;
      if (m.freezes.some((f) => f.from <= day && day < addDays(f.from, f.days))) continue;
      const valid = day <= end;
      if (!valid && !(isExpiredVisitor && diffDays(end, day) <= 6)) continue;
      if (weekday(day) === 0 && r() < 0.8) continue;
      if (r() > (d === 0 ? 0.35 : pVisit)) continue;
      const h = preferEvening ? int(17, 20) : int(5, 9);
      const t = `${String(h).padStart(2, '0')}:${String(int(0, 59)).padStart(2, '0')}`;
      attendance.push({ m: m.id, d: day, t: d === 0 ? `0${int(5, 8)}:${String(int(10, 59)).padStart(2, '0')}` : t });
    }
  });
  attendance.sort((a, b) => (a.d + a.t < b.d + b.t ? -1 : 1));
  return { settings, counters: { member: members.length, receipt }, members, payments, attendance, seededFor: today };
}

export const GYM_STORE_VERSION = 2;
export const gymMigrations = {
  // v1 stored a single `plan` + `expiry` on the member; v2 keeps a list of periods and reminder history.
  2: (d) => {
    (d.members || []).forEach((m) => {
      if (!m.periods) {
        m.periods = m.plan ? [{ id: `${m.id}-p1`, planId: m.plan, months: m.months || 1, price: m.price || 0, discount: 0, lateFee: 0, start: m.start || m.joinDate }] : [];
        delete m.plan; delete m.expiry;
      }
      m.freezes = m.freezes || [];
      m.reminders = m.reminders || [];
    });
    d.settings = { ...DEFAULT_SETTINGS, ...(d.settings || {}) };
    d.counters = d.counters || { member: (d.members || []).length, receipt: (d.payments || []).length };
    return d;
  },
};
