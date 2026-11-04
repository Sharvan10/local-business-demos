// "Demo data" vs "your own data" — the top strip, the Settings card and the
// "Start with an empty business" flow (double confirmation), shared by all three owner apps.
import { esc, confirmBox, toast } from './ui.js';
import { icon } from './icons.js';

/** Top strip: yellow "Demo data" while sample records are loaded, green "My data" once the owner started empty. */
export function paintDataStrip(isDemo, t) {
  const strip = document.querySelector('.demo-strip');
  if (!strip) return;
  strip.classList.toggle('is-real', !isDemo);
  const badge = strip.querySelector('.demo-badge');
  const text = strip.querySelector('.demo-badge + span');
  if (badge) { badge.dataset.i18n = isDemo ? 'demo.badge' : 'de.realBadge'; badge.textContent = t(badge.dataset.i18n); }
  if (text) { text.dataset.i18n = isDemo ? 'demo.strip' : 'de.realStrip'; text.textContent = t(text.dataset.i18n); }
}

/** Settings card: says clearly which kind of data the app holds, with both buttons. */
export function dataStateCard({ store, t, fd }) {
  const demo = store.isDemo;
  const started = store.data.__startedAt ? fd(store.data.__startedAt.slice(0, 10)) : '';
  return `<section class="card data-state ${demo ? 'is-demo' : 'is-real'}" id="data-state">
    <h2 class="section-h" style="margin-top:0">${esc(t('de.title'))}</h2>
    <p class="data-state-line"><span class="chip ${demo ? 'warn' : 'ok'}">${esc(demo ? t('demo.badge') : t('de.realBadge'))}</span> ${esc(demo ? t('de.isDemo') : t('de.isReal', { date: started }))}</p>
    <p class="small muted">${esc(t('de.emptyHelp'))}</p>
    <button type="button" class="btn primary block" data-act="start-empty">${icon('plus')}${esc(t('de.empty'))}</button>
    <p class="small muted mt">${esc(t('de.resetHelp'))}</p>
    <button type="button" class="btn danger block mt" data-act="reset">${icon('trash')}${esc(t('de.reset'))}</button>
  </section>`;
}

/** Two confirmations, then wipe the sample records (settings are kept by store.startEmpty). Returns true when done. */
export async function startEmptyFlow({ store, t }) {
  if (!(await confirmBox(t('de.emptyQ1'), { title: t('de.empty'), ok: t('de.emptyOk1'), cancel: t('a.cancel'), danger: true }))) return false;
  await new Promise((r) => setTimeout(r, 250)); // let the first sheet close before opening the second
  if (!(await confirmBox(t('de.emptyQ2'), { title: t('de.empty'), ok: t('de.emptyOk2'), cancel: t('a.cancel'), danger: true }))) return false;
  store.startEmpty();
  toast(t('de.emptyDone'), 'ok');
  return true;
}
