import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as J from '../jewellers/js/logic.js';

const rates = { gold24: 78000, gold22: 72000, gold18: 59000, silver: 90000 };

test('rate per gram from board rates', () => {
  assert.equal(J.ratePerGram('22K', rates), 7200);
  assert.equal(J.ratePerGram('999', rates), 90);
  assert.equal(J.ratePerGram('925', rates), 83.25);
  assert.equal(J.ratePerGram('XX', rates), 0);
});

test('price = weight × rate + making % + stones, then 3% GST', () => {
  const p = J.priceBreakup({ weight: 10, purity: '22K', making: 12, stone: 0 }, rates);
  assert.deepEqual(p, { metal: 72000, making: 8640, stone: 0, sub: 80640, gst: 2419, total: 83059 });
  const d = J.priceBreakup({ weight: 3.2, purity: '18K', making: 18, stone: 25000 }, rates);
  assert.equal(d.metal, 18880);
  assert.equal(d.total, Math.round((18880 + 3398 + 25000) * 1.03));
});

test('changing the gold rate recomputes every catalogue price', () => {
  const items = [{ id: 'a', weight: 10, purity: '22K', making: 10 }, { id: 'b', weight: 50, purity: '925', making: 5 }];
  const before = J.repriceCatalogue(items, rates);
  const after = J.repriceCatalogue(items, { ...rates, gold22: 73000 });
  assert.ok(after[0].price > before[0].price);
  assert.equal(after[0].price - before[0].price, Math.round(J.priceBreakup(items[0], { ...rates, gold22: 73000 }).total - J.priceBreakup(items[0], rates).total));
  assert.equal(after[1].price, before[1].price); // silver untouched
  assert.equal(items[0].price, undefined); // pure
});

test('savings scheme: on track, due soon, due, overdue, completed, matured', () => {
  const e = { start: '2026-06-10', months: 11, instalment: 5000, bonus: 5000, payments: [] };
  const pay = (n) => ({ ...e, payments: Array.from({ length: n }, (_, i) => ({ amount: 5000, date: `2026-0${6 + i}-10` })) });
  let s = J.schemeStatus(pay(6), '2026-11-04');
  assert.equal(s.dueCount, 5); assert.equal(s.pending, 0); assert.equal(s.nextDue, '2026-12-10'); assert.equal(s.status, 'ontrack'); // paid one month ahead
  assert.equal(J.schemeStatus(pay(6), '2026-12-06').status, 'duesoon');
  s = J.schemeStatus(pay(5), '2026-11-12');
  assert.equal(s.status, 'due'); assert.equal(s.pending, 1); assert.equal(s.pendingAmt, 5000); assert.equal(s.daysLate, 2);
  s = J.schemeStatus(pay(4), '2026-11-04');
  assert.equal(s.status, 'overdue'); assert.equal(s.pending, 1); assert.equal(s.nextDue, '2026-10-10'); assert.equal(s.daysLate, 25);
  assert.equal(s.maturity, '2027-05-10'); assert.equal(s.maturityValue, 60000);
  assert.equal(J.schemeStatus(pay(11), '2027-04-20').status, 'completed');
  assert.equal(J.schemeStatus(pay(11), '2027-05-10').status, 'matured');
  // partial instalment does not count as paid
  assert.equal(J.schemeStatus({ ...e, payments: [{ amount: 7000 }] }, '2026-06-10').paidCount, 1);
});

test('ledger, job lateness and occasions', () => {
  assert.equal(J.ledgerBalance([{ type: 'purchase', amount: 100000 }, { type: 'payment', amount: 60000 }, { type: 'payment', amount: 10000 }]), 30000);
  assert.equal(J.jobLate({ status: 'working', promised: '2026-11-01' }, '2026-11-04'), 3);
  assert.equal(J.jobLate({ status: 'ready', promised: '2026-11-01' }, '2026-11-04'), 0);
  const occ = J.occasions([{ name: 'A', dob: '1990-11-06', anniversary: '2015-12-30' }, { name: 'B', anniversary: '2010-11-04' }], '2026-11-04');
  assert.deepEqual(occ.map((o) => [o.c.name, o.kind, o.inDays]), [['B', 'anniversary', 0], ['A', 'dob', 2]]);
});
