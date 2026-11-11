// The Akari board on the page. Tap a white cell: empty -> bulb -> cross ("no bulb here") -> empty.
// Lit cells glow; two bulbs that see each other turn red; a black number turns gold when it has exactly its bulbs and red when it
// has too many. When every cell is lit and every rule holds, the lights come on and "ON" appears.
import { analyze, isBlack } from "./akari.js";

export const BULB = `<svg class="bulb" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.4a6.6 6.6 0 0 0-3.7 12.1c.7.5 1.1 1.2 1.1 2V17h5.2v-.5c0-.8.4-1.5 1.1-2A6.6 6.6 0 0 0 12 2.4z" fill="#ffd54a" stroke="#d99a00" stroke-width="1.3"/><rect x="9.4" y="17.8" width="5.2" height="3.2" rx="1.1" fill="#8d867e"/></svg>`;

const cellHtml = (grid, r, c, mode) => {
  const ch = grid[r][c];
  if (isBlack(ch)) return `<span class="ak-cell black" data-r="${r}" data-c="${c}">${ch === "#" ? "" : ch}</span>`;
  return mode === "play"
    ? `<button type="button" class="ak-cell white" data-r="${r}" data-c="${c}" aria-label="第 ${r + 1} 行第 ${c + 1} 列"></button>`
    : `<span class="ak-cell white" data-r="${r}" data-c="${c}"></span>`;
};

const boardHtml = (grid, mode) =>
  `<div class="ak${mode === "play" ? "" : " static"}" style="--n:${grid[0].length}"><div class="ak-grid">${grid
    .map((row, r) => [...row].map((_, c) => cellHtml(grid, r, c, mode)).join(""))
    .join("")}</div><div class="ak-on" hidden><span>ON</span></div></div>`;

function paint(root, grid, st) {
  const bulbs = [];
  grid.forEach((row, r) => [...row].forEach((_, c) => { if (st[r][c] === 1) bulbs.push([r, c]); }));
  const a = analyze(grid, bulbs);
  root.querySelectorAll(".ak-cell.white").forEach((el) => {
    const r = Number(el.dataset.r);
    const c = Number(el.dataset.c);
    el.classList.toggle("lit", a.lit[r][c]);
    el.classList.toggle("x", st[r][c] === 2);
    el.classList.toggle("clash", a.clash.has(`${r},${c}`));
    if (st[r][c] === 1 && !el.querySelector(".bulb")) el.insertAdjacentHTML("afterbegin", BULB);
    if (st[r][c] !== 1) el.querySelector(".bulb")?.remove();
  });
  for (const n of a.numbers) {
    const el = root.querySelector(`.ak-cell.black[data-r="${n.r}"][data-c="${n.c}"]`);
    el?.classList.toggle("ok", n.have === n.need);
    el?.classList.toggle("over", n.have > n.need);
  }
  return a;
}

/** The finished board, with the solution's bulbs in place (for the solved card and the small cards on the table). */
export function akariStatic(c) {
  const st = c.grid.map((row) => [...row].map(() => 0));
  for (const [r, col] of c.solution) st[r][col] = 1;
  const holder = document.createElement("div");
  holder.innerHTML = boardHtml(c.grid, "static");
  paint(holder, c.grid, st);
  holder.firstElementChild.classList.add("done");
  return holder.innerHTML;
}

/**
 * Plays the board inside `root`. hooks.onSolved() is called a moment after the lights come on.
 * Returns { hint("mark" | "place"), reveal() }.
 */
export function mountAkari(root, c, hooks) {
  const grid = c.grid;
  const solution = new Set(c.solution.map(([r, col]) => `${r},${col}`));
  const st = grid.map((row) => [...row].map(() => 0));
  let done = false;
  let flash = 0;
  root.innerHTML = boardHtml(grid, "play");
  const board = root.querySelector(".ak");
  const on = root.querySelector(".ak-on");
  const cellAt = (r, col) => root.querySelector(`.ak-cell.white[data-r="${r}"][data-c="${col}"]`);

  const clearHint = () => root.querySelectorAll(".hint-spot, .hint-bad").forEach((el) => el.classList.remove("hint-spot", "hint-bad"));
  const repaint = () => {
    const a = paint(root, grid, st);
    if (a.solved && !done) {
      done = true;
      clearHint();
      board.classList.add("done");
      on.hidden = false;
      setTimeout(() => hooks.onSolved?.(), 2400); // long enough to enjoy the lights coming on
    }
  };

  root.addEventListener("click", (e) => {
    const el = e.target.closest(".ak-cell.white");
    if (!el || done) return;
    const r = Number(el.dataset.r);
    const col = Number(el.dataset.c);
    st[r][col] = (st[r][col] + 1) % 3;
    clearHint();
    repaint();
  });

  const wrong = () => {
    for (let r = 0; r < grid.length; r++) for (let col = 0; col < grid[0].length; col++) if (st[r][col] === 1 && !solution.has(`${r},${col}`)) return [r, col];
    return null;
  };
  const missing = () => {
    for (const [r, col] of c.solution) if (st[r][col] !== 1) return [r, col];
    return null;
  };

  return {
    // a nudge: point at a bulb that does not belong, or at a cell that must hold one
    hint(kind) {
      if (done || !kind) return; // some hints are only words
      clearHint();
      clearTimeout(flash);
      const bad = wrong();
      if (kind === "place") {
        const target = bad ?? missing();
        if (!target) return;
        st[target[0]][target[1]] = bad ? 0 : 1;
        repaint();
        return;
      }
      const target = bad ?? missing();
      if (!target) return;
      cellAt(target[0], target[1])?.classList.add(bad ? "hint-bad" : "hint-spot");
      flash = setTimeout(clearHint, 6000);
    },
    // give up: show the solution
    reveal() {
      done = true;
      clearHint();
      grid.forEach((row, r) => [...row].forEach((_, col) => { st[r][col] = solution.has(`${r},${col}`) ? 1 : 0; }));
      paint(root, grid, st);
      board.classList.add("done");
    },
  };
}
