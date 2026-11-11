// 拼贴诗: one phone, two people, one sheet. Both pull words cut from "magazines" onto it whenever they like;
// when both hold a heart at the same time the poem is done: it becomes a picture, goes on the 诗集墙 and, if they want, on the
// love calendar as a 回音 entry whose link (#p=...) redraws the same collage on any device.
import { WORDS, MIX, FLAVOR, REUSE, ALWAYS } from './words.js';
import { BW, BH, STYLES, PUNCT, look, encode, decode, poemText, render, day } from './collage.js';

// the Netlify front door first: *.workers.dev cannot be reached from mainland China, the Netlify address forwards to it
const APIS = new URLSearchParams(location.search).get('api')?.split(',') ?? ['https://frabjous-boba-2c325c.netlify.app', 'https://love-calendar-api.linmz21.workers.dev'];
const WHO = [
  { name: '小狗', cls: 'dog', pron: '她', tape: '#f19bb8' },
  { name: '小猫', cls: 'cat', pron: '他', tape: '#8fb0cf' },
];

const $ = (id) => document.getElementById(id);
const ls = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
let toastTimer;
function toast(msg) {
  $('toast').textContent = msg;
  $('toast').classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('on'), 2400);
}
function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.id === id));
}

function tileEl(t, k, owner) {
  const l = look(t);
  const el = document.createElement('div');
  el.className = 'tile' + (owner == null ? '' : ` mine-${owner}`);
  el.dataset.id = t.id;
  const cut = document.createElement('span');
  cut.className = 'cut';
  cut.textContent = t.t;
  Object.assign(cut.style, {
    background: l.bg, color: l.fg, fontFamily: l.font, fontWeight: l.w, fontSize: `${l.fs * k}px`,
    padding: `${l.padY * k}px ${l.padX * k}px`, clipPath: `polygon(${l.poly.map(([x, y]) => `${x}% ${y}%`).join(',')})`,
  });
  el.append(cut);
  if (owner != null) {
    const tape = document.createElement('i');
    tape.className = 'tape';
    tape.style.left = `${l.tapeL}%`;
    tape.style.transform = `rotate(${l.tapeR}deg)`;
    el.append(tape);
  }
  return el;
}

// ---------- a game: one sheet, one pile of words, both of you at the same time ----------

let S = null; // { tiles, hand, bags, started }
let K = 0.5; // screen px per logical unit
let nextId = 1;
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const save = () => ls.set('poem-draft', S);
const inPlay = () => new Set([...S.tiles, ...S.hand].map((t) => t.t));

const pickFlavor = () => {
  const total = Object.values(FLAVOR).reduce((a, b) => a + b, 0);
  let x = Math.random() * total;
  for (const [f, w] of Object.entries(FLAVOR)) if ((x -= w) < 0) return f;
  return 'ours';
};
// n words of one part of speech; names / verbs / adjectives mix the flavours, and never repeat a word already in play
function draw(group, n, taken) {
  const out = [];
  if (REUSE.includes(group)) {
    const have = new Set(S.hand.map((h) => h.t));
    for (const w of ALWAYS) if (out.length < n && WORDS[group].includes(w) && !have.has(w)) out.push(w);
    for (const w of shuffle([...WORDS[group]])) if (out.length < n && !out.includes(w)) out.push(w);
  } else {
    for (let tries = 0; out.length < n && tries < 20; tries++) {
      const flavor = Array.isArray(WORDS[group]) ? null : pickFlavor();
      const list = flavor ? WORDS[group][flavor] : WORDS[group];
      const key = flavor ? `${group}.${flavor}` : group;
      if (!S.bags[key]?.length) S.bags[key] = shuffle(list.filter((w) => !taken.has(w)));
      const w = S.bags[key].pop();
      if (w && !taken.has(w) && !out.includes(w)) out.push(w);
    }
  }
  // the tape colour (pink / blue) is just a mix on one sheet now; it is the 'owner' bit of the link
  return out.map((t) => ({ id: `w${Date.now().toString(36)}${nextId++}`, t, s: (Math.random() * STYLES.length) | 0, seed: (Math.random() * 8) | 0, g: group, o: (Math.random() * 2) | 0 }));
}
function refill() {
  const taken = inPlay();
  for (const [group, n] of Object.entries(MIX)) {
    const have = S.hand.filter((h) => h.g === group).length;
    if (have < n) S.hand.push(...draw(group, n - have, taken));
  }
  shuffle(S.hand);
}

function newGame() {
  S = { tiles: [], hand: [], bags: {}, started: Date.now() };
  refill();
  save();
  play();
}
function play() {
  show('play');
  layout();
}

function layout() {
  if (!$('play').classList.contains('on')) return;
  const play = $('play'), cs = getComputedStyle(play);
  const used = play.querySelector('.bar').offsetHeight + 8 + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  const availH = innerHeight - used - 225; // 225: room for the punctuation row and up to four rows of words
  K = Math.min((innerWidth - 16) / BW, availH / BH, 0.9);
  $('board').style.width = `${BW * K}px`;
  $('board').style.height = `${BH * K}px`;
  paint();
}

function place(el, t) {
  el.style.left = `${t.x * K}px`;
  el.style.top = `${t.y * K}px`;
  el.style.transform = `translate(-50%,-50%) rotate(${t.r}deg)`;
}
function paint() {
  const board = $('board');
  board.querySelectorAll('.tile').forEach((e) => e.remove());
  $('boardHint').hidden = S.tiles.length > 0;
  for (const t of S.tiles) {
    const el = tileEl(t, K, t.o);
    place(el, t);
    el.addEventListener('pointerdown', (e) => dragBoard(e, t, el));
    board.append(el);
  }
  const tray = $('tray');
  tray.replaceChildren();
  // punctuation is always there: every drag takes a fresh copy
  const stock = document.createElement('div');
  stock.className = 'stock';
  WORDS.punct.forEach((p, i) => {
    const el = tileEl({ id: `p${i}`, t: p, s: 0, seed: i % 8 }, K, null);
    el.addEventListener('pointerdown', (e) => dragHand(e, null, el, p));
    stock.append(el);
  });
  tray.append(stock);
  for (const h of S.hand) {
    const el = tileEl(h, K, null);
    el.addEventListener('pointerdown', (e) => dragHand(e, h, el));
    tray.append(el);
  }
}

const within = (r, x, y) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
const clampX = (x) => Math.min(BW - 40, Math.max(40, x));
const clampY = (y) => Math.min(BH - 30, Math.max(30, y));

// every finger is its own drag, so two people can pull words onto the sheet at the same time.
// `punct`: a mark from the stock row; it gets a new look each time and the row stays as it is
function dragHand(e, h, el, punct) {
  e.preventDefault();
  if (punct) h = { id: `w${Date.now().toString(36)}${nextId++}`, t: punct, s: (Math.random() * STYLES.length) | 0, seed: (Math.random() * 8) | 0, g: 'punct', o: (Math.random() * 2) | 0 };
  el.setPointerCapture(e.pointerId);
  const x0 = e.clientX, y0 = e.clientY;
  let ghost = null;
  const move = (ev) => {
    if (!ghost && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
    if (!ghost) {
      ghost = tileEl(h, K, h.o);
      ghost.classList.add('ghost', 'dragging');
      document.body.append(ghost);
      el.style.opacity = '0';
    }
    ghost.style.left = `${ev.clientX}px`;
    ghost.style.top = `${ev.clientY - 24}px`;
    ghost.style.transform = 'translate(-50%,-50%) rotate(-3deg)';
  };
  const up = (ev) => {
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', up);
    const r = $('board').getBoundingClientRect();
    let at = null;
    if (!ghost) at = { x: BW / 2 + (Math.random() - 0.5) * 240, y: BH / 2 + (Math.random() - 0.5) * 300 }; // a tap: somewhere in the middle
    else if (within(r, ev.clientX, ev.clientY - 24)) at = { x: (ev.clientX - r.left) / K, y: (ev.clientY - 24 - r.top) / K };
    ghost?.remove();
    el.style.opacity = '';
    if (!at || ev.type === 'pointercancel') return;
    if (!punct) S.hand = S.hand.filter((x) => x !== h);
    S.tiles.push({ ...h, x: clampX(at.x), y: clampY(at.y), r: Math.round(Math.random() * 12 - 6) });
    save();
    paint();
  };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
}

function dragBoard(e, t, el) {
  e.preventDefault();
  el.setPointerCapture(e.pointerId);
  S.tiles = [...S.tiles.filter((x) => x !== t), t]; // on top (the .dragging z-index shows it; moving the node would drop the capture)
  el.classList.add('dragging');
  const r = $('board').getBoundingClientRect();
  const dx = e.clientX - (r.left + t.x * K), dy = e.clientY - (r.top + t.y * K);
  const move = (ev) => {
    t.x = clampX((ev.clientX - dx - r.left) / K);
    t.y = clampY((ev.clientY - dy - r.top) / K);
    place(el, t);
  };
  const up = (ev) => {
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', up);
    el.classList.remove('dragging');
    // dropped on the pile below: the word comes off the sheet
    if (within($('tray').getBoundingClientRect(), ev.clientX, ev.clientY)) {
      S.tiles = S.tiles.filter((x) => x !== t);
      const { x, y, r: _r, ...h } = t;
      if (!PUNCT.test(t.t)) S.hand.push(h); // a mark just goes back to the stock
    }
    save();
    paint();
  };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
}

// ---------- finishing: both hold a heart ----------

const held = [false, false];
let holdStart = 0;
function holdTick() {
  if (!$('finish').classList.contains('on')) return;
  const both = held[0] && held[1];
  if (!both) holdStart = 0;
  else if (!holdStart) holdStart = performance.now();
  const p = holdStart ? Math.min(1, (performance.now() - holdStart) / 1200) : 0;
  $('meter').style.width = `${p * 100}%`;
  if (p >= 1) return finishPoem();
  requestAnimationFrame(holdTick);
}
document.querySelectorAll('.heart').forEach((b) => {
  const i = +b.dataset.h;
  const set = (v) => { held[i] = v; b.classList.toggle('held', v); };
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (e.pointerType === 'mouse') return set(!held[i]); // a computer has one pointer: click to latch
    b.setPointerCapture(e.pointerId);
    set(true);
  });
  const off = (e) => { if (e.pointerType !== 'mouse') set(false); };
  b.addEventListener('pointerup', off);
  b.addEventListener('pointercancel', off);
  b.addEventListener('contextmenu', (e) => e.preventDefault());
});
function openFinish() {
  if (S.tiles.length < 3) return toast('至少贴三个词吧');
  held.fill(false);
  document.querySelectorAll('.heart').forEach((b) => b.classList.remove('held'));
  show('finish');
  requestAnimationFrame(holdTick);
}

// links always point at the published page, wherever the poem was made
const SITE = 'https://leishaforlinminzhi-9.github.io/poem/';
const linkOf = (code) => `${SITE}#p=${code}`;
const wallLocal = () => ls.get('poem-wall') ?? [];

function finishPoem() {
  const item = { code: encode(S.tiles, Date.now()), text: poemText(S.tiles), at: Date.now() };
  ls.set('poem-wall', [item, ...wallLocal()]);
  ls.del('poem-draft');
  S = null;
  showDone(item, { local: true });
}

// ---------- the finished poem ----------

let current = null;
async function showDone(item, { local = false, fromLink = false } = {}) {
  current = item;
  show('done');
  $('donePoem').textContent = item.text;
  $('doneImg').removeAttribute('src');
  const acts = [['保存图片', saveImage]];
  if (!item.onCal) acts.push(['挂到爱的日历', openCal]);
  acts.push(['复制链接', copyLink]);
  acts.push(['诗集墙', openWall]);
  if (local && !item.onCal) acts.push(['从墙上取下', unpin]);
  acts.push(['再拼一首', startScreen]);
  $('doneActions').replaceChildren(...acts.map(([label, fn], i) => {
    const b = document.createElement('button');
    b.className = i ? 'btn light' : 'btn';
    b.textContent = label;
    b.onclick = fn;
    return b;
  }));
  const note = item.onCal ? `挂在爱的日历 ${item.onCal.slice(5).replace('-', '月')}日 · 长按图片也能存` : fromLink ? '长按图片也能存到相册' : '已经钉到诗集墙上了 · 长按图片也能存到相册';
  $('doneNote').textContent = '正在把词贴到纸上……';
  const canvas = await render(decode(item.code), 1.6, day(item.at));
  if (current !== item) return; // left for another poem meanwhile
  item.canvas = canvas;
  $('doneImg').src = canvas.toDataURL('image/png');
  $('doneNote').textContent = note;
}
async function saveImage() {
  if (!current.canvas) return toast('图片还在画,等一下');
  const blob = await new Promise((r) => current.canvas.toBlob(r, 'image/png'));
  const file = new File([blob], `拼贴诗-${day(current.at)}.png`, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); } catch {}
    return;
  }
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: file.name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
async function copyLink() {
  const link = linkOf(current.code);
  try {
    await navigator.clipboard.writeText(link);
    toast('链接复制好了');
  } catch {
    prompt('复制这个链接:', link);
  }
}
function unpin() {
  if (!confirm('把这首从墙上取下来?取下就没有了。')) return;
  ls.set('poem-wall', wallLocal().filter((w) => w.code !== current.code));
  openWall();
}

// ---------- the love calendar ----------

const pad2 = (n) => String(n).padStart(2, '0');
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
let apiAt = 0; // the address that answered last time is tried first
async function api(body) {
  let last;
  for (let i = 0; i < APIS.length; i++) {
    const k = (apiAt + i) % APIS.length;
    try {
      const res = await fetch(`${APIS[k]}/api/sync`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const out = await res.json();
      apiAt = k;
      return out;
    } catch (err) { last = err; }
  }
  throw last;
}
function openCal() {
  $('calDate').value = todayKey();
  $('calMsg').textContent = '';
  $('calGo').disabled = false;
  $('calSheet').classList.add('on');
}
const textOf = (item) => {
  const link = linkOf(item.code);
  // the calendar keeps at most 600 characters of a 回音; the link must survive whole
  return `${item.text.slice(0, 600 - link.length - 2)}\n\n${link}`;
};
// Hangs every poem in `jobs` ({ item, date }) as a 回音 in the first free slot of its date, all in one sync.
// Returns { done: Map code -> date (hung now or found already hung), full: [items whose day had no free slot] }.
async function hangAll(jobs) {
  const done = new Map();
  let full = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const all = await api({ changes: [] });
    const live = new Map(all.entries.map((e) => [e.id, e]));
    const changes = [];
    const want = new Map();
    full = [];
    const now = Date.now();
    for (const { item, date } of jobs) {
      if (done.has(item.code)) continue;
      const already = all.entries.find((e) => !e.deleted && e.text.includes(`#p=${item.code}`));
      if (already) { done.set(item.code, already.date); continue; }
      let slot = -1;
      for (let s = 0; s < 6 && slot < 0; s++) if ((!live.get(`${date}_${s}`) || live.get(`${date}_${s}`).deleted) && !want.has(`${date}_${s}`)) slot = s;
      if (slot < 0) { full.push(item); continue; }
      const id = `${date}_${slot}`;
      want.set(id, item);
      changes.push({ date, slot, kind: 'love', type: 'poem', text: textOf(item), createdAt: now, updatedAt: now, deleted: false, baseRev: live.get(id)?.rev ?? 0 });
    }
    if (!changes.length) return { done, full };
    const res = await api({ epoch: all.epoch, since: all.cursor, changes });
    for (const [id, item] of want) if (res.entries.some((e) => e.id === id && e.text.includes(item.code))) done.set(item.code, id.slice(0, 10));
    if (jobs.every(({ item }) => done.has(item.code) || full.includes(item))) return { done, full };
    // a slot was written by someone else just now: look again
  }
  throw new Error('not stored');
}
function rememberHung(done) {
  ls.set('poem-wall', wallLocal().map((w) => (done.has(w.code) ? { ...w, onCal: done.get(w.code) } : w)));
}
async function hang() {
  const date = $('calDate').value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return ($('calMsg').textContent = '先选一天');
  $('calGo').disabled = true;
  $('calMsg').textContent = '正在挂……';
  try {
    const { done } = await hangAll([{ item: current, date }]);
    if (!done.has(current.code)) return ($('calMsg').textContent = '这一天已经挂满了,换一天吧', $('calGo').disabled = false);
    markHung(done.get(current.code), done.get(current.code) === date ? undefined : '这首已经挂过了');
  } catch (err) {
    console.error(err);
    $('calMsg').textContent = '没挂上,可能是网不好,再试一次';
    $('calGo').disabled = false;
  }
}
// the day a poem was made, as the calendar writes it
const dateOf = (item) => { const d = new Date(decode(item.code).at); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
async function hangWall(btn, list) {
  btn.disabled = true;
  btn.textContent = '正在挂……';
  try {
    const { done, full } = await hangAll(list.map((item) => ({ item, date: dateOf(item) })));
    rememberHung(done);
    toast(full.length ? `挂好 ${done.size} 首,有 ${full.length} 首那天已经挂满了` : `都挂好了,一共 ${done.size} 首`);
  } catch (err) {
    console.error(err);
    toast('没挂上,可能是网不好,再试一次');
  }
  openWall();
}
function markHung(date, msg) {
  current.onCal = date;
  rememberHung(new Map([[current.code, date]]));
  $('calSheet').classList.remove('on');
  toast(msg ?? `挂好了:${date.slice(5).replace('-', '月')}日`);
  showDone(current, { local: true });
}

// ---------- the wall: poems made on this phone + every poem hung on the calendar ----------

async function openWall() {
  show('wall');
  const grid = $('grid');
  const items = new Map(wallLocal().map((w) => [w.code, { ...w, local: true }]));
  grid.replaceChildren(Object.assign(document.createElement('p'), { className: 'empty', textContent: '正在把诗钉上墙……' }));
  try {
    const all = await api({ changes: [] });
    for (const e of all.entries) {
      const m = !e.deleted && e.type === 'poem' && e.text.match(/#p=([A-Za-z0-9_-]+)/);
      if (!m) continue;
      const known = items.get(m[1]);
      items.set(m[1], { ...known, code: m[1], text: known?.text ?? e.text.replace(/\n*https?:\/\/\S+/g, '').trim(), at: known?.at ?? e.createdAt, onCal: e.date, local: known?.local });
    }
  } catch {} // offline: the poems on this phone are still there
  const list = [...items.values()].sort((a, b) => b.at - a.at);
  if (!list.length) {
    grid.replaceChildren(Object.assign(document.createElement('p'), { className: 'empty', textContent: '墙上还空着。拼一首吧。' }));
    return;
  }
  grid.replaceChildren();
  const left = list.filter((item) => item.local && !item.onCal);
  if (left.length) {
    const b = document.createElement('button');
    b.className = 'btn hangall';
    b.textContent = `把没挂的 ${left.length} 首按日期挂到爱的日历`;
    b.onclick = () => hangWall(b, left);
    grid.append(b);
  }
  for (const item of list) {
    const b = document.createElement('button');
    b.className = 'pin';
    const img = document.createElement('img');
    img.alt = '';
    const cap = document.createElement('small');
    cap.textContent = `${day(item.at)} · ${item.text.split('\n')[0]}`;
    b.append(img, cap);
    b.onclick = () => showDone(item, { local: item.local });
    grid.append(b);
    render(decode(item.code), 0.32, day(item.at)).then((c) => (img.src = c.toDataURL('image/jpeg', 0.85))).catch(() => {});
  }
}

// ---------- wiring ----------

function logo() {
  const letters = [['拼', 2, 3], ['贴', 3, 5], ['诗', 11, 1]];
  $('logo').replaceChildren(...letters.map(([t, s, seed], i) => {
    const el = tileEl({ id: `l${i}`, t, s, seed }, 1.15, i % 2);
    el.style.position = 'relative';
    el.style.display = 'inline-block';
    el.style.margin = '0 6px';
    el.style.transform = `rotate(${[-5, 3, -2][i]}deg)`;
    return el;
  }));
}

$('newGame').onclick = newGame;
document.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => (b.dataset.go === 'wall' ? openWall() : startScreen())));
$('resume').onclick = () => { S = ls.get('poem-draft'); play(); };
// a new pile: the words not on the sheet go back in the bag
$('redraw').onclick = () => {
  S.hand = [];
  refill();
  save();
  paint();
};
$('finishBtn').onclick = openFinish;
$('finishBack').onclick = play;
$('calCancel').onclick = () => $('calSheet').classList.remove('on');
$('calGo').onclick = hang;
addEventListener('resize', layout);

function startScreen() {
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  $('resume').hidden = !ls.get('poem-draft')?.hand;
  show('start');
}
function route() {
  const m = location.hash.match(/^#p=([A-Za-z0-9_-]+)/);
  if (m) {
    try {
      const tiles = decode(m[1]);
      const known = wallLocal().find((w) => w.code === m[1]);
      return showDone(known ?? { code: m[1], text: poemText(tiles), at: tiles.at }, { local: !!known, fromLink: true });
    } catch {}
  }
  startScreen();
}
logo();
route();
addEventListener('hashchange', route);
