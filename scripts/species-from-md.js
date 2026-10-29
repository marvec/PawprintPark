// Regenerates src/data/species.js from docs/species.md (the planning list is the source of truth).
//
//   bun scripts/species-from-md.js
//
// tests/species.test.js fails when the two drift apart.

import { readFileSync, writeFileSync } from 'node:fs';

const md = readFileSync(new URL('../docs/species.md', import.meta.url), 'utf8');

const biomeIds = {
  'Farmyard': 'farmyard',
  'Temperate Forest': 'temperate-forest',
  'African Savanna': 'african-savanna',
  'Desert & Dry Plains': 'desert',
  'Asian Jungle': 'asian-jungle',
  'Tropical Rainforest': 'tropical-rainforest',
  'Wetland & Rivers': 'wetland',
  'Polar & Tundra': 'polar',
  'Mountain': 'mountain',
  'Australian Outback': 'outback',
  'Coast & Sea': 'coast',
  'Aquarium': 'aquarium',
  'Reptile & Amphibian House': 'reptile-house',
  'Aviary': 'aviary',
  'Nocturnal House': 'nocturnal-house',
  'Bug House': 'bug-house',
};

export const slug = (name) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Parses docs/species.md into catalogue entries. */
export function parseSpeciesMd(text) {
  const out = [];
  let biome = null;
  for (const line of text.split('\n')) {
    const h = line.match(/^## (.+?)(?::.*)? \(\d+\)$/);
    if (h) {
      biome = biomeIds[h[1]] ?? null;
      continue;
    }
    if (!/^\| \d+ \|/.test(line)) continue;
    const c = line.split('|').map((x) => x.trim());
    out.push({
      id: slug(c[2].replace(/\s*\(.*\)$/, '')),
      name: c[2],
      scientific: c[3].replace(/^\*|\*$/g, '').replace(/\*/g, ''),
      biome,
      plan: c[4],
      tier: Number(c[5]),
      diet: c[6],
      iucn: c[7],
      v1: c[8].includes('v1'),
    });
  }
  return out;
}

if (import.meta.main) {
  const list = parseSpeciesMd(md);
  const body = list
    .map((s) => `  ${JSON.stringify(s).replace(/"(\w+)":/g, '$1: ')},`)
    .join('\n');
  const file = `// Generated from docs/species.md by scripts/species-from-md.js. Do not edit by hand.

/**
 * @typedef {{ id: string, name: string, scientific: string, biome: string, plan: string, tier: number,
 *   diet: string, iucn: string, v1: boolean }} Species
 */

/** @type {Species[]} */
export const SPECIES = [
${body}
];

export const SPECIES_BY_ID = Object.fromEntries(SPECIES.map((s) => [s.id, s]));
`;
  writeFileSync(new URL('../src/data/species.js', import.meta.url), file);
  console.log(`Wrote ${list.length} species (${list.filter((s) => s.v1).length} v1) to src/data/species.js`);
}
