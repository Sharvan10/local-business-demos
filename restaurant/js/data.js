// Spice Route Rasoi — shared store (public site + owner app use the same localStorage key, so
// orders placed from the website cart appear on the owner's orders board).
import { createStore } from '../../shared/storage.js';
import { todayISO, addDays } from '../../shared/dates.js';
import { billTotals } from './logic.js';

export const REST_KEY = 'spiceroute.restaurant';
export const CATEGORIES = ['starters', 'tandoor', 'mains', 'breads', 'rice', 'desserts', 'drinks'];

// [id, cat, price, veg, spice(0-3), en, hi, pa, desc]
const M = [
  ['paneer-tikka', 'starters', 280, 1, 2, 'Paneer Tikka', 'पनीर टिक्का', 'ਪਨੀਰ ਟਿੱਕਾ', 'Cottage cheese, hung-curd marinade, charred in the tandoor'],
  ['amritsari-fish', 'starters', 360, 0, 2, 'Amritsari Fish', 'अमृतसरी मछली', 'ਅੰਮ੍ਰਿਤਸਰੀ ਮੱਛੀ', 'Ajwain-spiced gram-flour batter, lemon, chaat masala'],
  ['hara-bhara-kebab', 'starters', 220, 1, 1, 'Hara Bhara Kebab', 'हरा भरा कबाब', 'ਹਰਾ ਭਰਾ ਕਬਾਬ', 'Spinach, peas and potato patties with mint chutney'],
  ['chicken-65', 'starters', 300, 0, 3, 'Crispy Chilli Chicken', 'क्रिस्पी चिली चिकन', 'ਕ੍ਰਿਸਪੀ ਚਿੱਲੀ ਚਿਕਨ', 'Wok-tossed with green chillies and curry leaves'],
  ['tandoori-chicken', 'tandoor', 420, 0, 2, 'Tandoori Chicken (half)', 'तंदूरी चिकन (हाफ)', 'ਤੰਦੂਰੀ ਚਿਕਨ (ਹਾਫ਼)', 'Overnight marinade, smoky clay-oven finish'],
  ['malai-tikka', 'tandoor', 380, 0, 1, 'Malai Chicken Tikka', 'मलाई चिकन टिक्का', 'ਮਲਾਈ ਚਿਕਨ ਟਿੱਕਾ', 'Cream, cheese and cardamom — mild and juicy'],
  ['soya-chaap', 'tandoor', 260, 1, 2, 'Tandoori Soya Chaap', 'तंदूरी सोया चाप', 'ਤੰਦੂਰੀ ਸੋਇਆ ਚਾਪ', 'Street-style chaap with butter and onion rings'],
  ['butter-chicken', 'mains', 420, 0, 1, 'Butter Chicken', 'बटर चिकन', 'ਬਟਰ ਚਿਕਨ', 'Tandoori chicken in a silky tomato-butter gravy'],
  ['dal-makhani', 'mains', 280, 1, 1, 'Dal Makhani', 'दाल मखनी', 'ਦਾਲ ਮੱਖਣੀ', 'Black lentils slow-cooked overnight, finished with white butter'],
  ['sarson-saag', 'mains', 260, 1, 1, 'Sarson da Saag', 'सरसों का साग', 'ਸਰ੍ਹੋਂ ਦਾ ਸਾਗ', 'Mustard greens with a dollop of white butter (winter special)'],
  ['kadhai-paneer', 'mains', 320, 1, 2, 'Kadhai Paneer', 'कड़ाही पनीर', 'ਕੜਾਹੀ ਪਨੀਰ', 'Paneer, capsicum and fresh-ground kadhai masala'],
  ['chole', 'mains', 240, 1, 2, 'Pindi Chole', 'पिंडी छोले', 'ਪਿੰਡੀ ਛੋਲੇ', 'Dark, tangy chickpeas with pomegranate and amchur'],
  ['rajma', 'mains', 240, 1, 1, 'Rajma Masala', 'राजमा मसाला', 'ਰਾਜਮਾ ਮਸਾਲਾ', 'Home-style kidney beans, the way Punjab likes it'],
  ['mutton-rogan', 'mains', 520, 0, 3, 'Mutton Rogan Josh', 'मटन रोगन जोश', 'ਮਟਨ ਰੋਗਨ ਜੋਸ਼', 'Slow-braised mutton, Kashmiri chilli, whole spices'],
  ['makki-roti', 'breads', 60, 1, 0, 'Makki di Roti', 'मक्की की रोटी', 'ਮੱਕੀ ਦੀ ਰੋਟੀ', 'Hand-patted cornmeal flatbread'],
  ['butter-naan', 'breads', 60, 1, 0, 'Butter Naan', 'बटर नान', 'ਬਟਰ ਨਾਨ', 'Soft tandoor naan brushed with butter'],
  ['garlic-naan', 'breads', 80, 1, 0, 'Garlic Naan', 'गार्लिक नान', 'ਗਾਰਲਿਕ ਨਾਨ', 'Topped with garlic and coriander'],
  ['lachha-paratha', 'breads', 70, 1, 0, 'Lachha Paratha', 'लच्छा पराठा', 'ਲੱਛਾ ਪਰੌਂਠਾ', 'Flaky, layered whole-wheat paratha'],
  ['amritsari-kulcha', 'breads', 140, 1, 1, 'Amritsari Kulcha', 'अमृतसरी कुलचा', 'ਅੰਮ੍ਰਿਤਸਰੀ ਕੁਲਚਾ', 'Stuffed with spiced potato, served with chole'],
  ['jeera-rice', 'rice', 160, 1, 0, 'Jeera Rice', 'जीरा राइस', 'ਜੀਰਾ ਚੌਲ', 'Basmati tempered with cumin'],
  ['veg-biryani', 'rice', 280, 1, 2, 'Veg Dum Biryani', 'वेज दम बिरयानी', 'ਵੈੱਜ ਦਮ ਬਿਰਯਾਨੀ', 'Layered basmati with vegetables and saffron'],
  ['chicken-biryani', 'rice', 360, 0, 2, 'Chicken Dum Biryani', 'चिकन दम बिरयानी', 'ਚਿਕਨ ਦਮ ਬਿਰਯਾਨੀ', 'Slow-cooked with fried onions and mint'],
  ['gulab-jamun', 'desserts', 120, 1, 0, 'Gulab Jamun (2 pc)', 'गुलाब जामुन (2)', 'ਗੁਲਾਬ ਜਾਮੁਨ (2)', 'Warm, soaked in cardamom syrup'],
  ['phirni', 'desserts', 140, 1, 0, 'Kesar Phirni', 'केसर फिरनी', 'ਕੇਸਰ ਫਿਰਨੀ', 'Ground-rice pudding set in clay pots'],
  ['gajar-halwa', 'desserts', 160, 1, 0, 'Gajar ka Halwa', 'गाजर का हलवा', 'ਗਾਜਰ ਦਾ ਹਲਵਾ', 'Slow-cooked carrots, khoya and nuts'],
  ['lassi', 'drinks', 110, 1, 0, 'Patiala Lassi', 'पटियाला लस्सी', 'ਪਟਿਆਲਾ ਲੱਸੀ', 'Tall glass of sweet lassi with malai'],
  ['masala-chaas', 'drinks', 70, 1, 1, 'Masala Chaas', 'मसाला छाछ', 'ਮਸਾਲਾ ਲੱਸੀ (ਛਾਛ)', 'Spiced buttermilk with roasted cumin'],
  ['masala-chai', 'drinks', 50, 1, 0, 'Kulhad Chai', 'कुल्हड़ चाय', 'ਕੁੱਲ੍ਹੜ ਚਾਹ', 'Ginger-cardamom tea in a clay cup'],
];

// Hindi / Punjabi descriptions of the sample dishes (the dish names above stay as they are).
// Shown only while a dish still has its original English description; once the owner edits it, their text is shown as typed.
export const DESC_I18N = {
  'paneer-tikka': { hi: 'पनीर, गाढ़े दही का मसाला, तंदूर में सेका हुआ', pa: 'ਪਨੀਰ, ਗਾੜ੍ਹੇ ਦਹੀਂ ਦਾ ਮਸਾਲਾ, ਤੰਦੂਰ ਵਿੱਚ ਸੇਕਿਆ ਹੋਇਆ' },
  'amritsari-fish': { hi: 'अजवाइन वाले बेसन में तली मछली, नींबू, चाट मसाला', pa: 'ਅਜਵਾਇਣ ਵਾਲੇ ਵੇਸਣ ਵਿੱਚ ਤਲੀ ਮੱਛੀ, ਨਿੰਬੂ, ਚਾਟ ਮਸਾਲਾ' },
  'hara-bhara-kebab': { hi: 'पालक, मटर और आलू की टिक्की, पुदीने की चटनी के साथ', pa: 'ਪਾਲਕ, ਮਟਰ ਅਤੇ ਆਲੂ ਦੀ ਟਿੱਕੀ, ਪੁਦੀਨੇ ਦੀ ਚਟਨੀ ਨਾਲ' },
  'chicken-65': { hi: 'हरी मिर्च और करी पत्ते के साथ कड़ाही में भुना', pa: 'ਹਰੀ ਮਿਰਚ ਅਤੇ ਕੜੀ ਪੱਤੇ ਨਾਲ ਕੜਾਹੀ ਵਿੱਚ ਭੁੰਨਿਆ' },
  'tandoori-chicken': { hi: 'रात भर मसाले में रखा, फिर तंदूर में सेका हुआ', pa: 'ਸਾਰੀ ਰਾਤ ਮਸਾਲੇ ਵਿੱਚ ਰੱਖਿਆ, ਫਿਰ ਤੰਦੂਰ ਵਿੱਚ ਸੇਕਿਆ ਹੋਇਆ' },
  'malai-tikka': { hi: 'मलाई, चीज़ और इलायची — हल्का और रसीला', pa: 'ਮਲਾਈ, ਚੀਜ਼ ਅਤੇ ਇਲਾਇਚੀ — ਹਲਕਾ ਅਤੇ ਰਸੀਲਾ' },
  'soya-chaap': { hi: 'मक्खन और प्याज़ के छल्लों के साथ बाज़ार वाली चाप', pa: 'ਮੱਖਣ ਅਤੇ ਪਿਆਜ਼ ਦੇ ਛੱਲਿਆਂ ਨਾਲ ਬਾਜ਼ਾਰ ਵਾਲੀ ਚਾਪ' },
  'butter-chicken': { hi: 'टमाटर और मक्खन की मुलायम ग्रेवी में तंदूरी चिकन', pa: 'ਟਮਾਟਰ ਅਤੇ ਮੱਖਣ ਦੀ ਮੁਲਾਇਮ ਗ੍ਰੇਵੀ ਵਿੱਚ ਤੰਦੂਰੀ ਚਿਕਨ' },
  'dal-makhani': { hi: 'रात भर धीमी आँच पर पकी काली दाल, ऊपर से सफ़ेद मक्खन', pa: 'ਸਾਰੀ ਰਾਤ ਹੌਲੀ ਅੱਗ ਉੱਤੇ ਪੱਕੀ ਕਾਲੀ ਦਾਲ, ਉੱਤੋਂ ਚਿੱਟਾ ਮੱਖਣ' },
  'sarson-saag': { hi: 'सरसों का साग, ऊपर से सफ़ेद मक्खन (सर्दियों की खास डिश)', pa: 'ਸਰ੍ਹੋਂ ਦਾ ਸਾਗ, ਉੱਤੋਂ ਚਿੱਟਾ ਮੱਖਣ (ਸਰਦੀਆਂ ਦੀ ਖ਼ਾਸ ਡਿਸ਼)' },
  'kadhai-paneer': { hi: 'पनीर, शिमला मिर्च और ताज़ा पिसा कड़ाही मसाला', pa: 'ਪਨੀਰ, ਸ਼ਿਮਲਾ ਮਿਰਚ ਅਤੇ ਤਾਜ਼ਾ ਪੀਸਿਆ ਕੜਾਹੀ ਮਸਾਲਾ' },
  chole: { hi: 'अनारदाना और अमचूर वाले गहरे, खट्टे छोले', pa: 'ਅਨਾਰਦਾਣੇ ਅਤੇ ਅੰਬਚੂਰ ਵਾਲੇ ਗੂੜ੍ਹੇ, ਖੱਟੇ ਛੋਲੇ' },
  rajma: { hi: 'घर जैसा राजमा, जैसा पंजाब को पसंद है', pa: 'ਘਰ ਵਰਗਾ ਰਾਜਮਾ, ਜਿਵੇਂ ਪੰਜਾਬ ਨੂੰ ਪਸੰਦ ਹੈ' },
  'mutton-rogan': { hi: 'धीमी आँच पर पका मटन, कश्मीरी मिर्च, साबुत मसाले', pa: 'ਹੌਲੀ ਅੱਗ ਉੱਤੇ ਪੱਕਿਆ ਮਟਨ, ਕਸ਼ਮੀਰੀ ਮਿਰਚ, ਸਾਬਤ ਮਸਾਲੇ' },
  'makki-roti': { hi: 'हाथ से थपथपाकर बनी मक्की के आटे की रोटी', pa: 'ਹੱਥ ਨਾਲ ਥਾਪ ਕੇ ਬਣੀ ਮੱਕੀ ਦੇ ਆਟੇ ਦੀ ਰੋਟੀ' },
  'butter-naan': { hi: 'मक्खन लगा नरम तंदूरी नान', pa: 'ਮੱਖਣ ਲੱਗਿਆ ਨਰਮ ਤੰਦੂਰੀ ਨਾਨ' },
  'garlic-naan': { hi: 'ऊपर से लहसुन और हरा धनिया', pa: 'ਉੱਤੋਂ ਲਸਣ ਅਤੇ ਹਰਾ ਧਨੀਆ' },
  'lachha-paratha': { hi: 'परतदार, खस्ता गेहूँ का पराठा', pa: 'ਪਰਤਾਂ ਵਾਲਾ, ਖ਼ਸਤਾ ਕਣਕ ਦਾ ਪਰੌਂਠਾ' },
  'amritsari-kulcha': { hi: 'मसालेदार आलू भरा, छोलों के साथ', pa: 'ਮਸਾਲੇਦਾਰ ਆਲੂ ਭਰਿਆ, ਛੋਲਿਆਂ ਨਾਲ' },
  'jeera-rice': { hi: 'जीरे के तड़के वाले बासमती चावल', pa: 'ਜੀਰੇ ਦੇ ਤੜਕੇ ਵਾਲੇ ਬਾਸਮਤੀ ਚੌਲ' },
  'veg-biryani': { hi: 'सब्ज़ियों और केसर के साथ परतों में बनी बासमती', pa: 'ਸਬਜ਼ੀਆਂ ਅਤੇ ਕੇਸਰ ਨਾਲ ਪਰਤਾਂ ਵਿੱਚ ਬਣੀ ਬਾਸਮਤੀ' },
  'chicken-biryani': { hi: 'तले प्याज़ और पुदीने के साथ धीमी आँच पर पकी', pa: 'ਤਲੇ ਪਿਆਜ਼ ਅਤੇ ਪੁਦੀਨੇ ਨਾਲ ਹੌਲੀ ਅੱਗ ਉੱਤੇ ਪੱਕੀ' },
  'gulab-jamun': { hi: 'गरम, इलायची वाली चाशनी में डूबे', pa: 'ਗਰਮ, ਇਲਾਇਚੀ ਵਾਲੀ ਚਾਸ਼ਨੀ ਵਿੱਚ ਡੁੱਬੇ' },
  phirni: { hi: 'पिसे चावल की खीर, मिट्टी के बर्तनों में जमी', pa: 'ਪੀਸੇ ਚੌਲਾਂ ਦੀ ਖੀਰ, ਮਿੱਟੀ ਦੇ ਭਾਂਡਿਆਂ ਵਿੱਚ ਜੰਮੀ' },
  'gajar-halwa': { hi: 'धीमी आँच पर पकी गाजर, खोया और मेवे', pa: 'ਹੌਲੀ ਅੱਗ ਉੱਤੇ ਪੱਕੀ ਗਾਜਰ, ਖੋਆ ਅਤੇ ਮੇਵੇ' },
  lassi: { hi: 'मलाई वाली मीठी लस्सी का बड़ा गिलास', pa: 'ਮਲਾਈ ਵਾਲੀ ਮਿੱਠੀ ਲੱਸੀ ਦਾ ਵੱਡਾ ਗਲਾਸ' },
  'masala-chaas': { hi: 'भुने जीरे वाली मसालेदार छाछ', pa: 'ਭੁੰਨੇ ਜੀਰੇ ਵਾਲੀ ਮਸਾਲੇਦਾਰ ਛਾਛ' },
  'masala-chai': { hi: 'अदरक-इलायची वाली चाय, मिट्टी के कुल्हड़ में', pa: 'ਅਦਰਕ-ਇਲਾਇਚੀ ਵਾਲੀ ਚਾਹ, ਮਿੱਟੀ ਦੇ ਕੁੱਲ੍ਹੜ ਵਿੱਚ' },
};
const SEED_DESC = Object.fromEntries(M.map((r) => [r[0], r[8]]));

/** Dish description in the chosen language (falls back to the text the owner typed). */
export function itemDesc(item, lang) {
  if (!item) return '';
  const tr = DESC_I18N[item.id];
  if (lang !== 'en' && tr && tr[lang] && item.desc === SEED_DESC[item.id]) return tr[lang];
  return item.desc || '';
}

// Sample notes and addresses used in the demo orders and bookings.
export const SAMPLE_TEXT = {
  'Less spicy please': { hi: 'कृपया कम तीखा', pa: 'ਕਿਰਪਾ ਕਰਕੇ ਘੱਟ ਤਿੱਖਾ' },
  'Birthday — needs a cake knife': { hi: 'जन्मदिन — केक काटने के लिए चाकू चाहिए', pa: 'ਜਨਮਦਿਨ — ਕੇਕ ਕੱਟਣ ਲਈ ਚਾਕੂ ਚਾਹੀਦਾ ਹੈ' },
  'Window table if possible': { hi: 'हो सके तो खिड़की वाली टेबल', pa: 'ਹੋ ਸਕੇ ਤਾਂ ਖਿੜਕੀ ਵਾਲਾ ਟੇਬਲ' },
  'Family dinner, 2 kids': { hi: 'परिवार के साथ डिनर, 2 बच्चे', pa: 'ਪਰਿਵਾਰ ਨਾਲ ਡਿਨਰ, 2 ਬੱਚੇ' },
  'Office lunch': { hi: 'ऑफ़िस लंच', pa: 'ਦਫ਼ਤਰ ਦਾ ਲੰਚ' },
  'Sample address, Sector 5': { hi: 'नमूना पता, सेक्टर 5', pa: 'ਨਮੂਨਾ ਪਤਾ, ਸੈਕਟਰ 5' },
};
/** A sample note in the chosen language; anything a customer or the owner typed is shown as it is. */
export const sampleText = (s, lang) => (lang !== 'en' && SAMPLE_TEXT[s] && SAMPLE_TEXT[s][lang]) || s || '';

export function seedMenu() {
  return M.map(([id, cat, price, veg, spice, en, hi, pa, desc]) => ({
    id, cat, price, veg: !!veg, spice, name: { en, hi, pa }, desc, photo: '', available: true,
    special: ['sarson-saag', 'amritsari-kulcha'].includes(id),
  }));
}

function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }
const FIRST = ['Aman', 'Simran', 'Rohan', 'Jasleen', 'Gurpreet', 'Neha', 'Karan', 'Harleen', 'Vikas', 'Mehak', 'Arjun', 'Ravneet', 'Ishaan', 'Pooja', 'Manjot', 'Sahil', 'Kirat', 'Tanya'];
const LAST = ['Sandhu', 'Arora', 'Gill', 'Sharma', 'Kaur', 'Singh', 'Bedi', 'Malhotra', 'Dhillon', 'Grewal'];

export function seedRestaurant(today = todayISO()) {
  const r = rng(7781);
  const menu = seedMenu();
  const pick = (a) => a[Math.floor(r() * a.length)];
  const people = Array.from({ length: 26 }, (_, i) => ({ name: `${pick(FIRST)} ${pick(LAST)}`, phone: `5${String(400000000 + i * 7919 * 13).slice(0, 9)}` }));
  const popular = ['butter-chicken', 'dal-makhani', 'butter-naan', 'paneer-tikka', 'amritsari-kulcha', 'lassi', 'chole', 'garlic-naan', 'chicken-biryani', 'kadhai-paneer'];
  const settings = { name: 'Spice Route Rasoi', gstPct: 5, delivery: 40, pin: '1234', tables: 12 };
  const orders = [];
  let no = 1000;
  for (let d = 20; d >= 0; d--) {
    const date = addDays(today, -d);
    const n = d === 0 ? 7 : 6 + Math.floor(r() * 9);
    for (let k = 0; k < n; k++) {
      const lines = [];
      const items = 1 + Math.floor(r() * 4);
      for (let j = 0; j < items; j++) {
        const id = r() < 0.65 ? pick(popular) : pick(menu).id;
        const m = menu.find((x) => x.id === id);
        const ex = lines.find((l) => l.id === id);
        if (ex) ex.qty++; else lines.push({ id, name: m.name.en, price: m.price, qty: 1 + (m.cat === 'breads' ? Math.floor(r() * 3) : 0) });
      }
      const type = pick(['delivery', 'pickup', 'dine-in', 'dine-in']);
      const tot = billTotals(lines, { gstPct: settings.gstPct, delivery: type === 'delivery' ? settings.delivery : 0 });
      const cust = r() < 0.55 ? pick(people.slice(0, 8)) : pick(people);
      const h = 12 + Math.floor(r() * 10);
      const status = d > 0 ? (r() < 0.05 ? 'cancelled' : 'delivered') : ['new', 'new', 'preparing', 'preparing', 'ready', 'delivered', 'delivered'][k];
      no++;
      orders.push({
        id: `o${no}`, no, date, time: `${String(d === 0 ? 11 + k : h).padStart(2, '0')}:${String(Math.floor(r() * 60)).padStart(2, '0')}`,
        lines, ...tot, type, table: type === 'dine-in' ? 1 + Math.floor(r() * 12) : '', customer: { ...cust, address: type === 'delivery' ? 'Sample address, Sector 5' : '' },
        note: r() < 0.15 ? 'Less spicy please' : '', status, source: r() < 0.4 ? 'web' : 'counter',
      });
    }
  }
  const reservations = [
    [0, '13:30', 4, 'confirmed', 'Birthday — needs a cake knife'], [0, '20:00', 6, 'pending', ''], [0, '21:00', 2, 'confirmed', 'Window table if possible'],
    [1, '19:30', 8, 'pending', 'Family dinner, 2 kids'], [1, '20:30', 3, 'confirmed', ''], [2, '13:00', 10, 'pending', 'Office lunch'], [-1, '20:00', 4, 'seated', ''], [-2, '21:00', 2, 'noshow', ''],
  ].map(([d, time, guests, status, note], i) => ({ id: `r${i + 1}`, date: addDays(today, d), time, guests, status, note, ...people[i + 3], createdAt: addDays(today, Math.min(d, 0) - 1) }));
  return { settings, menu, orders, reservations, counters: { order: no }, seededFor: today };
}

/** "Start with an empty business": no orders, bookings or customers. The menu (categories, dishes, prices) and settings stay
 *  so the owner only edits what differs; the website menu keeps working. */
export function emptyRestaurant(current) {
  return { settings: current.settings, menu: current.menu || seedMenu(), orders: [], reservations: [], counters: { order: 0 } };
}

export const restStore = createStore({ key: REST_KEY, version: 1, seed: () => seedRestaurant(), empty: emptyRestaurant });
export const itemName = (item, lang) => (item.name && (item.name[lang] || item.name.en)) || item.name || '';

const CAT_COLORS = { starters: ['#e9a23b', '#b5541c'], tandoor: ['#d9572b', '#8c2a14'], mains: ['#c8682c', '#7a2d10'], breads: ['#e7c27d', '#a4743a'], rice: ['#f1d58a', '#b78a2e'], desserts: ['#e39a9a', '#9b3d3d'], drinks: ['#f3e6c4', '#b89a58'] };
/** Generated illustrated "plate" for dishes without a photo. */
export function dishArt(item, size = 120) {
  const [a, b] = CAT_COLORS[item.cat] || CAT_COLORS.mains;
  let h = 0;
  for (const c of item.id) h = (h * 31 + c.charCodeAt(0)) % 997;
  const dots = Array.from({ length: 7 }, (_, i) => { const ang = (h + i * 53) % 360 * Math.PI / 180; const rr = 14 + ((h * (i + 3)) % 18); return `<circle cx="${60 + Math.cos(ang) * rr}" cy="${60 + Math.sin(ang) * rr}" r="${2 + (i % 3)}" fill="${i % 2 ? '#3f7d2a' : '#fff6dc'}" opacity=".9"/>`; }).join('');
  const shape = item.cat === 'breads' ? `<ellipse cx="60" cy="60" rx="34" ry="26" fill="${a}" transform="rotate(${h % 40 - 20} 60 60)"/><ellipse cx="52" cy="54" rx="5" ry="3" fill="${b}" opacity=".5"/><ellipse cx="70" cy="66" rx="6" ry="3" fill="${b}" opacity=".5"/>`
    : item.cat === 'drinks' ? `<path d="M44 32h32l-4 56H48z" fill="${a}"/><path d="M44 32h32l-1 10H45z" fill="#fff" opacity=".7"/>`
      : `<circle cx="60" cy="60" r="34" fill="url(#g${item.id})"/>${dots}`;
  return `<svg viewBox="0 0 120 120" width="${size}" height="${size}" aria-hidden="true"><defs><radialGradient id="g${item.id}" cx=".4" cy=".35"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient></defs><circle cx="60" cy="60" r="52" fill="#fbf4e8"/><circle cx="60" cy="60" r="44" fill="none" stroke="#e8dcc4" stroke-width="2"/>${shape}</svg>`;
}
