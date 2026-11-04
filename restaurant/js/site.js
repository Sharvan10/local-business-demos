// Spice Route Rasoi public site: live menu (from the owner app), cart, WhatsApp ordering, table booking.
import { initSite, isOpenNow } from '../../shared/site.js';
import { REST_I18N } from '../../js/i18n-restaurant.js';
import { $, esc, money, formData, debounce } from '../../shared/ui.js';
import { waLink } from '../../shared/wa.js';
import { cfg } from '../../js/config.js';
import { todayISO, nowTime, formatDate } from '../../shared/dates.js';
import { restStore, CATEGORIES, itemName, dishArt } from './data.js';
import { setQty, cartLines, billTotals, orderText } from './logic.js';

const CART_KEY = 'spiceroute.cart';
const HOURS = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, [['12:00', '15:30'], ['19:00', '23:00']]]));
let cart = [];
try { cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch { cart = []; }
const ui = { cat: 'all', q: '', veg: false };
const i18n = initSite({ site: 'restaurant', dict: REST_I18N, onLang: renderAll });
const t = i18n.t;
const data = () => restStore.data;
const nm = (item) => itemName(item, i18n.lang);

function saveCart() { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* ignore */ } }
function qtyOf(id) { const l = cart.find((c) => c.id === id); return l ? l.qty : 0; }
const vegIcon = (veg) => `<span class="vdot ${veg ? 'veg' : 'nonveg'}" role="img" aria-label="${esc(t(veg ? 'menu.veg' : 'menu.nonveg'))}"></span>`;
const chillies = (n) => (n ? `<span class="spice" role="img" aria-label="${esc(t('menu.spice', { n }))}">${'🌶'.repeat(n)}</span>` : '');
const art = (item, size) => (item.photo ? `<img src="${esc(item.photo)}" alt="" loading="lazy" width="${size}" height="${size}">` : dishArt(item, size));

function renderHero() {
  const menu = data().menu;
  const picks = ['butter-chicken', 'dal-makhani', 'butter-naan'].map((id) => menu.find((m) => m.id === id)).filter(Boolean);
  ['hp1', 'hp2', 'hp3'].forEach((id, i) => { if (picks[i]) $(`#${id}`).innerHTML = art(picks[i], 220); });
  const sp = menu.find((m) => m.special && m.available !== false);
  const card = $('#special-card');
  card.hidden = !sp;
  if (sp) card.innerHTML = `<span class="sp-k">✦ ${esc(t('hero.special'))}</span><strong>${esc(nm(sp))}</strong><span>${money(sp.price)}</span>`;
}

function renderTabs() {
  const cats = ['all', ...CATEGORIES];
  $('#cat-tabs').innerHTML = cats.map((c) => `<button type="button" role="tab" aria-selected="${ui.cat === c}" data-cat="${c}">${esc(t(c === 'all' ? 'menu.all' : `cat.${c}`))}</button>`).join('');
}

function renderMenu() {
  const q = ui.q.trim().toLowerCase();
  const items = data().menu.filter((m) => (ui.cat === 'all' || m.cat === ui.cat) && (!ui.veg || m.veg)
    && (!q || `${m.name.en} ${m.name.hi} ${m.name.pa} ${m.desc}`.toLowerCase().includes(q)));
  items.sort((a, b) => (b.special - a.special) || CATEGORIES.indexOf(a.cat) - CATEGORIES.indexOf(b.cat));
  $('#menu-grid').innerHTML = items.length ? items.map((m) => {
    const qn = qtyOf(m.id);
    const out = m.available === false;
    return `<article class="dish ${out ? 'out' : ''}">
      <div class="dish-art">${art(m, 112)}</div>
      <div class="dish-body">
        <h3>${vegIcon(m.veg)} ${esc(nm(m))}</h3>
        <p class="desc">${esc(m.desc)}</p>
        <div class="dish-meta">${m.special ? `<span class="tag">✦ ${esc(t('menu.special'))}</span>` : ''}${chillies(m.spice)}</div>
        <div class="dish-foot"><span class="price">${money(m.price)}</span>
        ${out ? `<span class="soldout">${esc(t('menu.out'))}</span>` : qn ? stepper(m.id, qn) : `<button type="button" class="add" data-add="${m.id}">${esc(t('menu.add'))} +</button>`}</div>
      </div></article>`;
  }).join('') : `<p class="empty">${esc(t('menu.none'))}</p>`;
}
const stepper = (id, q) => `<span class="stepper"><button type="button" data-dec="${id}" aria-label="${esc(t('cart.dec'))}">−</button><output aria-live="polite">${q}</output><button type="button" data-inc="${id}" aria-label="${esc(t('cart.inc'))}">+</button></span>`;

function renderCart() {
  const lines = cartLines(cart, data().menu);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const type = ($('#cart-form input[name=type]:checked') || {}).value || 'delivery';
  const s = data().settings;
  const tot = billTotals(lines, { gstPct: s.gstPct, delivery: type === 'delivery' ? s.delivery : 0 });
  $('#cart-count').textContent = count;
  $('#cart-count').hidden = !count;
  $('#cart-bar').hidden = !count;
  $('#cart-bar-txt').textContent = `${t('cart.items', { n: count })} · ${money(tot.total)}`;
  document.body.classList.toggle('has-cart', count > 0);
  $('#cart-lines').innerHTML = lines.length ? lines.map((l) => { const m = data().menu.find((x) => x.id === l.id); return `<div class="cline">${vegIcon(l.veg)}<span class="cname">${esc(nm(m))}<small>${money(l.price)}</small></span>${stepper(l.id, l.qty)}<strong>${money(l.price * l.qty)}</strong></div>`; }).join('') : `<p class="empty">${esc(t('cart.empty'))}</p>`;
  $('#cart-totals').innerHTML = `<div><dt>${esc(t('cart.sub'))}</dt><dd>${money(tot.sub)}</dd></div><div><dt>${esc(t('cart.gst', { n: s.gstPct }))}</dt><dd>${money(tot.gst)}</dd></div>${tot.delivery ? `<div><dt>${esc(t('cart.delivery'))}</dt><dd>${money(tot.delivery)}</dd></div>` : ''}<div class="grand"><dt>${esc(t('cart.total'))}</dt><dd>${money(tot.total)}</dd></div>`;
  $('#cart-send').disabled = !lines.length;
  $('.addr-field').hidden = type !== 'delivery';
  return { lines, tot, type };
}

function renderGallery() {
  const g = [['#d9572b', '#f2b632', '🔥'], ['#5b2a17', '#c8682c', '🥘'], ['#e9a23b', '#7a1f12', '🍛'], ['#a4743a', '#f3e6c4', '☕'], ['#e39a9a', '#fbf4e8', '🍮']];
  $('#gallery-grid').innerHTML = g.map(([a, b, e], i) => `<figure class="g-tile reveal in ${i === 0 ? 'wide' : ''}" style="--a:${a};--b:${b}"><span class="g-emoji" aria-hidden="true">${e}</span><figcaption>${esc(t(`gal.${i + 1}`))}</figcaption></figure>`).join('');
}

function renderAll() { renderHero(); renderTabs(); renderMenu(); renderCart(); renderGallery(); const o = isOpenNow(HOURS); $('#open-now').textContent = t(o ? 'time.now' : 'time.closed'); $('#open-now').classList.toggle('closed', !o); }
renderAll();

// --- events ---
document.addEventListener('click', (e) => {
  const add = e.target.closest('[data-add]'); const inc = e.target.closest('[data-inc]'); const dec = e.target.closest('[data-dec]');
  const cat = e.target.closest('[data-cat]');
  if (add) cart = setQty(cart, add.dataset.add, 1);
  else if (inc) cart = setQty(cart, inc.dataset.inc, qtyOf(inc.dataset.inc) + 1);
  else if (dec) cart = setQty(cart, dec.dataset.dec, qtyOf(dec.dataset.dec) - 1);
  else if (cat) { ui.cat = cat.dataset.cat; renderTabs(); renderMenu(); return; } else return;
  saveCart(); renderMenu(); renderCart();
});
$('#msearch').addEventListener('input', debounce((e) => { ui.q = e.target.value; renderMenu(); }, 120));
$('#veg-only').addEventListener('change', (e) => { ui.veg = e.target.checked; renderMenu(); });
const dlg = $('#cart');
const openCart = () => { renderCart(); dlg.showModal(); };
$('#cart-open').addEventListener('click', openCart);
$('#cart-bar-btn').addEventListener('click', openCart);
$('#cart-close').addEventListener('click', () => dlg.close());
dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
$('#cart-form').addEventListener('change', renderCart);
$('#cart-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = formData(e.target);
  const msg = $('#cart-msg');
  const { lines, tot, type } = renderCart();
  if (!lines.length) return;
  if (!v.name || (v.phone || '').replace(/\D/g, '').length < 10) { msg.className = 'form-msg err'; msg.textContent = t('cart.need'); return; }
  let no;
  restStore.update((d) => {
    no = (d.counters.order || 1000) + 1;
    d.counters.order = no;
    d.orders.push({ id: `o${no}`, no, date: todayISO(), time: nowTime(), lines: lines.map((l) => ({ id: l.id, name: d.menu.find((m) => m.id === l.id).name.en, price: l.price, qty: l.qty })), ...tot, type, table: '', customer: { name: v.name, phone: v.phone, address: v.address || '' }, note: v.note, status: 'new', source: 'web' });
  });
  const labels = Object.fromEntries(['title', 'sub', 'gst', 'delivery', 'total', 'name', 'phone', 'type', 'address', 'note'].map((k) => [k, t(`wa.${k}`)]));
  const text = orderText({ restaurant: data().settings.name, lines, totals: tot, customer: { name: v.name, phone: v.phone, address: type === 'delivery' ? v.address : '' }, type: t(`type.${type}`), note: v.note, no, nameOf: (l) => nm(data().menu.find((m) => m.id === l.id)), labels });
  window.open(waLink(cfg('WHATSAPP_NUMBER', 'restaurant'), text), '_blank', 'noopener');
  cart = []; saveCart();
  renderMenu(); renderCart();
  msg.className = 'form-msg ok';
  msg.textContent = t('cart.sent', { no });
});

const bf = $('#book-form');
bf.date.value = todayISO();
bf.date.min = todayISO();
bf.addEventListener('submit', (e) => {
  e.preventDefault();
  const v = formData(bf);
  const msg = $('#book-msg');
  if (!v.name || (v.phone || '').replace(/\D/g, '').length < 10 || !v.date) { msg.className = 'form-msg err'; msg.textContent = t('cart.need'); return; }
  restStore.update((d) => d.reservations.push({ id: `r${Date.now().toString(36)}`, name: v.name, phone: v.phone, date: v.date, time: v.time, guests: Number(v.guests) || 2, note: v.note, status: 'pending', source: 'web', createdAt: todayISO() }));
  const date = formatDate(v.date, i18n.lang);
  const text = t('book.waText', { r: data().settings.name, name: v.name, phone: v.phone, date, time: v.time, guests: v.guests, note: v.note || '-' });
  msg.className = 'form-msg ok';
  msg.innerHTML = `${esc(t('book.ok', { date, time: v.time }))} <a href="${esc(waLink(cfg('WHATSAPP_NUMBER', 'restaurant'), text))}" target="_blank" rel="noopener">${esc(t('book.wa'))} →</a>`;
  bf.reset(); bf.date.value = todayISO();
});
// Owner edits in another tab (e.g. marking a dish sold out) update the menu live
window.addEventListener('storage', (e) => { if (e.key === 'spiceroute.restaurant') { restStore.reload(); renderAll(); } });
