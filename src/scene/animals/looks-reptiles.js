// Mesh looks for pinnipeds, lizards and tortoises: same scheme as looks-quadrupeds.js (sizes stay in looks.js;
// this adds paint, head pitch, eyes and a few shape knobs). Markings are signed fields over a vertex's
// rest position and channels (cage.js CHANNELS), positive inside; later markings win where they overlap.

import { PAT_PATCHES, PAT_SPOTS } from './material.js';

/** Eyes and their glints. */
const eyes = (color = 0x15110f) => [
  { color, field: (v) => v.EYE },
  { color: 0xffffff, field: (v) => v.GLINT },
];
const claws = (color, len = 0.03) => ({ color, field: (v) => len - v.TIP });
/** A lid ring round each eye (radius k × the head length; the eye itself paints over the middle). */
const lids = (color, k = 0.34) => ({ color, field: (v) => k * v.headLen - v.eyeDist() });
/** Pinnipeds: flippers, lighter whisker pads, nose pad, ear flaps, eyes. */
const pinnipedMarks = (flipper, pads, nose, ear = flipper) => [
  { color: flipper, field: (v) => (v.WING - 0.1) * 0.05 },
  { color: pads, field: (v) => v.AUX * 0.02 },
  { color: ear, field: (v) => (v.EAR - 0.5) * 0.05 },
  { color: nose, field: (v) => v.NOSE * 0.05 },
  ...eyes(),
];

export const WATER_REPTILE_MESH_LOOKS = {
  // ---- Pinnipeds -----------------------------------------------------------------------------------------------
  'california-sea-lion': {
    pitch: 0.05,
    eye: { t: 0.55, ang: 0.22, fwd: 1.0 },
    eyeScale: 1.75,
    earFlaps: true,
    paint: { base: 0x6a4a34, marks: pinnipedMarks(0x4e3626, 0x7a5a42, 0x2a1d16, 0x3e2a1e) },
    male: { crest: 0.05, paint: { base: 0x4a3424, marks: pinnipedMarks(0x3a281c, 0x5a4232, 0x1d1410, 0x2e2018) } },
    female: { paint: { base: 0x9a7a58, marks: pinnipedMarks(0x7a5a40, 0xb08e6a, 0x3a2a20, 0x6a4c34) } },
    baby: { paint: { base: 0x3e2c20, marks: pinnipedMarks(0x2e2018, 0x4e3a2c, 0x1d1410, 0x2a1d16) } },
  },
  'harbour-seal': {
    pitch: 0.0,
    // Seals: no visible neck, the head nearly as wide as the front of the body.
    headW: 1.2,
    eye: { t: 0.55, ang: 0.25, fwd: 1.0 },
    eyeScale: 1.9,
    paint: {
      base: 0x8f8f8a,
      pattern: { kind: PAT_SPOTS, color: 0x4a4a48, size: 0.075, radius: 0.24, density: 0.6 },
      // The whisker pads are a marking, so the spots (the coat pattern) don't show on them.
      marks: [{ color: 0xb9b7b0, field: (v) => (v.UNDER - 0.4) * 0.06 }, ...pinnipedMarks(0x6f6f6a, 0xcac8c0, 0x2a2826)],
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
    eye: { t: 0.55, ang: 0.4, fwd: 0.25 },
    eyeScale: 1.55,
    eyeTurret: 0.16,
    toes: 5,
    toeLen: 1.6,
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
        claws(0x3a3a2a, 0.006),
        lids(0x86b85a, 0.27),
        ...eyes(0x2e1e0e),
      ],
    },
    baby: { paint: { base: 0x7ac24a } },
  },
  'komodo-dragon': {
    pitch: 0.05,
    eye: { t: 0.4, ang: 0.35, fwd: 0.3 },
    eyeScale: 1.5,
    eyeTurret: 0.1,
    toes: 4,
    toeLen: 1.0,
    tongue: { len: 0.85 },
    headFlat: 0.8,
    tailCurl: 0.07,
    paint: {
      base: 0x6c6252,
      marks: [
        { color: 0x857b68, field: (v) => (v.UNDER - 0.5) * 0.05 },
        claws(0x2e2a26, 0.022),
        { color: 0xe6c64a, field: (v) => v.TUSK * 0.05 },
        lids(0x5e5546, 0.23),
        ...eyes(),
      ],
    },
    baby: {
      paint: {
        base: 0x4a4a3a,
        pattern: { kind: PAT_SPOTS, color: 0xd8b84a, size: 0.05, radius: 0.3, density: 0.6 },
        marks: [{ color: 0x5a5a46, field: (v) => (v.UNDER - 0.5) * 0.05 }, claws(0x2e2a26, 0.006), { color: 0xe6c64a, field: (v) => v.TUSK * 0.05 }, lids(0x3a3a2e, 0.23), ...eyes()],
      },
    },
  },
};
