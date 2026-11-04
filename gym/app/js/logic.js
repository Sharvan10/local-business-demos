// IronCore owner app — pure business rules (no DOM). Unit-tested in /tests/gym-logic.test.js.
import { addDays, addMonths, diffDays, nextAnniversary, monthKey } from '../../../shared/dates.js';

export const DEFAULT_SETTINGS = {
  gymName: 'IronCore Fitness Club',
  dueSoonDays: 5,        // "Due soon" when this many days or fewer are left
  expireAfterDays: 15,   // "Overdue" for this many days after expiry, then "Expired"
  lateFee: 100,          // flat late fee (₹), 0 = off
  lateFeeAfterDays: 3,   // charged when renewing more than this many days late
  inactiveDays: 7,       // "Not visited in N+ days"
  pin: '1234',
  plans: [
    { id: 'monthly', months: 1, price: 1200 },
    { id: 'quarterly', months: 3, price: 3300 },
    { id: 'halfyearly', months: 6, price: 6000 },
    { id: 'yearly', months: 12, price: 10800 },
  ],
};

export const STATUS = { ACTIVE: 'active', DUE: 'due', OVERDUE: 'overdue', EXPIRED: 'expired', FROZEN: 'frozen', LEFT: 'left', NEW: 'new' };

export function planById(settings, id) { return settings.plans.find((p) => p.id === id) || settings.plans[0]; }

/** Freeze is active on `day` if from <= day < from + days. */
export function freezeActiveOn(f, day) { return f.from <= day && day < addDays(f.from, f.days); }

/** End date of a period: start + months − 1 day, pushed out by any freeze days attached to it. */
export function periodEnd(period, freezes = []) {
  const extra = freezes.filter((f) => f.periodId === period.id).reduce((s, f) => s + Number(f.days || 0), 0);
  return addDays(addMonths(period.start, Number(period.months)), -1 + extra);
}
export function periodBilled(p) { return Math.max(0, Number(p.price || 0) - Number(p.discount || 0) + Number(p.lateFee || 0)); }

/**
 * Everything the app shows about a member, derived fresh from raw records.
 * @param member { id, name, phone, joinDate, periods[], freezes[], left? }
 * @param payments all payments (filtered here by memberId)
 */
export function summarize(member, payments, settings, today) {
  const freezes = member.freezes || [];
  const periods = (member.periods || []).map((p) => ({ ...p, end: periodEnd(p, freezes), billed: periodBilled(p) }))
    .sort((a, b) => (a.start < b.start ? -1 : 1));
  const current = periods.filter((p) => p.start <= today).pop() || periods[0] || null;
  const latest = periods[periods.length - 1] || null;
  const expiry = latest ? latest.end : null;
  const pays = payments.filter((p) => p.memberId === member.id).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const totalPaid = pays.reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalBilled = periods.reduce((s, p) => s + p.billed, 0);
  const balance = totalBilled - totalPaid; // > 0 pending, < 0 advance/credit
  const lastPayment = pays[pays.length - 1] || null;
  const daysLeft = expiry ? diffDays(today, expiry) : null;
  const frozenBy = freezes.find((f) => freezeActiveOn(f, today)) || null;

  let status;
  let daysLate = 0;
  if (member.left) status = STATUS.LEFT;
  else if (!expiry) status = STATUS.NEW;
  else if (frozenBy && daysLeft >= 0) status = STATUS.FROZEN;
  else if (daysLeft > settings.dueSoonDays) status = STATUS.ACTIVE;
  else if (daysLeft >= 0) status = STATUS.DUE;
  else {
    daysLate = -daysLeft;
    status = daysLate <= settings.expireAfterDays ? STATUS.OVERDUE : STATUS.EXPIRED;
  }
  const plan = latest ? planById(settings, latest.planId) : null;
  return {
    id: member.id, status, expiry, daysLeft, daysLate, frozenBy,
    current, latest, periods, plan,
    totalPaid, totalBilled, balance: Math.max(0, balance), credit: Math.max(0, -balance),
    lastPayment, payments: pays,
    nextDue: expiry ? addDays(expiry, 1) : null,
    memberSince: member.joinDate || (periods[0] && periods[0].start) || null,
    isPlanValidToday: !!expiry && daysLeft >= 0,
  };
}

/** Where a renewal should start: right after the old expiry (no lost days, no free days) unless the plan
 *  lapsed past the overdue window — then the member restarts from today. */
export function renewalStart(summary, today) {
  if (!summary.expiry) return today;
  if (summary.status === STATUS.EXPIRED || summary.status === STATUS.LEFT) return today;
  return addDays(summary.expiry, 1);
}

export function lateFeeFor(summary, settings) {
  if (!settings.lateFee || summary.status !== STATUS.OVERDUE) return 0;
  return summary.daysLate > settings.lateFeeAfterDays ? Number(settings.lateFee) : 0;
}

/** What the member owes right now if they renew today on their current plan (used in reminders). */
export function amountDue(summary, settings) {
  const renewing = [STATUS.DUE, STATUS.OVERDUE, STATUS.EXPIRED].includes(summary.status);
  const planPrice = renewing && summary.plan ? Number(summary.plan.price) : 0;
  return summary.balance + planPrice + (renewing ? lateFeeFor(summary, settings) : 0);
}

/** Build a renewal: a new period + optional payment. Supports discounts, late fee and partial payment. */
export function makeRenewal({ summary, plan, today, start, discount = 0, lateFee = 0, amount, mode = 'Cash', ids }) {
  const s = start || renewalStart(summary, today);
  const period = { id: ids.period, planId: plan.id, months: Number(plan.months), price: Number(plan.price), discount: Number(discount) || 0, lateFee: Number(lateFee) || 0, start: s, createdAt: today };
  const end = periodEnd(period, []);
  const due = periodBilled(period) + summary.balance - summary.credit;
  const pay = amount === undefined || amount === '' ? due : Number(amount);
  const payment = pay > 0 ? { id: ids.payment, memberId: summary.id, date: today, amount: pay, mode, periodId: period.id, periodStart: s, periodEnd: end, receiptNo: ids.receipt, kind: 'renewal' } : null;
  return { period, payment, end, due, remaining: Math.max(0, due - pay) };
}

/** Collect (part of) the pending balance without starting a new period. */
export function makeBalancePayment({ summary, today, amount, mode = 'Cash', ids }) {
  const amt = Math.min(Number(amount) || 0, summary.balance);
  if (amt <= 0) return null;
  const p = summary.latest;
  return { id: ids.payment, memberId: summary.id, date: today, amount: amt, mode, periodId: p ? p.id : null, periodStart: p ? p.start : null, periodEnd: p ? p.end : null, receiptNo: ids.receipt, kind: 'balance' };
}

/** Freeze: attach to the period running on `from` (or the latest one). Expiry shifts by `days`. */
export function makeFreeze({ summary, from, days, reason = '', id }) {
  const d = Math.max(1, Math.round(Number(days) || 0));
  const p = summary.periods.filter((x) => x.start <= from).pop() || summary.latest;
  if (!p) throw new Error('No membership to freeze');
  if (from > p.end) throw new Error('Plan already ended on that date');
  return { id, periodId: p.id, from, days: d, reason, createdAt: from };
}

// ---- Attendance ----
export function indexAttendance(att) {
  const byMember = new Map();
  for (const a of att) {
    if (!byMember.has(a.m)) byMember.set(a.m, []);
    byMember.get(a.m).push(a);
  }
  for (const list of byMember.values()) list.sort((a, b) => (a.d + a.t < b.d + b.t ? -1 : 1));
  return byMember;
}
export function lastVisit(list) { return list && list.length ? list[list.length - 1].d : null; }

/** Consecutive visit days ending today (or yesterday, so a streak is not "lost" before today's workout). */
export function streak(list, today) {
  if (!list || !list.length) return 0;
  const days = new Set(list.map((a) => a.d));
  let d = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(d)) { n++; d = addDays(d, -1); }
  return n;
}
export function visitsInMonth(list, key) { return (list || []).filter((a) => monthKey(a.d) === key).length; }

export function isInactive(summary, list, today, settings) {
  if (![STATUS.ACTIVE, STATUS.DUE].includes(summary.status)) return false;
  const lv = lastVisit(list);
  const since = lv || summary.memberSince;
  return !!since && diffDays(since, today) >= settings.inactiveDays;
}

/** Visits made on days the plan was not valid (after expiry). */
export function visitsAfterExpiry(summary, list, today, lookback = 30) {
  if (!summary.expiry || summary.isPlanValidToday) return [];
  const from = addDays(today, -lookback);
  return (list || []).filter((a) => a.d > summary.expiry && a.d >= from);
}

export function birthdayIn(member, today, days = 7) {
  if (!member.dob) return null;
  const next = nextAnniversary(member.dob, today);
  const n = diffDays(today, next);
  return n <= days ? { date: next, inDays: n } : null;
}

// ---- Reminders ----
export const REMINDER_TYPES = ['due', 'overdue', 'expired', 'inactive', 'birthday'];
export function remindedToday(member, type, today) { return (member.reminders || []).some((r) => r.date === today && r.type === type); }

/** Build every reminder queue. Expired members are only included for 60 days after expiry. */
export function reminderQueues({ members, summaries, attIndex, settings, today }) {
  const q = { due: [], overdue: [], expired: [], inactive: [], birthday: [] };
  for (const m of members) {
    const s = summaries.get(m.id);
    if (!s || s.status === STATUS.LEFT) continue;
    if (s.status === STATUS.DUE) q.due.push(m);
    if (s.status === STATUS.OVERDUE || (s.balance > 0 && [STATUS.ACTIVE, STATUS.FROZEN].includes(s.status))) q.overdue.push(m);
    if (s.status === STATUS.EXPIRED && s.daysLate <= 60) q.expired.push(m);
    if (isInactive(s, attIndex.get(m.id), today, settings)) q.inactive.push(m);
    if (birthdayIn(m, today, 7)) q.birthday.push(m);
  }
  q.due.sort((a, b) => summaries.get(a.id).daysLeft - summaries.get(b.id).daysLeft);
  q.overdue.sort((a, b) => summaries.get(b.id).daysLate - summaries.get(a.id).daysLate);
  q.expired.sort((a, b) => summaries.get(a.id).daysLate - summaries.get(b.id).daysLate);
  return q;
}

/** Next sequential ID like IC0042 / IC-2026-0007. */
export function nextId(prefix, n, width = 4) { return `${prefix}${String(n).padStart(width, '0')}`; }

/** Monthly collection totals for the last `count` months ending with today's month. */
export function monthlyCollection(payments, today, count = 6) {
  const out = [];
  const end = monthKey(today);
  for (let i = count - 1; i >= 0; i--) {
    const k = monthKey(addMonths(end + '-01', -i));
    out.push({ key: k, total: payments.filter((p) => monthKey(p.date) === k).reduce((s, p) => s + Number(p.amount), 0) });
  }
  return out;
}
