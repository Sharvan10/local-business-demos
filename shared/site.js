// Common behaviour for the three public websites.
import { createI18n } from './i18n.js';
import { revealOnScroll, $, $$ } from './ui.js';
import { applyConfig, cfg } from '../js/config.js';
import { waLink } from './wa.js';

export function initSite({ site, dict, onLang }) {
  const i18n = createI18n(dict);
  i18n.mountSwitch();
  applyConfig(site);
  // Mobile nav
  const btn = $('.nav-toggle');
  const nav = $('#site-nav');
  if (btn && nav) {
    const set = (open) => { btn.setAttribute('aria-expanded', String(open)); nav.classList.toggle('open', open); document.body.classList.toggle('nav-open', open); };
    btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
  }
  // Header shadow on scroll
  const head = $('.site-head');
  if (head) {
    const onScroll = () => head.classList.toggle('scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
  // Floating / generic WhatsApp links: data-wa="i18n key of the message"
  const paintWa = () => $$('[data-wa]').forEach((a) => { a.href = waLink(cfg('WHATSAPP_NUMBER', site), i18n.t(a.dataset.wa)); a.target = '_blank'; a.rel = 'noopener'; });
  paintWa();
  i18n.onChange(() => { paintWa(); if (onLang) onLang(i18n.lang); });
  revealOnScroll();
  const y = $('#year');
  if (y) y.textContent = new Date().getFullYear();
  return i18n;
}

/** Is a business open now? hours: { 0:[['07:00','12:00']], 1:[['05:30','22:00']], ... } (0 = Sunday) */
export function isOpenNow(hours, now = new Date()) {
  const slots = hours[now.getDay()] || [];
  const mins = now.getHours() * 60 + now.getMinutes();
  const toM = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  return slots.some(([a, b]) => mins >= toM(a) && mins < toM(b));
}
