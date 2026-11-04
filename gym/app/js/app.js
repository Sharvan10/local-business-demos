// IronCore Fitness — Owner app. "Add a member once, everything else runs by itself."
import { createStore } from '../../../shared/storage.js';
import { createI18n } from '../../../shared/i18n.js';
import * as D from '../../../shared/dates.js';
import { $, $$, esc, money, avatar, toast, sheet, confirmBox, printHTML, download, pickFile, readText, resizeImage, formData, shareCanvas, wrapText, debounce } from '../../../shared/ui.js';
import { waLink, waMessage, telLink } from '../../../shared/wa.js';
import { icon } from '../../../shared/icons.js';
import { barChart, hBars } from '../../../shared/chart.js';
import { toCSV } from '../../../shared/csv.js';
import { pinGate, lockNow } from '../../../shared/pin.js';
import { registerPWA, bindInstallButton } from '../../../shared/pwa.js';
import { GYM_APP_I18N } from '../../../js/i18n-gym-app.js';
import * as L from './logic.js';
import { seedGym, GYM_STORE_VERSION, gymMigrations } from './seed.js';

const APP_KEY = 'ironcore.gym';
const store = createStore({ key: APP_KEY, version: GYM_STORE_VERSION, seed: () => seedGym(), migrations: gymMigrations });
const i18n = createI18n(GYM_APP_I18N);
const t = (k, v) => i18n.t(k, v);
const view = $('#view');
let TODAY = D.todayISO();
let C = null; // computed context
const ui = { filter: 'all', special: '', plan: '', sort: 'expiry', q: '', calMonth: null, profileTab: 'pay', checkTab: 'today', remType: 'due', msgLang: null, reportMonths: 6 };

// ---------- computed state ----------
function compute() {
  TODAY = D.todayISO();
  const d = store.data;
  const summaries = new Map(d.members.map((m) => [m.id, L.summarize(m, d.payments, d.settings, TODAY)]));
  const attIndex = L.indexAttendance(d.attendance);
  C = { d, s: d.settings, summaries, attIndex };
  return C;
}
const S = (id) => C.summaries.get(id);
const M = (id) => C.d.members.find((m) => m.id === id);
const fd = (iso, opts) => D.formatDate(iso, i18n.lang, opts);
const fdShort = (iso) => D.formatDate(iso, i18n.lang, { day: 'numeric', month: 'short' });
const planName = (p) => (p ? (p.customName || t(`plan.${p.id}`)) : '—');
const firstName = (n) => String(n).split(' ')[0];
const fmtPhone = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length === 10 ? `${d.slice(0, 5)} ${d.slice(5)}` : p; };
const nextNo = (kind) => { C.d.counters[kind] = (C.d.counters[kind] || 0) + 1; return C.d.counters[kind]; };
const newReceiptNo = () => `IC-${TODAY.slice(0, 4)}-${String(nextNo('receipt')).padStart(4, '0')}`;
const uidL = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

function statusChip(s) {
  switch (s.status) {
    case 'active': return `<span class="chip ok">${t('st.active')}</span>`;
    case 'due': return `<span class="chip warn">${s.daysLeft === 0 ? t('st.dueToday') : t('st.dueIn', { n: s.daysLeft })}</span>`;
    case 'overdue': return `<span class="chip danger">${t('st.late', { n: s.daysLate })}</span>`;
    case 'expired': return `<span class="chip danger plain">${t('st.expired')}</span>`;
    case 'frozen': return `<span class="chip info">${t('st.frozen')}</span>`;
    case 'left': return `<span class="chip">${t('st.left')}</span>`;
    default: return `<span class="chip info">${t('st.new')}</span>`;
  }
}
function expiryLine(s) {
  if (!s.expiry) return t('m.noPlan');
  if (s.status === 'expired' || s.status === 'overdue') return t('m.endedOn', { date: fdShort(s.expiry) });
  return t('m.validTill', { date: fdShort(s.expiry) });
}

// ---------- messages ----------
function msgVars(m, lang) {
  const s = S(m.id);
  const lv = L.lastVisit(C.attIndex.get(m.id));
  return {
    name: firstName(m.name), gym: C.s.gymName, plan: s.plan ? (s.plan.customName || i18n_t(lang, `plan.${s.plan.id}`)) : '',
    date: s.expiry ? D.formatDate(s.expiry, lang) : '', amount: money(L.amountDue(s, C.s)), days: s.status === 'overdue' || s.status === 'expired' ? s.daysLate : (lv ? D.diffDays(lv, TODAY) : C.s.inactiveDays),
  };
}
function i18n_t(lang, key, vars) {
  const dict = GYM_APP_I18N[lang] || GYM_APP_I18N.en;
  const s = dict[key] !== undefined ? dict[key] : GYM_APP_I18N.en[key];
  return vars ? waMessage(s, vars) : s;
}
function typeFor(m) {
  const s = S(m.id);
  if (s.status === 'due') return 'due';
  if (s.status === 'overdue' || s.balance > 0) return 'overdue';
  if (s.status === 'expired') return 'expired';
  return 'hello';
}
function reminderText(m, type, lang = ui.msgLang || i18n.lang) { return i18n_t(lang, `msg.${type}`, msgVars(m, lang)); }
function waFor(m, type) { return waLink(m.phone, reminderText(m, type || typeFor(m))); }

// ---------- shell ----------
const NAV = [
  ['', 'home', 'nav.home'], ['members', 'users', 'nav.members'], ['checkin', 'checkin', 'nav.checkin'],
  ['reminders', 'bell', 'nav.reminders'], ['reports', 'chart', 'nav.reports'],
];
function renderNav(active) {
  $('#nav').innerHTML = NAV.map(([r, ic, k]) => `<a href="#/${r}" ${active === r ? 'aria-current="page"' : ''}>${icon(ic)}<span>${esc(t(k))}</span></a>`).join('');
}
function fabLink(href, label, ic = 'plus') { return `<a id="fab" class="fab" href="${href}">${icon(ic)}<span>${esc(label)}</span></a>`; }
function fabBtn(act, label, ic, data = '') { return `<button id="fab" type="button" class="fab" data-act="${act}" ${data}>${icon(ic)}<span>${esc(label)}</span></button>`; }

function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, q] = h.split('?');
  const [name, arg] = path.split('/');
  return { name: name || '', arg: arg ? decodeURIComponent(arg) : '', params: new URLSearchParams(q || '') };
}

function render() {
  compute();
  const { name, arg, params } = parseHash();
  const views = { '': vDashboard, members: vMembers, m: vProfile, add: vForm, edit: vForm, checkin: vCheckin, reminders: vReminders, reports: vReports, settings: vSettings };
  const fn = views[name] || vDashboard;
  const navKey = name === 'm' || name === 'add' || name === 'edit' ? 'members' : name === 'settings' ? '' : name;
  renderNav(navKey);
  const out = fn(arg, params);
  view.innerHTML = out.html;
  const f = document.getElementById('fab');
  if (out.fab) { f.outerHTML = out.fab; } else { f.outerHTML = '<a id="fab" class="fab" hidden></a>'; }
  $('#brand-name').textContent = C.s.gymName;
  $('#brand-sub').textContent = fd(TODAY, { weekday: 'long', day: 'numeric', month: 'long' });
  if (out.mount) out.mount();
  i18n.apply();
}
let lastRoute = '';
function onRoute() {
  const r = location.hash;
  render();
  if (r !== lastRoute) { window.scrollTo(0, 0); view.focus({ preventScroll: true }); }
  lastRoute = r;
}

// ---------- Dashboard ----------
function metrics() {
  const { d, s } = C;
  const sums = [...C.summaries.values()];
  const live = sums.filter((x) => ['active', 'due', 'frozen'].includes(x.status));
  const dueWeek = sums.filter((x) => x.expiry && x.daysLeft >= 0 && x.daysLeft <= 7 && x.status !== 'left');
  const overdue = sums.filter((x) => x.status === 'overdue');
  const overdueAmt = overdue.reduce((a, x) => a + L.amountDue(x, s), 0) + live.reduce((a, x) => a + x.balance, 0);
  const todayAtt = d.attendance.filter((a) => a.d === TODAY);
  const mk = D.monthKey(TODAY);
  const lastMk = D.addMonthsKey(mk, -1);
  const coll = d.payments.filter((p) => D.monthKey(p.date) === mk).reduce((a, p) => a + Number(p.amount), 0);
  const collLast = d.payments.filter((p) => D.monthKey(p.date) === lastMk && p.date.slice(8) <= TODAY.slice(8)).reduce((a, p) => a + Number(p.amount), 0);
  const joins = d.members.filter((m) => m.joinDate && D.monthKey(m.joinDate) === mk);
  const expiring = sums.filter((x) => x.expiry && x.daysLeft >= 0 && x.daysLeft <= 30 && x.status !== 'left');
  const inactive = d.members.filter((m) => L.isInactive(S(m.id), C.attIndex.get(m.id), TODAY, s));
  const bdays = d.members.filter((m) => !m.left && L.birthdayIn(m, TODAY, 7));
  return { live, dueWeek, overdue, overdueAmt, todayAtt, coll, collLast, joins, expiring, inactive, bdays };
}
function stat({ href, k, v, sub = '', ic, cls = '' }) {
  return `<a class="stat ${cls}" href="${href}"><span class="ico">${icon(ic)}</span><span class="k">${esc(k)}</span><span class="v">${v}</span>${sub ? `<span class="s">${sub}</span>` : ''}</a>`;
}
function hello() { const h = new Date().getHours(); return h < 12 ? t('dash.morning') : h < 17 ? t('dash.afternoon') : t('dash.evening'); }
function vDashboard() {
  const x = metrics();
  const trend = x.collLast ? Math.round(((x.coll - x.collLast) / x.collLast) * 100) : 0;
  const attention = C.d.members.filter((m) => ['overdue', 'due'].includes(S(m.id).status))
    .sort((a, b) => S(a.id).daysLeft - S(b.id).daysLeft).slice(0, 5);
  const recent = x.todayAtt.slice(-5).reverse();
  return {
    html: `
    <h1 class="view-title">${esc(hello())} 👋 <small class="block">${esc(t('dash.sub'))}</small></h1>
    <div class="stats">
      ${stat({ href: '#/reports', k: t('dash.collection'), v: money(x.coll), sub: x.collLast && trend ? esc(t(trend >= 0 ? 'dash.up' : 'dash.down', { n: Math.abs(trend) })) : '', ic: 'rupee', cls: 'hero' })}
      ${stat({ href: '#/members?f=live', k: t('dash.active'), v: x.live.length, ic: 'users', cls: 'ok' })}
      ${stat({ href: '#/members?s=dueweek', k: t('dash.dueWeek'), v: x.dueWeek.length, ic: 'calendar', cls: 'warn' })}
      ${stat({ href: '#/members?s=dues', k: t('dash.overdueAmt'), v: money(x.overdueAmt), sub: esc(t('dash.overdueN', { n: x.overdue.length })), ic: 'alert', cls: 'danger' })}
      ${stat({ href: '#/checkin', k: t('dash.today'), v: x.todayAtt.length, ic: 'checkin' })}
      ${stat({ href: '#/members?s=newjoins', k: t('dash.joins'), v: x.joins.length, ic: 'plus' })}
      ${stat({ href: '#/members?s=expiring', k: t('dash.expiring'), v: x.expiring.length, sub: esc(t('dash.next30')), ic: 'clock' })}
      ${stat({ href: '#/members?s=inactive', k: t('dash.inactive'), v: x.inactive.length, sub: esc(t('dash.notSeen', { n: C.s.inactiveDays })), ic: 'fire' })}
      ${stat({ href: '#/members?s=birthdays', k: t('dash.bdays'), v: x.bdays.length, ic: 'cake' })}
    </div>
    <h2 class="section-h">${esc(t('dash.attention'))}</h2>
    ${attention.length ? `<div class="list">${attention.map(memberRow).join('')}</div>` : `<p class="empty">${esc(t('dash.allClear'))}</p>`}
    <h2 class="section-h">${esc(t('dash.recent'))}</h2>
    ${recent.length ? `<div class="list">${recent.map((a) => visitRow(a)).join('')}</div>` : `<p class="empty">${esc(t('ci.none'))}</p>`}
    `,
    fab: fabLink('#/add', t('m.add')),
  };
}
function visitRow(a, undo = false) {
  const m = M(a.m);
  if (!m) return '';
  const s = S(m.id);
  return `<div class="row">${avatar(m.name, m.photo, 40)}<a class="main" href="#/m/${m.id}" style="text-decoration:none;color:inherit"><div class="t">${esc(m.name)}</div><div class="sub">${esc(m.id)} · ${esc(a.t)}</div></a><div class="end">${statusChip(s)}${undo ? `<button type="button" class="btn sm ghost" data-act="undo-checkin" data-id="${m.id}" data-t="${a.t}">${icon('undo')}${esc(t('ci.undo'))}</button>` : ''}</div></div>`;
}

// ---------- Members list ----------
function memberRow(m) {
  const s = S(m.id);
  const due = L.amountDue(s, C.s);
  const tel = telLink(m.phone);
  return `<article class="mcard">
    <a class="mlink" href="#/m/${m.id}">${avatar(m.name, m.photo, 46)}
      <span class="main"><span class="t">${esc(m.name)}</span><span class="sub">${esc(m.id)} · ${esc(planName(s.plan))} · ${esc(expiryLine(s))}</span></span>
      <span class="end">${statusChip(s)}${due > 0 && s.status !== 'left' ? `<span class="amt small">${money(due)}</span>` : ''}</span>
    </a>
    <div class="mact">
      ${tel ? `<a class="icon-btn" href="${tel}" aria-label="${esc(t('a.call'))} ${esc(m.name)}">${icon('phone')}</a>` : ''}
      <a class="icon-btn wa" href="${esc(waFor(m))}" target="_blank" rel="noopener" aria-label="WhatsApp ${esc(m.name)}">${icon('wa')}</a>
      <button type="button" class="btn sm secondary" data-act="renew" data-id="${m.id}">${icon('rupee')}${esc(t('a.renew'))}</button>
      <button type="button" class="btn sm" data-act="checkin" data-id="${m.id}">${icon('check')}${esc(t('a.checkin'))}</button>
    </div>
  </article>`;
}
const SPECIAL = {
  live: (m) => ['active', 'due', 'frozen'].includes(S(m.id).status),
  dueweek: (m) => { const s = S(m.id); return s.expiry && s.daysLeft >= 0 && s.daysLeft <= 7 && s.status !== 'left'; },
  dues: (m) => { const s = S(m.id); return s.status === 'overdue' || (s.balance > 0 && s.status !== 'left'); },
  newjoins: (m) => m.joinDate && D.monthKey(m.joinDate) === D.monthKey(TODAY),
  expiring: (m) => { const s = S(m.id); return s.expiry && s.daysLeft >= 0 && s.daysLeft <= 30 && s.status !== 'left'; },
  inactive: (m) => L.isInactive(S(m.id), C.attIndex.get(m.id), TODAY, C.s),
  birthdays: (m) => !m.left && !!L.birthdayIn(m, TODAY, 7),
  balance: (m) => S(m.id).balance > 0,
};
const RANK = { overdue: 0, due: 1, frozen: 2, active: 3, new: 4, expired: 5, left: 6 };
function filteredMembers() {
  const q = ui.q.toLowerCase().replace(/\s+/g, '');
  let list = C.d.members.filter((m) => {
    const s = S(m.id);
    if (ui.special && SPECIAL[ui.special] && !SPECIAL[ui.special](m)) return false;
    if (ui.filter !== 'all' && ui.filter !== s.status) return false;
    if (ui.plan && (!s.plan || s.plan.id !== ui.plan)) return false;
    if (q && !(`${m.name}${m.phone}${m.id}`.toLowerCase().replace(/\s+/g, '').includes(q))) return false;
    return true;
  });
  const by = {
    name: (a, b) => a.name.localeCompare(b.name),
    expiry: (a, b) => (RANK[S(a.id).status] - RANK[S(b.id).status]) || ((S(a.id).expiry || '9') < (S(b.id).expiry || '9') ? -1 : 1),
    joined: (a, b) => ((a.joinDate || '') < (b.joinDate || '') ? 1 : -1),
    balance: (a, b) => L.amountDue(S(b.id), C.s) - L.amountDue(S(a.id), C.s),
  };
  list.sort(by[ui.sort] || by.expiry);
  if (ui.special === 'birthdays') list.sort((a, b) => L.birthdayIn(a, TODAY).inDays - L.birthdayIn(b, TODAY).inDays);
  return list;
}
function vMembers(arg, params) {
  if (params.has('f')) { ui.filter = params.get('f') === 'live' ? 'all' : params.get('f'); ui.special = params.get('f') === 'live' ? 'live' : ''; }
  if (params.has('s')) { ui.special = params.get('s'); ui.filter = 'all'; }
  const counts = {};
  C.d.members.forEach((m) => { const st = S(m.id).status; counts[st] = (counts[st] || 0) + 1; });
  const pills = ['all', 'active', 'due', 'overdue', 'expired', 'frozen', 'left'];
  return {
    html: `
    <h1 class="view-title">${esc(t('nav.members'))} <small>${C.d.members.length}</small></h1>
    <div class="search">${icon('search')}<input id="q" type="search" value="${esc(ui.q)}" placeholder="${esc(t('m.search'))}" aria-label="${esc(t('m.search'))}" autocomplete="off"></div>
    ${ui.special ? `<div class="flex mb"><span class="chip accent plain">${esc(t(`sp.${ui.special}`))}</span><button type="button" class="btn sm ghost" data-act="clear-special">${icon('x')}${esc(t('m.clear'))}</button></div>` : ''}
    <div class="pills" role="group" aria-label="${esc(t('m.status'))}">${pills.map((p) => `<button type="button" class="pill" data-act="filter" data-f="${p}" aria-pressed="${ui.filter === p}">${esc(t(p === 'all' ? 'm.all' : `st.${p === 'due' ? 'dueSoon' : p}`))}<span class="n">${p === 'all' ? C.d.members.length : counts[p] || 0}</span></button>`).join('')}</div>
    <div class="toolbar">
      <label class="sr-only" for="planf">${esc(t('m.plan'))}</label>
      <select id="planf"><option value="">${esc(t('m.allPlans'))}</option>${C.s.plans.map((p) => `<option value="${p.id}" ${ui.plan === p.id ? 'selected' : ''}>${esc(planName(p))}</option>`).join('')}</select>
      <label class="sr-only" for="sortf">${esc(t('m.sort'))}</label>
      <select id="sortf">${['expiry', 'name', 'joined', 'balance'].map((k) => `<option value="${k}" ${ui.sort === k ? 'selected' : ''}>${esc(t(`sort.${k}`))}</option>`).join('')}</select>
    </div>
    <div id="mlist" class="list"></div>`,
    fab: fabLink('#/add', t('m.add')),
    mount() {
      const paint = () => {
        const list = filteredMembers();
        $('#mlist').innerHTML = list.length ? list.map(memberRow).join('') : `<p class="empty"><span class="big">🔍</span>${esc(t('m.noneFound'))}</p>`;
      };
      paint();
      $('#q').addEventListener('input', debounce((e) => { ui.q = e.target.value; paint(); }, 120));
      $('#planf').addEventListener('change', (e) => { ui.plan = e.target.value; paint(); });
      $('#sortf').addEventListener('change', (e) => { ui.sort = e.target.value; paint(); });
      if (params.has('f') || params.has('s')) history.replaceState(null, '', '#/members');
    },
  };
}

// ---------- Profile ----------
function vProfile(id) {
  const m = M(id);
  if (!m) return { html: `<p class="empty">${esc(t('m.notFound'))}</p>` };
  const s = S(id);
  const att = C.attIndex.get(id) || [];
  const lv = L.lastVisit(att);
  const bd = L.birthdayIn(m, TODAY, 7);
  const after = L.visitsAfterExpiry(s, att, TODAY);
  const tel = telLink(m.phone);
  const tabs = [['pay', 'p.payments'], ['att', 'p.attendance'], ['time', 'p.timeline']];
  return {
    html: `
    <a href="#/members" class="btn sm ghost" style="margin-bottom:8px">${icon('back')}${esc(t('a.back'))}</a>
    <section class="card">
      <div class="profile">${avatar(m.name, m.photo, 68)}<div class="grow"><h1>${esc(m.name)}</h1>
        <div class="chips">${statusChip(s)}<span class="chip plain">${esc(m.id)}</span>${s.balance > 0 ? `<span class="chip warn plain">${esc(t('p.balance'))}: ${money(s.balance)}</span>` : ''}${bd ? `<span class="chip accent plain">🎂 ${esc(bd.inDays === 0 ? t('p.bdayToday') : fdShort(bd.date))}</span>` : ''}</div>
        <div class="sub muted small mt" style="margin-top:6px">${esc(fmtPhone(m.phone))}${m.gender ? ` · ${esc(t(`g.${m.gender}`))}` : ''}${m.dob ? ` · ${esc(t('p.age', { n: D.ageOn(m.dob, TODAY) }))}` : ''}</div>
      </div></div>
      ${s.status === 'frozen' ? `<div class="alert mt" style="background:var(--info-bg);border-color:transparent"><span class="ico">❄️</span><div><strong>${esc(t('p.frozenTill', { date: fd(D.addDays(s.frozenBy.from, s.frozenBy.days - 1)) }))}</strong><span class="small">${esc(s.frozenBy.reason || '')}</span></div></div>` : ''}
      ${after.length ? `<div class="alert danger mt"><span class="ico">⚠️</span><div><strong>${esc(t('p.visitedExpired', { n: after.length }))}</strong></div></div>` : ''}
      ${m.left ? `<div class="alert mt"><span class="ico">👋</span><div><strong>${esc(t('p.leftOn', { date: fd(m.leftDate) }))}</strong><span class="small">${esc(m.leftReason || '')}</span></div></div>` : ''}
      <div class="btn-grid mt">
        <button type="button" class="btn primary" data-act="renew" data-id="${id}">${icon('rupee')}${esc(t('a.renewPay'))}</button>
        <button type="button" class="btn" data-act="checkin" data-id="${id}">${icon('check')}${esc(t('a.checkin'))}</button>
        <a class="btn wa" href="${esc(waFor(m))}" target="_blank" rel="noopener">${icon('wa')}WhatsApp</a>
        ${tel ? `<a class="btn" href="${tel}">${icon('phone')}${esc(t('a.call'))}</a>` : ''}
      </div>
    </section>
    <dl class="kv mt">
      ${kv(t('p.plan'), planName(s.plan))}
      ${kv(t('p.expiry'), s.expiry ? fd(s.expiry) : '—')}
      ${kv(s.daysLeft !== null && s.daysLeft < 0 ? t('p.daysLate') : t('p.daysLeft'), s.daysLeft === null ? '—' : Math.abs(s.daysLeft))}
      ${kv(t('p.nextDue'), s.nextDue ? fd(s.nextDue) : '—')}
      ${kv(t('p.balance'), money(s.balance) + (s.credit ? ` (${t('p.credit')} ${money(s.credit)})` : ''))}
      ${kv(t('p.totalPaid'), money(s.totalPaid))}
      ${kv(t('p.lastPay'), s.lastPayment ? `${money(s.lastPayment.amount)} · ${fdShort(s.lastPayment.date)}` : '—')}
      ${kv(t('p.since'), s.memberSince ? fd(s.memberSince) : '—')}
      ${kv(t('p.lastVisit'), lv ? fdShort(lv) : '—')}
      ${kv(t('p.streak'), `${L.streak(att, TODAY)} 🔥`)}
    </dl>
    ${m.notes ? `<p class="card mt small"><strong>${esc(t('f.notes'))}:</strong> ${esc(m.notes)}</p>` : ''}
    <div class="btn-row mt">
      <button type="button" class="btn sm" data-act="freeze" data-id="${id}">${icon('snow')}${esc(t('a.freeze'))}</button>
      <a class="btn sm" href="#/edit/${id}">${icon('edit')}${esc(t('a.edit'))}</a>
      <button type="button" class="btn sm" data-act="statement" data-id="${id}">${icon('print')}${esc(t('a.statement'))}</button>
      <button type="button" class="btn sm ghost" data-act="toggle-left" data-id="${id}">${icon(m.left ? 'undo' : 'logout')}${esc(m.left ? t('a.rejoin') : t('a.markLeft'))}</button>
    </div>
    <div class="tabs mt2" role="tablist">${tabs.map(([k, l]) => `<button type="button" role="tab" data-act="ptab" data-k="${k}" aria-selected="${ui.profileTab === k}">${esc(t(l))}</button>`).join('')}</div>
    <div id="ptab">${ui.profileTab === 'pay' ? payLedger(m, s) : ui.profileTab === 'att' ? attPanel(m, att) : timeline(m, s, att)}</div>`,
    fab: m.left ? '' : fabBtn('renew', t('a.renewPay'), 'rupee', `data-id="${id}"`),
  };
}
const kv = (k, v) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`;
function payLedger(m, s) {
  if (!s.payments.length) return `<p class="empty">${esc(t('p.noPays'))}</p>`;
  return `<div class="list">${s.payments.slice().reverse().map((p) => `
    <div class="row">${icon('receipt')}<div class="main"><div class="t">${money(p.amount)} · ${esc(t(`mode.${p.mode}`))}</div>
    <div class="sub">${esc(fd(p.date))} · ${esc(p.receiptNo)}${p.periodStart ? ` · ${esc(fdShort(p.periodStart))}–${esc(fdShort(p.periodEnd))}` : ''}</div></div>
    <button type="button" class="icon-btn" data-act="receipt" data-pay="${p.id}" aria-label="${esc(t('a.receipt'))}">${icon('print')}</button></div>`).join('')}</div>`;
}
function attPanel(m, att) {
  const mk = ui.calMonth || D.monthKey(TODAY);
  const days = new Set(att.map((a) => a.d));
  const first = `${mk}-01`;
  const lead = (D.weekday(first) + 6) % 7;
  const { y, m: mo } = D.parseISO(first);
  const n = D.daysInMonth(y, mo);
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<span class="d blank"></span>');
  for (let d = 1; d <= n; d++) {
    const iso = D.iso(y, mo, d);
    cells.push(`<span class="d ${days.has(iso) ? 'on' : ''} ${iso === TODAY ? 'today' : ''}" title="${esc(fd(iso))}">${d}</span>`);
  }
  const dows = [1, 2, 3, 4, 5, 6, 0].map((w) => D.formatDate(D.addDays('2026-11-01', w), i18n.lang, { weekday: 'narrow' }));
  return `<section class="card">
    <div class="cal-head"><button type="button" class="icon-btn" data-act="cal" data-d="-1" aria-label="${esc(t('a.prev'))}">${icon('back')}</button>
    <strong>${esc(D.formatMonth(mk, i18n.lang, true))} · ${esc(t('p.visits', { n: L.visitsInMonth(att, mk) }))}</strong>
    <button type="button" class="icon-btn" data-act="cal" data-d="1" aria-label="${esc(t('a.next'))}" style="transform:scaleX(-1)">${icon('back')}</button></div>
    <div class="cal">${dows.map((w) => `<span class="dow">${esc(w)}</span>`).join('')}${cells.join('')}</div>
    <p class="small muted mt">${esc(t('p.totalVisits', { n: att.length }))} · ${esc(t('p.streak'))}: ${L.streak(att, TODAY)} 🔥</p></section>`;
}
function timeline(m, s, att) {
  const ev = [];
  s.periods.forEach((p, i) => ev.push({ d: p.start, cls: 'join', w: i === 0 ? t('tl.joined', { plan: planName(L.planById(C.s, p.planId)) }) : t('tl.renewed', { plan: planName(L.planById(C.s, p.planId)), date: fdShort(p.end) }) }));
  s.payments.forEach((p) => ev.push({ d: p.date, cls: 'pay', w: t('tl.paid', { amount: money(p.amount), mode: t(`mode.${p.mode}`), no: p.receiptNo }) }));
  (m.freezes || []).forEach((f) => ev.push({ d: f.from, cls: 'freeze', w: t('tl.froze', { n: f.days, reason: f.reason || '' }) }));
  (m.reminders || []).forEach((r) => ev.push({ d: r.date, cls: 'warn', w: t('tl.reminded', { type: t(`rq.${r.type}`) }) }));
  att.slice(-12).forEach((a) => ev.push({ d: a.d, cls: 'visit', w: t('tl.visit', { time: a.t }) }));
  if (m.left) ev.push({ d: m.leftDate, cls: 'warn', w: t('tl.left') });
  ev.sort((a, b) => (a.d < b.d ? 1 : -1));
  return `<ol class="timeline card" style="padding-left:28px">${ev.map((e) => `<li class="${e.cls}"><div class="when">${esc(fd(e.d))}</div><div class="what">${esc(e.w)}</div></li>`).join('')}</ol>`;
}

// ---------- Add / edit member ----------
function vForm(id) {
  const m = id ? M(id) : null;
  const plans = C.s.plans;
  return {
    html: `
    <a href="${m ? `#/m/${m.id}` : '#/members'}" class="btn sm ghost" style="margin-bottom:8px">${icon('back')}${esc(t('a.back'))}</a>
    <h1 class="view-title">${esc(m ? t('f.editTitle') : t('m.add'))}</h1>
    <form id="mform" class="form card" novalidate>
      <div class="flex">
        <label class="photo-pick" aria-label="${esc(t('f.photo'))}">
          <input type="file" accept="image/*" capture="user" id="photo" class="sr-only">
          <span id="photo-prev">${m && m.photo ? `<img src="${esc(m.photo)}" alt="">` : icon('image')}</span>
        </label>
        <div class="grow"><label class="field"><span>${esc(t('f.name'))} *</span><input name="name" required autocomplete="off" value="${esc(m ? m.name : '')}" ${m ? '' : 'autofocus'}></label></div>
      </div>
      <label class="field"><span>${esc(t('f.phone'))} *</span><input name="phone" type="tel" inputmode="tel" required value="${esc(m ? m.phone : '')}" placeholder="98xxx xxxxx"></label>
      <div class="form">
        <div class="field"><span class="lbl">${esc(t('f.gender'))}</span><div class="seg">${['M', 'F'].map((g) => `<label><input type="radio" name="gender" value="${g}" ${m && m.gender === g ? 'checked' : ''}><span>${esc(t(`g.${g}`))}</span></label>`).join('')}</div></div>
        <label class="field"><span>${esc(t('f.dob'))}</span><input name="dob" type="date" max="${TODAY}" value="${esc(m ? m.dob || '' : '')}"></label>
      </div>
      ${m ? '' : `
      <div class="field"><span class="lbl">${esc(t('f.plan'))}</span><div class="seg plans">${plans.map((p, i) => `<label><input type="radio" name="plan" value="${p.id}" ${i === 0 ? 'checked' : ''}><span>${esc(planName(p))}<small>${money(p.price)}</small></span></label>`).join('')}</div></div>
      <div class="grid-2">
        <label class="field"><span>${esc(t('f.start'))}</span><input name="start" type="date" value="${TODAY}" required></label>
        <label class="field"><span>${esc(t('f.discount'))}</span><input name="discount" type="number" inputmode="numeric" min="0" step="50" value="0"></label>
      </div>
      <p class="small muted" id="exp-preview"></p>
      <label class="field"><span>${esc(t('f.paidNow'))}</span><input name="amount" type="number" inputmode="numeric" min="0" step="50" value="${plans[0].price}"><span class="hint" id="bal-hint"></span></label>
      <div class="field"><span class="lbl">${esc(t('f.mode'))}</span>${modeSeg()}</div>`}
      <label class="field"><span>${esc(t('f.notes'))}</span><textarea name="notes" rows="2">${esc(m ? m.notes || '' : '')}</textarea></label>
      <div class="sheet-actions sticky-save"><button class="btn primary big" type="submit">${icon('check')}${esc(m ? t('a.save') : t('f.addSave'))}</button></div>
    </form>`,
    mount() {
      const form = $('#mform');
      let photo = m ? m.photo || '' : '';
      let amountTouched = false;
      $('#photo').addEventListener('change', async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        photo = await resizeImage(f, 192);
        $('#photo-prev').innerHTML = `<img src="${photo}" alt="">`;
      });
      const upd = () => {
        if (m) return;
        const fdv = formData(form);
        const p = L.planById(C.s, fdv.plan);
        const due = Math.max(0, p.price - (Number(fdv.discount) || 0));
        if (!amountTouched) form.amount.value = due;
        const end = D.isValidISO(fdv.start) ? L.periodEnd({ id: 'x', start: fdv.start, months: p.months }) : null;
        $('#exp-preview').textContent = end ? t('f.expPreview', { date: fd(end) }) : '';
        const bal = due - (Number(form.amount.value) || 0);
        $('#bal-hint').textContent = bal > 0 ? t('f.balLeft', { amount: money(bal) }) : '';
      };
      form.addEventListener('input', (e) => { if (e.target.name === 'amount') amountTouched = true; upd(); });
      upd();
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const v = formData(form);
        if (!v.name) { toast(t('f.needName'), 'danger'); form.name.focus(); return; }
        if (!v.phone || v.phone.replace(/\D/g, '').length < 10) { toast(t('f.needPhone'), 'danger'); form.phone.focus(); return; }
        if (m) {
          store.update(() => { Object.assign(m, { name: v.name, phone: v.phone, gender: v.gender || '', dob: v.dob || '', notes: v.notes, photo }); });
          toast(t('f.saved'), 'ok');
          location.hash = `#/m/${m.id}`;
          return;
        }
        const plan = L.planById(C.s, v.plan);
        const nid = L.nextId('IC', nextNo('member'));
        const member = { id: nid, name: v.name, phone: v.phone, gender: v.gender || '', dob: v.dob || '', photo, joinDate: v.start, notes: v.notes, periods: [], freezes: [], reminders: [], createdAt: TODAY };
        const period = { id: `${nid}-p1`, planId: plan.id, months: plan.months, price: plan.price, discount: Number(v.discount) || 0, lateFee: 0, start: v.start, createdAt: TODAY };
        member.periods.push(period);
        let payment = null;
        const amt = Number(v.amount) || 0;
        if (amt > 0) payment = { id: uidL('pay'), memberId: nid, date: TODAY, amount: amt, mode: v.mode || 'Cash', periodId: period.id, periodStart: period.start, periodEnd: L.periodEnd(period), receiptNo: newReceiptNo(), kind: 'join' };
        store.update((d) => { d.members.push(member); if (payment) d.payments.push(payment); });
        location.hash = `#/m/${nid}`;
        toast(t('f.added', { id: nid }), 'ok');
        if (payment) setTimeout(() => showReceipt(payment.id), 250);
      });
    },
  };
}
function modeSeg(sel = 'Cash') {
  return `<div class="seg">${['Cash', 'UPI', 'Card'].map((x) => `<label><input type="radio" name="mode" value="${x}" ${x === sel ? 'checked' : ''}><span>${esc(t(`mode.${x}`))}</span></label>`).join('')}</div>`;
}

// ---------- Renew / mark paid ----------
function openRenew(id) {
  compute();
  const m = M(id);
  const s = S(id);
  const plan = s.plan || C.s.plans[0];
  const start = L.renewalStart(s, TODAY);
  const late = L.lateFeeFor(s, C.s);
  const hasBal = s.balance > 0;
  const body = `
    ${hasBal ? `<div class="tabs" role="tablist"><button type="button" role="tab" data-mode="renew" aria-selected="true">${esc(t('r.renew'))}</button><button type="button" role="tab" data-mode="bal" aria-selected="false">${esc(t('r.collect', { amount: money(s.balance) }))}</button></div>` : ''}
    <div class="flex mb">${avatar(m.name, m.photo, 40)}<div class="grow"><strong>${esc(m.name)}</strong><div class="small muted">${esc(expiryLine(s))} ${statusChip(s)}</div></div></div>
    <form id="rform" class="form" novalidate>
      <div data-part="renew" class="form">
        <div class="field"><span class="lbl">${esc(t('f.plan'))}</span><div class="seg plans">${C.s.plans.map((p) => `<label><input type="radio" name="plan" value="${p.id}" ${p.id === plan.id ? 'checked' : ''}><span>${esc(planName(p))}<small>${money(p.price)}</small></span></label>`).join('')}</div></div>
        <div class="grid-2">
          <label class="field"><span>${esc(t('r.from'))}</span><input name="start" type="date" value="${start}"></label>
          <label class="field"><span>${esc(t('f.discount'))}</span><input name="discount" type="number" inputmode="numeric" min="0" step="50" value="0"></label>
        </div>
        <label class="field"><span>${esc(t('r.lateFee'))}${late ? ` <span class="chip danger plain">${esc(t('st.late', { n: s.daysLate }))}</span>` : ''}</span><input name="lateFee" type="number" inputmode="numeric" min="0" step="50" value="${late}"></label>
        <p class="small muted" id="r-why">${esc(start === TODAY ? t('r.whyToday') : t('r.whyContinue', { date: fd(start) }))}</p>
      </div>
      <div class="card" style="background:var(--surface-2)"><div class="flex between"><span>${esc(t('r.totalDue'))}</span><strong class="num" id="r-total"></strong></div><div class="small muted" id="r-break"></div></div>
      <label class="field"><span>${esc(t('r.payingNow'))}</span><input name="amount" type="number" inputmode="numeric" min="0" step="50" autofocus><span class="hint" id="r-rem"></span></label>
      <div class="field"><span class="lbl">${esc(t('f.mode'))}</span>${modeSeg('UPI')}</div>
      <div class="sheet-actions"><button type="submit" class="btn primary big">${icon('check')}<span id="r-btn">${esc(t('r.save'))}</span></button></div>
    </form>`;
  const sh = sheet({ title: t('a.renewPay'), body });
  const form = $('#rform', sh.el);
  let mode = 'renew';
  let touched = false;
  const calc = () => {
    const v = formData(form);
    if (mode === 'bal') return { due: s.balance, end: s.expiry, text: t('r.balOnly') };
    const p = L.planById(C.s, v.plan);
    const st = D.isValidISO(v.start) ? v.start : start;
    const r = L.makeRenewal({ summary: s, plan: p, today: TODAY, start: st, discount: v.discount, lateFee: v.lateFee, amount: 0, ids: { period: 'x', payment: 'y', receipt: 'z' } });
    const parts = [`${planName(p)} ${money(p.price)}`];
    if (Number(v.discount)) parts.push(`− ${t('f.discount')} ${money(v.discount)}`);
    if (Number(v.lateFee)) parts.push(`+ ${t('r.lateFee')} ${money(v.lateFee)}`);
    if (s.balance) parts.push(`+ ${t('r.oldBal')} ${money(s.balance)}`);
    if (s.credit) parts.push(`− ${t('p.credit')} ${money(s.credit)}`);
    return { due: r.due, end: r.end, text: `${parts.join(' ')} · ${t('r.newExpiry', { date: fd(r.end) })}` };
  };
  const upd = () => {
    const c = calc();
    if (!touched) form.amount.value = c.due;
    $('#r-total', sh.el).textContent = money(c.due);
    $('#r-break', sh.el).textContent = c.text;
    const rem = c.due - (Number(form.amount.value) || 0);
    $('#r-rem', sh.el).textContent = rem > 0 ? t('f.balLeft', { amount: money(rem) }) : '';
  };
  form.addEventListener('input', (e) => { if (e.target.name === 'amount') touched = true; upd(); });
  sh.el.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.mode; touched = false;
    sh.el.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    $('[data-part="renew"]', sh.el).hidden = mode === 'bal';
    $('#r-btn', sh.el).textContent = mode === 'bal' ? t('r.saveBal') : t('r.save');
    upd();
  }));
  upd();
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = formData(form);
    let payment = null;
    const ids = { period: `${id}-p${(m.periods || []).length + 1}-${Date.now().toString(36)}`, payment: uidL('pay'), receipt: '' };
    if (mode === 'bal') {
      ids.receipt = newReceiptNo();
      payment = L.makeBalancePayment({ summary: s, today: TODAY, amount: v.amount, mode: v.mode, ids });
      if (!payment) { toast(t('r.nothing'), 'danger'); return; }
      store.update((d) => d.payments.push(payment));
    } else {
      const p = L.planById(C.s, v.plan);
      const amt = Number(v.amount) || 0;
      if (amt > 0) ids.receipt = newReceiptNo();
      const r = L.makeRenewal({ summary: s, plan: p, today: TODAY, start: D.isValidISO(v.start) ? v.start : start, discount: v.discount, lateFee: v.lateFee, amount: amt, mode: v.mode, ids });
      payment = r.payment;
      store.update((d) => { m.periods.push(r.period); if (m.left) { m.left = false; } if (payment) d.payments.push(payment); });
      toast(t('r.done', { date: fd(r.end) }), 'ok');
    }
    sh.close();
    render();
    if (payment) setTimeout(() => showReceipt(payment.id), 200);
  });
}

// ---------- Receipt ----------
function receiptData(payId) {
  const p = C.d.payments.find((x) => x.id === payId);
  const m = M(p.memberId);
  compute();
  const s = S(m.id);
  return { p, m, s };
}
function receiptHTML({ p, m, s }) {
  return `<div class="doc"><div class="doc-head"><div><h1>${esc(C.s.gymName)}</h1><div>${esc(t('rc.tag'))}</div></div><div style="text-align:right"><strong>${esc(t('rc.title'))}</strong><br>${esc(p.receiptNo)}<br>${esc(fd(p.date))}</div></div>
  <table><tbody>
  <tr><th>${esc(t('rc.member'))}</th><td>${esc(m.name)} (${esc(m.id)})</td></tr>
  <tr><th>${esc(t('f.phone'))}</th><td>${esc(fmtPhone(m.phone))}</td></tr>
  ${p.periodStart ? `<tr><th>${esc(t('rc.period'))}</th><td>${esc(fd(p.periodStart))} – ${esc(fd(p.periodEnd))}</td></tr>` : ''}
  <tr><th>${esc(t('f.mode'))}</th><td>${esc(t(`mode.${p.mode}`))}</td></tr>
  <tr class="tot"><td>${esc(t('rc.amount'))}</td><td class="r">${money(p.amount)}</td></tr>
  <tr><th>${esc(t('rc.balance'))}</th><td class="r">${money(s.balance)}</td></tr>
  </tbody></table><p><span class="stamp">${esc(t('demo.badge'))}</span> ${esc(t('rc.thanks'))}</p></div>`;
}
function receiptCanvas({ p, m, s }) {
  const W = 720, H = 900, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const font = (w, sz) => `${w} ${sz}px Inter, "Noto Sans Devanagari", "Noto Sans Gurmukhi", sans-serif`;
  x.fillStyle = '#0f1115'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#c6ff3d'; x.fillRect(0, 0, W, 14);
  x.fillStyle = '#fff'; x.font = font(800, 40); x.fillText(C.s.gymName, 48, 90);
  x.fillStyle = '#9aa3b2'; x.font = font(600, 24); x.fillText(`${t('rc.title')} · ${p.receiptNo}`, 48, 132);
  x.fillStyle = '#c6ff3d'; x.font = font(800, 84); x.fillText(money(p.amount), 48, 260);
  x.fillStyle = '#fff'; x.font = font(600, 26); x.fillText(`✓ ${t('rc.received')} · ${t(`mode.${p.mode}`)}`, 48, 310);
  const rows = [[t('rc.member'), `${m.name} (${m.id})`], [t('rc.date'), fd(p.date)], ...(p.periodStart ? [[t('rc.period'), `${fd(p.periodStart)} – ${fd(p.periodEnd)}`]] : []), [t('rc.balance'), money(s.balance)]];
  let y = 400;
  rows.forEach(([k, v]) => {
    x.fillStyle = '#9aa3b2'; x.font = font(600, 22); x.fillText(k, 48, y);
    x.fillStyle = '#fff'; x.font = font(700, 30);
    wrapText(x, v, W - 96).forEach((ln, i) => x.fillText(ln, 48, y + 40 + i * 36));
    y += 110;
  });
  x.fillStyle = '#ffd84d'; x.font = font(700, 20); x.fillText(t('demo.badge'), 48, H - 50);
  x.fillStyle = '#9aa3b2'; x.font = font(600, 20); x.fillText(t('rc.thanks'), 48, H - 80);
  return c;
}
function showReceipt(payId) {
  const data = receiptData(payId);
  const { p, m, s } = data;
  const text = i18n_t(ui.msgLang || i18n.lang, 'msg.receipt', { gym: C.s.gymName, no: p.receiptNo, name: m.name, amount: money(p.amount), mode: t(`mode.${p.mode}`), date: p.periodEnd ? fd(p.periodEnd) : '—', balance: money(s.balance) });
  const sh = sheet({
    title: t('rc.title'),
    body: `<div class="preview-doc">${receiptHTML(data)}</div>
    <div class="btn-grid mt"><button type="button" class="btn" data-x="print">${icon('print')}${esc(t('a.print'))}</button><button type="button" class="btn" data-x="img">${icon('share')}${esc(t('a.shareImg'))}</button></div>
    <a class="btn wa block mt" href="${esc(waLink(m.phone, text))}" target="_blank" rel="noopener">${icon('wa')}${esc(t('a.sendReceipt'))}</a>`,
  });
  sh.el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-x]');
    if (!b) return;
    if (b.dataset.x === 'print') printHTML(receiptHTML(data));
    else { const r = await shareCanvas(receiptCanvas(data), `${p.receiptNo}.png`, t('rc.title')); if (r === 'downloaded') toast(t('rc.saved'), 'ok'); }
  });
}
function statementHTML(m) {
  const s = S(m.id);
  const att = C.attIndex.get(m.id) || [];
  return `<div class="doc"><div class="doc-head"><div><h1>${esc(C.s.gymName)}</h1><div>${esc(t('st.title'))}</div></div><div style="text-align:right">${esc(fd(TODAY))}<br><span class="stamp">${esc(t('demo.badge'))}</span></div></div>
  <p><strong>${esc(m.name)}</strong> (${esc(m.id)}) · ${esc(fmtPhone(m.phone))}<br>${esc(t('p.since'))}: ${esc(fd(s.memberSince))} · ${esc(t('p.visitsTotal'))}: ${att.length}</p>
  <h3>${esc(t('st.periods'))}</h3><table><thead><tr><th>${esc(t('p.plan'))}</th><th>${esc(t('rc.period'))}</th><th class="r">${esc(t('st.fee'))}</th></tr></thead><tbody>
  ${s.periods.map((p) => `<tr><td>${esc(planName(L.planById(C.s, p.planId)))}</td><td>${esc(fd(p.start))} – ${esc(fd(p.end))}</td><td class="r">${money(p.billed)}${p.discount ? ` <small>(−${money(p.discount)})</small>` : ''}${p.lateFee ? ` <small>(+${money(p.lateFee)})</small>` : ''}</td></tr>`).join('')}
  </tbody></table>
  <h3>${esc(t('p.payments'))}</h3><table><thead><tr><th>${esc(t('rc.date'))}</th><th>${esc(t('rc.no'))}</th><th>${esc(t('f.mode'))}</th><th class="r">${esc(t('rc.amount'))}</th></tr></thead><tbody>
  ${s.payments.map((p) => `<tr><td>${esc(fd(p.date))}</td><td>${esc(p.receiptNo)}</td><td>${esc(t(`mode.${p.mode}`))}</td><td class="r">${money(p.amount)}</td></tr>`).join('')}
  <tr class="tot"><td colspan="3">${esc(t('p.totalPaid'))}</td><td class="r">${money(s.totalPaid)}</td></tr>
  <tr><td colspan="3">${esc(t('st.billed'))}</td><td class="r">${money(s.totalBilled)}</td></tr>
  <tr class="tot"><td colspan="3">${esc(t('p.balance'))}</td><td class="r">${money(s.balance)}</td></tr></tbody></table>
  ${(m.freezes || []).length ? `<h3>${esc(t('a.freeze'))}</h3><ul>${m.freezes.map((f) => `<li>${esc(fd(f.from))} · ${f.days} ${esc(t('u.days'))} ${esc(f.reason || '')}</li>`).join('')}</ul>` : ''}
  <p>${esc(t('p.expiry'))}: <strong>${esc(s.expiry ? fd(s.expiry) : '—')}</strong></p></div>`;
}

// ---------- Freeze ----------
function openFreeze(id) {
  const m = M(id);
  const s = S(id);
  if (!s.expiry || s.daysLeft < 0) { toast(t('fz.notActive'), 'danger'); return; }
  const sh = sheet({
    title: t('a.freeze'),
    body: `<p class="muted small">${esc(t('fz.help'))}</p>
    <form id="fzf" class="form">
      <label class="field"><span>${esc(t('fz.from'))}</span><input type="date" name="from" value="${TODAY}" min="${TODAY}" max="${s.expiry}"></label>
      <div class="field"><span class="lbl">${esc(t('fz.days'))}</span><div class="seg">${[7, 15, 30].map((n, i) => `<label><input type="radio" name="preset" value="${n}" ${i === 0 ? 'checked' : ''}><span>${n} ${esc(t('u.days'))}</span></label>`).join('')}</div></div>
      <label class="field"><span>${esc(t('fz.custom'))}</span><input type="number" inputmode="numeric" name="days" min="1" max="120" value="7"></label>
      <label class="field"><span>${esc(t('fz.reason'))}</span><input name="reason" placeholder="${esc(t('fz.reasonPh'))}"></label>
      <div class="alert ok"><span class="ico">❄️</span><div><strong id="fz-new"></strong></div></div>
      ${(m.freezes || []).length ? `<div><span class="lbl">${esc(t('fz.history'))}</span><ul class="small">${m.freezes.map((f) => `<li>${esc(fd(f.from))} · ${f.days} ${esc(t('u.days'))} ${esc(f.reason || '')}</li>`).join('')}</ul></div>` : ''}
      <div class="sheet-actions"><button class="btn primary big" type="submit">${icon('snow')}${esc(t('fz.save'))}</button></div>
    </form>`,
  });
  const f = $('#fzf', sh.el);
  const upd = (e) => {
    if (e && e.target.name === 'preset') f.days.value = e.target.value;
    $('#fz-new', sh.el).textContent = t('fz.newExp', { date: fd(D.addDays(s.expiry, Number(f.days.value) || 0)) });
  };
  f.addEventListener('input', upd);
  upd();
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = formData(f);
    try {
      const fz = L.makeFreeze({ summary: s, from: v.from || TODAY, days: v.days, reason: v.reason, id: uidL('fz') });
      store.update(() => m.freezes.push(fz));
      sh.close();
      render();
      toast(t('fz.done', { date: fd(S(id).expiry) }), 'ok');
    } catch { toast(t('fz.notActive'), 'danger'); }
  });
}

// ---------- Check-in ----------
function checkin(id, force = false) {
  compute();
  const m = M(id);
  const s = S(id);
  const att = C.attIndex.get(id) || [];
  const already = att.find((a) => a.d === TODAY);
  if (already) { toast(t('ci.already', { name: firstName(m.name), time: already.t }), ''); return; }
  if (!force && (!s.isPlanValidToday || s.status === 'frozen' || m.left)) {
    const msg = m.left ? t('ci.wLeft') : s.status === 'frozen' ? t('ci.wFrozen') : !s.expiry ? t('ci.wNoPlan') : t('ci.wExpired', { date: fd(s.expiry), n: s.daysLate });
    const sh = sheet({
      title: t('ci.warnTitle'),
      body: `<div class="alert danger"><span class="ico">⛔</span><div><strong>${esc(m.name)}</strong>${esc(msg)}</div></div>
      ${s.balance || s.plan ? `<p class="mt">${esc(t('ci.dueNow'))}: <strong>${money(L.amountDue(s, C.s))}</strong></p>` : ''}
      <div class="btn-row mt"><button type="button" class="btn primary big" data-x="renew">${icon('rupee')}${esc(t('a.renewPay'))}</button><button type="button" class="btn big" data-x="anyway">${esc(t('ci.anyway'))}</button></div>`,
    });
    sh.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-x]');
      if (!b) return;
      sh.close();
      if (b.dataset.x === 'renew') openRenew(id); else checkin(id, true);
    });
    return;
  }
  store.update((d) => d.attendance.push({ m: id, d: TODAY, t: D.nowTime() }));
  compute();
  const st = L.streak(C.attIndex.get(id), TODAY);
  toast(`✓ ${t('ci.done', { name: firstName(m.name) })}${st > 1 ? ` · ${t('ci.streak', { n: st })} 🔥` : ''}`, 'ok');
  if (s.status === 'due') setTimeout(() => toast(t('ci.dueReminder', { n: s.daysLeft }), ''), 2700);
  render();
}
function vCheckin() {
  const todayList = C.d.attendance.filter((a) => a.d === TODAY).slice().reverse();
  const inactive = C.d.members.filter((m) => L.isInactive(S(m.id), C.attIndex.get(m.id), TODAY, C.s));
  const expVisitors = C.d.members.filter((m) => L.visitsAfterExpiry(S(m.id), C.attIndex.get(m.id), TODAY).length);
  const tabs = [['today', t('ci.today', { n: todayList.length })], ['inactive', t('ci.inactive', { n: inactive.length })], ['expvis', t('ci.expVisitors', { n: expVisitors.length })]];
  let panel = '';
  if (ui.checkTab === 'today') panel = todayList.length ? `<div class="list">${todayList.map((a) => visitRow(a, true)).join('')}</div>` : `<p class="empty">${esc(t('ci.none'))}</p>`;
  if (ui.checkTab === 'inactive') panel = `<p class="small muted">${esc(t('ci.inactiveHelp', { n: C.s.inactiveDays }))}</p>` + (inactive.length ? `<div class="list">${inactive.map((m) => { const lv = L.lastVisit(C.attIndex.get(m.id)); return `<div class="row">${avatar(m.name, m.photo, 40)}<a class="main" href="#/m/${m.id}" style="color:inherit;text-decoration:none"><div class="t">${esc(m.name)}</div><div class="sub">${esc(lv ? t('ci.lastSeen', { n: D.diffDays(lv, TODAY) }) : t('ci.never'))}</div></a><a class="icon-btn wa" target="_blank" rel="noopener" href="${esc(waFor(m, 'inactive'))}" aria-label="WhatsApp">${icon('wa')}</a></div>`; }).join('')}</div>` : `<p class="empty">${esc(t('ci.noneInactive'))}</p>`);
  if (ui.checkTab === 'expvis') panel = `<p class="small muted">${esc(t('ci.expHelp'))}</p>` + (expVisitors.length ? `<div class="list">${expVisitors.map((m) => { const s = S(m.id); const v = L.visitsAfterExpiry(s, C.attIndex.get(m.id), TODAY); return `<div class="row">${avatar(m.name, m.photo, 40)}<a class="main" href="#/m/${m.id}" style="color:inherit;text-decoration:none"><div class="t">${esc(m.name)}</div><div class="sub">${esc(t('ci.expLine', { n: v.length, date: fdShort(s.expiry) }))}</div></a><button type="button" class="btn sm secondary" data-act="renew" data-id="${m.id}">${esc(t('a.renew'))}</button></div>`; }).join('')}</div>` : `<p class="empty">${esc(t('ci.noneExp'))}</p>`);
  return {
    html: `
    <h1 class="view-title">${esc(t('nav.checkin'))} <small>${esc(fd(TODAY, { weekday: 'short', day: 'numeric', month: 'short' }))}</small></h1>
    <div class="search big-search">${icon('search')}<input id="ciq" type="search" inputmode="search" placeholder="${esc(t('ci.search'))}" aria-label="${esc(t('ci.search'))}" autocomplete="off" enterkeyhint="go"></div>
    <div id="ci-results" class="ci-results" aria-live="polite"></div>
    <div class="tabs mt" role="tablist">${tabs.map(([k, l]) => `<button type="button" role="tab" data-act="ctab" data-k="${k}" aria-selected="${ui.checkTab === k}">${esc(l)}</button>`).join('')}</div>
    ${panel}`,
    mount() {
      const q = $('#ciq');
      const res = $('#ci-results');
      const paint = () => {
        const v = q.value.trim().toLowerCase().replace(/\s+/g, '');
        if (!v) {
          // Show likely visitors: members who usually come around this hour and have not checked in yet
          const doneToday = new Set(todayList.map((a) => a.m));
          const sug = C.d.members.filter((m) => !m.left && !doneToday.has(m.id) && S(m.id).isPlanValidToday)
            .map((m) => ({ m, n: (C.attIndex.get(m.id) || []).filter((a) => D.diffDays(a.d, TODAY) <= 14).length }))
            .sort((a, b) => b.n - a.n).slice(0, 6).map((x) => x.m);
          res.innerHTML = sug.length ? `<p class="section-h" style="margin-top:4px">${esc(t('ci.suggest'))}</p><div class="ci-grid">${sug.map(ciBtn).join('')}</div>` : '';
          return;
        }
        const hits = C.d.members.filter((m) => `${m.name}${m.phone}${m.id}`.toLowerCase().replace(/\s+/g, '').includes(v)).slice(0, 8);
        res.innerHTML = hits.length ? `<div class="ci-grid">${hits.map(ciBtn).join('')}</div>` : `<p class="empty">${esc(t('m.noneFound'))} <a href="#/add">${esc(t('m.add'))}</a></p>`;
      };
      q.addEventListener('input', paint);
      q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const first = res.querySelector('[data-act="checkin"]'); if (first) { first.click(); q.value = ''; } } });
      paint();
    },
  };
}
function ciBtn(m) {
  const s = S(m.id);
  const done = (C.attIndex.get(m.id) || []).some((a) => a.d === TODAY);
  return `<button type="button" class="ci-btn ${done ? 'done' : ''} ${s.isPlanValidToday ? '' : 'bad'}" data-act="checkin" data-id="${m.id}">${avatar(m.name, m.photo, 48)}<span class="main"><span class="t">${esc(m.name)}</span><span class="sub">${esc(m.id)} · ${esc(m.phone.slice(-4).padStart(m.phone.length > 4 ? 6 : 4, '•'))}</span></span>${done ? `<span class="chip ok">${esc(t('ci.inToday'))}</span>` : statusChip(s)}</button>`;
}

// ---------- Reminders ----------
function vReminders() {
  const qs = L.reminderQueues({ members: C.d.members, summaries: C.summaries, attIndex: C.attIndex, settings: C.s, today: TODAY });
  const type = ui.remType;
  const list = qs[type];
  const pending = list.filter((m) => !L.remindedToday(m, type, TODAY));
  const lang = ui.msgLang || i18n.lang;
  return {
    html: `
    <h1 class="view-title">${esc(t('nav.reminders'))}</h1>
    <div class="alert"><span class="ico">💬</span><div class="small">${esc(t('rm.honest'))}</div></div>
    <div class="pills mt" role="group">${L.REMINDER_TYPES.map((k) => `<button type="button" class="pill" data-act="rtype" data-k="${k}" aria-pressed="${type === k}">${esc(t(`rq.${k}`))}<span class="n">${qs[k].filter((m) => !L.remindedToday(m, k, TODAY)).length}/${qs[k].length}</span></button>`).join('')}</div>
    <div class="flex between wrap mb"><span class="small muted">${esc(t('rm.msgLang'))}</span><div class="lang-mini" role="group">${['en', 'hi', 'pa'].map((l) => `<button type="button" class="pill" data-act="mlang" data-l="${l}" aria-pressed="${lang === l}" lang="${l}">${l === 'en' ? 'English' : l === 'hi' ? 'हिंदी' : 'ਪੰਜਾਬੀ'}</button>`).join('')}</div></div>
    ${list.length ? `<div class="list">${list.map((m) => remRow(m, type)).join('')}</div>` : `<p class="empty"><span class="big">✅</span>${esc(t('rm.empty'))}</p>`}
    <details class="card mt"><summary><strong>${esc(t('rm.preview'))}</strong></summary>${list[0] ? `<div class="msg-preview" lang="${lang}">${esc(reminderText(list[0], type, lang))}</div>` : ''}</details>`,
    fab: pending.length ? fabBtn('walk', t('rm.walk', { n: pending.length }), 'wa') : '',
  };
}
function remRow(m, type) {
  const s = S(m.id);
  const done = L.remindedToday(m, type, TODAY);
  const bd = type === 'birthday' ? L.birthdayIn(m, TODAY, 7) : null;
  const line = type === 'birthday' ? (bd.inDays === 0 ? t('p.bdayToday') : t('rm.bdayIn', { date: fdShort(bd.date), n: bd.inDays }))
    : type === 'inactive' ? (() => { const lv = L.lastVisit(C.attIndex.get(m.id)); return lv ? t('ci.lastSeen', { n: D.diffDays(lv, TODAY) }) : t('ci.never'); })()
      : `${money(L.amountDue(s, C.s))} · ${expiryLine(s)}`;
  return `<div class="row ${done ? 'is-done' : ''}">${avatar(m.name, m.photo, 42)}<a class="main" href="#/m/${m.id}" style="color:inherit;text-decoration:none"><div class="t">${esc(m.name)}</div><div class="sub">${esc(line)}</div></a>
  ${done ? `<span class="chip ok">${esc(t('rm.done'))}</span>` : `<a class="btn sm wa" href="${esc(waLink(m.phone, reminderText(m, type)))}" target="_blank" rel="noopener" data-act="reminded" data-id="${m.id}" data-k="${type}">${icon('wa')}${esc(t('rm.send'))}</a>`}</div>`;
}
function markReminded(id, type) {
  const m = M(id);
  store.update(() => { m.reminders = (m.reminders || []).concat({ date: TODAY, type }).slice(-30); });
}
function walkQueue() {
  const type = ui.remType;
  const qs = L.reminderQueues({ members: C.d.members, summaries: C.summaries, attIndex: C.attIndex, settings: C.s, today: TODAY });
  const queue = qs[type].filter((m) => !L.remindedToday(m, type, TODAY));
  let i = 0;
  const sh = sheet({ title: t('rm.walkTitle', { type: t(`rq.${type}`) }), body: '<div id="walk"></div>', onClose: () => render() });
  const paint = () => {
    const box = $('#walk', sh.el);
    if (i >= queue.length) {
      box.innerHTML = `<div class="queue-card"><div style="font-size:48px">🎉</div><div class="big-name">${esc(t('rm.allDone'))}</div><p class="muted">${esc(t('rm.allDoneSub', { n: queue.length }))}</p><button type="button" class="btn primary big block" data-w="close">${esc(t('a.done'))}</button></div>`;
      return;
    }
    const m = queue[i];
    const text = reminderText(m, type);
    box.innerHTML = `<div class="progress" aria-label="${i + 1}/${queue.length}"><span style="width:${(i / queue.length) * 100}%"></span></div>
      <div class="queue-card">${avatar(m.name, m.photo, 64).replace('class="avatar"', 'class="avatar" style="margin:0 auto"')}
      <div class="big-name">${esc(m.name)}</div><div class="muted small">${i + 1} / ${queue.length} · ${esc(fmtPhone(m.phone))}</div>
      <div class="msg-preview">${esc(text)}</div>
      <a class="btn wa big block" href="${esc(waLink(m.phone, text))}" target="_blank" rel="noopener" data-w="send">${icon('wa')}${esc(t('rm.openWa'))}</a>
      <button type="button" class="btn ghost block mt" data-w="skip">${esc(t('rm.skip'))}</button></div>`;
  };
  sh.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-w]');
    if (!b) return;
    if (b.dataset.w === 'close') { sh.close(); return; }
    if (b.dataset.w === 'send') { markReminded(queue[i].id, type); compute(); }
    i++;
    setTimeout(paint, b.dataset.w === 'send' ? 300 : 0);
  });
  paint();
}

// ---------- Reports ----------
function vReports() {
  const n = ui.reportMonths;
  const months = L.monthlyCollection(C.d.payments, TODAY, n);
  const thisM = months[months.length - 1].total;
  const avg = Math.round(months.slice(0, -1).reduce((a, x) => a + x.total, 0) / Math.max(1, n - 1));
  const mk = D.monthKey(TODAY);
  const modes = ['Cash', 'UPI', 'Card'].map((x) => ({ label: t(`mode.${x}`), value: C.d.payments.filter((p) => D.monthKey(p.date) === mk && p.mode === x).reduce((a, p) => a + Number(p.amount), 0) }));
  const planMix = C.s.plans.map((p) => ({ label: planName(p), value: C.d.members.filter((m) => { const s = S(m.id); return s.plan && s.plan.id === p.id && ['active', 'due', 'frozen'].includes(s.status); }).length }));
  const dues = C.d.members.filter((m) => SPECIAL.dues(m)).sort((a, b) => L.amountDue(S(b.id), C.s) - L.amountDue(S(a.id), C.s));
  const duesTotal = dues.reduce((a, m) => a + L.amountDue(S(m.id), C.s), 0);
  const leftList = C.d.members.filter((m) => m.left || (S(m.id).status === 'expired' && S(m.id).daysLate > 30));
  return {
    html: `
    <h1 class="view-title">${esc(t('nav.reports'))}</h1>
    <section class="card">
      <div class="flex between wrap"><div><div class="small muted">${esc(t('rp.thisMonth'))}</div><div class="big-num">${money(thisM)}</div><div class="small muted">${esc(t('rp.avg', { amount: money(avg) }))}</div></div>
      <div class="seg" style="min-width:210px">${[6, 12].map((x) => `<label><input type="radio" name="rm" value="${x}" data-act="rmonths" ${n === x ? 'checked' : ''}><span>${x} ${esc(t('u.months'))}</span></label>`).join('')}</div></div>
      ${barChart(months.map((x) => ({ label: D.formatMonth(x.key, i18n.lang), value: x.total, title: `${D.formatMonth(x.key, i18n.lang, true)}: ${money(x.total)}` })), { format: money, ariaLabel: t('rp.chart') })}
    </section>
    <div class="grid-2 mt rep-2">
      <section class="card"><h2 class="section-h" style="margin-top:0">${esc(t('rp.modes'))}</h2>${hBars(modes, { format: money })}</section>
      <section class="card"><h2 class="section-h" style="margin-top:0">${esc(t('rp.planMix'))}</h2>${hBars(planMix)}</section>
    </div>
    <h2 class="section-h">${esc(t('rp.dues'))} · ${money(duesTotal)}</h2>
    ${dues.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>${esc(t('rc.member'))}</th><th>${esc(t('m.status'))}</th><th class="r">${esc(t('rc.amount'))}</th></tr></thead><tbody>${dues.map((m) => `<tr><td><a href="#/m/${m.id}">${esc(m.name)}</a></td><td>${statusChip(S(m.id))}</td><td class="r">${money(L.amountDue(S(m.id), C.s))}</td></tr>`).join('')}</tbody></table></div>` : `<p class="empty">${esc(t('dash.allClear'))}</p>`}
    <h2 class="section-h">${esc(t('rp.left'))} · ${leftList.length}</h2>
    ${leftList.length ? `<div class="list">${leftList.map((m) => `<a class="row" href="#/m/${m.id}">${avatar(m.name, m.photo, 38)}<span class="main"><span class="t">${esc(m.name)}</span><span class="sub">${esc(m.left ? `${t('st.left')} · ${fd(m.leftDate)} · ${m.leftReason || ''}` : t('m.endedOn', { date: fd(S(m.id).expiry) }))}</span></span></a>`).join('')}</div>` : ''}
    <h2 class="section-h">${esc(t('rp.export'))}</h2>
    <div class="btn-grid">
      <button type="button" class="btn" data-act="csv" data-k="members">${icon('download')}${esc(t('rp.csvMembers'))}</button>
      <button type="button" class="btn" data-act="csv" data-k="payments">${icon('download')}${esc(t('rp.csvPayments'))}</button>
      <button type="button" class="btn" data-act="csv" data-k="attendance">${icon('download')}${esc(t('rp.csvAttendance'))}</button>
      <button type="button" class="btn" data-act="backup">${icon('download')}${esc(t('s.backup'))}</button>
    </div>
    <p class="small muted mt">${esc(t('rp.statementHint'))}</p>`,
  };
}
function exportCSV(kind) {
  let csv;
  if (kind === 'members') {
    csv = toCSV(C.d.members, [
      { key: 'id', label: 'ID' }, { key: 'name', label: 'Name' }, { key: 'phone', label: 'Phone' }, { key: 'gender', label: 'Gender' }, { key: 'dob', label: 'DOB' },
      { label: 'Plan', value: (m) => planName(S(m.id).plan) }, { label: 'Status', value: (m) => S(m.id).status }, { label: 'Expiry', value: (m) => S(m.id).expiry || '' },
      { label: 'Days left', value: (m) => S(m.id).daysLeft ?? '' }, { label: 'Balance', value: (m) => S(m.id).balance }, { label: 'Total paid', value: (m) => S(m.id).totalPaid },
      { key: 'joinDate', label: 'Member since' }, { label: 'Last visit', value: (m) => L.lastVisit(C.attIndex.get(m.id)) || '' }, { key: 'notes', label: 'Notes' },
    ]);
  } else if (kind === 'payments') {
    csv = toCSV(C.d.payments.slice().sort((a, b) => (a.date < b.date ? -1 : 1)), [
      { key: 'receiptNo', label: 'Receipt' }, { key: 'date', label: 'Date' }, { key: 'memberId', label: 'Member ID' }, { label: 'Name', value: (p) => (M(p.memberId) || {}).name || '' },
      { key: 'amount', label: 'Amount' }, { key: 'mode', label: 'Mode' }, { key: 'periodStart', label: 'Period from' }, { key: 'periodEnd', label: 'Period to' }, { key: 'kind', label: 'Type' },
    ]);
  } else {
    csv = toCSV(C.d.attendance, [{ key: 'd', label: 'Date' }, { key: 't', label: 'Time' }, { key: 'm', label: 'Member ID' }, { label: 'Name', value: (a) => (M(a.m) || {}).name || '' }]);
  }
  download(`ironcore-${kind}-${TODAY}.csv`, csv, 'text/csv');
}

// ---------- Settings ----------
function vSettings() {
  const s = C.s;
  return {
    html: `
    <h1 class="view-title">${esc(t('nav.settings'))}</h1>
    <form id="sform" class="form">
      <section class="card form">
        <label class="field"><span>${esc(t('s.gymName'))}</span><input name="gymName" value="${esc(s.gymName)}"></label>
        <div class="field"><span class="lbl">${esc(t('s.language'))}</span><div class="lang-switch"></div></div>
      </section>
      <h2 class="section-h">${esc(t('s.plans'))}</h2>
      <section class="card form">${s.plans.map((p, i) => `
        <div class="plan-edit"><label class="field"><span>${esc(t('s.planName'))}</span><input name="pname${i}" value="${esc(planName(p))}"></label>
        <label class="field"><span>${esc(t('s.months'))}</span><input name="pmonths${i}" type="number" inputmode="numeric" min="1" max="36" value="${p.months}"></label>
        <label class="field"><span>${esc(t('s.price'))}</span><input name="pprice${i}" type="number" inputmode="numeric" min="0" step="50" value="${p.price}"></label></div>`).join('')}
        <p class="small muted">${esc(t('s.plansHelp'))}</p>
      </section>
      <h2 class="section-h">${esc(t('s.rules'))}</h2>
      <section class="card form">
        <div class="grid-2">
          <label class="field"><span>${esc(t('s.dueSoon'))}</span><input name="dueSoonDays" type="number" inputmode="numeric" min="1" max="30" value="${s.dueSoonDays}"></label>
          <label class="field"><span>${esc(t('s.expireAfter'))}</span><input name="expireAfterDays" type="number" inputmode="numeric" min="0" max="90" value="${s.expireAfterDays}"></label>
          <label class="field"><span>${esc(t('s.lateFee'))}</span><input name="lateFee" type="number" inputmode="numeric" min="0" step="10" value="${s.lateFee}"></label>
          <label class="field"><span>${esc(t('s.lateAfter'))}</span><input name="lateFeeAfterDays" type="number" inputmode="numeric" min="0" max="60" value="${s.lateFeeAfterDays}"></label>
          <label class="field"><span>${esc(t('s.inactive'))}</span><input name="inactiveDays" type="number" inputmode="numeric" min="2" max="60" value="${s.inactiveDays}"></label>
          <label class="field"><span>${esc(t('s.pin'))}</span><input name="pin" type="password" inputmode="numeric" pattern="\\d{4,6}" minlength="4" maxlength="6" value="${esc(s.pin)}" autocomplete="off"></label>
        </div>
      </section>
      <div class="sheet-actions sticky-save"><button class="btn primary big" type="submit">${icon('check')}${esc(t('a.save'))}</button></div>
    </form>
    <h2 class="section-h">${esc(t('s.data'))}</h2>
    <section class="card">
      <div class="btn-grid">
        <button type="button" class="btn" data-act="backup">${icon('download')}${esc(t('s.backup'))}</button>
        <button type="button" class="btn" data-act="restore">${icon('upload')}${esc(t('s.restore'))}</button>
        <button type="button" class="btn" data-act="lock">${icon('lock')}${esc(t('s.lock'))}</button>
        <button type="button" class="btn" id="install-btn" hidden>${icon('install')}${esc(t('s.install'))}</button>
      </div>
      <p class="small muted mt">${esc(t('s.dataHelp'))}</p>
      <button type="button" class="btn danger block mt" data-act="reset">${icon('trash')}${esc(t('s.reset'))}</button>
    </section>
    <p class="small muted mt">${esc(t('s.about'))}</p>`,
    mount() {
      i18n.mountSwitch($('#sform'));
      bindInstallButton($('#install-btn'));
      $('#sform').addEventListener('submit', (e) => {
        e.preventDefault();
        const v = formData(e.target);
        if (!/^\d{4,6}$/.test(v.pin)) { toast(t('s.pinBad'), 'danger'); return; }
        store.update((d) => {
          const st = d.settings;
          st.gymName = v.gymName || st.gymName;
          ['dueSoonDays', 'expireAfterDays', 'lateFee', 'lateFeeAfterDays', 'inactiveDays'].forEach((k) => { st[k] = Math.max(0, Number(v[k]) || 0); });
          st.pin = v.pin;
          st.plans.forEach((p, i) => {
            const nm = v[`pname${i}`];
            if (nm && nm !== t(`plan.${p.id}`)) p.customName = nm; else if (nm === t(`plan.${p.id}`)) delete p.customName;
            p.months = Math.max(1, Number(v[`pmonths${i}`]) || p.months);
            p.price = Math.max(0, Number(v[`pprice${i}`]) || 0);
          });
        });
        toast(t('f.saved'), 'ok');
        render();
      });
    },
  };
}

// ---------- global actions ----------
const actions = {
  renew: (el) => openRenew(el.dataset.id),
  checkin: (el) => { checkin(el.dataset.id); const q = $('#ciq'); if (q) { q.value = ''; q.focus(); } },
  'undo-checkin': (el) => { store.update((d) => { const i = d.attendance.findIndex((a) => a.m === el.dataset.id && a.d === TODAY && a.t === el.dataset.t); if (i >= 0) d.attendance.splice(i, 1); }); toast(t('ci.undone')); render(); },
  filter: (el) => { ui.filter = el.dataset.f; render(); },
  'clear-special': () => { ui.special = ''; render(); },
  ptab: (el) => { ui.profileTab = el.dataset.k; render(); },
  ctab: (el) => { ui.checkTab = el.dataset.k; render(); },
  cal: (el) => { ui.calMonth = D.addMonthsKey(ui.calMonth || D.monthKey(TODAY), Number(el.dataset.d)); render(); },
  freeze: (el) => openFreeze(el.dataset.id),
  receipt: (el) => showReceipt(el.dataset.pay),
  statement: (el) => printHTML(statementHTML(M(el.dataset.id))),
  'toggle-left': async (el) => {
    const m = M(el.dataset.id);
    if (!m.left && !(await confirmBox(t('a.markLeftQ', { name: m.name }), { ok: t('a.markLeft'), cancel: t('a.cancel') }))) return;
    store.update(() => { m.left = !m.left; m.leftDate = m.left ? TODAY : ''; });
    render();
  },
  rtype: (el) => { ui.remType = el.dataset.k; render(); },
  mlang: (el) => { ui.msgLang = el.dataset.l; render(); },
  reminded: (el) => { markReminded(el.dataset.id, el.dataset.k); setTimeout(render, 400); return true; },
  walk: () => walkQueue(),
  rmonths: (el) => { ui.reportMonths = Number(el.value); render(); return true; },
  csv: (el) => exportCSV(el.dataset.k),
  backup: () => { download(`ironcore-backup-${TODAY}.json`, store.exportJSON(), 'application/json'); toast(t('s.backedUp'), 'ok'); },
  restore: async () => {
    const f = await pickFile();
    if (!f) return;
    try { store.importJSON(await readText(f)); toast(t('s.restored'), 'ok'); render(); } catch (e) { toast(`${t('s.restoreFail')} ${e.message}`, 'danger'); }
  },
  reset: async () => {
    if (!(await confirmBox(t('s.resetQ'), { ok: t('s.reset'), cancel: t('a.cancel'), danger: true }))) return;
    store.reset(); toast(t('s.resetDone'), 'ok'); location.hash = '#/'; render();
  },
  lock: () => lockNow(APP_KEY),
};
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || !actions[el.dataset.act]) return;
  const keepDefault = el.tagName === 'A' && el.dataset.act === 'reminded';
  if (!keepDefault && el.tagName !== 'INPUT') e.preventDefault();
  actions[el.dataset.act](el);
});

// ---------- boot ----------
function boot() {
  i18n.mountSwitch(document.querySelector('.app-head'));
  i18n.onChange(() => render());
  window.addEventListener('hashchange', onRoute);
  onRoute();
  // Recompute at midnight and whenever the app comes back to the foreground on a new day
  const scheduleMidnight = () => setTimeout(() => { render(); scheduleMidnight(); }, D.msUntilNextMidnight());
  scheduleMidnight();
  document.addEventListener('visibilitychange', () => { if (!document.hidden && D.todayISO() !== TODAY) render(); });
  window.addEventListener('storage', (e) => { if (e.key === APP_KEY) { store.reload(); render(); } });
}
registerPWA({ onUpdate: () => toast(t('s.updated')) });
pinGate({ appKey: APP_KEY, getPin: () => store.data.settings.pin, t, brand: store.data.settings.gymName, logo: 'IC', onUnlock: boot });
