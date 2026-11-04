import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, migrate, memoryBackend, peek } from '../shared/storage.js';
import { normalizePhone, waLink, waMessage } from '../shared/wa.js';
import { interpolate } from '../shared/i18n.js';
import { toCSV } from '../shared/csv.js';

const migrations = {
  2: (d) => ({ ...d, items: (d.items || []).map((x) => (typeof x === 'string' ? { name: x } : x)) }),
  3: (d) => ({ ...d, settings: { lang: 'en', ...(d.settings || {}) } }),
};

test('migrate runs each step in order and stamps the version', () => {
  const out = migrate({ __v: 1, items: ['a', 'b'] }, 3, migrations);
  assert.equal(out.__v, 3);
  assert.deepEqual(out.items, [{ name: 'a' }, { name: 'b' }]);
  assert.equal(out.settings.lang, 'en');
  assert.equal(migrate({ items: [] }, 3, migrations).__v, 3); // missing version = v1
  assert.throws(() => migrate({ __v: 9 }, 3, migrations));
});

test('store seeds on first load, persists, resets', () => {
  const be = memoryBackend();
  const s = createStore({ key: 't', version: 3, seed: () => ({ items: [{ name: 'seed' }] }), migrations, backend: be });
  assert.equal(s.data.items[0].name, 'seed');
  assert.equal(s.data.__demo, true);
  s.update((d) => d.items.push({ name: 'x' }));
  const s2 = createStore({ key: 't', version: 3, seed: () => ({ items: [] }), migrations, backend: be });
  assert.equal(s2.data.items.length, 2);
  s2.reset(); // reset re-seeds from this store's seed()
  assert.equal(s2.data.items.length, 0);
  assert.equal(peek('t', be).items.length, 0);
});

test('old stored data is migrated on load', () => {
  const be = memoryBackend();
  be.setItem('t', JSON.stringify({ __v: 1, items: ['old'] }));
  const s = createStore({ key: 't', version: 3, seed: () => ({}), migrations, backend: be });
  assert.deepEqual(s.data.items, [{ name: 'old' }]);
  assert.equal(JSON.parse(be.getItem('t')).__v, 3);
});

test('export / import round-trip, migration on import and wrong-app protection', () => {
  const be = memoryBackend();
  const s = createStore({ key: 'gym', version: 3, seed: () => ({ items: [{ name: 'a' }] }), migrations, backend: be });
  s.load();
  const json = s.exportJSON();
  s.update((d) => { d.items = []; });
  s.importJSON(json);
  assert.equal(s.data.items[0].name, 'a');
  s.importJSON({ app: 'gym', version: 1, data: { items: ['legacy'] } });
  assert.deepEqual(s.data.items, [{ name: 'legacy' }]);
  assert.throws(() => s.importJSON({ app: 'restaurant', version: 3, data: {} }), /belongs to/);
  assert.throws(() => s.importJSON('{"nope":1}'), /backup/);
  assert.throws(() => s.importJSON('not json'));
});

test('corrupt stored data is replaced by seed instead of crashing', () => {
  const be = memoryBackend();
  be.setItem('t', '{broken');
  const s = createStore({ key: 't', version: 3, seed: () => ({ items: [] }), migrations, backend: be });
  assert.deepEqual(s.data.items, []);
});

test('WhatsApp links', () => {
  assert.equal(normalizePhone('55555 01234'), '915555501234');
  assert.equal(normalizePhone('+91 55555-01234'), '915555501234');
  assert.equal(normalizePhone('05555501234'), '915555501234');
  assert.equal(normalizePhone('123'), '');
  assert.equal(waLink('5555501234', 'Hi ₹500'), 'https://wa.me/915555501234?text=Hi%20%E2%82%B9500');
  assert.equal(waLink('', 'Order'), 'https://wa.me/?text=Order');
  assert.equal(waMessage('Hi {name}, due {amount}', { name: 'Aman', amount: '₹1,200' }), 'Hi Aman, due ₹1,200');
  assert.equal(interpolate('{a} {missing}', { a: 1 }), '1 {missing}');
});

test('CSV quoting', () => {
  const csv = toCSV([{ a: 'x,y', b: 'say "hi"' }]);
  assert.equal(csv, '﻿a,b\r\n"x,y","say ""hi"""');
});
