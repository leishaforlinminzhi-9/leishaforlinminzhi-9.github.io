// The Crowd card on the page: a big crowd of little people, some with their arms up, some with them down. The people of the letters keep their
// arms up the whole time; of everybody else a few raise their arms for a moment and lower them again, all the time and at random, so the
// only arms that never come down are the letters' (and stepping back with the slider, they make out the word). The answer is typed in the
// usual box underneath; the hints help by stepping back for him, dimming the people with their arms down, then the ones who do not belong
// to a letter, and lighting up the letters one after the other.
import { people } from "./crowd.js";

const CW = 20; // one person's cell, in drawing units
const CH = 28;
const SMAX = 2.7; // how close the slider starts: only the middle of the crowd is in view
const SMIN = 1; // and how far it goes: the whole crowd, filling the frame
const BEAT = 600; // every so often (ms) some of the people who do not belong to a letter raise or lower their arms
const SHARE = 0.3; // ... of them, this many at each beat draw again whether their arms are up

// an arm is drawn hanging down and swung up around the shoulder (see the styles): down it is short and plain, up it is long and outlined
const arm = (side, x) => `<g class="cr-aw cr-aw${side}"><path class="cr-ao" d="M${x} 17 L${x + 0.1} 32.8"/><path class="cr-arm" d="M${x} 17 L${x + 0.1} 32.8"/></g>`;

function figure(p, calm) {
  const x = p.c * CW + p.dx + CW / 2;
  const y = p.r * CH + p.dy + CH;
  const up = p.letter >= 0 || (!calm && p.up);
  return `<g class="cr-p${up ? " up" : ""}${p.letter >= 0 ? " in" : ""}" data-l="${p.letter}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${p.s.toFixed(2)}) translate(-10 -28)" style="--shirt:${p.shirt};--skin:${p.skin};--hair:${p.hair}"><g class="cr-fig"><path class="cr-body" d="M4.6 28 L4.6 19 Q4.6 14.4 10 14.4 Q15.4 14.4 15.4 19 L15.4 28 Z"/>${arm("l", 4.9)}${arm("r", 15.1)}<circle class="cr-head" cx="10" cy="9.6" r="4.7"/><path class="cr-hair" d="M5.3 9.6 A4.7 4.7 0 0 1 14.7 9.6 Q10 6.2 5.3 9.6 Z"/></g></g>`;
}

function crowdSvg(c, calm = false) {
  const list = people(c.crowd);
  const W = c.crowd.rows[0].length * CW;
  const H = c.crowd.rows.length * CH;
  return `<svg class="cr-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="一大群人">${list.map((p) => figure(p, calm)).join("")}</svg>`;
}

// the little pictures at the two ends of the slider: one person close up, a crowd far away
const NEAR = `<svg class="cr-ic" viewBox="0 0 20 28" aria-hidden="true"><circle cx="10" cy="9.6" r="4.7"/><path d="M4.6 28 L4.6 19 Q4.6 14.4 10 14.4 Q15.4 14.4 15.4 19 L15.4 28 Z"/></svg>`;
const FAR = `<svg class="cr-ic" viewBox="0 0 30 18" aria-hidden="true">${[0, 1, 2, 3, 4].map((k) => `<circle cx="${3 + k * 6}" cy="${k % 2 ? 12 : 6}" r="2.1"/><path d="M${k * 6 + 0.8} ${k % 2 ? 18 : 12} v-2.2 q0-2 2.2-2 q2.2 0 2.2 2 v2.2z"/>`).join("")}</svg>`;

/** The finished crowd with its letters lit (for the solved card and the table). */
export function crowdStatic(c) {
  return `<div class="cr cr-static"><div class="cr-stage">${crowdSvg(c, true)}</div></div>`; // calm: only the people of the letters have their arms up
}

/**
 * Plays the crowd inside `root`. Returns { hint("step" | "dim" | "focus" | "first" | "all"), reveal(), celebrate() }.
 */
export function mountCrowd(root, c) {
  root.innerHTML = `<div class="cr"><div class="cr-stage">${crowdSvg(c)}</div><div class="cr-bar">${NEAR}<input type="range" class="cr-zoom" min="0" max="100" value="0" aria-label="远近">${FAR}</div></div>`;
  const cr = root.querySelector(".cr");
  const svg = root.querySelector(".cr-svg");
  const zoom = root.querySelector(".cr-zoom");
  const letters = [...root.querySelectorAll(".cr-p.in")];
  const others = [...root.querySelectorAll(".cr-p:not(.in)")]; // the people who do not belong to a letter

  const scaleOf = (t) => SMAX * Math.pow(SMIN / SMAX, t);
  const setZoom = (t) => {
    svg.style.transform = `scale(${scaleOf(t).toFixed(3)})`;
    zoom.value = String(Math.round(t * 100));
  };
  setZoom(0);
  zoom.addEventListener("input", () => setZoom(Number(zoom.value) / 100));

  let anim = 0;
  const stepBack = () => {
    cancelAnimationFrame(anim);
    const from = Number(zoom.value) / 100;
    const t0 = performance.now();
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / 900);
      setZoom(from + (1 - from) * (1 - (1 - k) ** 3));
      if (k < 1) anim = requestAnimationFrame(tick);
    };
    anim = requestAnimationFrame(tick);
  };
  // the people who do not belong to a letter keep changing their minds; the letters never move
  let beat = 0;
  const restless = !(typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) && c.crowd.noise > 0;
  const shuffle = () => {
    if (!root.isConnected || document.hidden) return; // nobody is looking (a card put aside, a tab in the background)
    for (const g of others) if (Math.random() < SHARE) g.classList.toggle("up", Math.random() < c.crowd.noise);
  };
  // everybody but the letters lowers their arms and stays that way
  const settle = () => {
    clearInterval(beat);
    beat = 0;
    others.forEach((g) => g.classList.remove("up"));
  };
  if (restless) beat = setInterval(shuffle, BEAT);
  const light = (index) => letters.forEach((g) => g.classList.toggle("hot", index === "all" || Number(g.dataset.l) === index || g.classList.contains("hot")));

  return {
    hint(kind) {
      if (kind === "step") stepBack();
      else if (kind === "dim") cr.classList.add("dimdown");
      else if (kind === "focus") cr.classList.add("dimdown", "focus");
      else if (kind === "first") light(0);
      else if (kind === "all") light("all");
    },
    // give up: step back, show the letters
    reveal() {
      stepBack();
      settle();
      cr.classList.add("dimdown", "focus");
      light("all");
    },
    // a right answer: the people of the letters cheer
    celebrate() {
      stepBack();
      settle();
      cr.classList.add("dimdown", "focus", "cheer");
      light("all");
    },
  };
}
