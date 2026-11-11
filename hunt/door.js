// The door game's screens. The rules are in door-engine.js, the words in door.mjs (door-data.js in the built page).
import DATA from "./door-data.js";
import * as E from "./door-engine.js";

const P = new URLSearchParams(location.search);
const FAST = P.has("fast"); // (tests: no waiting)
const seed = Number(P.get("seed")) || (Math.random() * 1e9) | 0;
const startNight = Math.max(0, Math.min(E.NIGHTS.length - 1, (Number(P.get("night")) || 1) - 1));
const rng = E.rngFrom(seed);
const app = document.getElementById("app");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const fill = (t, o) => t.replace(/\{(\w+)\}/g, (_, k) => o[k] ?? "");
const wait = (ms) => new Promise((r) => setTimeout(r, FAST ? 20 : ms));
const img = (n) => `assets/door/${n}.webp`;
const U = DATA.ui;
let me = "shiba";
try { me = localStorage.getItem("door:me") || "shiba"; } catch {}
const saveMe = () => { try { localStorage.setItem("door:me", me); } catch {} };

if (DATA.questions.length !== E.QUESTIONS) console.error("door.mjs needs " + E.QUESTIONS + " questions");
let g = null;
let view = null; // what the door screen shows for the visitor at the door right now

// ── the pictures ────────────────────────────────────────────────────────────────────────────────────────
const FACES = { dog: ["happy", "sly", "blank", "blink", "listen"].map((e) => `dog-${e}`), pig: ["piglet", "piglet-sly", "piglet-happy"] };
const PAT = { dog: { good: "dog-happy", bad: "dog-blank" }, pig: { good: "piglet-happy", bad: "piglet" } };
const BITE = { dog: "dog-angry", pig: "piglet-sly" };
const SAD = { dog: "dog-sorry", pig: "piglet" };
const faceOf = (v, i) => FACES[v.species][(v.variant + i) % FACES[v.species].length];
const manPic = (mood) => (me === "cat" ? "cat" : mood === "shock" ? "shiba-shock" : mood === "shy" ? "shiba-shy" : "shiba");
const heartsHtml = () => `<span class="hearts" aria-label="${E.LIVES} ${U.hearts}">${"♥".repeat(Math.max(0, g.lives))}<i>${"♥".repeat(E.LIVES - Math.max(0, g.lives))}</i></span>`;
const pickText = (x, v) => (Array.isArray(x) ? x[v % x.length] : x);

// ── the outfits. The dog: 0 = the navy-sweater pictures (with their own faces), 1..5 = assets/door/dog-o<n>.webp, drawn by the image model from her wardrobe, and dog-o<n>-<face>.webp: the same outfit with the other faces (tools/pup_dress.py pastes each face onto the outfit).
//    The pig: only the colour of the sweater changes (she asked for that after the drawn pig outfits looked wrong): the blue pixels of the pictures are turned into another colour (hue, saturation factor, lightness factor).
const DOG_OUTFITS = 6;
const PIG_COLOURS = [null, { id: "red", h: 355, s: 1.9, l: 1.7 }, { id: "mustard", h: 44, s: 2.2, l: 2.1 }, { id: "green", h: 140, s: 1.5, l: 1.6 }, { id: "purple", h: 285, s: 1.5, l: 1.7 }, { id: "pink", h: 330, s: 1.9, l: 2.2 }, { id: "teal", h: 185, s: 1.9, l: 1.6 }, { id: "orange", h: 24, s: 2.2, l: 1.9 }];
const rgb2hsl = (r, g, b) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; if (mx === mn) return [0, 0, l]; const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [h * 60, s, l]; };
const hsl2rgb = (h, s, l) => { h /= 360; const f = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; return [f(p, q, h + 1 / 3), f(p, q, h), f(p, q, h - 1 / 3)].map((v) => Math.round(v * 255)); };
const dressed = new Map();
async function dress(name, o) {
  if (!o) return img(name);
  const key = `${name}|${o.id}`;
  if (dressed.has(key)) return dressed.get(key);
  let url = img(name);
  try {
    const im = new Image(); im.src = img(name); await im.decode();
    const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height), a = d.data;
    for (let i = 0; i < a.length; i += 4) {
      const r = a[i], g = a[i + 1], b = a[i + 2];
      if (a[i + 3] === 0 || b < r + 12 || b < g) continue; // only the blue pixels (the sweater), not the skin, the fur or the glasses
      const [h, s, l] = rgb2hsl(r, g, b);
      if (s < 0.2 || h < 190 || h > 270) continue;
      const [nr, ng, nb] = hsl2rgb(o.h, Math.min(1, s * o.s), Math.min(0.85, l * o.l));
      a[i] = nr; a[i + 1] = ng; a[i + 2] = nb;
    }
    x.putImageData(d, 0, 0);
    url = c.toDataURL("image/png");
  } catch { /* no canvas: she keeps the navy sweater */ }
  dressed.set(key, url);
  return url;
}

// ── start ─────────────────────────────────────────────────────────────────────────────────────────────────
function showStart() {
  app.innerHTML = `
    <h1 class="title">${esc(DATA.title)}</h1><p class="sub">${esc(DATA.sub)}</p>
    <div class="card">${DATA.intro.map((l) => `<p>${esc(l)}</p>`).join("")}</div>
    <div class="card"><h3>${esc(DATA.pick.title)}</h3><p style="color:var(--muted);font-size:14px">${esc(DATA.pick.sub)}</p>
      <div class="picks">${Object.entries(DATA.pick.chars).map(([k, c]) => `<button class="pickc${k === me ? " on" : ""}" data-me="${k}"><img src="${img(k)}" alt=""><small>${esc(c.line)}</small></button>`).join("")}</div>
      <button class="btn" id="go">${esc(DATA.startBtn)}</button></div>`;
  app.querySelectorAll(".pickc").forEach((b) => b.addEventListener("click", () => { me = b.dataset.me; saveMe(); showStart(); }));
  $("#go").addEventListener("click", () => { g = E.newGame(rng, startNight); window.__door.g = g; showIntro(); });
}
const $ = (s) => app.querySelector(s);

// ── the night's note ────────────────────────────────────────────────────────────────────────────────────
function showIntro() {
  const n = DATA.nights[g.night];
  app.innerHTML = `
    <div class="top"><span>${fill(U.night, { n: g.night + 1 })}</span>${heartsHtml()}</div>
    <div class="paper"><h2>${esc(n.title)}</h2>${n.lines.map((l) => `<p>${esc(l)}</p>`).join("")}</div>
    <div class="bag">${E.toolsTonight(g).map((t) => `<span>${DATA.tools[t].icon} ${esc(DATA.tools[t].label)}</span>`).join("")}<span>${U.charges} × ${E.NIGHTS[g.night].charges}</span></div>
    <button class="btn" id="go">${esc(U.beginShift)}</button>`;
  $("#go").addEventListener("click", () => { if (g.phase !== "intro") return; E.begin(g); newVisitor(); }); // (the visitor's sweater takes a moment to dress: a second tap must not start the night again)
}

// ── a visitor at the door ───────────────────────────────────────────────────────────────────────────────
async function newVisitor() {
  const v = E.current(g);
  const names = [...new Set([...FACES[v.species], PAT[v.species].good, PAT[v.species].bad, BITE[v.species], SAD[v.species]])];
  const urls = {};
  if (v.species === "dog") {
    const n = v.outfit % DOG_OUTFITS;
    if (n > 0) for (const k of names) urls[k] = img(k === "dog-sly" ? `dog-o${n}` : `dog-o${n}-${k.slice(4)}`); // (the outfit with each face: tools/pup_dress.py)
  } else {
    const o = PIG_COLOURS[v.outfit % PIG_COLOURS.length];
    await Promise.all(names.map(async (k) => { urls[k] = await dress(k, o); }));
  }
  view = { home: null, lit: false, log: [], urls, fx: "", pic: faceOf(v, g.i), say: DATA.greetings[(v.variant + g.i * 3 + g.night) % DATA.greetings.length], shadow: null, done: false, result: null, mood: "" };
  drawDoor(true);
}

function clock() { const m = 23 * 60 + 40 + g.night * 7 + g.i * 11; return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; }

function drawDoor(first) {
  const v = E.current(g);
  const nightly = E.NIGHTS[g.night];
  const flipped = v.tells.includes("mirror");
  const cls = ["peep", view.lit ? "lit" : "night", view.lit && v.tells.includes("pale") ? "lit-pale" : "", flipped ? "flipped" : ""].filter(Boolean).join(" ");
  const dots = Array.from({ length: nightly.charges }, (_, i) => (i < g.charges ? "●" : "<i>●</i>")).join("");
  const toolBtns = E.toolsTonight(g).map((t) => {
    const T = DATA.tools[t];
    const used = g.used.includes(t);
    return `<button class="tool${used ? " done" : ""}" data-tool="${t}" ${view.done || (!used && g.charges <= 0 && t !== "ask") || (t === "ask" && g.charges <= 0) ? "disabled" : ""}><b>${T.icon}</b>${esc(T.label)}</button>`;
  }).join("");
  const other = v.species === "dog" ? "pig" : "dog";
  const shadowPic = view.shadow ? (view.shadow === "me" ? v.species : other) : null;
  app.innerHTML = `
    <div class="top"><span>${fill(U.night, { n: g.night + 1 })} · ${fill(U.visitor, { i: g.i + 1, n: g.queue.length })}</span>${heartsHtml()}</div>
    <div class="${cls}" id="peep">
      <div class="floor"></div>
      <div class="vis${first ? " enter" : ""}${view.fx ? " " + view.fx : ""}" id="vis"><img src="${view.urls[view.pic] ?? img(view.pic)}" alt=""></div>
      ${view.home ? `<div class="pip home${view.bigHome ? " big" : ""}" id="homepip"><b>家里监控 · 点一下放大</b><img src="${img(view.home)}" alt=""></div>` : ""}
      ${shadowPic ? `<div class="pip"><b>${esc(U.shadowLabel)}</b><img src="${img(FACES[shadowPic][0])}" alt=""></div>` : ""}
      <div class="cam"><span>${esc(U.camLabel)}</span><span><span class="rec">●REC</span> ${clock()}</span></div>
      <div class="bubble" id="bubble">${esc(view.say)}</div>
      <div class="flash"></div>
    </div>
    ${view.done ? "" : `<div class="charges"><span>${U.charges}</span><span class="dots">${dots}</span></div><div class="tools">${toolBtns}</div>`}
    <div class="log" id="log">${view.log.map((l) => `<div class="${l.cls}">${l.html}</div>`).join("")}</div>
    ${view.done ? `<div class="result ${view.result.right ? "ok" : "bad"}">${esc(view.result.text)}</div><button class="btn" id="next">${esc(U.continue)}</button>` : `<div class="decide"><button class="no" id="no">✋ ${esc(U.refuse)}</button><button class="yes" id="yes">🚪 ${esc(U.let)}</button></div>`}
    <div class="man"><img id="manpic" src="${img(manPic(view.mood))}" alt=""><p>${esc(DATA.doorman[me])}</p></div>`;
  view.fx = "";
  $("#homepip")?.addEventListener("click", () => { view.bigHome = !view.bigHome; drawDoor(false); });
  app.querySelectorAll(".tool").forEach((b) => b.addEventListener("click", () => tool(b.dataset.tool)));
  if (view.done) $("#next").addEventListener("click", proceed);
  else { $("#yes").addEventListener("click", () => decide("let")); $("#no").addEventListener("click", () => decide("refuse")); }
}

function tool(t) {
  const v = E.current(g);
  let r;
  try { r = E.useTool(g, t); } catch (e) { say(U.noCharges); return; }
  const T = DATA.tools[t];
  const bad = r.anomaly;
  const word = (arr) => pickText(Array.isArray(arr) ? arr : arr[v.species], r.variant); // (a result may differ for the dog and the pig)
  if (t === "light") { view.lit = true; view.log.push({ cls: bad ? "bad" : "ok", html: `${T.icon} ${esc(word(bad ? T.bad : T.good))}` }); }
  else if (t === "ask") {
    const Q = DATA.questions[r.q];
    const ans = resolve(bad ? Q.bad[(r.variant + r.q) % Q.bad.length] : Q.good, v);
    view.log.push({ cls: "q", html: `${T.icon} ${esc(Q.q)}` });
    view.log.push({ cls: bad ? "bad" : "ok", html: `「${esc(ans)}」` });
    view.say = ans;
  } else if (t === "shadow") { view.shadow = bad ? "other" : "me"; view.log.push({ cls: bad ? "bad" : "ok", html: `${T.icon} ${esc(fill(word(bad ? T.bad : T.good), { me: DATA.species[v.species], other: DATA.species[v.species === "dog" ? "pig" : "dog"] }))}` }); }
  // (home camera: a dog at the door means the dog sleeps in the bed or the bed is empty, never the pig; the same for the pig)
  else if (t === "home") { view.home = bad ? (v.species === "dog" ? "bed-dog" : "bed-pig") : "bed-empty"; view.bigHome = false; view.log.push({ cls: bad ? "bad" : "ok", html: `${T.icon} ${esc(fill(word(bad ? T.bad : T.good), { asleep: view.home === "bed-dog" ? "小狗" : "小猪" }))}` }); }
  else if (t === "pat") { view.pic = PAT[v.species][bad ? "bad" : "good"]; if (!bad) view.fx = "wiggle"; view.log.push({ cls: bad ? "bad" : "ok", html: `${T.icon} ${esc(word(bad ? T.bad : T.good))}` }); }
  else view.log.push({ cls: bad ? "bad" : "ok", html: `${T.icon} ${esc(word(bad ? T.bad : T.good))}` });
  drawDoor(false);
}
// an answer can be a plain string, one per species ({dog, pig}), or follow today's weekday ({work, off}: she works every day except Wednesday and the weekend)
function resolve(x, v) {
  if (typeof x === "string") return x;
  if (x.work) { const day = new Date().getDay(); const works = ![0, 3, 6].includes(day); return (works ? x.work : x.off).replace("{d}", "日一二三四五六"[day]); }
  return x[v.species];
}
function say(text) { const b = $("#bubble"); if (b) b.textContent = text; }

async function decide(choice) {
  if (g.phase !== "door") return;
  const v = E.current(g);
  const out = E.decide(g, choice);
  const right = out.outcome === "goodIn" || out.outcome === "badOut";
  view.done = true;
  view.result = { right, text: DATA.outcomes[out.outcome][v.species] };
  view.mood = out.outcome === "bitten" ? "shock" : out.outcome === "goodIn" ? "shy" : out.outcome === "sad" ? "shock" : "";
  if (out.outcome === "bitten") view.pic = BITE[v.species];
  if (out.outcome === "sad") view.pic = SAD[v.species];
  if (out.outcome === "goodIn") view.pic = PAT[v.species].good;
  drawDoor(false);
  const peep = $("#peep"), vis = $("#vis"), man = $("#manpic");
  const anim = { goodIn: ["hop", "good"], badOut: ["melt", ""], bitten: ["lunge", "hit"], sad: ["sad", ""] }[out.outcome];
  vis.classList.add(anim[0]);
  if (anim[1]) peep.classList.add(anim[1]);
  if (out.outcome === "bitten") man.classList.add("shock");
  window.__door.last = out;
}

async function proceed() {
  if (g.phase !== "after") return; // (a second tap while the next visitor is still getting dressed)
  E.next(g);
  if (g.phase === "door") return newVisitor();
  if (g.phase === "morning") return showMorning();
  return showEnd();
}

// ── morning and the end ─────────────────────────────────────────────────────────────────────────────────
function showMorning() {
  const m = DATA.morning;
  const bad = g.nightMistakes[g.night] ?? 0;
  app.innerHTML = `<div class="top"><span>${fill(U.night, { n: g.night + 1 })}</span>${heartsHtml()}</div>
    <div class="card center"><div class="ico">🌅</div><h2 class="big">${esc(m.title)}</h2>${m.lines.map((l) => `<p>${esc(l)}</p>`).join("")}<p class="stats">${bad ? `✗ ${bad}` : "✓ 零失误"}</p>
    <button class="btn" id="go">${esc(m.btn)}</button></div>`;
  $("#go").addEventListener("click", () => { if (g.phase !== "morning") return; E.nextNight(g); showIntro(); });
}

function showEnd() {
  const e = DATA.endings[g.ending];
  const s = g.stats;
  const stats = fill(U.stats, { a: s.goodIn, b: s.badOut, c: s.bitten, d: s.sad });
  const share = `${U.shareTitle}我当了门卫,结局「${e.title}」。${stats}。`;
  app.innerHTML = `<div class="card center"><div class="ico">${e.icon}</div><h2 class="big">${esc(e.title)}</h2>${e.lines.map((l) => `<p>${esc(l)}</p>`).join("")}<p class="stats">${esc(stats)}</p>
    <div class="row2"><button class="btn" id="copy">${esc(U.copy)}</button><button class="btn ghost" id="again">${esc(U.again)}</button></div></div>`;
  $("#copy").addEventListener("click", async (ev) => { try { await navigator.clipboard.writeText(share); ev.target.textContent = "✓"; } catch { ev.target.textContent = share; } });
  $("#again").addEventListener("click", () => { location.href = location.pathname; });
}

window.__door = { E, get state() { return g; }, seed };
showStart();
