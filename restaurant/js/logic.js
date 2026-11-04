// Spice Route Rasoi — pure rules shared by the public site and the owner app (unit-tested).
import { addDays, diffDays } from '../../shared/dates.js';

export const ORDER_STATUSES = ['new', 'preparing', 'ready', 'delivered', 'cancelled'];
export const NEXT_STATUS = { new: 'preparing', preparing: 'ready', ready: 'delivered' };

export function lineTotal(line) { return Number(line.price) * Number(line.qty); }
export function subtotal(lines) { return lines.reduce((s, l) => s + lineTotal(l), 0); }

/** Bill: subtotal + GST (on food) + optional delivery charge. Rounded to the rupee. */
export function billTotals(lines, { gstPct = 5, delivery = 0 } = {}) {
  const sub = subtotal(lines);
  const gst = Math.round((sub * gstPct) / 100);
  return { sub, gst, delivery: sub > 0 ? Number(delivery) || 0 : 0, total: sub > 0 ? sub + gst + (Number(delivery) || 0) : 0 };
}

/** Cart helpers. cart = [{id, qty}] */
export function setQty(cart, id, qty) {
  const out = cart.filter((l) => l.id !== id);
  if (qty > 0) out.push({ id, qty: Math.min(50, qty) });
  return out;
}
export function cartLines(cart, menu) {
  return cart.map((c) => { const m = menu.find((x) => x.id === c.id); return m && m.available !== false ? { id: m.id, name: m.name, price: m.price, qty: c.qty, veg: m.veg } : null; }).filter(Boolean);
}

export function orderText({ restaurant, lines, totals, customer, type, note, no, nameOf = (l) => l.name, labels }) {
  const L = labels;
  const rows = lines.map((l) => `• ${l.qty} × ${nameOf(l)} — ₹${lineTotal(l)}`);
  return [
    `${L.title} — ${restaurant}${no ? ` (#${no})` : ''}`, '', ...rows, '',
    `${L.sub}: ₹${totals.sub}`, `${L.gst}: ₹${totals.gst}`, ...(totals.delivery ? [`${L.delivery}: ₹${totals.delivery}`] : []), `*${L.total}: ₹${totals.total}*`, '',
    `${L.name}: ${customer.name || '-'}`, `${L.phone}: ${customer.phone || '-'}`, `${L.type}: ${type}`,
    ...(customer.address ? [`${L.address}: ${customer.address}`] : []), ...(note ? [`${L.note}: ${note}`] : []),
  ].join('\n');
}

/** Totals per day for the last `days` days (delivered orders only). */
export function dailySales(orders, today, days = 7) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    const list = orders.filter((o) => o.date === d && o.status === 'delivered');
    out.push({ date: d, total: list.reduce((s, o) => s + o.total, 0), count: list.length });
  }
  return out;
}

export function bestSellers(orders, today, days = 30, top = 8) {
  const qty = new Map();
  orders.filter((o) => o.status === 'delivered' && diffDays(o.date, today) < days).forEach((o) => o.lines.forEach((l) => qty.set(l.id, (qty.get(l.id) || 0) + l.qty)));
  return [...qty.entries()].sort((a, b) => b[1] - a[1]).slice(0, top).map(([id, q]) => ({ id, qty: q }));
}

/** Customers derived from orders, grouped by phone digits. */
export function customers(orders) {
  const map = new Map();
  orders.filter((o) => o.status !== 'cancelled' && o.customer && o.customer.phone).forEach((o) => {
    const key = String(o.customer.phone).replace(/\D/g, '').slice(-10);
    const c = map.get(key) || { phone: o.customer.phone, name: o.customer.name, orders: 0, spent: 0, first: o.date, last: o.date };
    c.orders += 1; c.spent += o.total;
    if (o.date < c.first) c.first = o.date;
    if (o.date >= c.last) { c.last = o.date; c.name = o.customer.name || c.name; }
    map.set(key, c);
  });
  return [...map.values()].sort((a, b) => b.orders - a.orders || b.spent - a.spent);
}

export const RES_STATUSES = ['pending', 'confirmed', 'seated', 'cancelled', 'noshow'];
