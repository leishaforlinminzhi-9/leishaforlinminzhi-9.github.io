// Tomorrow's page is locked with a key that only shows up once today's page is finished.
//
// Page N+1 is encrypted (AES-GCM) with a key made from page N's token, and the token sits inside page N's own data. So
// nobody can read ahead by opening the file or the network tab: the next page is just unreadable bytes until the page
// before it has been played to the end. (Someone who really digs through the code could still chain it open; this keeps
// out casual peeking, not a determined developer.)
//
// Works unchanged in Node (build) and in the browser (page); both expose WebCrypto as `crypto.subtle`.
const enc = new TextEncoder();
const dec = new TextDecoder();

const toB64 = (buf) => {
  let s = "";
  for (const byte of new Uint8Array(buf)) s += String.fromCharCode(byte);
  return btoa(s);
};
const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

async function keyFrom(token) {
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(`page|${token}`));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function seal(payload, token) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await keyFrom(token), enc.encode(JSON.stringify(payload)));
  return { iv: toB64(iv), ct: toB64(ct) };
}

/** Returns the page if `token` is the right key, otherwise null. */
export async function open(sealed, token) {
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(sealed.iv) }, await keyFrom(token), fromB64(sealed.ct));
    return JSON.parse(dec.decode(plain));
  } catch {
    return null;
  }
}
