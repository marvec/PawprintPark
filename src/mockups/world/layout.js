// The world mockup's zoo: the real starting layout of a new zoo, plus showcase enclosures around it on the same
// generated map, every one placed through the path rules of the game (src/core/paths.js). Pure, so
// tests/worldMockup.test.js can check that every placement is valid and connected.

import { generateMap } from '../../core/map.js';
import { buildPathNetwork, canPlace, footprintRect } from '../../core/paths.js';
import { plotIndex } from '../../core/plots.js';
import { createWorld } from '../../core/state.js';

/** The default seed: a river map whose showcase plots are gentle enough to build on everywhere. */
export const MOCKUP_SEED = 6;

/** Plots unlocked for the showcase: the start area and the plots around it, west to east. */
export const SHOWCASE_PLOTS = { px0: 1, pz0: 7, px1: 8, pz1: 9 };

export const FENCE_WEAR = /** @type {const} */ (['new', 'worn', 'broken']);
export const UPGRADE_LEVELS = [0, 1, 2, 3];
export const EQUIPMENT = /** @type {const} */ ([
  'feeder', 'water', 'shelter', 'heater', 'cooler', 'pool', 'climbing-frame', 'toy', 'chute',
]);

/** One animal for each v1 biome, for scale (the house and the aviary get their own). */
const RESIDENTS = {
  farmyard: [['domestic-goat', 'female'], ['domestic-goat', 'male'], ['domestic-pig', 'female']],
  'african-savanna': [['plains-zebra', 'female'], ['plains-zebra', 'male']],
  'asian-jungle': [['red-panda', 'female'], ['red-panda', 'male']],
  polar: [['gentoo-penguin', 'female'], ['gentoo-penguin', 'male'], ['gentoo-penguin', 'female', 'baby']],
  coast: [['california-sea-lion', 'female'], ['harbour-seal', 'female']],
  wetland: [['chilean-flamingo', 'female'], ['chilean-flamingo', 'male'], ['chilean-flamingo', 'female']],
  'reptile-house': [['leopard-tortoise', 'female'], ['green-iguana', 'male'], ['komodo-dragon', 'male']],
  aviary: [['scarlet-macaw', 'female'], ['scarlet-macaw', 'male'], ['scarlet-macaw', 'female']],
};

/** Residents of the four sizes: bigger enclosures, bigger animals. */
const SIZE_RESIDENTS = {
  S: [['meerkat', 'female'], ['meerkat', 'male'], ['meerkat', 'female']],
  M: [['common-warthog', 'female'], ['common-warthog', 'male']],
  L: [['plains-zebra', 'female'], ['plains-zebra', 'male'], ['common-ostrich', 'female']],
  XL: [['reticulated-giraffe', 'female'], ['reticulated-giraffe', 'male'], ['reticulated-giraffe', 'female', 'baby']],
};

const animals = (list) => list.map(([species, sex, age = 'adult']) => ({ species, sex, age }));
const CLEAN = { cleanliness: 100, poop: 0, feeder: 4, water: 100, waterQuality: 100 };

/**
 * The showcase, as placements on top of the starting layout. Coordinates are tiles; each entry says which mockup
 * section it belongs to, so the page can label it and fly the camera there. Order matters: paths are replayed in
 * this order, nearest to the gate first.
 */
const SHOWCASE = [
  // East of the start: the four sizes (African Savanna), facing north onto one path.
  { section: 'sizes', size: 'S', biome: 'african-savanna', x: 146, z: 214, rot: 2, upgrade: 1, residents: SIZE_RESIDENTS.S },
  { section: 'sizes', size: 'M', biome: 'african-savanna', x: 154, z: 214, rot: 2, upgrade: 1, residents: SIZE_RESIDENTS.M },
  { section: 'sizes', size: 'L', biome: 'african-savanna', x: 166, z: 214, rot: 2, upgrade: 2, residents: SIZE_RESIDENTS.L },
  { section: 'sizes', size: 'XL', biome: 'african-savanna', x: 182, z: 214, rot: 2, upgrade: 3, residents: SIZE_RESIDENTS.XL },
  // North of the sizes: fence wear, three Farmyard S enclosures.
  { section: 'wear', size: 'S', biome: 'farmyard', x: 150, z: 199, rot: 0, wear: 'new', residents: [['domestic-goat', 'female']] },
  { section: 'wear', size: 'S', biome: 'farmyard', x: 158, z: 199, rot: 0, wear: 'worn', residents: [['domestic-goat', 'male']] },
  { section: 'wear', size: 'S', biome: 'farmyard', x: 166, z: 199, rot: 0, wear: 'broken', residents: [['domestic-goat', 'female']] },
  // The dirty enclosure, next to the wear row.
  { section: 'dirt', size: 'S', biome: 'farmyard', x: 174, z: 199, rot: 0, dirty: true, residents: [['domestic-pig', 'female']] },
  // Equipment: one L enclosure (Asian Jungle, which has no pool of its own) with every item in it.
  { section: 'equipment', size: 'L', biome: 'asian-jungle', x: 184, z: 191, rot: 0, upgrade: 1, equipment: EQUIPMENT, residents: [['bengal-tiger', 'female'], ['bengal-tiger', 'male']] },
  // West of the start: the eight biomes, M size, two rows facing a shared path.
  { section: 'biomes', size: 'M', biome: 'farmyard', x: 84, z: 196, rot: 0, upgrade: 1 },
  { section: 'biomes', size: 'M', biome: 'african-savanna', x: 72, z: 196, rot: 0, upgrade: 1 },
  { section: 'biomes', size: 'M', biome: 'asian-jungle', x: 60, z: 196, rot: 0, upgrade: 1 },
  { section: 'biomes', size: 'M', biome: 'polar', x: 48, z: 196, rot: 0, upgrade: 1 },
  { section: 'biomes', size: 'M', biome: 'coast', x: 84, z: 208, rot: 2, upgrade: 1 },
  { section: 'biomes', size: 'M', biome: 'wetland', x: 72, z: 208, rot: 2, upgrade: 1 },
  { section: 'biomes', size: 'M', biome: 'reptile-house', x: 60, z: 208, rot: 2, upgrade: 1 },
  { section: 'biomes', size: 'L', biome: 'aviary', x: 44, z: 208, rot: 2, upgrade: 1 },
  // North-west: habitat upgrade levels 0–3 (Asian Jungle).
  { section: 'upgrades', size: 'M', biome: 'asian-jungle', x: 84, z: 176, rot: 0, upgrade: 0, residents: [['red-panda', 'female']] },
  { section: 'upgrades', size: 'M', biome: 'asian-jungle', x: 72, z: 176, rot: 0, upgrade: 1, residents: [['red-panda', 'female']] },
  { section: 'upgrades', size: 'M', biome: 'asian-jungle', x: 60, z: 176, rot: 0, upgrade: 2, residents: [['red-panda', 'female']] },
  { section: 'upgrades', size: 'M', biome: 'asian-jungle', x: 48, z: 176, rot: 0, upgrade: 3, residents: [['red-panda', 'female']] },
];

/**
 * @typedef {import('../../core/state.js').PlacedThing & {
 *   section: string, upgrade: number, wear: 'new' | 'worn' | 'broken', dirty: boolean, equipment: readonly string[],
 *   residents: { species: string, sex: 'male' | 'female', age: 'adult' | 'baby' }[],
 * }} ShowcaseThing
 */

/** The plots the showcase unlocks, sorted. */
export function showcasePlots() {
  const out = [];
  for (let pz = SHOWCASE_PLOTS.pz0; pz <= SHOWCASE_PLOTS.pz1; pz++) {
    for (let px = SHOWCASE_PLOTS.px0; px <= SHOWCASE_PLOTS.px1; px++) out.push(plotIndex(px, pz));
  }
  return out.sort((a, b) => a - b);
}

/**
 * Builds the mockup's zoo for a seed: the map, a new zoo's state with the showcase plots unlocked, every placement
 * (starting layout first) and the path network. `invalid` lists showcase entries the rules rejected, with the
 * reason; they are left out.
 * @param {number} [seed]
 */
export function showcaseWorld(seed = MOCKUP_SEED) {
  const map = generateMap(seed);
  const world = createWorld({ seed });
  world.plots = showcasePlots();
  const sheep = world.animals[0];
  /** @type {ShowcaseThing[]} */
  const placements = world.placements.map((p) => ({
    ...p,
    section: 'start',
    upgrade: 0,
    wear: p.id === sheep.enclosure ? 'worn' : 'new',
    dirty: p.id === sheep.enclosure,
    equipment: p.kind === 'enclosure' ? ['feeder', 'water'] : [],
    residents: p.id === sheep.enclosure ? [{ species: sheep.species, sex: sheep.sex, age: 'adult' }] : [],
  }));
  const invalid = [];
  let network = buildPathNetwork(map, world.plots, placements);
  for (const s of SHOWCASE) {
    const residents = s.residents ?? RESIDENTS[s.biome] ?? [];
    /** @type {ShowcaseThing} */
    const p = {
      id: world.nextId++,
      kind: 'enclosure',
      x: s.x,
      z: s.z,
      rot: /** @type {0 | 1 | 2 | 3} */ (s.rot),
      size: s.size,
      biome: s.biome,
      name: null,
      care: s.dirty ? { cleanliness: 15, poop: 9, feeder: 0, water: 20, waterQuality: 25 } : { ...CLEAN },
      section: s.section,
      upgrade: s.upgrade ?? 1,
      wear: s.wear ?? 'new',
      dirty: !!s.dirty,
      equipment: s.equipment ?? ['feeder', 'water'],
      residents: animals(residents),
    };
    const check = canPlace(map, world.plots, placements, p, network);
    if (!check.ok) {
      invalid.push({ section: s.section, biome: s.biome, size: s.size, reason: check.reason });
      continue;
    }
    placements.push(p);
    network = buildPathNetwork(map, world.plots, placements);
  }
  world.placements = placements;
  return { map, world, placements, network, invalid };
}

/** The centre of a section's placements, in tiles, and how far they spread. */
export function sectionBounds(placements, section) {
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (const p of placements) {
    if (p.section !== section) continue;
    const r = footprintRect(p);
    x0 = Math.min(x0, r.x0);
    z0 = Math.min(z0, r.z0);
    x1 = Math.max(x1, r.x1);
    z1 = Math.max(z1, r.z1);
  }
  return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, radius: Math.max(x1 - x0, z1 - z0) / 2 };
}
