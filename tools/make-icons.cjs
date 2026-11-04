// Renders the PWA icons (PNG) for each owner app from inline SVG using the pre-installed Playwright Chromium.
// Usage: node tools/make-icons.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const apps = [
  { dir: 'gym/app/icons', bg: '#0c0e12', fg: '#c6ff3d', text: 'IC', font: "'Bebas Neue'", fontFile: 'bebas-neue-latin-400-normal.woff2', weight: 400, size: 0.5, ring: '#ff7a2f' },
  { dir: 'restaurant/app/icons', bg: '#7a1f12', fg: '#ffd27a', text: 'SR', font: "'Fraunces'", fontFile: 'fraunces-latin-600-normal.woff2', weight: 600, size: 0.4, ring: '#e8902b' },
  { dir: 'jewellers/app/icons', bg: '#4a0d1a', fg: '#e3c178', text: 'SH', font: "'Cormorant Garamond'", fontFile: 'cormorant-garamond-latin-600-normal.woff2', weight: 600, size: 0.44, ring: '#e3c178' },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const a of apps) {
    fs.mkdirSync(a.dir, { recursive: true });
    const font = fs.readFileSync(path.join('shared/fonts', a.fontFile)).toString('base64');
    for (const [name, px, maskable] of [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['icon-maskable-512.png', 512, true]]) {
      const r = maskable ? 0 : px * 0.22;
      const inset = maskable ? px * 0.2 : px * 0.08;
      await page.setViewportSize({ width: px, height: px });
      await page.setContent(`<style>@font-face{font-family:${a.font};src:url(data:font/woff2;base64,${font})}html,body{margin:0;background:transparent}</style>
        <div style="width:${px}px;height:${px}px;border-radius:${r}px;background:radial-gradient(circle at 70% 20%, ${a.ring}55, transparent 55%),${a.bg};display:grid;place-items:center;overflow:hidden">
          <div style="width:${px - inset * 2}px;height:${px - inset * 2}px;border-radius:50%;border:${Math.max(3, px * 0.025)}px solid ${a.fg}55;display:grid;place-items:center">
            <span style="font-family:${a.font};font-weight:${a.weight};font-size:${px * a.size}px;color:${a.fg};line-height:1;letter-spacing:.02em">${a.text}</span>
          </div></div>`);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(a.dir, name), omitBackground: !maskable });
      console.log('wrote', path.join(a.dir, name));
    }
  }
  await browser.close();
})();
