// Serves dist/ as GitHub Pages would: http://localhost:4427 (run `bun run build` first).

import { file } from 'bun';
import { join, normalize } from 'node:path';

const port = Number(process.env.PORT) || 4427;
const root = join(import.meta.dir, '..', 'dist');

const server = Bun.serve({
  port,
  async fetch(req) {
    const path = decodeURIComponent(new URL(req.url).pathname);
    if (path.includes('..')) return new Response('Bad path', { status: 400 });
    let target = normalize(join(root, path));
    if (path.endsWith('/')) target = join(target, 'index.html');
    const f = file(target);
    if (await f.exists()) return new Response(f);
    return new Response('Not found', { status: 404 });
  },
});

console.log(`Preview of dist/: ${server.url}`);
