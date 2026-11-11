// The rules of the door game, with no pictures in them: state in, state out. src/door.js draws it; tools/door_sim.mjs plays it by script.
// The words (rule notes, answers, endings) are in door.mjs; the numbers are here.
//
// Every night a queue of visitors comes to the door. Each is her as a dog or her as a pig, and each is either the real one ("good") or a fake ("bad").
// A fake has one or two flaws ("tells"). Every tool in the doorman's bag can find exactly one kind of flaw, and he only has a few checks per visitor
// (charges), so he has to read the night's note, pick the right tools, and decide: let in or turn away.

export const LIVES = 5;
export const QUESTIONS = 7; // how many questions the intercom knows (door.mjs `questions` must have this many)
export const TOOLS = ["light", "ask", "home", "pat", "shadow", "lens"]; // the bag
export const TELL_OF = { light: "pale", ask: "wrong", home: "athome", pat: "stiff", shadow: "shadow", lens: "mirror" }; // the flaw each tool can find

// tools: what is in the bag tonight; tells: the flaws the fakes may have tonight; perBad: how many each fake has; batch: all the fakes of the night share the same flaws;
// charges: how many checks he has per visitor. (With perBad flaws among tells.length, charges >= tells.length - perBad + 1 means the right checks always find one;
// on a batch night the flaws are the same for everybody, so tells.length <= charges.) The bag has more tools than the night's flaws need: the note says which to use.
const T4 = ["light", "ask", "home", "pat"], T5 = [...T4, "shadow"];
const ALL = (tools) => tools.map((t) => TELL_OF[t]);
// (no hints on the notes: the flaws can be any of the tools' flaws; the checks are plenty so that a careful doorman always finds one)
export const NIGHTS = [
  { count: 4, tools: T4, tells: ALL(T4), perBad: 1, batch: false, charges: 4 },
  { count: 5, tools: T5, tells: ALL(T5), perBad: 1, batch: false, charges: 5 },
  { count: 5, tools: TOOLS, tells: ALL(TOOLS), perBad: 2, batch: false, charges: 5 },
  { count: 6, tools: TOOLS, tells: ALL(TOOLS), perBad: 2, batch: false, charges: 5 },
  { count: 7, tools: TOOLS, tells: ALL(TOOLS), perBad: 2, batch: false, charges: 4 },
];

export function rngFrom(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pickOne = (arr, rng) => arr[Math.floor(rng() * arr.length)];
const shuffle = (arr, rng) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sample = (arr, n, rng) => shuffle(arr, rng).slice(0, n);

/** the visitors of one night */
export function makeQueue(nightIdx, rng, questionCount = QUESTIONS) {
  const N = NIGHTS[nightIdx];
  const bads = Math.max(1, Math.min(N.count - 1, Math.round(N.count * (0.4 + rng() * 0.2))));
  const kinds = shuffle([...Array(N.count)].map((_, i) => i < bads), rng);
  const shared = N.batch ? sample(N.tells, N.perBad, rng) : null;
  return kinds.map((bad, i) => ({
    id: `${nightIdx}-${i}`,
    species: rng() < 0.7 ? "dog" : "pig", // (the dog comes more often than the pig: her ask)
    bad,
    tells: bad ? (shared ?? sample(N.tells, N.perBad, rng)) : [],
    q: Math.floor(rng() * questionCount), // the question the intercom asks first
    variant: Math.floor(rng() * 3), // which of the wordings of a result she gets
    outfit: Math.floor(rng() * 8), // which sweater she wears (door.js: 0 is the navy one of the pictures)
  }));
}

export function newGame(rng = Math.random, startNight = 0) {
  const g = { rng, night: startNight, lives: LIVES, queue: [], i: 0, charges: 0, used: [], phase: "intro", mistakes: 0, nightMistakes: [], stats: { goodIn: 0, badOut: 0, bitten: 0, sad: 0 }, ending: null, askNo: 0 };
  g.queue = makeQueue(g.night, rng);
  return g;
}

export const current = (g) => g.queue[g.i];
export const toolsTonight = (g) => NIGHTS[g.night].tools;

/** the first visitor of the night comes to the door */
export function begin(g) {
  if (g.phase !== "intro") throw new Error("not now");
  g.phase = "door"; g.i = 0; g.charges = NIGHTS[g.night].charges; g.used = []; g.askNo = 0;
}

/** use a tool on the visitor at the door: what it shows (the screen words the result from `anomaly`) */
export function useTool(g, tool) {
  if (g.phase !== "door") throw new Error("not now");
  if (!toolsTonight(g).includes(tool)) throw new Error("not in the bag tonight");
  const v = current(g);
  const again = tool !== "ask" && g.used.includes(tool); // looking again at what a tool already showed is free; every question to the intercom is a new check
  if (again) return { tool, anomaly: v.tells.includes(TELL_OF[tool]), again: true, species: v.species, variant: v.variant };
  if (g.charges <= 0) throw new Error("no charges left");
  g.charges--;
  if (!g.used.includes(tool)) g.used.push(tool);
  const out = { tool, anomaly: v.tells.includes(TELL_OF[tool]), q: v.q, species: v.species, variant: v.variant };
  if (tool === "ask") { out.q = (v.q + g.askNo) % QUESTIONS; g.askNo++; }
  return out;
}

/** let in ("let") or turn away ("refuse") */
export function decide(g, choice) {
  if (g.phase !== "door") throw new Error("not now");
  const v = current(g);
  const wantIn = choice === "let";
  const right = wantIn !== v.bad;
  let outcome;
  if (right) { outcome = wantIn ? "goodIn" : "badOut"; g.stats[outcome]++; }
  else { outcome = wantIn ? "bitten" : "sad"; g.stats[outcome]++; g.lives--; g.mistakes++; g.nightMistakes[g.night] = (g.nightMistakes[g.night] ?? 0) + 1; }
  g.phase = "after";
  g.last = { outcome, species: v.species, bad: v.bad };
  return g.last;
}

/** after the reaction: the next visitor, the end of the night, or the end */
export function next(g) {
  if (g.phase !== "after") throw new Error("not now");
  if (g.lives <= 0) { g.phase = "end"; g.ending = endingFor(g); return g; }
  g.i++;
  if (g.i < g.queue.length) { g.phase = "door"; g.charges = NIGHTS[g.night].charges; g.used = []; g.askNo = 0; return g; }
  if (g.night + 1 >= NIGHTS.length) { g.phase = "end"; g.ending = endingFor(g); return g; }
  g.phase = "morning"; // the night is over
  return g;
}

export function nextNight(g) {
  if (g.phase !== "morning") throw new Error("not now");
  g.night++; g.queue = makeQueue(g.night, g.rng); g.i = 0; g.phase = "intro";
  return g;
}

export const ENDING_IDS = ["perfect", "good", "bitten", "dead"];
export function endingFor(g) {
  if (g.lives <= 0) return "dead";
  if (g.mistakes === 0) return "perfect";
  if (g.lives >= 3) return "good";
  return "bitten";
}
