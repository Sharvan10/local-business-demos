import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../restaurant/js/logic.js';

const menu = [{ id: 'a', name: 'Dal', price: 280, veg: true }, { id: 'b', name: 'Naan', price: 60, veg: true }, { id: 'c', name: 'Gone', price: 99, available: false }];

test('cart quantities and lines', () => {
  let cart = R.setQty([], 'a', 1);
  cart = R.setQty(cart, 'b', 3);
  cart = R.setQty(cart, 'c', 1);
  cart = R.setQty(cart, 'a', 2);
  assert.deepEqual(R.cartLines(cart, menu).map((l) => [l.id, l.qty]), [['b', 3], ['a', 2]]); // sold-out dropped
  assert.equal(R.setQty(cart, 'a', 0).find((l) => l.id === 'a'), undefined);
  assert.equal(R.setQty([], 'a', 99)[0].qty, 50);
});

test('bill totals with GST and delivery', () => {
  const lines = [{ price: 280, qty: 2 }, { price: 60, qty: 3 }];
  assert.deepEqual(R.billTotals(lines, { gstPct: 5, delivery: 40 }), { sub: 740, gst: 37, delivery: 40, total: 817 });
  assert.deepEqual(R.billTotals([], { gstPct: 5, delivery: 40 }), { sub: 0, gst: 0, delivery: 0, total: 0 });
});

test('WhatsApp order text includes items, totals and customer', () => {
  const lines = [{ id: 'a', name: 'Dal', price: 280, qty: 2 }];
  const L = { title: 'New order', sub: 'Subtotal', gst: 'GST', delivery: 'Delivery', total: 'Total', name: 'Name', phone: 'Phone', type: 'Type', address: 'Address', note: 'Note' };
  const txt = R.orderText({ restaurant: 'Spice Route', lines, totals: R.billTotals(lines, { gstPct: 5 }), customer: { name: 'Aman', phone: '55555 00000' }, type: 'Pickup', note: 'Less oil', no: 1001, labels: L });
  assert.match(txt, /New order — Spice Route \(#1001\)/);
  assert.match(txt, /• 2 × Dal — ₹560/);
  assert.match(txt, /\*Total: ₹588\*/);
  assert.match(txt, /Note: Less oil/);
  assert.doesNotMatch(txt, /Address/);
});

test('daily sales, best sellers and customers', () => {
  const o = (date, total, lines, status = 'delivered', phone = '5555500001', name = 'A') => ({ date, total, lines, status, customer: { name, phone } });
  const orders = [
    o('2026-11-04', 500, [{ id: 'a', qty: 2 }]), o('2026-11-04', 100, [{ id: 'b', qty: 5 }], 'cancelled'),
    o('2026-11-03', 300, [{ id: 'a', qty: 1 }, { id: 'b', qty: 1 }], 'delivered', '+91 55555 00001', 'Aman'), o('2026-10-01', 999, [{ id: 'b', qty: 9 }], 'delivered', '5555500002', 'B'),
  ];
  assert.deepEqual(R.dailySales(orders, '2026-11-04', 2).map((x) => [x.date, x.total, x.count]), [['2026-11-03', 300, 1], ['2026-11-04', 500, 1]]);
  assert.deepEqual(R.bestSellers(orders, '2026-11-04', 30), [{ id: 'a', qty: 3 }, { id: 'b', qty: 1 }]);
  const c = R.customers(orders);
  assert.equal(c[0].orders, 2);
  assert.equal(c[0].spent, 800);
  assert.equal(c[0].name, 'A'); // name from the latest order
});
