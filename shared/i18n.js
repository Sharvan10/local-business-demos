// Tiny i18n helper. Dictionaries: { en: {...}, hi: {...}, pa: {...} }. Missing keys fall back to English.
const LANG_KEY = 'lbd.lang';
export const LANGS = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'hi', label: 'हिं', name: 'हिंदी' },
  { code: 'pa', label: 'ਪੰ', name: 'ਪੰਜਾਬੀ' },
];

export function interpolate(str, vars = {}) {
  return String(str).replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? vars[k] : m));
}

export function createI18n(dicts, { initial } = {}) {
  let lang = initial || readLang() || 'en';
  if (!dicts[lang]) lang = 'en';
  const subs = new Set();
  const missing = new Set();

  function t(key, vars) {
    let s = dicts[lang] && dicts[lang][key];
    if (s === undefined) { s = dicts.en[key]; if (lang !== 'en') missing.add(`${lang}:${key}`); }
    if (s === undefined) return key;
    return vars ? interpolate(s, vars) : s;
  }
  function apply(root = document) {
    document.documentElement.lang = lang;
    root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    root.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
    root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      el.dataset.i18nAttr.split(';').forEach((pair) => {
        const [attr, key] = pair.split(':').map((x) => x.trim());
        if (attr && key) el.setAttribute(attr, t(key));
      });
    });
    root.querySelectorAll('.lang-switch button[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  }
  function setLang(l) {
    if (!dicts[l]) return;
    lang = l;
    try { localStorage.setItem(LANG_KEY, l); } catch { /* ignore */ }
    apply();
    subs.forEach((fn) => fn(lang));
  }
  /** Render EN/हिं/ਪੰ buttons into every .lang-switch element. */
  function mountSwitch(root = document) {
    root.querySelectorAll('.lang-switch').forEach((box) => {
      box.setAttribute('role', 'group');
      box.setAttribute('aria-label', 'Language / भाषा / ਭਾਸ਼ਾ');
      box.innerHTML = LANGS.map((l) => `<button type="button" data-lang="${l.code}" lang="${l.code}" aria-pressed="false" title="${l.name}">${l.label}</button>`).join('');
      box.addEventListener('click', (e) => { const b = e.target.closest('button[data-lang]'); if (b) setLang(b.dataset.lang); });
    });
    apply(root);
  }
  return { t, apply, setLang, mountSwitch, get lang() { return lang; }, onChange: (fn) => (subs.add(fn), () => subs.delete(fn)), missing };
}

function readLang() { try { return localStorage.getItem(LANG_KEY); } catch { return null; } }

/** Pick a value from a {en,hi,pa} object or return a plain string. */
export function pick(v, lang) { return v && typeof v === 'object' ? (v[lang] || v.en || '') : (v || ''); }
