// 无限入住:页面和规则。开局只点一下『我是小狗/小猫』,然后一切按剧本走:没有房号、没有档位、没有抽签(两部手机用同一个种子,算出同一间客房,engine.js);
// 每部手机只显示自己的角色和对方的戒律。不联网、不需要服务器;进度存在这部手机的浏览器里(localStorage)。?ns=a / ?ns=b:同一台电脑上开两个标签页当两部手机;?speed=20:时间快 20 倍。
import { PEOPLE, TIERS, HOUSE_RULES, PUN, FALSE_PUN, DESK } from "./lib.js";
import { checkCode } from "./rng.js";
import { sceneAt, keyOf, pickv, otherOf, nameOf, fmtH, fmtV, roomRules, actParts as actPartsOf, STORY_LENGTH } from "./engine.js";
import { STORY } from "./story.js";

const q = new URLSearchParams(location.search);
const NS = q.get("ns") || "";
const SPEED = Math.max(1, Number(q.get("speed")) || 1);
const KEY = "ih3" + (NS ? ":" + NS : "");
const $ = (s, e = document) => e.querySelector(s);
const app = $("#app");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clock = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

// ── state (this phone only) ────────────────────────────────────────────────────────────────────
const SEED = "无限入住"; // the one seed both phones draw from (what used to be the typed room number): the story is a fixed script, so there is nothing for the two of them to agree on
const fresh = () => ({ v: 4, phase: "lobby", me: "", idx: 0, book: [], play: null, settle: null, finale: null, done: false, sound: true, ruled: false, used: {} });
let S = (() => { try { const s = { ...fresh(), ...JSON.parse(localStorage.getItem(KEY) || "{}"), v: 4 }; delete s.code; delete s.tier; return s; } catch { return fresh(); } })(); // (an older save carries a room number and a tier: dropped, the progress stays)
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* a private window: the game works without it */ } };

// ── the room both phones agree on (engine.js) ──────────────────────────────────────────────────
let sceneCache = null;
const scene = () => (sceneCache && sceneCache.idx === S.idx ? sceneCache.sc : (sceneCache = { idx: S.idx, sc: sceneAt(SEED, S.idx) }).sc);
const tierName = (n) => TIERS[n - 1].name;
const actParts = (sc, i, who) => actPartsOf(sc, i, who, sc.heat); // the room's own heat decides which extra lines appear
const roomMs = (sc) => sc.room.mins * 60 * 1000;
const para = (t) => esc(t).split(/\n\n+/).map((x) => `<p>${x.replace(/\n/g, "<br>")}</p>`).join("");
const chapOf = (sc) => (sc.story ? STORY.chapters[sc.room.id] : null);
const teethCount = () => S.book.filter((b) => b.tooth).length;

// ── sound, toast, sheet ────────────────────────────────────────────────────────────────────────
let ac = null;
function tone(freq, dur, type = "sine", vol = 0.1, when = 0) {
  if (!S.sound) return;
  try {
    ac ||= new (window.AudioContext || window.webkitAudioContext)();
    const t = ac.currentTime + when, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.05);
  } catch { /* no sound: fine */ }
}
const chime = () => { tone(880, 0.6, "sine", 0.1); tone(1320, 0.8, "sine", 0.07, 0.16); try { navigator.vibrate?.([60, 40, 60]); } catch { /* */ } };
const buzz = () => { tone(150, 0.35, "sawtooth", 0.07); tone(112, 0.5, "sawtooth", 0.07, 0.12); try { navigator.vibrate?.([120]); } catch { /* */ } };
let toastTimer = 0;
function toast(html, ms = 5000) { const t = $("#toast"); t.innerHTML = html; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), ms); }
function sheet(html) { const s = $("#sheet"); s.innerHTML = `<div class="sheet"><button class="x" data-do="close" aria-label="关闭">✕</button>${html}</div>`; s.hidden = false; s.firstElementChild.scrollTop = 0; }
function closeSheet() { $("#sheet").hidden = true; $("#sheet").innerHTML = ""; clearTimeout(peekTimer); stopTk(); }
$("#sheet").addEventListener("click", (e) => { if (e.target === e.currentTarget) closeSheet(); });

// a secret: tap to look, it hides itself again
let peekTimer = 0;
const veil = (inner, secs = 12) => `<div class="veil" data-do="peek" data-arg="${secs}"><div class="in">${inner}</div><div class="hint"><div>轻点查看<br><small>${secs} 秒后自动遮住</small></div></div></div>`;

// ── screens ────────────────────────────────────────────────────────────────────────────────────
const mini = () => `<div class="mini"><div class="t">无限入住</div><div class="pts">${PEOPLE[S.me].icon} ${nameOf(S.me)} · ${S.idx < STORY_LENGTH ? `🗝️ ${teethCount()} / ${STORY_LENGTH}` : `已住 ${S.book.length} 间`}</div></div>`;
let briefTab = "rules";

function render() {
  window.scrollTo(0, 0);
  ({ lobby: viewLobby, desk: viewDesk, brief: viewBrief, play: viewPlay, settle: viewSettle, finale: viewFinale }[S.phase] || viewLobby)();
  keepAwake(S.phase === "play" && !!S.play?.run);
}

// While a room runs the phones lie on the bed and nobody touches them for minutes: a phone that locks itself would miss the next act (and its chime).
// So the screen stays on during the play (and only then). Not allowed, or an old browser: nothing breaks, the clock still keeps the right time.
let wake = null;
async function keepAwake(on) {
  try {
    if (on && !wake && navigator.wakeLock) { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => { wake = null; }); }
    else if (!on && wake) { const w = wake; wake = null; await w.release(); }
  } catch { wake = null; }
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") keepAwake(S.phase === "play" && !!S.play?.run); }); // (the browser lets go of it when the page is hidden)

function viewLobby() {
  app.innerHTML = `<div class="wrap">
    <div class="sign"><div class="neon">无限入住</div><div class="vacancy"><span>NO</span> VACANCY</div></div>
    <p class="tag">欢迎入住。本酒店共有无限间客房。</p>
    <div class="card">
      <span class="lab center">这部手机是谁的?</span>
      <div class="who2">${["dog", "cat"].map((w) => `<button data-do="who" data-arg="${w}" class="${S.me === w ? "on" : ""}"><img src="${PEOPLE[w].img}" alt=""><b>${PEOPLE[w].name}</b><small>${w === "dog" ? "今晚的前台" : "今晚的客人"}</small></button>`).join("")}</div>
      <p class="muted center mt">两个人各用一部手机,各点一个。点完,故事就开始了。</p>
    </div>
    <p class="center"><a href="#" data-do="how">怎么玩?</a></p>
  </div>`;
}

const keyRow = () => `<div class="keyrow" style="--n:${STORY.order.length}">${STORY.order.map((id, i) => { const b = S.book.find((x) => x.id === id); return `<i class="${b ? "on" : i === S.idx ? "now" : ""}" title="${b ? esc(b.tooth) : ""}">${b ? esc([...b.tooth][0]) : i + 1}</i>`; }).join("")}</div>`;

function viewDesk() {
  const sc = scene(), me = S.me, ch = chapOf(sc);
  const live = S.play && S.play.idx === S.idx;
  app.innerHTML = `<div class="wrap">
    ${mini()}
    ${sc.story ? keyRow() : ""}
    ${ch ? `<div class="call"><span>下一间房</span>${para(ch.prelude)}</div>` : `<div class="call"><span>下一间房</span>${para(STORY.endless)}</div>`}
    <div class="keycard">
      <div class="no">${esc(sc.room.no)}</div>
      <div class="ttl">${esc(sc.room.title)}</div>
      <div class="hk">${esc(fmtV(sc.room.hook, sc, me))}</div>
      <div class="chips"><span class="chip">${sc.story ? `第 ${sc.chapter} 章` : `无限模式 · 第 ${S.idx - STORY_LENGTH + 1} 间`} · 验 ${checkCode(`${SEED}|${S.idx}|${sc.room.id}`)}</span><span class="chip heat">温度 · ${tierName(sc.heat)}</span>${sc.room.tags.map((t) => `<span class="chip">${esc(t)}</span>`).join("")}<span class="chip">约 ${sc.room.mins} 分钟</span>${sc.mod ? `<span class="chip">加规 · ${esc(sc.mod.name)}</span>` : ""}</div>
    </div>
    <button class="btn big" data-do="enter">${live ? "回到房间" : "刷卡入住"}</button>
    <div class="dock">
      <button data-do="how"><span>❓</span>怎么玩</button>
      <button data-do="book"><span>📖</span>值班日记</button>
      <button data-do="settings"><span>⚙️</span>设置</button>
    </div>
  </div>`;
}

const roleCard = (sc, who, mine) => {
  const o = sc.roles[keyOf(sc, who)];
  if (mine) {
    return `<div class="paper"><h3>${o.icon} ${esc(fmtH(o.name, who))}</h3>
      <div class="kv"><b>身份</b><div>${esc(fmtH(o.who, who))}</div></div>
      <div class="kv"><b>说话方式</b><div>${esc(fmtH(o.voice, who))}</div></div>
      <div class="kv red"><b>秘密 · 只有你知道</b><div>${esc(fmtH(o.secret, who))}</div></div>
      <div class="kv"><b>目标</b>${o.goals.map((g, i) => `<div class="goal"><i>${i ? "支线" : "主线"}</i><span>${esc(fmtH(g, who))}</span></div>`).join("")}</div>
      <div class="kv red"><b>戒律 · 对方会盯着你</b><ul>${o.taboos.map((t) => `<li>${esc(fmtH(t, who))}</li>`).join("")}</ul></div>
    </div>`;
  }
  return `<div class="paper"><h3>${o.icon} ${esc(fmtH(o.name, who))}</h3>
    <div class="kv"><b>说话方式 · 用来判断有没有出戏</b><div>${esc(fmtH(o.voice, who))}</div></div>
    <div class="kv red"><b>对方的戒律 · 你来盯</b><ul>${o.taboos.map((t) => `<li>${esc(fmtH(t, who))}</li>`).join("")}</ul></div>
    <p class="muted mt">对方的秘密和目标,你不知道。你可以猜。<br>看到对方违反了戒律,或者出戏了,就点『举报』。</p>
  </div>`;
};

function viewBrief() {
  const sc = scene(), me = S.me, you = otherOf(me);
  const tabs = [["rules", "房间须知"], ["mine", "我的角色"], ["watch", "监督清单"]];
  let body;
  if (briefTab === "mine") body = `<p class="muted mb">看的时候,让对方转过身,或者把屏幕朝向自己。</p>${veil(roleCard(sc, me, true), 20)}`;
  else if (briefTab === "watch") body = `<p class="muted mb">这是你要盯着的东西。对方看不到这一页。</p>${veil(roleCard(sc, you, false), 20)}`;
  else body = `<div class="paper"><h3>${esc(sc.room.no)} · ${esc(sc.room.title)}</h3>
      <p class="mt">${esc(fmtV(sc.room.hook, sc, me))}</p>
      <div class="kv"><b>30 秒布置</b><div>${esc(fmtV(sc.room.setup, sc, me))}</div></div>
      <div class="kv red"><b>入住须知 · 两个人都要守</b><ol>${roomRules(sc, me).map((t) => `<li>${esc(t)}</li>`).join("")}</ol></div>
      <div class="kv"><b>怎么演</b><div>每个人有身份、秘密、目标和戒律。秘密只有自己知道;戒律对方也看得到,对方负责盯着。每一幕会有广播,有的幕还有只给你一个人的私信。这一间的温度:${tierName(sc.heat)}。(故事一间一间往上升温,不用选。)</div></div>
    </div>`;
  app.innerHTML = `<div class="wrap">
    ${mini()}
    <div class="seg tabs mb">${tabs.map(([k, n]) => `<button data-do="tab" data-arg="${k}" class="${briefTab === k ? "on" : ""}">${n}</button>`).join("")}</div>
    ${body}
    <button class="btn big mt2" data-do="ready">我准备好了 · 开演</button>
    <p class="muted center mt">两个人一起按。倒数 3 秒,计时开始。</p>
    <button class="btn ghost sm mt" data-do="leave">回大堂</button>
  </div>`;
}

// ── the play ───────────────────────────────────────────────────────────────────────────────────
const elapsed = () => (S.play ? S.play.acc + (S.play.run ? (Date.now() - S.play.t0) * SPEED : 0) : 0);
const actIdx = (sc, ms) => { let k = 0; sc.room.acts.forEach((a, i) => { if (a.t * 1000 <= ms) k = i; }); return k; };

function viewPlay() {
  const sc = scene(), me = S.me, p = S.play, i = Math.max(0, p.act);
  const part = actParts(sc, i, me);
  app.innerHTML = `<div class="wrap">
    <div class="hud"><span class="plate">${esc(sc.room.no)}</span><b class="grow">${esc(sc.room.title)}</b><span class="clock" id="clock">0:00</span></div>
    <div class="bar"><i id="bar"></i></div>
    <p class="muted center" style="margin:8px 0 0">你是 ${sc.roles[keyOf(sc, me)].icon} ${esc(fmtH(sc.roles[keyOf(sc, me)].name, me))} · 对方是 ${sc.roles[keyOf(sc, otherOf(me))].icon} ${esc(fmtH(sc.roles[keyOf(sc, otherOf(me))].name, otherOf(me)))}</p>
    <div class="dots">${sc.room.acts.map((_, k) => `<i class="${k === i ? "on" : k < i ? "past" : ""}"></i>`).join("")}</div>
    <div class="paper bc"><h3>${esc(part.title)}</h3>${part.pub.map((t, k) => `<p class="${k ? "line" : ""}">${esc(t)}</p>`).join("")}</div>
    ${part.priv.length ? `<div class="msg"><span class="new">私信 · 只有你看得到</span>${veil(part.priv.map((t) => `<p>${esc(t)}</p>`).join(""), 15)}</div>` : ""}
    <div class="row"><button class="btn ghost grow" data-do="myrole">我的角色</button><button class="btn ghost grow" data-do="watch">监督清单</button></div>
    <button class="btn danger report" data-do="report">举报!</button>
    <div class="row"><button class="btn ghost sm grow" data-do="selfc">自首</button><button class="btn ghost sm grow" data-do="${p.run ? "pause" : "resume"}">${p.run ? "暂停" : "继续"}</button></div>
    <div class="row mt"><button class="btn ghost sm grow" data-do="nextAct">下一幕</button><button class="btn ghost sm grow" data-do="end">结束本局</button></div>
    <p class="muted center mt" id="overtime" ${elapsed() >= roomMs(sc) ? "" : "hidden"}>时间到了。可以收尾,也可以点『结束本局』看结局。</p>
  </div>`;
  tick();
}

function tick() {
  if (S.phase !== "play" || !S.play) return;
  const sc = scene(), ms = elapsed(), total = roomMs(sc);
  const c = $("#clock"); if (c) c.textContent = clock(ms);
  const b = $("#bar"); if (b) b.style.width = `${Math.min(100, (ms / total) * 100)}%`;
  const o = $("#overtime"); if (o) o.hidden = ms < total;
  if (S.play.run) {
    const k = actIdx(sc, ms);
    if (k > S.play.act) onAct(k);
    if (ms >= total && !S.play.over) { S.play.over = true; save(); chime(); toast("<b>时间到了:</b>该收尾了。"); }
  }
}
setInterval(tick, 500);

function onAct(k) {
  S.play.act = k; save(); chime();
  const sc = scene();
  toast(`<b>${pick(DESK.act)}</b>\n${esc(sc.room.acts[k].title)}`, 4500);
  if (S.phase === "play") viewPlay(); // (a ticket that is open stays open: the new act is under it)
}

function beginPlay() {
  S.play.started = true; S.play.acc = 0; S.play.t0 = Date.now(); S.play.run = true; S.play.act = 0;
  S.phase = "play"; save(); chime(); render();
}
function startCount() {
  const c = $("#count"); let n = 3;
  c.hidden = false; c.textContent = n; tone(660, 0.2);
  const t = setInterval(() => {
    n--;
    if (n > 0) { c.textContent = n; tone(660, 0.2); }
    else { clearInterval(t); c.hidden = true; tone(990, 0.5); beginPlay(); }
  }, 1000);
}

// ── tickets: one tap on 举报 (or 自首) and the ticket is there ──────────────────────────────────
function drawPun(tier) {
  const list = PUN[tier], used = (S.used[tier] ||= []);
  let ids = list.map((_, i) => i).filter((i) => !used.includes(i));
  if (!ids.length) { S.used[tier] = []; ids = list.map((_, i) => i); }
  const i = pick(ids); S.used[tier].push(i); save();
  return list[i];
}
function ticketTier(sc, light) { // the more tickets in this room, the heavier, in order from the gentlest (never above the heat of this room, which rises room by room)
  let t = Math.min(sc.heat, 1 + S.play.made);
  if (Math.random() < 0.3) t = Math.min(sc.heat, t + 1);
  if (sc.mod?.tierPlus) t = Math.min(sc.heat, t + sc.mod.tierPlus);
  return Math.max(1, light ? t - 1 : t);
}
let tk = null, tkTimer = 0;
const stopTk = () => { clearInterval(tkTimer); tkTimer = 0; };

function makeTicket(selfMode) {
  const sc = scene(), tier = ticketTier(sc, selfMode);
  tk = { selfMode, tier, pun: drawPun(tier), n: S.play.tickets + 1, state: "open", swapped: false };
  buzz(); showTicket();
}
function showTicket() {
  const target = tk.selfMode ? S.me : otherOf(S.me);
  const void_ = tk.state === "void";
  sheet(`<div class="ticket ${void_ ? "void" : ""}">${void_ ? `<div class="stamp">作废</div>` : ""}<span class="no">TICKET No.${tk.n}</span><h3>罚 单</h3>
      <div class="kv"><b>被罚的人</b><div>${PEOPLE[target].icon} ${nameOf(target)}${tk.selfMode ? "(自首,从轻)" : ""}</div></div>
      <div class="perf"></div>
      <div class="kv"><b>赔偿方式</b> <span class="tier">${tierName(tk.tier)}</span><div class="pun">${esc(tk.pun.t)}</div></div>
      ${tk.pun.s ? `<div class="timer" id="tkclock">${clock(tk.pun.s * 1000)}</div>` : ""}
      <p class="muted mt">${esc(pick(tk.selfMode ? DESK.self : DESK.ticket))}</p>
    </div>
    ${void_ ? `<button class="btn big" data-do="close">好</button>` : `
    <button class="btn big" data-do="ticketDone">执行完毕 ✓</button>
    <div class="row mt">${tk.pun.s ? `<button class="btn ghost grow" data-do="tkGo">计时</button>` : ""}<button class="btn ghost grow" data-do="swap" ${tk.swapped ? "disabled" : ""}>换一张</button>${tk.selfMode ? "" : `<button class="btn ghost grow" data-do="appeal">申诉 ✋</button>`}</div>`}`);
}

// ── the end of a room ──────────────────────────────────────────────────────────────────────────
function startSettle() {
  S.settle = { step: 0, main: true, oMain: true, said: false }; // the ending starts as the happy one; the two of them only touch it if it did not go that way
  S.phase = "settle"; save(); render();
}
const endKeyOf = (sc, me, st) => {
  const mk = keyOf(sc, me), mainA = mk === "a" ? st.main : st.oMain, mainB = mk === "b" ? st.main : st.oMain;
  return mainA && mainB ? "both" : mainA ? "a" : mainB ? "b" : "none";
};

function viewSettle() {
  const sc = scene(), me = S.me, you = otherOf(me), st = S.settle, ch = chapOf(sc);
  const mo = sc.roles[keyOf(sc, me)], oo = sc.roles[keyOf(sc, you)];
  const steps = ch ? 3 : 2;
  let body = "";
  if (st.step === 0) {
    body = `<div class="paper"><h3>真相</h3><p class="mt">${esc(fmtV(pickv(sc.room.reveal, sc), sc, me))}</p>
      <div class="kv red"><b>${PEOPLE[you].icon} ${nameOf(you)} 的秘密</b><div>${esc(fmtH(oo.secret, you))}</div></div>
      <div class="kv"><b>${nameOf(you)} 的目标</b>${oo.goals.map((g, i) => `<div class="goal"><i>${i ? "支线" : "主线"}</i><span>${esc(fmtH(g, you))}</span></div>`).join("")}</div>
      <div class="kv"><b>${PEOPLE[me].icon} 你的目标</b>${mo.goals.map((g, i) => `<div class="goal"><i>${i ? "支线" : "主线"}</i><span>${esc(fmtH(g, me))}</span></div>`).join("")}</div>
    </div><button class="btn big mt2" data-do="step" data-arg="1">下一步</button>`;
  } else if (st.step === 1) { // the ending, and (only if it went otherwise) the two toggles under it: no question to answer first
    const tg = (key, label, on) => `<button class="toggle ${on ? "on" : ""}" data-do="tog" data-arg="${key}"><span class="box">${on ? "✓" : ""}</span><span>${esc(label)}</span></button>`;
    st.fin ||= pick(DESK.final);
    body = `<div class="paper"><h3>结局</h3><p class="mt">${esc(fmtV(sc.room.endings[endKeyOf(sc, me, st)], sc, me))}</p></div>
      <p class="muted mt mb">上面是两个人都完成了主线的结局。要是真实发生的不一样,点一下改过来:</p>
      ${tg("main", `我完成了:${fmtH(mo.goals[0], me)}`, st.main)}
      ${tg("oMain", `对方完成了:${fmtH(oo.goals[0], you)}`, st.oMain)}
      ${ch ? `<button class="btn big mt2" data-do="step" data-arg="2">长出一枚钥匙齿</button>` : `<p class="muted center mt">${esc(st.fin)}</p><button class="btn big mt2" data-do="finish">记入值班日记,回大堂</button>`}`;
  } else {
    body = `<div class="tooth"><div class="muted">第 ${sc.chapter} 枚钥匙齿</div><div class="phrase">『${esc(ch.tooth)}』</div>
        <p>说出口,它才会长出来。<br>请两个人面对面,认真地,对对方说一遍。</p>
        <p class="ask">${esc(ch.ask)}</p></div>
      ${st.said ? `<div class="diary">${para(ch.diary)}</div>
      <button class="btn big mt2" data-do="finish">${sc.chapter === STORY_LENGTH ? "钥匙齐了" : "把这一页收进日记,回大堂"}</button>` : `<button class="btn big mt2" data-do="said">说完了 · 看值班日记</button>`}`;
  }
  app.innerHTML = `<div class="wrap">${mini()}<div class="dots">${Array.from({ length: steps }, (_, k) => `<i class="${k === st.step ? "on" : k < st.step ? "past" : ""}"></i>`).join("")}</div>${body}</div>`;
}

// ── the finale: the key, the last page of the diary, the door ──────────────────────────────────
function viewFinale() {
  const f = S.finale, page = STORY.finale[f.step];
  let body;
  if (f.step >= STORY.finale.length) {
    body = `<div class="night"><p>${esc(STORY.night.t).replace(/\n/g, "<br>")}</p><small>${esc(STORY.night.sub)}</small></div>
      <button class="btn big mt2" data-do="endless">再住一晚(无限模式)</button>`;
  } else {
    body = `<div class="paper finale"><h3>${esc(page.h)}</h3>${para(page.t)}${page.teeth ? `<ol class="teeth">${STORY.order.map((id, i) => `<li><b>${i % 2 ? PEOPLE.cat.icon : PEOPLE.dog.icon}</b>${esc(STORY.chapters[id].tooth)}</li>`).join("")}</ol>` : ""}</div>
      <button class="btn big mt2" data-do="fin">${page.button || "读完了"}</button>`;
  }
  app.innerHTML = `<div class="wrap${f.step >= STORY.finale.length ? " dark" : ""}">${f.step >= STORY.finale.length ? "" : mini()}${body}</div>`;
}

// ── sheets: book, settings, how ────────────────────────────────────────────────────────────────
function bookSheet() {
  const chapters = S.book.filter((b) => b.tooth);
  sheet(`<h2>值班日记</h2><p class="muted mb">六枚钥匙齿,六页日记。拿到哪一枚,就多一页。${S.book.length - chapters.length ? `(无限模式住过 ${S.book.length - chapters.length} 间。)` : ""}</p>
    ${S.book.length ? S.book.slice().reverse().map((b) => b.tooth
      ? `<div class="card"><b>第 ${b.ch} 章 · ${esc(b.no)} ${esc(b.title)}</b> <span class="chip">『${esc(b.tooth)}』</span><div class="diary mt">${para(b.diary)}</div></div>`
      : `<div class="card"><b>${esc(b.no)} · ${esc(b.title)}</b><p class="muted mt">${esc(b.ending)}</p></div>`).join("") : `<p class="muted">还没有。去刷第一张房卡吧。</p>`}`);
}
function settingsSheet() {
  sheet(`<h2>设置</h2>
    <button class="pick" data-do="snd">声音和震动:<b>${S.sound ? "开" : "关"}</b><small>换幕、罚单的时候会响。半夜在酒店,可以关掉。</small></button>
    <span class="grp">章节对不上?</span><div class="row"><button class="btn ghost sm grow" data-do="skip" data-arg="-1">上一章</button><button class="btn ghost sm grow" data-do="skip" data-arg="1">下一章</button></div>
    <p class="muted mt">两部手机显示的『验』不一样,是因为一个人多翻了一章:一起调到一样。</p>
    <span class="grp">序章</span><button class="pick" data-do="prologue" data-arg="0">再看一遍序章</button>
    <span class="grp">身份</span><button class="pick" data-do="rewho">点错了?重新选小狗 / 小猫<small>回到第一页重新点一次,进度不丢。</small></button>
    <span class="grp">危险区</span><button class="pick" data-do="reset">清空这部手机上的所有进度<small>钥匙齿和值班日记全部删除。</small></button>`);
}
function howSheet() {
  sheet(`<h2>怎么玩</h2><div class="paper mt"><ol>
    <li>这是一个故事:六间房 = 六章。每一章结束,长出一枚<b>钥匙齿</b>(一句话),小狗的值班日记多写一页。六枚齐了,故事的真相就会被讲清楚。</li>
    <li>两个人各用自己的手机打开这一页,一个点<b>小狗</b>,一个点<b>小猫</b>。点完,故事就开始了:没有要选的,一切按剧本走。故事一间一间<b>越来越大胆</b>:温柔 → 搞怪 → 暧昧 → 大胆。</li>
    <li>每一间房是一出两个人的小戏:有身份、秘密、目标,还有『戒律』。<b>秘密只有自己知道;戒律对方也看得到,对方负责盯着你。</b>手机里的秘密和监督清单,点一下才显示。</li>
    <li>两个人一起按『开演』。每一幕会有旁白广播,有的幕还有只给你一个人的私信。</li>
    <li>看到对方违反戒律、出戏、违反房规:点<b>举报</b>,对方立刻领罚单,当场执行。一间房里被举报得越多,罚单越重(从轻到重,但不超过这一间的温度)。对方不服可以申诉(石头剪刀布),申诉赢了罚单作废,举报人领诬告反坐。自己发现违规,可以<b>自首</b>,从轻。</li>
    <li>结束后揭晓真相,看结局,然后两个人面对面,把这一章长出来的那句话,认真地说给对方听。</li>
    <li>任何时候说『<b>暂停</b>』,一切立刻停止,罚单换下一张。</li></ol></div>`);
}

// ── actions ────────────────────────────────────────────────────────────────────────────────────
const A = {
  who(w) { // the only thing asked before the story: whose phone this is. One tap and it begins (the prologue the first time)
    if (S.me && S.me !== w) { S.play = null; S.settle = null; sceneCache = null; } // (chose again, the other way: whatever room was running restarts)
    S.me = w; S.phase = "desk"; save(); render();
    if (!S.ruled) { S.ruled = true; save(); prologue(0); }
  },
  how() { howSheet(); },
  prologue(n) { prologue(Number(n)); },
  pro(n) { prologue(Number(n)); },
  enter() {
    if (!S.play || S.play.idx !== S.idx) S.play = { idx: S.idx, started: false, acc: 0, t0: 0, run: false, act: -1, made: 0, tickets: 0, over: false };
    S.phase = S.play.started ? "play" : "brief"; briefTab = "rules"; save(); render();
  },
  skip(d) { closeSheet(); S.idx = Math.max(0, S.idx + Number(d)); S.play = null; sceneCache = null; save(); render(); },
  leave() { S.phase = "desk"; save(); render(); },
  tab(k) { briefTab = k; viewBrief(); },
  peek(secs, el) {
    el.classList.toggle("open");
    clearTimeout(peekTimer);
    if (el.classList.contains("open")) peekTimer = setTimeout(() => el.classList.remove("open"), Number(secs) * 1000);
  },
  ready() { startCount(); },
  pause() { S.play.acc = elapsed(); S.play.run = false; save(); viewPlay(); keepAwake(false); },
  resume() { S.play.t0 = Date.now(); S.play.run = true; save(); viewPlay(); keepAwake(true); },
  nextAct() {
    const sc = scene(), k = Math.min(sc.room.acts.length - 1, S.play.act + 1);
    if (k === S.play.act) { toast("<b>提示:</b>已经是最后一幕了。"); return; }
    S.play.acc = sc.room.acts[k].t * 1000; S.play.t0 = Date.now(); save(); onAct(k);
  },
  end() { sheet(`<h2>结束本局?</h2><p class="muted mb">现在去看真相和结局。</p><button class="btn big" data-do="endOk">去看结局</button><button class="btn ghost mt" data-do="close">再演一会儿</button>`); },
  endOk() { closeSheet(); startSettle(); },
  myrole() { const sc = scene(); sheet(`<h2>我的角色</h2><p class="muted mb">12 秒后自动遮住。</p>${veil(roleCard(sc, S.me, true), 12)}`); },
  watch() { const sc = scene(); sheet(`<h2>监督清单</h2><p class="muted mb">12 秒后自动遮住。</p>${veil(roleCard(sc, otherOf(S.me), false), 12)}`); },
  report() { makeTicket(false); },
  selfc() { makeTicket(true); },
  tkGo() {
    stopTk(); let left = tk.pun.s;
    const c = () => { const e = $("#tkclock"); if (e) e.textContent = clock(left * 1000); };
    c(); tkTimer = setInterval(() => { left--; c(); if (left <= 0) { stopTk(); chime(); } }, 1000);
  },
  swap() { stopTk(); tk.pun = drawPun(tk.tier); tk.swapped = true; showTicket(); },
  ticketDone() {
    stopTk(); S.play.tickets++;
    if (!tk.selfMode) S.play.made++;
    save(); closeSheet(); viewPlay();
  },
  appeal() {
    stopTk();
    sheet(`<h2>申诉</h2><p class="muted mb">被举报的人和举报人,石头剪刀布,一局定胜负。</p>
      <button class="pick" data-do="appealWin"><b>被举报的人赢了</b><small>罚单作废,举报人领诬告反坐。</small></button>
      <button class="pick" data-do="appealLose"><b>举报人赢了</b><small>罚单照旧。</small></button>
      <button class="pick" data-do="appealDraw"><b>平局</b><small>再来一局。</small></button>`);
  },
  appealWin() {
    tk.state = "void"; S.play.tickets++; save();
    const p = FALSE_PUN[Math.floor(Math.random() * FALSE_PUN.length)];
    buzz();
    sheet(`<div class="ticket"><span class="no">反坐单</span><h3>诬告反坐</h3><div class="kv"><b>被罚的人</b><div>${PEOPLE[S.me].icon} ${nameOf(S.me)}(举报人)</div></div><div class="perf"></div><div class="kv"><b>赔偿方式</b><div class="pun">${esc(p.t)}</div></div><p class="muted mt">${esc(pick(DESK.voided))}</p></div><button class="btn big" data-do="close">执行完毕 ✓</button>`);
    viewPlay();
  },
  appealLose() { showTicket(); },
  appealDraw() { A.appeal(); },
  close() { closeSheet(); },
  book() { bookSheet(); },
  settings() { settingsSheet(); },
  snd() { S.sound = !S.sound; save(); settingsSheet(); },
  rewho() { closeSheet(); S.phase = "lobby"; save(); render(); },
  reset() { sheet(`<h2>真的要清空吗?</h2><p class="muted mb">这部手机上的钥匙齿和值班日记会全部删除。</p><button class="btn danger big" data-do="resetOk">清空</button><button class="btn ghost mt" data-do="close">算了</button>`); },
  resetOk() { S = fresh(); sceneCache = null; save(); closeSheet(); render(); },
  step(n) { S.settle.step = Number(n); save(); viewSettle(); window.scrollTo(0, 0); },
  said() { S.settle.said = true; chime(); save(); viewSettle(); },
  tog(k) { S.settle[k] = !S.settle[k]; save(); viewSettle(); },
  finish() {
    const sc = scene(), me = S.me, ch = chapOf(sc);
    S.book.push({ idx: S.idx, id: sc.room.id, no: sc.room.no, title: sc.room.title, ending: fmtV(sc.room.endings[endKeyOf(sc, me, S.settle)], sc, me), ...(ch ? { ch: sc.chapter, tooth: ch.tooth, diary: ch.diary } : {}) });
    S.idx += 1; S.play = null; S.settle = null; sceneCache = null;
    if (ch && sc.chapter === STORY_LENGTH) { S.phase = "finale"; S.finale = { step: 0 }; } else S.phase = "desk";
    save(); render();
  },
  fin() { S.finale.step += 1; save(); if (S.finale.step >= STORY.finale.length) chime(); viewFinale(); window.scrollTo(0, 0); },
  endless() { S.done = true; S.finale = null; S.phase = "desk"; save(); render(); },
};
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-do]");
  if (!t) return;
  const fn = A[t.dataset.do];
  if (fn) { e.preventDefault(); fn(t.dataset.arg, t, e); }
});

function prologue(n) {
  const page = STORY.prologue[n];
  if (!page) { houseRules(); return; }
  sheet(`<div class="paper finale"><h3>序章 · ${esc(page.h)}</h3>${para(page.t)}</div>
    <button class="btn big mt" data-do="pro" data-arg="${n + 1}">${n + 1 < STORY.prologue.length ? "继续" : "办理入住手续"}</button>
    ${n === 0 ? `<button class="btn ghost sm mt" data-do="pro" data-arg="${STORY.prologue.length}">跳过序章</button>` : ""}`);
}
function houseRules() {
  sheet(`<h2>入住须知</h2><div class="paper mt"><ol>${HOUSE_RULES.map((t) => `<li>${esc(t)}</li>`).join("")}</ol></div><button class="btn big mt" data-do="close">我已阅读,并且同意</button>`);
}

window.__ih = { get S() { return S; }, scene, A, elapsed, beginPlay }; // (for the tests: tools/play.mjs)
render();
