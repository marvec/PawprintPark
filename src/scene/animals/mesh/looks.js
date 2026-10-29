// What the single-mesh builder adds to the species looks (../looks.js keeps sizes and colours): head pitch, coat
// pattern, markings, and a few shape tweaks. Same override scheme: `male`, `female`, `baby`.
//
// Markings are signed fields over a vertex's rest position and channels (cage.js CHANNELS): positive inside. Units
// are metres where possible, so the edge the shader draws at zero sits where the field says.

import { PAT_PATCHES, PAT_SPOTS, PAT_STRIPES } from './material.js';

const EYE = 0x15110f;

/** Shared markings: eyes, glints. */
const eyes = (color = EYE) => [
  { color, field: (v) => v.EYE },
  { color: 0xffffff, field: (v) => v.GLINT },
];
/** Hooves: below the crease ring of the leg profile (quadruped.js LEGS: h 0.075 of the leg length). */
const hooves = (color, k = 0.068) => ({ color, field: (v) => v.legLen * k - v.y });
const tuft = (color, len) => ({ color, field: (v) => len - v.TAIL });

export const MESH_LOOKS = {
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
        { color: 0x6e3e2c, field: (v) => Math.min(0.03 - v.SNOUT, 0.024 - Math.abs(v.x), (-v.UNDER - 0.15) * 0.06) },
        { color: 0x8a6a4a, field: (v) => (v.EAR - 0.1) * 0.05 },
        tuft(0x4a2e1c, 0.12),
        ...eyes(0x3a240c),
      ],
    },
    male: {
      mane: { r: 0.2, color: 0x8a5428, chest: 0.1 },
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
};

export const MESH_SPECIES = Object.keys(MESH_LOOKS);
export { PAT_PATCHES, PAT_SPOTS, PAT_STRIPES };
