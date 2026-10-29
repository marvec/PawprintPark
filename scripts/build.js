// Website build: src/index.html → dist/, plus public/ copied as-is.
// Mockup pages are dev-only and are not part of the build.

import { cp, rm } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: ['./src/index.html'],
  outdir: './dist',
  minify: true,
  sourcemap: 'linked',
  define: { __DEV__: 'false' },
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

await cp('public', 'dist', { recursive: true });
console.log(`Built ${result.outputs.length} files into dist/`);
