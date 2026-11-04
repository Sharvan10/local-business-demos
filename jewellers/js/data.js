// Shree Heera Jewellers — shared store (public site reads the owner's rates & catalogue from here).
import { createStore } from '../../shared/storage.js';
import { todayISO, addDays, addMonths } from '../../shared/dates.js';
import { DEFAULT_RATES } from './logic.js';

export const JEW_KEY = 'shreeheera.jewellers';
export const JCATS = ['gold', 'silver', 'bridal', 'diamond'];

// [id, cat, type, purity, weight g, making %, stone ₹, en, hi, pa]
const ITEMS = [
  ['g-ring-01', 'gold', 'ring', '22K', 4.2, 12, 0, 'Floral Gold Ring', 'फूलों वाली सोने की अंगूठी', 'ਫੁੱਲਾਂ ਵਾਲੀ ਸੋਨੇ ਦੀ ਮੁੰਦਰੀ'],
  ['g-chain-01', 'gold', 'chain', '22K', 12.5, 8, 0, 'Rope Chain 20"', 'रोप चेन 20"', 'ਰੋਪ ਚੇਨ 20"'],
  ['g-bangle-01', 'gold', 'bangle', '22K', 18, 11, 0, 'Classic Kada (pair)', 'क्लासिक कड़ा (जोड़ी)', 'ਕਲਾਸਿਕ ਕੜਾ (ਜੋੜੀ)'],
  ['g-ear-01', 'gold', 'earring', '22K', 5.6, 14, 0, 'Jhumka Earrings', 'झुमका', 'ਝੁਮਕੇ'],
  ['g-coin-01', 'gold', 'coin', '24K', 10, 3, 0, 'Gold Coin 10 g', 'सोने का सिक्का 10 ग्राम', 'ਸੋਨੇ ਦਾ ਸਿੱਕਾ 10 ਗ੍ਰਾਮ'],
  ['g-pendant-01', 'gold', 'pendant', '22K', 3.4, 15, 0, 'Ik Onkar Pendant', 'इक ओंकार पेंडेंट', 'ੴ ਪੈਂਡੈਂਟ'],
  ['s-anklet-01', 'silver', 'anklet', '925', 42, 10, 0, 'Ghungroo Payal (pair)', 'घुंघरू पायल (जोड़ी)', 'ਘੁੰਗਰੂ ਝਾਂਜਰਾਂ (ਜੋੜੀ)'],
  ['s-coin-01', 'silver', 'coin', '999', 20, 0, 0, 'Silver Coin 20 g', 'चाँदी का सिक्का 20 ग्राम', 'ਚਾਂਦੀ ਦਾ ਸਿੱਕਾ 20 ਗ੍ਰਾਮ'],
  ['s-bowl-01', 'silver', 'bowl', '925', 85, 12, 0, 'Baby Gift Set', 'बच्चे का उपहार सेट', 'ਬੱਚੇ ਦਾ ਤੋਹਫ਼ਾ ਸੈੱਟ'],
  ['s-chain-01', 'silver', 'chain', '925', 18, 9, 0, 'Oxidised Chain', 'ऑक्सीडाइज़्ड चेन', 'ਆਕਸੀਡਾਈਜ਼ਡ ਚੇਨ'],
  ['b-set-01', 'bridal', 'necklace', '22K', 48, 13, 0, 'Rani Haar Bridal Set', 'रानी हार ब्राइडल सेट', 'ਰਾਣੀ ਹਾਰ ਦੁਲਹਨ ਸੈੱਟ'],
  ['b-tikka-01', 'bridal', 'pendant', '22K', 9.5, 16, 0, 'Maang Tikka', 'मांग टीका', 'ਮਾਂਗ ਟਿੱਕਾ'],
  ['b-chooda-01', 'bridal', 'bangle', '22K', 32, 12, 0, 'Bridal Kangan (pair)', 'दुल्हन के कंगन (जोड़ी)', 'ਦੁਲਹਨ ਦੇ ਕੰਗਣ (ਜੋੜੀ)'],
  ['b-nath-01', 'bridal', 'earring', '22K', 6.8, 18, 4500, 'Punjabi Nath with Pearls', 'मोतियों वाली पंजाबी नथ', 'ਮੋਤੀਆਂ ਵਾਲੀ ਪੰਜਾਬੀ ਨੱਥ'],
  ['d-ring-01', 'diamond', 'ring', '18K', 3.1, 18, 38000, 'Solitaire-look Ring', 'सॉलिटेयर लुक अंगूठी', 'ਸੋਲੀਟੇਅਰ ਲੁੱਕ ਮੁੰਦਰੀ'],
  ['d-ear-01', 'diamond', 'earring', '18K', 4.4, 20, 52000, 'Diamond Studs', 'डायमंड टॉप्स', 'ਡਾਇਮੰਡ ਟੌਪਸ'],
  ['d-pendant-01', 'diamond', 'pendant', '18K', 2.6, 20, 27000, 'Heart Pendant', 'दिल वाला पेंडेंट', 'ਦਿਲ ਵਾਲਾ ਪੈਂਡੈਂਟ'],
  ['d-bangle-01', 'diamond', 'bangle', '18K', 14, 18, 96000, 'Tennis Bracelet', 'टेनिस ब्रेसलेट', 'ਟੈਨਿਸ ਬ੍ਰੇਸਲੇਟ'],
];

const FIRST = ['Harpreet', 'Manjit', 'Sukhwinder', 'Rajinder', 'Paramjit', 'Kamaljeet', 'Navneet', 'Gurdeep', 'Balwinder', 'Ritu', 'Seema', 'Anita', 'Jaspal', 'Davinder'];
const LAST = ['Kaur', 'Singh', 'Sethi', 'Kapoor', 'Ahuja', 'Chawla', 'Sodhi', 'Walia', 'Bhatia', 'Anand'];

export function seedJewellers(today = todayISO()) {
  const settings = { name: 'Shree Heera Jewellers', gstPct: 3, pin: '1234', schemeBonus: 1, ratesUpdatedAt: `${today}T10:00:00` };
  const items = ITEMS.map(([id, cat, type, purity, weight, making, stone, en, hi, pa], i) => ({ id, cat, type, purity, weight, making, stone, name: { en, hi, pa }, photo: '', inStock: i !== 9, sku: `SH-${String(101 + i)}` }));
  const customers = Array.from({ length: 12 }, (_, i) => {
    const name = `${FIRST[i % FIRST.length]} ${LAST[(i * 3) % LAST.length]}`;
    return { id: `c${i + 1}`, name, phone: `56${String(10000000 + i * 734521).slice(0, 8)}`, dob: i === 0 ? `${1970 + i}-${today.slice(5)}` : `${1968 + i * 2}-0${(i % 9) + 1}-1${i % 9}`, anniversary: i % 4 === 1 ? `${1995 + i}-${addDays(today, 3).slice(5)}` : '', ledger: [] };
  });
  customers[3].dob = `${1984}-${addDays(today, 2).slice(5)}`;
  // ledgers: purchases with part payments
  const L = [[0, 185000, 150000], [1, 64000, 64000], [2, 412000, 300000], [4, 23500, 23500], [5, 96000, 80000], [7, 145000, 145000], [8, 31000, 20000], [10, 8800, 8800]];
  L.forEach(([ci, amt, paid], k) => {
    const d = addDays(today, -(k * 9 + 3));
    const it = items[(k * 5) % items.length];
    customers[ci].ledger.push({ id: `l${k}a`, date: d, type: 'purchase', amount: amt, note: it.name.en });
    customers[ci].ledger.push({ id: `l${k}b`, date: d, type: 'payment', amount: Math.round(paid * 0.7), mode: 'UPI', note: 'At purchase' });
    if (paid > paid * 0.7) customers[ci].ledger.push({ id: `l${k}c`, date: addDays(d, 6), type: 'payment', amount: paid - Math.round(paid * 0.7), mode: 'Cash', note: 'Balance' });
  });
  // older sales for the monthly chart
  for (let m = 1; m <= 5; m++) customers[(m * 2) % 12].ledger.push({ id: `old${m}`, date: addDays(addMonths(today, -m), -m), type: 'purchase', amount: 60000 + m * 23000, note: 'Wedding shopping' }, { id: `oldp${m}`, date: addDays(addMonths(today, -m), -m), type: 'payment', amount: 60000 + m * 23000, mode: 'Card' });
  const schemes = [{ id: 'sv11', name: 'Swarn Bachat 11+1', months: 11, instalment: 5000 }, { id: 'sv11b', name: 'Swarn Bachat Mini 11+1', months: 11, instalment: 2000 }];
  const enrol = [[0, 0, -150, 6], [1, 1, -95, 3], [2, 0, -200, 6], [3, 1, -40, 2], [5, 0, -320, 11], [6, 1, -58, 2], [9, 0, -10, 1], [11, 1, -250, 8]];
  const enrolments = enrol.map(([ci, si, startOff, paidN], i) => {
    const sc = schemes[si];
    const start = addDays(today, startOff);
    return { id: `e${i + 1}`, customerId: customers[ci].id, schemeId: sc.id, start, months: sc.months, instalment: sc.instalment, bonus: sc.instalment * settings.schemeBonus, payments: Array.from({ length: paidN }, (_, k) => ({ date: addMonths(start, k), amount: sc.instalment, mode: k % 2 ? 'UPI' : 'Cash' })), reminders: [] };
  });
  const jobs = [
    ['order', 2, 'Custom bridal kangan, 32 g, Rajasthani meena work', -12, 10, 'working', 50000, 210000],
    ['repair', 4, 'Chain clasp repair + polish', -3, -1, 'working', 0, 450],
    ['repair', 6, 'Resize ring (size 14 → 16)', -2, 1, 'ready', 0, 300],
    ['order', 8, 'Name pendant in Gurmukhi, 22K, 4 g', -6, 4, 'received', 10000, 32000],
    ['repair', 1, 'Payal ghungroo replacement', -9, -4, 'delivered', 0, 250],
  ].map(([kind, ci, desc, recvOff, promOff, status, advance, estimate], i) => ({ id: `j${i + 1}`, kind, customerId: customers[ci].id, desc, received: addDays(today, recvOff), promised: addDays(today, promOff), status, advance, estimate }));
  return { settings, rates: { ...DEFAULT_RATES }, rateHistory: [{ date: addDays(today, -1), ...DEFAULT_RATES, gold24: DEFAULT_RATES.gold24 - 350, gold22: DEFAULT_RATES.gold22 - 320, gold18: DEFAULT_RATES.gold18 - 260 }, { date: today, ...DEFAULT_RATES }], items, customers, schemes, enrolments, jobs, viewings: [], seededFor: today };
}

/** "Start with an empty business": no stock, customers, scheme members, jobs or viewings.
 *  Settings, today's rates and the scheme plans stay. */
export function emptyJewellers(current) {
  const rates = current.rates || { ...DEFAULT_RATES };
  return { settings: current.settings, rates, rateHistory: [{ date: todayISO(), ...rates }], items: [], customers: [], schemes: current.schemes || [], enrolments: [], jobs: [], viewings: [] };
}

export const jewStore = createStore({ key: JEW_KEY, version: 1, seed: () => seedJewellers(), empty: emptyJewellers });
export const jName = (it, lang) => (it.name && (it.name[lang] || it.name.en)) || '';

const TONES = { '24K': ['#f7d77c', '#b8862b'], '22K': ['#f3cf6e', '#a87a22'], '18K': ['#f0d9a0', '#a8875a'], '999': ['#f2f4f7', '#9aa3ad'], '925': ['#e8ebef', '#8a939d'] };
/** Generated jewellery illustration (no photos needed for the demo). */
export function itemArt(it, size = 160) {
  const [a, b] = TONES[it.purity] || TONES['22K'];
  const g = `ga${it.id}`;
  const gem = it.cat === 'diamond' ? '<path d="M80 52l10 10-10 14-10-14z" fill="#e9f6ff" stroke="#9fd3ff" stroke-width="1.5"/><path d="M70 62h20" stroke="#9fd3ff"/>' : it.cat === 'bridal' ? '<circle cx="80" cy="66" r="6" fill="#b3123b"/><circle cx="62" cy="74" r="4" fill="#0e7a4b"/><circle cx="98" cy="74" r="4" fill="#0e7a4b"/>' : '';
  const shapes = {
    ring: `<ellipse cx="80" cy="96" rx="34" ry="30" fill="none" stroke="url(#${g})" stroke-width="10"/><path d="M66 70l14-16 14 16-14 10z" fill="url(#${g})"/>`,
    chain: `<path d="M34 50 Q80 150 126 50" fill="none" stroke="url(#${g})" stroke-width="7" stroke-dasharray="9 4" stroke-linecap="round"/>`,
    bangle: `<circle cx="70" cy="86" r="36" fill="none" stroke="url(#${g})" stroke-width="11"/><circle cx="92" cy="86" r="36" fill="none" stroke="url(#${g})" stroke-width="11" opacity=".85"/>`,
    earring: `<circle cx="56" cy="46" r="7" fill="url(#${g})"/><path d="M40 92a16 16 0 0 1 32 0z" fill="url(#${g})"/><path d="M56 53v22" stroke="url(#${g})" stroke-width="3"/><circle cx="104" cy="46" r="7" fill="url(#${g})"/><path d="M88 92a16 16 0 0 1 32 0z" fill="url(#${g})"/><path d="M104 53v22" stroke="url(#${g})" stroke-width="3"/><g fill="url(#${g})">${[44, 52, 60, 68, 92, 100, 108, 116].map((x) => `<circle cx="${x}" cy="98" r="2.6"/>`).join('')}</g>`,
    coin: `<circle cx="80" cy="82" r="44" fill="url(#${g})"/><circle cx="80" cy="82" r="36" fill="none" stroke="${b}" stroke-width="2"/><text x="80" y="92" text-anchor="middle" font-family="Cormorant Garamond,serif" font-size="28" font-weight="600" fill="${b}">${it.purity}</text>`,
    pendant: `<path d="M40 40 Q80 80 120 40" fill="none" stroke="url(#${g})" stroke-width="3"/><path d="M80 62c18 0 26 14 26 28 0 18-26 34-26 34s-26-16-26-34c0-14 8-28 26-28z" fill="url(#${g})"/>`,
    necklace: `<path d="M30 40 Q80 140 130 40" fill="none" stroke="url(#${g})" stroke-width="5"/><path d="M38 56 Q80 152 122 56" fill="none" stroke="url(#${g})" stroke-width="9" stroke-dasharray="3 6"/><path d="M80 108l14 14-14 18-14-18z" fill="url(#${g})"/>`,
    anklet: `<ellipse cx="80" cy="84" rx="50" ry="22" fill="none" stroke="url(#${g})" stroke-width="5"/><g fill="url(#${g})">${[40, 56, 72, 88, 104, 120].map((x, i) => `<circle cx="${x}" cy="${100 + (i % 2) * 4}" r="5"/>`).join('')}</g>`,
    bowl: `<path d="M36 76h88a44 34 0 0 1-88 0z" fill="url(#${g})"/><path d="M98 60c10-10 22-8 26 0" fill="none" stroke="url(#${g})" stroke-width="5"/>`,
  };
  return `<svg viewBox="0 0 160 160" width="${size}" height="${size}" aria-hidden="true"><defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${a}"/></linearGradient></defs>${shapes[it.type] || shapes.ring}${it.type === 'coin' ? '' : gem}</svg>`;
}
