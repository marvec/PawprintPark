// buildAnimal(speciesId, { sex, age }) → { group, rig, look }: a code-built, rigged animal as a plain Object3D tree.
// Pure: runs under bun test without WebGL (CLAUDE.md, "scene builder separate from renderer").

import { hashString } from '../../core/rng.js';
import { buildBird } from './bird.js';
import { LOOKS } from './looks.js';
import { buildPinniped } from './pinniped.js';
import { buildQuadruped } from './quadruped.js';
import { buildLizard, buildTurtle } from './reptile.js';
import { createAnimalMaterial } from './rig.js';

export { LOOKS, V1_PLANS } from './looks.js';
export { animate, POSES } from './animate.js';
export { createAnimalMaterial } from './rig.js';

const BUILDERS = {
  hoof: buildQuadruped,
  cat: buildQuadruped,
  dog: buildQuadruped,
  bear: buildQuadruped,
  small: buildQuadruped,
  pachy: buildQuadruped,
  'bird-walk': buildBird,
  'bird-perch': buildBird,
  penguin: buildBird,
  pinniped: buildPinniped,
  lizard: buildLizard,
  turtle: buildTurtle,
};

/** Parts that adults have and babies don't grow until later. */
const ADULT_ONLY = ['horns', 'antlers', 'tusks', 'mane', 'beard'];

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Deep merge of plain objects. Functions and arrays are replaced; null removes a key. */
export function mergeLook(base, over) {
  if (!over) return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) {
    if (v === null) delete out[k];
    else if (isPlain(v) && isPlain(out[k])) out[k] = mergeLook(out[k], v);
    else out[k] = v;
  }
  return out;
}

/** True when the species looks different for males and females. */
export const isDimorphic = (id) => !!(LOOKS[id]?.male || LOOKS[id]?.female);

/** Resolves the look for a sex and age: base → sex overrides → baby overrides and proportions. */
export function resolveLook(id, { sex = 'female', age = 'adult' } = {}) {
  const base = LOOKS[id];
  if (!base) throw new Error(`No look for species "${id}"`);
  const { male, female, baby, ...rest } = base;
  let L = mergeLook(rest, sex === 'male' ? male : female);
  let scale = L.scale ?? 1;
  // Toy proportions: heads and eyes a little bigger than life.
  if (L.head) L.head = scaleDims(L.head, 1.15, ['l', 'w', 'h', 'r']);
  if (L.eyes?.size) L.eyes = { ...L.eyes, size: L.eyes.size * 1.25 };
  else L.eyes = { ...L.eyes, size: (L.head?.h ?? L.head?.r ?? 0.1) * 0.16 * 1.25 };
  if (age === 'baby') {
    const { scale: babyScale = 0.45, ...bo } = baby ?? {};
    const extras = { ...(L.extras ?? {}) };
    for (const k of ADULT_ONLY) delete extras[k];
    L = mergeLook({ ...L, extras }, bo);
    scale = babyScale;
    // Babies: bigger heads and eyes, shorter snouts.
    if (L.head) L.head = scaleDims(L.head, 1.3, ['l', 'w', 'h', 'r']);
    if (L.snout) L.snout = scaleDims(L.snout, 1.05, ['l', 'w', 'h']);
    if (L.ears?.size) L.ears = { ...L.ears, size: L.ears.size * 1.25 };
    L.eyes = { ...L.eyes, size: L.eyes.size * 1.35 };
  }
  return { ...L, scale };
}

function scaleDims(o, k, keys) {
  const out = { ...o };
  for (const key of keys) if (typeof out[key] === 'number') out[key] *= k;
  return out;
}

/**
 * Builds an animal.
 * @param {string} id  species id (src/data/species.js)
 * @param {{ sex?: 'male'|'female', age?: 'adult'|'baby', material?: import('three').Material, seed?: number }} [opts]
 */
export function buildAnimal(id, opts = {}) {
  const look = resolveLook(id, opts);
  const build = BUILDERS[look.plan];
  if (!build) throw new Error(`No builder for body plan "${look.plan}"`);
  const material = opts.material ?? createAnimalMaterial();
  const seed = opts.seed ?? hashString(id);
  const { group, rig } = build(look, material, seed);
  group.scale.setScalar(look.scale);
  group.userData = { species: id, sex: opts.sex ?? 'female', age: opts.age ?? 'adult', plan: look.plan };
  rig.phase = (seed % 1000) / 159;
  return { group, rig, look };
}
