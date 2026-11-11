// A small animation of the two of them (the Q-version faces of the opening card), made of the layers in assets/duo/:
// she raises one eyebrow and smirks, he looks at her and blinks, they lean in
// and bump heads, and little hearts float up. It loops. Nothing here needs the network once the layers are loaded.
//
//   mountDuo(box)  draws the scene into the element `box` and starts it; returns { stop() }
//
// Every moving part is its own picture on top of the face (see duo-parts.js), moved with the Web Animations API.
// All the moves are written in percentages of the part's own size, so the scene looks the same at any width.
import { DUO_PARTS, DUO_SIZE } from "./duo-parts.js";

const LOOP = 9000; // ms: the whole story, then it starts again
const ORDER = ["eyeL", "eyeR", "pupilL", "pupilR", "lidL", "lidR", "browL", "browR", "mouth"]; // bottom to top
const EASE = "cubic-bezier(.45, 0, .25, 1)";
const HEART = '<svg viewBox="0 0 32 29" aria-hidden="true"><path d="M16 28C6 20 1 14.5 1 8.8 1 4.4 4.4 1 8.6 1c3 0 5.6 1.7 7.4 4.4C17.8 2.7 20.4 1 23.4 1 27.6 1 31 4.4 31 8.8 31 14.5 26 20 16 28z"/></svg>';

// every transform uses the same list of functions, so the browser can blend between any two of them
const tf = ({ x = 0, y = 0, r = 0, sx = 1, sy = 1 } = {}) => `translate(${x}%, ${y}%) rotate(${r}deg) scale(${sx}, ${sy})`;
const T = (o) => ({ transform: tf(o) });
const lerp = (a, b, k) => a + (b - a) * k;
// the value at time `at` of a curve given as points [time, value], straight lines between the points
const sample = (points, at) => {
  if (at <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    if (at <= points[i][0]) {
      const [t0, v0] = points[i - 1];
      const [t1, v1] = points[i];
      return t1 === t0 ? v1 : lerp(v0, v1, (at - t0) / (t1 - t0));
    }
  }
  return points[points.length - 1][1];
};

function face(who) {
  const pct = (v) => `${(v / DUO_SIZE) * 100}%`;
  const layers = ORDER.map((name) => {
    const [x, y, w, h] = DUO_PARTS[who][name];
    return `<img class="duo-p ${name}" src="assets/duo/${who}-${name}.png" alt="" draggable="false" style="left:${pct(x)};top:${pct(y)};width:${pct(w)};height:${pct(h)}">`;
  }).join("");
  return `<div class="duo-face ${who}"><div class="duo-bob"><img class="duo-base" src="assets/duo/${who}-base.png" alt="" draggable="false">${layers}</div></div>`;
}

// the hearts: [when (ms), x (% of the width), y (% of the height), how far it floats right and up (% of the width), size (% of the width), colour, how long (ms), turn (deg)]
const HEARTS = [
  [1900, 69, 54, -12, -9, 6.5, "#e4366f", 1500, -10], // he sends one over, just after his blink
  [5600, 49, 54, -3, -26, 8, "#e4366f", 2000, -6], // two slow ones after they have touched (no burst at the bump: she asked to take it out)
  [6200, 53, 56, 4, -22, 5.5, "#ff8fb1", 1800, 8],
];

/** Draws the scene into `box` and starts it. Returns { stop() }. */
export function mountDuo(box) {
  const hearts = HEARTS.map(([, x, y, , , size, color]) => `<span class="duo-heart" style="left:${x}%;top:${y}%;width:${size}%;--c:${color}">${HEART}</span>`).join("");
  box.innerHTML = `<div class="duo" role="img" aria-label="她和他的小动画:她挑眉,他慢慢眨眼,两个人靠在一起,冒出小爱心">${face("her")}${face("him")}<div class="duo-fx">${hearts}</div></div>`;
  const stage = box.firstElementChild;
  const her = stage.querySelector(".duo-face.her");
  const him = stage.querySelector(".duo-face.him");
  const p = (who, name) => who.querySelector(`.${name}`);
  const anims = [];
  let stopped = false;

  // a loop of `LOOP` ms in which the element goes through the given stops: [time (ms), styles, easing to the next stop]
  const track = (el, stops) => {
    const frames = stops.map(([t, css, easing]) => ({ offset: Math.min(1, Math.max(0, t / LOOP)), ...css, easing: easing || EASE }));
    if (frames[0].offset > 0) frames.unshift({ ...frames[0], offset: 0 });
    if (frames[frames.length - 1].offset < 1) frames.push({ ...frames[frames.length - 1], offset: 1 });
    anims.push(el.animate(frames, { duration: LOOP, iterations: Infinity }));
  };

  function play() {
    // both lean towards each other and bump (she moves right, he moves left; each face is 46% of the width and they start 3% apart (8.5% between the round faces), so about 9% of its own width is just touching)
    const lean = (s) => [[0, T()], [3100, T()], [3950, T({ x: 9 * s, r: 8 * s })], [4150, T({ x: 12 * s, r: 9 * s, sx: 0.95, sy: 1.04 }), "ease-out"], [4350, T({ x: 10 * s, r: 8 * s, sx: 1.03, sy: 0.98 })], [4550, T({ x: 10 * s, r: 8 * s })], [5900, T({ x: 10 * s, r: 8 * s })], [7000, T()]];
    track(her, lean(1));
    track(him, lean(-1));
    // a gentle bob all the time (not tied to the story: its own 3 s loop)
    [[her, 0], [him, -900]].forEach(([who, delay]) => anims.push(who.querySelector(".duo-bob").animate([{ transform: tf() }, { transform: tf({ y: -1.8 }) }, { transform: tf() }], { duration: 3000, iterations: Infinity, easing: "ease-in-out", delay })));

    // SHE raises one eyebrow (the high one higher, the low one lower), smirks wider, wiggles the brow, and later closes her eyes happily
    track(p(her, "browL"), [[0, T()], [800, T()], [1000, T({ y: -55, r: -7 })], [1500, T({ y: -55, r: -7 })], [1650, T({ y: -85, r: -10 })], [1800, T({ y: -50, r: -6 })], [1950, T({ y: -85, r: -10 })], [2100, T({ y: -55, r: -7 })], [2700, T({ y: -55, r: -7 })], [3000, T()], [4000, T()], [4150, T({ y: -45, r: -6 })], [5600, T({ y: -45, r: -6 })], [6400, T()]]);
    track(p(her, "browR"), [[0, T()], [800, T()], [1000, T({ y: 36, r: 4 })], [2700, T({ y: 36, r: 4 })], [3000, T()], [4000, T()], [4150, T({ y: -26 })], [5600, T({ y: -26 })], [6400, T()]]); // (36% and 26% of this brow, which is only 34 px tall: about 12 and 9 px)
    track(p(her, "mouth"), [[0, T()], [900, T()], [1100, T({ sx: 1.28, r: -7, y: -6 })], [2600, T({ sx: 1.28, r: -7, y: -6 })], [3000, T()], [4000, T()], [4150, T({ sx: 1.4, r: -10, y: -8 })], [6000, T({ sx: 1.4, r: -10, y: -8 })], [6800, T()]]);
    // HER EYES. Her picture looks sideways at him; "at us" is the other way. She looks at us, gives him a sly look while she raises the eyebrow, looks at
    // us again, looks at him as they lean in, (closes her eyes happily), looks at us again, glances at him once more as they part, looks at us.
    // Looking at us the eyes change shape a little: the pupils are a bit bigger and rounder and the lids rise a little, so the eyes are more open.
    const US = [[0, 1], [500, 1], [800, 0], [2000, 0], [2300, 1], [3600, 1], [3850, 0], [5500, 0], [5800, 1], [6500, 1], [6800, 0], [7100, 0], [7400, 1], [LOOP, 1]]; // 1 = at us
    const SHUT = [[0, 0], [3300, 0], [3420, 1], [3560, 0], [4100, 0], [4250, 1], [5300, 1], [5500, 0], [7800, 0], [7920, 1], [8060, 0], [LOOP, 0]]; // 1 = closed
    const times = [...new Set([...US, ...SHUT].map(([at]) => at))].sort((x, y) => x - y);
    const LIFT = 2.5; // pixels of the 512 box: how far the lids rise
    const tall = (name) => DUO_PARTS.her[name][3];
    for (const side of ["L", "R"]) {
      const C = side === "L" ? -45 : -42; // how far the pupil moves from "at him" to "at us", % of its own width
      const stops = (shape) => times.map((at) => [at, T(shape(sample(US, at), sample(SHUT, at)))]);
      track(p(her, "pupil" + side), stops((u, c) => { const s = lerp(1, 1.12, u); return { x: lerp(0, C, u), y: lerp(0, (-LIFT / tall("pupil" + side)) * 100, u), sx: s, sy: s * lerp(1, 0.07, c) }; }));
      track(p(her, "eye" + side), stops((u, c) => ({ y: lerp(0, (-(LIFT + 1) / tall("eye" + side)) * 100, u), sx: lerp(1, 1.04, u), sy: lerp(1, 1.1, u) * lerp(1, 0.07, c) })));
      track(p(her, "lid" + side), stops((u) => ({ y: lerp(0, (-LIFT / tall("lid" + side)) * 100, u) })));
    }

    // HE looks at her (1.3 s) and blinks, at normal speed (1.7 s), looks at us again, looks at her once more as they lean in, is surprised for a moment
    // when they touch, wiggles his little cat mouth, grins. The eye whites only blink; the pupils also look sideways (G: % of the pupil's own width).
    const G = -23; // towards her (she is on the left)
    for (const name of ["eyeL", "eyeR"]) {
      track(p(him, name), [[0, T()], [1700, T()], [1820, T({ sy: 0.06 })], [1960, T()], [5300, T()], [5420, T({ sy: 0.08 })], [5560, T()]]);
    }
    for (const name of ["pupilL", "pupilR"]) {
      const at = (x, sy = 1) => T({ x, sy });
      track(p(him, name), [[0, at(0)], [1200, at(0)], [1500, at(G)], [1700, at(G)], [1820, at(G, 0.06)], [1960, at(G)], [2500, at(G)], [2800, at(0)], [3800, at(0)], [4050, at(G)], [4450, at(G)], [4800, at(0)], [5300, at(0)], [5420, at(0, 0.08)], [5560, at(0)]]);
    }
    track(p(him, "browL"), [[0, T()], [3700, T()], [4000, T({ y: -42, r: -4 })], [4500, T({ y: -42, r: -4 })], [5000, T()], [5600, T()], [5750, T({ y: -48, r: -5 })], [5950, T()]]);
    track(p(him, "browR"), [[0, T()], [3700, T()], [4000, T({ y: -42, r: 4 })], [4500, T({ y: -42, r: 4 })], [5000, T()]]);
    track(p(him, "mouth"), [[0, T()], [1800, T()], [2000, T({ sx: 1.08 })], [2600, T()], [4150, T()], [4250, T({ sx: 1.15, sy: 1.25 })], [4400, T({ sx: 0.92, sy: 0.9 })], [4550, T({ sx: 1.12, sy: 1.15 })], [4700, T({ sx: 1, sy: 1 })], [5200, T({ sx: 1.14, sy: 1.1 })], [6900, T({ sx: 1.14, sy: 1.1 })], [7600, T()]]);

    // the hearts: pop up where they start, float away and fade
    stage.querySelectorAll(".duo-heart").forEach((el, i) => {
      const [t, , , dx, dy, size, , dur, rot] = HEARTS[i];
      const toX = (dx / size) * 100; // translate percentages are relative to the heart itself
      const toY = (dy / (size * (29 / 32))) * 100;
      track(el, [
        [Math.max(0, t - 1), { transform: tf({ r: rot, sx: 0.2, sy: 0.2 }), opacity: 0 }, "linear"],
        [t, { transform: tf({ r: rot, sx: 0.4, sy: 0.4 }), opacity: 1 }, "ease-out"],
        [t + dur * 0.2, { transform: tf({ x: toX * 0.35, y: toY * 0.35, r: rot, sx: 1.1, sy: 1.1 }), opacity: 1 }, "ease-out"],
        [t + dur, { transform: tf({ x: toX, y: toY, r: rot, sx: 0.8, sy: 0.8 }), opacity: 0 }],
      ]);
    });
  }

  const calm = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pending = [...stage.querySelectorAll("img")].map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()));
  stage.style.visibility = "hidden"; // show it only when every layer is ready, so it never flashes half built
  Promise.all(pending).then(() => {
    if (stopped) return;
    stage.style.visibility = "";
    if (calm) return; // a still picture: the faces as they are
    play();
  });

  // save the battery while nobody can see it
  const io = typeof IntersectionObserver === "function" ? new IntersectionObserver(([e]) => anims.forEach((a) => (e.isIntersecting ? a.play() : a.pause()))) : null;
  io?.observe(stage);

  return {
    stop() {
      stopped = true;
      io?.disconnect();
      anims.forEach((a) => a.cancel());
      anims.length = 0;
    },
  };
}
