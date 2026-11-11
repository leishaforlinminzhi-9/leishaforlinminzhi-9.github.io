// The puppy as a puppet. She is a complete little dog drawn by the image model (assets/train/dog-*.webp: one picture for every face she can make, all of the same size and
// in the same place, so showing another one only changes her face), moved with CSS and the Web Animations API (hops, squashes, spins, tilts), with small props drawn here
// (paw, hand, frisbee, bowls) and little things floating up (hearts, stars, notes).
//
//   const rig = createRig(host)            draws her into `host` (any element; she fills its width) and returns the puppet
//   await rig.ready                        every picture is loaded
//   rig.set("happy")                       change her expression (see EXPR below)
//   await rig.act("spin", "ok")            play one of the little scenes (ACTS) and wait for it to end
//   rig.burst("hearts")                    little things floating up
//   rig.idle(true)                         she breathes, blinks and tilts her head now and then
//
// All numbers are in the units of her 1024 px picture, laid in the middle of a larger square (PAD units of room on every side for props and the little things that float up).
// The first puppets (a head drawn as SVG, then a head from the image model with the glasses, eyes and brows cut from her avatar laid over it) are in archive/.

import { createWarp } from "./train-warp.js";

export const SIDE = 1184, PAD = 80;
// She can turn all the way round: the pictures of her seen from the front (her face of the moment), at 45, 90 and 135 degrees, from behind, and the same three mirrored for the other half of the turn.
// h = the three-quarter / side / back-three-quarter pictures with the happy face, k = with the sad face (she turns away from him sulking).
const U = (v) => `${((v + PAD) / SIDE) * 100}%`; // a position in her picture -> a position in the square
const S = (v) => `${(v / SIDE) * 100}%`; // a size
const FACES = ["sly", "sblink", "blink", "listen", "happy", "smug", "blank", "sulk", "sorry", "angry", "shock", "eat", "dizzy", "heart", "kiss", "dead", "wince"]; // the pictures of her
const pic = (name) => `assets/train/dog-${name}.webp`;
const MOUTH = [545, 475]; // where her mouth is in the picture (things she eats fly there)
const INK = "#43200f", FUR_DARK = "#5b2b1b", CREAM = "#f8e2c4", PINK = "#e9a08f", HEART = "#e4366f";
const tf = ({ x = 0, y = 0, r = 0, sx = 1, sy = 1 } = {}) => `translate(${x}%, ${y}%) rotate(${r}deg) scale(${sx}, ${sy})`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── what she is made of ────────────────────────────────────────────────────────────────────────
const HEART_PATH = "M16 28C6 20 1 14.5 1 8.8 1 4.4 4.4 1 8.6 1c3 0 5.6 1.7 7.4 4.4C17.8 2.7 20.4 1 23.4 1 27.6 1 31 4.4 31 8.8 31 14.5 26 20 16 28z";
const DROP = "M0 -34 C18 -8 22 4 22 14 A22 22 0 0 1 -22 14 C-22 4 -18 -8 0 -34 Z";
const FACE_FX = `<g class="drool" transform="translate(588 500)"><path d="${DROP}" fill="#cfeefc" stroke="#8cc8ea" stroke-width="7" transform="scale(.8)"/></g>`;

// ── expressions ──────────────────────────────────────────────────────────────────────────────
// img: which picture of her; pose: how the whole of her is held (x, y in % of her size, r degrees, s scale).
export const EXPR = {
  sly: { img: "sly" }, // one eyebrow up, a glance to the side, a smirk: how she is when nothing is happening
  listen: { img: "listen", pose: { r: -1.5 } },
  happy: { img: "happy", pose: { y: -1 } },
  glad: { img: "happy" },
  smug: { img: "smug", pose: { r: 2 } },
  cheeky: { img: "sly", pose: { r: -1.5 } },
  blank: { img: "blank" },
  sulk: { img: "sulk", pose: { y: 2 } },
  sorry: { img: "sorry", pose: { y: 1.5 } },
  angry: { img: "angry" },
  shock: { img: "shock", pose: { s: 1.02 } },
  eat: { img: "eat" },
  proud: { img: "smug", pose: { r: -3, y: -2 } },
  dizzy: { img: "dizzy" },
  heart: { img: "heart" },
  kiss: { img: "kiss" },
  dead: { img: "dead" },
  wince: { img: "wince" },
};

// How her ears and tail move for each expression. ears: how far the ears swing out (degrees at the tip; negative = they hang in / back), wag: [how far the tail swings
// each way (degrees), how many times a second], tail: where the tail rests (degrees; positive = it droops).
const MOOD = {
  sly: { ears: 0.5, wag: [5, 0.7], tail: 0 }, listen: { ears: 2.5, wag: [6, 1.1], tail: -2 }, happy: { ears: 4, wag: [17, 3.2], tail: -2 }, glad: { ears: 3, wag: [12, 2.4], tail: -2 },
  smug: { ears: 1, wag: [6, 0.9], tail: 0 }, cheeky: { ears: 0.5, wag: [5, 0.8], tail: 0 }, blank: { ears: -1, wag: [1.5, 0.5], tail: 3 }, sulk: { ears: -3.5, wag: [0, 1], tail: 12 },
  sorry: { ears: -2.5, wag: [2, 1.6], tail: 9 }, angry: { ears: -4.5, wag: [3, 2.6], tail: -3 }, shock: { ears: 3.5, wag: [0, 1], tail: -8 }, eat: { ears: 1.5, wag: [9, 2.2], tail: -1 },
  proud: { ears: 1.5, wag: [5, 0.8], tail: -2 }, dizzy: { ears: -1, wag: [7, 1.4], tail: 2 }, heart: { ears: 3, wag: [15, 2.8], tail: -2 }, kiss: { ears: 2.5, wag: [12, 2.4], tail: -2 },
  dead: { ears: -4, wag: [0, 1], tail: 14 }, wince: { ears: -4.5, wag: [0, 1], tail: -9 },
};
const rad = (d) => (d * Math.PI) / 180;
const SPIN_MS = 1920; // how long the film of her spinning is (48 pictures of 40 ms)

export function createRig(host, opts = {}) {
  host.classList.add("pup");
  const box = `left:${U(0)};top:${U(0)};width:${S(1024)};height:${S(1024)}`;
  host.innerHTML = `
    <div class="pup-turn">
      <div class="pup-act"><div class="pup-pose"><div class="pup-dog">
        ${FACES.map((n) => `<img class="pup-x ${n}" src="${pic(n)}" alt="" draggable="false" style="${box}">`).join("")}
        <canvas class="pup-gl" style="${box}" hidden></canvas>
      </div><svg class="pup-fx" viewBox="0 0 ${SIDE} ${SIDE}" aria-hidden="true"><g transform="translate(${PAD} ${PAD})">${FACE_FX}</g></svg></div></div>
      <div class="pup-views" aria-hidden="true">
        ${["h", "k"].flatMap((v) => [45, 90, 135].flatMap((a) => [`<img class="vw ${v}${a}" src="${pic(v + a)}" alt="" draggable="false" style="${box}">`, `<img class="vw mir ${v}${a}" src="${pic(v + a)}" alt="" draggable="false" style="${box}">`])).join("")}
        <img class="vw back" src="${pic("back")}" alt="" draggable="false" style="${box}">
      </div>
    </div>
    <div class="pup-props"></div>
    <div class="pup-bits"></div>`;
  const $ = (s) => host.querySelector(s);
  const turn = $(".pup-turn"), act = $(".pup-act"), pose = $(".pup-pose"), dog = $(".pup-dog"), props = $(".pup-props"), bits = $(".pup-bits");
  const face = Object.fromEntries(FACES.map((n) => [n, $(`.pup-x.${n}`)]));
  const calm = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let current = "sly", shown = "";
  let warp = null, glDirty = true;
  const canvas = $(".pup-gl");
  const decoded = Promise.all([...host.querySelectorAll("img")].map((i) => (i.decode ? i.decode().catch(() => {}) : Promise.resolve())));
  let spinGif = false; // the little film of her spinning (assets/train/spin.gif) is there and loaded
  { const g = new Image(); g.onload = () => { spinGif = true; }; g.src = "assets/train/spin.gif"; }
  const ready = (async () => {
    await decoded;
    if (opts.warp === false) return;
    const maskImg = new Image(); maskImg.src = "assets/train/dog-masks.png";
    try { await maskImg.decode(); } catch { return; }
    try { warp = createWarp(canvas, maskImg); } catch { warp = null; }
    if (!warp) return;
    for (const [k, el] of Object.entries(face)) warp.texture(k, el);
    canvas.hidden = false; host.classList.add("gl"); glDirty = true;
    startLoop();
  })();
  let blinkTimer = null, idleOn = false, breathing = null;

  // ─ expression ─
  function show(key) {
    if (shown === key) return;
    shown = key; glDirty = true;
    if (calm) drawGl(); // (with reduced motion there is no loop drawing her all the time: draw her when her face changes)
    for (const [k, el] of Object.entries(face)) el.classList.toggle("on", k === key);
  }
  function set(name, extra = {}) {
    const e = { ...(EXPR[name] ?? EXPR.sly), ...extra };
    current = name;
    show(e.img);
    const p = e.pose ?? {};
    pose.style.transform = `translate(${p.x ?? 0}%, ${p.y ?? 0}%) rotate(${p.r ?? 0}deg) scale(${p.s ?? 1})`;
  }

  // ─ her ears and tail: three springs that follow where the expression wants them to be (a little late, a little overshooting), plus a sway of their own and kicks when she moves ─
  const spring = { L: { a: 0, v: 0 }, R: { a: 0, v: 0 }, T: { a: 0, v: 0 } };
  const kick = (l = 0, r = l, t = 0) => { spring.L.v += l; spring.R.v += r; spring.T.v += t; }; // (degrees a second: how hard the ears and the tail are flung, positive = ears out, tail down)
  let raf = 0, last = 0, hold = null; // (hold: a test sets the three angles by hand)
  function startLoop() {
    if (calm) { drawGl(0); return; }
    const frame = (now) => {
      if (!host.isConnected) { warp?.dispose?.(); warp = null; return; }
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
      const t = now / 1000, m = MOOD[current] ?? MOOD.sly;
      const want = { L: m.ears + 2.2 * Math.sin(t * 1.9) + 0.6 * Math.sin(t * 5.3), R: m.ears + 2.2 * Math.sin(t * 1.7 + 1.3) + 0.6 * Math.sin(t * 4.9), T: m.tail + m.wag[0] * Math.sin(t * 2 * Math.PI * m.wag[1]) };
      for (const k of ["L", "R", "T"]) {
        const p = spring[k], target = want[k];
        p.v += (-110 * (p.a - target) - 11 * p.v) * dt; p.a += p.v * dt; // (a spring with a little damping: it overshoots a bit, like fur and flesh do)
      }
      drawGl();
    };
    raf = requestAnimationFrame(frame);
  }
  function drawGl(force) {
    if (!warp) return;
    const w = Math.round(Math.min(2, window.devicePixelRatio || 1) * host.getBoundingClientRect().width * (1024 / SIDE));
    if (w > 0 && canvas.width !== w) { canvas.width = canvas.height = w; glDirty = true; }
    // the left ear swings out clockwise (+), the right one anticlockwise (-); the tail droops clockwise (+)
    const a = hold ?? [spring.L.a, spring.R.a, spring.T.a];
    warp.draw(shown, [rad(a[0]), rad(-a[1]), rad(a[2])]);
    glDirty = false;
  }

  // ─ little helpers ─
  const run = (el, frames, o = {}) => (calm ? Promise.resolve() : el.animate(frames, { duration: 600, easing: "ease-in-out", fill: "none", ...o }).finished.catch(() => {}));
  const prop = (html, css = "") => { const d = document.createElement("div"); d.className = "pup-prop"; d.style.cssText = css; d.innerHTML = html; props.append(d); return d; };
  function burst(kind = "hearts", n = 6, at = [520, 130]) {
    if (calm) return;
    const glyphs = { hearts: null, stars: "✨", notes: "♪", zz: "z", sparks: "⭐" };
    for (let i = 0; i < n; i++) {
      const el = document.createElement("span");
      el.className = "pup-bit " + kind;
      const x = at[0] + (Math.random() - 0.5) * 520, y = at[1] + (Math.random() - 0.3) * 160;
      el.style.left = U(x); el.style.top = U(y);
      el.style.setProperty("--dx", `${(Math.random() - 0.5) * 80}px`);
      el.style.setProperty("--d", `${900 + Math.random() * 700}ms`);
      el.style.animationDelay = `${i * 80}ms`;
      el.innerHTML = kind === "hearts" ? `<svg viewBox="0 0 32 29"><path d="${HEART_PATH}" fill="${i % 3 === 0 ? "#ff8fb1" : HEART}"/></svg>` : glyphs[kind] ?? "✨";
      bits.append(el);
      el.addEventListener("animationend", () => el.remove(), { once: true });
    }
  }

  // ─ the scenes ─ (what she does when she is told, and what she does when she is rewarded or punished)
  const hop = (h = -9, ms = 420) => { kick(-120, -120, 100); return hop_(h, ms); };
  const hop_ = (h, ms) => run(act, [{ transform: tf() }, { transform: tf({ y: h }), offset: 0.45 }, { transform: tf() }], { duration: ms, easing: "ease-out" });
  const shake = (amp = 2.5, ms = 420) => { kick(80, 80, 120); return shake_(amp, ms); };
  const shake_ = (amp, ms) => run(act, [{ transform: tf() }, { transform: tf({ x: -amp }) }, { transform: tf({ x: amp }) }, { transform: tf({ x: -amp / 2 }) }, { transform: tf() }], { duration: ms, easing: "linear" });
  const frisbeeSvg = `<svg viewBox="0 0 120 50"><ellipse cx="60" cy="30" rx="56" ry="18" fill="#2f8fe0"/><ellipse cx="60" cy="24" rx="56" ry="18" fill="#58b0ff" stroke="${INK}" stroke-width="5"/><ellipse cx="60" cy="24" rx="30" ry="8" fill="none" stroke="#fff" stroke-width="5" opacity=".8"/></svg>`;
  const pawSvg = `<svg viewBox="0 0 120 120"><path d="M20 70C14 44 36 24 62 28C92 32 106 56 98 80C92 100 66 108 44 102C28 98 22 86 20 70Z" fill="${CREAM}" stroke="${FUR_DARK}" stroke-width="7"/><ellipse cx="60" cy="74" rx="22" ry="17" fill="${PINK}"/><circle cx="36" cy="48" r="8" fill="${PINK}"/><circle cx="56" cy="38" r="8" fill="${PINK}"/><circle cx="78" cy="40" r="8" fill="${PINK}"/><circle cx="94" cy="56" r="8" fill="${PINK}"/></svg>`;
  const handSvg = (fill = "#f0bd96") => `<svg viewBox="0 0 140 160"><path d="M30 150C16 120 18 84 30 62L36 36C38 26 52 26 54 36L58 58L62 24C64 14 78 14 80 24L82 58L88 30C90 20 104 22 104 32L102 64L112 46C118 38 130 44 126 54C118 78 118 108 106 140L100 152Z" fill="${fill}" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/></svg>`;
  const fingerSvg = `<svg viewBox="0 0 80 160"><path d="M18 156C10 120 14 80 24 44C26 30 46 30 48 44C58 80 62 120 56 156Z" fill="#f0bd96" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/></svg>`;
  const px = (n) => (host.getBoundingClientRect().width / SIDE) * n; // units of the picture -> screen pixels (so a move is the same share of her at any width)
  const T = (x = 0, y = 0, more = "") => `translate(${px(x)}px, ${px(y)}px) ${more}`.trim();
  // ─ turning round: front -> 45 -> side -> 135 -> back -> 135 -> side -> 45 -> front; the picture of the angle she is at is shown, the next one fades in over it ─
  let viewSet = "h", turnToken = 0, turnedAt = 0;
  const KEYS = () => [act, ...[45, 90, 135].map((a) => $(`.vw.${viewSet}${a}:not(.mir)`)), $(".vw.back"), ...[135, 90, 45].map((a) => $(`.vw.mir.${viewSet}${a}`))];
  const WIDTH = { h: [763, 718, 597, 596, 756, 596, 597, 718], k: [763, 707, 599, 615, 756, 615, 599, 707] }; // how wide she is (pixels of her picture) at each of the eight angles
  function showAngle(deg) {
    turnedAt = deg;
    const phi = ((deg % 360) + 360) % 360, i = Math.floor(phi / 45) % 8, j = (i + 1) % 8, t = (phi % 45) / 45;
    const w = t <= 0.35 ? 0 : t >= 0.65 ? 1 : (t - 0.35) / 0.3; // she is at one picture, then the next one fades in over it quickly
    const wd = WIDTH[viewSet], k = KEYS();
    k.forEach((el, n) => {
      el.style.opacity = n === i ? "1" : n === j ? String(w) : "0";
      // between two pictures her width changes smoothly (the one she leaves narrows or widens towards the next, the next starts from the width of the last), so the two outlines meet when they cross-fade
      const sx = n === i ? 1 + (wd[j] / wd[i] - 1) * t : n === j ? wd[i] / wd[j] + (1 - wd[i] / wd[j]) * t : 1;
      el.style.transform = el.classList.contains("mir") ? `scaleX(${-sx})` : sx === 1 ? "" : `scaleX(${sx})`;
    });
  }
  const easeInOut = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
  function turnTo(from, to, ms) { // turn from one angle to another (degrees) in `ms`
    const token = ++turnToken;
    if (calm) { showAngle(to); return Promise.resolve(); }
    return new Promise((resolve) => {
      const t0 = performance.now();
      const done = () => { if (token === turnToken) showAngle(to); resolve(); };
      const guard = setTimeout(done, ms + 400); // (a hidden page gets no animation frames: do not wait for them for ever)
      const step = (now) => {
        if (token !== turnToken) { clearTimeout(guard); return resolve(); }
        const p = Math.min(1, (now - t0) / ms);
        showAngle(from + (to - from) * easeInOut(p));
        if (p < 1) requestAnimationFrame(step); else { clearTimeout(guard); resolve(); }
      };
      requestAnimationFrame(step);
    });
  }
  const place = (el, cx, cy, w, h = w) => { el.style.cssText += `;left:${U(cx - w / 2)};top:${U(cy - h / 2)};width:${S(w)};height:${S(h)}`; return el; };
  const dish = (id) => `<img src="assets/dishes/${id === "hotpot" ? "hotpot" : id}.png" alt="" draggable="false" style="width:100%;height:100%;object-fit:contain">`;

  const ACTS = {
    // ── what she does when she is told ──
    async sit(o) {
      if (o === "no") { set("sly"); await run(act, [{ transform: tf() }, { transform: tf({ r: 5, x: 2 }) }, { transform: tf() }], { duration: 700 }); return; }
      if (o === "half") { set("blank"); await run(act, [{ transform: tf() }, { transform: tf({ y: 5, sy: 0.96 }) }, { transform: tf() }, { transform: tf({ y: 2 }) }, { transform: tf() }], { duration: 1100 }); return; }
      set("listen"); kick(-70, -70, 60); await run(act, [{ transform: tf() }, { transform: tf({ y: 7, sy: 0.94 }), offset: 0.4 }, { transform: tf({ y: 6, sy: 0.95 }) }], { duration: 650, fill: "forwards" });
      set("happy"); await sleep(500); act.getAnimations().forEach((a) => a.cancel());
    },
    async shake(o) {
      if (o === "no") { set("sly"); await shake(2, 500); return; }
      set("listen");
      const paw = prop(pawSvg); place(paw, 930, 860, 270);
      await run(paw, [{ transform: `${T(120, 90, `rotate(20deg)`)}`, opacity: 0 }, { transform: "translate(0,0) rotate(0)", opacity: 1 }], { duration: 380, fill: "forwards", easing: "ease-out" });
      if (o === "half") { set("blank"); paw.style.filter = "hue-rotate(-12deg)"; await run(paw, [{ transform: "translate(0,0)" }, { transform: `${T(0, -26, "rotate(-12deg)")}` }, { transform: "translate(0,0)" }], { duration: 700 }); await sleep(250); }
      else { set("happy"); await run(paw, [{ transform: "translate(0,0)" }, { transform: `${T(-30, -16, `rotate(-10deg)`)}` }, { transform: "translate(0,0)" }, { transform: `${T(-30, -16, `rotate(-10deg)`)}` }, { transform: "translate(0,0)" }], { duration: 900 }); }
      await run(paw, [{ opacity: 1 }, { opacity: 0, transform: `${T(120, 90)}` }], { duration: 300, fill: "forwards" }); paw.remove();
    },
    async come(o) {
      if (o === "no") { set("sly"); await run(act, [{ transform: tf() }, { transform: tf({ sx: 0.9, sy: 0.9, y: -3 }) }, { transform: tf({ sx: 0.9, sy: 0.9, y: -3 }) }], { duration: 650, fill: "forwards" }); await sleep(450); act.getAnimations().forEach((a) => a.cancel()); return; }
      if (o === "half") { set("blank"); await run(act, [{ transform: tf() }, { transform: tf({ sx: 1.06, sy: 1.06 }) }, { transform: tf({ sx: 1.0, sy: 1.0 }) }, { transform: tf({ sx: 1.04, sy: 1.04 }) }, { transform: tf() }], { duration: 1500 }); return; }
      set("happy"); kick(90, 90, -110); await run(act, [{ transform: tf({ sx: 0.92, sy: 0.92 }) }, { transform: tf({ sx: 1.14, sy: 1.14, y: -2 }), offset: 0.55 }, { transform: tf({ sx: 1.1, sy: 1.1 }) }], { duration: 750, easing: "ease-out", fill: "forwards" }); await sleep(450);
      await run(act, [{ transform: tf({ sx: 1.1, sy: 1.1 }) }, { transform: tf() }], { duration: 300 }); act.getAnimations().forEach((a) => a.cancel());
    },
    async bark(o) {
      if (o === "no") { set("sly"); await shake(2, 500); return; }
      if (o === "half") { set("blank"); await hop(-2, 600); return; }
      set("happy");
      const ring = prop(`<svg viewBox="0 0 120 120"><path d="M30 20Q70 60 30 100M55 8Q112 60 55 112M80 -4Q154 60 80 124" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round" opacity=".75"/></svg>`); place(ring, 880, 470, 150);
      burst("notes", 3); await run(act, [{ transform: tf() }, { transform: tf({ y: -3, r: -4, sy: 1.04 }) }, { transform: tf() }], { duration: 480, easing: "ease-out" });
      await sleep(250); ring.remove();
    },
    async spin(o) {
      if (o === "no") { set("sly"); await sleep(450); return; }
      if (o === "half") { set("blank"); viewSet = "k"; await turnTo(0, 180, 800); await sleep(250); await turnTo(180, 0, 650); return; } // turns her back, loses interest, turns round again
      set("happy"); viewSet = "h";
      if (spinGif && !calm) { // two smooth turns, as a film: an animated GIF (made by tools/pup_spin_gif.py + tools/gif/encode.mjs) on the colour of the card, laid over her; the last picture of it is her, as she is
        const film = document.createElement("img");
        film.className = "pup-spin"; film.alt = ""; film.draggable = false; film.src = "assets/train/spin.gif"; film.style.cssText = box;
        turn.append(film);
        await Promise.all([sleep(SPIN_MS), run(turn, [{ transform: "translateY(0)" }, { transform: `translateY(${px(-30)}px)`, offset: 0.5 }, { transform: "translateY(0)" }], { duration: SPIN_MS })]);
        film.remove();
      } else {
        await Promise.all([turnTo(0, 720, 1700), run(turn, [{ transform: "translateY(0)" }, { transform: `translateY(${px(-30)}px)`, offset: 0.5 }, { transform: "translateY(0)" }], { duration: 1700 })]); // (without the film: two turns of the pictures)
      }
      kick(260, 260, -240); set("dizzy"); await run(act, [{ transform: tf({ r: 4 }) }, { transform: tf({ r: -4 }) }, { transform: tf({ r: 3 }) }, { transform: tf({ r: -3 }) }, { transform: tf() }], { duration: 650 }); set("happy");
    },
    async frisbee(o) {
      set("listen");
      const f = prop(frisbeeSvg); place(f, 20, 330, 230, 96);
      const t = o === "no" ? [1260, 100] : MOUTH;
      const a = run(f, [{ transform: "rotate(-12deg)" }, { transform: `${T((t[0] - 20) * 0.55, -140, "rotate(14deg)")}`, offset: 0.55 }, { transform: `${T(t[0] - 20, t[1] - 330, `rotate(-8deg) scale(${o === "no" ? 0.6 : 1.1})`)}`, opacity: o === "no" ? 0.8 : 1 }], { duration: 800, fill: "forwards", easing: "ease-in" }).then(() => {});
      if (o === "no") { await a; await sleep(150); set("sly"); f.remove(); return; }
      await sleep(420);
      if (o === "half") { set("shock"); await a; await run(act, [{ transform: tf() }, { transform: tf({ r: -6, y: -3 }) }, { transform: tf() }], { duration: 500 }); set("blank"); f.remove(); return; }
      set("shock"); await hop(-12, 520); await a; set("happy"); burst("stars", 4); await sleep(400); f.remove();
    },
    async wait(o) {
      set("listen");
      const d = prop(dish("hotpot")); place(d, 520, 940, 330);
      host.classList.add("fx-drool");
      await run(d, [{ transform: `${T(0, 60)}`, opacity: 0 }, { transform: "translate(0,0)", opacity: 1 }], { duration: 350, fill: "forwards" });
      if (o === "no") { set("eat"); await run(d, [{ transform: "translate(0,0) scale(1)" }, { transform: `${T(0, -(940 - MOUTH[1]), "scale(.4)")}`, opacity: 0 }], { duration: 400, fill: "forwards" }); host.classList.remove("fx-drool"); await run(pose, [{ transform: pose.style.transform }, { transform: "translate(0,2%) scaleY(.96)" }, { transform: pose.style.transform }, { transform: "translate(0,2%) scaleY(.96)" }, { transform: pose.style.transform }], { duration: 800 }); d.remove(); return; }
      for (let i = 0; i < 4; i++) { await shake(1.2, 160); }
      host.classList.remove("fx-drool");
      if (o === "half") { set("blank"); await sleep(450); } else { set("happy"); await sleep(350); burst("stars", 3); }
      await run(d, [{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: "forwards" }); d.remove();
    },
    async dead(o) {
      if (o === "no") { set("sly"); await run(act, [{ transform: tf() }, { transform: tf({ sx: 1.05, sy: 1.05, y: -2 }) }, { transform: tf() }], { duration: 600 }); return; }
      if (o === "half") { set("dead"); await run(act, [{ transform: tf() }, { transform: tf({ r: 80, y: 12, x: 6 }) }, { transform: tf({ r: 80, y: 12, x: 6 }) }, { transform: tf({ r: 0, y: 0 }) }], { duration: 1500, easing: "ease-out" }); set("blank"); return; }
      set("dead"); await run(act, [{ transform: tf() }, { transform: tf({ r: 92, y: 14, x: 8 }), offset: 0.3 }, { transform: tf({ r: 92, y: 14, x: 8 }) }], { duration: 700, easing: "ease-out", fill: "forwards" }); await sleep(900);
      act.getAnimations().forEach((a) => a.cancel()); set("happy"); await hop(-6, 400);
    },
    async kiss(o) {
      if (o === "no") { set("smug"); const h = prop(handSvg("#fccda7")); place(h, 545, 600, 250, 286); await run(h, [{ transform: `${T(60, 60, `rotate(-30deg)`)}`, opacity: 0 }, { transform: "translate(0,0) rotate(-10deg)", opacity: 1 }], { duration: 300, fill: "forwards" }); await shake(1.5, 420); await run(h, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" }); h.remove(); return; }
      if (o === "half") { set("kiss"); await run(act, [{ transform: tf() }, { transform: tf({ x: 8, r: 6, sx: 1.05, sy: 1.05 }) }, { transform: tf() }], { duration: 800 }); set("blank"); await sleep(300); return; }
      set("kiss"); await run(act, [{ transform: tf() }, { transform: tf({ sx: 1.12, sy: 1.12, y: -2 }) }, { transform: tf() }], { duration: 900, easing: "ease-in-out" }); burst("hearts", 8); await sleep(450); set("happy");
    },

    // ── what she does when she is rewarded ──
    async pat(o) {
      const h = prop(handSvg()); place(h, 520, 30, 320, 366);
      await run(h, [{ transform: `${T(0, -80)}`, opacity: 0 }, { transform: "translate(0,0)", opacity: 1 }], { duration: 300, fill: "forwards" });
      set(o === "no" ? "proud" : "happy"); kick(-110, -110, 0);
      for (let i = 0; i < 3; i++) await run(h, [{ transform: "translate(0,0)" }, { transform: `${T(0, 34)}` }, { transform: "translate(0,0)" }], { duration: 360 });
      burst("hearts", o === "ok" ? 4 : 2);
      await run(h, [{ opacity: 1 }, { opacity: 0, transform: `${T(0, -80)}` }], { duration: 260, fill: "forwards" }); h.remove();
    },
    async praise(o) { set(o === "no" ? "proud" : "happy"); burst("stars", 6); await hop(-6, 420); await sleep(200); },
    async frisbeePlay(o) {
      set("listen"); const f = prop(frisbeeSvg); place(f, 560, 640, 230, 96);
      await run(f, [{ transform: "translate(0,0) rotate(0)", opacity: 1 }, { transform: `${T(900, -520, `rotate(40deg) scale(.5)`)}`, opacity: 0.9 }], { duration: 650, fill: "forwards", easing: "ease-out" });
      f.remove(); set("shock"); await sleep(250); set("happy"); await hop(-10, 400); await sleep(200);
      burst("stars", 3);
    },
    async hug(o) {
      set("happy"); await run(act, [{ transform: tf() }, { transform: tf({ sx: 1.1, sy: 0.93, y: 2 }) }, { transform: tf({ sx: 0.97, sy: 1.04 }) }, { transform: tf() }], { duration: 900 });
      burst("hearts", 6); set(o === "no" ? "proud" : "happy"); await sleep(250);
    },
    async eat(o, treat) {
      const d = prop(dish(treat)); place(d, 520, 980, 340);
      set("listen");
      await run(d, [{ transform: `${T(0, 80)}`, opacity: 0 }, { transform: "translate(0,0)", opacity: 1 }], { duration: 320, fill: "forwards" });
      set("shock");
      await run(d, [{ transform: "translate(0,0) scale(1)", opacity: 1 }, { transform: `${T(0, -(980 - MOUTH[1]), "scale(.35)")}`, opacity: 0.2 }], { duration: 420, fill: "forwards", easing: "ease-in" }); d.remove();
      set("eat");
      for (let i = 0; i < 3; i++) await run(pose, [{ transform: tf() }, { transform: tf({ y: 2, sy: 0.96, sx: 1.02 }) }, { transform: tf() }], { duration: 300 });
      if (treat === "beer" || treat === "cocktail") { set("dizzy"); await shake(3, 700); burst("stars", 3); }
      else { set("happy"); burst("hearts", 3); await hop(-4, 360); }
    },
    async burp() { set("shock"); await run(act, [{ transform: tf() }, { transform: tf({ sx: 1.1, sy: 0.92 }) }, { transform: tf({ sx: 0.97, sy: 1.04, y: -2 }) }, { transform: tf() }], { duration: 700 }); set("dizzy"); await sleep(300); },

    // ── what she does when she is punished ──
    async ignore(o) {
      set(o === "ok" ? "sulk" : "sorry");
      await run(act, [{ transform: tf() }, { transform: tf({ r: -9, x: -3, y: 2 }) }], { duration: 500, fill: "forwards" }); await sleep(700);
      act.getAnimations().forEach((a) => a.cancel());
    },
    async no(o) {
      set(o === "ok" ? "sulk" : "sorry"); await run(act, [{ transform: tf() }, { transform: tf({ sx: 0.94, sy: 0.94, y: 3 }) }, { transform: tf({ sx: 0.96, sy: 0.96, y: 2 }) }], { duration: 480, fill: "forwards" });
      await sleep(600); act.getAnimations().forEach((a) => a.cancel());
    },
    async flick(o) {
      set("listen"); const fg = prop(fingerSvg); place(fg, 520, -10, 110, 220);
      await run(fg, [{ transform: `${T(0, -60)}`, opacity: 0 }, { transform: "translate(0,0)", opacity: 1 }], { duration: 250, fill: "forwards" });
      await run(fg, [{ transform: "translate(0,0)" }, { transform: `${T(0, -26)}` }, { transform: `${T(0, 60)}` }], { duration: 260, easing: "ease-in", fill: "forwards" });
      set("wince"); burst("sparks", 3, [520, 200]);
      await run(act, [{ transform: tf() }, { transform: tf({ r: -9, y: -4 }), offset: 0.2 }, { transform: tf({ r: 3 }), offset: 0.6 }, { transform: tf() }], { duration: 650 });
      fg.remove(); set(o === "ok" ? "angry" : "sorry"); await sleep(450);
    },
    async timeout(o) {
      set(o === "ok" ? "sulk" : "sorry"); viewSet = "k";
      await turnTo(0, 180, 600); // turns to face the wall
      await sleep(1100);
      await turnTo(180, 360, 600); // and round again, the same way
      showAngle(0);
    },
    async confiscate(o) {
      const d = prop(dish("noodles")); place(d, 520, 950, 330);
      set("eat");
      await run(d, [{ transform: `${T(0, 80)}`, opacity: 0 }, { transform: "translate(0,0)", opacity: 1 }], { duration: 300, fill: "forwards" });
      const h = prop(handSvg()); place(h, 960, 1130, 280, 320);
      await run(h, [{ transform: `${T(0, 60)}`, opacity: 0 }, { transform: `${T(-300, -170)}`, opacity: 1 }], { duration: 380, fill: "forwards" });
      set(o === "ok" ? "sulk" : "sorry");
      await Promise.all([run(h, [{ transform: `${T(-300, -170)}` }, { transform: `${T(60, 120)}`, opacity: 0 }], { duration: 480, fill: "forwards", easing: "ease-in" }), run(d, [{ transform: "translate(0,0)", opacity: 1 }, { transform: `${T(300, 200, `scale(.6)`)}`, opacity: 0 }], { duration: 480, fill: "forwards", easing: "ease-in" })]);
      d.remove(); h.remove(); await sleep(350);
    },

    // ── events ──
    async bite() {
      set("angry"); kick(-220, -220, 160);
      await run(act, [{ transform: tf() }, { transform: tf({ sx: 0.9, sy: 0.9 }) }, { transform: tf({ sx: 1.45, sy: 1.45, y: 2 }), offset: 0.7 }, { transform: tf({ sx: 1.35, sy: 1.35, y: 2 }) }], { duration: 650, fill: "forwards", easing: "ease-in" });
      burst("sparks", 5, [520, 500]); await shake(3, 380); await sleep(250);
      act.getAnimations().forEach((a) => a.cancel()); set("shock"); await sleep(450); set("sorry");
    },
    async ride() { set("proud"); burst("stars", 6); await run(act, [{ transform: tf() }, { transform: tf({ y: -5, r: -3, sx: 1.06, sy: 1.06 }) }, { transform: tf({ y: -4, r: -3, sx: 1.06, sy: 1.06 }) }], { duration: 600, fill: "forwards" }); await sleep(700); act.getAnimations().forEach((a) => a.cancel()); },
    async strike() { set("angry"); viewSet = "k"; await turnTo(0, 180, 600); }, // turns her back on him for good (reset() or the next screen brings her round)
  };

  // ─ coming and going ─
  async function act_(name, outcome = "ok", arg) {
    const fn = ACTS[name];
    if (!fn) throw new Error("unknown scene " + name);
    idle(false);
    await fn(outcome, arg);
    props.innerHTML = "";
  }
  function reset(expr = "sly") {
    for (const a of host.getAnimations({ subtree: true })) a.cancel();
    host.classList.remove("fx-drool");
    turnToken++; showAngle(0);
    act.style.transform = "";
    props.innerHTML = "";
    set(expr);
  }
  function blink() { // her eyes shut for a moment (only when her eyes are open, and with the same brow and mouth as she has now)
    if (calm || !["sly", "cheeky", "listen"].includes(current)) return;
    const was = shown;
    show(was === "listen" ? "blink" : "sblink");
    setTimeout(() => { if (shown === "blink" || shown === "sblink") show(was); }, 130);
  }
  function wiggle() { // her head tilts a little
    if (calm) return;
    pose.animate([{ rotate: "0deg" }, { rotate: "-2.5deg" }, { rotate: "1.5deg" }, { rotate: "0deg" }], { duration: 560, easing: "ease-in-out" });
  }
  function idle(on) {
    idleOn = on;
    clearTimeout(blinkTimer);
    breathing?.cancel(); breathing = null;
    if (!on || calm) return;
    breathing = dog.animate([{ transform: "scale(1, 1)" }, { transform: "scale(1.006, 1.014)" }], { duration: 1700, direction: "alternate", iterations: Infinity, easing: "ease-in-out" });
    const tick = () => { if (!idleOn) return; if (Math.random() < 0.7) blink(); else wiggle(); blinkTimer = setTimeout(tick, 2200 + Math.random() * 2600); };
    blinkTimer = setTimeout(tick, 1400);
  }

  showAngle(0);
  set("sly");
  return { el: host, ready, set, act: act_, reset, burst, idle, get expr() { return current; }, set hold(v) { hold = v; }, get motion() { return { ears: [spring.L.a, spring.R.a], tail: spring.T.a, warp: !!warp }; }, expressions: Object.keys(EXPR) };
}
