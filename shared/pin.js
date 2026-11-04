// Demo PIN lock screen. This is a convenience lock for a shared phone, NOT real security
// (data lives unencrypted in localStorage). A production version uses real auth (see README).
import { esc } from './ui.js';

export function pinGate({ appKey, getPin, t, brand = '', logo = '', onUnlock }) {
  const sk = `${appKey}.unlocked`;
  try { if (sessionStorage.getItem(sk) === '1') { onUnlock(); return; } } catch { /* ignore */ }
  const pin = String(getPin() || '1234');
  const el = document.createElement('div');
  el.className = 'pin-screen';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'pin-title');
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];
  el.innerHTML = `
    <div class="pin-card">
      <div class="pin-logo" aria-hidden="true">${logo}</div>
      <p class="pin-brand">${esc(brand)}</p>
      <h1 id="pin-title" class="pin-title">${esc(t('pin.title'))}</h1>
      <div class="pin-dots" aria-hidden="true">${'<span></span>'.repeat(pin.length)}</div>
      <p class="pin-msg" role="alert" aria-live="assertive"></p>
      <label class="sr-only" for="pin-input">${esc(t('pin.title'))}</label>
      <input id="pin-input" class="pin-input" type="password" inputmode="numeric" autocomplete="off" maxlength="${pin.length}">
      <div class="pin-pad">${keys.map((k) => `<button type="button" class="pin-key ${k === 'ok' ? 'ok' : ''}" data-k="${k}" aria-label="${k === 'del' ? esc(t('pin.delete')) : k === 'ok' ? esc(t('pin.enter')) : k}">${k === 'del' ? '⌫' : k === 'ok' ? '→' : k}</button>`).join('')}</div>
      ${pin === '1234' ? `<p class="pin-hint">${esc(t('pin.hint'))} <strong>1234</strong></p>` : ''}
    </div>`;
  document.body.appendChild(el);
  document.body.classList.add('locked');
  const input = el.querySelector('#pin-input');
  const dots = el.querySelectorAll('.pin-dots span');
  const msg = el.querySelector('.pin-msg');
  let val = '';
  const paint = () => dots.forEach((d, i) => d.classList.toggle('on', i < val.length));
  const check = () => {
    if (val === pin) {
      try { sessionStorage.setItem(sk, '1'); } catch { /* ignore */ }
      el.classList.add('out');
      document.body.classList.remove('locked');
      setTimeout(() => el.parentNode && el.parentNode.removeChild(el), 250);
      onUnlock();
    } else if (val.length >= pin.length) {
      msg.textContent = t('pin.wrong');
      el.querySelector('.pin-dots').classList.add('shake');
      setTimeout(() => el.querySelector('.pin-dots').classList.remove('shake'), 400);
      val = ''; input.value = ''; paint();
    }
  };
  el.querySelector('.pin-pad').addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]');
    if (!b) return;
    const k = b.dataset.k;
    if (k === 'del') val = val.slice(0, -1);
    else if (k === 'ok') { check(); return; } else if (val.length < pin.length) val += k;
    input.value = val; paint(); msg.textContent = '';
    if (val.length === pin.length) check();
  });
  input.addEventListener('input', () => { val = input.value.replace(/\D/g, '').slice(0, pin.length); input.value = val; paint(); if (val.length === pin.length) check(); });
  setTimeout(() => input.focus({ preventScroll: true }), 50);
}

export function lockNow(appKey) {
  try { sessionStorage.removeItem(`${appKey}.unlocked`); } catch { /* ignore */ }
  location.reload();
}
