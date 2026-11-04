// WhatsApp click-to-chat link builder (https://wa.me). No API, no server: opens WhatsApp with a pre-filled message.
import { interpolate } from './i18n.js';

/** Normalise an Indian phone number to digits with country code. Returns '' if unusable. */
export function normalizePhone(phone, cc = '91') {
  if (!phone) return '';
  let d = String(phone).replace(/[^\d]/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) d = cc + d;
  return d.length >= 11 && d.length <= 15 ? d : '';
}

/** Build a wa.me link. Without a phone the link opens WhatsApp's contact picker with the text ready. */
export function waLink(phone, text = '') {
  const num = normalizePhone(phone);
  const q = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${num}${q}`;
}

export function waMessage(template, vars) { return interpolate(template, vars).replace(/\n{3,}/g, '\n\n').trim(); }
export function telLink(phone) { const n = normalizePhone(phone); return n ? `tel:+${n}` : ''; }
