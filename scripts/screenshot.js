// Screenshots of dev pages through headless Chrome (software WebGL), driven over the DevTools protocol.
//
//   bun scripts/screenshot.js <url> <out.png> [<url> <out.png> ...]
//   WIDTH=1600 HEIGHT=1000 WAIT=4000 bun scripts/screenshot.js http://localhost:5427/mockups/body-plans/ shot.png
//   EVAL='__mockup.state' bun scripts/screenshot.js ...   (prints the expression's value, as JSON, before each capture)
//
// Uses debugging port 9438 (CLAUDE.md: the port for agents and tools; CDP_PORT overrides it) and stops the Chrome it
// started.

import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT ?? 9438);
const W = Number(process.env.WIDTH ?? 1600);
const H = Number(process.env.HEIGHT ?? 1000);
const WAIT = Number(process.env.WAIT ?? 4000);
const EVAL = process.env.EVAL;

const pairs = process.argv.slice(2);
if (pairs.length < 2 || pairs.length % 2) {
  console.error('usage: bun scripts/screenshot.js <url> <out.png> [...]');
  process.exit(1);
}

const profile = await mkdtemp(join(tmpdir(), 'pawprint-chrome-'));
const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--hide-scrollbars',
  '--no-first-run',
  `--window-size=${W},${H}`,
  'about:blank',
]);

try {
  const target = await waitForTarget();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
    else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
  });
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      pending.set(++id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  for (let i = 0; i < pairs.length; i += 2) {
    const [url, out] = [pairs[i], pairs[i + 1]];
    errors.length = 0;
    await send('Page.navigate', { url });
    await Bun.sleep(WAIT);
    if (EVAL) {
      const r = await send('Runtime.evaluate', { expression: `JSON.stringify(${EVAL})`, returnByValue: true });
      console.log(`${out} eval: ${r.result.result?.value ?? r.result.exceptionDetails?.text}`);
    }
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(out, Buffer.from(shot.result.data, 'base64'));
    console.log(`${out}${errors.length ? `  (page errors: ${errors.join(' | ')})` : ''}`);
  }
  ws.close();
} finally {
  chrome.kill();
  await rm(profile, { recursive: true, force: true });
}

async function waitForTarget() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page;
    } catch {}
    await Bun.sleep(200);
  }
  throw new Error('Chrome did not start');
}
