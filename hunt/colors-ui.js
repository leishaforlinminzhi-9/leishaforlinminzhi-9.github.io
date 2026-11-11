// The Colours card on the page. Paint chips: a colour on top, a white strip below where its letter goes. Nothing to type with the phone's
// keyboard: tap a chip, then tap its letter on the little keypad underneath (only the letters that can matter); the cursor moves on to
// the next chip, so a word is spelled by tapping its letters one after the other. (A real keyboard works too.) The same colour is always
// the same letter, so giving one chip its letter fills every chip of that colour. A colour whose letter is right turns green; when every
// colour has its letter the chips hop.
import { rows, tokens } from "./colors.js";

const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

function chipHtml(c, t, mode) {
  const swatch = `<i class="cc-swatch" style="background:${esc(c.colors[t.ch])}"></i>`;
  if (mode === "static") return `<div class="cc-chip" style="--k:${t.i}">${swatch}<span class="cc-lab"><b>${t.ch}</b></span></div>`;
  return `<button type="button" class="cc-chip" style="--k:${t.i}" data-i="${t.i}" aria-label="第 ${t.i + 1} 张色卡">${swatch}<span class="cc-lab"><span class="cc-v"></span></span></button>`;
}

const gridHtml = (c, mode) =>
  `<div class="cc">${rows(c.answers[0])
    .map((r) => `<div class="cc-row">${r.map((t) => (t.apostrophe ? `<span class="cc-apos" aria-hidden="true">’</span>` : chipHtml(c, t, mode))).join("")}</div>`)
    .join("")}</div>`;

const COLS = 7;
// only the letters that can matter: the answer's own letters plus a few tempting extras (c.extra), alphabetical, 7 to a row
function keypadHtml(letters) {
  const rowsOf = [];
  for (let k = 0; k < letters.length; k += COLS) rowsOf.push(letters.slice(k, k + COLS));
  const free = COLS - rowsOf[rowsOf.length - 1].length;
  if (free <= 0) rowsOf.push([]);
  const del = `<button type="button" class="cc-key del" data-k="⌫" aria-label="删掉一个" style="grid-column: span ${free > 0 ? Math.min(free, 2) : 2}">⌫</button>`;
  return `<div class="cc-keys" role="group" aria-label="字母">${rowsOf
    .map((row, k) => `<div class="cc-krow">${row.map((L) => `<button type="button" class="cc-key" data-k="${L}">${L}</button>`).join("")}${k === rowsOf.length - 1 ? del : ""}</div>`)
    .join("")}</div>`;
}

/** The finished chips with their letters (for the solved card and the table). */
export function colorsStatic(c) {
  return gridHtml(c, "static");
}

/**
 * Plays the chips inside `root`. hooks.onSolved() is called a moment after the last colour gets its letter.
 * Returns { hint("reveal"), reveal() }: "reveal" gives one more colour its letter.
 */
export function mountColors(root, c, hooks) {
  const word = tokens(c.answers[0]).filter((t) => !t.apostrophe).map((t) => t.ch); // the letter every chip stands for
  const letters = [...new Set([...word, ...(c.extra || [])])].sort();
  root.innerHTML = gridHtml(c, "play") + keypadHtml(letters);
  const grid = root.querySelector(".cc");
  const chips = [...root.querySelectorAll(".cc-chip")];
  const values = chips.map((chip) => chip.querySelector(".cc-v"));
  const guess = {}; // true letter (= colour) -> the letter the player gave that colour
  let sel = 0; // the chip the cursor is on
  let done = false;
  let locked = false;

  const paint = () =>
    chips.forEach((chip, i) => {
      const g = guess[word[i]] || "";
      values[i].textContent = g;
      chip.classList.toggle("ok", g !== "" && g === word[i]);
      chip.classList.toggle("sel", i === sel);
      chip.classList.toggle("same", sel >= 0 && i !== sel && word[i] === word[sel]);
    });
  const refresh = () => {
    if (!done && word.every((L) => guess[L] === L)) {
      done = true;
      sel = -1;
      grid.classList.add("cc-done");
      setTimeout(() => hooks.onSolved?.(), 2300); // long enough to enjoy the hop
    }
    paint();
  };

  const press = (k) => {
    if (done || locked) return;
    if (k === "⌫") {
      if (guess[word[sel]]) guess[word[sel]] = "";
      else if (sel > 0) guess[word[--sel]] = ""; // nothing here: step back and rub out the one before
    } else {
      guess[word[sel]] = k;
      sel = Math.min(sel + 1, word.length - 1); // on to the next chip, so a word is spelled letter by letter
    }
    refresh();
  };

  root.addEventListener("click", (e) => {
    if (done || locked) return;
    const key = e.target.closest(".cc-key");
    if (key) return press(key.dataset.k);
    const chip = e.target.closest(".cc-chip");
    if (chip) {
      sel = Number(chip.dataset.i);
      paint();
    }
  });

  // a real keyboard works as well
  const onKey = (e) => {
    if (!root.isConnected) return document.removeEventListener("keydown", onKey);
    if (done || locked || e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^[a-z]$/i.test(e.key)) { e.preventDefault(); press(e.key.toUpperCase()); }
    else if (e.key === "Backspace") { e.preventDefault(); press("⌫"); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); sel = Math.max(0, sel - 1); paint(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); sel = Math.min(word.length - 1, sel + 1); paint(); }
  };
  document.addEventListener("keydown", onKey);

  paint();
  return {
    // a nudge: give one more colour its letter (a colour that shows up twice first: it is the best foothold)
    hint(kind) {
      if (done || locked || kind !== "reveal") return;
      const times = (L) => word.filter((x) => x === L).length;
      const pending = [...new Set(word)].filter((L) => guess[L] !== L).sort((a, b) => times(b) - times(a) || word.indexOf(a) - word.indexOf(b));
      if (!pending.length) return;
      const L = pending[0];
      guess[L] = L;
      chips.forEach((chip, i) => {
        if (word[i] !== L) return;
        chip.classList.add("flash");
        setTimeout(() => chip.classList.remove("flash"), 1700);
      });
      refresh();
    },
    // give up: every colour gets its letter
    reveal() {
      locked = true;
      done = true;
      sel = -1;
      for (const L of word) guess[L] = L;
      paint();
      grid.classList.add("cc-done");
    },
  };
}
