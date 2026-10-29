// Dev helpers (src/debug.js) must be absent from the production bundle. The second build proves the check can fail.

import { describe, expect, test } from 'bun:test';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function bundleText(define) {
  const dir = await mkdtemp(join(tmpdir(), 'pawprint-build-'));
  try {
    const result = await Bun.build({ entrypoints: ['./src/index.html'], outdir: dir, minify: true, define });
    expect(result.success).toBe(true);
    let text = '';
    for (const f of await readdir(dir, { recursive: true })) if (f.endsWith('.js')) text += await readFile(join(dir, f), 'utf8');
    return text;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('production bundle', () => {
  test('has no dev helpers', async () => {
    expect(await bundleText({ __DEV__: 'false' })).not.toContain('pawprint-dev-helpers');
  }, 30000);

  test('a dev bundle does have them (so the check above is not vacuous)', async () => {
    expect(await bundleText({ __DEV__: 'true' })).toContain('pawprint-dev-helpers');
  }, 30000);
});
