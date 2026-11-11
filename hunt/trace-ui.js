// The Trace card on the page. Every row is a picture clue for a word; tap a block and type the letters with the keyboard.
// The golden line passes through some of the blocks: the letters under it, in the order the arrow runs, are the answer.
// They are echoed at the arrow's tip as you type. A row that holds the right word gets a green tick.
// A right answer in the box underneath is celebrated here: every row fills in, the golden line draws itself again, the blocks it runs
// through hop one after the other and the answer pops at its tip in a burst of confetti.
import { G, layout } from "./trace.js";
import { ICONS } from "./trace-icons.js";

const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

/** The picture itself. `typed` (array of strings, one per row) draws the letters into the blocks; leave it out when inputs sit on top. */
function svgFor(c, typed) {
  const L = layout(c.rows, c.line);
  const rows = c.rows
    .map((r, k) => {
      const t = L.tiles[k];
      const tiles = t.cells.map((cell) => `<rect class="tr-tile" x="${cell.x}" y="${cell.y}" width="${G.bw}" height="${G.bw}" rx="7.5" fill="${esc(r.color)}"/>`).join("");
      const icon = r.img
        ? `<image href="${esc(r.icon)}" x="0" y="${t.top}" width="${G.icon}" height="${G.icon}" preserveAspectRatio="xMidYMid meet"/>`
        : `<svg x="0" y="${t.top}" width="${G.icon}" height="${G.icon}" viewBox="0 0 64 64" aria-hidden="true">${ICONS[r.icon]()}</svg>`;
      return `<g class="tr-row" data-r="${k}">${icon}${tiles}<g class="tr-badge" transform="translate(${G.icon - 4} ${t.top + 5})"><circle r="8.6" fill="#2f9e62" stroke="#fff" stroke-width="2.2"/><path d="M-4.2 .3 L-1.3 3.3 L4.4 -3.3" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></g></g>`;
    })
    .join("");
  // letters are drawn after the line so the golden line runs under them (the typed ones are inputs, which also sit on top)
  const chars = typed ? L.tiles.map((t, k) => t.cells.map((cell, i) => `<text class="tr-ch" x="${cell.cx}" y="${cell.cy + 7.2}" text-anchor="middle">${esc(typed[k][i] ?? "")}</text>`).join("")).join("") : "";
  const letters = c.line.map(([r, i]) => (typed ? typed[r][i] : "·"));
  const out = `<text class="tr-out" x="${(L.tip[0] + 15).toFixed(1)}" y="${(L.tip[1] + 6).toFixed(1)}">${letters.map((ch, n) => `<tspan${n ? ' dx="5"' : ""}>${esc(ch || "·")}</tspan>`).join("")}</text>`;
  return `<svg class="tr-svg" viewBox="0 0 ${L.W} ${L.H}" role="img" aria-label="每行一个图标,是一个英文单词;金线划过的字母是答案">${rows}<path class="tr-halo" pathLength="1" d="${L.d}"/><path class="tr-line" pathLength="1" d="${L.d}"/><path class="tr-arrow" d="${L.arrow}"/>${chars}${out}</svg>`;
}

/** The finished puzzle, words filled in (for the solved card and the small card on the table). */
export function traceStatic(c) {
  return `<div class="tr-wrap tr-static">${svgFor(c, c.rows.map((r) => r.word))}</div>`;
}

/**
 * Plays the puzzle inside `root`. Returns { hint("fill"), reveal() }: "fill" writes one more word into its blocks for you.
 * Nothing here decides that the card is solved: the answer is typed in the box below, like any other card.
 */
export function mountTrace(root, c) {
  const L = layout(c.rows, c.line);
  const pct = (v, of) => `${((v / of) * 100).toFixed(3)}%`;
  const inputs = c.rows
    .map((r, k) => L.tiles[k].cells.map((cell, i) => `<input class="tr-in" type="text" data-r="${k}" data-i="${i}" style="left:${pct(cell.x, L.W)};top:${pct(cell.y, L.H)};width:${pct(G.bw, L.W)};height:${pct(G.bw, L.H)}" inputmode="text" enterkeyhint="next" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" lang="en" aria-label="第 ${k + 1} 行,第 ${i + 1} 个字母">`).join(""))
    .join("");
  root.innerHTML = `<div class="tr-wrap">${svgFor(c)}<div class="tr-inputs">${inputs}</div></div>`;
  const wrap = root.querySelector(".tr-wrap");
  const cells = c.rows.map((_, k) => [...root.querySelectorAll(`.tr-in[data-r="${k}"]`)]);
  const rowEl = (k) => root.querySelector(`.tr-row[data-r="${k}"]`);
  const tags = [...root.querySelectorAll(".tr-out tspan")];
  const typed = (k) => cells[k].map((el) => el.value).join("");
  let flash = 0;
  let locked = false;

  const fit = () => wrap.style.setProperty("--fs", `${((wrap.clientWidth / L.W) * 21).toFixed(2)}px`);
  fit();
  if (typeof ResizeObserver === "function") new ResizeObserver(fit).observe(wrap);

  const refresh = () => {
    let all = true;
    c.rows.forEach((r, k) => {
      const ok = typed(k) === r.word;
      rowEl(k).classList.toggle("ok", ok);
      if (!ok) all = false;
    });
    c.line.forEach(([r, i], n) => { tags[n].textContent = cells[r][i].value || "·"; });
    wrap.classList.toggle("all", all);
  };

  // one letter per block. Whatever was typed lands here and the cursor moves on; a whole word (pasted, or typed fast) spreads
  // over the blocks that follow
  const take = (el, text) => {
    const letters = (text.match(/[A-Za-z]/g) || []).map((ch) => ch.toUpperCase());
    const row = cells[Number(el.dataset.r)];
    let i = Number(el.dataset.i);
    if (!letters.length) {
      el.value = "";
      refresh();
      return;
    }
    for (const ch of letters) if (row[i]) row[i++].value = ch;
    refresh();
    (row[i] ?? row[row.length - 1]).focus();
  };
  const go = (el, dr, di) => {
    const r = Number(el.dataset.r);
    const i = Number(el.dataset.i);
    let target = null;
    if (dr === 0) target = cells[r][i + di];
    else {
      const row = cells[r + dr];
      if (!row) return;
      // the block of the next row that sits closest to this one on the page
      const x = L.tiles[r].cells[i].cx;
      target = row.reduce((best, cand, n) => (Math.abs(L.tiles[r + dr].cells[n].cx - x) < Math.abs(L.tiles[r + dr].cells[Number(best.dataset.i)].cx - x) ? cand : best), row[0]);
    }
    target?.focus();
  };

  cells.flat().forEach((el) => {
    el.addEventListener("focus", () => el.select());
    el.addEventListener("input", (e) => { if (!e.isComposing) take(el, e.data ?? el.value); });
    el.addEventListener("compositionend", (e) => take(el, e.data || el.value));
    el.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !el.value) {
        const r = Number(el.dataset.r);
        const prev = cells[r][Number(el.dataset.i) - 1];
        if (prev) { e.preventDefault(); prev.value = ""; prev.focus(); refresh(); }
      } else if (e.key === "ArrowLeft") { e.preventDefault(); go(el, 0, -1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); go(el, 0, 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); go(el, -1, 0); }
      else if (e.key === "ArrowDown" || e.key === "Enter") { e.preventDefault(); go(el, 1, 0); }
    });
  });

  const fill = (k) => {
    cells[k].forEach((el, i) => { el.value = c.rows[k].word[i]; });
    rowEl(k).classList.add("flash");
    clearTimeout(flash);
    flash = setTimeout(() => root.querySelectorAll(".tr-row.flash").forEach((g) => g.classList.remove("flash")), 1600);
    refresh();
  };

  // a burst of little colours (and a few hearts) from the answer at the arrow's tip
  const confetti = () => {
    const layer = document.createElement("div");
    layer.className = "tr-fx";
    const colours = ["#e6a96d", "#cc7e68", "#8fb1d6", "#6dc1b9", "#c9a2d8", "#e4c46a", "#efa9c4", "#a6d298"];
    layer.style.left = pct(L.tip[0] + 38, L.W);
    layer.style.top = pct(L.tip[1], L.H);
    for (let n = 0; n < 26; n++) {
      const a = Math.random() * Math.PI * 2;
      const d = 50 + Math.random() * 90;
      const heart = n % 5 === 0;
      const i = document.createElement("i");
      if (heart) i.textContent = "♥";
      i.style.cssText = `--dx:${(Math.cos(a) * d).toFixed(0)}px;--dy:${(Math.sin(a) * d * 0.8 - 30).toFixed(0)}px;--r:${Math.round(Math.random() * 540 - 270)}deg;--c:${heart ? "#e4366f" : colours[n % colours.length]};animation-delay:${(Math.random() * 0.25).toFixed(2)}s`;
      layer.appendChild(i);
    }
    wrap.appendChild(layer);
    setTimeout(() => layer.remove(), 2000);
  };

  return {
    // a nudge: write the next word that is not right yet into its blocks
    hint(kind) {
      if (locked || kind !== "fill") return;
      const k = c.rows.findIndex((r, n) => typed(n) !== r.word);
      if (k >= 0) fill(k);
    },
    // a right answer: the rows that are not filled in yet fill in one after the other, then the golden line is drawn again and the blocks
    // it runs through hop; returns how long all that takes (ms), so the card waits for it
    celebrate() {
      locked = true;
      cells.flat().forEach((el) => { el.readOnly = true; el.blur(); });
      let t = 0;
      c.rows.forEach((r, k) => {
        if (typed(k) === r.word) return;
        setTimeout(() => fill(k), t);
        t += 240;
      });
      setTimeout(() => {
        c.line.forEach(([r, i], n) => {
          for (const el of [rowEl(r).querySelectorAll(".tr-tile")[i], cells[r][i]]) {
            el.classList.add("on-line");
            el.style.setProperty("--n", n);
          }
        });
        wrap.classList.add("win");
      }, t + 100);
      setTimeout(confetti, t + 100 + 900);
      return t + 100 + 1900;
    },
    // give up: write every word
    reveal() {
      locked = true;
      c.rows.forEach((_, k) => fill(k));
      cells.flat().forEach((el) => { el.readOnly = true; el.blur(); });
    },
  };
}
