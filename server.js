// Dev server: Bun bundles each HTML entry on the fly with hot reload; everything else comes from public/.
//
//   bun run dev                  → http://localhost:5427
//   PORT=5428 bun run dev        → the extra port for agents and tools (CLAUDE.md)

import { file } from 'bun';
import { join, normalize } from 'node:path';
import game from './src/index.html';
import bodyPlans from './src/mockups/body-plans.html';
import singleMesh from './src/mockups/single-mesh.html';

const port = Number(process.env.PORT) || 5427;
const publicDir = join(import.meta.dir, 'public');

const server = Bun.serve({
  port,
  development: { hmr: true, console: true },
  routes: {
    '/': game,
    '/mockups/body-plans/': bodyPlans,
    '/mockups/single-mesh/': singleMesh,
  },
  async fetch(req) {
    const path = decodeURIComponent(new URL(req.url).pathname);
    if (path.includes('..')) return new Response('Bad path', { status: 400 });
    let target = normalize(join(publicDir, path));
    if (path.endsWith('/')) target = join(target, 'index.html');
    const f = file(target);
    if (await f.exists()) return new Response(f);
    return new Response('Not found', { status: 404 });
  },
});

console.log(`Pawprint Park dev server: ${server.url}`);
console.log(`Body-plan mockup:         ${server.url}mockups/body-plans/`);
console.log(`Single-mesh experiment:   ${server.url}mockups/single-mesh/`);
