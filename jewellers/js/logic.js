// Shree Heera Jewellers — pure rules (unit-tested): rate → price, savings scheme dues, ledgers, job status.
import { addMonths, diffDays, nextAnniversary } from '../../shared/dates.js';

// Gold rates are quoted per 10 g, silver per kg (as on Indian rate boards).
export const PURITIES = {
  '24K': { metal: 'gold', key: 'gold24', per: 10, factor: 1 },
  '22K': { metal: 'gold', key: 'gold22', per: 10, factor: 1 },
  '18K': { metal: 'gold', key: 'gold18', per: 10, factor: 1 },
  '999': { metal: 'silver', key: 'silver', per: 1000, factor: 1 },
  '925': { metal: 'silver', key: 'silver', per: 1000, factor: 0.925 },
};
export const DEFAULT_RATES = { gold24: 78500, gold22: 72000, gold18: 58900, silver: 92000 };

export function ratePerGram(purity, rates) {
  const p = PURITIES[purity];
  if (!p) return 0;
  return (Number(rates[p.key]) || 0) / p.per * p.factor;
}

/** Price = metal value + making charge (% of metal) + stone value, then GST (3% on jewellery). */
export function priceBreakup({ weight, purity, making = 0, stone = 0 }, rates, gstPct = 3) {
  const metal = Math.round(Number(weight) * ratePerGram(purity, rates));
  const makingAmt = Math.round((metal * Number(making)) / 100);
  const sub = metal + makingAmt + Math.round(Number(stone) || 0);
  const gst = Math.round((sub * gstPct) / 100);
  return { metal, making: makingAmt, stone: Math.round(Number(stone) || 0), sub, gst, total: sub + gst };
}

/** Recompute every catalogue price for new rates (returns new array; inputs untouched). */
export function repriceCatalogue(items, rates, gstPct = 3) {
  return items.map((it) => ({ ...it, price: priceBreakup(it, rates, gstPct).total }));
}

// ---- Savings scheme ("pay 11 instalments, shop adds the 12th") ----
export function schemeStatus(e, today, { dueSoonDays = 5, graceDays = 7 } = {}) {
  const paidAmt = (e.payments || []).reduce((s, p) => s + Number(p.amount), 0);
  const paidCount = Math.min(e.months, Math.floor(paidAmt / e.instalment));
  let dueCount = 0;
  for (let k = 0; k < e.months; k++) if (addMonths(e.start, k) <= today) dueCount++;
  const pending = Math.max(0, dueCount - paidCount);
  const nextDue = paidCount < e.months ? addMonths(e.start, paidCount) : null;
  const maturity = addMonths(e.start, e.months);
  const bonus = Number(e.bonus || 0);
  let status;
  let daysLate = 0;
  if (e.closed) status = 'closed';
  else if (paidCount >= e.months) status = today >= maturity ? 'matured' : 'completed';
  else if (pending > 0) { daysLate = diffDays(nextDue, today); status = daysLate > graceDays ? 'overdue' : 'due'; }
  else status = diffDays(today, nextDue) <= dueSoonDays ? 'duesoon' : 'ontrack';
  return { paidAmt, paidCount, dueCount, pending, pendingAmt: pending * e.instalment, nextDue, maturity, status, daysLate, maturityValue: e.instalment * e.months + bonus, progress: paidCount / e.months };
}

// ---- Customer ledger ----
export function ledgerBalance(entries = []) {
  return entries.reduce((s, x) => s + (x.type === 'purchase' ? Number(x.amount) : -Number(x.amount)), 0);
}

// ---- Custom orders / repairs ----
export const JOB_STATUSES = ['received', 'working', 'ready', 'delivered'];
export function jobLate(job, today) { return !['ready', 'delivered'].includes(job.status) && job.promised < today ? diffDays(job.promised, today) : 0; }

/** Birthdays and anniversaries within `days` days. */
export function occasions(customers, today, days = 7) {
  const out = [];
  for (const c of customers) {
    for (const kind of ['dob', 'anniversary']) {
      if (!c[kind]) continue;
      const date = nextAnniversary(c[kind], today);
      const inDays = diffDays(today, date);
      if (inDays <= days) out.push({ c, kind, date, inDays });
    }
  }
  return out.sort((a, b) => a.inDays - b.inDays);
}
