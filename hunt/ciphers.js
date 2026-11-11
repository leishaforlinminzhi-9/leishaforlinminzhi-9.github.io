// The little ciphers behind the clue cards. The build uses the encoders to turn a plain word into what the card shows;
// the page uses the tables (and shiftChar) for the helper that opens up after a hint.

export const MORSE = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....", I: "..", J: ".---", K: "-.-", L: ".-..", M: "--",
  N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.", S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-", Y: "-.--", Z: "--..",
};

// old phone keypad: press a key once for its first letter, twice for the second...
export const T9 = {
  A: "2", B: "22", C: "222", D: "3", E: "33", F: "333", G: "4", H: "44", I: "444", J: "5", K: "55", L: "555", M: "6",
  N: "66", O: "666", P: "7", Q: "77", R: "777", S: "7777", T: "8", U: "88", V: "888", W: "9", X: "99", Y: "999", Z: "9999",
};

// piano keys of one octave, white keys only
export const SOLFEGE = { do: "C", re: "D", mi: "E", fa: "F", so: "G", la: "A", ti: "B" };
export const KEYS = ["C", "D", "E", "F", "G", "A", "B"];

export const LETTERS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];

// "UNDER PILLOW" -> [["U","N","D","E","R"], ["P","I","L","L","O","W"]]  (one row per word, letters only)
export const words = (text) =>
  String(text ?? "")
    .toUpperCase()
    .split(/\s+/)
    .map((w) => [...w].filter((c) => c >= "A" && c <= "Z"))
    .filter((w) => w.length);

export const shiftChar = (ch, by) => String.fromCharCode((((ch.charCodeAt(0) - 65 + by) % 26) + 26) % 26 + 65);

export const encode = {
  morse: (text) => words(text).map((w) => w.map((c) => MORSE[c])),
  numbers: (text) => words(text).map((w) => w.map((c) => String(c.charCodeAt(0) - 64).padStart(2, "0"))),
  caesar: (text, shift) => words(text).map((w) => w.map((c) => shiftChar(c, shift))),
  atbash: (text) => words(text).map((w) => w.map((c) => String.fromCharCode(155 - c.charCodeAt(0)))), // A<->Z, B<->Y ...
  t9: (text) => words(text).map((w) => w.map((c) => T9[c])),
};
