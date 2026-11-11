// The rules of the training game, with no pictures in them: state in, state out. src/train.js draws the game; tools/train_sim.mjs plays it
// thousands of times by script to check that the endings are balanced. The words (names, lines, endings) are in train.mjs; the numbers are here.
//
// Four numbers (0 to 100) describe the puppy:
//   obey   听话  how well she follows a command (the thing you are training)
//   mood   心情  a happy puppy tries harder
//   pride  傲气  a proud puppy thinks she does not have to; rewarding bad behaviour and too many treats make it grow
//   temper 脾气  grows when she is punished (and a lot when it is not fair); at 100 she bites
// Every round: a command, then she obeys / half obeys / refuses (depending on the numbers), then you reward or punish, which moves the numbers
// depending on what she just did. A reward after she obeyed teaches her; a reward after she refused makes her cheeky; a punishment after she
// refused teaches her (a little); a punishment after she obeyed is unfair and makes her furious.

export const ROUNDS = 10;
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(v)));
const clamp01 = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// base: the chance that she does it when the numbers are average; mw / ow: how much her mood / obedience count for this one
export const COMMANDS = {
  sit: { base: 0.62 },
  shake: { base: 0.6 },
  come: { base: 0.58 },
  bark: { base: 0.55 },
  spin: { base: 0.48 },
  frisbee: { base: 0.48 },
  wait: { base: 0.38 },
  dead: { base: 0.36 },
  kiss: { base: 0.16, mw: 2.2, ow: 0.7 },
};
const EASY = 0.55; // every round shows at least one command at least this easy

// what a reward / punishment does, depending on what she just did (ok / half / no): [obey, mood, pride, temper]
export const FEEDBACK = {
  pat: { kind: "reward", ok: [5, 8, 1, -3], half: [2, 6, 3, -1], no: [-3, 5, 7, 0] },
  praise: { kind: "reward", ok: [8, 5, 4, -2], half: [3, 4, 5, 0], no: [-4, 4, 9, 0] },
  frisbee: { kind: "reward", ok: [4, 11, 2, -4], half: [1, 9, 4, 0], no: [-3, 8, 8, 0] },
  hug: { kind: "reward", ok: [3, 10, 3, -8], half: [1, 8, 4, -5], no: [-3, 7, 8, -3] },
  treat: { kind: "reward" }, // depends on the treat, see TREATS
  ignore: { kind: "punish", ok: [-4, -8, -2, 6], half: [1, -5, -3, 2], no: [4, -4, -6, 1] },
  no: { kind: "punish", ok: [-6, -10, -3, 10], half: [3, -5, -5, 4], no: [7, -5, -7, 4] },
  flick: { kind: "punish", ok: [-8, -12, -4, 16], half: [4, -8, -7, 8], no: [9, -8, -11, 10] },
  timeout: { kind: "punish", ok: [-9, -14, -5, 18], half: [5, -10, -9, 10], no: [11, -10, -14, 12] },
  confiscate: { kind: "punish", ok: [-7, -14, -3, 17], half: [4, -10, -6, 10], no: [8, -10, -10, 12] },
};
// [mood, obey, pride, tipsy]
export const TREATS = {
  hotpot: [15, 6, 4, 0],
  bbq: [13, 5, 4, 0],
  noodles: [9, 5, 2, 0],
  fastfood: [11, 3, 6, 0],
  beer: [12, -5, 4, 1],
  cocktail: [12, -5, 5, 1],
};

// small helper so that the same game can be replayed from a seed (?seed=7) and the simulation is repeatable
export function rngFrom(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function newGame(rng = Math.random) {
  const g = {
    round: 1, phase: "command", // command -> (her reaction) -> feedback -> (her reaction, events) -> next round
    obey: 25, mood: 60, pride: 30, temper: 0,
    tipsy: false, treatStreak: 0, lastCommands: [],
    bites: 0, rides: 0, kissesOk: 0, nice: 0, punished: 0, treatsGiven: [], history: [],
    offer: [], current: null, // the three commands on offer; what she did this round: { command, outcome }
    done: false, ending: null,
  };
  g.offer = pickOffer(g, rng);
  return g;
}

export function pickOffer(g, rng) {
  const ids = Object.keys(COMMANDS).filter((id) => !g.lastCommands.slice(-2).includes(id));
  const pick = [];
  const easy = ids.filter((id) => COMMANDS[id].base >= EASY);
  const first = easy[Math.floor(rng() * easy.length)];
  pick.push(first);
  while (pick.length < 3) {
    const id = ids[Math.floor(rng() * ids.length)];
    if (!pick.includes(id)) pick.push(id);
  }
  // shuffle
  for (let i = pick.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pick[i], pick[j]] = [pick[j], pick[i]]; }
  return pick;
}

/** the chance that she does what she is told right now */
export function chance(g, id) {
  const c = COMMANDS[id];
  const p = c.base + (g.obey - 30) * 0.006 * (c.ow ?? 1) + (g.mood - 50) * 0.004 * (c.mw ?? 1) - (g.pride - 30) * 0.004 - (g.tipsy ? 0.15 : 0);
  return clamp01(p, 0.03, 0.95);
}

/** the player gives a command: she obeys ("ok"), half obeys ("half") or refuses ("no") */
export function giveCommand(g, id, rng = Math.random) {
  if (g.phase !== "command" || !g.offer.includes(id)) throw new Error("not now");
  const p = chance(g, id);
  const r = rng();
  const outcome = r < p ? "ok" : r < p + (1 - p) * 0.4 ? "half" : "no";
  g.current = { command: id, outcome, chance: p };
  g.lastCommands.push(id);
  if (id === "kiss" && outcome === "ok") g.kissesOk++;
  g.phase = "feedback";
  return g.current;
}

/** the player rewards or punishes (for a treat: pass the treat, e.g. "hotpot"). Returns what happened, for the screen to show. */
export function giveFeedback(g, id, treat = null) {
  if (g.phase !== "feedback") throw new Error("not now");
  const ctx = g.current.outcome;
  const f = FEEDBACK[id];
  let d; // [obey, mood, pride, temper]
  let stuffed = false;
  let tipsyNext = false;
  if (id === "treat") {
    const t = TREATS[treat];
    const [m, o, p, tip] = t;
    stuffed = g.treatStreak >= 2; // the third treat in a row
    if (stuffed) d = [-2, -3, 6, 0];
    else if (ctx === "ok") d = [o + 2, m, p, -2];
    else if (ctx === "half") d = [Math.round(o * 0.4), m - 1, p + 2, 0];
    else d = [-4, m - 2, p + 7, 0];
    tipsyNext = !!tip && !stuffed;
    if (!g.treatsGiven.includes(treat)) g.treatsGiven.push(treat);
    g.treatStreak++;
  } else {
    d = f[ctx];
    g.treatStreak = 0;
  }
  if (f.kind === "punish") g.punished++;
  else if (id !== "treat") g.nice++;
  const before = { obey: g.obey, mood: g.mood, pride: g.pride, temper: g.temper };
  if (d[3] > 0) d = [d[0], d[1], d[2], Math.round(d[3] * (1 + g.temper / 120))]; // a puppy that is already cross gets crosser faster
  g.obey = clamp(g.obey + d[0]);
  g.mood = clamp(g.mood + d[1]);
  g.pride = clamp(g.pride + d[2]);
  g.temper = clamp(g.temper + d[3]);
  g.tipsy = tipsyNext;
  const result = { feedback: id, treat, context: ctx, stuffed, tipsy: tipsyNext, kind: f.kind, delta: { obey: g.obey - before.obey, mood: g.mood - before.mood, pride: g.pride - before.pride, temper: g.temper - before.temper }, events: [] };

  // she calms down a little between rounds
  g.mood = clamp(g.mood + (55 - g.mood) * 0.15);
  g.pride = clamp(g.pride - 2);
  g.temper = clamp(g.temper - 2);

  // when it gets too much
  if (g.temper >= 100 || before.temper + d[3] >= 100) { g.bites++; g.temper = 45; g.obey = clamp(g.obey - 12); g.mood = clamp(g.mood - 10); result.events.push("bite"); }
  if (g.pride >= 100 || before.pride + d[2] >= 100) { g.rides++; g.pride = 55; g.obey = clamp(g.obey - 12); g.mood = clamp(g.mood + 8); result.events.push("ride"); }

  g.history.push({ round: g.round, command: g.current.command, outcome: ctx, feedback: id, treat });
  g.phase = "after";
  return result;
}

/** after the reaction (and the events) are shown: the next round, or the end */
export function nextRound(g, rng = Math.random) {
  if (g.phase !== "after") throw new Error("not now");
  if (g.bites >= 2 || g.round >= ROUNDS) { g.done = true; g.ending = endingFor(g); g.phase = "end"; return g; }
  g.round++;
  g.current = null;
  g.offer = pickOffer(g, rng);
  g.phase = "command";
  return g;
}

export const ENDING_IDS = ["perfect", "good", "spoiled", "tyrant", "slacker", "foodie", "kiss", "strike"];

export function endingFor(g) {
  if (g.bites >= 2) return "strike";
  if (g.kissesOk >= 2 && g.bites === 0 && g.punished <= 2) return "kiss";
  if (g.obey >= 80 && g.temper <= 30 && g.pride <= 45 && g.mood >= 55) return "perfect";
  if (g.obey >= 60 && g.temper <= 50 && g.pride <= 60) return "good";
  if (g.treatsGiven.length >= 5) return "foodie"; // she was fed almost the whole menu and did not learn much
  const spoiled = g.pride >= 60 || g.rides >= 1;
  const tyrant = g.temper >= 55 || g.bites >= 1;
  if (spoiled && tyrant) return g.pride - 0 >= g.temper ? "spoiled" : "tyrant";
  if (spoiled) return "spoiled";
  if (tyrant) return "tyrant";
  return "slacker";
}
