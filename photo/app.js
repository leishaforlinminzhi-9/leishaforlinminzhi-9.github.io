// 小狗跳进照片: pick a photo (or a video, e.g. a Live Photo saved as video), tap a spot, and the puppy from the desktop pet runs in,
// jumps up onto it, waves, sits and wags her tail. Tap her = pat, tap twice = kiss, tap elsewhere = she goes there; left alone she runs off.
// Everything is drawn on one canvas, so 录下来 records exactly what is on the screen.
import { LINES } from './lines.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
// ?test: the clock only moves when window.__advance(ms) is called (for checking it without a visible screen)
const TEST = params.has('test');
let fakeNow = 0;
const now = () => (TEST ? fakeNow : performance.now());
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const line = (kind) => pick(LINES[kind] ?? ['汪!']);

// ---------- the sprites (same sheet as the desktop pet and 和小狗玩) ----------
const CELL_W = 192, CELL_H = 208, SIT_H = 240, FOOT = 202, SIT_FOOT = 230;
const ROW = { idle: [0, 6], right: [1, 8], left: [2, 8], wave: [3, 4], jump: [4, 5] };
// sit.webp: 0 listening, 1 blink, 2 happy, 3 heart eyes (never used), 4 kiss
const SIT = { listen: 0, blink: 1, happy: 2, kiss: 4 };
const sheet = new Image(), sitImg = new Image();
sheet.src = 'assets/sheet.webp'; sitImg.src = 'assets/sit.webp';
// the tail of the sitting pictures, cut out so it can wag about its root (cell pixels)
const TAIL = [[139, 217], [139, 196], [142, 183], [148, 174], [155, 171], [162, 177], [163, 192], [159, 207], [152, 215], [145, 219]], TAIL_ROOT = [142, 212];
const sitParts = {};
sitImg.onload = () => {
  for (const [name, c] of Object.entries(SIT)) {
    const mk = () => { const cv = document.createElement('canvas'); cv.width = CELL_W; cv.height = SIT_H; return cv; };
    const body = mk(), tail = mk(), bg = body.getContext('2d'), tg = tail.getContext('2d');
    const path = (g) => { g.beginPath(); TAIL.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
    bg.drawImage(sitImg, c * CELL_W, 0, CELL_W, SIT_H, 0, 0, CELL_W, SIT_H); bg.globalCompositeOperation = 'destination-out'; path(bg); bg.fill();
    path(tg); tg.clip(); tg.drawImage(sitImg, c * CELL_W, 0, CELL_W, SIT_H, 0, 0, CELL_W, SIT_H);
    sitParts[name] = { body, tail };
  }
};

// ---------- the canvas and the picture ----------
const cv = $('scene'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
addEventListener('resize', resize); resize();
let media = null; // { el, w, h, video }
// the blurred backdrop: shrink the picture to a few pixels, then let two smooth enlargements spread it
const blur = document.createElement('canvas'), blur2 = document.createElement('canvas'); blur.width = 12; blur.height = 20; blur2.width = 60; blur2.height = 100; const blurG = blur.getContext('2d'), blur2G = blur2.getContext('2d');
// a photo fits inside the screen; the live camera fills it
const fit = () => { if (!media) return { x: 0, y: 0, w: W, h: H }; const s = (media.live ? Math.max : Math.min)(W / media.w, H / media.h); return { x: (W - media.w * s) / 2, y: (H - media.h * s) / 2, w: media.w * s, h: media.h * s }; };

function loadFile(file) {
  if (!file) return;
  stopCamera();
  const url = URL.createObjectURL(file);
  if (file.type.startsWith('video/')) {
    const v = document.createElement('video'); v.src = url; v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', '');
    v.onloadeddata = () => { media = { el: v, w: v.videoWidth, h: v.videoHeight, video: true }; v.play().catch(() => {}); ready(); };
  } else {
    const im = new Image(); im.onload = () => { media = { el: im, w: im.naturalWidth, h: im.naturalHeight, video: false }; ready(); }; im.src = url;
  }
}
function ready() {
  $('start').hidden = true; $('bar').hidden = false; dog.state = 'away'; dog.spot = null; bubble = null; hearts.length = 0;
  const r = fit(); size = clamp(Math.min(r.h * 0.27, r.w * 0.38), 110, 260);
  hint(media.live ? '对着桌子,点一下你想让她待的地方' : '点一下照片里,你想让她待的地方');
  found = []; if (!TEST) setTimeout(findSurfaces, media.live ? 1200 : 400);
}
$('file').addEventListener('change', (e) => { loadFile(e.target.files[0]); e.target.value = ''; });
for (const id of ['pick1', 'bPick']) $(id).addEventListener('click', () => $('file').click());
for (const id of ['cam1', 'bCam']) $(id).addEventListener('click', startCamera);
$('bFind').addEventListener('click', () => findSurfaces());

// ---------- the camera ("fake AR"): the live picture behind her; when the phone turns, she is moved the other way and seems to stay put ----------
let camStream = null;
async function startCamera() {
  // iPhone asks for the motion sensors only from inside a tap, so this comes first, before anything is awaited
  try { if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) DeviceOrientationEvent.requestPermission().catch(() => {}); } catch {}
  if (!navigator.mediaDevices?.getUserMedia) { hint('这个浏览器打不开相机', 3000); return; }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false }); }
  catch { hint('打不开相机:要在弹窗里允许使用相机', 3500); return; }
  stopCamera(); camStream = stream;
  const v = document.createElement('video'); v.srcObject = stream; v.muted = true; v.playsInline = true; v.setAttribute('playsinline', '');
  await v.play().catch(() => {});
  if (!v.videoWidth) await new Promise((r) => { v.onloadedmetadata = r; });
  media = { el: v, w: v.videoWidth, h: v.videoHeight, video: true, live: true }; refNow(); ready();
}
function stopCamera() { camStream?.getTracks().forEach((t) => t.stop()); camStream = null; }
// the phone's orientation (smoothed a little) and the rotation it stands for (W3C: device -> earth, Rz(alpha) Rx(beta) Ry(gamma))
let ori = null;
addEventListener('deviceorientation', (e) => {
  if (e.alpha == null) return;
  if (!ori) { ori = { a: e.alpha, b: e.beta, g: e.gamma }; return; }
  const k = 0.5, wrap = (d) => ((d + 540) % 360) - 180;
  ori.a = (ori.a + wrap(e.alpha - ori.a) * k + 360) % 360; ori.b += (e.beta - ori.b) * k; ori.g += wrap(e.gamma - ori.g) * k;
});
const RAD = Math.PI / 180;
function rotM({ a, b, g }) {
  const ca = Math.cos(a * RAD), sa = Math.sin(a * RAD), cb = Math.cos(b * RAD), sb = Math.sin(b * RAD), cg = Math.cos(g * RAD), sg = Math.sin(g * RAD);
  return [ca * cg - sa * sb * sg, -cb * sa, cg * sa * sb + ca * sg, cg * sa + ca * sb * sg, ca * cb, sa * sg - ca * cg * sb, -cb * sg, sb, cb * cg];
}
let Rref = null, Rcur = null; // the phone when she was placed / now
const FOCAL = 0.78; // focal length as a share of the camera picture's long side (about a 66 degree view on the long side)
const focal = () => Math.max(media.w, media.h) * Math.max(W / media.w, H / media.h) * FOCAL;
const isAR = () => !!(media?.live && Rref && Rcur);
function refNow() { Rref = ori ? rotM(ori) : null; Rcur = Rref; }
// a point on the screen as the phone was held at A, to where the same direction shows up when the phone is held at B
function project(p, A, B) {
  const f = focal(), dx = p.x - W / 2, dy = -(p.y - H / 2), dz = -f;
  const wx = A[0] * dx + A[1] * dy + A[2] * dz, wy = A[3] * dx + A[4] * dy + A[5] * dz, wz = A[6] * dx + A[7] * dy + A[8] * dz;
  const cx = B[0] * wx + B[3] * wy + B[6] * wz, cy = B[1] * wx + B[4] * wy + B[7] * wz, cz = B[2] * wx + B[5] * wy + B[8] * wz;
  if (cz > -1) return null; // behind the phone
  return { x: W / 2 + (f * cx) / -cz, y: H / 2 - (f * cy) / -cz };
}
const toScreen = (p) => (isAR() ? project(p, Rref, Rcur) : p);
const toRef = (p) => (isAR() ? project(p, Rcur, Rref) : p);
// how her spot shows now: where her feet land, which way is up, how big (a turned phone also turns and scales her a little)
let arM = null;
function arAt(x, y) {
  if (!isAR()) return null;
  const a = toScreen({ x, y }), b = toScreen({ x, y: y - 60 });
  if (!a || !b || a.x < -W || a.x > 2 * W || a.y < -H || a.y > 2 * H) return { hide: true };
  return { x: a.x, y: a.y, ang: Math.atan2(b.x - a.x, a.y - b.y), k: Math.hypot(b.x - a.x, b.y - a.y) / 60, rx: x, ry: y };
}
const inAR = (fn) => { if (arM?.hide) return; if (!arM) { fn(); return; } ctx.save(); ctx.translate(arM.x, arM.y); ctx.rotate(arM.ang); ctx.scale(arM.k, arM.k); ctx.translate(-arM.rx, -arM.ry); fn(); ctx.restore(); };

// ---------- 找桌面: a vision model on the calendar's server (Cloudflare Workers AI, Moondream) points at the flat places ----------
const APIS = params.get('api')?.split(',') ?? ['https://frabjous-boba-2c325c.netlify.app', 'https://love-calendar-api.linmz21.workers.dev'];
let found = [], areas = [], foundAt = -9e9, finding = false, showFound = false;
async function findSurfaces() {
  if (!media || finding) return; finding = true;
  const r = fit(), vis = { x: Math.max(0, r.x), y: Math.max(0, r.y) }; vis.w = Math.min(W, r.x + r.w) - vis.x; vis.h = Math.min(H, r.y + r.h) - vis.y;
  const k = 512 / Math.max(vis.w, vis.h), c = document.createElement('canvas'); c.width = Math.round(vis.w * k); c.height = Math.round(vis.h * k);
  c.getContext('2d').drawImage(media.el, ((vis.x - r.x) / r.w) * media.w, ((vis.y - r.y) / r.h) * media.h, (vis.w / r.w) * media.w, (vis.h / r.h) * media.h, 0, 0, c.width, c.height);
  const image = c.toDataURL('image/jpeg', 0.8), at = Rcur;
  hint('正在找桌面…');
  try {
    for (const base of APIS) {
      try {
        const res = await fetch(base + '/api/surfaces', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image }), signal: AbortSignal.timeout(20000) });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) { if (res.status === 429) { hint(out.message || '找得太频繁了,等一下再试', 3000); return; } continue; }
        useSurfaces(out.surfaces, vis, at, c.width, c.height); return;
      } catch { /* the next address */ }
    }
    hint('现在连不上识别,点一下她要待的地方吧', 3000);
  } finally { finding = false; }
}
function useSurfaces(list, vis, at, cw = 1, ch = 1) {
  if (media?.live && ori && (dog.state === 'away' || !Rref)) { const was = at; refNow(); at = was ?? Rref; }
  const pts = [], order = { 平面: 0, 桌面: 1, 地面: 2 };
  const toPt = (x, y) => { const p = { x: vis.x + (x > 1.5 ? x / cw : x) * vis.w, y: vis.y + (y > 1.5 ? y / ch : y) * vis.h }; return isAR() && at ? project(p, at, Rref) : p; };
  areas = [];
  for (const s of list ?? []) for (const [x0, y0, x1, y1] of s.boxes ?? []) { const q = [toPt(x0, y0), toPt(x1, y0), toPt(x1, y1), toPt(x0, y1)]; if (q.every(Boolean)) areas.push({ label: s.label, q }); }
  for (const s of list ?? []) for (const [x, y] of s.points ?? []) {
    let p = { x: vis.x + (x > 1.5 ? x / cw : x) * vis.w, y: vis.y + (y > 1.5 ? y / ch : y) * vis.h, label: s.label };
    if (isAR() && at) { const q = project(p, at, Rref); if (!q) continue; p = { ...q, label: s.label }; }
    if (!pts.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < size * 0.45)) pts.push(p);
  }
  pts.sort((a, b) => (order[a.label] ?? 3) - (order[b.label] ?? 3) || Math.hypot(a.x - W / 2, a.y - H * 0.6) - Math.hypot(b.x - W / 2, b.y - H * 0.6));
  found = pts; foundAt = now(); showFound = true;
  if (!pts.length) { hint('没找到能站的地方,点一下她要待的地方吧', 3200); return; }
  hint(`找到 ${pts.length} 处能站的地方 · 也可以自己点`, 3200);
  if (dog.state === 'away' || dog.state === 'sit') goRef(pts[0]);
}
function goRef(p) { const r = fit(); come((p.x - r.x) / r.w, (p.y - r.y) / r.h); }

let hintTimer = 0;
function hint(text, ms = 0) { const h = $('hint'); h.textContent = text; h.classList.remove('off'); clearTimeout(hintTimer); if (ms) hintTimer = setTimeout(() => h.classList.add('off'), ms); }

// ---------- the puppy ----------
let size = 150; // the height of a standing picture on the screen (css px), for her feet near the bottom of the picture
// further away = smaller: on a plane seen from above at a slant, the size shrinks toward a horizon somewhat above the picture
const depthK = (y) => { const r = fit(), top = media?.live ? 0 : r.y, h = media?.live ? H : r.h, hy = top - h * 0.5, near = top + h * 0.92; return clamp((y - hy) / (near - hy), 0.32, 1.15); };
let curS = 150; // her size right now (size times the depth factor where her feet are)
const dog = {
  state: 'away', // away | path | wave | sit | leave
  x: 0, y: 0, ground: 0, // feet; ground = the surface under her (for the shadow)
  spot: null, // where she lives in this picture, relative to it (u, v)
  path: [], seg: null, segAt: 0, dir: 1, then: null,
  face: 'happy', faceUntil: 0, nextBlink: 0, hopAt: -9e9, landAt: -9e9, waveAt: 0, waveLoops: 2, idleSince: 0, nextIdea: 0, first: true,
};
const spotPx = () => { const r = fit(); return { x: r.x + dog.spot.u * r.w, y: r.y + dog.spot.v * r.h }; };
const runLine = () => { const r = fit(); return Math.min(H - 8, r.y + r.h * 0.96); };
const RUN_SPEED = () => size * 3.2; // px a second

// a way from a to b: run along a's level, then one jump onto b (or just a hop when they are about level)
function plan(a, b) {
  const dir = Math.sign(b.x - a.x) || 1, dx = Math.abs(b.x - a.x), dy = b.y - a.y, segs = [];
  const big = Math.abs(dy) > size * 0.3;
  const take = big ? Math.min(dx, size * 0.75) : Math.min(dx, size * 0.3);
  const tx = b.x - dir * take;
  if (Math.abs(tx - a.x) > 2) segs.push({ type: 'run', from: { x: a.x, y: a.y }, to: { x: tx, y: big ? a.y : a.y + (b.y - a.y) * (Math.abs(tx - a.x) / Math.max(1, dx)) }, dir });
  const from = segs.length ? segs[segs.length - 1].to : a;
  segs.push({ type: 'jump', from, to: { x: b.x, y: b.y }, dir, h: big ? Math.max(size * 0.45, Math.abs(dy) * 0.35 + size * 0.35) : size * 0.28 });
  return segs;
}
function go(segs, then) { dog.state = 'path'; dog.path = segs; dog.then = then; nextSeg(); }
function nextSeg() {
  const s = dog.path.shift();
  if (!s) { dog.seg = null; const t = dog.then; dog.then = null; t?.(); return; }
  s.ms = s.type === 'run' ? (Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y) / RUN_SPEED()) * 1000 : s.h > size * 0.4 ? 620 : 420;
  dog.seg = s; dog.segAt = now(); dog.dir = s.dir;
}
function arrive() { // landed on the spot: wave, then sit and wag
  if (showFound) setTimeoutClock(() => { if (now() - foundAt > 5000) showFound = false; }, 5000);
  dog.landAt = now(); dog.state = 'wave'; dog.waveAt = now() + 120; dog.waveLoops = dog.first ? 2 : 1;
  say(dog.first ? line('来了') : line('搬家')); dog.first = false;
  hint('点她摸摸头,点两下亲一下 · 点别处她会跳过去', 4200);
}
function sitDown() { dog.state = 'sit'; dog.face = 'happy'; dog.faceUntil = 0; dog.idleSince = now(); dog.nextIdea = now() + rand(5000, 8000); }
function come(u, v) { // tapped a spot
  dog.spot = { u, v }; ring = { at: now(), ...spotPx() };
  const b = spotPx();
  if (dog.state === 'away') { // in from the nearer side, on the bottom of the picture
    const side = b.x < W / 2 ? -1 : 1, y = Math.max(runLine(), b.y);
    dog.x = side < 0 ? -size : W + size; dog.y = dog.ground = y; dog.first = true;
    go(plan({ x: dog.x, y }, b), arrive);
  } else go(plan({ x: dog.x, y: dog.y }, b), arrive);
}
function leave() { // waves goodbye, jumps down and runs off to the nearer side
  dog.state = 'leave'; say(line('走了'), 2200); dog.waveAt = now(); dog.waveLoops = 1;
  setTimeoutClock(() => {
    const side = dog.x < W / 2 ? -1 : 1, y = Math.max(runLine(), dog.y), segs = [];
    if (y - dog.y > size * 0.3) segs.push({ type: 'jump', from: { x: dog.x, y: dog.y }, to: { x: dog.x + side * size * 0.7, y }, dir: side, h: size * 0.4 });
    const sx = segs.length ? segs[0].to.x : dog.x;
    segs.push({ type: 'run', from: { x: sx, y }, to: { x: side < 0 ? -size * 1.2 : W + size * 1.2, y }, dir: side });
    go(segs, () => { dog.state = 'away'; hint('她跑走啦,再点一下叫她回来'); });
  }, 1000);
}
// timers on the game clock (so ?test can step them)
const timers = [];
const setTimeoutClock = (fn, ms) => timers.push({ at: now() + ms, fn });

// ---------- what she says, hearts, the tapped spot ----------
let bubble = null, ring = null;
const hearts = [];
function say(text, ms = 2400) { bubble = { text, until: now() + ms }; }
function heartsAt(x, y, n = 4) { for (let i = 0; i < n; i++) hearts.push({ x: x + rand(-0.2, 0.2) * curS, y: y + rand(-0.05, 0.05) * curS, vx: rand(-30, 30), vy: rand(-110, -70), t: 0, life: rand(0.9, 1.4), s: rand(0.8, 1.2) }); }

// ---------- taps: on her = pat / kiss; elsewhere = she goes there; two fingers = bigger / smaller ----------
const pts = new Map(); let pinch = null, lastDogTap = 0, downAt = null;
const headBox = () => ({ x0: dog.x - curS * 0.42, x1: dog.x + curS * 0.42, y0: dog.y - curS * 1.02, y1: dog.y + 4 });
cv.addEventListener('pointerdown', (e) => {
  pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), size }; downAt = null; return; }
  downAt = { x: e.clientX, y: e.clientY, t: now() };
});
cv.addEventListener('pointermove', (e) => {
  if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pts.size === 2) { const [a, b] = [...pts.values()]; size = clamp(pinch.size * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(20, pinch.d), 60, 420); }
});
const up = (e) => {
  pts.delete(e.pointerId); if (pts.size < 2 && pinch) { pinch = null; return; }
  if (!downAt || !media) return; const d = downAt; downAt = null;
  if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 12) return;
  tap(e.clientX, e.clientY);
};
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', (e) => { pts.delete(e.pointerId); pinch = null; downAt = null; });
function tap(x, y) {
  if (media?.live && ori) { Rcur = rotM(ori); if (dog.state === 'away' || !Rref) refNow(); const p = toRef({ x, y }); if (!p) return; x = p.x; y = p.y; }
  const b = headBox(), onDog = dog.state !== 'away' && x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1;
  if (onDog) {
    if (dog.state !== 'sit' && dog.state !== 'wave') { say('汪!', 900); return; }
    if (dog.state === 'wave') sitDown();
    dog.idleSince = now();
    if (now() - lastDogTap < 330) { dog.face = 'kiss'; dog.faceUntil = now() + 1600; say(line('亲亲')); heartsAt(dog.x, dog.y - curS * 0.9, 7); lastDogTap = 0; return; }
    lastDogTap = now(); dog.hopAt = now(); dog.face = 'happy'; dog.faceUntil = now() + 1200; say(line('摸头')); heartsAt(dog.x, dog.y - curS * 0.9, 3);
    return;
  }
  const r = fit(); if (x < r.x || x > r.x + r.w || y < r.y || y > r.y + r.h) return;
  if (dog.state === 'path') return; // let her land first
  come((x - r.x) / r.w, (y - r.y) / r.h);
}
$('bSmall').addEventListener('click', () => { size = clamp(size / 1.18, 60, 420); });
$('bBig').addEventListener('click', () => { size = clamp(size * 1.18, 60, 420); });

// ---------- every frame ----------
function frameCell(row, f, x, y, sx = 1, sy = 1) { // a standing picture, feet at (x, y)
  const h = curS * sy, w = curS * (CELL_W / CELL_H) * sx;
  ctx.drawImage(sheet, f * CELL_W, ROW[row][0] * CELL_H, CELL_W, CELL_H, x - w / 2, y - (FOOT / CELL_H) * h, w, h);
}
function sitCell(name, x, y, tail, sx = 1, sy = 1) { // a sitting picture (tail apart), feet at (x, y)
  const p = sitParts[name]; if (!p) return;
  const k = curS / CELL_H, w = CELL_W * k * sx, h = SIT_H * k * sy, left = x - w / 2, top = y - (SIT_FOOT / SIT_H) * h;
  ctx.drawImage(p.body, left, top, w, h);
  const rx = left + TAIL_ROOT[0] * k * sx, ry = top + TAIL_ROOT[1] * k * sy;
  ctx.save(); ctx.translate(rx, ry); ctx.rotate(tail); ctx.translate(-rx, -ry); ctx.drawImage(p.tail, left, top, w, h); ctx.restore();
}
const SHOW_FOUND = false; // she asked not to show the found places (2026-11-09); true draws them again
const KIND = { 桌面: '#ff9f43', 地面: '#2ecc71', 平面: '#4aa3ff' };
function drawFound(t) { // what the model found: each place tinted with its name, and a pad where she would stand (smaller further away)
  const fade = Math.min(1, (t - foundAt) / 300);
  ctx.save(); ctx.globalAlpha = fade; const tags = [];
  for (const a of areas) {
    const q = a.q.map(toScreen); if (!q.every(Boolean)) continue; const c = KIND[a.label] ?? '#ffffff';
    ctx.beginPath(); q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
    ctx.fillStyle = c + '26'; ctx.fill(); ctx.setLineDash([8, 6]); ctx.lineWidth = 2; ctx.strokeStyle = c; ctx.stroke(); ctx.setLineDash([]);
    let lx = Math.max(6, Math.min(...q.map((p) => p.x))) + 6; const ly = Math.max(6, Math.min(...q.map((p) => p.y))) + 6;
    ctx.font = '700 13px -apple-system, "PingFang SC", sans-serif'; const tw = ctx.measureText(a.label).width;
    while (tags.some(([x, y, w]) => Math.abs(y - ly) < 24 && lx < x + w + 4 && lx + tw + 14 > x)) lx += 8; // two areas in about the same place: names side by side
    tags.push([lx, ly, tw + 14]);
    ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(lx, ly, tw + 14, 22, 11); ctx.fill(); ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(a.label, lx + 7, ly + 11.5);
  }
  found.forEach((p, i) => {
    const q = toScreen(p); if (!q) return; const k = depthK(p.y), c = KIND[p.label] ?? '#ff6b9a', pulse = (Math.sin(t / 300 + i) + 1) / 2, rw = size * 0.32 * k;
    ctx.beginPath(); ctx.ellipse(q.x, q.y, rw * (1 + pulse * 0.15), rw * 0.32 * (1 + pulse * 0.15), 0, 0, Math.PI * 2); ctx.fillStyle = c + '55'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    ctx.beginPath(); ctx.arc(q.x, q.y, 3.5, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
  });
  ctx.restore();
}
function drawHeart(x, y, s, a) {
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#ff6b9a'; ctx.translate(x, y); ctx.scale(s, s); ctx.beginPath();
  ctx.moveTo(0, 4); ctx.bezierCurveTo(-10, -4, -6, -12, 0, -7); ctx.bezierCurveTo(6, -12, 10, -4, 0, 4); ctx.fill(); ctx.restore();
}
function drawBubble(text, x, y) {
  const fs = clamp(curS * 0.11, 13, 20); ctx.font = `600 ${fs}px -apple-system, "PingFang SC", sans-serif`;
  const tw = ctx.measureText(text).width, pw = tw + fs * 1.4, ph = fs * 2, bx = clamp(x - pw / 2, 8, W - pw - 8), by = Math.max(8, y - ph - 10);
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#f3a9c4'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(bx, by, pw, ph, ph / 2.2); ctx.fill(); ctx.stroke();
  const tx = clamp(x, bx + 14, bx + pw - 14); ctx.beginPath(); ctx.moveTo(tx - 6, by + ph - 1); ctx.lineTo(tx, by + ph + 7); ctx.lineTo(tx + 6, by + ph - 1); ctx.fill();
  ctx.fillStyle = '#4a2a38'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, bx + pw / 2, by + ph / 2 + 1);
}
let lastT = now();
function loop() {
  const t = now(), dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
  Rcur = ori && media?.live ? rotM(ori) : Rref; arM = null;
  for (let i = timers.length - 1; i >= 0; i--) if (t >= timers[i].at) { const f = timers[i].fn; timers.splice(i, 1); f(); }
  ctx.clearRect(0, 0, W, H);
  if (media) {
    // the picture: blurred and dark behind, sharp in front
    blurG.drawImage(media.el, 0, 0, blur.width, blur.height); blur2G.imageSmoothingQuality = 'high'; blur2G.drawImage(blur, 0, 0, blur2.width, blur2.height);
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(blur2, -30, -30, W + 60, H + 60); ctx.fillStyle = '#0000004d'; ctx.fillRect(0, 0, W, H); ctx.restore();
    const r = fit(); ctx.drawImage(media.el, r.x, r.y, r.w, r.h);
    if (ring && t - ring.at < 700) { const k = (t - ring.at) / 700; ctx.save(); ctx.strokeStyle = `rgba(255,120,170,${1 - k})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(ring.x, ring.y, 14 + k * 30, (14 + k * 30) * 0.4, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    // the places the model found, for a moment
    if (SHOW_FOUND && showFound) drawFound(t);
    drawDog(t, dt);
  }
  // hearts
  for (let i = hearts.length - 1; i >= 0; i--) { const h = hearts[i]; h.t += dt; h.x += h.vx * dt; h.y += h.vy * dt; if (h.t > h.life) hearts.splice(i, 1); }
  inAR(() => {
    for (const h of hearts) drawHeart(h.x, h.y, (curS / 150) * 1.3 * h.s, 1 - h.t / h.life);
    if (bubble && t < bubble.until && dog.state !== 'away') drawBubble(bubble.text, dog.x, dog.y - curS * (dog.state === 'sit' ? 1.0 : 1.05));
  });
  if (!TEST) requestAnimationFrame(loop);
}
function drawDog(t) {
  if (dog.state === 'away') return;
  // keep her on her spot when the screen size changes
  if ((dog.state === 'sit' || dog.state === 'wave') && dog.spot) { const p = spotPx(); dog.x = p.x; dog.y = dog.ground = p.y; }
  let lift = 0, row = null, f = 0;
  if (dog.state === 'path' && dog.seg) {
    const s = dog.seg, k = clamp((t - dog.segAt) / s.ms, 0, 1);
    if (s.type === 'run') { dog.x = s.from.x + (s.to.x - s.from.x) * k; dog.y = dog.ground = s.from.y + (s.to.y - s.from.y) * k; row = s.dir < 0 ? 'left' : 'right'; f = Math.floor((t - dog.segAt) / 85) % 8; }
    else { const gy = s.from.y + (s.to.y - s.from.y) * k; dog.x = s.from.x + (s.to.x - s.from.x) * k; lift = 4 * s.h * k * (1 - k); dog.y = gy - lift; dog.ground = k < 0.5 ? s.from.y + (gy - s.from.y) * 0 : gy; dog.ground = gy; row = 'jump'; f = Math.min(4, Math.floor(k * 5)); }
    if (k >= 1) { dog.y = dog.ground = s.to.y; nextSeg(); }
  }
  curS = size * depthK(dog.ground);
  arM = arAt(dog.x, dog.y);
  inAR(() => paintDog(t, lift, row, f));
}
function paintDog(t, lift, row, f) {
  // the shadow on the surface under her
  const sh = clamp(1 - lift / (size * 1.2), 0.35, 1); ctx.save(); ctx.fillStyle = `rgba(0,0,0,${0.28 * sh})`; ctx.beginPath(); ctx.ellipse(dog.x, dog.ground + 1, curS * 0.3 * sh, curS * 0.075 * sh, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  const land = (t - dog.landAt) / 140, sq = land >= 0 && land < 1 ? Math.sin(land * Math.PI) * 0.12 : 0, hop = (t - dog.hopAt) / 300, hy = hop >= 0 && hop < 1 ? Math.sin(hop * Math.PI) * curS * 0.12 : 0;
  if (dog.state === 'path') { frameCell(row, f, dog.x, dog.y); return; }
  if (dog.state === 'wave' || dog.state === 'leave') {
    const k = (t - dog.waveAt) / 150; if (dog.state === 'wave' && k >= 4 * dog.waveLoops) sitDown();
    else { frameCell(k < 0 ? 'idle' : 'wave', k < 0 ? 0 : Math.floor(k) % 4, dog.x, dog.y, 1 + sq * 0.6, 1 - sq); return; }
  }
  // sitting: blinks, wags, now and then a little idea; left alone long enough she leaves
  if (dog.faceUntil && t > dog.faceUntil) { dog.face = 'happy'; dog.faceUntil = 0; }
  if (!dog.faceUntil && t > dog.nextBlink) { dog.face = 'blink'; dog.faceUntil = t + 150; dog.nextBlink = t + rand(2600, 4800); }
  if (t > dog.nextIdea) { dog.nextIdea = t + rand(5000, 8000); if (found.length > 1 && Math.random() < 0.35) { const here = found.find((p) => Math.hypot(p.x - dog.x, p.y - dog.y) > size * 0.6); if (here) { dog.idleSince = t; goRef(here); return; } } if (Math.random() < 0.5) say(line('平时')); else { dog.face = 'listen'; dog.faceUntil = t + 1800; } }
  if (t - dog.idleSince > 14000) { leave(); return; }
  const wagSpeed = dog.face === 'kiss' || t - dog.hopAt < 1500 ? 14 : 8, tail = Math.sin(t / 1000 * wagSpeed) * 0.26 - 0.05;
  sitCell(dog.face, dog.x, dog.y - hy, tail, 1 + sq * 0.6, 1 - sq);
}
if (TEST) {
  window.__advance = (ms) => { for (let k = 0; k < ms; k += 16) { fakeNow += 16; loop(); } };
  window.__game = { dog, get size() { return size; }, tap, surfaces: (list) => { const r = fit(); useSurfaces(list, { x: Math.max(0, r.x), y: Math.max(0, r.y), w: Math.min(W, r.x + r.w) - Math.max(0, r.x), h: Math.min(H, r.y + r.h) - Math.max(0, r.y) }, ori && media?.live ? rotM(ori) : Rcur); }, orient: (a, b, g) => { ori = { a, b, g }; }, startCamera, get ar() { return isAR(); }, loadUrl: (u, video) => { fetch(u).then((r) => r.blob()).then((b) => loadFile(new File([b], video ? 'v.mp4' : 'p.jpg', { type: video ? 'video/mp4' : 'image/jpeg' }))); } };
} else requestAnimationFrame(loop);

// ---------- 录下来: record the canvas, then save it ----------
let rec = null;
$('bRec').addEventListener('click', () => { if (rec) rec.stop(); else startRec(); });
function startRec() {
  if (!cv.captureStream || !window.MediaRecorder) { hint('这个浏览器录不了,换 Safari 试试', 2500); return; }
  const type = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
  const chunks = []; rec = new MediaRecorder(cv.captureStream(30), type ? { mimeType: type, videoBitsPerSecond: 8e6 } : undefined);
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.onstop = () => {
    const blob = new Blob(chunks, { type: rec.mimeType || type || 'video/mp4' }), ext = blob.type.includes('mp4') ? 'mp4' : 'webm'; rec = null;
    $('bRec').classList.remove('rec'); $('bRec').innerHTML = '<span>⏺</span>录下来';
    const url = URL.createObjectURL(blob), v = $('clipVideo'); v.src = url; v.play().catch(() => {});
    const file = new File([blob], `小狗跳进照片.${ext}`, { type: blob.type }), save = $('clipSave');
    save.href = url; save.download = file.name;
    save.onclick = (e) => { if (navigator.canShare?.({ files: [file] })) { e.preventDefault(); navigator.share({ files: [file] }).catch(() => {}); } };
    $('clip').classList.add('on');
  };
  rec.start(); $('bRec').classList.add('rec'); $('bRec').innerHTML = '<span>⏹</span>停止'; hint('录制中…再点一下停止', 2000);
  setTimeout(() => rec?.state === 'recording' && rec.stop(), 20000);
}
$('clipClose').addEventListener('click', () => { $('clip').classList.remove('on'); $('clipVideo').pause(); });
