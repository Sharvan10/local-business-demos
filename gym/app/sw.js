/* IronCore owner app service worker — scope: /gym/app/ */
importScripts('../../shared/sw-core.js');
self.setupSW({
  name: 'ironcore-app',
  version: 'v1',
  files: [
    './', './index.html', './manifest.json', './css/app.css', './js/app.js', './js/logic.js', './js/seed.js',
    './icons/icon-192.png', './icons/icon-512.png',
    '../../js/i18n-gym-app.js', '../../js/config.js',
    '../../shared/tokens.css', '../../shared/app.css', '../../shared/fonts.css',
    '../../shared/storage.js', '../../shared/i18n.js', '../../shared/dates.js', '../../shared/ui.js', '../../shared/wa.js',
    '../../shared/icons.js', '../../shared/chart.js', '../../shared/csv.js', '../../shared/pin.js', '../../shared/pwa.js',
    '../../shared/fonts/inter-latin-400-normal.woff2', '../../shared/fonts/inter-latin-600-normal.woff2', '../../shared/fonts/inter-latin-800-normal.woff2',
    '../../shared/fonts/bebas-neue-latin-400-normal.woff2',
    '../../shared/fonts/noto-sans-devanagari-devanagari-400-normal.woff2', '../../shared/fonts/noto-sans-devanagari-devanagari-700-normal.woff2',
    '../../shared/fonts/noto-sans-gurmukhi-gurmukhi-400-normal.woff2', '../../shared/fonts/noto-sans-gurmukhi-gurmukhi-700-normal.woff2',
  ],
});
