// 飞盘计分: teams take turns, and for every point the phone records which two teams were on, which of them scored and
// who threw the assist. Points are saved on the love-calendar server (POST /api/frisbee/*), so every phone shows the
// same numbers. A point recorded without signal waits on this phone (`ops`, kept in localStorage) and goes up as soon
// as the server answers; every point carries its own random id, so sending it twice still counts it once.

const params = new URLSearchParams(location.search);
// the Netlify address first: *.workers.dev cannot be reached from mainland China
const APIS = params.get('api')?.split(',') ?? (location.hostname.endsWith('github.io') ? ['https://frabjous-boba-2c325c.netlify.app', 'https://love-calendar-api.linmz21.workers.dev'] : [location.origin]);
const COLORS = ['#1f6fd1', '#e0560b', '#12805c', '#8e44ad'];
const DEFAULT_ROSTER = 'A队：梵高 锅锅 嘉旺 德华 未来 ｜ 榴莲 安琪 可欣 末妍\nB队：嘉树 乐陶 铭艺 周周 ｜ 红 乐乐 彦臻 橙子\nC队：苏昊 一凡 宇栋 嘉康 ｜ 晓玲姐 思涵 昕悦 Gia';
const POLL_MS = 8000;
const TWIN_MS = 45_000; // another phone recorded the same pairing this recently: probably the very same point
const NAME_RE = /^[^\s<>&"'`\\|｜:：,，、]+$/u; // the server's rule for team and player names

const $ = (s) => document.querySelector(s);
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v === null || v === undefined) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style') el.style.cssText = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...kids.flat().filter((c) => c !== null && c !== undefined && c !== false));
  return el;
}
const keep = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const rid = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
const me = keep.get('fb:me', null) || (() => { const id = rid(10); keep.set('fb:me', id); return id; })();

let game = params.get('g') || keep.get('fb:game', null);
let follow = !params.get('g'); // follow the newest game, unless a link or the list picked an older one
let srv = keep.get('fb:srv', null); // { game, rev, info, points } as the server last sent it: the page opens without signal too
if (srv?.game !== game) srv = null;
let ops = keep.get('fb:ops', []); // writes the server has not confirmed yet, oldest first
let view = 'auto'; // which day the numbers show: 'auto' (the day of the newest point), 'all' or a day like 2026-11-15
let pick = { pair: srv ? keep.get('fb:pair:' + srv.game, null) : null, team: null };
let net = 'busy', netMsg = '';
let loaded = Boolean(srv);
let lastRecord = 0;
let shown = { key: '', score: [] }; // what the board showed last time, to make a number jump when it goes up

// ---------- reading the points ----------

const teams = () => srv?.info.teams ?? [];
const teamName = (i) => teams()[i]?.name ?? `第${i + 1}队`;
const color = (i) => COLORS[i % COLORS.length];
const pairsOf = (n) => { const out = []; for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) out.push([a, b]); return out; };
const dayOf = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dayLabel = (k) => `${Number(k.slice(5, 7))}月${Number(k.slice(8, 10))}日`;
const clock = (t) => new Date(t).toTimeString().slice(0, 5);

// the server's points with this phone's unconfirmed writes laid on top, oldest first
function allPoints() {
  if (!srv) return [];
  const m = new Map(srv.points.map((p) => [p.id, p]));
  for (const o of ops) {
    if (o.game !== srv.game) continue;
    if (o.op === 'add') { if (!m.has(o.point.id)) m.set(o.point.id, { ...o.point, pending: true }); }
    else if (m.has(o.id)) m.set(o.id, { ...m.get(o.id), deleted: o.deleted, pending: true });
  }
  return [...m.values()].filter((p) => !p.deleted).sort((x, y) => x.at - y.at || (x.id < y.id ? -1 : 1));
}

function tally(list, n) {
  const score = Array(n).fill(0), lost = Array(n).fill(0), none = Array(n).fill(0);
  const assists = Array.from({ length: n }, () => new Map());
  const pair = new Map(); // 'x-y' (x < y) -> [points of x, points of y]
  const after = new Map(); // point id -> [x, y, points of x, points of y] right after that point
  for (const p of list) {
    if (p.a >= n || p.b >= n) continue;
    score[p.team]++;
    lost[p.team === p.a ? p.b : p.a]++;
    if (p.assist) assists[p.team].set(p.assist, (assists[p.team].get(p.assist) ?? 0) + 1);
    else none[p.team]++;
    const x = Math.min(p.a, p.b), y = Math.max(p.a, p.b);
    const s = pair.get(`${x}-${y}`) ?? [0, 0];
    s[p.team === x ? 0 : 1]++;
    pair.set(`${x}-${y}`, s);
    after.set(p.id, [x, y, s[0], s[1]]);
  }
  return { score, lost, none, assists, pair, after };
}

// ---------- drawing ----------

// A poll redraws only when something changed: redrawing replaces the buttons, and a tap that lands on a button just
// as it is replaced is lost.
const sig = () => `${game}|${srv?.rev}|${srv?.points.length}|${net}|${loaded}|${ops.length}`;
let drawn = '';

function render() {
  drawn = sig();
  renderSync();
  document.body.classList.toggle('nogame', !srv);
  if (!srv) {
    $('#meta').textContent = loaded ? '' : net === 'offline' ? '连不上服务器，有信号了会自动再试' : '正在连接服务器…';
    $('#board').replaceChildren(...(loaded ? [h('div', { class: 'start' }, '还没有比赛。', h('br'), h('button', { type: 'button', onclick: () => openRoster('new') }, '填名单，开始第一场'))] : []));
    return;
  }
  const ts = teams(), n = ts.length, all = allPoints();
  const days = [...new Set(all.map((p) => dayOf(p.at)))];
  if (view !== 'all' && view !== 'auto' && !days.includes(view)) view = 'auto';
  const day = view === 'auto' ? days.at(-1) : view;
  const list = view === 'all' ? all : all.filter((p) => dayOf(p.at) === day);
  const t = tally(list, n);

  $('#meta').textContent = !all.length ? '还没开始记分' : view === 'all' && days.length > 1 ? `${dayLabel(days[0])} – ${dayLabel(days.at(-1))} · 共 ${list.length} 分` : `${dayLabel(day)} · 共 ${list.length} 分`;
  const daysNav = $('#days');
  daysNav.hidden = days.length < 2;
  daysNav.replaceChildren(...[...days, 'all'].map((k) => h('button', { type: 'button', class: (k === 'all' ? view === 'all' : view !== 'all' && k === day) ? 'on' : '', onclick: () => { view = k; render(); } }, k === 'all' ? '全部' : dayLabel(k))));

  // the board: points scored by each team, points let in underneath
  const key = `${srv.game}|${view === 'all' ? 'all' : day}`;
  const board = $('#board');
  board.style.setProperty('--n', n);
  board.replaceChildren(...ts.map((tm, i) => h('div', { class: 'team', style: `--c:${color(i)}` },
    h('div', { class: 'name' }, tm.name),
    h('div', { class: 'score' + (shown.key === key && t.score[i] > (shown.score[i] ?? 0) ? ' bump' : '') }, String(t.score[i])),
    h('div', { class: 'sub' }, `失 ${t.lost[i]}`))));
  shown = { key, score: t.score };
  $('#h2h').replaceChildren(...pairsOf(n).filter(([a, b]) => t.pair.has(`${a}-${b}`)).map(([a, b]) => {
    const [sa, sb] = t.pair.get(`${a}-${b}`);
    return h('span', {}, h('b', { style: `color:${color(a)}` }, teamName(a)), ` ${sa} : ${sb} `, h('b', { style: `color:${color(b)}` }, teamName(b)));
  }));

  renderRecord(n, all);
  renderStats(ts, t);
  renderLog(list, t);
}

function renderRecord(n, all) {
  const pairs = pairsOf(n);
  if (n === 2) pick.pair = [0, 1];
  else if (pick.pair && !pairs.some(([a, b]) => a === pick.pair[0] && b === pick.pair[1])) pick.pair = null;
  if (pick.team !== null && !pick.pair?.includes(pick.team)) pick.team = null;
  $('#pairStep').hidden = n <= 2;
  $('#pairs').style.gridTemplateColumns = `repeat(${Math.min(3, pairs.length)}, minmax(0, 1fr))`;
  $('#pairs').replaceChildren(...pairs.map(([a, b]) => {
    const on = pick.pair?.[0] === a && pick.pair?.[1] === b;
    return h('button', { type: 'button', class: 'pair' + (on ? ' on' : ''), 'aria-pressed': String(on), onclick: () => choosePair(a, b) },
      h('b', { style: `color:${color(a)}` }, teamName(a)), h('span', { class: 'vs' }, 'vs'), h('b', { style: `color:${color(b)}` }, teamName(b)));
  }));

  const scorers = $('#scorers');
  if (!pick.pair) {
    scorers.className = '';
    scorers.replaceChildren(h('div', { class: 'hintline' }, '先点上面：这一分是哪两队在打'));
  } else {
    // today's score between these two, so whoever records sees where the game stands
    const [a, b] = pick.pair;
    const today = dayOf(Date.now());
    const s = tally(all.filter((p) => dayOf(p.at) === today), n).pair.get(`${a}-${b}`) ?? [0, 0];
    const btn = (i) => h('button', { type: 'button', class: 'scorer' + (pick.team === i ? ' on' : ''), style: `--c:${color(i)};--t:${color(i)}1f`, 'aria-pressed': String(pick.team === i), onclick: () => chooseTeam(i) }, teamName(i));
    scorers.className = 'scorers';
    scorers.replaceChildren(btn(a), h('div', { class: 'vsScore' }, `${s[0]} : ${s[1]}`, h('small', {}, '今天')), btn(b));
  }

  const step = $('#assistStep');
  const wasHidden = step.hidden;
  step.hidden = pick.team === null;
  if (pick.team === null) return;
  const tm = teams()[pick.team];
  const chip = (name) => h('button', { type: 'button', class: 'chip', style: `--c:${color(pick.team)}`, onclick: () => record(name) }, name);
  // one roster row = one line of buttons (5 across when a row has 5 people), so the two rows stay as she wrote them
  const cols = `grid-template-columns:repeat(${Math.min(5, Math.max(4, ...tm.groups.map((g) => g.length)))}, minmax(0, 1fr))`;
  $('#assists').replaceChildren(
    ...tm.groups.filter((g) => g.length).map((g) => h('div', { class: 'chips', style: cols }, ...g.map(chip))),
    h('div', { class: 'chips', style: cols }, h('button', { type: 'button', class: 'chip none', onclick: () => record(null) }, '无助攻')));
  if (wasHidden) step.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function renderStats(ts, t) {
  const max = Math.max(1, ...t.assists.flatMap((m) => [...m.values()]));
  $('#stats').replaceChildren(...ts.map((tm, i) => {
    const roster = tm.groups.flat();
    // names that are not on the roster any more (renamed after they were recorded) still count
    const names = [...roster, ...[...t.assists[i].keys()].filter((k) => !roster.includes(k))];
    const rows = names.map((name, k) => ({ name, k, c: t.assists[i].get(name) ?? 0, gone: !roster.includes(name) })).sort((x, y) => y.c - x.c || x.k - y.k);
    const total = rows.reduce((sum, r) => sum + r.c, 0);
    const row = (label, c, extra) => h('div', { class: 'prow' + (c ? '' : ' zero') }, h('span', { class: 'pn' }, label, extra), h('span', { class: 'bar' }, h('i', { style: `width:${(c / max) * 100}%` })), h('b', { class: 'pc' }, String(c)));
    return h('div', { style: `--c:${color(i)}` },
      h('div', { class: 'thead' }, h('b', {}, tm.name), h('span', {}, `得 ${t.score[i]} 分 · 助攻 ${total} 次`)),
      h('div', { class: 'prows' }, ...rows.map((r) => row(r.name, r.c, r.gone ? h('small', {}, ' 旧名') : null)), t.none[i] ? row('无助攻', t.none[i]) : null));
  }));
}

function renderLog(list, t) {
  const num = new Map(list.map((p, k) => [p.id, k + 1]));
  $('#count').textContent = list.length ? `${list.length} 分` : '';
  $('#log').replaceChildren(...(list.length
    ? [...list].reverse().map((p) => {
        const [x, y, sx, sy] = t.after.get(p.id) ?? [p.a, p.b, 0, 0];
        return h('li', { class: p.pending ? 'pending' : '', style: `--c:${color(p.team)}` },
          h('span', { class: 'no' }, `#${num.get(p.id)}`),
          h('div', { class: 'what' },
            h('div', {}, h('b', {}, `${teamName(p.team)}得分`), h('span', { class: 'sc' }, `${teamName(x)} ${sx} : ${sy} ${teamName(y)}`)),
            h('div', { class: 'sub' }, `${p.assist ? `${p.assist} 助攻` : '无助攻'} · ${clock(p.at)}${p.pending ? ' · 等待上传' : ''}`)),
          h('button', { type: 'button', class: 'del', 'aria-label': `删掉第 ${num.get(p.id)} 分`, onclick: () => removePoint(p, num.get(p.id)) }, '×'));
      })
    : [h('li', { class: 'emptyrow' }, '还没有记分。打完一分，在上面点得分的队和助攻的人。')]));
}

function renderSync() {
  const el = $('#sync');
  let cls = 'ok', text = '已同步';
  if (net === 'offline') { cls = 'warn'; text = ops.length ? `没连上 · ${ops.length} 条待上传` : '没连上服务器'; }
  else if (ops.length) { cls = 'busy'; text = `上传中 · ${ops.length} 条`; }
  else if (net === 'busy') { cls = 'busy'; text = '同步中…'; }
  el.className = 'sync ' + cls;
  el.querySelector('span').textContent = text;
  el.title = netMsg;
}

let toastTimer = 0;
function toast(text, undo) {
  const el = $('#toast');
  el.replaceChildren(h('span', {}, text), undo ? h('button', { type: 'button', onclick: () => { hideToast(); undo(); } }, '撤销') : null);
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, undo ? 6000 : 3500);
}
function hideToast() {
  const el = $('#toast');
  el.classList.remove('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 250);
}

// ---------- recording ----------

function choosePair(a, b) {
  pick = { pair: [a, b], team: null };
  keep.set('fb:pair:' + srv.game, pick.pair);
  render();
}

function chooseTeam(i) {
  pick.team = pick.team === i ? null : i;
  render();
  if (pick.team !== null) poll(); // fresh numbers before the assist is picked: another phone may have just recorded this point
}

function record(assist) {
  if (Date.now() - lastRecord < 700 || pick.team === null || !pick.pair) return; // a double tap records once
  const [a, b] = pick.pair, team = pick.team;
  const twin = allPoints().filter((p) => p.by !== me && Date.now() - p.at < TWIN_MS && Math.min(p.a, p.b) === a && Math.max(p.a, p.b) === b).at(-1);
  if (twin && !confirm(`${Math.max(1, Math.round((Date.now() - twin.at) / 1000))} 秒前，别的手机刚记了一分：${teamName(twin.team)}得分${twin.assist ? `，${twin.assist}助攻` : ''}。\n\n这是另外一分吗？点「确定」也记上，点「取消」就不记了。`)) {
    pick.team = null;
    render();
    return;
  }
  lastRecord = Date.now();
  const g = srv.game, point = { id: rid(12), at: Date.now(), a, b, team, assist, by: me };
  pick.team = null;
  view = 'auto';
  queue({ op: 'add', game: g, point });
  toast(`${teamName(team)} +1 · ${assist ? `${assist}助攻` : '无助攻'}`, () => unqueueOr(g, point.id, true));
}

// take back a point: if it is still waiting on this phone just forget it, otherwise ask the server
function unqueueOr(g, id, deleted) {
  const i = ops.findIndex((o) => o.op === 'add' && o.point.id === id && !o.sending);
  if (deleted && i >= 0) {
    const [op] = ops.splice(i, 1);
    saveOps();
    render();
    return () => queue(op);
  }
  queue({ op: 'del', game: g, id, deleted });
  return () => queue({ op: 'del', game: g, id, deleted: !deleted });
}

function removePoint(p, num) {
  if (!confirm(`删掉第 ${num} 分？\n${teamName(p.team)}得分，${p.assist ? `${p.assist}助攻` : '无助攻'}，${clock(p.at)}`)) return;
  const undo = unqueueOr(srv.game, p.id, true);
  toast(`删掉了第 ${num} 分`, undo);
}

// ---------- talking to the server ----------

let apiAt = 0; // the address that answered last is asked first
async function api(path, body) {
  let lastErr = null;
  for (let k = 0; k < APIS.length; k++) {
    const i = (apiAt + k) % APIS.length;
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 12_000);
    try {
      const res = await fetch(APIS[i] + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal, cache: 'no-store' });
      const out = await res.json().catch(() => ({}));
      if (res.status >= 500) throw new Error(out.message || `服务器出错（${res.status}）`);
      apiAt = i;
      if (!res.ok) throw Object.assign(new Error(out.message || `没成功（${res.status}）`), { status: res.status });
      return out;
    } catch (e) {
      if (e.status) throw e; // the server itself said no: the other address would say the same
      lastErr = e.name === 'AbortError' ? new Error('服务器没回应') : e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr ?? new Error('连不上服务器');
}

const saveOps = () => keep.set('fb:ops', ops.map(({ sending, ...o }) => o));
function queue(op) {
  ops.push(op);
  saveOps();
  render();
  flush();
}

let flushing = false, retryTimer = 0, backoff = 2000;
async function flush() {
  clearTimeout(retryTimer);
  if (flushing || !ops.length) return;
  flushing = true;
  let wrote = false;
  try {
    while (ops.length) {
      const o = ops[0];
      o.sending = true;
      try {
        await api('/api/frisbee/point', o.op === 'add' ? { game: o.game, ...o.point } : { game: o.game, id: o.id, deleted: o.deleted });
      } catch (e) {
        o.sending = false;
        if (e.status >= 400 && e.status < 500 && e.status !== 429) {
          // the server will never take this one: drop it and say so, instead of blocking everything after it
          ops.shift();
          saveOps();
          toast(`有一条没存上：${e.message}`);
          continue;
        }
        net = 'offline';
        netMsg = e.message;
        retryTimer = setTimeout(flush, backoff);
        backoff = Math.min(backoff * 2, 30_000);
        return;
      }
      ops.shift();
      saveOps();
      wrote = true;
      backoff = 2000;
      // fold it into the server's copy at once, so nothing flickers until the next poll brings it back anyway
      if (srv?.game === o.game) {
        if (o.op === 'add') { if (!srv.points.some((p) => p.id === o.point.id)) srv.points.push({ ...o.point }); }
        else srv.points = srv.points.map((p) => (p.id === o.id ? { ...p, deleted: o.deleted } : p));
      }
    }
  } finally {
    flushing = false;
    render();
    if (wrote) poll();
  }
}

let polling = false, pollAgain = false, pollTimer = 0;
async function poll() {
  clearTimeout(pollTimer);
  if (polling) { pollAgain = true; return; }
  polling = true;
  try {
    for (let tries = 0; tries < 3; tries++) {
      let out;
      try {
        out = await api('/api/frisbee/state', { game: game ?? undefined, rev: srv && srv.game === game ? srv.rev : undefined });
      } catch (e) {
        if (e.status === 404 && game) { game = null; follow = true; continue; } // that game is gone: show the newest one
        throw e;
      }
      if (!out.game) { game = null; srv = null; break; }
      if (follow && out.latest && out.game !== out.latest) { game = out.latest; continue; } // someone started a new game
      game = out.game;
      if (!out.same) setSrv({ game: out.game, rev: out.rev, info: out.info, points: out.points });
      break;
    }
    keep.set('fb:game', game);
    loaded = true;
    net = 'ok';
    netMsg = '';
  } catch (e) {
    net = 'offline';
    netMsg = e.message;
  } finally {
    polling = false;
    if (sig() !== drawn) render();
    if (pollAgain) { pollAgain = false; poll(); }
    else if (!document.hidden) pollTimer = setTimeout(poll, POLL_MS);
  }
}

function setSrv(s) {
  if (srv?.game !== s.game) {
    pick = { pair: keep.get('fb:pair:' + s.game, null), team: null };
    view = 'auto';
  }
  srv = s;
  keep.set('fb:srv', s);
}

// ---------- roster and games ----------

const rosterText = (ts) => ts.map((t) => `${t.name}：${t.groups.map((g) => g.join(' ')).join(' ｜ ')}`).join('\n');
const okName = (s, max) => [...s].length <= max && NAME_RE.test(s);
let rosterMode = 'edit';

// one line per team: "队名：名字 名字 ｜ 名字 名字" (the name and the bar are both optional)
function checkRoster(text) {
  const ts = [];
  for (const raw of text.split('\n')) {
    let line = raw.trim();
    if (!line) continue;
    let name = '';
    const m = line.match(/^([^：:]*)[：:](.*)$/);
    if (m) { name = m[1].trim(); line = m[2]; }
    const parts = line.split(/[｜|]/).map((g) => g.split(/[\s,，、]+/).filter(Boolean));
    const groups = [parts[0] ?? [], parts.slice(1).flat()].filter((g) => g.length);
    ts.push({ name: name || `${'ABCD'[ts.length] ?? ts.length + 1}队`, groups });
  }
  if (ts.length < 2 || ts.length > 4) return { error: `现在是 ${ts.length} 队，需要 2–4 队（一行一队）` };
  if (rosterMode === 'edit' && srv && ts.length !== srv.info.teams.length) return { error: `这场是 ${srv.info.teams.length} 队；要换队伍数量，请开新的一场` };
  const seen = new Set();
  for (const t of ts) {
    if (!okName(t.name, 8)) return { error: `队名「${t.name}」不行：1–8 个字，不带空格和标点` };
    if (seen.has(t.name)) return { error: `有两个队都叫「${t.name}」` };
    seen.add(t.name);
    const players = t.groups.flat();
    if (!players.length) return { error: `${t.name}还没有人` };
    if (players.length > 20) return { error: `${t.name}超过 20 个人了` };
    const long = players.find((p) => !okName(p, 12));
    if (long) return { error: `「${long}」太长了（最多 12 个字）` };
    const dup = players.find((p, k) => players.indexOf(p) !== k);
    if (dup) return { error: `${t.name}里有两个「${dup}」` };
  }
  return { teams: ts };
}

function openRoster(mode) {
  rosterMode = srv ? mode : 'new';
  $('#rosterTitle').textContent = rosterMode === 'new' ? '开新的一场' : '编辑名单';
  $('#rosterSave').textContent = rosterMode === 'new' ? '开始新的一场' : '保存名单';
  $('#rosterText').value = srv ? rosterText(srv.info.teams) : DEFAULT_ROSTER;
  $('#rosterNote').textContent = rosterMode === 'new'
    ? srv ? '开了以后，打开这个网页的手机都会换到新的一场；这一场的记录还在，「以前的比赛」里能看到。' : ''
    : allPoints().length ? '改了名字以后，已经记下的助攻还算在原来的名字上（显示「旧名」）。' : '';
  previewRoster();
  $('#rosterDlg').showModal();
}

function previewRoster() {
  const { teams: ts, error } = checkRoster($('#rosterText').value);
  $('#rosterPreview').replaceChildren(...(error ? [h('p', { class: 'err' }, error)] : ts.map((t, i) => h('div', { class: 'pv', style: `--c:${color(i)}` }, h('b', {}, t.name), ...t.groups.map((g) => h('div', {}, g.join('、')))))));
  $('#rosterSave').disabled = Boolean(error);
}

async function saveRoster() {
  const { teams: ts, error } = checkRoster($('#rosterText').value);
  if (error) return;
  const btn = $('#rosterSave');
  btn.disabled = true;
  try {
    if (rosterMode === 'new') {
      const out = await api('/api/frisbee/game', { teams: ts });
      game = out.game;
      follow = true;
      setUrl(null);
    } else {
      await api('/api/frisbee/game', { game: srv.game, teams: ts });
    }
    $('#rosterDlg').close();
    toast(rosterMode === 'new' ? '新的一场开始了' : '名单改好了');
    poll();
  } catch (e) {
    $('#rosterPreview').prepend(h('p', { class: 'err' }, `没存上：${e.message}`));
  } finally {
    btn.disabled = false;
  }
}

async function openGames() {
  const list = $('#gamesList');
  list.replaceChildren(h('li', { class: 'muted' }, '正在读取…'));
  $('#gamesDlg').showModal();
  try {
    const out = await api('/api/frisbee/games', {});
    // empty games are left out (a game opened by mistake), except the newest one and the one on screen
    const games = out.games.filter((g) => g.points > 0 || g.id === out.latest || g.id === srv?.game);
    list.replaceChildren(...(games.length
      ? games.map((g) => h('li', {}, h('button', { type: 'button', class: g.id === srv?.game ? 'on' : '', onclick: () => { $('#gamesDlg').close(); switchGame(g.id, g.id === out.latest); } },
          h('b', {}, g.first ? dayLabel(dayOf(g.first)) : '还没开始'),
          h('span', {}, `${g.teams.join(' · ')} · ${g.points} 分`),
          g.id === out.latest ? h('em', {}, '最新') : null,
          g.id === srv?.game ? h('em', {}, '正在看') : null)))
      : [h('li', { class: 'muted' }, '还没有比赛')]));
  } catch (e) {
    list.replaceChildren(h('li', { class: 'muted' }, `读不到：${e.message}`));
  }
}

function switchGame(id, isLatest) {
  follow = isLatest;
  game = id;
  setUrl(isLatest ? null : id);
  poll();
}

function setUrl(g) {
  const u = new URL(location.href);
  if (g) u.searchParams.set('g', g);
  else u.searchParams.delete('g');
  history.replaceState(null, '', u);
}

// ---------- start ----------

$('#sync').addEventListener('click', () => { flush(); poll(); });
$('#cancelPick').addEventListener('click', () => { pick.team = null; render(); });
$('#editBtn').addEventListener('click', () => openRoster('edit'));
$('#newBtn').addEventListener('click', () => openRoster('new'));
$('#gamesBtn').addEventListener('click', openGames);
$('#rosterText').addEventListener('input', previewRoster);
$('#rosterSave').addEventListener('click', saveRoster);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { flush(); poll(); } });
addEventListener('online', () => { flush(); poll(); });
addEventListener('pageshow', (e) => { if (e.persisted) { flush(); poll(); } });

render();
flush();
poll();
