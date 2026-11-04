import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, memoryBackend } from '../shared/storage.js';
import { seedGym, emptyGym, GYM_STORE_VERSION, gymMigrations } from '../gym/app/js/seed.js';
import { seedRestaurant, emptyRestaurant, itemDesc, sampleText, DESC_I18N, seedMenu, SAMPLE_TEXT } from '../restaurant/js/data.js';
import { seedJewellers, emptyJewellers } from '../jewellers/js/data.js';

const T = '2026-11-04';

test('startEmpty clears records, keeps settings, and is no longer demo; reset brings the demo back', () => {
  const be = memoryBackend();
  const s = createStore({ key: 'ironcore.gym', version: GYM_STORE_VERSION, seed: () => seedGym(T), migrations: gymMigrations, empty: emptyGym, backend: be });
  assert.equal(s.isDemo, true);
  s.update((d) => { d.settings.pin = '9876'; d.settings.gymName = 'My Gym'; });
  s.startEmpty();
  assert.equal(s.isDemo, false);
  assert.equal(s.data.__demo, false);
  assert.ok(s.data.__startedAt);
  assert.equal(s.data.settings.pin, '9876');
  assert.equal(s.data.settings.gymName, 'My Gym');
  assert.equal(s.data.members.length, 0);
  // survives a reload and a backup round-trip
  const s2 = createStore({ key: 'ironcore.gym', version: GYM_STORE_VERSION, seed: () => seedGym(T), migrations: gymMigrations, empty: emptyGym, backend: be });
  assert.equal(s2.isDemo, false);
  s2.importJSON(s2.exportJSON());
  assert.equal(s2.isDemo, false);
  s2.reset();
  assert.equal(s2.isDemo, true);
  assert.ok(s2.data.members.length > 10);
});

test('restaurant empty business keeps settings and menu, drops orders and bookings', () => {
  const cur = seedRestaurant(T);
  const e = emptyRestaurant(cur);
  assert.deepEqual(e.settings, cur.settings);
  assert.equal(e.menu.length, cur.menu.length);
  assert.deepEqual([e.orders, e.reservations], [[], []]);
  assert.equal(e.counters.order, 0);
});

test('jewellers empty business keeps settings, rates and scheme plans, drops stock and customers', () => {
  const cur = seedJewellers(T);
  cur.rates.gold22 = 70000;
  const e = emptyJewellers(cur);
  assert.deepEqual(e.settings, cur.settings);
  assert.equal(e.rates.gold22, 70000);
  assert.equal(e.rateHistory.length, 1);
  assert.equal(e.schemes.length, cur.schemes.length);
  assert.deepEqual([e.items, e.customers, e.enrolments, e.jobs, e.viewings], [[], [], [], [], []]);
});

test('every sample dish description has Hindi (Devanagari) and Punjabi (Gurmukhi)', () => {
  const menu = seedMenu();
  for (const m of menu) {
    assert.ok(DESC_I18N[m.id], `missing ${m.id}`);
    assert.match(itemDesc(m, 'hi'), /[ऀ-ॿ]/, `${m.id} hi`);
    assert.match(itemDesc(m, 'pa'), /[਀-੿]/, `${m.id} pa`);
    assert.doesNotMatch(itemDesc(m, 'hi'), /[਀-੿]/, `${m.id} hi has Gurmukhi`);
    assert.doesNotMatch(itemDesc(m, 'pa'), /[ऀ-ॿ]/, `${m.id} pa has Devanagari`);
    assert.equal(itemDesc(m, 'en'), m.desc);
  }
  const edited = { ...menu[0], desc: 'Owner typed this' };
  assert.equal(itemDesc(edited, 'hi'), 'Owner typed this', 'owner-edited text is shown as typed');
});

test('sample notes are translated; typed notes are shown as they are', () => {
  const r = seedRestaurant(T);
  const notes = [...r.orders.map((o) => o.note), ...r.reservations.map((x) => x.note), ...r.orders.map((o) => o.customer.address)].filter(Boolean);
  for (const n of new Set(notes)) {
    assert.ok(SAMPLE_TEXT[n], `untranslated sample note: ${n}`);
    assert.match(sampleText(n, 'hi'), /[ऀ-ॿ]/);
    assert.match(sampleText(n, 'pa'), /[਀-੿]/);
  }
  assert.equal(sampleText('Extra onion', 'pa'), 'Extra onion');
  assert.equal(sampleText('', 'hi'), '');
});
