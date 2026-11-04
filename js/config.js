// Business contact config. Anything starting with "PASTE_" is treated as "not set" and hidden automatically.
// For a real client: paste their WhatsApp number (with country code, e.g. 9198xxxxxxxx) and email.
export const CONFIG = {
  WHATSAPP_NUMBER: 'PASTE_NUMBER',
  CONTACT_EMAIL: 'PASTE_EMAIL',
  // Optional: street address text and a Google Maps share link (https://maps.app.goo.gl/...)
  ADDRESS: 'PASTE_ADDRESS',
  MAPS_URL: 'PASTE_MAPS_URL',
  // Optional per-site overrides, e.g. gym: { WHATSAPP_NUMBER: '91...' }
  sites: { gym: {}, restaurant: {}, jewellers: {} },
};

export function isSet(v) { return typeof v === 'string' ? v.trim() !== '' && !v.startsWith('PASTE_') : v != null; }

/** Read a config value for a site; returns '' when it is still a PASTE_ placeholder. */
export function cfg(key, site) {
  const v = (site && CONFIG.sites[site] && CONFIG.sites[site][key]) || CONFIG[key];
  return isSet(v) ? v : '';
}

/** Hide every element marked data-needs="KEY" whose config value is not set; fill data-fill="KEY". */
export function applyConfig(site, root = document) {
  root.querySelectorAll('[data-needs]').forEach((el) => { if (!cfg(el.dataset.needs, site)) el.hidden = true; });
  root.querySelectorAll('[data-fill]').forEach((el) => {
    const v = cfg(el.dataset.fill, site);
    if (!v) { el.hidden = true; return; }
    el.textContent = v;
    if (el.tagName === 'A' && el.dataset.fill === 'CONTACT_EMAIL') el.href = `mailto:${v}`;
  });
  root.querySelectorAll('[data-href]').forEach((el) => {
    const v = cfg(el.dataset.href, site);
    if (!v) { el.hidden = true; return; }
    if (el.dataset.href === 'MAPS_URL') el.href = v;
    if (el.dataset.href === 'WHATSAPP_NUMBER') el.href = `tel:+${v.replace(/\D/g, '')}`;
  });
}
