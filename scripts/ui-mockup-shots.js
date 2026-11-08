// Screenshots of the HUD and UI mockup for review: every screen and variant at phone portrait and desktop, the main
// screens at phone landscape and tablet too, and a long-text (pseudo-Czech) set, into docs/mockups/ui/.
//
//   PORT=5428 bun run dev &                      (the dev server for agents and tools)
//   bun scripts/ui-mockup-shots.js [base-url] [--only=phone,desktop] [--screens=hud,shop]
//
// Loads the page once per device size and switches screens through `__ui.show`, so the 3D backdrop is built once
// per device rather than once per shot. Uses headless Chrome on port 9438 (CDP_PORT overrides) and stops it.

import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SCREENS } from '../src/mockups/ui/screens.js';

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT ?? 9438);
const base = process.argv.find((a) => a.startsWith('http')) ?? 'http://localhost:5428';
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',');
const screensOnly = process.argv.find((a) => a.startsWith('--screens='))?.slice(10).split(',');
const out = 'docs/mockups/ui';

/** Device sizes (CSS px) and pixel ratios. */
const DEVICES = {
  phone: { w: 390, h: 844, dpr: 2 },
  'phone-land': { w: 844, h: 390, dpr: 2 },
  tablet: { w: 1180, h: 820, dpr: 1 },
  desktop: { w: 1440, h: 900, dpr: 1 },
};
/** Screens also shot at phone landscape and tablet (every screen is shot at phone and desktop). */
const MAIN = ['hud', 'alerts', 'animal', 'build', 'shop', 'stats', 'zoopedia', 'photo', 'settings', 'pause'];
/** Screens shot again with long text, at phone and desktop. */
const LONG = ['hud', 'alerts', 'animal', 'shop', 'stats', 'staff', 'levelup', 'settings', 'slots'];

/** Every shot: device, screen, variant, long text, output name. */
const shots = [];
for (const s of SCREENS) {
  if (screensOnly && !screensOnly.includes(s.id)) continue;
  for (const variant of s.variants ?? ['']) {
    const name = variant ? `${s.id}-${variant}` : s.id;
    for (const device of ['phone', 'desktop']) shots.push({ device, screen: s.id, variant, long: false, name: `${name}-${device}` });
    if (MAIN.includes(s.id) && variant === (s.variants?.[0] ?? '')) for (const device of ['phone-land', 'tablet']) shots.push({ device, screen: s.id, variant, long: false, name: `${name}-${device}` });
  }
  if (LONG.includes(s.id)) for (const device of ['phone', 'desktop']) shots.push({ device, screen: s.id, variant: s.variants?.[0] ?? '', long: true, name: `long-${s.id}-${device}` });
}
// The warning icons through colour-vision filters (PRD §19): shapes must still tell them apart.
if (!screensOnly || screensOnly.includes('warnings')) for (const cvd of ['protan', 'deutan', 'tritan', 'gray']) shots.push({ device: 'desktop', screen: 'warnings', variant: '', long: false, cvd, name: `cvd-${cvd}-warnings-desktop` });

mkdirSync(out, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), 'pawprint-chrome-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars', '--no-first-run', 'about:blank']);

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
  const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.result?.value;

  await send('Runtime.enable');
  await send('Page.enable');
  for (const [device, d] of Object.entries(DEVICES)) {
    if (only && !only.includes(device)) continue;
    const list = shots.filter((s) => s.device === device);
    if (!list.length) continue;
    await send('Emulation.setDeviceMetricsOverride', { width: d.w, height: d.h, deviceScaleFactor: d.dpr, mobile: d.dpr > 1 });
    await send('Page.navigate', { url: `${base}/mockups/ui/?ui=0&screen=hud` });
    // Wait for the backdrop (the world scene is built once per load).
    for (let i = 0; i < 120 && !(await evaluate('!!globalThis.__ui')); i++) await Bun.sleep(500);
    for (const s of list) {
      errors.length = 0;
      await evaluate(`__ui.state.long = ${s.long}; __ui.state.cvd = ${JSON.stringify(s.cvd ?? 'none')}; __ui.show(${JSON.stringify(s.screen)}, ${JSON.stringify(s.variant)}); document.activeElement?.blur(); true`);
      await Bun.sleep(900);
      const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 84 });
      const file = `${out}/${s.name}.jpg`;
      await writeFile(file, Buffer.from(shot.result.data, 'base64'));
      console.log(`${file}${errors.length ? `  (page errors: ${errors.join(' | ')})` : ''}`);
    }
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
