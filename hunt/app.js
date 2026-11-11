import HUNT from "./data.js";
import { open as openSealed } from "./vault.js";
import { norm } from "./norm.js";
import { MORSE, T9, LETTERS, SOLFEGE, KEYS, shiftChar } from "./ciphers.js";
import { mountAkari, akariStatic } from "./akari-ui.js";
import { mountLamps, lampsStatic } from "./lamps-ui.js";
import { mountTrace, traceStatic } from "./trace-ui.js";
import { mountColors, colorsStatic } from "./colors-ui.js";
import { mountHeart, heartStatic } from "./heart-ui.js";
import { mountCrowd, crowdStatic } from "./crowd-ui.js";
import { mountDuo } from "./duo.js";

const M = HUNT.meta;
const N = M.total;
const OPEN = M.open ?? N; // how many cards this page holds: the later ones are not in it at all (`open` in story.mjs)
const parked = OPEN < N; // so for now the story stops after card OPEN, with M.later on the screen
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const paras = (text) => [].concat(text).filter(Boolean).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");

// ── time ────────────────────────────────────────────────────────────────────────────────────────────────────────
// instant: no dates at all: card 1 is there from the start and every next card opens as soon as the one before is solved
//          (if a startDate is set anyway, card 1 waits for it)
// daily:   card k opens at startDate + (k-1) days, at openHour, on his own device's clock
// `?day=3` pretends it is card 3's day (only in a preview build of a daily game, so he cannot use it).
const params = new URLSearchParams(location.search);
const previewDay = M.allowPreview && M.pace === "daily" ? Number(params.get("day")) || 0 : 0;
const openAt = (k) => {
  if (!M.startDate) return 0;
  const [y, m, d] = M.startDate.split("-").map(Number);
  return new Date(y, m - 1, d + (M.pace === "instant" ? 0 : k - 1), M.openHour).getTime();
};
const now = () => (previewDay ? openAt(previewDay) + 60_000 : Date.now());
const WEEK = "日一二三四五六";
const when = (t) => {
  const d = new Date(t);
  return `${d.getMonth() + 1}月${d.getDate()}日 周${WEEK[d.getDay()]} ${String(d.getHours()).padStart(2, "0")}:00`;
};
const countdown = (ms) => {
  const mins = Math.max(0, Math.ceil(ms / 60_000));
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  return [d ? `${d} 天` : "", d || h ? `${h} 小时` : "", `${m} 分钟`].filter(Boolean).join(" ");
};

// ── progress (kept in this browser only) ───────────────────────────────────────────────────────────────────────
const KEY = `hunt:${M.id}`;
if (M.allowPreview && params.get("reset")) {
  try { localStorage.removeItem(KEY); } catch {}
  history.replaceState(null, "", location.pathname + (previewDay ? `?day=${previewDay}` : ""));
}
let saved = {};
try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch {}
const st = { started: !!saved.started, done: Array.isArray(saved.done) ? saved.done : [] }; // done: [{ t: token, wrong, hints, skipped }]
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} };

let cards = [HUNT.first]; // cards[k-1] is what card k is made of; later ones unlock as he goes
let justSolved = 0; // the card whose gift is on screen right now
let ticker = 0;
let cur = null; // counters for the card being played
let redoing = null; // while a solved card is being played again: { saved } (what was on the stage, put aside)

async function restore() {
  cards = [HUNT.first];
  for (let i = 0; i < st.done.length; i++) {
    if (!cards[i] || st.done[i].t !== cards[i].token) { st.done.length = i; break; }
    if (i + 1 < OPEN) {
      const next = await openSealed(HUNT.sealed[i], cards[i].token);
      if (!next) { st.done.length = i; break; }
      cards.push(next);
    }
  }
  persist();
}

// ── what a card looks like ─────────────────────────────────────────────────────────────────────────────────────
// dots and dashes drawn as shapes, so a row of dashes can still be counted
const dots = (code) => `<span class="code">${[...code].map((ch) => `<i class="${ch === "." ? "d" : "b"}"></i>`).join("")}</span>`;
const NOTE = Object.fromEntries(Object.entries(SOLFEGE).map(([name, key]) => [key, name]));
const answerText = (c) => String(c.answers[0]);

function piano(keys) {
  const orders = {};
  for (const k of keys) (orders[k.key] ||= []).push(k.order);
  const white = KEYS.map((n, i) => {
    const o = orders[n];
    return `<rect x="${i * 40}" y="1" width="40" height="120" class="wk${o ? " on" : ""}"/>${o ? `<circle cx="${i * 40 + 20}" cy="98" r="12" class="badge"/><text x="${i * 40 + 20}" y="103" class="bn">${o.join("·")}</text>` : ""}`;
  }).join("");
  const black = [0, 1, 3, 4, 5].map((i) => `<rect x="${i * 40 + 27}" y="1" width="26" height="72" class="bk"/>`).join("");
  return `<svg class="piano" viewBox="0 0 281 123" role="img" aria-label="钢琴键">${white}${black}</svg>`;
}

function visual(c, small = false) {
  switch (c.type) {
    case "morse":
    case "numbers":
    case "caesar":
    case "atbash":
    case "t9":
      return `<div class="rows ${c.type}">${c.rows.map((w) => `<p>${w.map((x) => `<span class="u">${c.type === "morse" ? dots(x) : esc(x)}</span>`).join("")}</p>`).join("")}</div>`;
    case "shuffle":
      return `${small ? "" : `<p class="poem">${esc(c.text)}</p>`}<div class="letters">${[...c.from].map((ch) => `<span>${esc(ch)}</span>`).join("")}</div>`;
    case "piano":
      return piano(c.keys);
    case "know":
      return `<p class="question">${esc(c.question)}</p>`;
    case "akari":
      return akariStatic(c);
    case "lamps":
      return lampsStatic(c);
    case "trace":
      return traceStatic(c);
    case "colors":
      return colorsStatic(c);
    case "heart":
      return heartStatic(c);
    case "crowd":
      return crowdStatic(c);
    case "lock":
      return `<div class="lock"><p class="lock-ic" aria-hidden="true">🔒</p>${c.sentence ? `<p class="lock-sentence">“${esc(c.sentence)}”</p>` : ""}</div>`;
    default:
      return "";
  }
}

const tag = (c, mark = "") => `<p class="hint-tag">${c.numbered === false ? "" : `Hint #${c.n}`}${c.label ? `<b${c.numbered === false ? ' class="solo"' : ""}>${esc(c.label)}</b>` : ""}${mark}</p>`;

function tool(c) {
  const grid = (items) => `<div class="grid">${items.map(([k, v]) => `<span><b>${esc(k)}</b> ${esc(v)}</span>`).join("")}</div>`;
  switch (c.tool) {
    case "morse": return `<p class="tool-title">摩斯电码对照表</p><div class="mgrid">${LETTERS.map((L) => `<span class="mcell"><b>${L}</b>${dots(MORSE[L])}</span>`).join("")}</div>`;
    case "numbers": return `<p class="tool-title">数字对应字母</p>${grid(LETTERS.map((L, i) => [L, String(i + 1).padStart(2, "0")]))}`;
    case "t9": return `<p class="tool-title">老手机九宫格:按几下,就是第几个</p>${grid(LETTERS.map((L) => [L, T9[L]]))}`;
    case "atbash": return `<p class="tool-title">字母表倒过来</p>${grid(LETTERS.map((L) => [L, shiftChar("A", 25 - (L.charCodeAt(0) - 65))]))}`;
    case "piano": return `<p class="tool-title">钢琴键 → 唱名</p>${grid(KEYS.map((K) => [K, NOTE[K]]))}`;
    case "caesar": return `<p class="tool-title">凯撒转盘:往回挪几位?</p><div class="row"><input type="range" id="shift" min="0" max="25" value="0" aria-label="往回挪几位"><b id="shiftN">0</b></div><p class="decoded" id="decoded"></p>`;
    default: return "";
  }
}

function bindTool(c) {
  if (c.tool !== "caesar") return;
  const slider = $("#shift");
  const show = () => {
    const s = Number(slider.value);
    $("#shiftN").textContent = s;
    $("#decoded").textContent = c.rows.map((w) => w.map((ch) => shiftChar(ch, -s)).join("")).join("  ");
  };
  slider.addEventListener("input", show);
  show();
}

// ── pieces of the page ─────────────────────────────────────────────────────────────────────────────────────────
function media(g) {
  return [
    g.scene ? `<div class="scene" data-scene="${esc(g.scene)}"></div>` : "", // the little animation (src/duo.js), started by startScenes()
    g.photo ? `<img class="shot" src="${esc(g.photo)}" alt="">` : "",
    g.audio ? `<p class="voice"><span>${esc(g.audioLabel || "点一下,听我说")}</span><audio controls preload="none" src="${esc(g.audio)}"></audio></p>` : "",
  ].join("");
}

// the small label of a gift: its own `tag`; "Gift #n" when no `tag` is written; no label at all when it is written as ""
const giftTag = (g, n) => (g.tag === undefined ? `Gift #${n}` : g.tag);
const giftBox = (c) => {
  const tag = giftTag(c.gift, c.n);
  return `<div class="gift">${tag ? `<p class="gift-tag">${esc(tag)}</p>` : ""}<h3>${esc(c.gift.title)}</h3>${c.gift.note ? `<p>${esc(c.gift.note)}</p>` : ""}${media(c.gift)}</div>`;
};

// the little animations on the page right now (they are started after the page is drawn and stopped before the next drawing)
const scenes = [];
function startScenes(el) {
  for (const box of el.querySelectorAll('.scene[data-scene="duo"]')) scenes.push(mountDuo(box));
}
function stopScenes() {
  while (scenes.length) scenes.pop().stop();
}

const TILT = [-3, 2, -1.5, 3, -2.5, 1.5, -2, 2.5];

function drawTable() {
  const done = st.done.length;
  const finished = done >= N && !justSolved;
  const pieces = [];
  if (st.started || done) {
    pieces.push(`<div class="mini start-mini" style="--r:${TILT[0]}deg"><img src="${esc(M.start.photo)}" alt=""><p>${esc(M.start.lines[0])}</p></div>`);
    const him = M.start.him; // his card sits next to hers
    if (him) pieces.push(`<div class="mini start-mini him-mini" style="--r:2.5deg"><img src="${esc(him.photo)}" alt="">${him.line ? `<p>${esc(him.line)}</p>` : ""}</div>`);
  }
  for (let i = 0; i < done; i++) {
    if (i === justSolved - 1) continue; // it is on screen above, don't show it twice
    const c = cards[i];
    pieces.push(`<div class="mini redoable" role="button" tabindex="0" data-redo="${i + 1}" aria-label="再做一遍:Hint #${c.n}" style="--r:${TILT[(i + 1) % TILT.length]}deg">${tag(c)}${visual(c, true)}<p class="ans">${esc(answerText(c))}</p><i class="redo-ic" aria-hidden="true">↺</i></div>`);
  }
  if (finished) {
    const f = cards[N - 1].final;
    pieces.push(`<div class="mini final-mini" style="--r:${TILT[3]}deg"><p class="big">${esc(f.big || "")}</p><p class="script">${esc(f.script || "")}</p></div>`);
  }
  $("#table").innerHTML = pieces.length ? `${done ? `<p class="table-note">↺ 点一张卡,可以再做一遍</p>` : ""}<div class="table">${pieces.join("")}</div>` : "";
}

function drawGifts() {
  const got = cards.map((c, i) => ({ c, i })).filter(({ c, i }) => c.gift && i < st.done.length && i !== justSolved - 1);
  if (!got.length) { $("#gifts").innerHTML = ""; return; }
  const rows = got.map(({ c, i }) => {
    const again = c.gift.scene ? ` role="button" tabindex="0" data-gift="${i + 1}" aria-label="再看一遍:${esc(c.gift.title)}"` : "";
    const tag = giftTag(c.gift, i + 1);
    return `<li class="got"${again}>${tag ? `<span>${esc(tag)}</span>` : ""}${esc(c.gift.title)}${c.gift.scene ? `<i class="redo-ic" aria-hidden="true">↺</i>` : ""}</li>`;
  });
  $("#gifts").innerHTML = `<div class="gift-list"><p class="gift-head">礼物 ${got.length}</p><ul>${rows.join("")}</ul></div>`;
}

function drawSentence() {
  const el = $("#sentence");
  if (!M.pieces || !(st.started || st.done.length)) { el.hidden = true; return; }
  const chips = [];
  cards.slice(0, st.done.length).forEach((c, i) => {
    if (c.piece) chips.push(`<span class="w got" role="button" tabindex="0" data-redo="${i + 1}" title="再做一遍" aria-label="再做一遍:${esc(c.piece)}">${esc(c.piece)}</span>`);
  });
  for (let i = chips.length; i < M.pieces; i++) chips.push(`<span class="w">▒▒▒</span>`);
  el.innerHTML = chips.join("");
  el.hidden = false;
}

function stage() {
  clearTimers();
  const el = $("#stage");
  if (!st.started && !st.done.length) return startView(el);
  if (justSolved) return solvedView(el, justSolved);
  if (st.done.length >= N) return finalView(el);
  if (parked && st.done.length >= OPEN) return laterView(el);
  const k = st.done.length + 1;
  return !cards[k - 1]?.immediate && now() < openAt(k) ? waitingView(el, k) : clueView(el, k);
}

function startView(el) {
  const t = openAt(1);
  const wait = now() < t;
  const him = M.start.him; // with his picture: hers on the left, his on the right, the lines under them; without: hers beside the lines
  const lines = M.start.lines.map((l) => `<p>${esc(l)}</p>`).join("");
  el.innerHTML = `<article class="card start">
    ${him ? `<div class="start-duo"><img class="her" src="${esc(M.start.photo)}" alt=""><img class="him" src="${esc(him.photo)}" alt=""></div><div class="start-lines">${lines}</div>` : `<div class="start-row"><img src="${esc(M.start.photo)}" alt=""><div>${lines}</div></div>`}
    ${wait ? `<p class="muted center">第一张卡:${esc(when(t))}<br><span class="countdown" id="count"></span></p>` : `<p class="center"><button type="button" class="go" id="go">${esc(M.start.button)}</button></p>`}
  </article>`;
  if (wait) {
    const count = $("#count");
    const tick = () => {
      if (now() >= t) return render();
      count.textContent = `还有 ${countdown(t - now())}`;
    };
    tick();
    ticker = setInterval(tick, 15_000);
    return;
  }
  $("#go").addEventListener("click", () => {
    st.started = true;
    persist();
    render();
  });
}

function waitingView(el, k) {
  const t = openAt(k);
  const label = cards[k - 1]?.label;
  el.innerHTML = `<article class="card center">
    <p class="hint-tag">Hint #${k}${label ? `<b>${esc(label)}</b>` : ""}</p>
    <p class="wait-big">${esc(when(t))}</p>
    <p class="countdown muted" id="count"></p>
    <p class="muted">这张卡还没到。</p>
  </article>`;
  const count = $("#count");
  const tick = () => {
    if (now() >= t) return render();
    count.textContent = `还有 ${countdown(t - now())}`;
  };
  tick();
  ticker = setInterval(tick, 15_000);
}

function clueView(el, k, redo = false) {
  const c = cards[k - 1];
  const hints = c.hints || [];
  const me = { wrong: 0, hints: 0, skipped: false, finished: false }; // counters of this attempt
  if (!redo) cur = me; // a replay keeps its own counters and never counts
  const done = () => (redo ? finishRedo(me) : finish(k));
  el.innerHTML = `<article class="card clue">
    ${redo ? `<p class="redo-bar"><button type="button" class="ghost" id="redoback">← 回到刚才</button></p>` : ""}
    ${tag(c, redo ? `<i class="redo-mark">再做一遍</i>` : "")}
    ${c.how ? `<p class="how">${esc(c.how)}</p>` : ""}
    <div class="visual">${c.interactive || c.board ? `<div id="board"></div>` : visual(c)}</div>
    ${c.interactive ? "" : `<form id="form" autocomplete="off">
      <div class="row"><input id="ans" type="text" inputmode="${esc(c.inputmode || "text")}" placeholder="${esc(c.placeholder || c.ask)}" aria-label="${esc(c.ask)}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go"><button type="submit">提交</button></div>
      <p class="msg" id="msg" aria-live="polite"></p>
    </form>`}
    <div class="assist">
      <ol id="hintList"></ol>
      <div id="tool" class="tool" hidden></div>
      <div class="assist-row"><button type="button" class="ghost" id="hint"></button><button type="button" class="ghost" id="giveup" hidden>${c.type === "lock" ? "扫不出来?直接看密码" : "这张我认输,看答案"}</button></div>
      <div id="answer" hidden></div>
    </div>
  </article>`;

  if (redo) $("#redoback").addEventListener("click", closeRedo);
  const input = $("#ans");
  const msg = $("#msg");
  const hintBtn = $("#hint");
  const giveBtn = $("#giveup");
  let toolShown = false;
  const refresh = () => {
    hintBtn.hidden = !hints.length || me.hints >= hints.length;
    hintBtn.textContent = `要提示吗?(${Math.min(me.hints, hints.length)} / ${hints.length})`;
    const hintsLeft = hints.length > me.hints;
    giveBtn.hidden = c.interactive || c.board ? hintsLeft : !((!hintsLeft && me.wrong >= 3) || me.wrong >= 6);
    if (c.tool && !toolShown && (!hints.length || me.hints >= Math.min(2, hints.length))) {
      toolShown = true;
      $("#tool").innerHTML = tool(c);
      $("#tool").hidden = false;
      bindTool(c);
    }
  };
  let board = null; // the interactive puzzle, if this card has one
  hintBtn.addEventListener("click", () => {
    const said = board?.hint(c.hintFx?.[me.hints]); // a hint can also point at the board or help on it (and a board can word it after what it did)
    $("#hintList").insertAdjacentHTML("beforeend", `<li>${esc(typeof said === "string" ? said : hints[me.hints])}</li>`);
    me.hints++;
    refresh();
  });
  giveBtn.addEventListener("click", () => {
    board?.reveal();
    if ($("#form")) $("#form").hidden = true;
    giveBtn.hidden = true;
    hintBtn.hidden = true;
    const box = $("#answer");
    box.hidden = false;
    box.innerHTML = `<p>好吧,这张算你认输。答案是:<b>${esc(answerText(c))}</b></p><p class="center"><button type="button" class="go" id="skipgo">收下答案,继续</button></p>`;
    $("#skipgo").addEventListener("click", () => { me.skipped = true; done(); }, { once: true });
  });

  if (c.interactive) {
    board = { lamps: mountLamps, akari: mountAkari, colors: mountColors, heart: mountHeart }[c.type]($("#board"), c, { onSolved: done });
    refresh();
    return;
  }
  if (c.board) board = (c.type === "crowd" ? mountCrowd : mountTrace)($("#board"), c); // a board to think on; the answer is still typed in the box below
  const answers = c.answers.map(norm);
  const TEASE = ["不对。", "再想想。", "差一点点。", "这都能错?", "认真点。"];
  $("#form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!norm(input.value)) return;
    if (answers.includes(norm(input.value))) {
      if (!board?.celebrate) return done();
      input.disabled = true; // a right answer: the board cheers first, then the card is done
      const wait = board.celebrate(); // a board may say how long its celebration takes
      setTimeout(done, Number.isFinite(wait) ? wait : 1900);
      return;
    }
    me.wrong++;
    msg.textContent = TEASE[(me.wrong - 1) % TEASE.length];
    input.classList.remove("shake");
    void input.offsetWidth;
    input.classList.add("shake");
    input.select();
    refresh();
  });
  refresh();
}

async function finish(k) {
  if (cur.finished) return;
  cur.finished = true;
  const c = cards[k - 1];
  st.done.push({ t: c.token, wrong: cur.wrong, hints: cur.hints, skipped: cur.skipped });
  if (k < OPEN) {
    const next = await openSealed(HUNT.sealed[k - 1], c.token);
    if (next) cards.push(next);
  }
  persist();
  notify(k, c);
  justSolved = k;
  render();
  scrollTo({ top: 0, behavior: "smooth" });
}

// ── playing a solved card again ────────────────────────────────────────────────────────────────────────────────
// A solved card can be opened again from the table or from the sentence at the top. What is on the stage right now (a card he is in the
// middle of) is put aside and comes back as it was; a replay changes no progress and counts nothing.
function openRedo(k) {
  if (!cards[k - 1] || k > st.done.length) return;
  const el = $("#stage");
  if (!redoing) {
    const saved = document.createDocumentFragment();
    while (el.firstChild) saved.appendChild(el.firstChild);
    redoing = { saved };
  }
  stopScenes();
  clueView(el, k, true);
  scrollTo({ top: 0, behavior: "smooth" });
}

// a gift with a little animation can be watched again from the list at the bottom (the card he is on is put aside the same way)
function openGift(k) {
  const c = cards[k - 1];
  if (!c?.gift?.scene || k > st.done.length) return;
  const el = $("#stage");
  if (!redoing) {
    const saved = document.createDocumentFragment();
    while (el.firstChild) saved.appendChild(el.firstChild);
    redoing = { saved };
  }
  stopScenes();
  el.innerHTML = `<article class="card gift-card"><p class="redo-bar"><button type="button" class="ghost" id="redoback">← 回到刚才</button></p>${giftBox(c)}</article>`;
  $("#redoback").addEventListener("click", closeRedo);
  startScenes(el);
  scrollTo({ top: 0, behavior: "smooth" });
}

function closeRedo() {
  if (!redoing) return;
  const el = $("#stage");
  stopScenes();
  el.textContent = "";
  el.appendChild(redoing.saved);
  redoing = null;
  startScenes(el); // (a card that was put aside while its animation ran)
  scrollTo({ top: 0, behavior: "smooth" });
}

function finishRedo(me) {
  if (me.finished) return;
  me.finished = true;
  closeRedo();
}

function solvedView(el, k) {
  const c = cards[k - 1];
  const g = c.gift;
  const last = k >= N;
  const upcoming = cards[k]; // the next card is already unlocked, but it only opens at its time
  const rest = parked && k >= OPEN && M.later; // nothing comes after this card for now: say when to come back (unless the author wants nothing said: `later: false`)
  el.innerHTML = `<article class="card clue solved">
    ${tag(c, `<i class="ok">✓</i>`)}
    <div class="visual small">${visual(c, true)}</div>
    <p class="solved-line"><b>${esc(answerText(c))}</b></p>
    ${c.piece ? `<p class="piece">拼进句子里的词:<b>${esc(c.piece)}</b></p>` : ""}
    ${c.after ? `<p class="after">${esc(c.after)}</p>` : ""}
    ${g ? giftBox(c) : ""}
    ${rest ? `<p class="teaser">下一张:${esc(M.later.big)}${[].concat(M.later.lines)[0] ? `<br><span class="muted">${esc([].concat(M.later.lines)[0])}</span>` : ""}</p>` : ""}
    ${!last && upcoming ? `<p class="teaser">下一张:Hint #${upcoming.n}${upcoming.label ? ` · ${esc(upcoming.label)}` : ""}<br><span class="muted">${M.pace === "instant" || upcoming.immediate ? "现在就可以" : esc(when(openAt(k + 1)))}</span></p>` : ""}
    <p class="center"><button type="button" class="go" id="go">${last ? "看结果" : "收好"}</button></p>
  </article>`;
  $("#go").addEventListener("click", () => {
    justSolved = 0;
    render();
  });
  startScenes(el);
}

// every card that is open today is solved: the rest is not in this page yet, he comes back when the author has opened more
function laterView(el) {
  const L = M.later;
  if (!L) { el.textContent = ""; return; } // `later: false`: nothing is said, the table with the solved cards is all there is
  el.innerHTML = `<article class="card center later">
    <p class="later-big">${esc(L.big)}</p>
    ${L.script ? `<p class="later-script">${esc(L.script)}</p>` : ""}
    ${paras(L.lines)}
  </article>`;
}

function finalView(el) {
  const f = cards[N - 1].final;
  const total = st.done.reduce((a, d) => ({ wrong: a.wrong + d.wrong, hints: a.hints + d.hints, skipped: a.skipped + (d.skipped ? 1 : 0) }), { wrong: 0, hints: 0, skipped: 0 });
  el.innerHTML = `<article class="card final">
    ${f.big ? `<p class="big">${esc(f.big)}</p>` : ""}
    ${f.script ? `<p class="script">${esc(f.script)}</p>` : ""}
    ${f.zh ? `<p class="zh">${esc(f.zh)}</p>` : ""}
    ${paras(f.lines)}
    <p class="sum">答错 ${total.wrong} 次 · 提示 ${total.hints} 次 · 认输 ${total.skipped} 次</p>
    ${f.signature ? `<p class="sign">${esc(f.signature)}</p>` : ""}
    ${f.reward ? `<div class="gift reward">${f.reward.tag ? `<p class="gift-tag">${esc(f.reward.tag)}</p>` : ""}<h3>${esc(f.reward.title)}</h3>${f.reward.note ? `<p>${esc(f.reward.note)}</p>` : ""}${f.reward.href ? `<p class="center"><a class="go" href="${esc(f.reward.href)}">${esc(f.reward.button || "去看看")}</a></p>` : ""}</div>` : ""}
  </article>`;
}

function clearTimers() {
  clearInterval(ticker);
  stopScenes();
}

// Optional: ping the author's phone through ntfy.sh when a card is solved. Fire and forget; never blocks the game.
function notify(k, c) {
  if (!M.notifyTopic) return;
  const d = st.done[k - 1];
  try {
    fetch(`https://ntfy.sh/${encodeURIComponent(M.notifyTopic)}`, {
      method: "POST",
      mode: "no-cors",
      body: `Hint #${k}${c.label ? `(${c.label})` : ""}解开了:答错 ${d.wrong} 次,提示 ${d.hints} 次${d.skipped ? ",认输了" : ""}`,
    }).catch(() => {});
  } catch {}
}

// ── start ──────────────────────────────────────────────────────────────────────────────────────────────────────
function render() {
  redoing = null; // anything that redraws the page ends a replay
  drawSentence();
  stage();
  drawTable();
  drawGifts();
  const began = st.started || st.done.length;
  $("#progress").textContent = st.done.length >= N && !justSolved ? "全部通关" : `${began ? justSolved || Math.min(st.done.length + 1, OPEN) : 0} / ${N}`;
}

async function boot() {
  $("#title").textContent = M.title;
  document.title = M.title;
  if (M.allowPreview) {
    const bar = $("#preview");
    bar.hidden = false;
    const when = M.pace === "daily" ? `${previewDay ? `假装现在是第 ${previewDay} 天` : "按真实时间"} · ?day=1…${N} 切换` : "没有日期,一口气玩完";
    bar.textContent = `预览版(只在你电脑上):${when} · ?reset=1 清空进度 · ?duo 看小动画${parked ? ` · 线上只开放前 ${OPEN} 张,做完${M.later ? `显示“${M.later.big}”` : "什么也不显示"}` : ""}${M.sample ? " · 现在的内容是示例,不是你们的" : ""}`;
  }
  if (!globalThis.crypto?.subtle) {
    $("#stage").innerHTML = `<article class="card"><h2>换个浏览器试试</h2><p>这个页面需要在 https 下、用较新的浏览器(Safari / Chrome)打开。</p></article>`;
    return;
  }
  const redoFrom = (e) => {
    const t = e.target.closest("[data-redo]");
    if (t) openRedo(Number(t.dataset.redo));
  };
  for (const box of [$("#table"), $("#sentence")]) {
    box.addEventListener("click", redoFrom);
    box.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.closest("[data-redo]")) {
        e.preventDefault();
        redoFrom(e);
      }
    });
  }
  const giftFrom = (e) => {
    const g = e.target.closest("[data-gift]");
    if (g) openGift(Number(g.dataset.gift));
  };
  $("#gifts").addEventListener("click", giftFrom);
  $("#gifts").addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.closest("[data-gift]")) {
      e.preventDefault();
      giftFrom(e);
    }
  });
  await restore();
  render();
  if (M.allowPreview && params.has("duo")) { // preview only: ?duo shows the little animation right away, above the game
    const card = document.createElement("section");
    card.className = "card";
    card.innerHTML = `<p class="hint-tag">预览:小动画</p><div class="gift"><div class="scene"></div></div>`;
    $("#stage").before(card);
    mountDuo(card.querySelector(".scene"));
  }
}

boot();
