// Screenshots of 小狗跳进照片 in headless Chrome (?test clock). Adapted from the trailer recorder: drives headless Chrome over the DevTools protocol, steps the film clock one frame at a time and saves each frame.
//   node rec.mjs probe '<js>'          load, run the js (an async expression), print the result, save probe.jpg
//   node rec.mjs shots 4.5,12,30       render from 0 up to each time, save shot-<t>.jpg (no other frames saved)
//   node rec.mjs frames [from] [to]    save every frame (30 fps) into frames/ as 00000.jpg …
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.env.OUT || new URL('../test/shots', import.meta.url).pathname;
const URL0 = process.env.URL0 || 'http://127.0.0.1:4414/?test';
const FPS = 30, PORT = 9300 + Math.floor(Math.random() * 500);
mkdirSync(OUT, { recursive: true });
const prof = join(OUT, 'chrome-' + PORT);
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, '--window-size=390,844', '--force-device-scale-factor=2',
  '--hide-scrollbars', '--mute-audio', '--no-first-run', '--no-default-browser-check', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
const quit = () => { try { chrome.kill('SIGKILL'); } catch {} try { rmSync(prof, { recursive: true, force: true }); } catch {} };
process.on('exit', quit);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let ver = null;
for (let i = 0; i < 100 && !ver; i++) { await wait(150); try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch {} }
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let nid = 1; const pend = new Map(), logs = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) { const { res, rej } = pend.get(m.id); pend.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); }
  else if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.type + ': ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
  else if (m.method === 'Runtime.exceptionThrown') logs.push('EXC: ' + JSON.stringify(m.params.exceptionDetails).slice(0, 600));
});
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const id = nid++; pend.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, sessionId })); });
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const S = (m, p) => send(m, p, sessionId);
await S('Runtime.enable'); await S('Page.enable');
await S('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await S('Page.navigate', { url: URL0 });
const ev = async (expr) => { const r = await S('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 800)); return r.result.value; };
const shot = async (file, q = 92) => { const { data } = await S('Page.captureScreenshot', { format: 'jpeg', quality: q }); writeFileSync(file, Buffer.from(data, 'base64')); };
let ok = false;
for (let i = 0; i < 100 && !ok; i++) { await wait(150); try { ok = await ev('!!window.__game'); } catch {} }
// steps: "js expression" or "@name" = save a screenshot
const steps = JSON.parse(process.argv[2]); const t0 = Date.now();
for (const st of steps) { if (st.startsWith('@')) await shot(join(OUT, st.slice(1) + '.jpg'), 85); else { const r = await ev(st); if (r !== undefined) console.log(st.slice(0, 40), '=>', JSON.stringify(r)); } }
console.log('done in', ((Date.now() - t0) / 1000).toFixed(1), 's');
if (logs.length) console.log(logs.slice(-30).join('\n'));
quit(); process.exit(0);
