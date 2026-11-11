// The lamp boards on the page. Tap a lamp: dark -> lit -> cross ("never lit") -> dark. A number turns gold when its block holds
// exactly that many lit lamps and red when it holds too many. A black cell is given: no lamp there, and it cannot be tapped.
// Solve a board and the lamps settle into a letter, then the next board appears. When the last letter is lit, the whole word glows.
//
// With `c.dishes` (a few little food pictures) a lit cell is not a lamp but a dish: tapping a cell puts a dish from the list on it (a different one
// from the dishes next to it, picked at random each time), tapping again takes it off. Everything else works the same.
import { analyze } from "./lamps.js";
import { BULB } from "./akari-ui.js";

const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
const dishImg = (src, k) => `<img class="lp-dish" data-d="${k}" src="${esc(src)}" alt="" draggable="false">`;

// a small seeded random generator, for the pictures that must look the same every time (the solved card, the table)
function seeded(seed) {
  let a = (seed + 1) * 2654435761;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// which dish goes on this cell: at random, but not one that a cell next to it already has
function pickDish(el, r, c, n, rand) {
  const taken = new Set();
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const k = el.querySelector(`.lp-cell[data-r="${r + dr}"][data-c="${c + dc}"] .lp-dish`)?.dataset.d;
    if (k !== undefined) taken.add(Number(k));
  }
  const free = [...Array(n).keys()].filter((k) => !taken.has(k));
  const from = free.length ? free : [...Array(n).keys()];
  return from[Math.floor(rand() * from.length)];
}

const cellHtml = (clues, r, c, mode) => {
  const d = clues[r][c];
  if (d === "#") return `<span class="lp-cell block" data-r="${r}" data-c="${c}"></span>`;
  const num = d === "." ? "" : `<i class="lp-n">${d}</i>`;
  const cls = d === "." ? "lp-cell" : "lp-cell clue";
  return mode === "play"
    ? `<button type="button" class="${cls}" data-r="${r}" data-c="${c}" aria-label="第 ${r + 1} 行第 ${c + 1} 列">${num}</button>`
    : `<span class="${cls}" data-r="${r}" data-c="${c}">${num}</span>`;
};

const boardHtml = (b, mode, i, dishes) =>
  `<div class="lp${mode === "play" ? "" : " static done"}${dishes ? " dishes" : ""}" data-i="${i}" style="--w:${b.clues[0].length}"><div class="lp-grid">${b.clues
    .map((row, r) => [...row].map((_, c) => cellHtml(b.clues, r, c, mode)).join(""))
    .join("")}</div></div>`;

function paint(el, board, st, dishes, rand = Math.random) {
  const a = analyze(board.clues, st);
  el.querySelectorAll(".lp-cell").forEach((cell) => {
    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    const lit = st[r][c] === 1;
    cell.classList.toggle("on", lit);
    cell.classList.toggle("x", st[r][c] === 2);
    if (dishes) {
      const has = cell.querySelector(".lp-dish");
      if (lit && !has) {
        const k = pickDish(el, r, c, dishes.length, rand);
        cell.insertAdjacentHTML("afterbegin", dishImg(dishes[k], k));
      }
      if (!lit && has) has.remove();
    } else {
      if (lit && !cell.querySelector(".bulb")) cell.insertAdjacentHTML("afterbegin", BULB);
      if (!lit) cell.querySelector(".bulb")?.remove();
    }
  });
  for (const n of a.numbers) {
    const cell = el.querySelector(`.lp-cell[data-r="${n.r}"][data-c="${n.c}"]`);
    cell?.classList.toggle("ok", n.have === n.need);
    cell?.classList.toggle("over", n.have > n.need || n.open < n.need);
  }
  return a;
}

const stateOf = (board, lit) => board.clues.map((row, r) => [...row].map((_, c) => (lit && board.picture[r][c] === "#" ? 1 : 0)));

/** The finished letters, lit (for the solved card and the small cards on the table). */
export function lampsStatic(c) {
  const holder = document.createElement("div");
  holder.innerHTML = `<div class="lp-set">${c.boards.map((b, i) => boardHtml(b, "static", i, c.dishes)).join("")}</div>`;
  holder.querySelectorAll(".lp").forEach((el, i) => paint(el, c.boards[i], stateOf(c.boards[i], true), c.dishes, seeded(i)));
  return holder.innerHTML;
}

/**
 * Plays the boards inside `root`, one after the other. hooks.onSolved() is called a moment after the last letter lights up.
 * Returns { hint("mark" | "place"), reveal() }.
 */
export function mountLamps(root, c, hooks) {
  const boards = c.boards;
  const states = boards.map((b) => stateOf(b, false));
  let active = 0;
  let done = false;
  let flash = 0;
  root.innerHTML = `<div class="lp-wrap"><div class="lp-set"></div><div class="lp-on" hidden><span>${c.answers[0]}</span></div></div>`;
  const set = root.querySelector(".lp-set");
  const word = root.querySelector(".lp-on");
  const boardEl = (i) => set.querySelector(`.lp[data-i="${i}"]`);
  const cellAt = (i, r, col) => boardEl(i)?.querySelector(`.lp-cell[data-r="${r}"][data-c="${col}"]`);

  const addBoard = (i) => {
    set.insertAdjacentHTML("beforeend", boardHtml(boards[i], "play", i, c.dishes));
    paint(boardEl(i), boards[i], states[i], c.dishes);
  };
  addBoard(0);

  const clearHint = () => root.querySelectorAll(".hint-spot, .hint-bad").forEach((el) => el.classList.remove("hint-spot", "hint-bad"));

  const repaint = () => {
    const el = boardEl(active);
    const a = paint(el, boards[active], states[active], c.dishes);
    if (!a.solved) return;
    clearHint();
    el.classList.add("done");
    if (active + 1 < boards.length) {
      active++;
      addBoard(active);
      setTimeout(() => boardEl(active)?.scrollIntoView({ behavior: "smooth", block: "center" }), 350);
    } else if (!done) {
      done = true;
      word.hidden = false;
      setTimeout(() => hooks.onSolved?.(), 2600); // long enough to enjoy the word lighting up
    }
  };

  root.addEventListener("click", (e) => {
    const cell = e.target.closest(".lp-cell");
    const el = cell?.closest(".lp");
    if (!cell || cell.classList.contains("block") || !el || done || Number(el.dataset.i) !== active) return;
    const r = Number(cell.dataset.r);
    const col = Number(cell.dataset.c);
    states[active][r][col] = (states[active][r][col] + 1) % 3;
    clearHint();
    repaint();
  });

  const picture = () => boards[active].picture;
  const wrong = () => {
    const st = states[active];
    for (let r = 0; r < st.length; r++) for (let col = 0; col < st[0].length; col++) if (st[r][col] === 1 && picture()[r][col] !== "#") return [r, col];
    return null;
  };
  const missing = () => {
    const st = states[active];
    for (let r = 0; r < st.length; r++) for (let col = 0; col < st[0].length; col++) if (st[r][col] !== 1 && picture()[r][col] === "#") return [r, col];
    return null;
  };

  return {
    // a nudge: point at a lamp that does not belong, or at a lamp that must be lit
    hint(kind) {
      if (done || !kind) return;
      clearHint();
      clearTimeout(flash);
      const bad = wrong();
      const target = bad ?? missing();
      if (!target) return;
      if (kind === "place") {
        states[active][target[0]][target[1]] = bad ? 0 : 1;
        repaint();
        return;
      }
      cellAt(active, target[0], target[1])?.classList.add(bad ? "hint-bad" : "hint-spot");
      flash = setTimeout(clearHint, 6000);
    },
    // give up: light every letter
    reveal() {
      done = true;
      clearHint();
      for (let i = 0; i < boards.length; i++) {
        if (!boardEl(i)) addBoard(i);
        states[i] = stateOf(boards[i], true);
        paint(boardEl(i), boards[i], states[i], c.dishes);
        boardEl(i).classList.add("done");
      }
    },
  };
}
