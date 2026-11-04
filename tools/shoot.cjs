// QA screenshots: node tools/shoot.cjs <outDir> <base> <path1> [path2 ...]
// Env: WIDTHS="360,414,1280" LANGS="en,hi,pa" UNLOCK=key (sets sessionStorage `${key}.unlocked`) FULL=1
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const [out, base, ...paths] = process.argv.slice(2);
  const widths = (process.env.WIDTHS || '360,414,1280').split(',').map(Number);
  const langs = (process.env.LANGS || 'en,hi,pa').split(',');
  const unlock = process.env.UNLOCK || '';
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  let errors = 0;
  for (const w of widths) {
    for (const lang of langs) {
      const ctx = await browser.newContext({ viewport: { width: w, height: w < 700 ? 780 : 860 }, deviceScaleFactor: 1, serviceWorkers: 'block', reducedMotion: process.env.FULL ? 'reduce' : 'no-preference' });
      await ctx.addInitScript(([l, k]) => { try { localStorage.setItem('lbd.lang', l); if (k) sessionStorage.setItem(`${k}.unlocked`, '1'); } catch (e) {} }, [lang, unlock]);
      const page = await ctx.newPage();
      page.on('console', (m) => { if (m.type() === 'error') { errors++; console.log(`[console ${w} ${lang}]`, m.text()); } });
      page.on('pageerror', (e) => { errors++; console.log(`[pageerror ${w} ${lang}]`, e.message); });
      for (const p of paths) {
        await page.goto(base + p, { waitUntil: 'networkidle' });
        await page.waitForTimeout(350);
        const name = `${p.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'root'}-${w}-${lang}.png`;
        await page.screenshot({ path: path.join(out, name), fullPage: !!process.env.FULL });
        // horizontal overflow check
        const ov = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (ov > 1) console.log(`[overflow ${ov}px] ${p} ${w} ${lang}`);
      }
      await ctx.close();
    }
  }
  await browser.close();
  console.log('done, console errors:', errors);
})();
