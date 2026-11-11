// Akari ("Light Up"): the rules, a checker for the page, and a solver for the build.
//
// A grid is an array of equal-length strings:
//   "."        a white cell
//   "#"        a black cell
//   "0".."4"   a black cell that must touch exactly that many bulbs (up, down, left, right)
// A bulb lights its whole row and column, up to the next black cell. Every white cell must end up lit, and no bulb may
// sit in another bulb's light.

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const isBlack = (ch) => ch === "#" || (ch >= "0" && ch <= "4");

/** What a set of bulbs ([row, col] pairs) does on this grid. */
export function analyze(grid, bulbs) {
  const H = grid.length;
  const W = grid[0].length;
  const lit = Array.from({ length: H }, () => Array(W).fill(false));
  const bulbAt = Array.from({ length: H }, () => Array(W).fill(false));
  for (const [r, c] of bulbs) bulbAt[r][c] = true;

  const clash = new Set(); // bulbs that sit in another bulb's light
  for (const [r, c] of bulbs) {
    lit[r][c] = true;
    for (const [dr, dc] of DIRS) {
      for (let y = r + dr, x = c + dc; y >= 0 && y < H && x >= 0 && x < W && !isBlack(grid[y][x]); y += dr, x += dc) {
        lit[y][x] = true;
        if (bulbAt[y][x]) clash.add(`${r},${c}`);
      }
    }
  }

  const numbers = [];
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const ch = grid[r][c];
      if (ch < "0" || ch > "4") continue;
      let have = 0;
      for (const [dr, dc] of DIRS) if (bulbAt[r + dr]?.[c + dc]) have++;
      numbers.push({ r, c, need: Number(ch), have });
    }
  }

  let allLit = true;
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (!isBlack(grid[r][c]) && !lit[r][c]) allLit = false;
  const solved = allLit && clash.size === 0 && numbers.every((n) => n.have === n.need);
  return { lit, clash, numbers, solved };
}

/** All solutions (up to `limit`) as lists of [row, col]. A well-made puzzle has exactly one. */
export function solve(grid, limit = 2) {
  const H = grid.length;
  const W = grid[0].length;
  const id = (r, c) => r * W + c;
  const white = [];
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (!isBlack(grid[r][c])) white.push(id(r, c));

  // the cells a bulb on `i` can see (same row or column, no black cell in between)
  const sees = new Map();
  for (const i of white) {
    const r = Math.floor(i / W);
    const c = i % W;
    const list = [];
    for (const [dr, dc] of DIRS) {
      for (let y = r + dr, x = c + dc; y >= 0 && y < H && x >= 0 && x < W && !isBlack(grid[y][x]); y += dr, x += dc) list.push(id(y, x));
    }
    sees.set(i, list);
  }
  const clues = [];
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      if (grid[r][c] < "0" || grid[r][c] > "4") continue;
      const cells = DIRS.map(([dr, dc]) => [r + dr, c + dc]).filter(([y, x]) => y >= 0 && y < H && x >= 0 && x < W && !isBlack(grid[y][x])).map(([y, x]) => id(y, x));
      clues.push({ cells, need: Number(grid[r][c]) });
    }
  }

  const state = new Map(white.map((i) => [i, 0])); // 0 undecided, 1 bulb, -1 no bulb
  const found = [];

  const possible = () => {
    for (const { cells, need } of clues) {
      let bulbs = 0;
      let open = 0;
      for (const i of cells) {
        const s = state.get(i);
        if (s === 1) bulbs++;
        else if (s === 0) open++;
      }
      if (bulbs > need || bulbs + open < need) return false;
    }
    for (const i of white) {
      if (state.get(i) === 1) continue; // a bulb is lit by itself
      let lit = false;
      let canStillLight = state.get(i) === 0; // a bulb could still go on the cell itself
      for (const j of sees.get(i)) {
        const s = state.get(j);
        if (s === 1) { lit = true; break; }
        if (s === 0) canStillLight = true;
      }
      if (!lit && !canStillLight) return false; // dark, and nothing left that could light it
    }
    return true;
  };

  const dfs = (k) => {
    if (found.length >= limit) return;
    if (k === white.length) {
      found.push(white.filter((i) => state.get(i) === 1).map((i) => [Math.floor(i / W), i % W]));
      return;
    }
    const i = white[k];
    // bulb here (only if no bulb already sees it)
    if (!sees.get(i).some((j) => state.get(j) === 1)) {
      state.set(i, 1);
      if (possible()) dfs(k + 1);
    }
    state.set(i, -1);
    if (possible()) dfs(k + 1);
    state.set(i, 0);
  };
  dfs(0);
  return found;
}
