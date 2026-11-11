// "Heart": a block puzzle. A heart-shaped outline is tiled by 11 blocks (Tetris-like pieces), one block for every letter of the answer;
// the same letter is the same block, so there are two R blocks and two I blocks that look alike. The blocks do not turn: they go in the
// way they lie, and they do not have to look like their letters.
//
// Where a block goes decides where its letter goes in the word: the heart is read like text, top to bottom and then left to right, every
// block counting by its first cell (the top one, the left-most of those). The cells under the heart are the letters of the word in that
// order. A block put in the right place shows its letter in the right cell, a block in a wrong place shows a wrong letter.
//
//   layout: rows of "." (outside the heart) and one symbol (a-z) per block      [".aab.ccc.", ...]
//   pieces: { a: ["G", "#2e9e55"], ... }                                         the letter and the colour of each block
//
// Only helpers here (no page needed), so the build can check a puzzle with them.

/** The cells of a block, moved to the top-left corner and sorted in reading order. */
export function normalize(cells) {
  const r0 = Math.min(...cells.map((p) => p[0]));
  const c0 = Math.min(...cells.map((p) => p[1]));
  return cells.map(([r, c]) => [r - r0, c - c0]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

export const shapeKey = (cells) => normalize(cells).map(([r, c]) => `${r},${c}`).join(";");

/** The first cell of a block: the top one, the left-most of those. */
export const firstCell = (cells) => cells.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1])[0];

/** The ids of the blocks in reading order: by first cell, top to bottom and then left to right. pieces: { id: [[r, c], ...] } */
export const readingOrder = (pieces) =>
  Object.keys(pieces).sort((x, y) => {
    const a = firstCell(pieces[x]);
    const b = firstCell(pieces[y]);
    return a[0] - b[0] || a[1] - b[1];
  });

/** The layout as { rows, cols, mask: Set("r,c"), pieces: { id: [[r, c], ...] } }. */
export function parse(layout) {
  const mask = new Set();
  const pieces = {};
  layout.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      if (ch === ".") return;
      mask.add(`${r},${c}`);
      (pieces[ch] ||= []).push([r, c]);
    }),
  );
  return { rows: layout.length, cols: layout[0].length, mask, pieces };
}

/** Whether the cells hang together (side by side, not only at a corner). */
export function connected(cells) {
  const set = new Set(cells.map(([r, c]) => `${r},${c}`));
  const seen = new Set([[...set][0]]);
  const todo = [[...set][0]];
  while (todo.length) {
    const [r, c] = todo.pop().split(",").map(Number);
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = `${r + dr},${c + dc}`;
      if (set.has(k) && !seen.has(k)) { seen.add(k); todo.push(k); }
    }
  }
  return seen.size === set.size;
}

/**
 * In how many ways (counted up to `limit`) the heart can be filled by these blocks. The blocks do not turn and equal blocks are
 * interchangeable. types: [{ cells, count }] (cells as normalize() gives them).
 */
export function countTilings(mask, types, limit = 2) {
  const order = [...mask].map((s) => s.split(",").map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const left = types.map((t) => ({ cells: normalize(t.cells), n: t.count }));
  const occ = new Set();
  let total = 0;
  const rec = (i) => {
    if (total >= limit) return;
    while (i < order.length && occ.has(`${order[i][0]},${order[i][1]}`)) i++;
    if (i === order.length) { total++; return; }
    const [r, c] = order[i];
    for (const t of left) {
      if (!t.n) continue;
      const [r0, c0] = t.cells[0]; // the first cell in reading order goes on the first empty cell
      const cs = t.cells.map(([dr, dc]) => [r + dr - r0, c + dc - c0]);
      if (cs.some(([y, x]) => !mask.has(`${y},${x}`) || occ.has(`${y},${x}`))) continue;
      t.n--;
      cs.forEach(([y, x]) => occ.add(`${y},${x}`));
      rec(i + 1);
      cs.forEach(([y, x]) => occ.delete(`${y},${x}`));
      t.n++;
    }
  };
  rec(0);
  return total;
}
