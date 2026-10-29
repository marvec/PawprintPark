// Single-mesh looks for pinnipeds, lizards and tortoises: same scheme as looks.js (sizes and colours stay in
// ../looks.js; this adds paint, head pitch, eyes and a few shape knobs). Markings are signed fields over a vertex's
// rest position and channels (cage.js CHANNELS), positive inside; later markings win where they overlap.

import { PAT_PATCHES, PAT_SPOTS } from './material.js';

/** Eyes and their glints. */
const eyes = (color = 0x15110f) => [
  { color, field: (v) => v.EYE },
  { color: 0xffffff, field: (v) => v.GLINT },
];
const claws = (color, len = 0.03) => ({ color, field: (v) => len - v.TIP });

export const WATER_REPTILE_MESH_LOOKS = {
  // ---- Pinnipeds -----------------------------------------------------------------------------------------------
  'california-sea-lion': {
    pitch: 0.05,
    eye: { t: 0.45, ang: 0.3, fwd: 0.55 },
    eyeScale: 1.7,
    earFlaps: true,
    paint: {
      base: 0x6a4a34,
      marks: [
        { color: 0x4e3626, field: (v) => (v.WING - 0.1) * 0.05 },
        { color: 0x2a1d16, field: (v) => 0.006 - v.SNOUT },
        ...eyes(),
      ],
    },
    male: { crest: 0.05, paint: { base: 0x4a3424, marks: [{ color: 0x3a281c, field: (v) => (v.WING - 0.1) * 0.05 }, { color: 0x1d1410, field: (v) => 0.006 - v.SNOUT }, ...eyes()] } },
    female: { paint: { base: 0x9a7a58, marks: [{ color: 0x7a5a40, field: (v) => (v.WING - 0.1) * 0.05 }, { color: 0x3a2a20, field: (v) => 0.006 - v.SNOUT }, ...eyes()] } },
    baby: { paint: { base: 0x3e2c20, marks: [{ color: 0x2e2018, field: (v) => (v.WING - 0.1) * 0.05 }, { color: 0x1d1410, field: (v) => 0.006 - v.SNOUT }, ...eyes()] } },
  },
  'harbour-seal': {
    pitch: 0.0,
    eye: { t: 0.5, ang: 0.32, fwd: 0.6 },
    eyeScale: 1.8,
    paint: {
      base: 0x8f8f8a,
      pattern: { kind: PAT_SPOTS, color: 0x4a4a48, size: 0.075, radius: 0.24, density: 0.6 },
      marks: [
        { color: 0xb9b7b0, field: (v) => (v.UNDER - 0.4) * 0.06 },
        { color: 0x6f6f6a, field: (v) => (v.WING - 0.1) * 0.05 },
        { color: 0x2a2826, field: (v) => 0.006 - v.SNOUT },
        ...eyes(),
      ],
    },
    baby: { paint: { base: 0xa9a8a2, pattern: { color: 0x707070 } } },
  },

  // ---- Tortoises ------------------------------------------------------------------------------------------------
  'leopard-tortoise': {
    pitch: 0.15,
    eye: { t: 0.35, ang: 0.3, fwd: 0.3 },
    eyeScale: 1.35,
    paint: {
      base: 0xd8bf78,
      pattern: { kind: PAT_PATCHES, color: 0x4a3a22, size: 0.095, line: 0.08, tint: 0.3 },
      marks: [
        // Skin everywhere off the shell, then the shell's rim and plastron.
        { color: 0xa58e6a, field: (v) => -v.SHELL * 0.05 },
        { color: 0x8a7448, field: (v) => (v.AUX - 0.5) * 0.03 },
        { color: 0xc9b07a, field: (v) => (v.AUX - 1.5) * 0.03 },
        { color: 0x6e5c44, field: (v) => 0.006 - v.SNOUT },
        ...eyes(),
      ],
    },
  },

  // ---- Lizards --------------------------------------------------------------------------------------------------
  'green-iguana': {
    pitch: 0.06,
    eye: { t: 0.55, ang: 0.4, fwd: 0.15 },
    eyeScale: 1.5,
    crest: { count: 16, size: 0.035 },
    legScale: 1.35,
    dewlap: { size: 0.035 },
    cheek: true,
    tailCurl: 0.08,
    paint: {
      base: 0x5f9c3e,
      marks: [
        { color: 0x8cbd5c, field: (v) => (v.UNDER - 0.45) * 0.05 },
        // Dark bands round the tail.
        { color: 0x3e6a2a, field: (v) => Math.min((Math.cos((v.TAIL / 0.11) * Math.PI * 2) - 0.25) * 0.012, 0.8 - v.TAIL) },
        { color: 0x4a7a2e, field: (v) => (v.RIDGE - 0.3) * 0.05 },
        { color: 0xb7c96a, field: (v) => v.AUX * 0.02 },
        claws(0x3a3a2a, 0.012),
        ...eyes(0x2e1e0e),
      ],
    },
    baby: { paint: { base: 0x7ac24a } },
  },
  'komodo-dragon': {
    pitch: 0.05,
    eye: { t: 0.4, ang: 0.35, fwd: 0.2 },
    eyeScale: 1.45,
    headFlat: 0.8,
    tailCurl: 0.07,
    paint: {
      base: 0x6c6252,
      marks: [
        { color: 0x857b68, field: (v) => (v.UNDER - 0.5) * 0.05 },
        claws(0x2e2a26, 0.03),
        ...eyes(),
      ],
    },
    baby: {
      paint: {
        base: 0x4a4a3a,
        pattern: { kind: PAT_SPOTS, color: 0xd8b84a, size: 0.05, radius: 0.3, density: 0.6 },
        marks: [{ color: 0x5a5a46, field: (v) => (v.UNDER - 0.5) * 0.05 }, claws(0x2e2a26, 0.03), ...eyes()],
      },
    },
  },
};
