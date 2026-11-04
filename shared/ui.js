// Small DOM helpers shared by all public sites and owner apps.
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function esc(v) { return v === null || v === undefined ? '' : String(v).replace(/[&<>"']/g, (c) => ESC[c]); }

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('en-IN');
export function money(n) { return inr.format(Math.round(Number(n) || 0)); }
export function fmtNum(n) { return num.format(Number(n) || 0); }

export function debounce(fn, ms = 150) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
export function uid(prefix = '') { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

export function initials(name = '') { return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?'; }
export function hueFor(str = '') { let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
export function avatar(name, photo, size = 44) {
  if (photo) return `<img class="avatar" src="${esc(photo)}" alt="" width="${size}" height="${size}" loading="lazy" style="width:${size}px;height:${size}px">`;
  return `<span class="avatar" aria-hidden="true" style="width:${size}px;height:${size}px;--h:${hueFor(name)}">${esc(initials(name))}</span>`;
}

let toastEl;
export function toast(msg, type = '') {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    toastEl.setAttribute('role', 'status');
    toastEl.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.className = `toast show ${type}`;
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => { toastEl.className = 'toast'; }, 2600);
}

/** Bottom sheet built on <dialog>. Returns { el, close }. */
export function sheet({ title = '', body = '', wide = false, onClose } = {}) {
  const d = document.createElement('dialog');
  d.className = `sheet${wide ? ' wide' : ''}`;
  d.innerHTML = `<div class="sheet-inner"><div class="sheet-head"><h2 class="sheet-title">${esc(title)}</h2><button type="button" class="icon-btn sheet-x" aria-label="Close">✕</button></div><div class="sheet-body">${body}</div></div>`;
  document.body.appendChild(d);
  const close = () => { if (d.open) d.close(); };
  d.addEventListener('close', () => { d.parentNode && d.parentNode.removeChild(d); if (onClose) onClose(); });
  d.addEventListener('click', (e) => { if (e.target === d) close(); });
  d.querySelector('.sheet-x').addEventListener('click', close);
  d.showModal();
  const first = d.querySelector('.sheet-body [autofocus]');
  if (first) first.focus();
  return { el: d, close };
}

export function confirmBox(message, { ok = 'OK', cancel = 'Cancel', title = '', danger = false } = {}) {
  return new Promise((resolve) => {
    let result = false;
    const s = sheet({
      title,
      body: `<p class="confirm-msg">${esc(message)}</p><div class="btn-row"><button type="button" class="btn ghost" data-a="no">${esc(cancel)}</button><button type="button" class="btn ${danger ? 'danger' : 'primary'}" data-a="yes">${esc(ok)}</button></div>`,
      onClose: () => resolve(result),
    });
    s.el.addEventListener('click', (e) => { const a = e.target.closest('[data-a]'); if (!a) return; result = a.dataset.a === 'yes'; s.close(); });
  });
}

/** Print an HTML fragment (receipts, bills, statements) using @media print rules. */
export function printHTML(html) {
  let root = document.getElementById('print-root');
  if (!root) { root = document.createElement('div'); root.id = 'print-root'; document.body.appendChild(root); }
  root.innerHTML = html;
  document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); root.innerHTML = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 50);
}

export function download(filename, text, type = 'text/plain') {
  const blob = text instanceof Blob ? text : new Blob([text], { type: `${type};charset=utf-8` });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.parentNode && a.parentNode.removeChild(a); }, 1000);
}

export function pickFile(accept = '.json,application/json') {
  return new Promise((resolve) => {
    const i = document.createElement('input');
    i.type = 'file';
    i.accept = accept;
    i.onchange = () => resolve(i.files[0] || null);
    i.click();
  });
}
export function readText(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(file); });
}

/** Downscale a photo to a small JPEG data URL so it fits in localStorage. */
export function resizeImage(file, max = 192) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/** Fade/slide sections in as they scroll into view (skipped for reduced motion). */
export function revealOnScroll(sel = '.reveal') {
  document.documentElement.classList.add('js');
  const els = $$(sel);
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) { els.forEach((e) => e.classList.add('in')); return; }
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  els.forEach((e) => io.observe(e));
}

export function formData(form) {
  const o = {};
  new FormData(form).forEach((v, k) => { o[k] = typeof v === 'string' ? v.trim() : v; });
  return o;
}

/** Share a canvas as a PNG image (Web Share API with files) or fall back to downloading it. */
export async function shareCanvas(canvas, filename = 'image.png', title = '') {
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); return 'shared'; } catch (e) { if (e.name === 'AbortError') return 'cancelled'; }
  }
  download(filename, blob);
  return 'downloaded';
}

/** Wrap canvas text onto lines that fit maxWidth. */
export function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}
