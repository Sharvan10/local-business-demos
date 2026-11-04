// Registers the owner app's service worker (scoped to the app folder) and wires "Install app" buttons.
let deferred = null;
const buttons = new Set();
const sync = () => buttons.forEach((b) => { b.hidden = !deferred; });

export function registerPWA({ onUpdate } = {}) {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    const reg = () => navigator.serviceWorker.register('./sw.js', { scope: './' }).then((r) => {
      r.addEventListener('updatefound', () => {
        const w = r.installing;
        if (w) w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller && onUpdate) onUpdate(); });
      });
    }).catch((e) => console.warn('SW registration failed', e));
    if (document.readyState === 'complete') reg(); else window.addEventListener('load', reg);
  }
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; sync(); });
  window.addEventListener('appinstalled', () => { deferred = null; sync(); });
}

export function bindInstallButton(btn) {
  if (!btn) return;
  buttons.add(btn);
  sync();
  btn.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    sync();
  });
}
