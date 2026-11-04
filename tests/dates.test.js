import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../shared/dates.js';

test('addDays crosses months, years and leap days', () => {
  assert.equal(D.addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(D.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(D.addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(D.addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(D.addDays('2026-03-29', 1), '2026-03-30'); // DST-safe (UTC arithmetic)
});

test('addMonths clamps to month end', () => {
  assert.equal(D.addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(D.addMonths('2028-01-31', 1), '2028-02-29');
  assert.equal(D.addMonths('2026-11-15', 3), '2027-02-15');
  assert.equal(D.addMonths('2026-05-10', -6), '2025-11-10');
  assert.equal(D.addMonths('2026-03-31', -1), '2026-02-28');
});

test('diffDays is signed and whole', () => {
  assert.equal(D.diffDays('2026-11-04', '2026-11-09'), 5);
  assert.equal(D.diffDays('2026-11-09', '2026-11-04'), -5);
  assert.equal(D.diffDays('2026-12-31', '2027-01-01'), 1);
  assert.equal(D.diffDays('2028-02-01', '2028-03-01'), 29);
});

test('isValidISO', () => {
  assert.ok(D.isValidISO('2028-02-29'));
  assert.ok(!D.isValidISO('2026-02-29'));
  assert.ok(!D.isValidISO('2026-13-01'));
  assert.ok(!D.isValidISO('4/11/2026'));
});

test('anniversaries and birthdays (incl. 29 Feb and year wrap)', () => {
  assert.equal(D.nextAnniversary('1995-11-10', '2026-11-04'), '2026-11-10');
  assert.equal(D.nextAnniversary('1995-01-02', '2026-12-30'), '2027-01-02');
  assert.equal(D.daysUntilAnniversary('1995-01-02', '2026-12-30'), 3);
  assert.equal(D.nextAnniversary('2000-02-29', '2026-02-01'), '2026-02-28');
  assert.equal(D.nextAnniversary('2000-02-29', '2028-02-01'), '2028-02-29');
  assert.equal(D.nextAnniversary('1990-11-04', '2026-11-04'), '2026-11-04');
});

test('ageOn', () => {
  assert.equal(D.ageOn('2000-11-05', '2026-11-04'), 25);
  assert.equal(D.ageOn('2000-11-04', '2026-11-04'), 26);
});

test('month helpers and week range', () => {
  assert.equal(D.endOfMonth('2028-02-10'), '2028-02-29');
  assert.equal(D.startOfMonth('2026-11-04'), '2026-11-01');
  assert.equal(D.addMonthsKey('2026-01', -1), '2025-12');
  assert.deepEqual(D.weekRange('2026-11-04'), ['2026-11-02', '2026-11-08']); // Wed -> Mon..Sun
});

test('todayISO uses the local calendar day', () => {
  assert.equal(D.todayISO(new Date(2026, 10, 4, 23, 59)), '2026-11-04');
  assert.equal(D.todayISO(new Date(2026, 10, 5, 0, 0)), '2026-11-05');
  assert.ok(D.msUntilNextMidnight(new Date(2026, 10, 4, 23, 59, 0)) <= 61000);
});

test('Punjabi dates use built-in Gurmukhi names', () => {
  assert.equal(D.formatDate('2026-11-04', 'pa'), '4 ਨਵੰਬਰ 2026');
  assert.equal(D.formatDate('2026-11-04', 'pa', { weekday: 'long', day: 'numeric', month: 'long' }), 'ਬੁੱਧਵਾਰ, 4 ਨਵੰਬਰ');
  assert.equal(D.formatMonth('2026-11', 'pa'), 'ਨਵੰਬਰ');
  assert.equal(D.formatMonth('2026-11', 'pa', true), 'ਨਵੰਬਰ 2026');
  assert.equal(D.formatDate('2026-11-04', 'en'), '4 Nov 2026');
});
