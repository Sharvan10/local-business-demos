// IronCore public site: renders plans (live from the owner app's settings if set), trainers, results, facilities.
import { initSite, isOpenNow } from '../../shared/site.js';
import { GYM_I18N } from '../../js/i18n-gym.js';
import { peek } from '../../shared/storage.js';
import { money, esc, $, formData } from '../../shared/ui.js';
import { waLink } from '../../shared/wa.js';
import { cfg } from '../../js/config.js';

const DEFAULT_PLANS = [
  { id: 'monthly', months: 1, price: 1200 }, { id: 'quarterly', months: 3, price: 3300 },
  { id: 'halfyearly', months: 6, price: 6000 }, { id: 'yearly', months: 12, price: 10800 },
];
const HOURS = { 0: [['07:00', '12:00']], 1: [['05:30', '22:00']], 2: [['05:30', '22:00']], 3: [['05:30', '22:00']], 4: [['05:30', '22:00']], 5: [['05:30', '22:00']], 6: [['05:30', '22:00']] };
const i18n = initSite({ site: 'gym', dict: GYM_I18N, onLang: render });
const t = i18n.t;

function plans() {
  const owner = peek('ironcore.gym');
  return (owner && owner.settings && owner.settings.plans) || DEFAULT_PLANS;
}

function render() {
  const ps = plans();
  const monthly = ps.find((p) => p.months === 1) || ps[0];
  const feats = { monthly: [1, 2, 3], quarterly: [1, 2, 3, 4], halfyearly: [1, 2, 3, 4, 5], yearly: [1, 2, 3, 4, 5, 6] };
  $('#plans-grid').innerHTML = ps.map((p, i) => {
    const save = monthly.price * p.months - p.price;
    const name = p.customName || t(`plan.${p.id}`);
    const popular = p.id === 'quarterly';
    return `<article class="plan reveal in ${popular ? 'popular' : ''}" style="--d:${i * 70}ms">
      ${popular ? `<span class="plan-flag">${esc(t('plans.popular'))}</span>` : ''}
      <h3>${esc(name)}</h3>
      <p class="price"><span class="amt">${money(p.price)}</span> <span class="per">${esc(t(p.months === 1 ? 'plans.per' : 'plans.perN', { n: p.months }))}</span></p>
      ${save > 0 ? `<p class="save">${esc(t('plans.save', { amount: money(save) }))}</p>` : '<p class="save ghost">&nbsp;</p>'}
      <ul>${(feats[p.id] || feats.monthly).map((f) => `<li>${esc(t(`plans.f${f}`))}</li>`).join('')}</ul>
      <a class="${popular ? 'btn-lime' : 'btn-ghost'} block" href="#trial">${esc(t('plans.join'))}</a>
    </article>`;
  }).join('');

  const tr = [['HS', 28, '#c6ff3d'], ['RT', 330, '#ff7a2f'], ['AR', 200, '#7dd3fc'], ['DP', 45, '#f0abfc']];
  $('#trainers-grid').innerHTML = tr.map(([ini, rot, col], i) => `<article class="trainer reveal in">
    <div class="trainer-art" style="--c:${col}" aria-hidden="true"><svg viewBox="0 0 200 200"><defs><pattern id="st${i}" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(${rot})"><rect width="4" height="10" fill="${col}" opacity=".18"/></pattern></defs><rect width="200" height="200" fill="url(#st${i})"/><circle cx="100" cy="82" r="34" fill="#1d222b"/><path d="M38 200c4-46 30-70 62-70s58 24 62 70z" fill="#1d222b"/><text x="100" y="94" text-anchor="middle" font-family="Bebas Neue, sans-serif" font-size="34" fill="${col}">${ini}</text></svg></div>
    <h3>${esc(t(`tr.${i + 1}n`))}</h3><p class="role">${esc(t(`tr.${i + 1}r`))}</p><p class="muted small">${esc(t(`tr.${i + 1}e`))}</p></article>`).join('');

  const res = [[1.35, 1.0], [0.95, 1.18], [1.28, 1.05]];
  $('#results-grid').innerHTML = res.map(([b, a], i) => `<article class="result reveal in">
    <div class="ba"><figure>${body(b, '#3a404b')}<figcaption>${esc(t('res.before'))}</figcaption></figure><span class="arrow" aria-hidden="true">→</span><figure>${body(a, '#c6ff3d')}<figcaption>${esc(t('res.after'))}</figcaption></figure></div>
    <span class="sample">${esc(t('res.badge'))}</span>
    <h3>${esc(t(`res.${i + 1}`))}</h3><p class="muted small">${esc(t(`res.${i + 1}s`))}</p></article>`).join('');

  const fac = ['❤️‍🔥', '🏋️', '🧗', '♨️', '🚿', '🅿️', '🥗', '💧'];
  $('#fac-grid').innerHTML = fac.map((e, i) => `<li><span class="fi" aria-hidden="true">${e}</span>${esc(t(`fac.${i + 1}`))}</li>`).join('');

  const open = isOpenNow(HOURS);
  const pill = $('#open-now');
  pill.textContent = open ? t('time.now') : t('time.closed');
  pill.classList.toggle('closed', !open);
}

/** Simple illustrated body silhouette; w scales the waist/torso width. */
function body(w, color) {
  const tw = 34 * w, hw = 30 * w;
  return `<svg viewBox="0 0 120 200" aria-hidden="true"><circle cx="60" cy="28" r="17" fill="${color}"/>
  <path d="M${60 - tw} 56 Q60 46 ${60 + tw} 56 L${60 + hw} 118 Q60 128 ${60 - hw} 118 Z" fill="${color}"/>
  <path d="M${60 - hw + 4} 116 L${48 - w * 4} 192 L${58} 192 L60 130 L62 192 L${72 + w * 4} 192 L${60 + hw - 4} 116 Z" fill="${color}" opacity=".9"/>
  <path d="M${60 - tw} 58 L${34 - w * 10} 112 L${42 - w * 6} 114 L${60 - tw + 8} 70 Z M${60 + tw} 58 L${86 + w * 10} 112 L${78 + w * 6} 114 L${60 + tw - 8} 70 Z" fill="${color}" opacity=".85"/></svg>`;
}

render();

// Free-trial form (demo only: stored locally, optional WhatsApp hand-off)
const form = $('#trial-form');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const v = formData(form);
  const msg = $('#trial-msg');
  if (!v.name || (v.phone || '').replace(/\D/g, '').length < 10) { msg.className = 'form-msg err'; msg.textContent = t('trial.err'); return; }
  try {
    const list = JSON.parse(localStorage.getItem('ironcore.enquiries') || '[]');
    list.push({ ...v, at: new Date().toISOString() });
    localStorage.setItem('ironcore.enquiries', JSON.stringify(list.slice(-50)));
  } catch { /* storage blocked */ }
  const text = t('trial.waText', { gym: 'IronCore Fitness Club', name: v.name, phone: v.phone, goal: v.goal, time: t(`tm.${v.time}`) });
  msg.className = 'form-msg ok';
  msg.innerHTML = `${esc(t('trial.ok', { name: v.name.split(' ')[0] }))} <a href="${esc(waLink(cfg('WHATSAPP_NUMBER', 'gym'), text))}" target="_blank" rel="noopener">${esc(t('trial.wa'))} →</a>`;
  form.reset();
});
