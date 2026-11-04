// Shree Heera Jewellers — owner app: daily rates, stock, customer ledgers, savings schemes, orders & repairs.
import { createI18n } from '../../../shared/i18n.js';
import * as D from '../../../shared/dates.js';
import { $, esc, money, toast, sheet, confirmBox, download, pickFile, readText, formData, shareCanvas, wrapText, debounce } from '../../../shared/ui.js';
import { waLink, telLink } from '../../../shared/wa.js';
import { icon } from '../../../shared/icons.js';
import { barChart } from '../../../shared/chart.js';
import { pinGate, lockNow } from '../../../shared/pin.js';
import { registerPWA, bindInstallButton } from '../../../shared/pwa.js';
import { JEW_APP_I18N } from '../../../js/i18n-jewellers-app.js';
import { jewStore as store, JEW_KEY, JCATS, jName, itemArt } from '../../js/data.js';
import { priceBreakup, PURITIES, schemeStatus, ledgerBalance, JOB_STATUSES, jobLate, occasions } from '../../js/logic.js';

const i18n = createI18n(JEW_APP_I18N);
const t = (k, v) => i18n.t(k, v);
const view = $('#view');
let TODAY = D.todayISO();
const ui = { stockCat: 'all', stockQ: '', custQ: '', schF: 'all', jobF: 'open' };
const d = () => store.data;
const fd = (s, o) => D.formatDate(s, i18n.lang, o);
const fdShort = (s) => D.formatDate(s, i18n.lang, { day: 'numeric', month: 'short' });
const cust = (id) => d().customers.find((c) => c.id === id);
const price = (it) => priceBreakup(it, d().rates, d().settings.gstPct);
const msg = (key, vars) => { let s = (JEW_APP_I18N[i18n.lang] || JEW_APP_I18N.en)[key] || JEW_APP_I18N.en[key]; Object.entries(vars).forEach(([k, v]) => { s = s.split(`{${k}}`).join(v); }); return s; };
const first = (n) => String(n || '').split(' ')[0];
const SCH_CLS = { ontrack: 'ok', duesoon: 'warn', due: 'warn', overdue: 'danger', completed: 'info', matured: 'accent', closed: '' };

// ---------- shell ----------
const NAV = [['', 'sun', 'nav.home'], ['stock', 'gem', 'nav.stock'], ['customers', 'users', 'nav.customers'], ['schemes', 'piggy', 'nav.schemes'], ['jobs', 'wrench', 'nav.jobs']];
function render() {
  TODAY = D.todayISO();
  const name = location.hash.replace(/^#\/?/, '').split('/')[0];
  const views = { '': vHome, stock: vStock, customers: vCustomers, schemes: vSchemes, jobs: vJobs, settings: vSettings };
  $('#nav').innerHTML = NAV.map(([r, ic, k]) => `<a href="#/${r}" ${name === r ? 'aria-current="page"' : ''}>${icon(ic)}<span>${esc(t(k))}</span></a>`).join('');
  const out = (views[name] || vHome)();
  view.innerHTML = out.html;
  $('#fab').outerHTML = out.fab || '<a id="fab" class="fab" hidden></a>';
  $('#brand-name').textContent = d().settings.name;
  $('#brand-sub').textContent = fd(TODAY, { weekday: 'long', day: 'numeric', month: 'long' });
  if (out.mount) out.mount();
  i18n.apply();
}
const fabBtn = (act, label, ic = 'plus') => `<button id="fab" type="button" class="fab" data-act="${act}">${icon(ic)}<span>${esc(label)}</span></button>`;

// ---------- Home: rates + summary ----------
function vHome() {
  const r = d().rates;
  const stock = d().items.filter((i) => i.inStock);
  const stockVal = stock.reduce((s, i) => s + price(i).total, 0);
  const sch = d().enrolments.map((e) => ({ e, s: schemeStatus(e, TODAY) }));
  const schDue = sch.filter((x) => ['due', 'overdue', 'duesoon'].includes(x.s.status));
  const jobsDue = d().jobs.filter((j) => j.status !== 'delivered' && (jobLate(j, TODAY) || D.diffDays(TODAY, j.promised) <= 2));
  const mk = D.monthKey(TODAY);
  const allLedger = d().customers.flatMap((c) => c.ledger.map((l) => ({ ...l, c })));
  const monthSales = allLedger.filter((l) => l.type === 'purchase' && D.monthKey(l.date) === mk).reduce((s, l) => s + l.amount, 0);
  const receivable = d().customers.reduce((s, c) => s + Math.max(0, ledgerBalance(c.ledger)), 0);
  const occ = occasions(d().customers, TODAY, 7);
  const months = Array.from({ length: 6 }, (_, i) => D.addMonthsKey(mk, i - 5)).map((k) => ({ label: D.formatMonth(k, i18n.lang), value: allLedger.filter((l) => l.type === 'purchase' && D.monthKey(l.date) === k).reduce((s, l) => s + l.amount, 0) }));
  const views = (d().viewings || []).slice(-4).reverse();
  return {
    html: `<h1 class="view-title">${esc(t('h.title'))}</h1>
    <form id="rate-form" class="card rate-form">
      <div class="flex between"><h2 class="section-h" style="margin:0">${esc(t('h.rates'))}</h2><span class="small muted">${esc(t('h.updated', { time: (d().settings.ratesUpdatedAt || '').slice(11, 16), date: fdShort((d().settings.ratesUpdatedAt || TODAY).slice(0, 10)) }))}</span></div>
      <div class="grid-2 mt">${[['gold24', 'h.g24', 'h.per10'], ['gold22', 'h.g22', 'h.per10'], ['gold18', 'h.g18', 'h.per10'], ['silver', 'h.silver', 'h.perkg']].map(([k, l, p]) => `<label class="field"><span>${esc(t(l))} <small class="muted">${esc(t(p))}</small></span><input name="${k}" type="number" inputmode="numeric" min="0" step="10" value="${r[k]}"></label>`).join('')}</div>
      <p class="small muted" id="rate-preview"></p>
      <button class="btn primary big block" type="submit">${icon('check')}${esc(t('h.update'))}</button>
    </form>
    <div class="stats mt">
      <a class="stat hero" href="#/stock"><span class="k">${esc(t('h.stockVal'))}</span><span class="v">${money(stockVal)}</span><span class="s">${esc(t('h.pieces', { n: stock.length }))}</span></a>
      <a class="stat" href="#/customers"><span class="k">${esc(t('h.month'))}</span><span class="v">${money(monthSales)}</span></a>
      <a class="stat warn" href="#/customers"><span class="k">${esc(t('h.receivable'))}</span><span class="v">${money(receivable)}</span></a>
      <a class="stat ${schDue.some((x) => x.s.status === 'overdue') ? 'danger' : 'warn'}" href="#/schemes"><span class="k">${esc(t('h.schDue'))}</span><span class="v">${schDue.length}</span><span class="s">${money(schDue.reduce((s, x) => s + (x.s.pendingAmt || x.e.instalment), 0))}</span></a>
      <a class="stat" href="#/jobs"><span class="k">${esc(t('h.jobsDue'))}</span><span class="v">${jobsDue.length}</span></a>
    </div>
    <h2 class="section-h">${esc(t('h.occasions'))}</h2>
    ${occ.length ? `<div class="list">${occ.map((o) => `<div class="row"><span class="occ-ic" aria-hidden="true">${o.kind === 'dob' ? '🎂' : '💍'}</span><div class="main"><div class="t">${esc(o.c.name)}</div><div class="sub">${esc(t(o.kind === 'dob' ? 'h.bday' : 'h.anniv'))} · ${esc(o.inDays === 0 ? t('h.todayW') : fdShort(o.date))}</div></div><a class="btn sm wa" target="_blank" rel="noopener" href="${esc(waLink(o.c.phone, msg(o.kind === 'dob' ? 'msg.bday' : 'msg.anniv', { name: first(o.c.name), r: d().settings.name })))}">${icon('wa')}${esc(t('h.wish'))}</a></div>`).join('')}</div>` : `<p class="empty">${esc(t('h.noOcc'))}</p>`}
    <section class="card mt"><h2 class="section-h" style="margin-top:0">${esc(t('h.sales'))}</h2>${barChart(months, { format: money, ariaLabel: t('h.sales') })}</section>
    ${views.length ? `<h2 class="section-h">${esc(t('h.viewings'))}</h2><div class="list">${views.map((v) => `<div class="row"><div class="main"><div class="t">${esc(v.name)}</div><div class="sub">${esc(fd(v.date))} · ${esc(t(`cat.${v.interest}`))} · ${esc(v.phone)}</div></div><a class="icon-btn wa" href="${esc(waLink(v.phone, msg('msg.viewing', { name: first(v.name), r: d().settings.name, date: fd(v.date) })))}" target="_blank" rel="noopener" aria-label="WhatsApp">${icon('wa')}</a></div>`).join('')}</div>` : ''}`,
    mount() {
      const f = $('#rate-form');
      const sample = d().items.find((i) => i.id === 'g-chain-01') || d().items[0];
      const prev = () => {
        const v = formData(f);
        const nr = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Number(x) || 0]));
        const a = price(sample).total, b = priceBreakup(sample, nr, d().settings.gstPct).total;
        $('#rate-preview').textContent = a === b ? t('h.previewSame', { item: jName(sample, i18n.lang), price: money(a) }) : t('h.preview', { item: jName(sample, i18n.lang), from: money(a), to: money(b) });
      };
      f.addEventListener('input', prev); prev();
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        const v = formData(f);
        const nr = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Math.max(0, Number(x) || 0)]));
        if (!nr.gold22 || !nr.silver) { toast(t('h.bad'), 'danger'); return; }
        store.update((x) => {
          x.rates = nr;
          x.rateHistory = (x.rateHistory || []).filter((h) => h.date !== TODAY).concat({ date: TODAY, ...nr }).slice(-60);
          x.settings.ratesUpdatedAt = `${TODAY}T${D.nowTime()}`;
        });
        toast(t('h.repriced', { n: d().items.length }), 'ok'); render();
      });
    },
  };
}

// ---------- Stock ----------
function vStock() {
  const q = ui.stockQ.toLowerCase();
  const items = d().items.filter((i) => (ui.stockCat === 'all' || i.cat === ui.stockCat) && (!q || `${i.name.en}${i.name.hi}${i.name.pa}${i.sku}`.toLowerCase().includes(q)));
  return {
    html: `<h1 class="view-title">${esc(t('nav.stock'))} <small>${esc(t('s.ratesNote'))}</small></h1>
    <div class="search">${icon('search')}<input id="sq" type="search" value="${esc(ui.stockQ)}" placeholder="${esc(t('s.search'))}"></div>
    <div class="pills">${['all', ...JCATS].map((c) => `<button type="button" class="pill" data-act="scat" data-c="${c}" aria-pressed="${ui.stockCat === c}">${esc(t(c === 'all' ? 's.all' : `cat.${c}`))}</button>`).join('')}</div>
    <div class="list">${items.map((it) => `<div class="row ${it.inStock ? '' : 'is-off'}"><span class="jthumb">${it.photo ? `<img src="${esc(it.photo)}" alt="">` : itemArt(it, 52)}</span>
      <button type="button" class="main linkish" data-act="edit-item" data-id="${it.id}"><span class="t">${esc(jName(it, i18n.lang))}</span><span class="sub">${esc(it.sku)} · ${it.weight} g · ${esc(it.purity)} · ${esc(t('s.making', { n: it.making }))}</span></button>
      <span class="end"><span class="amt">${money(price(it).total)}</span>${it.inStock ? '' : `<span class="chip">${esc(t('s.sold'))}</span>`}</span></div>`).join('')}</div>`,
    fab: fabBtn('new-item', t('s.add')),
    mount() { $('#sq').addEventListener('input', debounce((e) => { ui.stockQ = e.target.value; render(); const i = $('#sq'); i.focus(); i.setSelectionRange(99, 99); }, 250)); },
  };
}
function editItem(id) {
  const it = id ? d().items.find((i) => i.id === id) : { id: '', cat: 'gold', type: 'ring', purity: '22K', weight: 5, making: 12, stone: 0, name: { en: '', hi: '', pa: '' }, photo: '', inStock: true, sku: `SH-${100 + d().items.length + 1}` };
  const types = ['ring', 'chain', 'bangle', 'earring', 'pendant', 'necklace', 'coin', 'anklet', 'bowl'];
  const s = sheet({
    title: id ? t('s.edit') : t('s.add'),
    body: `<div class="item-hero">${it.photo ? `<img src="${esc(it.photo)}" alt="">` : itemArt(it, 120)}<div><strong id="ip-total" class="big-num"></strong><div class="small muted" id="ip-break"></div></div></div>
    <form id="itf" class="form">
      <label class="field"><span>${esc(t('s.nameEn'))} *</span><input name="en" required value="${esc(it.name.en)}"></label>
      <div class="grid-2"><label class="field"><span>हिंदी</span><input name="hi" lang="hi" value="${esc(it.name.hi || '')}"></label><label class="field"><span>ਪੰਜਾਬੀ</span><input name="pa" lang="pa" value="${esc(it.name.pa || '')}"></label></div>
      <div class="grid-3"><label class="field"><span>${esc(t('s.cat'))}</span><select name="cat">${JCATS.map((c) => `<option value="${c}" ${it.cat === c ? 'selected' : ''}>${esc(t(`cat.${c}`))}</option>`).join('')}</select></label>
      <label class="field"><span>${esc(t('s.type'))}</span><select name="type">${types.map((c) => `<option value="${c}" ${it.type === c ? 'selected' : ''}>${esc(t(`ty.${c}`))}</option>`).join('')}</select></label>
      <label class="field"><span>${esc(t('s.purity'))}</span><select name="purity">${Object.keys(PURITIES).map((p) => `<option ${it.purity === p ? 'selected' : ''}>${p}</option>`).join('')}</select></label></div>
      <div class="grid-3"><label class="field"><span>${esc(t('s.weight'))}</span><input name="weight" type="number" inputmode="decimal" step="0.01" min="0" value="${it.weight}"></label>
      <label class="field"><span>${esc(t('s.makingPct'))}</span><input name="making" type="number" inputmode="decimal" step="0.5" min="0" value="${it.making}"></label>
      <label class="field"><span>${esc(t('s.stone'))}</span><input name="stone" type="number" inputmode="numeric" min="0" step="500" value="${it.stone}"></label></div>
      <label class="field"><span>${esc(t('s.photo'))}</span><input name="photo" type="url" inputmode="url" placeholder="https://…" value="${esc(it.photo)}"></label>
      <label class="switch"><span>${esc(t('s.inStock'))}</span><input type="checkbox" name="inStock" ${it.inStock ? 'checked' : ''}></label>
      ${id ? `<div class="btn-grid"><button type="button" class="btn" data-x="share">${icon('share')}${esc(t('s.share'))}</button><button type="button" class="btn" data-x="sell">${icon('tag')}${esc(t('s.sell'))}</button></div>` : ''}
      <div class="sheet-actions">${id ? `<button type="button" class="btn danger" data-x="del" aria-label="${esc(t('a.delete'))}">${icon('trash')}</button>` : ''}<button class="btn primary big" type="submit">${esc(t('a.save'))}</button></div>
    </form>`,
  });
  const f = $('#itf', s.el);
  const read = () => { const v = formData(f); return { ...it, name: { en: v.en, hi: v.hi, pa: v.pa }, cat: v.cat, type: v.type, purity: v.purity, weight: Number(v.weight) || 0, making: Number(v.making) || 0, stone: Number(v.stone) || 0, photo: /^https?:\/\//.test(v.photo) ? v.photo : '', inStock: f.inStock.checked }; };
  const upd = () => { const p = price(read()); $('#ip-total', s.el).textContent = money(p.total); $('#ip-break', s.el).textContent = t('s.breakup', { metal: money(p.metal), making: money(p.making), stone: money(p.stone), gst: money(p.gst) }); };
  f.addEventListener('input', upd); upd();
  s.el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-x]');
    if (!b) return;
    if (b.dataset.x === 'share') { const r = await shareCanvas(await itemCard(read()), `${it.sku}.png`, jName(it, i18n.lang)); if (r === 'downloaded') toast(t('s.saved'), 'ok'); }
    if (b.dataset.x === 'sell') { s.close(); sellItem(it.id); }
    if (b.dataset.x === 'del' && await confirmBox(t('s.delQ'), { ok: t('a.delete'), cancel: t('a.cancel'), danger: true })) { store.update((x) => { x.items = x.items.filter((i) => i.id !== id); }); s.close(); render(); }
  });
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = read();
    if (!v.name.en) { toast(t('s.needName'), 'danger'); return; }
    store.update((x) => { if (id) Object.assign(x.items.find((i) => i.id === id), v); else x.items.push({ ...v, id: `i${Date.now().toString(36)}` }); });
    s.close(); render(); toast(t('a.saved'), 'ok');
  });
}
/** Item card as an image (for WhatsApp status / sharing with a customer). */
function itemCard(it) {
  const W = 800, H = 1000, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#5a0f1e'); g.addColorStop(1, '#2e0710');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.strokeStyle = '#e3c178'; x.lineWidth = 3; x.strokeRect(30, 30, W - 60, H - 60);
  x.fillStyle = '#fbf3e3'; x.beginPath(); x.arc(W / 2, 360, 230, 0, Math.PI * 2); x.fill();
  const font = (w, s, serif) => `${w} ${s}px ${serif ? '"Cormorant Garamond", Georgia, serif' : 'Inter, sans-serif'}, "Noto Sans Devanagari", "Noto Sans Gurmukhi"`;
  x.fillStyle = '#e3c178'; x.font = font(600, 44, true); x.textAlign = 'center'; x.fillText(d().settings.name, W / 2, 100);
  const p = price(it);
  const draw = () => {
    x.fillStyle = '#f4e2b0'; x.font = font(600, 54, true);
    wrapText(x, jName(it, i18n.lang), W - 140).slice(0, 2).forEach((ln, i) => x.fillText(ln, W / 2, 690 + i * 60));
    x.fillStyle = '#e9d3b0'; x.font = font(500, 28); x.fillText(`${it.weight} g · ${it.purity} · ${it.sku}`, W / 2, 800);
    x.fillStyle = '#e3c178'; x.font = font(800, 60); x.fillText(money(p.total), W / 2, 880);
    x.fillStyle = '#d4b98f'; x.font = font(500, 22); x.fillText(t('s.cardNote', { date: fd(TODAY) }), W / 2, 925);
  };
  const svg = new Blob([itemArt(it, 360).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')], { type: 'image/svg+xml' });
  const img = new Image();
  draw();
  return new Promise((res) => { img.onload = () => { x.drawImage(img, W / 2 - 180, 180, 360, 360); res(c); }; img.onerror = () => res(c); img.src = URL.createObjectURL(svg); }).then(() => c);
}
function sellItem(itemId) {
  const it = d().items.find((i) => i.id === itemId);
  const p = price(it);
  const s = sheet({
    title: t('s.sell'),
    body: `<p><strong>${esc(jName(it, i18n.lang))}</strong> · ${money(p.total)}</p><form id="sf" class="form">
    <label class="field"><span>${esc(t('c.customer'))}</span><select name="cid">${d().customers.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>
    <div class="grid-2"><label class="field"><span>${esc(t('c.amount'))}</span><input name="amount" type="number" inputmode="numeric" value="${p.total}"></label><label class="field"><span>${esc(t('c.paidNow'))}</span><input name="paid" type="number" inputmode="numeric" value="${p.total}"></label></div>
    <div class="sheet-actions"><button class="btn primary big" type="submit">${esc(t('a.save'))}</button></div></form>`,
  });
  $('#sf', s.el).addEventListener('submit', (e) => {
    e.preventDefault();
    const v = formData(e.target);
    store.update((x) => {
      const c = x.customers.find((cc) => cc.id === v.cid);
      c.ledger.push({ id: `l${Date.now().toString(36)}`, date: TODAY, type: 'purchase', amount: Number(v.amount) || 0, note: `${it.name.en} (${it.sku})` });
      if (Number(v.paid) > 0) c.ledger.push({ id: `p${Date.now().toString(36)}`, date: TODAY, type: 'payment', amount: Number(v.paid), mode: 'UPI', note: it.sku });
      x.items.find((i) => i.id === itemId).inStock = false;
    });
    s.close(); render(); toast(t('s.soldOk'), 'ok');
  });
}

// ---------- Customers & ledger ----------
function vCustomers() {
  const q = ui.custQ.toLowerCase();
  const list = d().customers.filter((c) => !q || `${c.name}${c.phone}`.toLowerCase().includes(q)).map((c) => ({ c, bal: ledgerBalance(c.ledger) })).sort((a, b) => b.bal - a.bal || a.c.name.localeCompare(b.c.name));
  return {
    html: `<h1 class="view-title">${esc(t('nav.customers'))} <small>${d().customers.length}</small></h1>
    <div class="search">${icon('search')}<input id="cq" type="search" value="${esc(ui.custQ)}" placeholder="${esc(t('c.search'))}"></div>
    <div class="list">${list.map(({ c, bal }) => `<button type="button" class="row" data-act="cust" data-id="${c.id}"><span class="avatar" style="width:42px;height:42px;--h:${(c.name.length * 37) % 360}">${esc(c.name.split(' ').map((w) => w[0]).join('').slice(0, 2))}</span><span class="main"><span class="t">${esc(c.name)}</span><span class="sub">${esc(c.phone)} · ${esc(t('c.entries', { n: c.ledger.length }))}</span></span><span class="end">${bal > 0 ? `<span class="chip warn">${money(bal)}</span>` : `<span class="chip ok">${esc(t('c.clear'))}</span>`}</span></button>`).join('')}</div>`,
    fab: fabBtn('new-cust', t('c.add')),
    mount() { $('#cq').addEventListener('input', debounce((e) => { ui.custQ = e.target.value; render(); const i = $('#cq'); i.focus(); i.setSelectionRange(99, 99); }, 250)); },
  };
}
function custSheet(id) {
  const c = cust(id);
  const bal = ledgerBalance(c.ledger);
  const enr = d().enrolments.filter((e) => e.customerId === id);
  const tel = telLink(c.phone);
  const s = sheet({
    title: c.name, wide: true,
    body: `<div class="flex wrap"><span class="chip ${bal > 0 ? 'warn' : 'ok'}">${esc(t('c.balance'))}: ${money(bal)}</span>${c.dob ? `<span class="chip plain">🎂 ${esc(fdShort(c.dob))}</span>` : ''}${c.anniversary ? `<span class="chip plain">💍 ${esc(fdShort(c.anniversary))}</span>` : ''}</div>
    <div class="btn-grid mt">${tel ? `<a class="btn" href="${tel}">${icon('phone')}${esc(t('c.call'))}</a>` : ''}<a class="btn wa" target="_blank" rel="noopener" href="${esc(waLink(c.phone, bal > 0 ? msg('msg.balance', { name: first(c.name), amount: money(bal), r: d().settings.name }) : msg('msg.hello', { name: first(c.name), r: d().settings.name })))}">${icon('wa')}${esc(bal > 0 ? t('c.remind') : 'WhatsApp')}</a></div>
    <form id="lf" class="form card mt"><div class="seg"><label><input type="radio" name="type" value="payment" checked><span>${esc(t('c.payment'))}</span></label><label><input type="radio" name="type" value="purchase"><span>${esc(t('c.purchase'))}</span></label></div>
    <div class="grid-2"><label class="field"><span>${esc(t('c.amount'))}</span><input name="amount" type="number" inputmode="numeric" min="1" required></label><label class="field"><span>${esc(t('c.note'))}</span><input name="note"></label></div>
    <button class="btn primary" type="submit">${icon('plus')}${esc(t('c.addEntry'))}</button></form>
    <h3 class="section-h">${esc(t('c.ledger'))}</h3>
    <div class="table-wrap"><table class="tbl"><thead><tr><th>${esc(t('c.date'))}</th><th>${esc(t('c.note'))}</th><th class="r">${esc(t('c.purchase'))}</th><th class="r">${esc(t('c.payment'))}</th></tr></thead><tbody>${c.ledger.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).map((l) => `<tr><td>${esc(fdShort(l.date))}</td><td>${esc(l.note || '')}</td><td class="r">${l.type === 'purchase' ? money(l.amount) : ''}</td><td class="r">${l.type === 'payment' ? money(l.amount) : ''}</td></tr>`).join('')}</tbody></table></div>
    ${enr.length ? `<h3 class="section-h">${esc(t('nav.schemes'))}</h3>${enr.map((e) => schemeRow(e)).join('')}` : ''}
    <details class="mt"><summary>${esc(t('c.editDetails'))}</summary><form id="cf" class="form mt">${custFields(c)}<button class="btn" type="submit">${esc(t('a.save'))}</button></form></details>`,
  });
  $('#lf', s.el).addEventListener('submit', (e) => {
    e.preventDefault();
    const v = formData(e.target);
    if (!(Number(v.amount) > 0)) return;
    store.update(() => c.ledger.push({ id: `l${Date.now().toString(36)}`, date: TODAY, type: v.type, amount: Number(v.amount), note: v.note, mode: 'Cash' }));
    s.close(); render(); custSheet(id); toast(t('a.saved'), 'ok');
  });
  $('#cf', s.el).addEventListener('submit', (e) => { e.preventDefault(); const v = formData(e.target); store.update(() => Object.assign(c, { name: v.name || c.name, phone: v.phone, dob: v.dob, anniversary: v.anniversary })); s.close(); render(); });
}
const custFields = (c = {}) => `<label class="field"><span>${esc(t('c.name'))}</span><input name="name" required value="${esc(c.name || '')}"></label><label class="field"><span>${esc(t('c.phone'))}</span><input name="phone" type="tel" inputmode="tel" value="${esc(c.phone || '')}"></label><div class="grid-2"><label class="field"><span>${esc(t('c.dob'))}</span><input name="dob" type="date" value="${esc(c.dob || '')}"></label><label class="field"><span>${esc(t('c.anniv'))}</span><input name="anniversary" type="date" value="${esc(c.anniversary || '')}"></label></div>`;
function newCust() {
  const s = sheet({ title: t('c.add'), body: `<form id="ncf" class="form">${custFields()}<div class="sheet-actions"><button class="btn primary big" type="submit">${esc(t('a.save'))}</button></div></form>` });
  $('#ncf', s.el).addEventListener('submit', (e) => { e.preventDefault(); const v = formData(e.target); if (!v.name) return; store.update((x) => x.customers.push({ id: `c${Date.now().toString(36)}`, ...v, ledger: [] })); s.close(); render(); });
}

// ---------- Savings schemes ----------
function schemeRow(e) {
  const st = schemeStatus(e, TODAY);
  const c = cust(e.customerId) || { name: '?', phone: '' };
  const sc = d().schemes.find((x) => x.id === e.schemeId) || { name: '' };
  const line = st.status === 'overdue' || st.status === 'due' ? t('sc.lateLine', { n: st.pending, amount: money(st.pendingAmt), days: st.daysLate }) : st.nextDue ? t('sc.nextLine', { date: fdShort(st.nextDue) }) : t('sc.maturityLine', { date: fd(st.maturity) });
  const reminded = (e.reminders || []).includes(TODAY);
  const remind = ['due', 'overdue', 'duesoon'].includes(st.status);
  const text = msg(st.status === 'duesoon' ? 'msg.schSoon' : 'msg.schDue', { name: first(c.name), amount: money(st.status === 'duesoon' ? e.instalment : st.pendingAmt), date: fd(st.nextDue || TODAY), scheme: sc.name, r: d().settings.name, n: st.paidCount, m: e.months });
  return `<div class="card sch-row"><button type="button" class="linkish block" data-act="sch" data-id="${e.id}"><span class="flex between"><strong>${esc(c.name)}</strong><span class="chip ${SCH_CLS[st.status]}">${esc(t(`sc.${st.status}`))}</span></span>
    <span class="small muted">${esc(sc.name)} · ${money(e.instalment)}/${esc(t('sc.month'))} · ${esc(t('sc.paidOf', { n: st.paidCount, m: e.months }))}</span>
    <span class="progress mt"><span style="width:${Math.round(st.progress * 100)}%"></span></span><span class="small">${esc(line)}</span></button>
    ${remind ? `<div class="flex mt">${reminded ? `<span class="chip ok">${esc(t('sc.reminded'))}</span>` : `<a class="btn sm wa" target="_blank" rel="noopener" href="${esc(waLink(c.phone, text))}" data-act="sch-remind" data-id="${e.id}">${icon('wa')}${esc(t('sc.remind'))}</a>`}<button type="button" class="btn sm secondary" data-act="sch-pay" data-id="${e.id}">${icon('rupee')}${esc(t('sc.pay'))}</button></div>` : ''}</div>`;
}
function vSchemes() {
  const all = d().enrolments.map((e) => ({ e, s: schemeStatus(e, TODAY) }));
  const F = { all: () => true, due: (x) => ['due', 'duesoon'].includes(x.s.status), overdue: (x) => x.s.status === 'overdue', ontrack: (x) => x.s.status === 'ontrack', done: (x) => ['completed', 'matured'].includes(x.s.status) };
  const order = { overdue: 0, due: 1, duesoon: 2, ontrack: 3, completed: 4, matured: 5, closed: 6 };
  const list = all.filter(F[ui.schF]).sort((a, b) => order[a.s.status] - order[b.s.status]);
  const monthly = all.filter((x) => !['completed', 'matured', 'closed'].includes(x.s.status)).reduce((s, x) => s + x.e.instalment, 0);
  const pend = all.reduce((s, x) => s + x.s.pendingAmt, 0);
  return {
    html: `<h1 class="view-title">${esc(t('nav.schemes'))}</h1>
    <div class="stats"><div class="stat"><span class="k">${esc(t('sc.active'))}</span><span class="v">${all.filter((x) => !['completed', 'matured', 'closed'].includes(x.s.status)).length}</span><span class="s">${money(monthly)}/${esc(t('sc.month'))}</span></div><div class="stat danger"><span class="k">${esc(t('sc.pending'))}</span><span class="v">${money(pend)}</span></div></div>
    <div class="pills mt">${Object.keys(F).map((k) => `<button type="button" class="pill" data-act="schf" data-k="${k}" aria-pressed="${ui.schF === k}">${esc(t(`sc.f.${k}`))}<span class="n">${all.filter(F[k]).length}</span></button>`).join('')}</div>
    <div class="list">${list.map((x) => schemeRow(x.e)).join('') || `<p class="empty">${esc(t('sc.none'))}</p>`}</div>
    <p class="small muted mt">${esc(t('sc.how'))}</p>`,
    fab: fabBtn('enrol', t('sc.enrol')),
  };
}
function schSheet(id) {
  const e = d().enrolments.find((x) => x.id === id);
  const st = schemeStatus(e, TODAY);
  const c = cust(e.customerId);
  const s = sheet({
    title: `${c.name} · ${(d().schemes.find((x) => x.id === e.schemeId) || {}).name || ''}`,
    body: `<dl class="kv">${[[t('sc.start'), fd(e.start)], [t('sc.maturity'), fd(st.maturity)], [t('sc.paid'), `${money(st.paidAmt)} (${st.paidCount}/${e.months})`], [t('sc.nextDue'), st.nextDue ? fd(st.nextDue) : '—'], [t('sc.pending'), money(st.pendingAmt)], [t('sc.value'), money(st.maturityValue)]].map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    <div class="sch-grid mt" aria-label="${esc(t('sc.paid'))}">${Array.from({ length: e.months }, (_, k) => { const due = D.addMonths(e.start, k); const paid = k < st.paidCount; return `<span class="${paid ? 'on' : due <= TODAY ? 'late' : ''}" title="${esc(fd(due))}">${k + 1}</span>`; }).join('')}<span class="bonus" title="${esc(t('sc.bonus'))}">🎁</span></div>
    ${st.paidCount < e.months ? `<button type="button" class="btn primary big block mt" data-x="pay">${icon('rupee')}${esc(t('sc.payN', { amount: money(e.instalment) }))}</button>` : ''}
    <h3 class="section-h">${esc(t('sc.history'))}</h3><div class="list">${(e.payments || []).slice().reverse().map((p) => `<div class="row" style="min-height:48px"><span class="main"><span class="t">${money(p.amount)}</span><span class="sub">${esc(fd(p.date))} · ${esc(p.mode || '')}</span></span></div>`).join('') || `<p class="empty">—</p>`}</div>`,
  });
  s.el.addEventListener('click', (ev) => { if (ev.target.closest('[data-x="pay"]')) { payInstalment(id); s.close(); schSheet(id); } });
}
function payInstalment(id) {
  const e = d().enrolments.find((x) => x.id === id);
  store.update(() => { e.payments.push({ date: TODAY, amount: e.instalment, mode: 'Cash' }); });
  render(); toast(t('sc.paidOk', { amount: money(e.instalment) }), 'ok');
}
function enrol() {
  const s = sheet({
    title: t('sc.enrol'),
    body: `<form id="ef" class="form"><label class="field"><span>${esc(t('c.customer'))}</span><select name="cid">${d().customers.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>
    <label class="field"><span>${esc(t('sc.plan'))}</span><select name="sid">${d().schemes.map((x) => `<option value="${x.id}">${esc(x.name)} · ${money(x.instalment)}</option>`).join('')}</select></label>
    <label class="field"><span>${esc(t('sc.start'))}</span><input name="start" type="date" value="${TODAY}"></label>
    <label class="switch"><span>${esc(t('sc.firstNow'))}</span><input type="checkbox" name="first" checked></label>
    <p class="small muted" id="ef-mat"></p>
    <div class="sheet-actions"><button class="btn primary big" type="submit">${esc(t('sc.enrol'))}</button></div></form>`,
  });
  const f = $('#ef', s.el);
  const upd = () => { const v = formData(f); const sc = d().schemes.find((x) => x.id === v.sid); $('#ef-mat', s.el).textContent = t('sc.matPreview', { date: fd(D.addMonths(v.start || TODAY, sc.months)), amount: money(sc.instalment * (sc.months + d().settings.schemeBonus)) }); };
  f.addEventListener('input', upd); upd();
  f.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const v = formData(f);
    const sc = d().schemes.find((x) => x.id === v.sid);
    store.update((x) => x.enrolments.push({ id: `e${Date.now().toString(36)}`, customerId: v.cid, schemeId: sc.id, start: v.start || TODAY, months: sc.months, instalment: sc.instalment, bonus: sc.instalment * x.settings.schemeBonus, payments: f.first.checked ? [{ date: TODAY, amount: sc.instalment, mode: 'Cash' }] : [], reminders: [] }));
    s.close(); render(); toast(t('a.saved'), 'ok');
  });
}

// ---------- Orders & repairs ----------
function vJobs() {
  const open = (j) => j.status !== 'delivered';
  const list = d().jobs.filter(ui.jobF === 'open' ? open : (j) => !open(j)).sort((a, b) => (a.promised < b.promised ? -1 : 1));
  return {
    html: `<h1 class="view-title">${esc(t('nav.jobs'))}</h1>
    <div class="pills">${['open', 'done'].map((k) => `<button type="button" class="pill" data-act="jobf" data-k="${k}" aria-pressed="${ui.jobF === k}">${esc(t(`j.${k}`))}<span class="n">${d().jobs.filter(k === 'open' ? open : (j) => !open(j)).length}</span></button>`).join('')}</div>
    <div class="list">${list.map((j) => {
      const c = cust(j.customerId) || { name: '?', phone: '' };
      const late = jobLate(j, TODAY);
      const ni = JOB_STATUSES.indexOf(j.status) + 1;
      return `<article class="card"><div class="flex between wrap"><span class="chip plain ${j.kind === 'order' ? 'accent' : 'info'}">${esc(t(`j.${j.kind}`))}</span>${late ? `<span class="chip danger">${esc(t('j.late', { n: late }))}</span>` : ''}<span class="chip ${j.status === 'ready' ? 'ok' : ''}">${esc(t(`j.st.${j.status}`))}</span></div>
      <p style="margin:8px 0 4px;font-weight:700">${esc(j.desc)}</p>
      <p class="small muted" style="margin:0">${esc(c.name)} · ${esc(t('j.promised', { date: fd(j.promised) }))}${j.estimate ? ` · ${esc(t('j.est', { amount: money(j.estimate) }))}` : ''}${j.advance ? ` · ${esc(t('j.adv', { amount: money(j.advance) }))}` : ''}</p>
      <div class="btn-row mt">${ni < JOB_STATUSES.length ? `<button type="button" class="btn sm primary" data-act="job-next" data-id="${j.id}">${esc(t(`j.to.${JOB_STATUSES[ni]}`))}</button>` : ''}
      ${j.status === 'ready' ? `<a class="btn sm wa" target="_blank" rel="noopener" href="${esc(waLink(c.phone, msg('msg.ready', { name: first(c.name), item: j.desc, r: d().settings.name, amount: money(Math.max(0, j.estimate - j.advance)) })))}">${icon('wa')}${esc(t('j.tell'))}</a>` : ''}</div></article>`;
    }).join('') || `<p class="empty">${esc(t('j.none'))}</p>`}</div>`,
    fab: fabBtn('new-job', t('j.add')),
  };
}
function newJob() {
  const s = sheet({
    title: t('j.add'),
    body: `<form id="jf" class="form"><div class="seg"><label><input type="radio" name="kind" value="repair" checked><span>${esc(t('j.repair'))}</span></label><label><input type="radio" name="kind" value="order"><span>${esc(t('j.order'))}</span></label></div>
    <label class="field"><span>${esc(t('c.customer'))}</span><select name="cid">${d().customers.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>
    <label class="field"><span>${esc(t('j.desc'))}</span><input name="desc" required></label>
    <div class="grid-3"><label class="field"><span>${esc(t('j.promisedL'))}</span><input name="promised" type="date" value="${D.addDays(TODAY, 3)}"></label><label class="field"><span>${esc(t('j.estL'))}</span><input name="estimate" type="number" inputmode="numeric" min="0" value="0"></label><label class="field"><span>${esc(t('j.advL'))}</span><input name="advance" type="number" inputmode="numeric" min="0" value="0"></label></div>
    <div class="sheet-actions"><button class="btn primary big" type="submit">${esc(t('a.save'))}</button></div></form>`,
  });
  $('#jf', s.el).addEventListener('submit', (e) => {
    e.preventDefault();
    const v = formData(e.target);
    if (!v.desc) return;
    store.update((x) => x.jobs.push({ id: `j${Date.now().toString(36)}`, kind: v.kind, customerId: v.cid, desc: v.desc, received: TODAY, promised: v.promised, status: 'received', estimate: Number(v.estimate) || 0, advance: Number(v.advance) || 0 }));
    s.close(); ui.jobF = 'open'; render();
  });
}

// ---------- Settings ----------
function vSettings() {
  const st = d().settings;
  return {
    html: `<h1 class="view-title">${esc(t('nav.settings'))}</h1>
    <form id="stf" class="form card"><label class="field"><span>${esc(t('set.name'))}</span><input name="name" value="${esc(st.name)}"></label>
    <div class="grid-2"><label class="field"><span>GST %</span><input name="gstPct" type="number" inputmode="decimal" min="0" step="0.5" value="${st.gstPct}"></label><label class="field"><span>${esc(t('set.pin'))}</span><input name="pin" type="password" inputmode="numeric" maxlength="6" value="${esc(st.pin)}"></label></div>
    <div class="field"><span class="lbl">${esc(t('set.lang'))}</span><div class="lang-switch"></div></div>
    <button class="btn primary big" type="submit">${esc(t('a.save'))}</button></form>
    <section class="card mt"><div class="btn-grid"><button type="button" class="btn" data-act="backup">${icon('download')}${esc(t('set.backup'))}</button><button type="button" class="btn" data-act="restore">${icon('upload')}${esc(t('set.restore'))}</button><button type="button" class="btn" data-act="lock">${icon('lock')}${esc(t('set.lock'))}</button><button type="button" class="btn" id="install-btn" hidden>${icon('install')}${esc(t('set.install'))}</button></div>
    <p class="small muted mt">${esc(t('set.dataHelp'))}</p><button type="button" class="btn danger block mt" data-act="reset">${icon('trash')}${esc(t('set.reset'))}</button></section>`,
    mount() {
      i18n.mountSwitch($('#stf'));
      bindInstallButton($('#install-btn'));
      $('#stf').addEventListener('submit', (e) => {
        e.preventDefault();
        const v = formData(e.target);
        if (!/^\d{4,6}$/.test(v.pin)) { toast(t('set.pinBad'), 'danger'); return; }
        store.update((x) => Object.assign(x.settings, { name: v.name || x.settings.name, gstPct: Number(v.gstPct) || 0, pin: v.pin }));
        toast(t('a.saved'), 'ok'); render();
      });
    },
  };
}

const actions = {
  scat: (el) => { ui.stockCat = el.dataset.c; render(); },
  'edit-item': (el) => editItem(el.dataset.id), 'new-item': () => editItem(''),
  cust: (el) => custSheet(el.dataset.id), 'new-cust': () => newCust(),
  schf: (el) => { ui.schF = el.dataset.k; render(); },
  sch: (el) => schSheet(el.dataset.id), 'sch-pay': (el) => payInstalment(el.dataset.id), enrol: () => enrol(),
  'sch-remind': (el) => { store.update((x) => { const e = x.enrolments.find((y) => y.id === el.dataset.id); e.reminders = (e.reminders || []).concat(TODAY).slice(-20); }); setTimeout(render, 300); return true; },
  jobf: (el) => { ui.jobF = el.dataset.k; render(); },
  'job-next': (el) => { store.update((x) => { const j = x.jobs.find((y) => y.id === el.dataset.id); j.status = JOB_STATUSES[JOB_STATUSES.indexOf(j.status) + 1]; }); render(); },
  'new-job': () => newJob(),
  backup: () => download(`shreeheera-backup-${TODAY}.json`, store.exportJSON(), 'application/json'),
  restore: async () => { const f = await pickFile(); if (!f) return; try { store.importJSON(await readText(f)); toast(t('set.restored'), 'ok'); render(); } catch (e) { toast(e.message, 'danger'); } },
  reset: async () => { if (!(await confirmBox(t('set.resetQ'), { ok: t('set.reset'), cancel: t('a.cancel'), danger: true }))) return; store.reset(); location.hash = '#/'; render(); toast(t('set.resetDone'), 'ok'); },
  lock: () => lockNow(JEW_KEY),
};
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || !actions[el.dataset.act]) return;
  if (!(el.tagName === 'A' && el.dataset.act === 'sch-remind')) e.preventDefault();
  actions[el.dataset.act](el);
});
function boot() {
  i18n.mountSwitch(document.querySelector('.app-head'));
  i18n.onChange(render);
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
  window.addEventListener('storage', (e) => { if (e.key === JEW_KEY) { store.reload(); render(); } });
  render();
  setTimeout(function tick() { render(); setTimeout(tick, D.msUntilNextMidnight()); }, D.msUntilNextMidnight());
}
registerPWA();
pinGate({ appKey: JEW_KEY, getPin: () => d().settings.pin, t, brand: d().settings.name, logo: '◆', onUnlock: boot });
