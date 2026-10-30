// Single-mesh looks for birds (bird-walk, bird-perch, penguin): same scheme as looks.js. The paint fields use the
// channels as bird.js fills them: AUX (up the neck: 1 at the nape), BEAK (0 at the base to 1 at the tip), EAR (face
// patch), WING (metres out along the wing), TAIL (metres to the tail tip), LEG (1 bare legs, -0.5 thighs), TIP (comb).

const EYE = 0x15110f;
const eyes = (color = EYE) => [
  { color, field: (v) => v.EYE },
  { color: 0xffffff, field: (v) => v.GLINT },
];
// Where no marking covers a vertex, index.js still stores the colour of the highest field there, and the shader blends
// towards it at marking edges. `base` (first in each list, never positive) makes that the coat colour on the body, so
// the edges of the tail, legs and wings don't pick up the face's or comb's colour; fields that are often close to
// zero off their part (neck, face) are steep enough to stay below it.
const base = (color) => ({ color, field: () => -0.9 });
const neck = (color) => ({ color, field: (v) => (v.AUX - 0.1) * 0.5 });
const head = (color) => ({ color, field: (v) => (v.AUX - 1) * 0.5 });
const wings = (color) => ({ color, field: (v) => v.WING });
const tail = (color) => ({ color, field: (v) => 1 - v.TAIL });
const legs = (color) => ({ color, field: (v) => v.LEG });
const beak = (color) => ({ color, field: (v) => v.BEAK * 0.05 });
const comb = (color) => ({ color, field: (v) => 0.5 - v.TIP });
const face = (color) => ({ color, field: (v) => v.EAR });

export const BIRD_MESH_LOOKS = {
  'chicken': {
    eye: { t: 0.3, ang: 0.12, fwd: 0.25 },
    // Red skin around the eye and down the cheek.
    face: { along: 0.15, up: -0.05, ra: 0.62, rb: 0.62 },
    eyeScale: 1.35,
    paint: {
      base: 0xa8764a,
      marks: [base(0xa8764a), { color: 0xb98a5c, field: (v) => Math.min((v.AUX - 0.35) * 0.5, (0.25 - v.UNDER) * 0.3) }, wings(0x8a5a34), tail(0x7a5434), legs(0xe8b44a), face(0xd6261f), comb(0xd6261f), beak(0xe8b44a), ...eyes()],
    },
    male: {
      paint: {
        base: 0xb44a24,
        marks: [
          base(0xb44a24),
          neck(0xe08a2c),
          head(0xb44a24),
          // A dark breast below the hackles.
          { color: 0x2b2a28, field: (v) => Math.min(v.UNDER + 0.1, -v.AUX - 0.15) },
          wings(0x7a2e18),
          tail(0x1f3a2c),
          legs(0xe8b44a),
          face(0xd6261f),
          comb(0xd6261f),
          beak(0xe8b44a),
          ...eyes(),
        ],
      },
    },
    baby: {
      eyeScale: 1.5,
      paint: { base: 0xf6d55c, marks: [base(0xf6d55c), wings(0xf0c94a), tail(0xf0c94a), legs(0xe8a84a), beak(0xe8a84a), ...eyes()] },
    },
  },
  'common-ostrich': {
    head: { pitch: 0.05 },
    // Loose, lumpy plumage with a ragged lower edge; big drooping wing plumes; a fluffy tail; bare drumsticks.
    plumage: { lumps: 0.2, skirt: 0.55 },
    wing: { thick: 0.38, depth: 0.9, droop: 0.7, plume: 0.5, tuck: 1 },
    wingScale: 1.3,
    tailScale: 1.6,
    drumstick: 2,
    eye: { t: 0.15, ang: 0.15, fwd: 0.3 },
    eyeScale: 1.5,
    paint: {
      base: 0x8b7c69,
      marks: [base(0x8b7c69), neck(0xb8a898), wings(0x9a8b78), tail(0xd8cfc2), { color: 0xb8a898, field: (v) => v.LEG + 0.75 }, beak(0xe0c4a8), ...eyes()],
    },
    male: {
      paint: {
        base: 0x1e1c1b,
        marks: [base(0x1e1c1b), neck(0xd9a598), wings(0xf4efe6), tail(0xf4efe6), { color: 0xd9a598, field: (v) => v.LEG + 0.75 }, beak(0xe0c4a8), ...eyes()],
      },
    },
    baby: {
      paint: { base: 0xa8957a, marks: [base(0xa8957a), neck(0xc9b89a), { color: 0xc9b89a, field: (v) => v.LEG + 0.75 }, beak(0xe0c4a8), ...eyes()] },
    },
  },
  'chilean-flamingo': {
    head: { pitch: 0.1 },
    eye: { t: 0.2, ang: 0.15, fwd: 0.3 },
    eyeScale: 1.4,
    paint: {
      base: 0xf49ab0,
      marks: [base(0xf49ab0), wings(0xf27b98), legs(0xe88aa0), beak(0xf3e4d8), { color: 0x1d1a19, field: (v) => (v.BEAK - 0.6) * 0.05 }, ...eyes()],
    },
    baby: {
      paint: { base: 0xd8d4cf, marks: [base(0xd8d4cf), wings(0xc8c3bd), legs(0x6a6462), beak(0x4a4644), ...eyes()] },
    },
  },
  'scarlet-macaw': {
    // Perched upright: the body nearly vertical, the head level on top, the tail hanging down behind.
    pitch: 1.25,
    hipDrop: 1.12,
    // The tail hangs down behind: shorter than the species look's, so it can angle down from the rump.
    tailScale: 0.62,
    head: { pitch: 0.2 },
    // Folded wings lie on the flanks, down to the tail; the tail is broad at the base (about the rump's width) and
    // tapers to a point.
    wing: { thick: 0.12, tuck: 0.4 },
    tailWidth: 0.75,
    tailDepth: 0.28,
    // The bare white face, from the eye to the beak.
    face: { along: 0.35, up: -0.08, ra: 0.72, rb: 0.62 },
    eye: { t: 0.15, ang: 0.2, fwd: 0.3 },
    eyeScale: 1.35,
    paint: {
      base: 0xd5241c,
      marks: [
        base(0xd5241c),
        // Wings: red shoulders, a yellow band, blue flight feathers.
        { color: 0xf2c230, field: (v) => v.WING - 0.055 },
        { color: 0x2456b8, field: (v) => v.WING - 0.105 },
        // The tail turns blue over its outer half.
        { color: 0x2456b8, field: (v) => 0.14 - v.TAIL },
        legs(0x5a5452),
        face(0xf4f0ea),
        beak(0xefe6d4),
        { color: 0x1f1c1b, field: (v) => Math.min(v.BEAK * 0.05, (v.UNDER - 0.25) * 0.05) },
        ...eyes(),
      ],
    },
    baby: {
      paint: {
        marks: [
          base(0xd5241c),
          { color: 0xf2c230, field: (v) => v.WING - 0.04 },
          { color: 0x2456b8, field: (v) => v.WING - 0.075 },
          { color: 0x2456b8, field: (v) => 0.06 - v.TAIL },
          legs(0x5a5452),
          face(0xf4f0ea),
          beak(0xefe6d4),
          { color: 0x1f1c1b, field: (v) => Math.min(v.BEAK * 0.05, (v.UNDER - 0.25) * 0.05) },
          ...eyes(),
        ],
      },
    },
  },
  'gentoo-penguin': {
    head: { pitch: 0.12 },
    eye: { t: 0.2, ang: 0.25, fwd: 0.3 },
    eyeScale: 1.35,
    paint: {
      base: 0x1d1c1e,
      marks: [
        base(0x1d1c1e),
        // A white front up to the throat, one clean curve; the flippers are painted black over it.
        { color: 0xf6f4ef, field: (v) => Math.min((v.UNDER - 0.12) * 0.3, (0.15 - v.AUX) * 0.3) },
        { color: 0x1d1c1e, field: (v) => v.WING + 0.02 },
        // The white band over the crown, from eye to eye.
        { color: 0xf6f4ef, field: (v) => Math.min(-v.UNDER - 0.45, 0.016 - Math.abs(v.SNOUT - 0.145)) },
        legs(0xf08a3a),
        beak(0xe8582a),
        ...eyes(),
      ],
    },
    baby: {
      paint: { base: 0x8d8a87, marks: [base(0x8d8a87), head(0x6d6a68), legs(0xf08a3a), beak(0x4a4644), ...eyes()] },
    },
  },
};
