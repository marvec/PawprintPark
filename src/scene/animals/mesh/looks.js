// What the single-mesh builder adds to the species looks (../looks.js keeps sizes and colours): head pitch, coat
// pattern, markings, and a few shape tweaks. Same override scheme: `male`, `female`, `baby`.
//
// Markings are signed fields over a vertex's rest position and channels (cage.js CHANNELS): positive inside. Units
// are metres where possible, so the edge the shader draws at zero sits where the field says.

import { BIRD_MESH_LOOKS } from './looks-birds.js';
import { WATER_REPTILE_MESH_LOOKS } from './looks-reptiles.js';
import { PAT_PATCHES, PAT_SPOTS, PAT_STRIPES } from './material.js';

const EYE = 0x15110f;

/** Shared markings: eyes, glints. */
export const eyes = (color = EYE) => [
  { color, field: (v) => v.EYE },
  { color: 0xffffff, field: (v) => v.GLINT },
];
/** Hooves: below the crease ring of the leg profile (quadruped.js LEGS: h 0.075 of the leg length). */
const hooves = (color, k = 0.068) => ({ color, field: (v) => v.legLen * k - v.y });
const tuft = (color, len) => ({ color, field: (v) => len - v.TAIL });
/** The underside, from `level` (UNDER: 0 at the sides, 1 at the bottom) down. */
const belly = (color, level = 0.55) => ({ color, field: (v) => (v.UNDER - level) * 0.25 });
/** The legs below `h` × the leg length. */
const legs = (color, h = 1.2) => ({ color, field: (v) => Math.min(v.LEG * 0.05, (h - v.y / v.legLen) * 0.1) });
/** The head, from the nose back to `k` × its length. */
const head = (color, k = 0.95) => ({ color, field: (v) => (v.headLen * k - v.SNOUT) * 0.5 });
/** The muzzle: the last `len` metres of the snout. */
const muzzle = (color, len) => ({ color, field: (v) => (len - v.SNOUT) * 0.5 });
/** Whole ears (by their bones). */
const earsAll = (color) => ({ color, field: (v) => (v.bone('earL') + v.bone('earR') - 0.5) * 0.05 });
/** Ear fronts (the inner ear). */
const earInner = (color) => ({ color, field: (v) => (v.EAR - 0.1) * 0.05 });
/** Patches round the eyes, centred (dy, dz) from each eye, radius r. */
const eyePatch = (color, r, dy = 0, dz = 0) => ({ color, field: (v) => r - v.eyeDist(dy, dz) });
/** Horns, antlers, tusks. */
const horny = (color) => ({ color, field: (v) => v.TUSK * 0.05 });
/** Wool and other hair masses (FUR > 0). */
const fur = (color) => ({ color, field: (v) => v.FUR * 0.05 });
/** A tuft of fine wool curls: a lighter spot pattern. */
const curls = (color) => ({ kind: PAT_SPOTS, color, size: 0.05, radius: 0.32, density: 0.75 });

/** Defaults per body plan: head pitch and where the eyes sit (MESH_LOOKS entries override them). */
export const MESH_PLAN_DEFAULTS = {
  hoof: { head: { pitch: 0.42 }, eye: { t: 0.3, ang: 0.42, fwd: 0.5 }, eyeScale: 1.7 },
  cat: { head: { pitch: 0.1 }, eye: { t: 0.5, ang: 0.32, fwd: 1.1 } },
  dog: { head: { pitch: 0.12 }, eye: { t: 0.42, ang: 0.4, fwd: 0.9 }, eyeScale: 1.5 },
  bear: { head: { pitch: 0.15 }, eye: { t: 0.42, ang: 0.42, fwd: 0.9 }, eyeScale: 1.5 },
  small: { head: { pitch: 0.12 }, eye: { t: 0.5, ang: 0.38, fwd: 0.9 }, eyeScale: 1.5 },
  pachy: { head: { pitch: 0.35 }, eye: { t: 0.55, ang: 0.15, fwd: 0.45 }, eyeScale: 1.7 },
};

const QUAD_MESH_LOOKS = {
  'lion': {
    head: { pitch: 0.1 },
    neckLen: 0.7,
    eye: { t: 0.5, ang: 0.32, fwd: 1.1 },
    ears: { kind: 'round', size: 0.09 },
    paint: {
      base: 0xd2a050,
      marks: [
        { color: 0xecd6a8, field: (v) => (v.UNDER - 0.55) * 0.25 },
        { color: 0xf0dfba, field: (v) => Math.min(0.13 - v.SNOUT, (v.UNDER + 0.15) * 0.2) },
        { color: 0x8a6a4a, field: (v) => (v.EAR - 0.1) * 0.05 },
        tuft(0x4a2e1c, 0.12),
        ...eyes(0x3a240c),
      ],
    },
    male: {
      mane: { r: 0.2, color: 0x9a6230, tips: 0x64381a, streak: 0x55301a, chest: 0.1 },
    },
    baby: {
      paint: { base: 0xd9ad66, pattern: { kind: PAT_SPOTS, color: 0xbb8d4f, size: 0.075, radius: 0.27, density: 0.55 } },
    },
  },
  'plains-zebra': {
    head: { pitch: 0.42 },
    eye: { t: 0.3, ang: 0.42, fwd: 0.5 },
    eyeScale: 1.75,
    ears: { kind: 'pointy', size: 0.14 },
    crest: 0.07,
    paint: {
      base: 0xf5f2ea,
      pattern: { kind: PAT_STRIPES, color: 0x1d1b1a, freq: 6.2, width: 0.42, wobble: 0.12, tilt: 0.55, legFreq: 1.35 },
      marks: [
        hooves(0x1d1b1a),
        { color: 0x2a2725, field: (v) => 0.12 - v.SNOUT },
        tuft(0x1d1b1a, 0.2),
        { color: 0x1d1b1a, field: (v) => (v.RIDGE - 0.15) * 0.04 },
        ...eyes(),
      ],
    },
    baby: { paint: { base: 0xf2e6d4, pattern: { color: 0x5a3e2c } }, crest: 0.05 },
  },
  'reticulated-giraffe': {
    head: { pitch: 0.42 },
    eye: { t: 0.3, ang: 0.42, fwd: 0.5 },
    eyeScale: 1.8,
    ears: { kind: 'side', size: 0.17 },
    crest: 0.04,
    paint: {
      base: 0xb8722f,
      pattern: { kind: PAT_PATCHES, color: 0xf0dfbd, size: 0.19, line: 0.13, tint: 0.2 },
      marks: [
        { color: 0xe6cfa6, field: (v) => (0.62 - v.y) * 0.5 },
        hooves(0x3d2f26),
        { color: 0xdcb784, field: (v) => 0.14 - v.SNOUT },
        { color: 0x8a5a2e, field: (v) => (v.RIDGE - 0.15) * 0.04 },
        { color: 0x2e2620, field: (v) => 0.045 - v.TIP },
        tuft(0x2e2620, 0.22),
        ...eyes(),
      ],
    },
  },
  'asian-elephant': {
    head: { pitch: 0.35 },
    eye: { t: 0.55, ang: 0.15, fwd: 0.45 },
    eyeScale: 1.7,
    ears: { kind: 'flap', size: 0.62 },
    trunk: 0.8,
    neckScale: 1.3,
    paint: {
      base: 0x8f8a84,
      marks: [
        hooves(0xbdb4a8, 0.05),
        { color: 0xa79b94, field: (v) => (v.EAR - 0.1) * 0.05 },
        { color: 0xf2ead8, field: (v) => v.TUSK },
        tuft(0x3a3532, 0.14),
        ...eyes(),
      ],
    },
  },

  // ---- Farmyard ---------------------------------------------------------------------------------------------------
  'domestic-sheep': {
    head: { pitch: 0.5 },
    eye: { t: 0.35, ang: 0.5, fwd: 0.45 },
    ears: { kind: 'floppy', size: 0.11, droop: 0.35 },
    paint: {
      base: 0xf2ebdd,
      pattern: curls(0xfbf8f1),
      marks: [legs(0x3a302b, 0.82), head(0x3a302b, 0.95), earsAll(0x3a302b), fur(0xf2ebdd), hooves(0x221c19), ...eyes()],
    },
  },
  'domestic-goat': {
    head: { pitch: 0.45 },
    ears: { kind: 'floppy', size: 0.1, droop: 0.25 },
    paint: {
      base: 0xf1ece2,
      pattern: { kind: PAT_SPOTS, color: 0xa8794e, size: 0.17, radius: 0.42, density: 0.42 },
      marks: [hooves(0x3b302a), horny(0x8a7b6a), { color: 0xe2d8c6, field: (v) => v.AUX * 0.05 }, ...eyes(0x6a4a1a)],
    },
  },
  'domestic-pig': {
    head: { pitch: 0.12 },
    eye: { t: 0.45, ang: 0.45, fwd: 0.6 },
    eyeScale: 1.0,
    ears: { kind: 'floppy', size: 0.13, droop: 0.2 },
    paint: { base: 0xf0b4a6, marks: [hooves(0x8a5a50, 0.1), earInner(0xe8a294), ...eyes()] },
  },
  'donkey': {
    crest: 0.05,
    ears: { kind: 'long', size: 0.26, back: 0.25, splay: 0.35 },
    paint: {
      base: 0x8b8580,
      marks: [belly(0xd8d2ca), muzzle(0xe0d9cf, 0.12), earInner(0xd8d2ca), { color: 0x3a332e, field: (v) => (v.RIDGE - 0.15) * 0.04 }, tuft(0x2e2925, 0.12), hooves(0x2e2925), ...eyes()],
    },
  },
  'alpaca': {
    head: { pitch: 0.2 },
    neckLen: 0.95,
    ears: { kind: 'pointy', size: 0.1 },
    paint: { base: 0xe6d6b8, pattern: curls(0xece0c6), marks: [muzzle(0xd9c6a4, 0.07), hooves(0x4a3c34, 0.08), ...eyes()] },
  },

  // ---- Savanna ----------------------------------------------------------------------------------------------------
  'meerkat': {
    ears: { kind: 'small', size: 0.025 },
    paint: {
      base: 0xc8a678,
      marks: [belly(0xdcc49a, 0.5), muzzle(0x3b2e26, 0.012), eyePatch(0x3b2e26, 0.024, -0.004, -0.004), earsAll(0x3b2e26), tuft(0x2a2220, 0.06), ...eyes()],
    },
  },
  'common-warthog': {
    head: { pitch: 0.3 },
    eye: { t: 0.35, ang: 0.55, fwd: 0.35 },
    crest: 0.06,
    crestBack: { from: -0.4, h: 0.05 },
    ears: { kind: 'pointy', size: 0.08 },
    paint: {
      base: 0x7b6a5f,
      marks: [muzzle(0x6c5c52, 0.1), { color: 0x4a3c33, field: (v) => (v.RIDGE - 0.55) * 0.04 }, horny(0xf2ead8), tuft(0x2e2622, 0.08), hooves(0x3a302a, 0.1), ...eyes()],
    },
  },

  // ---- Asian Jungle -----------------------------------------------------------------------------------------------
  'bengal-tiger': {
    tailTuft: false,
    ears: { kind: 'round', size: 0.1 },
    paint: {
      base: 0xd8782a,
      pattern: { kind: PAT_STRIPES, color: 0x1b1512, freq: 9, width: 0.34, wobble: 0.22, tilt: 0.3, legFreq: 1 },
      marks: [
        belly(0xf3e9dc, 0.45),
        { color: 0xf3e9dc, field: (v) => Math.min(0.13 - v.SNOUT, (v.UNDER + 0.15) * 0.2) },
        eyePatch(0xf3e9dc, 0.03, 0.04, -0.01),
        earInner(0xf3e9dc),
        tuft(0x1b1512, 0.12),
        ...eyes(0x3a2a0c),
      ],
    },
  },
  'red-panda': {
    ears: { kind: 'pointy', size: 0.07 },
    paint: {
      base: 0xb1441c,
      marks: [
        belly(0x3a1c10, 0.35),
        legs(0x3a1c10, 1.3),
        muzzle(0xf2e8dc, 0.05),
        eyePatch(0xf2e8dc, 0.022, 0.03, 0),
        earsAll(0xf2e8dc),
        earInner(0xb1441c),
        { color: 0xe3c39a, field: (v) => v.AUX * 0.02 },
        ...eyes(),
      ],
    },
  },
  'asian-small-clawed-otter': {
    ears: { kind: 'small', size: 0.025 },
    paint: { base: 0x6b4a33, marks: [belly(0xb79a7c, 0.4), muzzle(0xb79a7c, 0.05), legs(0x3e2a1c, 0.5), ...eyes()] },
  },
  'malayan-tapir': {
    head: { pitch: 0.3 },
    eye: { t: 0.5, ang: 0.4, fwd: 0.4 },
    eyeScale: 1.6,
    trunk: 0.55,
    ears: { kind: 'round', size: 0.12 },
    paint: {
      base: 0x1c1a19,
      marks: [
        // The white saddle: the back half of the body, above the belly line, not the legs or tail.
        { color: 0xece8e0, field: (v) => Math.min((0.12 * v.bodyL - v.z) * 0.5, (v.y - v.legLen - 0.05 * v.bodyH) * 0.5, -v.LEG * 0.05, (v.TAIL - 3) * 0.05) },
        earInner(0xd8d4cc),
        ...eyes(),
      ],
    },
    baby: {
      paint: {
        base: 0x5a3a24,
        pattern: { kind: PAT_STRIPES, color: 0xd8c3a0, freq: 11, width: 0.22, wobble: 0.6, tilt: 0.8, legFreq: 1 },
        marks: [earInner(0xd8d4cc), ...eyes()],
      },
    },
  },
  'giant-panda': {
    ears: { kind: 'round', size: 0.13 },
    paint: {
      base: 0xf4f1ea,
      marks: [
        legs(0x1c1a19, 2),
        // The black band over the shoulders, joining the front legs.
        { color: 0x1c1a19, field: (v) => Math.min((v.z + 0.05 * v.bodyL) * 0.5, (0.55 * v.bodyL - v.z) * 0.5) },
        // Teardrop eye patches, drooping down and back from the eyes.
        { color: 0x1c1a19, field: (v) => Math.max(0.045 - v.eyeDist(0, 0), 0.04 - v.eyeDist(-0.035, -0.012)) },
        earsAll(0x1c1a19),
        ...eyes(),
      ],
    },
  },

  // ---- Polar ------------------------------------------------------------------------------------------------------
  'arctic-fox': {
    ears: { kind: 'pointy', size: 0.06 },
    paint: { base: 0xf3f1ec, marks: [...eyes(0x2a2018)] },
    baby: { paint: { base: 0x6b5a4c } },
  },
  'reindeer': {
    head: { pitch: 0.45 },
    ears: { kind: 'pointy', size: 0.1 },
    paint: {
      base: 0x857261,
      marks: [
        belly(0xd9cfbd, 0.5),
        // A pale throat and neck ruff.
        { color: 0xd9cfbd, field: (v) => Math.min((v.SNOUT - v.headLen) * 0.5, (v.UNDER - 0.25) * 0.2, (v.y - v.legLen - 0.9 * v.bodyH) * 0.3) },
        head(0x6f5e50, 0.9),
        muzzle(0x4a3e36, 0.1),
        horny(0xcbb79a),
        tuft(0xeee6d6, 0.1),
        hooves(0x2e2622),
        ...eyes(),
      ],
    },
  },
  'polar-bear': {
    ears: { kind: 'round', size: 0.07 },
    paint: { base: 0xf2ead6, marks: [...eyes()] },
  },
  'domestic-rabbit': {
    ears: { kind: 'long', size: 0.16, back: 0.45, splay: 0.15 },
    paint: { base: 0xa58a72, marks: [belly(0xe9dcc8, 0.4), muzzle(0xe9dcc8, 0.035), earInner(0xe7b3b0), tuft(0xf4efe6, 0.08), ...eyes()] },
  },
};

export const MESH_LOOKS = { ...QUAD_MESH_LOOKS, ...BIRD_MESH_LOOKS, ...WATER_REPTILE_MESH_LOOKS };
export const MESH_SPECIES = Object.keys(MESH_LOOKS);
export { PAT_PATCHES, PAT_SPOTS, PAT_STRIPES };
