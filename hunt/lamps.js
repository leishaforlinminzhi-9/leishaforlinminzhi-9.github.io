// "Lamps" (a picture-logic puzzle, also known as Fill-a-Pix): a board of lamps, some cells show a number.
// A number says how many lamps in the 3x3 block centred on it (the cell itself included) are lit. Light the right lamps and
// they form a picture: here, a letter.
//
//   clues:   rows of "." (nothing), a digit (a number) or "#" (a black cell: certainly no lamp there, and it cannot be tapped)
//            e.g. "..3.." / "4.0.3" / "3#1.2"
//   picture: rows of "#" (lit) and "."   the letter the lamps must end up forming
//
// A well-made board has exactly one way to satisfy every number (the build checks that), so it can be solved by reasoning.

const AROUND = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 0], [0, 1], [1, -1], [1, 0], [1, 1]];

/** The numbers every cell of a picture would show if all of them were shown. */
export function fullClues(picture) {
  return picture.map((row, r) => [...row].map((_, c) => AROUND.filter(([dr, dc]) => picture[r + dr]?.[c + dc] === "#").length));
}

/** How the lamps lit so far (st[r][c] === 1) stand against every number on the board. */
export function analyze(clues, st) {
  const H = clues.length;
  const W = clues[0].length;
  const numbers = [];
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      if (clues[r][c] === "." || clues[r][c] === "#") continue;
      let have = 0;
      let open = 0; // cells in the block that are not ruled out with a cross (a black cell is always ruled out)
      for (const [dr, dc] of AROUND) {
        const y = r + dr;
        const x = c + dc;
        if (y < 0 || y >= H || x < 0 || x >= W) continue;
        if (st[y][x] === 1) have++;
        if (st[y][x] !== 2 && clues[y][x] !== "#") open++;
      }
      numbers.push({ r, c, need: Number(clues[r][c]), have, open });
    }
  }
  return { numbers, solved: numbers.every((n) => n.have === n.need) };
}

/** Every lit-lamp pattern (up to `limit`) that satisfies all the numbers, as rows of "#" and ".". */
export function solve(clues, limit = 2) {
  const H = clues.length;
  const W = clues[0].length;
  const val = Array.from({ length: H }, () => Array(W).fill(-1)); // -1 undecided, 0 dark, 1 lit
  const feasible = (r, c) => {
    for (const [dr, dc] of AROUND) {
      const y = r + dr;
      const x = c + dc;
      if (y < 0 || y >= H || x < 0 || x >= W || clues[y][x] === "." || clues[y][x] === "#") continue;
      let lit = 0;
      let open = 0;
      for (const [er, ec] of AROUND) {
        const v = val[y + er]?.[x + ec];
        if (v === 1) lit++;
        else if (v === -1) open++;
      }
      const need = Number(clues[y][x]);
      if (lit > need || lit + open < need) return false;
    }
    return true;
  };
  const found = [];
  const dfs = (i) => {
    if (found.length >= limit) return;
    if (i === H * W) {
      found.push(val.map((row) => row.map((v) => (v === 1 ? "#" : ".")).join("")));
      return;
    }
    const r = Math.floor(i / W);
    const c = i % W;
    for (const v of clues[r][c] === "#" ? [0] : [0, 1]) {
      val[r][c] = v;
      if (feasible(r, c)) dfs(i + 1);
    }
    val[r][c] = -1;
  };
  dfs(0);
  return found;
}
