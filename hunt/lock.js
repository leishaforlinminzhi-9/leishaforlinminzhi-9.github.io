// The password lock page, with questions before it. The movie names and the unlocked screen are sealed with the (cleaned-up) answers, so the page holds neither the
// answers nor the words behind them: typing a name is trying it as the key on every card.
import DATA from "./lock-data.js";
import { open as unseal } from "./vault.js";
import { norm } from "./norm.js";

const app = document.getElementById("app");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const fill = (t, o) => t.replace(/\{(\w+)\}/g, (_, k) => o[k] ?? "");
const KEY = "lock:" + DATA.id;
const P = new URLSearchParams(location.search);
if (P.has("reset")) { try { for (const k of Object.keys(localStorage)) if (k.startsWith(KEY)) localStorage.removeItem(k); } catch {} }
const read = (k) => { try { return JSON.parse(localStorage.getItem(KEY + k)); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch {} };
const STAGES = DATA.stages ?? [];
const steps = STAGES.length + 1; // the questions, then the lock
let tries = 0;

const header = (i) => `<h1 class="title">${esc(DATA.title)}</h1><p class="sub">${esc(fill(i === steps ? DATA.ui.stepLock : DATA.ui.step, { i, n: steps }))}</p>`;

// ── a question with picture clues ────────────────────────────────────────────────────────────────────────
async function tryItems(stage, key) { // which cards does this typed answer open? -> [{ index, name }]
  const out = [];
  for (let i = 0; i < stage.items.length; i++) for (const sealed of stage.items[i].sealed) { const p = await unseal(sealed, key); if (p) { out.push({ index: i, name: p.name }); break; } }
  return out;
}

async function solvedOf(stage) {
  const names = {};
  const keys = new Set(read(":" + stage.id) ?? []);
  for (const key of keys) for (const hit of await tryItems(stage, key)) names[hit.index] = hit.name;
  return { names, keys };
}

async function showStage(si) {
  const stage = STAGES[si];
  const { names, keys } = await solvedOf(stage);
  const draw = () => {
    const n = Object.keys(names).length, all = n === stage.items.length;
    app.innerHTML = `${header(si + 1)}
      <div class="qhead"><b>${esc(stage.title)}</b> · ${esc(stage.sub)}</div>
      <p class="intro">${esc(stage.intro)}</p>
      <div class="cards">${stage.items.map((it, i) => `<div class="qcard${names[i] ? " got" : ""}" id="c${i}"><div class="clue">${esc(it.clue)}</div><div class="nm">${names[i] ? esc(names[i]) : "□".repeat(it.len)}</div></div>`).join("")}</div>
      <p class="tries">${esc(fill(DATA.ui.progress, { a: n, n: stage.items.length }))}</p>
      ${all ? `<p class="done">${esc(stage.done)}</p><button class="go" id="next">${esc(stage.next)}</button>` : `<form id="form" autocomplete="off"><input id="pw" type="text" placeholder="${esc(stage.placeholder)}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go"><button type="submit">${esc(stage.button || DATA.button)}</button></form><p class="msg" id="msg" aria-live="polite"></p>`}`;
    if (all) { document.getElementById("next").addEventListener("click", () => (si + 1 < STAGES.length ? showStage(si + 1) : showLocked())); return; }
    const input = document.getElementById("pw");
    document.getElementById("form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const key = norm(input.value);
      if (!key) return;
      const hits = await tryItems(stage, key);
      const fresh = hits.filter((h) => !names[h.index]);
      if (hits.length && !fresh.length) { document.getElementById("msg").textContent = DATA.ui.already; input.value = ""; return; }
      if (fresh.length) {
        for (const h of fresh) names[h.index] = h.name;
        keys.add(key); write(":" + stage.id, [...keys]);
        draw();
        for (const h of fresh) document.getElementById("c" + h.index)?.classList.add("flip");
        return;
      }
      tries++;
      input.classList.remove("shake"); void input.offsetWidth; input.classList.add("shake");
      document.getElementById("msg").textContent = DATA.teases[(tries - 1) % DATA.teases.length];
      input.select();
    });
  };
  draw();
}

// ── the lock ────────────────────────────────────────────────────────────────────────────────────────────
function showLocked() {
  app.innerHTML = `
    ${header(steps)}
    <div class="lock" id="lock">🔒</div>
    <div class="paper"><small>${esc(DATA.ui.hintLabel)}</small><b>${esc(DATA.hint)}</b></div>
    <form id="form" autocomplete="off">
      <input id="pw" type="text" placeholder="${esc(DATA.placeholder)}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" aria-label="${esc(DATA.placeholder)}">
      <button type="submit">${esc(DATA.button)}</button>
    </form>
    <p class="msg" id="msg" aria-live="polite"></p><p class="tries" id="tries"></p>`;
  const input = document.getElementById("pw");
  document.getElementById("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const key = norm(input.value);
    if (!key) return;
    const payload = await unseal(DATA.sealed, key);
    if (payload) { write(":open", key); return showOpen(payload, true); }
    tries++;
    const lock = document.getElementById("lock");
    lock.classList.remove("shake"); void lock.offsetWidth; lock.classList.add("shake");
    document.getElementById("msg").textContent = DATA.teases[(tries - 1) % DATA.teases.length];
    document.getElementById("tries").textContent = fill(DATA.ui.tries, { n: tries });
    input.select();
  });
}

function showOpen(p, fresh) {
  app.innerHTML = `
    <h1 class="title">${esc(DATA.title)}</h1>
    <div class="lock ${fresh ? "open" : ""}">🔓</div>
    <p class="big">${esc(p.big)}</p>${p.script ? `<p class="script">${esc(p.script)}</p>` : ""}
    <div class="lines">${(p.lines || []).map((l) => `<p>${esc(l)}</p>`).join("")}</div>
    ${fresh ? '<div class="hearts" id="hearts"></div>' : ""}`;
  if (fresh) {
    const box = document.getElementById("hearts");
    for (let i = 0; i < 18; i++) {
      const h = document.createElement("i");
      h.textContent = ["💗", "💖", "❤️", "💕"][i % 4];
      h.style.left = `${Math.random() * 92}%`; h.style.animationDelay = `${Math.random() * 1.2}s`; h.style.fontSize = `${20 + Math.random() * 20}px`;
      box.appendChild(h);
    }
    setTimeout(() => box.remove(), 5000);
  }
}

(async () => {
  const saved = read(":open");
  if (saved) { const p = await unseal(DATA.sealed, saved); if (p) return showOpen(p, false); }
  // the first question that is not finished yet; when every question is done, the lock
  for (let si = 0; si < STAGES.length; si++) {
    const { names } = await solvedOf(STAGES[si]);
    if (Object.keys(names).length < STAGES[si].items.length) return showStage(si);
  }
  showLocked();
})();
window.__lock = { get tries() { return tries; } };
