// Both phones must build the same room from the same hotel room number, so everything "random" that both must agree on comes from here (a seeded generator).
export function hash(str) {
  let h = 2166136261 >>> 0;
  for (const ch of String(str)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const rngFrom = (text) => mulberry32(hash(text));
export function shuffle(list, rnd) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
// a short code both phones show, to see at a glance that they agree (no 0/O/1/I)
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function checkCode(text) {
  const h = hash(text);
  return ALPHA[h % ALPHA.length] + ALPHA[Math.floor(h / ALPHA.length) % ALPHA.length];
}
