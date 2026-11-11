// Typed answers are compared after this clean-up, so "Land", " land ", "ＬＡＮＤ" and "l-a-n-d" are the same answer.
export function norm(text) {
  return String(text ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

// The first real character of a text (skips quotes and punctuation). Pages can hide a message in their first characters.
export function firstChar(text) {
  return [...String(text ?? "").normalize("NFKC")].find((ch) => /[\p{L}\p{N}]/u.test(ch)) ?? "";
}
