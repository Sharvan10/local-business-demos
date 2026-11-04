import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../gym/app/js/logic.js';

const S = { ...L.DEFAULT_SETTINGS };
const monthly = S.plans[0];
const quarterly = S.plans[1];
const member = (periods, extra = {}) => ({ id: 'IC0001', name: 'Test', joinDate: periods[0] ? periods[0].start : null, periods, freezes: [], ...extra });
const per = (start, plan = monthly, extra = {}) => ({ id: 'p' + start, planId: plan.id, months: plan.months, price: plan.price, discount: 0, lateFee: 0, start, ...extra });
const ids = { period: 'pN', payment: 'payN', receipt: 'R1' };

test('expiry = start + plan length − 1 day', () => {
  const s = L.summarize(member([per('2026-11-01')]), [], S, '2026-11-04');
  assert.equal(s.expiry, '2026-11-30');
  assert.equal(s.daysLeft, 26);
  assert.equal(s.status, 'active');
  assert.equal(s.nextDue, '2026-12-01');
  const q = L.summarize(member([per('2026-01-31', quarterly)]), [], S, '2026-02-01');
  assert.equal(q.expiry, '2026-04-29');
});

test('due soon window is configurable', () => {
  const m = member([per('2026-10-10')]); // expires 2026-11-09
  assert.equal(L.summarize(m, [], S, '2026-11-04').status, 'due'); // 5 days left
  assert.equal(L.summarize(m, [], S, '2026-11-03').status, 'active'); // 6 days left
  assert.equal(L.summarize(m, [], { ...S, dueSoonDays: 7 }, '2026-11-03').status, 'due');
  assert.equal(L.summarize(m, [], S, '2026-11-09').daysLeft, 0); // last day still valid
  assert.equal(L.summarize(m, [], S, '2026-11-09').status, 'due');
});

test('overdue shows days late, then expired after the window', () => {
  const m = member([per('2026-10-01')]); // expires 2026-10-31
  const s = L.summarize(m, [], S, '2026-11-04');
  assert.equal(s.status, 'overdue');
  assert.equal(s.daysLate, 4);
  assert.equal(L.summarize(m, [], S, '2026-11-15').status, 'overdue'); // 15 days late
  const e = L.summarize(m, [], S, '2026-11-16');
  assert.equal(e.status, 'expired');
  assert.equal(e.daysLate, 16);
  assert.equal(L.summarize(member([]), [], S, '2026-11-04').status, 'new');
  assert.equal(L.summarize(member([per('2026-10-01')], { left: true }), [], S, '2026-11-04').status, 'left');
});

test('freeze shifts expiry and shows frozen status while active', () => {
  const m = member([per('2026-11-01')]);
  const s0 = L.summarize(m, [], S, '2026-11-04');
  const f = L.makeFreeze({ summary: s0, from: '2026-11-05', days: 10, id: 'f1' });
  m.freezes.push(f);
  assert.equal(L.summarize(m, [], S, '2026-11-04').expiry, '2026-12-10');
  assert.equal(L.summarize(m, [], S, '2026-11-05').status, 'frozen');
  assert.equal(L.summarize(m, [], S, '2026-11-14').status, 'frozen');
  assert.equal(L.summarize(m, [], S, '2026-11-15').status, 'active');
  assert.throws(() => L.makeFreeze({ summary: L.summarize(m, [], S, '2026-12-20'), from: '2026-12-20', days: 5, id: 'f2' }));
});

test('renewal before expiry continues from old expiry (no lost days)', () => {
  const m = member([per('2026-10-10')]); // expires 2026-11-09
  const s = L.summarize(m, [{ memberId: 'IC0001', amount: 1200, date: '2026-10-10' }], S, '2026-11-04');
  assert.equal(L.renewalStart(s, '2026-11-04'), '2026-11-10');
  const r = L.makeRenewal({ summary: s, plan: monthly, today: '2026-11-04', ids });
  assert.equal(r.period.start, '2026-11-10');
  assert.equal(r.end, '2026-12-09');
  assert.equal(r.payment.amount, 1200);
  assert.equal(r.payment.periodEnd, '2026-12-09');
});

test('overdue renewal is back-dated to expiry; long-expired restarts today', () => {
  const m = member([per('2026-10-01')]); // expired 2026-10-31
  const over = L.summarize(m, [], S, '2026-11-04');
  assert.equal(L.renewalStart(over, '2026-11-04'), '2026-11-01');
  const exp = L.summarize(m, [], S, '2026-12-20');
  assert.equal(L.renewalStart(exp, '2026-12-20'), '2026-12-20');
  assert.equal(L.renewalStart(L.summarize(member([]), [], S, '2026-12-20'), '2026-12-20'), '2026-12-20');
});

test('partial payments leave a balance that can be collected later', () => {
  const m = member([per('2026-11-01', quarterly, { discount: 300 })]); // billed 3000
  const pays = [{ id: 'a', memberId: 'IC0001', date: '2026-11-01', amount: 2000 }];
  let s = L.summarize(m, pays, S, '2026-11-04');
  assert.equal(s.totalBilled, 3000);
  assert.equal(s.balance, 1000);
  const bal = L.makeBalancePayment({ summary: s, today: '2026-11-04', amount: 600, ids });
  assert.equal(bal.amount, 600);
  pays.push(bal);
  s = L.summarize(m, pays, S, '2026-11-04');
  assert.equal(s.balance, 400);
  // cannot over-collect
  assert.equal(L.makeBalancePayment({ summary: s, today: '2026-11-04', amount: 5000, ids }).amount, 400);
  // a renewal adds the old balance to what is due now
  const r = L.makeRenewal({ summary: s, plan: monthly, today: '2026-11-04', amount: 1000, ids });
  assert.equal(r.due, 1600);
  assert.equal(r.remaining, 600);
  assert.equal(L.makeBalancePayment({ summary: { ...s, balance: 0 }, today: '2026-11-04', amount: 10, ids }), null);
});

test('late fee only after X days late, only when overdue', () => {
  const m = member([per('2026-10-01')]); // expired 2026-10-31
  assert.equal(L.lateFeeFor(L.summarize(m, [], S, '2026-11-03'), S), 0); // 3 days late, not > 3
  assert.equal(L.lateFeeFor(L.summarize(m, [], S, '2026-11-04'), S), 100); // 4 days late
  assert.equal(L.lateFeeFor(L.summarize(m, [], { ...S, lateFee: 0 }, '2026-11-04'), { ...S, lateFee: 0 }), 0);
  assert.equal(L.lateFeeFor(L.summarize(m, [], S, '2026-12-30'), S), 0); // expired => fresh start, no late fee
  const s = L.summarize(m, [{ memberId: 'IC0001', amount: 1200 }], S, '2026-11-04');
  assert.equal(L.amountDue(s, S), 1300); // plan + late fee
  const r = L.makeRenewal({ summary: s, plan: monthly, today: '2026-11-04', lateFee: 100, discount: 50, ids });
  assert.equal(r.due, 1250);
});

test('attendance streak, inactivity and visits after expiry', () => {
  const list = ['2026-11-01', '2026-11-02', '2026-11-03'].map((d) => ({ m: 'IC0001', d, t: '07:00' }));
  assert.equal(L.streak(list, '2026-11-04'), 3); // yesterday still counts
  assert.equal(L.streak([...list, { m: 'IC0001', d: '2026-11-04', t: '07:00' }], '2026-11-04'), 4);
  assert.equal(L.streak(list, '2026-11-05'), 0);
  const m = member([per('2026-10-20')]);
  const s = L.summarize(m, [], S, '2026-11-04');
  assert.equal(L.isInactive(s, [{ d: '2026-10-28' }], '2026-11-04', S), true);
  assert.equal(L.isInactive(s, [{ d: '2026-10-29' }], '2026-11-04', S), false);
  const old = member([per('2026-09-01')]); // expired 2026-09-30
  const so = L.summarize(old, [], S, '2026-11-04');
  assert.equal(L.visitsAfterExpiry(so, [{ d: '2026-09-29' }, { d: '2026-10-20' }], '2026-11-04').length, 1);
});

test('birthdays within a week and reminder queues', () => {
  const a = member([per('2026-10-10')], { id: 'A', dob: '1998-11-08' }); // due
  const b = member([per('2026-10-01')], { id: 'B' }); // overdue
  const c = member([per('2026-09-01')], { id: 'C' }); // expired 35 days ago
  const today = '2026-11-04';
  assert.deepEqual(L.birthdayIn(a, today), { date: '2026-11-08', inDays: 4 });
  const fix = (x) => ({ ...x, periods: x.periods.map((p) => ({ ...p, id: x.id + p.id })) });
  const members = [a, b, c].map(fix);
  const summaries = new Map(members.map((m) => [m.id, L.summarize(m, [], S, today)]));
  const q = L.reminderQueues({ members, summaries, attIndex: new Map(), settings: S, today });
  assert.deepEqual(q.due.map((m) => m.id), ['A']);
  assert.deepEqual(q.overdue.map((m) => m.id), ['B']);
  assert.deepEqual(q.expired.map((m) => m.id), ['C']);
  assert.deepEqual(q.birthday.map((m) => m.id), ['A']);
  const reminded = { ...a, reminders: [{ date: today, type: 'due' }] };
  assert.equal(L.remindedToday(reminded, 'due', today), true);
  assert.equal(L.remindedToday(reminded, 'due', '2026-11-05'), false);
});

test('monthly collection buckets payments by month', () => {
  const pays = [{ date: '2026-11-01', amount: 100 }, { date: '2026-11-03', amount: 50 }, { date: '2026-09-15', amount: 70 }];
  const m = L.monthlyCollection(pays, '2026-11-04', 3);
  assert.deepEqual(m, [{ key: '2026-09', total: 70 }, { key: '2026-10', total: 0 }, { key: '2026-11', total: 150 }]);
  assert.equal(L.nextId('IC', 42), 'IC0042');
});
