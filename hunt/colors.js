// "Colours": a wordless puzzle in the spirit of the colour puzzles of 鱼谜. Every letter of the answer is a paint chip of its own
// colour and the same letter is always the same colour. The card itself says nothing (no key, no example): it is a cryptogram, solved
// from the shape of the word (repeated colours, the apostrophe, the sentence the cards have spelled so far) and from the hints.
//
//   word:    the answer as written, an apostrophe is fine          "WORLD'S"
//   colors:  { W: "#2e9e55", ... }                                 one #rrggbb for every distinct letter of the word
//
// Only helpers here (no page needed), so the build can check a puzzle with them.

export const PER_ROW = 6;

/** The answer as tokens: letters become chips (numbered from 0), an apostrophe stays a mark between them. */
export function tokens(word) {
  let n = 0;
  return [...String(word).toUpperCase()]
    .filter((ch) => (ch >= "A" && ch <= "Z") || ch === "'" || ch === "’")
    .map((ch) => (ch === "'" || ch === "’" ? { apostrophe: true } : { ch, i: n++ }));
}

/** The tokens laid out in rows of PER_ROW. */
export function rows(word) {
  const t = tokens(word);
  const out = [];
  for (let k = 0; k < t.length; k += PER_ROW) out.push(t.slice(k, k + PER_ROW));
  return out;
}

const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

/** CIE Lab of a #rrggbb colour. */
export function lab(hex) {
  const [r, g, b] = [1, 3, 5].map((k) => lin(parseInt(hex.slice(k, k + 2), 16) / 255));
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/** How different two colours look (CIE76): under about 25 two chips can be taken for the same colour. */
export const deltaE = (a, b) => Math.hypot(...lab(a).map((v, k) => v - lab(b)[k]));
