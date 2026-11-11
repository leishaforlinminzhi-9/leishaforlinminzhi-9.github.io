// The Heart card on the page: build a heart out of 11 blocks. Drag a block into the outline (it goes in the way it lies, it does not turn).
// Every block shows its letter from the start. The cells under the heart are the letters of the word, and where a block sits in the heart
// is where its letter sits in the word: the heart is read like text (top to bottom, then left to right) and every block counts by its first
// cell (the top one, the left-most of those). A cell shows a letter only when a block's first cell sits exactly on the first cell of that
// letter's place, and it shows the letter of the block that sits there, the right one or a wrong one (a wrong letter is red). While a block
// is being dragged the cell it would fill lights up, with the letter faintly in it (red if it would be wrong), by the very same rule: it
// shows exactly what dropping the block would show.
// Tap a block in the heart to take it out. When the heart is full the cells read the word and the card is done.
import { tokens, lab } from "./colors.js";

const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
const isLight = (hex) => lab(hex)[0] > 50; // the blocks are soft colours: a dark letter reads on all of them

/** The blocks with everything the page needs (size, the cell that carries the letter). */
function prepare(c) {
  return c.heart.pieces.map((p) => {
    const h = Math.max(...p.cells.map((q) => q[0])) + 1;
    const w = Math.max(...p.cells.map((q) => q[1])) + 1;
    const cr = p.cells.reduce((a, q) => a + q[0], 0) / p.cells.length;
    const cc = p.cells.reduce((a, q) => a + q[1], 0) / p.cells.length;
    const label = p.cells.slice().sort((a, b) => Math.hypot(a[0] - cr, a[1] - cc) - Math.hypot(b[0] - cr, b[1] - cc))[0];
    return { ...p, w, h, label };
  });
}

/** Every cell of the heart ("r,c") and the place of its block in the word (0 for the first letter). */
const rankMap = (ps) => new Map(ps.flatMap((p) => p.cells.map(([r, k]) => [`${r + p.at[0]},${k + p.at[1]}`, p.rank])));

const pieceHtml = (p, cls = "") =>
  `<div class="hp-piece${cls}" data-id="${p.id}" style="--c:${esc(p.color)};--w:${p.w};--h:${p.h};--ink:${isLight(p.color) ? "#2b1d14" : "#fff"}">${p.cells
    .map(([r, c]) => `<i class="hp-b" style="--x:${c};--y:${r}"></i>`)
    .join("")}<b class="hp-l" style="--x:${p.label[1]};--y:${p.label[0]}">${p.letter}</b></div>`;

const slotsHtml = (ps) =>
  [...rankMap(ps).keys()]
    .map((s) => s.split(",").map(Number))
    .map(([r, k]) => `<i class="hp-slot" style="--x:${k};--y:${r}"></i>`)
    .join("");

// the cells under the heart: one per letter, an apostrophe mark where the word has one
const cellsHtml = (c) =>
  `<div class="hp-cells" style="--n:${tokens(c.answers[0]).length}">${tokens(c.answers[0])
    .map((t) => (t.apostrophe ? `<span class="hp-apos" aria-hidden="true">’</span>` : `<div class="hp-cell" data-k="${t.i}"><i class="hp-sw"></i><span class="hp-v"></span></div>`))
    .join("")}</div>`;

/** The finished heart with its letters (for the solved card and the table). */
export function heartStatic(c) {
  const ps = prepare(c);
  const H = c.heart;
  const placed = ps.map((p) => `<div class="hp-at" style="--x:${p.at[1]};--y:${p.at[0]}">${pieceHtml(p, " placed")}</div>`).join("");
  // the cells read the word, each in the colour of the block that sits there
  const cells = tokens(c.answers[0])
    .map((t) => {
      if (t.apostrophe) return `<span class="hp-apos" aria-hidden="true">’</span>`;
      const p = ps.find((q) => q.rank === t.i);
      return `<div class="hp-cell" data-k="${t.i}"><i class="hp-sw" style="background:${esc(p.color)}"></i><span class="hp-v">${p.letter}</span></div>`;
    })
    .join("");
  return `<div class="hp hp-static" style="--cols:${H.cols};--rows:${H.rows}"><div class="hp-board">${slotsHtml(ps)}${placed}</div><div class="hp-cells" style="--n:${tokens(c.answers[0]).length}">${cells}</div></div>`;
}

/**
 * Plays the heart inside `root`. hooks.onSolved() is called a moment after the word is spelled.
 * Returns { hint("help"), reveal() }: "help" takes out what is in a wrong place or, when everything that is in is right, puts the next
 * block in (and returns the words for what it did, c.heart.say).
 */
export function mountHeart(root, c, hooks) {
  const ps = prepare(c);
  const byId = Object.fromEntries(ps.map((p) => [p.id, p]));
  const H = c.heart;
  const word = tokens(c.answers[0]).filter((t) => !t.apostrophe).map((t) => t.ch);
  const rankAt = rankMap(ps);
  const mask = new Set(rankAt.keys());
  // the tray shows the blocks in a mixed-up but fixed order
  const trayOrder = ps.slice().sort((a, b) => ((a.id.charCodeAt(0) * 7919) % 31) - ((b.id.charCodeAt(0) * 7919) % 31));

  root.innerHTML = `<div class="hp" style="--cols:${H.cols};--rows:${H.rows}">
<div class="hp-board">${slotsHtml(ps)}<div class="hp-prev" hidden></div></div>
${cellsHtml(c)}
<div class="hp-tray">${trayOrder.map((p) => `<div class="hp-slotbox" data-id="${p.id}">${pieceHtml(p)}</div>`).join("")}</div>
<p class="hp-bar"><button type="button" class="ghost" data-act="clear">全部拿掉</button></p>
</div>`;
  const hp = root.querySelector(".hp");
  const board = root.querySelector(".hp-board");
  const prev = root.querySelector(".hp-prev");
  const cells = [...root.querySelectorAll(".hp-cell")]; // cells[k]: the k-th letter of the word
  const trayEl = Object.fromEntries(ps.map((p) => [p.id, root.querySelector(`.hp-slotbox[data-id="${p.id}"] .hp-piece`)]));
  const boardEl = {}; // a block that is in the heart

  const placed = []; // [{ id, r, c }] the blocks that are in the heart, the one put in last at the end
  let done = false;
  let locked = false;
  let drag = null;

  const ub = () => board.clientWidth / H.cols;
  const fit = () => {
    const u = Math.min(36, Math.floor(board.clientWidth / H.cols));
    hp.style.setProperty("--ub", `${board.clientWidth / H.cols}px`);
    hp.style.setProperty("--ut", `${Math.max(14, u * 0.56)}px`);
  };
  fit();
  if (typeof ResizeObserver === "function") new ResizeObserver(fit).observe(board);

  const occupied = (skipId) => {
    const occ = new Set();
    for (const q of placed) if (q.id !== skipId) for (const [r, k] of byId[q.id].cells) occ.add(`${q.r + r},${q.c + k}`);
    return occ;
  };
  const fits = (p, r, k, skipId) => {
    const occ = occupied(skipId);
    return p.cells.every(([dr, dc]) => mask.has(`${r + dr},${k + dc}`) && !occ.has(`${r + dr},${k + dc}`));
  };
  // the first cell ("r,c") of every place in the word, and which letter's place it is
  const anchors = new Map(ps.map((p) => [`${p.at[0] + p.cells[0][0]},${p.at[1] + p.cells[0][1]}`, p.rank]));
  // the cell of the word a block fills: the one whose place starts on the very cell this block starts on (first cell on first cell), else -1
  const slotAt = (id, r, k) => {
    const [dr, dc] = byId[id].cells[0];
    return anchors.get(`${r + dr},${k + dc}`) ?? -1;
  };
  // the place in the word a block fills when it stands exactly where it belongs (a twin of the same letter may stand in for it), else -1
  const exactSlot = (q) => {
    const s = ps.find((p) => p.letter === byId[q.id].letter && p.at[0] === q.r && p.at[1] === q.c);
    return s ? s.rank : -1;
  };

  const render = () => {
    for (const p of ps) {
      const at = placed.find((q) => q.id === p.id);
      trayEl[p.id].parentElement.classList.toggle("away", !!at);
      if (at && !boardEl[p.id]) {
        const wrap = document.createElement("div");
        wrap.className = "hp-at";
        wrap.innerHTML = pieceHtml(p, " placed");
        board.appendChild(wrap);
        boardEl[p.id] = wrap;
      }
      if (boardEl[p.id]) {
        boardEl[p.id].hidden = !at;
        if (at) {
          boardEl[p.id].style.setProperty("--x", at.c);
          boardEl[p.id].style.setProperty("--y", at.r);
        }
      }
    }
    const shown = []; // slot -> the block whose first cell sits on the first cell of that place (right block or not)
    for (const q of placed) {
      if (drag && q.id === drag.id) continue; // a block in the hand is not in the heart
      const k = slotAt(q.id, q.r, q.c);
      if (k >= 0) shown[k] = q;
    }
    cells.forEach((cell, k) => {
      const p = shown[k] && byId[shown[k].id];
      const v = cell.querySelector(".hp-v");
      const before = v.textContent;
      const wrong = !!p && p.letter !== word[k]; // a block that sits on this place but is not this letter's block
      cell.classList.toggle("on", !!p);
      cell.classList.toggle("bad", wrong);
      cell.querySelector(".hp-sw").style.background = p ? p.color : "";
      v.textContent = p ? p.letter : "";
      if (p && p.letter !== before) {
        cell.classList.add(wrong ? "shake" : "pop"); // a letter pops into its box, a wrong one shakes in
        setTimeout(() => cell.classList.remove("pop", "shake"), 700);
      }
    });
    if (!done && !drag && placed.length === ps.length && word.every((L, k) => shown[k] && byId[shown[k].id].letter === L)) {
      done = true;
      hp.classList.add("hp-done");
      setTimeout(() => hooks.onSolved?.(), 2400); // long enough to enjoy the heart
    }
  };

  const put = (id, r, k) => {
    const i = placed.findIndex((q) => q.id === id);
    if (i >= 0) placed.splice(i, 1);
    placed.push({ id, r, c: k });
  };
  const take = (id) => {
    const i = placed.findIndex((q) => q.id === id);
    if (i >= 0) placed.splice(i, 1);
  };

  // where a dropped block would settle: the spot where it really is, or the nearest spot that fits within a cell of it (and nowhere else)
  const snap = (p, left, top) => {
    const rect = board.getBoundingClientRect();
    const u = ub();
    const fc = (left - rect.left) / u; // where the block's top-left corner is, counted in cells
    const fr = (top - rect.top) / u;
    const c0 = Math.round(fc);
    const r0 = Math.round(fr);
    const tries = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) tries.push([r0 + dr, c0 + dc, Math.hypot(r0 + dr - fr, c0 + dc - fc)]);
    tries.sort((a, b) => a[2] - b[2]);
    for (const [r, k, d] of tries) if (d <= 1 && fits(p, r, k, p.id)) return { r, c: k };
    return null;
  };
  // the shadow where it would land, and the cell that would show its letter lights up (with the letter faintly in it): the same rule as dropping
  const showPrev = (p, spot) => {
    prev.hidden = !spot;
    if (spot) prev.innerHTML = p.cells.map(([r, k]) => `<i class="hp-b" style="--x:${spot.c + k};--y:${spot.r + r}"></i>`).join("");
    const slot = spot ? slotAt(p.id, spot.r, spot.c) : -1;
    cells.forEach((cell, k) => {
      cell.classList.toggle("aim", k === slot);
      cell.classList.toggle("aimbad", k === slot && p.letter !== word[k]);
      cell.querySelector(".hp-v").dataset.ghost = k === slot ? p.letter : "";
    });
  };

  const pos = (e) => {
    const p = byId[drag.id];
    const u = ub();
    const left = e.clientX - drag.fx * p.w * u;
    const top = e.clientY - drag.fy * p.h * u - (drag.touch ? 40 : 0); // lifted above a finger, so it can be seen
    drag.el.style.left = `${left}px`;
    drag.el.style.top = `${top}px`;
    drag.left = left;
    drag.top = top;
    showPrev(p, snap(p, left, top));
  };

  root.addEventListener("pointerdown", (e) => {
    if (done || locked || e.button > 0) return;
    const src = e.target.closest(".hp-piece");
    if (!src || !hp.contains(src)) return;
    const id = src.dataset.id;
    const p = byId[id];
    e.preventDefault();
    const rect = src.getBoundingClientRect();
    const el = document.createElement("div");
    el.className = "hp-float";
    el.style.setProperty("--ub", `${ub()}px`);
    el.innerHTML = pieceHtml(p);
    document.body.appendChild(el);
    drag = {
      id, el, src, from: src.closest(".hp-at") ? "board" : "tray", pid: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false, touch: e.pointerType === "touch",
      fx: (e.clientX - rect.left) / rect.width, fy: (e.clientY - rect.top) / rect.height,
    };
    src.classList.add("lifted"); // the block it was lifted from stays as a ghost
    try { src.setPointerCapture(e.pointerId); } catch {}
    render(); // a block lifted out of the heart no longer fills its cell
    pos(e);
  });

  const onMove = (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.moved = true;
    pos(e);
  };
  const onUp = (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    const d = drag;
    drag = null;
    d.el.remove();
    d.src.classList.remove("lifted");
    const p = byId[d.id];
    showPrev(p, null);
    if (!d.moved) {
      if (d.from === "board") take(d.id); // a tap on a block in the heart takes it out
    } else {
      const spot = snap(p, d.left, d.top);
      if (spot) put(d.id, spot.r, spot.c);
      else take(d.id);
    }
    render();
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);

  root.addEventListener("click", (e) => {
    if (e.target.closest("[data-act='clear']") && !done && !locked) {
      placed.length = 0;
      render();
    }
  });

  render();

  // ── hints ───────────────────────────────────────────────────────────────────────────────────────────────────
  // a block with this letter may go wherever one of its twins goes (two R, two I look alike), so "right" means: at a place of the solution
  const rightAt = (q) => exactSlot(q) >= 0;
  const emptySpots = () => {
    const taken = new Set(placed.filter(rightAt).map((q) => `${byId[q.id].letter}${q.r},${q.c}`));
    return ps.filter((p) => !taken.has(`${p.letter}${p.at[0]},${p.at[1]}`));
  };
  const freeOf = (L) => ps.find((p) => p.letter === L && !placed.some((q) => q.id === p.id));
  const flash = (id) => {
    const el = boardEl[id];
    if (!el) return;
    el.classList.add("flash");
    setTimeout(() => el.classList.remove("flash"), 1700);
  };

  function help() {
    const say = c.heart.say;
    // first take out what is in the wrong place
    const wrong = placed.filter((q) => !rightAt(q));
    if (wrong.length) {
      wrong.forEach((q) => take(q.id));
      render();
      return say.wrong;
    }
    // then put in the block that belongs lowest, so the heart grows from the tip upward
    const bottom = (p) => p.at[0] + p.h - 1;
    const spot = emptySpots().sort((a, b) => bottom(b) - bottom(a) || a.at[1] - b.at[1])[0];
    if (!spot) return;
    const block = freeOf(spot.letter);
    put(block.id, spot.at[0], spot.at[1]);
    render();
    flash(block.id);
    return say.place;
  }

  return {
    hint(kind) {
      if (done || locked || kind !== "help") return;
      return help();
    },
    // give up: every block goes where it belongs
    reveal() {
      locked = true;
      done = true;
      placed.length = 0;
      for (const p of ps) put(p.id, p.at[0], p.at[1]);
      render();
      hp.classList.add("hp-done");
    },
  };
}
