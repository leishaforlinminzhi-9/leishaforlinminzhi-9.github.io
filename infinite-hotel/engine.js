// The part of the game both phones must compute the same way: which room comes next, who plays which role, and how the texts read for each person.
// Pure functions (no page, no storage), so tools/sim.mjs can run thousands of rooms through them.
import { ROOMS, ROOMS_SPECIAL } from "./rooms.js";
import { STORY } from "./story.js";
import { PEOPLE, MODS } from "./lib.js";
import { rngFrom, shuffle } from "./rng.js";

export const ALL_ROOMS = [...ROOMS, ...ROOMS_SPECIAL];
export const STORY_LENGTH = STORY.order.length; // the story: six chapters, in this order; after that the 'endless' rooms (the ordinary ones, shuffled, with a rule added each time)

export const otherOf = (w) => (w === "dog" ? "cat" : "dog");
export const nameOf = (w) => PEOPLE[w].name;

export function sceneAt(code, idx) {
  const story = idx < STORY_LENGTH;
  let room, cycle = 0;
  if (story) room = ALL_ROOMS.find((r) => r.id === STORY.order[idx]);
  else {
    const e = idx - STORY_LENGTH, n = ROOMS.length;
    cycle = Math.floor(e / n) + 1; // 1, 2, 3 ... = the first, second ... round of the endless rooms
    const order = shuffle(ROOMS.map((r) => r.id), rngFrom(`${code}|order|${cycle}`));
    room = ROOMS.find((r) => r.id === order[e % n]);
  }
  const r = rngFrom(`${code}|scene|${idx}`);
  const coin = r() < 0.5;
  const dogIsA = room.dogRole ? room.dogRole === "a" : coin; // some rooms have the dog fixed in one role (dogRole: "a" or "b"); the others are drawn from the room number
  const variants = Array.isArray(room.roles) ? room.roles : [room.roles];
  const variant = Math.floor(r() * variants.length);
  const modRoll = Math.floor(r() * MODS.length);
  const mod = story ? null : MODS[modRoll]; // in the endless rooms, the hotel adds a rule
  const heat = story ? STORY.heat[idx] : STORY.endlessHeat; // nobody picks a tier: the story warms up room by room (story.js), and the endless rooms stay at the top
  return { room, idx, story, chapter: story ? idx + 1 : 0, cycle, heat, variant, mod, roles: variants[variant], aWho: dogIsA ? "dog" : "cat", bWho: dogIsA ? "cat" : "dog" };
}
export const keyOf = (sc, who) => (sc.aWho === who ? "a" : "b");
export const pickv = (x, sc) => (Array.isArray(x) ? x[sc.variant] : x);
// {me} {other} of the person who holds the role (role cards, private messages, taboos) …
export const fmtH = (t, holder) => String(t).replace(/\{me\}/g, nameOf(holder)).replace(/\{other\}/g, nameOf(otherOf(holder)));
// … or of the person reading (the hook, the rules, the broadcast); {a} {b} = who plays role a / b
export const fmtV = (t, sc, viewer) => fmtH(t, viewer).replace(/\{a\}/g, nameOf(sc.aWho)).replace(/\{b\}/g, nameOf(sc.bWho));
export const roomRules = (sc, viewer) => [...sc.room.rules.map((t) => fmtV(t, sc, viewer)), ...(sc.mod ? [`加规 · ${sc.mod.name}:${sc.mod.text}`] : [])];
export function actParts(sc, i, who, heat = sc.heat) { // the 'extra' lines of an act appear only when the room's heat is high enough for them (extra.h); the page always passes the room's own heat
  const act = sc.room.acts[i], key = keyOf(sc, who);
  const pub = [fmtV(act.pub, sc, who)], priv = [];
  const mine = pickv(act[key], sc);
  if (mine) priv.push(fmtH(mine, who));
  for (const e of act.extra || []) if (heat >= e.h) { if (e.pub) pub.push(fmtV(e.pub, sc, who)); if (e[key]) priv.push(fmtH(e[key], who)); }
  return { title: act.title, pub, priv };
}
