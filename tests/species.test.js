import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { parseSpeciesMd } from '../scripts/species-from-md.js';
import { SPECIES } from '../src/data/species.js';
import { LOOKS, V1_PLANS } from '../src/scene/animals/looks.js';

const md = readFileSync(new URL('../docs/species.md', import.meta.url), 'utf8');

describe('species catalogue', () => {
  test('src/data/species.js matches docs/species.md (run scripts/species-from-md.js after editing the doc)', () => {
    expect(SPECIES).toEqual(parseSpeciesMd(md));
  });

  test('the doc header states the real totals', () => {
    expect(md).toContain(`Total: **${SPECIES.length} species**`);
  });

  test('ids are unique and every species has a biome, plan and tier', () => {
    expect(new Set(SPECIES.map((s) => s.id)).size).toBe(SPECIES.length);
    for (const s of SPECIES) {
      expect(s.biome).toBeTruthy();
      expect(s.plan).toBeTruthy();
      expect(s.tier).toBeGreaterThanOrEqual(1);
      expect(s.tier).toBeLessThanOrEqual(8);
    }
  });

  test('30 species are v1, and v1 uses exactly the 12 v1 body plans', () => {
    const v1 = SPECIES.filter((s) => s.v1);
    expect(v1.length).toBe(30);
    expect(new Set(v1.map((s) => s.plan))).toEqual(new Set(V1_PLANS));
  });

  test('every v1 species has a look, and every look belongs to a v1 species with the same plan', () => {
    const v1 = Object.fromEntries(SPECIES.filter((s) => s.v1).map((s) => [s.id, s]));
    for (const id of Object.keys(v1)) expect(LOOKS[id]).toBeDefined();
    for (const [id, look] of Object.entries(LOOKS)) {
      expect(v1[id]).toBeDefined();
      expect(look.plan).toBe(v1[id].plan);
    }
  });
});
