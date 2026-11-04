// Finds elements that push the page wider than the viewport: node tools/overflow.cjs <url> [unlockKey] [width]
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: Number(process.argv[4] || 360), height: 780 } });
  await c.addInitScript((k) => { if (k) sessionStorage.setItem(k + '.unlocked', '1'); }, process.argv[3] || '');
  const p = await c.newPage();
  await p.goto(process.argv[2], { waitUntil: 'networkidle' });
  const r = await p.evaluate(() => {
    const W = innerWidth;
    const clipped = (e) => { for (let a = e.parentElement; a; a = a.parentElement) { const s = getComputedStyle(a); if (['auto', 'scroll', 'hidden', 'clip'].includes(s.overflowX)) return true; } return false; };
    return [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.right > W + 1 && r.width > 0 && !clipped(e); })
      .slice(0, 12).map((e) => `${e.tagName}.${e.className} ${Math.round(e.getBoundingClientRect().right)}`);
  });
  console.log(r.join('\n') || 'no overflow');
  await b.close();
})();
