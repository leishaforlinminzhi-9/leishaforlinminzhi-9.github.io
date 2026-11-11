// The collage itself, shared by the game and by the love calendar (which imports this file from the published page to show
// a 回音 hung from here as its picture): how a cut-out word looks, the #p= link format, the reading order, the picture.
// No side effects on import, and every URL is resolved against this file, so it works from any page.

export const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&family=Noto+Sans+SC:wght@900&family=Noto+Serif+SC:wght@700;900&family=ZCOOL+KuaiLe&family=ZCOOL+QingKe+HuangYou&display=swap';
const TAPE = ['#f19bb8', '#8fb0cf']; // pink, blue

export const BW = 750, BH = 1000; // the sheet, in logical units
const FONTS = {
  serif: '"Noto Serif SC", serif', sans: '"Noto Sans SC", sans-serif', kuaile: '"ZCOOL KuaiLe", sans-serif',
  mashan: '"Ma Shan Zheng", cursive', qingke: '"ZCOOL QingKe HuangYou", sans-serif',
};
// newsprint, magazine black, poster red, ... (index is stored in the link: append, never reorder)
export const STYLES = [
  ['#f3eee2', '#1b1b1b', 'serif', 900, 40], ['#161616', '#f7f2e8', 'sans', 900, 36], ['#d8332f', '#ffffff', 'sans', 900, 38],
  ['#f6d23c', '#1d1d1d', 'kuaile', 400, 42], ['#c9a27a', '#2b1d12', 'mashan', 400, 46], ['#f7c1cf', '#7a1236', 'serif', 700, 40],
  ['#2f5fb3', '#fff6d8', 'qingke', 400, 44], ['#ffffff', '#d8332f', 'serif', 900, 42], ['#bcd9ac', '#1f3d1b', 'sans', 900, 36],
  ['#e4e1da', '#333333', 'mashan', 400, 44], ['#f08a3c', '#ffffff', 'kuaile', 400, 40], ['#1f2a4d', '#f6d23c', 'serif', 900, 40],
].map(([bg, fg, f, w, fs]) => ({ bg, fg, font: FONTS[f], w, fs }));

// ---------- how a cut-out word looks (all derived from text + style + a 3-bit seed, so a link can redraw it) ----------

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.codePointAt(0)) | 0, 7);
export const PUNCT = /^[，。！？、…,.!?]+$/;
const looks = new Map();
export function look(t) {
  const key = `${t.t}|${t.s}|${t.seed}`;
  if (looks.has(key)) return looks.get(key);
  const r = rng(hash(t.t) * 8 + t.seed);
  const st = STYLES[t.s] ?? STYLES[0];
  const fs = Math.round(st.fs * (0.85 + r() * 0.35) * (PUNCT.test(t.t) ? 0.8 : 1));
  // a torn outline: corners pulled in a little, a few nicks along each edge (percent of the box)
  const j = (a) => +(r() * a).toFixed(1);
  const poly = [
    [j(4), j(8)], [25 + j(10), j(7)], [55 + j(10), j(6)], [100 - j(4), j(9)],
    [100 - j(4), 50 + j(10) - 5], [100 - j(5), 100 - j(9)], [60 + j(10), 100 - j(6)], [30 + j(10), 100 - j(8)],
    [j(5), 100 - j(9)], [j(4), 45 + j(10)],
  ];
  const l = { ...st, fs, padX: fs * 0.34, padY: fs * 0.28, poly, tapeL: 8 + r() * 40, tapeR: -14 + r() * 28 };
  looks.set(key, l);
  return l;
}

// ---------- the link: a version byte, the day (2 bytes), then per word x y (8 bits each), rotation + style, owner + seed + length, UTF-16 ----------

const EPOCH = Date.UTC(2020, 0, 1);
export function encode(tiles, at) {
  // the day as it is where the poem was made (a poem stuck together late on the 31st is a poem of the 31st)
  const local = new Date(at);
  const d = Math.max(0, Math.round((Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()) - EPOCH) / 86400000));
  const bytes = [1, d >> 8, d & 255];
  for (const t of tiles) {
    const units = t.t.slice(0, 15);
    bytes.push(
      Math.round((t.x / BW) * 255), Math.round((t.y / BH) * 255),
      ((t.r + 7) << 4) | t.s, (t.o << 7) | (t.seed << 4) | units.length,
    );
    for (let i = 0; i < units.length; i++) bytes.push(units.charCodeAt(i) >> 8, units.charCodeAt(i) & 255);
  }
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decode(code) {
  const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
  const b = [...bin].map((c) => c.charCodeAt(0));
  if (b[0] !== 1) throw new Error('unknown version');
  const tiles = [];
  tiles.at = EPOCH + ((b[1] << 8) | b[2]) * 86400000 + 43200000; // midday, so the day is right in any time zone
  for (let i = 3; i + 4 <= b.length; ) {
    const [x, y, rs, osl] = b.slice(i, i + 4);
    i += 4;
    const n = osl & 15;
    let text = '';
    for (let j = 0; j < n; j++, i += 2) text += String.fromCharCode((b[i] << 8) | b[i + 1]);
    tiles.push({ id: `d${tiles.length}`, t: text, x: (x / 255) * BW, y: (y / 255) * BH, r: (rs >> 4) - 7, s: rs & 15, o: osl >> 7, seed: (osl >> 4) & 7 });
  }
  return tiles;
}

// reading order: rows by height on the sheet, left to right inside a row
export function poemText(tiles) {
  const rows = [];
  for (const t of [...tiles].sort((a, b) => a.y - b.y)) {
    const row = rows.at(-1);
    if (row && t.y - row.y < 34) {
      row.items.push(t);
      row.y = row.items.reduce((s, i) => s + i.y, 0) / row.items.length;
    } else rows.push({ y: t.y, items: [t] });
  }
  return rows.map((r) => r.items.sort((a, b) => a.x - b.x).map((t) => t.t).join('')).join('\n');
}

// ---------- the picture ----------

export const day = (ms) => { const d = new Date(ms); return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`; };
// the page that uses this may not have the fonts yet (the calendar): add the stylesheet once
function ensureFonts() {
  if ([...document.querySelectorAll('link[rel=stylesheet]')].some((l) => l.href === FONT_CSS)) return;
  document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: FONT_CSS }));
}
let faces = null; // loaded on first use; crossOrigin so a page on another host can still turn the canvas into an image
const facesNow = () => (faces ??= ['dog', 'cat'].map((n) => Object.assign(new Image(), { crossOrigin: 'anonymous', src: new URL(`assets/${n}.webp`, import.meta.url).href })));
export async function render(tiles, scale, stamp) {
  ensureFonts();
  // a slow network must not leave the picture blank forever: after 4 s it is drawn with whatever fonts have arrived
  const late = (p) => Promise.race([p.catch(() => {}), new Promise((r) => setTimeout(r, 4000))]);
  await late(Promise.all(tiles.map((t) => { const l = look(t); return document.fonts.load(`${l.w} ${l.fs}px ${l.font}`, t.t); })));
  if (stamp) await late(Promise.all(facesNow().map((f) => f.decode())));
  const c = document.createElement('canvas');
  c.width = BW * scale;
  c.height = BH * scale;
  const g = c.getContext('2d');
  g.scale(scale, scale);
  g.fillStyle = '#f6f0e3';
  g.fillRect(0, 0, BW, BH);
  const r = rng(42);
  g.fillStyle = 'rgba(120,90,60,.08)';
  for (let i = 0; i < 2600; i++) g.fillRect(r() * BW, r() * BH, 1.4, 1.4);
  for (const t of tiles) {
    const l = look(t);
    g.save();
    g.translate(t.x, t.y);
    g.rotate((t.r * Math.PI) / 180);
    g.font = `${l.w} ${l.fs}px ${l.font}`;
    const w = g.measureText(t.t).width + l.padX * 2, h = l.fs + l.padY * 2;
    g.translate(-w / 2, -h / 2);
    g.beginPath();
    l.poly.forEach(([x, y], i) => g[i ? 'lineTo' : 'moveTo']((x / 100) * w, (y / 100) * h));
    g.closePath();
    Object.assign(g, { shadowColor: 'rgba(0,0,0,.28)', shadowBlur: 3, shadowOffsetY: 1.5, fillStyle: l.bg });
    g.fill();
    g.shadowColor = 'transparent';
    g.fillStyle = l.fg;
    g.textBaseline = 'middle';
    g.textAlign = 'center';
    g.fillText(t.t, w / 2, h / 2 + l.fs * 0.04);
    // a strip of washi tape in the colour of whoever stuck it
    const tw = Math.max(16, w * 0.46), th = h * 0.34;
    g.translate((l.tapeL / 100) * w + tw / 2, -h * 0.14 + th / 2);
    g.rotate((l.tapeR * Math.PI) / 180);
    g.globalAlpha = 0.78;
    g.fillStyle = TAPE[t.o];
    g.fillRect(-tw / 2, -th / 2, tw, th);
    g.restore();
  }
  if (stamp) {
    g.save();
    facesNow().forEach((f, i) => {
      const cx = BW - 112 + i * 52, cy = BH - 52;
      g.beginPath();
      g.arc(cx, cy, 24, 0, Math.PI * 2);
      g.fillStyle = '#fff8ec';
      g.fill();
      g.save();
      g.clip();
      if (f.naturalWidth) g.drawImage(f, cx - 24, cy - 24, 48, 48);
      g.restore();
    });
    g.fillStyle = '#9c8a74';
    g.font = '700 20px "Noto Serif SC", serif';
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    g.fillText(stamp, BW - 150, BH - 52);
    g.restore();
  }
  return c;
}
