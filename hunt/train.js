// 训小狗模拟器 (the page). The rules are in src/train-engine.js, the puppy in src/train-rig.js, the words in train-data.js (made from train.mjs).
import data from "./train-data.js";
import { createRig, EXPR } from "./train-rig.js";
import { ROUNDS, TREATS, FEEDBACK, newGame, giveCommand, giveFeedback, nextRound, rngFrom, ENDING_IDS } from "./train-engine.js";

const app = document.getElementById("app");
const q = new URLSearchParams(location.search);
const rng = q.has("seed") ? rngFrom(Number(q.get("seed"))) : Math.random; // ?seed=7 replays the same game (for testing)
const ui = data.ui;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pick = (list) => list[Math.floor(rng() * list.length)];
const sleep = (ms) => new Promise((r) => setTimeout(r, q.has("fast") ? Math.min(ms, 30) : ms));
const fill = (t, o) => t.replace(/\{(\w+)\}/g, (_, k) => o[k]);
const store = {
  get(k, d) { try { const v = localStorage.getItem("train:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("train:" + k, JSON.stringify(v)); } catch { /* private window: the game works without it */ } },
};
const STAT = [["obey", "🦴"], ["mood", "💗"], ["pride", "👑"], ["temper", "💢"]];
const FEEDBACK_ACT = { pat: "pat", praise: "praise", frisbee: "frisbeePlay", hug: "hug", treat: "eat", ignore: "ignore", no: "no", flick: "flick", timeout: "timeout", confiscate: "confiscate" };

let rig = null, g = null, busy = false, bubbleTimer = null;
const $ = (s) => app.querySelector(s);
const dishSrc = (id) => `assets/dishes/${id}.png`;

// ── the first screen ─────────────────────────────────────────────────────────────────────────────
async function showStart() {
  const p = data.profile;
  const seen = store.get("endings", []);
  app.innerHTML = `
    <div class="top"><span class="t">${esc(data.title)}</span></div>
    <article class="card start">
      <h1>${esc(data.title)}</h1>
      <p class="sub">${esc(data.sub)}</p>
      <div class="pet">
        <div class="pet-pic" id="pup"></div>
        <dl class="profile">
          <dt>名字</dt><dd>${esc(p.name)}</dd><dt>品种</dt><dd>${esc(p.breed)}</dd><dt>爱好</dt><dd>${p.likes.split(" · ").map((w, i, a) => `<span class="nb">${esc(w)}${i < a.length - 1 ? " ·" : ""}</span>`).join(" ")}</dd><dt>弱点</dt><dd>${esc(p.weak)}</dd><dt>备注</dt><dd>${esc(p.note)}</dd>
        </dl>
      </div>
      <p class="startline">${esc(data.startLine)}</p>
      <button class="go big" id="go">${esc(data.start)}</button>
      <p class="muted center" id="coll">${esc(fill(ui.endings, { n: seen.length, total: ENDING_IDS.length }))}</p>
    </article>`;
  rig = createRig($("#pup"));
  $("#go").onclick = () => { rig.idle(false); startGame(); }; // (the button works at once; the pictures of her load while it is already there)
  window.__train = { get state() { return g; }, rig };
  await rig.ready;
  rig.idle(true);
}

// ── playing ───────────────────────────────────────────────────────────────────────────────────────
async function startGame() {
  g = newGame(rng);
  app.innerHTML = `
    <div class="top"><span class="t">${esc(data.title)}</span><span class="round" id="round"></span></div>
    <article class="card stage">
      <div class="arena">
        <div class="trainer"><img src="assets/train/him-face.png" alt=""><span>${esc(data.trainer ?? "训练师")}</span></div>
        <div class="bubble" id="bubble" hidden></div>
        <div id="pup"></div>
        <span class="badge" id="badge" hidden>🍺 晕乎乎</span>
      </div>
      <div class="stats" id="stats">${STAT.map(([k, icon]) => `<div class="stat ${k}"><span class="ic">${icon}</span><span class="lb">${esc(ui.stats[k])}</span><span class="bar"><i></i></span><b class="v"></b><em class="d"></em></div>`).join("")}</div>
      <p class="narr" id="narr" aria-live="polite"></p>
    </article>
    <article class="card ctrl" id="ctrl"></article>`;
  rig = createRig($("#pup"));
  await rig.ready;
  window.__train = { get state() { return g; }, rig };
  drawStats();
  await nextCommand(true);
}

function drawStats(delta = null) {
  for (const [k] of STAT) {
    const row = $(`.stat.${k}`);
    const v = g[k];
    row.querySelector(".bar i").style.width = `${v}%`;
    row.querySelector(".v").textContent = v;
    row.classList.toggle("hot", (k === "temper" || k === "pride") && v >= 70);
    if (delta && delta[k]) {
      const d = row.querySelector(".d");
      d.textContent = delta[k] > 0 ? `+${delta[k]}` : `−${Math.abs(delta[k])}`;
      d.className = `d ${(k === "obey" || k === "mood") === delta[k] > 0 ? "up" : "down"}`;
      d.style.animation = "none"; void d.offsetWidth; d.style.animation = "";
    }
  }
  $("#round").textContent = fill(ui.round, { n: g.round, total: ROUNDS });
  $("#badge").hidden = !g.tipsy;
}

function say(text, ms = 2200) {
  const b = $("#bubble");
  if (!b || !text) return;
  clearTimeout(bubbleTimer);
  b.textContent = text; b.hidden = false;
  b.style.animation = "none"; void b.offsetWidth; b.style.animation = "";
  bubbleTimer = setTimeout(() => (b.hidden = true), ms);
}
const narrate = (text) => { const n = $("#narr"); n.textContent = text; n.style.animation = "none"; void n.offsetWidth; n.style.animation = ""; };
const setCtrl = (html) => { $("#ctrl").innerHTML = html; };

async function nextCommand(first = false) {
  busy = false;
  rig.reset("listen");
  rig.idle(true);
  drawStats();
  const I = data.idle;
  narrate(first ? I.first : g.tipsy ? I.tipsy : pick(g.temper >= 70 ? I.temper : g.pride >= 70 ? I.pride : g.mood <= 30 ? I.sad : g.mood >= 85 ? I.glad : I.normal));
  setCtrl(`<p class="hint-tag">${esc(ui.pick)}</p><div class="cmds">${g.offer.map((id) => `<button class="cmd" data-id="${id}"><span class="e">${data.commands[id].emoji}</span><b>${esc(data.commands[id].label)}</b></button>`).join("")}</div>`);
  $("#ctrl").querySelectorAll(".cmd").forEach((b) => (b.onclick = () => onCommand(b.dataset.id)));
}

async function onCommand(id) {
  if (busy) return; busy = true;
  const c = data.commands[id];
  setCtrl(`<p class="hint-tag">${esc(c.emoji)} ${esc(c.label)}!</p>`);
  const cur = giveCommand(g, id, rng);
  narrate(pick(c[cur.outcome]));
  say(c.bubble[cur.outcome]);
  await rig.act(id, cur.outcome);
  await sleep(250);
  showFeedback(cur.outcome);
}

function showFeedback(outcome) {
  busy = false;
  rig.idle(true);
  const R = data.rewards, P = data.punishments;
  const btn = (id, o) => `<button class="fbtn" data-id="${id}"><span class="e">${o.emoji}</span>${esc(o.label)}</button>`;
  setCtrl(`<p class="hint-tag">${esc(fill(ui.pickFeedback, { what: ui.what[outcome] }))}</p>
    <div class="fb"><div class="col good"><h4>${esc(ui.reward)}</h4>${Object.entries(R).map(([id, o]) => btn(id, o)).join("")}</div>
    <div class="col bad"><h4>${esc(ui.punish)}</h4>${Object.entries(P).map(([id, o]) => btn(id, o)).join("")}</div></div>`);
  $("#ctrl").querySelectorAll(".fbtn").forEach((b) => (b.onclick = () => (b.dataset.id === "treat" ? showTreats(outcome) : onFeedback(b.dataset.id, null))));
}

function showTreats(outcome) {
  setCtrl(`<p class="hint-tag">${esc(ui.treatTitle)}</p><div class="treats">${Object.entries(data.treats).map(([id, t]) => `<button class="treat" data-id="${id}"><img src="${dishSrc(id)}" alt=""><span>${esc(t.label)}</span></button>`).join("")}</div><button class="ghost back" id="back">${esc(ui.back)}</button>`);
  $("#ctrl").querySelectorAll(".treat").forEach((b) => (b.onclick = () => onFeedback("treat", b.dataset.id)));
  $("#back").onclick = () => showFeedback(outcome);
}

async function onFeedback(id, treat) {
  if (busy) return; busy = true;
  rig.idle(false);
  const ctx = g.current.outcome;
  const result = giveFeedback(g, id, treat);
  setCtrl("");
  let line, bubble;
  if (id === "treat") {
    const t = data.treats[treat];
    line = result.stuffed ? data.stuffed.line : t[ctx];
    bubble = result.stuffed ? data.stuffed.bubble : t.bubble[ctx];
  } else {
    const o = (FEEDBACK[id].kind === "reward" ? data.rewards : data.punishments)[id];
    line = o[ctx]; bubble = o.bubble[ctx];
  }
  narrate(line);
  say(bubble);
  drawStats(result.delta);
  await rig.act(FEEDBACK_ACT[id], ctx, treat);
  if (result.stuffed) await rig.act("burp", "ok");
  await sleep(300);
  for (const ev of result.events) await playEvent(ev);
  after();
}

async function playEvent(kind) {
  const e = data.events[kind];
  narrate(e.text);
  say(e.bubble, 3000);
  drawStats();
  await rig.act(kind, "ok");
  setCtrl(`<div class="event"><h3>${e.emoji} ${esc(e.title)}</h3><p>${esc(e.text)}</p>${e.effect ? `<p class="effect">${esc(e.effect)}</p>` : ""}<button class="go" id="evgo">${esc(data.events.next)}</button></div>`);
  await new Promise((resolve) => ($("#evgo").onclick = resolve));
  if (kind !== "strike") rig.reset("sorry");
}

async function after() {
  busy = false;
  drawStats();
  if (g.bites >= 2) { await playEvent("strike"); return finish("strike"); }
  setCtrl(`<button class="go big" id="next">${esc(ui.cont)}</button>`);
  $("#next").onclick = () => { if (busy) return; busy = true; nextRound(g, rng); g.done ? finish(g.ending) : nextCommand(); };
}

// ── the end ────────────────────────────────────────────────────────────────────────────────────────
async function finish(endingId) {
  if (!g.done) { g.done = true; g.ending = endingId; }
  const e = data.endings[endingId];
  const seen = store.get("endings", []);
  if (!seen.includes(endingId)) { seen.push(endingId); store.set("endings", seen); }
  const stats = STAT.map(([k]) => `${ui.stats[k]} ${g[k]}`).join(" · ");
  const share = `${ui.shareTitle}我训出了「${e.title}」!${stats}。`;
  app.innerHTML = `
    <div class="top"><span class="t">${esc(data.title)}</span><span class="round">${esc(ui.resultTitle)}</span></div>
    <article class="card result">
      <p class="emoji">${e.emoji}</p>
      <h2>${esc(e.title)}</h2>
      <div class="pet-pic" id="pup"></div>
      <p class="story">${esc(e.text)}</p>
      <div class="final-stats">${STAT.map(([k, icon]) => `<span>${icon} ${esc(ui.stats[k])} <b>${g[k]}</b></span>`).join("")}</div>
      <div class="end-btns"><button class="go" id="copy">${esc(ui.copy)}</button><button class="ghost" id="again">${esc(ui.again)}</button></div>
      <p class="muted center">${esc(fill(ui.endings, { n: seen.length, total: ENDING_IDS.length }))}</p>
      <div class="ends">${ENDING_IDS.map((id) => `<span class="${seen.includes(id) ? "on" : ""}" title="${seen.includes(id) ? esc(data.endings[id].title) : "还没解锁"}">${seen.includes(id) ? data.endings[id].emoji : "❔"}</span>`).join("")}</div>
    </article>`;
  rig = createRig($("#pup"));
  await rig.ready;
  rig.set(e.expr ?? "happy");
  if (["happy", "kiss", "eat", "proud"].includes(e.expr)) rig.burst(e.expr === "kiss" ? "hearts" : "stars", 6);
  rig.idle(true);
  window.__train = { get state() { return g; }, rig, share };
  $("#copy").onclick = async () => {
    try { await navigator.clipboard.writeText(share); } catch { const t = document.createElement("textarea"); t.value = share; document.body.append(t); t.select(); try { document.execCommand("copy"); } catch { /* nothing more to try */ } t.remove(); }
    $("#copy").textContent = ui.copied;
  };
  $("#again").onclick = () => { rig.idle(false); startGame(); };
  scrollTo({ top: 0 });
}

// ── ?lab=1: every expression and scene on one page, to look at how she is drawn ─────────────────────────────────────────
async function lab() {
  app.className = "wrap lab";
  app.innerHTML = `<h1>小狗的表情和动作(lab)</h1><div class="big"><div id="big"></div></div><div class="acts" id="acts"></div><div class="grid" id="grid"></div>`;
  const big = createRig(document.getElementById("big"));
  await big.ready;
  big.set("listen");
  const acts = document.getElementById("acts");
  const add = (label, fn) => { const b = document.createElement("button"); b.textContent = label; b.onclick = async () => { big.reset("listen"); await fn(); }; acts.append(b); };
  for (const name of ["sit", "shake", "come", "bark", "spin", "frisbee", "wait", "dead", "kiss"]) for (const o of ["ok", "half", "no"]) add(`${name} ${o}`, () => big.act(name, o));
  for (const name of ["pat", "praise", "frisbeePlay", "hug", "burp", "bite", "ride", "strike"]) add(name, () => big.act(name, "ok"));
  for (const o of ["ok", "half", "no"]) for (const name of ["ignore", "no", "flick", "timeout", "confiscate"]) add(`${name} ${o}`, () => big.act(name, o));
  for (const t of Object.keys(TREATS)) add(`eat ${t}`, () => big.act("eat", "ok", t));
  const grid = document.getElementById("grid");
  for (const name of Object.keys(EXPR)) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.innerHTML = `<div class="r"></div>${name}`;
    grid.append(cell);
    const r = createRig(cell.querySelector(".r"), { warp: false });
    r.ready.then(() => r.set(name));
    cell.onclick = () => big.reset(name);
  }
  window.rig = big;
}

if (q.has("lab")) lab();
else showStart();
