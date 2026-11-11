// "Trace": a word-trace puzzle. Each row is a picture clue for one English word, drawn as a row of coloured blocks (one per
// letter). A golden line runs across the rows and passes through some of the blocks; the letters it passes, read in the order it
// passes them, spell the answer.
//
//   rows: [{ word, icon, color, start }]   word: the hidden word; icon: a name from trace-icons.js; color: the blocks' colour;
//                                          start: how many block-widths the row is pushed to the right
//   line: [[row, index], ...]              the blocks the line passes through, in order (index counts from 0 inside the word)
//
// This file is only geometry (no page needed), so the build can check a puzzle with it: the line must spell the answer, and it
// must not brush against any block it is not supposed to pass.

export const G = { icon: 60, gap: 10, bw: 32, bg: 4.5, rowH: 68, top: 40, bottom: 66, right: 6, stroke: 5.5 };

/** Catmull-Rom through the points, as cubic Bezier segments: [[p0, c1, c2, p1], ...]. */
function beziers(pts) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    out.push([p1, [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6], p2]);
  }
  return out;
}

const at = (b, t) => {
  const u = 1 - t;
  return [0, 1].map((k) => u * u * u * b[0][k] + 3 * u * u * t * b[1][k] + 3 * u * t * t * b[2][k] + t * t * t * b[3][k]);
};

export function layout(rows, line) {
  const pitch = G.bw + G.bg;
  const x0 = G.icon + G.gap;
  const cols = Math.max(...rows.map((r) => (r.start || 0) + r.word.length));
  const W = x0 + cols * pitch - G.bg + G.right;
  const H = G.top + (rows.length - 1) * G.rowH + G.icon + G.bottom;
  const tiles = rows.map((r, k) => {
    const top = G.top + k * G.rowH;
    const cy = top + G.icon / 2;
    const cells = [...r.word].map((_, i) => {
      const x = x0 + ((r.start || 0) + i) * pitch;
      return { x, y: cy - G.bw / 2, cx: x + G.bw / 2, cy };
    });
    return { top, cy, cells };
  });

  const centres = line.map(([r, i]) => [tiles[r].cells[i].cx, tiles[r].cells[i].cy]);
  const first = centres[0];
  const last = centres[centres.length - 1];
  const prev = centres.length > 1 ? centres[centres.length - 2] : [last[0], last[1] - G.rowH];
  const tail = [first[0], first[1] - 46];
  const tip = [last[0] + (last[0] - prev[0]) * 0.4, last[1] + 52];
  const segs = beziers([tail, ...centres, tip]);
  const f = (n) => Number(n.toFixed(2));
  const d = `M${f(segs[0][0][0])} ${f(segs[0][0][1])}` + segs.map(([, c1, c2, p]) => ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p[0])} ${f(p[1])}`).join("");

  // the arrow head sits on the tip, pointing the way the line was going
  const end = segs[segs.length - 1];
  const ang = Math.atan2(end[3][1] - end[2][1], end[3][0] - end[2][0]);
  const pt = (along, side) => [tip[0] + Math.cos(ang) * along - Math.sin(ang) * side, tip[1] + Math.sin(ang) * along + Math.cos(ang) * side];
  const [a, b, c] = [pt(9, 0), pt(-8, -9), pt(-8, 9)];
  const arrow = `M${f(a[0])} ${f(a[1])} L${f(b[0])} ${f(b[1])} L${f(c[0])} ${f(c[1])} Z`;

  const samples = segs.flatMap((s) => Array.from({ length: 41 }, (_, k) => at(s, k / 40)));
  return { W, H, tiles, d, arrow, tip, centres, samples };
}

/** Blocks the golden line brushes against although it is not meant to pass them: [[row, index], ...]. */
export function strayTiles(rows, line) {
  const L = layout(rows, line);
  const meant = new Set(line.map(([r, i]) => `${r},${i}`));
  const reach = G.stroke / 2 + 1; // the line's own half width, plus a little air
  const stray = [];
  L.tiles.forEach((t, r) => t.cells.forEach((cell, i) => {
    if (meant.has(`${r},${i}`)) return;
    if (L.samples.some(([x, y]) => x > cell.x - reach && x < cell.x + G.bw + reach && y > cell.y - reach && y < cell.y + G.bw + reach)) stray.push([r, i]);
  }));
  return stray;
}
