import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../gym/app/js/logic.js';
import { seedEnquiries, seedGym, emptyGym, gymMigrations, GYM_STORE_VERSION } from '../gym/app/js/seed.js';
import { migrate } from '../shared/storage.js';

const T = '2026-11-04';
const enq = (extra = {}) => ({ id: 'EQ1', name: 'Test Person', phone: '50123 45678', goal: 'goal.2', time: '1', date: '2026-11-01', status: 'new', history: [{ date: '2026-11-01', status: 'new' }], ...extra });

test('enquiry status flow: New → Contacted → Joined, with dates and history', () => {
  let e = enq();
  e = L.setEnquiryStatus(e, 'contacted', '2026-11-02');
  assert.equal(e.status, 'contacted');
  assert.equal(e.contactedDate, '2026-11-02');
  e = L.setEnquiryStatus(e, 'joined', T, 'IC0043');
  assert.equal(e.status, 'joined');
  assert.equal(e.memberId, 'IC0043');
  assert.equal(e.statusDate, T);
  assert.equal(e.contactedDate, '2026-11-02'); // first contact date is kept
  assert.deepEqual(e.history.map((h) => h.status), ['new', 'contacted', 'joined']);
});

test('enquiry status flow: Not interested, re-opening, no-ops and bad statuses', () => {
  const orig = enq();
  const lost = L.setEnquiryStatus(orig, 'lost', T);
  assert.equal(lost.status, 'lost');
  assert.equal(orig.status, 'new', 'pure: the original is not changed');
  const again = L.setEnquiryStatus(lost, 'lost', T);
  assert.equal(again, lost, 'same status twice adds no history');
  const reopened = L.setEnquiryStatus(L.setEnquiryStatus(orig, 'joined', T, 'IC0001'), 'contacted', T);
  assert.equal(reopened.memberId, undefined, 'leaving "joined" drops the member link');
  assert.throws(() => L.setEnquiryStatus(orig, 'maybe', T));
  assert.deepEqual(L.ENQ_STATUS, ['new', 'contacted', 'joined', 'lost']);
});

test('calling or WhatsApp-ing moves only New enquiries to Contacted', () => {
  assert.equal(L.afterContact(enq(), T).status, 'contacted');
  const joined = enq({ status: 'joined', memberId: 'IC0002' });
  assert.equal(L.afterContact(joined, T), joined);
  const lost = enq({ status: 'lost' });
  assert.equal(L.afterContact(lost, T).status, 'lost');
});

test('convert to member: Add Member form is pre-filled with name, clean 10-digit phone and the goal', () => {
  const p = L.enquiryPrefill(enq({ name: '  Test Person ' }), 'Build muscle');
  assert.deepEqual(p, { name: 'Test Person', phone: '5012345678', notes: 'Free trial enquiry · Build muscle', enquiryId: 'EQ1' });
  assert.equal(L.enquiryPrefill(enq({ phone: '+91 50123-45678' })).phone, '5012345678');
  assert.equal(L.enquiryPrefill(enq({ phone: '050123 45678' })).phone, '5012345678');
  assert.equal(L.enquiryPrefill(enq(), '', 'फ्री ट्रायल पूछताछ').notes, 'फ्री ट्रायल पूछताछ');
  assert.equal(L.cleanPhone('12345'), '12345', 'odd numbers are kept as typed');
});

test('website form entries are imported once, newest first, as New', () => {
  const site = [
    { name: 'A One', phone: '5000000001', goal: 'Lose weight', goalKey: '1', time: '3', at: '2026-11-03T05:00:00.000Z' },
    { name: 'B Two', phone: '5000000002', goal: 'Build muscle', time: '1', at: '2026-11-04T06:00:00.000Z' },
    { name: '', phone: '1', at: '2026-11-04T07:00:00.000Z' }, // invalid, skipped
  ];
  const r1 = L.importSiteEnquiries([enq()], site, T);
  assert.equal(r1.added, 2);
  assert.deepEqual(r1.list.map((e) => e.name), ['B Two', 'A One', 'Test Person']);
  assert.equal(r1.list[1].goal, 'goal.1', 'goal stored as a key so it shows in every language');
  assert.equal(r1.list[0].goal, 'Build muscle', 'older entries without a key keep the typed text');
  assert.ok(r1.list.slice(0, 2).every((e) => e.status === 'new' && e.source === 'web'));
  const r2 = L.importSiteEnquiries(r1.list, site, T);
  assert.equal(r2.added, 0, 'no duplicates');
  assert.deepEqual(L.enquiryCounts(r1.list), { all: 3, new: 3, contacted: 0, joined: 0, lost: 0 });
});

test('five clearly fictional sample enquiries are seeded, covering every status', () => {
  const list = seedEnquiries(T);
  assert.equal(list.length, 5);
  assert.ok(list.every((e) => /\(sample\)$/.test(e.name) && e.phone.startsWith('5') && e.phone.length === 10));
  assert.deepEqual([...new Set(list.map((e) => e.status))].sort(), ['contacted', 'joined', 'lost', 'new']);
  assert.ok(list.every((e) => e.date <= T && e.statusDate <= T));
  assert.equal(seedGym(T).enquiries.length, 5);
});

test('v2 → v3 migration adds sample enquiries to demo data and none to a real business', () => {
  assert.equal(GYM_STORE_VERSION, 3);
  const demo = migrate({ __v: 2, __demo: true, members: [], settings: {} }, 3, gymMigrations);
  assert.equal(demo.enquiries.length, 5);
  const real = migrate({ __v: 2, __demo: false, members: [], settings: {} }, 3, gymMigrations);
  assert.deepEqual(real.enquiries, []);
});

test('empty gym keeps plans, rules and PIN but no records', () => {
  const cur = seedGym(T);
  cur.settings.pin = '4321';
  cur.settings.plans[0].price = 1500;
  const e = emptyGym(cur);
  assert.equal(e.settings.pin, '4321');
  assert.equal(e.settings.plans[0].price, 1500);
  assert.deepEqual([e.members, e.payments, e.attendance, e.enquiries], [[], [], [], []]);
  assert.deepEqual(e.counters, { member: 0, receipt: 0 });
});
