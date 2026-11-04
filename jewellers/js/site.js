// Shree Heera public site: live rate widget + collection priced from the owner's rates, estimator, scheme calculator.
import { initSite } from '../../shared/site.js';
import { JEW_I18N } from '../../js/i18n-jewellers.js';
import { $, esc, money, formData } from '../../shared/ui.js';
import { waLink } from '../../shared/wa.js';
import { cfg } from '../../js/config.js';
import { formatDate, todayISO } from '../../shared/dates.js';
import { jewStore, JCATS, jName, itemArt } from './data.js';
import { priceBreakup, PURITIES } from './logic.js';

const ui = { cat: 'all' };
const i18n = initSite({ site: 'jewellers', dict: JEW_I18N, onLang: renderAll });
const t = i18n.t;
const d = () => jewStore.data;
const WA = () => cfg('WHATSAPP_NUMBER', 'jewellers');

function renderRates() {
  const r = d().rates;
  const hist = d().rateHistory || [];
  const prev = hist.length > 1 ? hist[hist.length - 2] : null;
  const row = (k, label, per) => {
    const diff = prev ? r[k] - prev[k] : 0;
    return `<div><dt>${esc(t(label))}<small>${esc(t(per))}</small></dt><dd>${money(r[k])}${diff ? `<span class="chg ${diff > 0 ? 'up' : 'down'}">${diff > 0 ? '▲' : '▼'} ${esc(t(diff > 0 ? 'rate.up' : 'rate.down', { amount: money(Math.abs(diff)) }))}</span>` : ''}</dd></div>`;
  };
  $('#rate-list').innerHTML = row('gold24', 'rate.g24', 'rate.per10') + row('gold22', 'rate.g22', 'rate.per10') + row('gold18', 'rate.g18', 'rate.per10') + row('silver', 'rate.s', 'rate.perkg');
  const at = d().settings.ratesUpdatedAt || `${todayISO()}T10:00`;
  $('#rate-upd').textContent = t('rate.upd', { date: formatDate(at.slice(0, 10), i18n.lang), time: at.slice(11, 16) });
}
function renderOffers() {
  const items = [1, 2, 3, 4].map((n) => `<span>◆ ${esc(t(`offers.${n}`))}</span>`).join('');
  $('#offers').innerHTML = items + items;
}
function renderGallery() {
  $('#filters').innerHTML = ['all', ...JCATS].map((c) => `<button type="button" role="tab" aria-selected="${ui.cat === c}" data-cat="${c}">${esc(t(c === 'all' ? 'col.all' : `cat.${c}`))}</button>`).join('');
  const items = d().items.filter((it) => ui.cat === 'all' || it.cat === ui.cat);
  $('#gallery').innerHTML = items.map((it) => {
    const p = priceBreakup(it, d().rates, d().settings.gstPct);
    const text = t('col.askText', { item: jName(it, i18n.lang), sku: it.sku, weight: it.weight, purity: it.purity });
    return `<article class="jcard ${it.inStock ? '' : 'sold'}"><div class="jart">${it.photo ? `<img src="${esc(it.photo)}" alt="" loading="lazy">` : itemArt(it, 150)}<span class="jcat">${esc(t(`cat.${it.cat}`))}</span></div>
      <h3>${esc(jName(it, i18n.lang))}</h3><p class="jmeta">${it.weight} g · ${esc(it.purity)}${it.stone ? ' · ◆' : ''}</p>
      <p class="jprice">${it.inStock ? `${money(p.total)} <small>${esc(t('col.price'))}</small>` : `<span class="sold-tag">${esc(t('col.sold'))}</span>`}</p>
      <a class="jask" href="${esc(waLink(WA(), text))}" target="_blank" rel="noopener">${esc(t('col.ask'))} →</a></article>`;
  }).join('');
}
function renderEstimate() {
  const f = $('#est-form');
  const sel = $('#est-purity');
  const cur = sel.value || '22K';
  sel.innerHTML = Object.keys(PURITIES).map((k) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${esc(t(`p.${k}`))}</option>`).join('');
  const v = formData(f);
  $('#mk-out').textContent = `${v.making}%`;
  const p = priceBreakup({ weight: Number(v.weight) || 0, purity: v.purity, making: Number(v.making), stone: Number(v.stone) || 0 }, d().rates, d().settings.gstPct);
  $('#est-out').innerHTML = `<div><dt>${esc(t('est.metal'))}</dt><dd>${money(p.metal)}</dd></div><div><dt>${esc(t('est.makingAmt'))}</dt><dd>${money(p.making)}</dd></div>${p.stone ? `<div><dt>${esc(t('est.stoneAmt'))}</dt><dd>${money(p.stone)}</dd></div>` : ''}<div><dt>${esc(t('est.gst'))}</dt><dd>${money(p.gst)}</dd></div><div class="grand"><dt>${esc(t('est.total'))}</dt><dd>${money(p.total)}</dd></div>`;
}
function renderScheme() {
  const amt = Number($('#sch-amt').value);
  $('#sch-out').innerHTML = `<div><dt>${esc(t('sch.you'))}</dt><dd>11 × ${money(amt)} = ${money(amt * 11)}</dd></div><div><dt>${esc(t('sch.we'))}</dt><dd>+ ${money(amt)}</dd></div><div class="grand"><dt>${esc(t('sch.get'))}</dt><dd>${money(amt * 12)}</dd></div>`;
  $('#sch-join').href = waLink(WA(), t('sch.joinText', { amount: money(amt) }));
}
function renderAll() { renderRates(); renderOffers(); renderGallery(); renderEstimate(); renderScheme(); }
renderAll();

$('#filters').addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (b) { ui.cat = b.dataset.cat; renderGallery(); } });
$('#est-form').addEventListener('input', renderEstimate);
$('#sch-amt').addEventListener('change', renderScheme);
const bf = $('#book-form');
bf.date.value = todayISO();
bf.date.min = todayISO();
bf.addEventListener('submit', (e) => {
  e.preventDefault();
  const v = formData(bf);
  const msg = $('#book-msg');
  if (!v.name || (v.phone || '').replace(/\D/g, '').length < 10) { msg.className = 'form-msg err'; msg.textContent = t('book.err'); return; }
  jewStore.update((x) => x.viewings.push({ id: `v${Date.now().toString(36)}`, ...v, createdAt: todayISO(), status: 'new' }));
  const date = formatDate(v.date, i18n.lang);
  const text = t('book.waText', { r: d().settings.name, name: v.name, phone: v.phone, date, interest: t(`cat.${v.interest}`) });
  msg.className = 'form-msg ok';
  msg.innerHTML = `${esc(t('book.ok', { name: v.name.split(' ')[0], date }))} <a href="${esc(waLink(WA(), text))}" target="_blank" rel="noopener">${esc(t('book.wa'))} →</a>`;
  bf.reset(); bf.date.value = todayISO();
});
window.addEventListener('storage', (e) => { if (e.key === 'shreeheera.jewellers') { jewStore.reload(); renderAll(); } });
