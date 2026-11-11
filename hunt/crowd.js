// "Crowd": a big crowd of little people, some with their arms up and some with their arms down. Close up it is only a crowd; stepping back,
// the people with their arms up make the letters of the answer. (Say, the raised arms of a crowd spell HELLO.)
//
//   word:   the answer, letters only                 "HELLO"
//   noise:  how many of the other people raise their arms too, 0 to 0.4 (default 0.12): the more, the harder to read
//   seed:   any text; the same seed gives the same crowd every time
//
// Only helpers here (no page needed), so the build can check a card with them.

// a 5 x 7 pixel font, one string per row
const FONT = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".###."],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
};

export const LETTER_W = 5;
export const LETTER_H = 7;
const GAP = 2; // empty columns between two letters
const SIDE = 4; // empty columns left and right of the letters
const TOP = 3; // empty rows above and below

/** The crowd as { rows: ["....#..", ...], spans: [[firstColumn, lastColumn], ...] }: "#" is a person who belongs to a letter. */
export function mask(word) {
  const w = String(word).toUpperCase();
  const cols = SIDE * 2 + w.length * LETTER_W + (w.length - 1) * GAP;
  const rows = Array.from({ length: TOP * 2 + LETTER_H }, () => Array(cols).fill("."));
  const spans = [];
  [...w].forEach((ch, k) => {
    const c0 = SIDE + k * (LETTER_W + GAP);
    spans.push([c0, c0 + LETTER_W - 1]);
    FONT[ch].forEach((line, r) => [...line].forEach((px, c) => { if (px === "#") rows[TOP + r][c0 + c] = "#"; }));
  });
  return { rows: rows.map((r) => r.join("")), spans };
}

export const hasLetter = (ch) => ch.toUpperCase() in FONT;

// ── a small seeded random generator (the same seed, the same crowd) ─────────────────────────────────────────────
function hash(text) {
  let h = 2166136261;
  for (const ch of String(text)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}
function rng(seed) {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// soft colours, the same family as the other cards
export const SHIRTS = ["#a6d298", "#9980bc", "#c27263", "#e6a96d", "#efa9c4", "#988c53", "#8fb1d6", "#6dc1b9", "#dec1b1"];
export const SKINS = ["#f3d6c2", "#ebc2a3", "#dba886", "#bf8a68", "#92603f"];
export const HAIRS = ["#6b4630", "#8a5a3c", "#a56a3c", "#c9a06b", "#5a4034", "#b88a5e"]; // no black: the dark arms of the raised hands must stand out

/**
 * Everybody in the crowd: { r, c, x, y, s (size), shirt, skin, hair, up (arms up), letter (index of the letter they belong to, or -1) }.
 * People of a letter always have their arms up; of the rest, a share of `noise` has them up too.
 */
export function people(crowd) {
  const rand = rng(crowd.seed);
  const out = [];
  crowd.rows.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      const inLetter = ch === "#";
      const letter = inLetter ? crowd.spans.findIndex(([a, b]) => c >= a && c <= b) : -1;
      out.push({
        r,
        c,
        dx: (rand() - 0.5) * 3, // a little out of line, so it looks like people and not like pixels
        dy: (rand() - 0.5) * 4,
        s: 0.92 + rand() * 0.14,
        shirt: SHIRTS[Math.floor(rand() * SHIRTS.length)],
        skin: SKINS[Math.floor(rand() * SKINS.length)],
        hair: HAIRS[Math.floor(rand() * HAIRS.length)],
        delay: rand() * 1.4,
        up: inLetter || rand() < crowd.noise,
        letter,
      });
    }),
  );
  return out;
}
