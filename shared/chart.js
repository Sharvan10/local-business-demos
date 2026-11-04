// Dependency-free inline SVG charts. Colours come from CSS custom properties so they follow each theme.
import { esc } from './ui.js';

export function shortNum(v) {
  if (v >= 10000000) return (v / 10000000).toFixed(1).replace(/\.0$/, '') + 'Cr';
  if (v >= 100000) return (v / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
  if (v >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(Math.round(v));
}

/** Vertical bar chart. data: [{label, value, title?}] */
export function barChart(data, { height = 190, format = (v) => v, highlightLast = true, ariaLabel = 'Chart' } = {}) {
  const w = Math.max(320, data.length * 46);
  const padT = 24, padB = 28;
  const slot = w / Math.max(1, data.length);
  const bw = slot * 0.6;
  const max = Math.max(1, ...data.map((d) => d.value));
  const plotH = height - padT - padB;
  const bars = data.map((d, i) => {
    const x = slot * i + (slot - bw) / 2;
    const h = Math.max(d.value > 0 ? 3 : 0, (d.value / max) * plotH);
    const y = padT + plotH - h;
    const cls = highlightLast && i === data.length - 1 ? 'bar hi' : 'bar';
    return `<g><title>${esc(d.title || `${d.label}: ${format(d.value)}`)}</title>`
      + `<rect class="${cls}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="5"/>`
      + (d.value > 0 ? `<text class="bar-val" x="${(x + bw / 2).toFixed(1)}" y="${(y - 7).toFixed(1)}" text-anchor="middle">${esc(shortNum(d.value))}</text>` : '')
      + `<text class="bar-lbl" x="${(x + bw / 2).toFixed(1)}" y="${height - 9}" text-anchor="middle">${esc(d.label)}</text></g>`;
  }).join('');
  const small = data.length > 8 ? ' style="font-size:9px"' : '';
  return `<svg class="chart"${small} viewBox="0 0 ${w} ${height}" role="img" aria-label="${esc(ariaLabel)}" preserveAspectRatio="xMidYMid meet"><line class="axis" x1="0" x2="${w}" y1="${padT + plotH}" y2="${padT + plotH}"/>${bars}</svg>`;
}

/** Horizontal bars (best sellers, plan mix). */
export function hBars(data, { format = (v) => v } = {}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return `<div class="hbars">${data.map((d) => `<div class="hbar"><span class="hbar-lbl">${esc(d.label)}</span><span class="hbar-track"><span class="hbar-fill" style="width:${((d.value / max) * 100).toFixed(1)}%"></span></span><span class="hbar-val">${esc(format(d.value))}</span></div>`).join('')}</div>`;
}
