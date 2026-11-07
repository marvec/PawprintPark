// Screenshots of the world mockup for review: every view at High and Low, into docs/mockups/world/.
//
//   PORT=5428 bun run dev &                      (the dev server for agents and tools)
//   bun scripts/world-mockup-shots.js [base-url] [--only=name,name]
//
// Takes a while: headless Chrome renders WebGL in software.

import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const base = process.argv.find((a) => a.startsWith('http')) ?? 'http://localhost:5428';
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',');
const out = 'docs/mockups/world';

/** name → URL parameters. */
const VIEWS = {
  overview: 'focus=overview',
  grid: 'focus=start&grid=1&zoom=0.6',
  start: 'focus=start',
  'biome-farmyard': 'biome=farmyard',
  'biome-african-savanna': 'biome=african-savanna',
  'biome-asian-jungle': 'biome=asian-jungle',
  'biome-polar': 'biome=polar',
  'biome-coast': 'biome=coast',
  'biome-wetland': 'biome=wetland',
  'biome-reptile-house': 'biome=reptile-house',
  'biome-reptile-house-roof': 'biome=reptile-house&roofs=1',
  'biome-aviary': 'biome=aviary',
  sizes: 'focus=sizes',
  'fence-wear': 'focus=wear',
  upgrades: 'focus=upgrades&zoom=1.3',
  equipment: 'focus=equipment',
  keeper: 'focus=keeper',
  dawn: 'focus=biomes&time=dawn',
  dusk: 'focus=biomes&time=dusk',
  night: 'focus=biomes&time=night',
  'night-start': 'focus=start&time=night',
  rain: 'focus=biomes&weather=rain',
  snow: 'focus=biomes&weather=snow',
  heat: 'focus=biomes&weather=heat',
};

mkdirSync(out, { recursive: true });
const pairs = [];
for (const [name, query] of Object.entries(VIEWS)) {
  if (only && !only.includes(name)) continue;
  for (const q of ['high', 'low']) pairs.push(`${base}/mockups/world/?${query}&quality=${q}&still=1&ui=0`, `${out}/${name}-${q}.jpg`);
}
const r = spawnSync('bun', ['scripts/screenshot.js', ...pairs], {
  stdio: 'inherit',
  env: { WIDTH: '1280', HEIGHT: '800', WAIT: '9000', ...process.env },
});
process.exit(r.status ?? 1);
