// Spice Route Rasoi — owner app: orders board, menu manager, reservations, sales, customers, menu QR.
import { createI18n } from '../../../shared/i18n.js';
import * as D from '../../../shared/dates.js';
import { $, esc, money, toast, sheet, confirmBox, printHTML, download, pickFile, readText, formData, debounce } from '../../../shared/ui.js';
import { waLink, telLink } from '../../../shared/wa.js';
import { icon } from '../../../shared/icons.js';
import { barChart, hBars } from '../../../shared/chart.js';
import { qrSVG, qrCanvas } from '../../../shared/qr.js';
import { pinGate, lockNow } from '../../../shared/pin.js';
import { registerPWA, bindInstallButton } from '../../../shared/pwa.js';
import { paintDataStrip, dataStateCard, startEmptyFlow } from '../../../shared/demo-mode.js';
import { REST_APP_I18N } from '../../../js/i18n-restaurant-app.js';
import { restStore as store, REST_KEY, CATEGORIES, itemName, dishArt, sampleText } from '../../js/data.js';
import { ORDER_STATUSES, NEXT_STATUS, billTotals, dailySales, bestSellers, customers, RES_STATUSES } from '../../js/logic.js';

const i18n = createI18n(REST_APP_I18N);
const t = (k, v) => i18n.t(k, v);
const view = $('#view');
let TODAY = D.todayISO();
const ui = { status: 'new', menuCat: 'all', menuQ: '', resDay: 'today', salesDays: 7 };
const d = () => store.data;
const nm = (item) => itemName(item, i18n.lang);
const menuItem = (id) => d().menu.find((m) => m.id === id);
const lineName = (l) => { const m = menuItem(l.id); return m ? nm(m) : l.name; };
const fd = (iso, o) => D.formatDate(iso, i18n.lang, o);
const fdShort = (iso) => D.formatDate(iso, i18n.lang, { day: 'numeric', month: 'short' });
const statusCls = { new: 'warn', preparing: 'info', ready: 'ok', delivered: '', cancelled: 'danger', pending: 'warn', confirmed: 'ok', seated: 'info', noshow: 'danger' };
const chip = (s) => `<span class="chip ${statusCls[s] || ''}">${esc(t(`st.${s}`))}</span>`;

// ---------- shell ----------
const NAV = [['', 'list', 'nav.orders'], ['menu', 'utensils', 'nav.menu'], ['bookings', 'table', 'nav.bookings'], ['sales', 'chart', 'nav.sales'], ['settings', 'settings', 'nav.more']];
function parseHash() { const h = location.hash.replace(/^#\/?/, ''); const [name, arg] = h.split('/'); return { name: name || '', arg: arg || '' }; }
function render() {
  TODAY = D.todayISO();
  const { name } = parseHash();
  const views = { '': vOrders, menu: vMenu, bookings: vBookings, sales: vSales, settings: vSettings };
  const fn = views[name] || vOrders;
  $('#nav').innerHTML = NAV.map(([r, ic, k]) => `<a href="#/${r}" ${name === r ? 'aria-current="page"' : ''}>${icon(ic)}<span>${esc(t(k))}</span></a>`).join('');
  const out = fn();
  view.innerHTML = out.html;
  $('#fab').outerHTML = out.fab || '<a id="fab" class="fab" hidden></a>';
  paintDataStrip(store.isDemo, t);
  $('#brand-name').textContent = d().settings.name;
  $('#brand-sub').textContent = fd(TODAY, { weekday: 'long', day: 'numeric', month: 'long' });
  if (out.mount) out.mount();
  i18n.apply();
}
const fabBtn = (act, label, ic) => `<button id="fab" type="button" class="fab" data-act="${act}">${icon(ic)}<span>${esc(label)}</span></button>`;

// ---------- Orders ----------
function orderCard(o) {
  const next = NEXT_STATUS[o.status];
  const items = o.lines.map((l) => `${l.qty}× ${esc(lineName(l))}`).join(', ');
  const tel = telLink(o.customer && o.customer.phone);
  return `<article class="ocard st-${o.status}">
    <div class="ohead"><strong class="ono">#${o.no}</strong><span class="muted small">${esc(o.time)}${o.date !== TODAY ? ` · ${esc(fdShort(o.date))}` : ''}</span>
      <span class="chip plain">${esc(t(`type.${o.type}`))}${o.table ? ` · ${esc(t('o.table', { n: o.table }))}` : ''}</span>${o.source === 'web' ? `<span class="chip accent plain">${esc(t('o.web'))}</span>` : ''}<span class="grow"></span>${chip(o.status)}</div>
    <p class="oitems">${items}</p>
    ${o.note ? `<p class="onote">📝 ${esc(sampleText(o.note, i18n.lang))}</p>` : ''}
    <div class="ometa"><span>${esc(o.customer.name || t('o.walkin'))}${o.customer.phone ? ` · ${esc(o.customer.phone)}` : ''}</span><strong>${money(o.total)}</strong></div>
    <div class="oact">
      ${next ? `<button type="button" class="btn primary" data-act="advance" data-id="${o.id}">${icon(next === 'preparing' ? 'fire' : next === 'ready' ? 'check' : 'arrow')}${esc(t(`next.${next}`))}</button>` : ''}
      ${o.status === 'ready' && o.customer.phone ? `<a class="btn wa" href="${esc(waLink(o.customer.phone, readyText(o)))}" target="_blank" rel="noopener">${icon('wa')}${esc(t('o.tellReady'))}</a>` : ''}
      <button type="button" class="icon-btn" data-act="kot" data-id="${o.id}" aria-label="${esc(t('o.kot'))}" title="${esc(t('o.kot'))}">${icon('receipt')}</button>
      <button type="button" class="icon-btn" data-act="bill" data-id="${o.id}" aria-label="${esc(t('o.bill'))}" title="${esc(t('o.bill'))}">${icon('print')}</button>
      ${tel ? `<a class="icon-btn" href="${tel}" aria-label="${esc(t('o.call'))}">${icon('phone')}</a>` : ''}
      ${['new', 'preparing'].includes(o.status) ? `<button type="button" class="icon-btn" data-act="cancel" data-id="${o.id}" aria-label="${esc(t('o.cancel'))}" title="${esc(t('o.cancel'))}">${icon('x')}</button>` : ''}
    </div></article>`;
}
function readyText(o) {
  const lang = i18n.lang;
  const key = o.type === 'delivery' ? 'msg.out' : 'msg.ready';
  return REST_APP_I18N[lang][key].replace('{name}', (o.customer.name || '').split(' ')[0]).replace('{no}', o.no).replace('{r}', d().settings.name).replace('{amount}', money(o.total));
}
function vOrders() {
  const today = d().orders.filter((o) => o.date === TODAY || ['new', 'preparing', 'ready'].includes(o.status));
  const counts = Object.fromEntries(ORDER_STATUSES.map((s) => [s, today.filter((o) => o.status === s).length]));
  const list = today.filter((o) => o.status === ui.status).sort((a, b) => b.no - a.no);
  const sales = d().orders.filter((o) => o.date === TODAY && o.status === 'delivered').reduce((s, o) => s + o.total, 0);
  return {
    html: `<h1 class="view-title">${esc(t('nav.orders'))} <small>${esc(t('o.todaySales', { amount: money(sales) }))}</small></h1>
    <div class="board-pills pills" role="tablist">${ORDER_STATUSES.map((s) => `<button type="button" class="pill" data-act="ostatus" data-s="${s}" aria-pressed="${ui.status === s}">${esc(t(`st.${s}`))}<span class="n">${counts[s]}</span></button>`).join('')}</div>
    ${list.length ? `<div class="list">${list.map(orderCard).join('')}</div>` : `<p class="empty"><span class="big">🍽️</span>${esc(t('o.none'))}</p>`}
    <p class="small muted mt">${esc(t('o.loop'))} <a href="../#menu" target="_blank" rel="noopener">${esc(t('o.openSite'))}</a></p>`,
    fab: fabBtn('new-order', t('o.new'), 'plus'),
  };
}
function newOrder() {
  const qty = new Map();
  const s = sheet({
    title: t('o.new'), wide: true,
    body: `<form id="nof" class="form">
      <div class="seg">${['dine-in', 'pickup', 'delivery'].map((x, i) => `<label><input type="radio" name="type" value="${x}" ${i === 0 ? 'checked' : ''}><span>${esc(t(`type.${x}`))}</span></label>`).join('')}</div>
      <div class="grid-2"><label class="field"><span>${esc(t('o.tableNo'))}</span><input name="table" type="number" inputmode="numeric" min="1" max="${d().settings.tables}"></label>
      <label class="field"><span>${esc(t('f.phone'))}</span><input name="phone" type="tel" inputmode="tel"></label></div>
      <label class="field"><span>${esc(t('f.name'))}</span><input name="name"></label>
      <div class="search">${icon('search')}<input id="noq" type="search" placeholder="${esc(t('m.search'))}"></div>
      <div id="nolist" class="pick-list"></div>
      <div class="sheet-actions"><button class="btn primary big" type="submit" id="nosave">${esc(t('o.save'))}</button></div>
    </form>`,
  });
  const paint = () => {
    const q = ($('#noq', s.el).value || '').toLowerCase();
    $('#nolist', s.el).innerHTML = d().menu.filter((m) => m.available !== false && (!q || `${m.name.en}${m.name.hi}${m.name.pa}`.toLowerCase().includes(q))).map((m) => `<div class="pick-row"><span class="vdot ${m.veg ? 'veg' : 'nonveg'}"></span><span class="grow">${esc(nm(m))}<small class="muted"> ${money(m.price)}</small></span>
      <span class="stepper"><button type="button" data-q="${m.id}" data-d="-1" aria-label="−">−</button><output>${qty.get(m.id) || 0}</output><button type="button" data-q="${m.id}" data-d="1" aria-label="+">+</button></span></div>`).join('');
    const lines = [...qty.entries()].filter(([, q2]) => q2 > 0).map(([id, q2]) => ({ id, price: menuItem(id).price, qty: q2 }));
    $('#nosave', s.el).textContent = `${t('o.save')} · ${money(billTotals(lines, { gstPct: d().settings.gstPct }).total)}`;
  };
  s.el.addEventListener('click', (e) => { const b = e.target.closest('[data-q]'); if (!b) return; qty.set(b.dataset.q, Math.max(0, (qty.get(b.dataset.q) || 0) + Number(b.dataset.d))); paint(); });
  $('#noq', s.el).addEventListener('input', paint);
  paint();
  $('#nof', s.el).addEventListener('submit', (e) => {
    e.preventDefault();
    const v = formData(e.target);
    const lines = [...qty.entries()].filter(([, q2]) => q2 > 0).map(([id, q2]) => { const m = menuItem(id); return { id, name: m.name.en, price: m.price, qty: q2 }; });
    if (!lines.length) { toast(t('o.empty'), 'danger'); return; }
    const tot = billTotals(lines, { gstPct: d().settings.gstPct, delivery: v.type === 'delivery' ? d().settings.delivery : 0 });
    store.update((x) => { const no = ++x.counters.order; x.orders.push({ id: `o${no}`, no, date: TODAY, time: D.nowTime(), lines, ...tot, type: v.type, table: v.table || '', customer: { name: v.name, phone: v.phone, address: '' }, note: '', status: 'new', source: 'counter' }); });
    s.close(); ui.status = 'new'; render(); toast(t('o.saved'), 'ok');
  });
}
function kotHTML(o) {
  return `<div class="doc slip"><h1>KOT #${o.no}</h1><p style="text-align:center">${esc(fd(o.date))} · ${esc(o.time)}<br>${esc(t(`type.${o.type}`))}${o.table ? ` · ${esc(t('o.table', { n: o.table }))}` : ''}</p><table><tbody>${o.lines.map((l) => `<tr><td><strong>${l.qty}×</strong></td><td>${esc(lineName(l))}</td></tr>`).join('')}</tbody></table>${o.note ? `<p><strong>${esc(t('o.note'))}:</strong> ${esc(sampleText(o.note, i18n.lang))}</p>` : ''}${store.isDemo ? `<p style="text-align:center">— ${esc(t('demo.badge'))} —</p>` : ''}</div>`;
}
function billHTML(o) {
  const st = d().settings;
  return `<div class="doc slip"><h1>${esc(st.name)}</h1><p style="text-align:center">${esc(t('o.billTitle'))} #${o.no}<br>${esc(fd(o.date))} ${esc(o.time)}</p>
  <table><thead><tr><th>${esc(t('o.item'))}</th><th class="r">${esc(t('o.qty'))}</th><th class="r">₹</th></tr></thead><tbody>${o.lines.map((l) => `<tr><td>${esc(lineName(l))}</td><td class="r">${l.qty}</td><td class="r">${l.qty * l.price}</td></tr>`).join('')}
  <tr><td colspan="2">${esc(t('o.sub'))}</td><td class="r">${o.sub}</td></tr><tr><td colspan="2">GST ${st.gstPct}%</td><td class="r">${o.gst}</td></tr>${o.delivery ? `<tr><td colspan="2">${esc(t('type.delivery'))}</td><td class="r">${o.delivery}</td></tr>` : ''}
  <tr class="tot"><td colspan="2">${esc(t('o.total'))}</td><td class="r">${money(o.total)}</td></tr></tbody></table><p style="text-align:center">${esc(t('o.thanks'))}${store.isDemo ? `<br><span class="stamp">${esc(t('demo.badge'))}</span>` : ''}</p></div>`;
}

// ---------- Menu manager ----------
function vMenu() {
  const q = ui.menuQ.toLowerCase();
  const items = d().menu.filter((m) => (ui.menuCat === 'all' || m.cat === ui.menuCat) && (!q || `${m.name.en}${m.name.hi}${m.name.pa}`.toLowerCase().includes(q)));
  return {
    html: `<h1 class="view-title">${esc(t('nav.menu'))} <small>${d().menu.filter((m) => m.available !== false).length}/${d().menu.length} ${esc(t('m.available'))}</small></h1>
    <div class="search">${icon('search')}<input id="mq" type="search" value="${esc(ui.menuQ)}" placeholder="${esc(t('m.search'))}"></div>
    <div class="pills">${['all', ...CATEGORIES].map((c) => `<button type="button" class="pill" data-act="mcat" data-c="${c}" aria-pressed="${ui.menuCat === c}">${esc(t(c === 'all' ? 'm.all' : `cat.${c}`))}</button>`).join('')}</div>
    <div class="list">${items.map((m) => `<div class="row mrow ${m.available === false ? 'is-off' : ''}"><span class="mthumb">${m.photo ? `<img src="${esc(m.photo)}" alt="" loading="lazy">` : dishArt(m, 48)}</span>
      <button type="button" class="main linkish" data-act="edit-item" data-id="${m.id}"><span class="t"><span class="vdot ${m.veg ? 'veg' : 'nonveg'}"></span> ${esc(nm(m))}</span><span class="sub">${money(m.price)} · ${esc(t(`cat.${m.cat}`))}${m.special ? ` · ✦ ${esc(t('m.special'))}` : ''}</span></button>
      <label class="switch" title="${esc(t('m.availableToggle'))}"><span class="sr-only">${esc(t('m.availableToggle'))} ${esc(nm(m))}</span><input type="checkbox" data-act="toggle-avail" data-id="${m.id}" ${m.available !== false ? 'checked' : ''}></label></div>`).join('')}</div>`,
    fab: fabBtn('new-item', t('m.add'), 'plus'),
    mount() { $('#mq').addEventListener('input', debounce((e) => { ui.menuQ = e.target.value; render(); $('#mq').focus(); $('#mq').setSelectionRange(99, 99); }, 250)); },
  };
}
function editItem(id) {
  const m = id ? menuItem(id) : { id: '', cat: 'mains', price: 200, veg: true, spice: 1, name: { en: '', hi: '', pa: '' }, desc: '', photo: '', available: true, special: false };
  const s = sheet({
    title: id ? t('m.edit') : t('m.add'),
    body: `<form id="itf" class="form">
      <label class="field"><span>${esc(t('m.nameEn'))} *</span><input name="en" required value="${esc(m.name.en)}"></label>
      <div class="grid-2"><label class="field"><span>हिंदी</span><input name="hi" lang="hi" value="${esc(m.name.hi || '')}"></label><label class="field"><span>ਪੰਜਾਬੀ</span><input name="pa" lang="pa" value="${esc(m.name.pa || '')}"></label></div>
      <div class="grid-2"><label class="field"><span>${esc(t('m.price'))}</span><input name="price" type="number" inputmode="numeric" min="0" value="${m.price}"></label>
      <label class="field"><span>${esc(t('m.cat'))}</span><select name="cat">${CATEGORIES.map((c) => `<option value="${c}" ${m.cat === c ? 'selected' : ''}>${esc(t(`cat.${c}`))}</option>`).join('')}</select></label></div>
      <div class="seg"><label><input type="radio" name="veg" value="1" ${m.veg ? 'checked' : ''}><span>🟢 ${esc(t('m.veg'))}</span></label><label><input type="radio" name="veg" value="0" ${!m.veg ? 'checked' : ''}><span>🔺 ${esc(t('m.nonveg'))}</span></label></div>
      <div class="field"><span class="lbl">${esc(t('m.spice'))}</span><div class="seg">${[0, 1, 2, 3].map((n) => `<label><input type="radio" name="spice" value="${n}" ${m.spice === n ? 'checked' : ''}><span>${n ? '🌶'.repeat(n) : '—'}</span></label>`).join('')}</div></div>
      <label class="field"><span>${esc(t('m.desc'))}</span><input name="desc" value="${esc(m.desc)}"></label>
      <label class="field"><span>${esc(t('m.photo'))}</span><input name="photo" type="url" inputmode="url" placeholder="https://…" value="${esc(m.photo)}"><span class="hint">${esc(t('m.photoHint'))}</span></label>
      <label class="switch"><span>${esc(t('m.availableToggle'))}</span><input type="checkbox" name="available" ${m.available !== false ? 'checked' : ''}></label>
      <label class="switch"><span>✦ ${esc(t('m.specialToggle'))}</span><input type="checkbox" name="special" ${m.special ? 'checked' : ''}></label>
      <div class="sheet-actions">${id ? `<button type="button" class="btn danger" data-del="1">${icon('trash')}</button>` : ''}<button class="btn primary big" type="submit">${esc(t('a.save'))}</button></div>
    </form>`,
  });
  const f = $('#itf', s.el);
  s.el.querySelector('[data-del]')?.addEventListener('click', async () => {
    if (!(await confirmBox(t('m.delQ'), { ok: t('a.delete'), cancel: t('a.cancel'), danger: true }))) return;
    store.update((x) => { x.menu = x.menu.filter((i) => i.id !== id); }); s.close(); render();
  });
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = formData(f);
    if (!v.en) { toast(t('m.needName'), 'danger'); return; }
    const data = { name: { en: v.en, hi: v.hi, pa: v.pa }, price: Math.max(0, Number(v.price) || 0), cat: v.cat, veg: v.veg === '1', spice: Number(v.spice) || 0, desc: v.desc, photo: /^https?:\/\//.test(v.photo) ? v.photo : '', available: f.available.checked, special: f.special.checked };
    store.update((x) => {
      if (id) Object.assign(x.menu.find((i) => i.id === id), data);
      else x.menu.push({ id: `${v.en.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36).slice(-4)}`, ...data });
    });
    s.close(); render(); toast(t('a.saved'), 'ok');
  });
}

// ---------- Bookings ----------
function vBookings() {
  const tomorrow = D.addDays(TODAY, 1);
  const all = d().reservations.slice().sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));
  const filt = { today: (r) => r.date === TODAY, tomorrow: (r) => r.date === tomorrow, upcoming: (r) => r.date > tomorrow, past: (r) => r.date < TODAY };
  const list = all.filter(filt[ui.resDay]);
  const guests = all.filter((r) => r.date === TODAY && ['confirmed', 'seated', 'pending'].includes(r.status)).reduce((s, r) => s + Number(r.guests), 0);
  return {
    html: `<h1 class="view-title">${esc(t('nav.bookings'))} <small>${esc(t('b.guestsToday', { n: guests }))}</small></h1>
    <div class="pills">${Object.keys(filt).map((k) => `<button type="button" class="pill" data-act="resday" data-k="${k}" aria-pressed="${ui.resDay === k}">${esc(t(`b.${k}`))}<span class="n">${all.filter(filt[k]).length}</span></button>`).join('')}</div>
    ${list.length ? `<div class="list">${list.map((r) => `<article class="card bcard"><div class="flex between wrap"><div><strong class="btime">${esc(r.time)}</strong> <span class="muted small">${esc(fd(r.date, { weekday: 'short', day: 'numeric', month: 'short' }))}</span></div>${chip(r.status)}</div>
      <div class="flex mt" style="margin-top:6px"><span class="grow"><strong>${esc(r.name)}</strong> · ${esc(t('b.guests', { n: r.guests }))}<br><span class="small muted">${esc(r.phone)}${r.note ? ` · ${esc(sampleText(r.note, i18n.lang))}` : ''}</span></span></div>
      <div class="btn-row mt">${r.status === 'pending' ? `<button type="button" class="btn sm primary" data-act="res" data-id="${r.id}" data-s="confirmed">${icon('check')}${esc(t('b.confirm'))}</button>` : ''}
      ${r.status === 'confirmed' ? `<button type="button" class="btn sm primary" data-act="res" data-id="${r.id}" data-s="seated">${esc(t('b.seat'))}</button>` : ''}
      <a class="btn sm wa" target="_blank" rel="noopener" href="${esc(waLink(r.phone, REST_APP_I18N[i18n.lang]['msg.booking'].replace('{name}', r.name.split(' ')[0]).replace('{r}', d().settings.name).replace('{date}', fd(r.date)).replace('{time}', r.time).replace('{n}', r.guests)))}">${icon('wa')}WhatsApp</a>
      ${['pending', 'confirmed'].includes(r.status) ? `<button type="button" class="btn sm ghost" data-act="res" data-id="${r.id}" data-s="cancelled">${esc(t('b.cancel'))}</button>` : ''}
      ${r.status === 'confirmed' && r.date <= TODAY ? `<button type="button" class="btn sm ghost" data-act="res" data-id="${r.id}" data-s="noshow">${esc(t('st.noshow'))}</button>` : ''}</div></article>`).join('')}</div>` : `<p class="empty"><span class="big">🪑</span>${esc(t('b.none'))}</p>`}`,
    fab: fabBtn('new-res', t('b.add'), 'plus'),
  };
}
function newRes() {
  const s = sheet({
    title: t('b.add'),
    body: `<form id="rf" class="form"><label class="field"><span>${esc(t('f.name'))}</span><input name="name" required autofocus></label><label class="field"><span>${esc(t('f.phone'))}</span><input name="phone" type="tel" inputmode="tel" required></label>
    <div class="grid-3"><label class="field"><span>${esc(t('b.date'))}</span><input name="date" type="date" value="${TODAY}"></label><label class="field"><span>${esc(t('b.time'))}</span><input name="time" type="time" value="20:00"></label><label class="field"><span>${esc(t('b.people'))}</span><input name="guests" type="number" inputmode="numeric" min="1" value="2"></label></div>
    <label class="field"><span>${esc(t('o.note'))}</span><input name="note"></label><div class="sheet-actions"><button class="btn primary big" type="submit">${esc(t('a.save'))}</button></div></form>`,
  });
  $('#rf', s.el).addEventListener('submit', (e) => {
    e.preventDefault();
    const v = formData(e.target);
    if (!v.name) return;
    store.update((x) => x.reservations.push({ id: `r${Date.now().toString(36)}`, ...v, guests: Number(v.guests) || 2, status: 'confirmed', createdAt: TODAY }));
    s.close(); ui.resDay = v.date === TODAY ? 'today' : 'upcoming'; render(); toast(t('a.saved'), 'ok');
  });
}

// ---------- Sales ----------
function vSales() {
  const n = ui.salesDays;
  const days = dailySales(d().orders, TODAY, n);
  const todayRow = days[days.length - 1];
  const total = days.reduce((s, x) => s + x.total, 0);
  const cnt = days.reduce((s, x) => s + x.count, 0);
  const best = bestSellers(d().orders, TODAY, 30).map((b) => ({ label: menuItem(b.id) ? nm(menuItem(b.id)) : b.id, value: b.qty }));
  const types = ['dine-in', 'pickup', 'delivery'].map((x) => ({ label: t(`type.${x}`), value: d().orders.filter((o) => o.status === 'delivered' && o.type === x && D.diffDays(o.date, TODAY) < n).reduce((s, o) => s + o.total, 0) }));
  const custs = customers(d().orders).slice(0, 12);
  return {
    html: `<h1 class="view-title">${esc(t('nav.sales'))}</h1>
    <div class="stats">
      <div class="stat hero"><span class="k">${esc(t('s.today'))}</span><span class="v">${money(todayRow.total)}</span><span class="s">${esc(t('s.orders', { n: todayRow.count }))}</span></div>
      <div class="stat"><span class="k">${esc(t('s.period', { n }))}</span><span class="v">${money(total)}</span></div>
      <div class="stat"><span class="k">${esc(t('s.avg'))}</span><span class="v">${money(cnt ? total / cnt : 0)}</span></div>
    </div>
    <section class="card mt"><div class="flex between wrap"><h2 class="section-h" style="margin:0">${esc(t('s.daily'))}</h2><div class="seg" style="min-width:180px">${[7, 14].map((x) => `<label><input type="radio" name="sd" value="${x}" data-act="sdays" ${n === x ? 'checked' : ''}><span>${x} ${esc(t('u.days'))}</span></label>`).join('')}</div></div>
    ${barChart(days.map((x) => ({ label: D.formatDate(x.date, i18n.lang, { day: 'numeric' }), value: x.total, title: `${fd(x.date)}: ${money(x.total)} (${x.count})` })), { format: money, ariaLabel: t('s.daily') })}</section>
    <div class="grid-2 mt rep-2"><section class="card"><h2 class="section-h" style="margin-top:0">${esc(t('s.best'))}</h2>${hBars(best)}</section>
    <section class="card"><h2 class="section-h" style="margin-top:0">${esc(t('s.byType'))}</h2>${hBars(types, { format: money })}</section></div>
    <h2 class="section-h">${esc(t('s.customers'))}</h2>
    <div class="list">${custs.map((c) => `<div class="row"><div class="main"><div class="t">${esc(c.name)}</div><div class="sub">${esc(t('s.custLine', { n: c.orders, amount: money(c.spent), date: fdShort(c.last) }))}</div></div>${c.orders > 1 ? `<span class="chip ok plain">${esc(t('s.repeat'))} ×${c.orders}</span>` : ''}<a class="icon-btn wa" href="${esc(waLink(c.phone, REST_APP_I18N[i18n.lang]['msg.thanks'].replace('{name}', c.name.split(' ')[0]).replace('{r}', d().settings.name)))}" target="_blank" rel="noopener" aria-label="WhatsApp">${icon('wa')}</a></div>`).join('')}</div>`,
  };
}

// ---------- Settings / QR ----------
function menuURL() { return new URL('../#menu', location.href).href; }
function vSettings() {
  const st = d().settings;
  return {
    html: `<h1 class="view-title">${esc(t('nav.more'))}</h1>
    <section class="card qr-card"><h2 class="section-h" style="margin-top:0">${esc(t('q.title'))}</h2><div class="qr-box">${qrSVG(menuURL(), { label: t('q.title') })}</div>
    <p class="small muted" style="word-break:break-all">${esc(menuURL())}</p><p class="small muted">${esc(t('q.help'))}</p>
    <div class="btn-grid"><button type="button" class="btn" data-act="qr-png">${icon('download')}PNG</button><button type="button" class="btn" data-act="qr-print">${icon('print')}${esc(t('q.print'))}</button></div></section>
    <form id="stf" class="form card mt">
      <label class="field"><span>${esc(t('set.name'))}</span><input name="name" value="${esc(st.name)}"></label>
      <div class="grid-3"><label class="field"><span>GST %</span><input name="gstPct" type="number" inputmode="decimal" min="0" max="28" value="${st.gstPct}"></label><label class="field"><span>${esc(t('set.delivery'))}</span><input name="delivery" type="number" inputmode="numeric" min="0" value="${st.delivery}"></label><label class="field"><span>${esc(t('set.tables'))}</span><input name="tables" type="number" inputmode="numeric" min="1" value="${st.tables}"></label></div>
      <label class="field"><span>${esc(t('set.pin'))}</span><input name="pin" type="password" inputmode="numeric" minlength="4" maxlength="6" value="${esc(st.pin)}"></label>
      <div class="field"><span class="lbl">${esc(t('set.lang'))}</span><div class="lang-switch"></div></div>
      <button class="btn primary big" type="submit">${esc(t('a.save'))}</button>
    </form>
    <section class="card mt"><div class="btn-grid"><button type="button" class="btn" data-act="backup">${icon('download')}${esc(t('set.backup'))}</button><button type="button" class="btn" data-act="restore">${icon('upload')}${esc(t('set.restore'))}</button><button type="button" class="btn" data-act="lock">${icon('lock')}${esc(t('set.lock'))}</button><button type="button" class="btn" id="install-btn" hidden>${icon('install')}${esc(t('set.install'))}</button></div>
    <p class="small muted mt">${esc(t('set.dataHelp'))}</p></section>
    ${dataStateCard({ store, t, fd })}`,
    mount() {
      i18n.mountSwitch($('#stf'));
      bindInstallButton($('#install-btn'));
      $('#stf').addEventListener('submit', (e) => {
        e.preventDefault();
        const v = formData(e.target);
        if (!/^\d{4,6}$/.test(v.pin)) { toast(t('set.pinBad'), 'danger'); return; }
        store.update((x) => Object.assign(x.settings, { name: v.name || x.settings.name, gstPct: Number(v.gstPct) || 0, delivery: Number(v.delivery) || 0, tables: Number(v.tables) || 1, pin: v.pin }));
        toast(t('a.saved'), 'ok'); render();
      });
    },
  };
}

// ---------- actions ----------
const getO = (id) => d().orders.find((o) => o.id === id);
const actions = {
  ostatus: (el) => { ui.status = el.dataset.s; render(); },
  advance: (el) => { const o = getO(el.dataset.id); const n = NEXT_STATUS[o.status]; store.update(() => { o.status = n; }); ui.status = n; render(); toast(t(`st.${n}`), 'ok'); },
  cancel: async (el) => { if (!(await confirmBox(t('o.cancelQ'), { ok: t('o.cancel'), cancel: t('a.back'), danger: true }))) return; store.update(() => { getO(el.dataset.id).status = 'cancelled'; }); render(); },
  kot: (el) => printHTML(kotHTML(getO(el.dataset.id))),
  bill: (el) => printHTML(billHTML(getO(el.dataset.id))),
  'new-order': () => newOrder(),
  mcat: (el) => { ui.menuCat = el.dataset.c; render(); },
  'edit-item': (el) => editItem(el.dataset.id),
  'new-item': () => editItem(''),
  'toggle-avail': (el) => { store.update((x) => { x.menu.find((m) => m.id === el.dataset.id).available = el.checked; }); toast(el.checked ? t('m.on') : t('m.off')); setTimeout(render, 150); return true; },
  resday: (el) => { ui.resDay = el.dataset.k; render(); },
  res: (el) => { store.update((x) => { x.reservations.find((r) => r.id === el.dataset.id).status = el.dataset.s; }); render(); },
  'new-res': () => newRes(),
  sdays: (el) => { ui.salesDays = Number(el.value); render(); },
  'qr-png': () => qrCanvas(menuURL(), { scale: 12 }).toBlob((b) => download('spice-route-menu-qr.png', b)),
  'qr-print': () => printHTML(`<div class="doc" style="text-align:center"><h1>${esc(d().settings.name)}</h1><p>${esc(t('q.scan'))}</p><div style="width:70mm;margin:10mm auto">${qrSVG(menuURL())}</div><p>${esc(menuURL())}</p></div>`),
  backup: () => download(`spiceroute-backup-${TODAY}.json`, store.exportJSON(), 'application/json'),
  restore: async () => { const f = await pickFile(); if (!f) return; try { store.importJSON(await readText(f)); toast(t('set.restored'), 'ok'); render(); } catch (e) { toast(e.message, 'danger'); } },
  reset: async () => { if (!(await confirmBox(t('set.resetQ'), { ok: t('set.reset'), cancel: t('a.cancel'), danger: true }))) return; store.reset(); location.hash = '#/'; render(); toast(t('set.resetDone'), 'ok'); },
  'start-empty': async () => { if (await startEmptyFlow({ store, t })) { location.hash = '#/'; render(); } },
  lock: () => lockNow(REST_KEY),
};
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || !actions[el.dataset.act]) return;
  if (el.tagName !== 'INPUT') e.preventDefault();
  actions[el.dataset.act](el);
});

function boot() {
  i18n.mountSwitch(document.querySelector('.app-head'));
  i18n.onChange(render);
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
  render();
  // Orders placed on the public website (another tab) appear instantly
  window.addEventListener('storage', (e) => {
    if (e.key !== REST_KEY) return;
    const before = d().orders.length;
    store.reload();
    if (d().orders.length > before) { toast(t('o.incoming'), 'ok'); ui.status = 'new'; }
    render();
  });
  setTimeout(function tick() { render(); setTimeout(tick, D.msUntilNextMidnight()); }, D.msUntilNextMidnight());
}
registerPWA();
pinGate({ appKey: REST_KEY, getPin: () => d().settings.pin, t, brand: d().settings.name, logo: 'SR', onUnlock: boot });
