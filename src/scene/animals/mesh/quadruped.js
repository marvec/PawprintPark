// Quadruped cage: one lofted tube from rump to nose (or trunk tip), with legs, tail, ears, ossicones and tusks
// extruded from its faces, and eye islands. Units are metres; the animal faces +z and stands on y = 0.
// Sizes come from the species look (../looks.js, radii and half-lengths); MESH_LOOKS adds the rest.

import { CHANNELS, Cage, FAR, resample, v3 } from './cage.js';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * Torso shape per plan: belly sag (hoof), tuck towards the rump (cat), back slope towards the shoulders; thigh: how far
 * the hind thigh reaches back (share of the half length), so its back runs on down from the rump.
 */
const TORSO = {
  hoof: { sag: 0.08, tuck: 0.1, rump: 0.5, thigh: 0.24 },
  cat: { sag: 0, tuck: 0.3, rump: 0.45, thigh: 0.2 },
  pachy: { sag: 0.06, tuck: 0.05, rump: 0.6, thigh: 0.28 },
  dog: { sag: 0, tuck: 0.25, rump: 0.45, thigh: 0.2 },
  bear: { sag: 0.03, tuck: 0.04, rump: 0.6, thigh: 0.26 },
  small: { sag: 0, tuck: 0.08, rump: 0.55, thigh: 0.28 },
};

/**
 * Torso rings along the body (z: share of the half length; y: centre offset, a/b: half width/height, both shares of
 * the body's). The back legs grow from the faces between hipA and the next ring, the front legs after shA. The hips
 * sit far back, so the back of the thigh runs on down from the rump (no rump hangs out behind the hind legs).
 */
const TORSO_RINGS = {
  hoof: [
    { z: -1.0, y: 0.07, a: 0.42, b: 0.55 },
    { z: -0.93, y: 0.04, a: 0.86, b: 0.9 },
    { z: -0.8, y: 0.02, a: 1, b: 1, name: 'hipA', hold: true },
    { z: -0.46, y: 0, a: 0.94, b: 0.95, name: 'hipB' },
    { z: 0.0, y: 0, a: 0.96, b: 1, sag: 1 },
    { z: 0.36, y: 0, a: 0.97, b: 1.02, name: 'shA', hold: true },
    { z: 0.7, y: -0.03, a: 0.9, b: 1.04, name: 'shB' },
  ],
  cat: [
    { z: -1.0, y: 0.08, a: 0.45, b: 0.55 },
    { z: -0.93, y: 0.06, a: 0.86, b: 0.84 },
    { z: -0.8, y: 0.05, a: 0.95, b: 0.9, name: 'hipA', hold: true },
    { z: -0.46, y: 0.06, a: 0.86, b: 0.84, name: 'hipB' },
    { z: 0.0, y: 0.02, a: 0.94, b: 0.95 },
    { z: 0.36, y: -0.02, a: 1, b: 1.06, name: 'shA', hold: true },
    { z: 0.7, y: -0.04, a: 0.96, b: 1.08, name: 'shB' },
  ],
  pachy: [
    { z: -1.0, y: 0.04, a: 0.5, b: 0.62 },
    { z: -0.93, y: 0.02, a: 0.9, b: 0.94 },
    { z: -0.8, y: 0, a: 1, b: 1, name: 'hipA', hold: true },
    { z: -0.46, y: 0, a: 1, b: 1, name: 'hipB' },
    { z: 0.0, y: 0, a: 1, b: 1, sag: 1 },
    { z: 0.36, y: 0.02, a: 1, b: 1.02, name: 'shA', hold: true },
    { z: 0.7, y: 0.02, a: 0.95, b: 1, name: 'shB' },
  ],
  // Bears: round and heavy, a hump over the shoulders.
  bear: [
    { z: -1.0, y: 0.04, a: 0.55, b: 0.62 },
    { z: -0.93, y: 0.02, a: 0.92, b: 0.94 },
    { z: -0.8, y: 0.0, a: 1, b: 1, name: 'hipA', hold: true },
    { z: -0.46, y: 0, a: 1, b: 0.98, name: 'hipB' },
    { z: 0.0, y: 0.02, a: 1, b: 1 },
    { z: 0.36, y: 0.06, a: 0.98, b: 1.06, name: 'shA', hold: true },
    { z: 0.7, y: 0.02, a: 0.88, b: 0.96, name: 'shB' },
  ],
  // Small mammals: a soft bean, round at both ends.
  small: [
    { z: -1.0, y: 0.04, a: 0.55, b: 0.62 },
    { z: -0.93, y: 0.02, a: 0.92, b: 0.94 },
    { z: -0.8, y: 0.0, a: 1, b: 1, name: 'hipA', hold: true },
    { z: -0.46, y: 0, a: 0.96, b: 0.96, name: 'hipB' },
    { z: 0.0, y: 0, a: 0.95, b: 0.95 },
    { z: 0.36, y: 0, a: 0.95, b: 0.98, name: 'shA', hold: true },
    { z: 0.7, y: 0.0, a: 0.86, b: 0.92, name: 'shB' },
  ],
};
TORSO_RINGS.dog = TORSO_RINGS.cat;

/**
 * Leg profiles, top to bottom. h: height above the ground as a share of the leg length (top: just under the body),
 * a/b: half width across/along the body (× leg radius), z: offset along the body (× leg length), w: weights for
 * [body, upper, lower, foot]. The last ring is capped (sole or paw front).
 */
const LEGS = {
  hoof: {
    front: [
      { h: 'top', a: 1.75, b: 2.1, z: 0, w: [0.45, 0.55, 0, 0] },
      { h: 0.6, a: 1.12, b: 1.35, z: 0.01, w: [0, 0.5, 0.5, 0] },
      { h: 0.37, a: 0.92, b: 1.0, z: 0.012, w: [0, 0, 1, 0] },
      { h: 0.22, a: 0.7, b: 0.74, z: 0.0, w: [0, 0, 0.5, 0.5] },
      { h: 0.12, a: 0.8, b: 0.86, z: -0.01, w: [0, 0, 0, 1] },
      { h: 0.075, a: 0.72, b: 0.76, z: 0.0, w: [0, 0, 0, 1] },
      { h: 0.06, a: 0.98, b: 1.08, z: 0.008, w: [0, 0, 0, 1] },
      { h: 0.0, a: 1.08, b: 1.25, z: 0.018, w: [0, 0, 0, 1] },
    ],
    back: [
      { h: 'top', a: 1.65, b: 3.0, z: 0, w: [0.45, 0.55, 0, 0] },
      { h: 0.66, a: 1.25, b: 1.65, z: 0.03, w: [0, 0.55, 0.45, 0] },
      { h: 0.4, a: 0.85, b: 1.05, z: -0.1, w: [0, 0, 0.5, 0.5] },
      { h: 0.23, a: 0.7, b: 0.76, z: -0.05, w: [0, 0, 0, 1] },
      { h: 0.12, a: 0.8, b: 0.86, z: -0.03, w: [0, 0, 0, 1] },
      { h: 0.075, a: 0.72, b: 0.76, z: -0.02, w: [0, 0, 0, 1] },
      { h: 0.06, a: 0.98, b: 1.08, z: -0.012, w: [0, 0, 0, 1] },
      { h: 0.0, a: 1.08, b: 1.25, z: -0.002, w: [0, 0, 0, 1] },
    ],
  },
  cat: {
    front: [
      { h: 'top', a: 1.71, b: 2.04, z: 0, w: [0.45, 0.55, 0, 0] },
      { h: 0.55, a: 1.19, b: 1.32, z: 0.01, w: [0, 0.5, 0.5, 0] },
      { h: 0.25, a: 0.968, b: 1.01, z: 0.015, w: [0, 0, 1, 0] },
      { h: 0.12, a: 0.946, b: 0.99, z: 0.02, w: [0, 0, 0.4, 0.6] },
      { h: 0.07, a: 1.19, b: 1.1, z: 0.06, w: [0, 0, 0, 1] },
      { h: 0.04, a: 1.23, b: 0.825, z: 0.12, w: [0, 0, 0, 1] },
      { h: 0.035, a: 0.99, b: 0.605, z: 0.17, w: [0, 0, 0, 1] },
    ],
    back: [
      { h: 'top', a: 1.71, b: 3.05, z: 0, w: [0.45, 0.55, 0, 0] },
      { h: 0.62, a: 1.34, b: 1.65, z: 0.04, w: [0, 0.55, 0.45, 0] },
      { h: 0.3, a: 0.88, b: 0.99, z: -0.1, w: [0, 0, 0.5, 0.5] },
      { h: 0.12, a: 0.924, b: 0.968, z: -0.02, w: [0, 0, 0, 1] },
      { h: 0.07, a: 1.17, b: 1.1, z: 0.03, w: [0, 0, 0, 1] },
      { h: 0.04, a: 1.21, b: 0.825, z: 0.09, w: [0, 0, 0, 1] },
      { h: 0.035, a: 0.968, b: 0.605, z: 0.14, w: [0, 0, 0, 1] },
    ],
  },
  pachy: {
    front: [
      { h: 'top', a: 1.15, b: 1.25, z: 0, w: [0.45, 0.55, 0, 0] },
      { h: 0.6, a: 1.0, b: 1.02, z: 0, w: [0, 0.5, 0.5, 0] },
      { h: 0.32, a: 0.9, b: 0.9, z: 0.01, w: [0, 0, 1, 0] },
      { h: 0.1, a: 0.93, b: 0.95, z: 0.01, w: [0, 0, 0.3, 0.7] },
      { h: 0.0, a: 1.0, b: 1.02, z: 0.012, w: [0, 0, 0, 1] },
    ],
    back: [
      { h: 'top', a: 1.15, b: 1.35, z: 0, w: [0.45, 0.55, 0, 0] },
      { h: 0.6, a: 1.0, b: 1.05, z: 0.01, w: [0, 0.5, 0.5, 0] },
      { h: 0.32, a: 0.88, b: 0.9, z: -0.01, w: [0, 0, 1, 0] },
      { h: 0.1, a: 0.92, b: 0.95, z: 0, w: [0, 0, 0.3, 0.7] },
      { h: 0.0, a: 1.0, b: 1.02, z: 0, w: [0, 0, 0, 1] },
    ],
  },
};

// Dogs and foxes walk on paws like cats, a little slimmer; bears and small mammals on short, padded paws.
const scaleProfile = (prof, k) => prof.map((r) => ({ ...r, a: r.a * k, b: r.b * k }));
LEGS.dog = { front: scaleProfile(LEGS.cat.front, 0.95), back: scaleProfile(LEGS.cat.back, 0.95) };
// Bears and small mammals stand flat-footed: a straight lower leg, no hock kicking back. Their legs are thick, so the
// top ring flares less (or it would stand out from the body's sides as a cuff).
const plantigrade = (prof) =>
  prof.map((r) => (r.h === 'top' ? { ...r, a: r.a * 0.75, b: r.b * 0.8 } : r.h === 0.3 ? { ...r, a: r.a * 1.1, b: r.b * 1.1, z: -0.02 } : r.h === 0.62 || r.h === 0.55 ? { ...r, z: 0.02 } : r));
LEGS.bear = { front: plantigrade(scaleProfile(LEGS.cat.front, 0.92)), back: plantigrade(scaleProfile(LEGS.cat.back, 0.92)) };
LEGS.small = LEGS.bear;

/**
 * Head rings along the head axis (from the head joint at the top of the neck): [name, along, up, half width,
 * half height], from the head, snout and the snout's drop. H1 carries the ears, S1 is the nose (or the trunk's base).
 */
const HEADS = {
  hoof: (hd, sn, drop) => [
    ['H0', -0.3 * hd.l, 0.22 * hd.h, 0.78 * hd.w, 0.74 * hd.h],
    ['H1', 0.25 * hd.l, 0.18 * hd.h, hd.w, 0.97 * hd.h],
    ['H2', 0.75 * hd.l, 0.08 * hd.h, 0.93 * hd.w, 0.88 * hd.h],
    ['H3', 1.2 * hd.l, -0.3 * drop, lerp(hd.w, sn.w, 0.45), lerp(hd.h, sn.h, 0.4)],
    ['S0', 1.15 * hd.l + 0.75 * sn.l, -0.75 * drop, 1.08 * sn.w, 1.06 * sn.h],
    ['S1', 1.15 * hd.l + 1.4 * sn.l, -0.85 * drop, 0.95 * sn.w, 0.9 * sn.h],
  ],
  // Cats: a round skull, wide cheeks and a short, broad muzzle.
  cat: (hd, sn, drop) => [
    ['H0', -0.4 * hd.l, 0.12 * hd.h, 0.78 * hd.w, 0.78 * hd.h],
    ['H1', 0.05 * hd.l, 0.12 * hd.h, 1.04 * hd.w, 0.98 * hd.h],
    ['H2', 0.45 * hd.l, 0.04 * hd.h, 1.02 * hd.w, 0.9 * hd.h],
    ['H3', 0.78 * hd.l, -0.16 * hd.h, 0.82 * hd.w, 0.7 * hd.h],
    ['S0', 0.78 * hd.l + 0.5 * sn.l, -0.55 * drop - 0.12 * hd.h, 1.15 * sn.w, 1.08 * sn.h],
    ['S1', 0.78 * hd.l + 0.95 * sn.l, -0.55 * drop - 0.1 * hd.h, 0.9 * sn.w, 0.82 * sn.h],
  ],
  // Elephants: a domed forehead falling to the trunk.
  pachy: (hd, sn, drop) => [
    ['H0', -0.35 * hd.l, 0.1 * hd.h, 0.8 * hd.w, 0.8 * hd.h],
    ['H1', 0.1 * hd.l, 0.18 * hd.h, hd.w, hd.h],
    ['H2', 0.55 * hd.l, 0.06 * hd.h, 0.95 * hd.w, 0.92 * hd.h],
    ['H3', 0.95 * hd.l, -0.25 * hd.h, 0.72 * hd.w, 0.72 * hd.h],
    ['S0', 0.95 * hd.l + 0.45 * sn.l, -0.8 * drop, 1.2 * sn.w, 1.2 * sn.h],
    ['S1', 0.95 * hd.l + 0.9 * sn.l, -drop, sn.w, sn.h],
  ],
  // Dogs and foxes: a round skull and a long, narrow muzzle.
  dog: (hd, sn, drop) => [
    ['H0', -0.4 * hd.l, 0.12 * hd.h, 0.78 * hd.w, 0.78 * hd.h],
    ['H1', 0.05 * hd.l, 0.12 * hd.h, 1.0 * hd.w, 0.95 * hd.h],
    ['H2', 0.45 * hd.l, 0.02 * hd.h, 0.95 * hd.w, 0.85 * hd.h],
    ['H3', 0.8 * hd.l, -0.14 * hd.h, 0.7 * hd.w, 0.62 * hd.h],
    ['S0', 0.8 * hd.l + 0.6 * sn.l, -0.5 * drop - 0.12 * hd.h, 1.0 * sn.w, 1.0 * sn.h],
    ['S1', 0.8 * hd.l + 1.2 * sn.l, -0.6 * drop - 0.12 * hd.h, 0.8 * sn.w, 0.8 * sn.h],
  ],
};
// Bears: a broad skull and a medium muzzle; small mammals: round heads with short muzzles (as cats).
HEADS.bear = (hd, sn, drop) => HEADS.dog(hd, sn, drop).map(([n, al, up, a, b]) => [n, al, up, n[0] === 'H' ? a * 1.04 : a, b]);
HEADS.small = HEADS.cat;

/** Tail centre lines (× tail length), from the root. */
const TAILS = {
  tuft: [[0, 0, 0], [0, 0.01, -0.07], [0, -0.14, -0.2], [0, -0.42, -0.3], [0, -0.72, -0.34], [0, -0.86, -0.35]],
  long: [[0, 0, 0], [0, 0.0, -0.08], [0, -0.22, -0.24], [0, -0.48, -0.42], [0, -0.6, -0.68], [0, -0.52, -0.9], [0, -0.44, -0.98]],
  thin: [[0, 0, 0], [0, 0.01, -0.07], [0, -0.14, -0.2], [0, -0.42, -0.3], [0, -0.72, -0.34], [0, -0.86, -0.35]],
  stub: [[0, 0, 0], [0, 0.1, -0.5], [0, 0.05, -1]],
  up: [[0, 0, 0], [0, 0.2, -0.25], [0, 0.5, -0.45], [0, 0.78, -0.55], [0, 0.95, -0.55]],
  curly: [[0, 0, 0], [0, 0.15, -0.35], [0, 0.55, -0.5], [0.15, 0.75, -0.25], [0.25, 0.45, -0.1], [0.2, 0.3, -0.35]],
  bushy: [[0, 0, 0], [0, -0.05, -0.15], [0, -0.25, -0.4], [0, -0.45, -0.65], [0, -0.55, -0.88], [0, -0.55, -1.0]],
  thick: [[0, 0, 0], [0, -0.05, -0.3], [0, -0.18, -0.65], [0, -0.25, -1]],
  ringed: [[0, 0, 0], [0, -0.1, -0.3], [0, -0.25, -0.65], [0, -0.28, -1]],
};

/** Tail radius along its length (t: 0 root → 1 tip), × the tail radius. */
const TAIL_PROFILE = {
  bushy: (t) => 1 + 2.2 * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.95)),
  thick: (t) => lerp(1.1, 0.35, t),
  ringed: (t) => lerp(1.05, 0.85, t),
  stub: (t) => lerp(1.2, 0.8, t),
  curly: () => 1,
  up: (t) => lerp(1.3, 0.8, t),
};

/**
 * Builds the cage for a quadruped.
 * @param {object} L  resolved species look (sizes, colours)
 * @param {object} M  resolved MESH_LOOKS entry
 * @param {{ step: number }} q  ring spacing for the lofted parts (metres; smaller = denser)
 * @returns {{ cage: Cage, joints: Record<string, number[]>, parents: Record<string, string|null>, info: object }}
 */
export function buildQuadCage(L, M, q) {
  const b = L.body;
  const lg = L.legs;
  const nk = L.neck;
  // The mesh look can widen the head (warthogs): multipliers, so babies keep their proportions.
  const hs = M.headScale ?? {};
  const hd = { ...L.head, w: L.head.w * (hs.w ?? 1), h: L.head.h * (hs.h ?? 1) };
  const sn = L.snout;
  const ex = L.extras ?? {};
  const torso = TORSO[L.plan] ?? TORSO.hoof;
  const bodyY = lg.len + b.h * 0.35;
  const slope = b.shape?.slope ?? (L.plan === 'hoof' && nk.angle > 1.05 ? 0.12 : 0);
  const lift = (z) => slope * b.h * (z / b.l);
  const mane = M.mane;
  const trunk = ex.trunk;
  // Wool (sheep, alpacas): lumpy, puffed-out body and neck. A crest along the back (warthogs).
  const wool = ex.wool;
  const woolR = wool ? Math.min(b.w, b.h) * (wool.size ?? 0.42) * 0.35 : 0;
  const crestBack = M.crestBack;
  const crestShape = (h) => (co, si) => [0, si > 0.85 ? h : 0];
  // RIDGE: 1 on top of a crest, fading with it (k), so a stripe painted on it narrows to a point.
  const ridgeK = (k) => (co, si) => ({ RIDGE: si > 0.85 ? lerp(-1, 1, k) : si > 0.3 ? -2 : -3 });
  const ridge = ridgeK(1);
  // The back crest grows from nothing at `from` to its full height at the middle of the back, and runs on into the
  // neck's.
  const crestK = (z) => (crestBack ? smoothstep(crestBack.from, 0, z) : 0);
  let lumpParity = 0;
  // Rings alternate their vertices in and out (staggered ring to ring), which subdivides into soft lumps.
  const lumps = (r, k) => {
    const flip = (lumpParity++ % 2) * 2 - 1;
    return (co, si) => {
      const j = Math.round((Math.atan2(si, co) - Math.PI / 8) / (Math.PI / 4));
      const e = r * (1 + k * flip * (j % 2 ? 1 : -1));
      return [e, e];
    };
  };

  const legNames = ['FL', 'FR', 'BL', 'BR'];
  const bones = ['seed', 'hips', 'chest', 'neck0', 'neck1', 'head', 'eyes', 'earL', 'earR', 'tail0', 'tail1', 'tail2'];
  if (trunk) bones.push('trunk0', 'trunk1', 'trunk2');
  for (const n of legNames) bones.push(`upper${n}`, `lower${n}`, `foot${n}`);
  const parents = { seed: null, hips: null, chest: 'hips', neck0: 'chest', neck1: 'neck0', head: 'neck1', eyes: 'head', earL: 'head', earR: 'head', tail0: 'hips', tail1: 'tail0', tail2: 'tail1', trunk0: 'head', trunk1: 'trunk0', trunk2: 'trunk1' };
  for (const n of legNames) {
    parents[`upper${n}`] = n[0] === 'F' ? 'chest' : 'hips';
    parents[`lower${n}`] = `upper${n}`;
    parents[`foot${n}`] = `lower${n}`;
  }
  const cage = new Cage(bones);
  const joints = { seed: [0, 0, 0], hips: [0, bodyY, -b.l * 0.35], chest: [0, bodyY + lift(b.l * 0.45), b.l * 0.45] };

  // ---- Spine: torso, neck, head, snout (and trunk) ----------------------------------------------------------------
  const keys = [];
  const torsoRings = TORSO_RINGS[L.plan] ?? TORSO_RINGS.hoof;
  // Long legs (share of the body's depth): 1 for cats, horses and giraffes, less for bears, pigs and elephants.
  const longLegs = clamp01(lg.len / (b.h * 2.2));
  for (const r of torsoRings) {
    // Under a deep body short hind legs sit a little further forward, or they would hang off the round rump.
    const z = (r.name === 'hipA' || r.name === 'hipB' ? r.z + (1 - longLegs) * 0.16 : r.z) * b.l;
    const tuck = clamp01((0.1 - r.z) / 1.1) * torso.tuck;
    const sag = (r.sag ?? 0) * torso.sag;
    const hipW = clamp01((0.35 - r.z) / 0.7);
    keys.push({
      name: r.name,
      hold: r.hold,
      c: [0, bodyY + r.y * b.h + lift(z), z],
      a: b.w * r.a,
      b: b.h * r.b,
      // Belly: sags in the middle (hoofed), tucks up towards the rump (cats). Wool puffs the body out in lumps; a
      // crest (warthog) runs along the back.
      shape: combine((co, si) => [0, si < 0 ? b.h * (sag - tuck) * -si : 0], wool && lumps(woolR, wool.lumps ?? 0.5), crestK(r.z) > 0 && crestShape(crestBack.h * crestK(r.z))),
      ch: crestK(r.z) > 0 ? ridgeK(crestK(r.z)) : wool ? { FUR: 1 } : undefined,
      w: { hips: hipW, chest: 1 - hipW },
    });
  }
  // Neck.
  const a = nk.angle ?? 0.8;
  const dir = [0, Math.sin(a), Math.cos(a)];
  const nz = M.neckZ ?? nk.z ?? 0.78;
  const nRoot = [0, bodyY + b.h * (M.neckY ?? nk.y ?? 0.45) + lift(b.l * nz), b.l * nz];
  const r2 = nk.r2 ?? nk.r * 0.75;
  const neckLen = nk.len * (M.neckLen ?? 1);
  const neckAt = (t) => v3.add(nRoot, v3.mul(dir, neckLen * t));
  const end = neckAt(1);
  joints.neck0 = nRoot;
  joints.neck1 = neckAt(0.5);
  joints.head = end;
  let neckCap = Infinity;
  // A short neck that climbs steeply from the chest to the head (pigs, warthogs) can face its rings along the neck:
  // with tangents from their neighbours they tilt back so far that their tops sink into the shoulders, leaving a
  // groove behind the head. Opt-in, since the tilt rounds other short necks (bears, tapirs) nicely into the chest.
  const alignNeck = !!M.alignNeck && a < 0.9;
  if (a < 0.9) {
    const last = keys[keys.length - 1];
    const n0 = neckAt(0.12);
    // A long, low neck (bears) blends out of the body over two rings, so no crease forms where they meet.
    // The radius eases from the body's down to the neck's (a smoothstep), so the chest rounds into the neck.
    const blend = M.neckBlend ? [0.25, 0.5, 0.75] : [0.5];
    for (const t of blend) {
      const e = t * t * (3 - 2 * t);
      // A back crest (warthog) runs on over the blend into the neck's, without a dip between them.
      const ridgeOn = crestBack && { shape: crestShape(lerp(crestBack.h, M.crest ?? crestBack.h, t)), ch: ridge };
      keys.push({ c: v3.lerp(last.c, n0, t), a: lerp(last.a, nk.r * 1.3, e * 0.9), b: lerp(last.b, nk.r * 1.35, e * 0.9), w: { chest: 1 - t * 0.3, neck0: t * 0.3 }, ...(alignNeck ? { t: v3.norm(v3.lerp([0, 0, 1], dir, t)) } : {}), ...ridgeOn });
    }
    // The neck's first ring stays inside the body's front, so the neck doesn't bulge out of the chest.
    neckCap = Math.min(last.a, last.b) * 0.92;
  }
  const crest = M.crest ?? 0;
  const maneR = mane?.r ?? 0;
  // Short, thick necks (pigs, tapirs, bears) are one ring between the body and the head, so no collar shows.
  const neckRings =
    nk.len < 0.12
      ? [{ t: 0.4, r: lerp(nk.r, Math.max(hd.w, hd.h) * 0.85, 0.5), w: { chest: 0.3, neck0: 0.5, neck1: 0.2 } }]
      : [
          { t: 0.12, r: nk.r * 1.28, w: { chest: 0.45, neck0: 0.55 } },
          { t: 0.5, r: lerp(nk.r, r2, 0.45), w: { neck0: 0.7, neck1: 0.3 } },
          { t: 0.86, r: lerp(nk.r, r2, 0.85), w: { neck0: 0.2, neck1: 0.8 } },
        ];
  const neckScale = M.neckScale ?? 1;
  // The neck narrows into the back of the head, so the head doesn't sit in a collar (bears).
  const headR = Math.max(hd.w, hd.h) * 0.95;
  for (const n of neckRings) {
    const r = Math.min(neckCap, lerp(n.r, Math.min(n.r, headR), n.t));
    keys.push({
      c: neckAt(n.t),
      a: r * neckScale,
      b: r * 1.04 * neckScale,
      w: n.w,
      ch: mane ? { MANE: 1, RIDGE: -3 } : crest ? (co, si) => ({ ...ridge(co, si), PS: lerp(1, 0.7, n.t) }) : wool?.neck ? { FUR: 1, PS: lerp(1, 0.7, n.t) } : { PS: lerp(1, 0.7, n.t) },
      shape: wool?.neck ? lumps(woolR * lerp(1, 0.6, n.t), wool.lumps ?? 0.5) : crest ? crestShape(crest) : undefined,
      ...(alignNeck ? { t: dir } : {}),
    });
  }
  // Head: along its own axis, pitched down from horizontal.
  const p = M.head?.pitch ?? 0.2;
  const hdir = [0, -Math.sin(p), Math.cos(p)];
  const hup = [0, Math.cos(p), Math.sin(p)];
  const at = (along, up) => v3.add(end, v3.add(v3.mul(hdir, along), v3.mul(hup, up)));
  const drop = sn.drop ?? hd.h * 0.25;
  const headRings = (HEADS[L.plan] ?? HEADS.hoof)(hd, sn, drop, M.head ?? {});
  const H = Object.fromEntries(headRings.map(([name, along, up, ra, rb]) => [name, { along, up, ra, rb }]));
  for (const [name, along, up, ra, rb] of headRings) {
    const w = name === 'H0' ? { neck1: 0.35, head: 0.65 } : name === 'S1' && trunk ? { head: 0.8, trunk0: 0.2 } : { head: 1 };
    // Ears grow between H0 and H1, ossicones after H1, tusks after S0.
    const hold = name === 'H1' || name === 'H0' || (name === 'S0' && !!ex.tusks);
    keys.push({ name, hold, c: at(along, up), a: ra, b: rb, w, ch: { PS: 0.75 }, ...(name === 'H0' && alignNeck ? { t: v3.norm(v3.add(dir, hdir)) } : {}) });
  }
  if (trunk) {
    const base = keys[keys.length - 1].c;
    const tlen = trunk.len * (M.trunk ?? 1);
    const pts = trunk.curve.map(([y, z]) => v3.add(base, [0, y * tlen, z * tlen]));
    const tr2 = trunk.r2 ?? trunk.r * 0.45;
    joints.trunk0 = pts[0];
    joints.trunk1 = v3.lerp(pts[1], pts[2], 0.5);
    joints.trunk2 = pts[3];
    pts.slice(1).forEach((c, i, arr) => {
      const t = (i + 1) / arr.length;
      const w = t < 0.35 ? { trunk0: 1 - t, trunk1: t } : t < 0.7 ? { trunk1: 1.4 - t, trunk2: t - 0.3 } : { trunk2: 1 };
      keys.push({ c, a: lerp(trunk.r, tr2, t), b: lerp(trunk.r, tr2, t), w });
    });
  }
  // Half-width of the torso and neck (head excluded) at a point, from the key rings: what flat ears hang over.
  const bodyKeys = keys.slice(0, keys.findIndex((k) => k.name === 'H0'));
  const bodyHalfWidth = (z, y) => {
    let w = 0;
    for (let i = 0; i + 1 < bodyKeys.length; i++) {
      const A = bodyKeys[i];
      const B = bodyKeys[i + 1];
      if ((z - A.c[2]) * (z - B.c[2]) > 0 || A.c[2] === B.c[2]) continue;
      const t = (z - A.c[2]) / (B.c[2] - A.c[2]);
      const d = (y - lerp(A.c[1], B.c[1], t)) / lerp(A.b, B.b, t);
      if (Math.abs(d) < 1) w = Math.max(w, lerp(A.a, B.a, t) * Math.sqrt(1 - d * d));
    }
    return w;
  };
  const spineKeys = resample(keys, q.step);
  // Head rings use the head's up axis as their "side" reference (all rings use +x; the spine stays in the y-z plane).
  const spine = [];
  let arc = 0;
  const arcs = [];
  spineKeys.forEach((k, i) => {
    if (i) arc += v3.len(v3.sub(k.c, spineKeys[i - 1].c));
    arcs.push(arc);
  });
  // SNOUT: distance back from the nose ring (S1); negative along a trunk.
  const nose = arcs[spineKeys.findIndex((k) => k.name === 'S1')];
  const named = {};
  const tilt = M.paint?.pattern?.tilt ?? 0;
  spineKeys.forEach((k, i) => {
    const ring = cage.ring({ ...k, ch: k.ch ?? {} });
    const { U } = ring.frame;
    for (const vi of ring) {
      const off = v3.sub(cage.pos(vi), k.c);
      const up = v3.dot(off, U);
      cage.set(vi, 'UNDER', -up / (k.b * 1.1));
      cage.set(vi, 'S', arcs[i] + tilt * up);
      cage.set(vi, 'SNOUT', nose - arcs[i]);
    }
    spine.push(ring);
    if (k.name) named[k.name] = ring;
  });
  cage.tube(spine);
  const tailRoot = cage.faceBetween(spine[0], spine[1], 1);

  // ---- Legs ------------------------------------------------------------------------------------------------------
  const profiles = LEGS[L.plan] ?? LEGS.hoof;
  const legInfo = [];
  for (const [front, A, B] of [[true, named.shA, spineAfter(spine, named.shA)], [false, named.hipA, spineAfter(spine, named.hipA)]]) {
    for (const side of [1, -1]) {
      const name = `${front ? 'F' : 'B'}${side > 0 ? 'R' : 'L'}`;
      const fi = cage.faceBetween(A, B, side > 0 ? 6 : 4);
      const f = cage.faces[fi];
      const fc = v3.mul(f.map((i) => cage.pos(i)).reduce(v3.add), 0.25);
      const fS = f.reduce((s, i) => s + cage.ch(i, 'S'), 0) / 4;
      const spec = { ...lg, ...(front ? lg.front : lg.back) };
      const r = spec.r * (L.plan === 'hoof' ? 1.15 : 1);
      const x = fc[0] * 0.9;
      // The thigh starts higher, inside the rump, so the two round into each other; short legs start inside the
      // body too, so their tops don't show as a disc under the belly.
      const top = fc[1] - b.h * ((front ? 0.12 : 0.02) * longLegs - (1 - longLegs) * 0.12);
      const len = top;
      const parent = front ? 'chest' : 'hips';
      const prof = profiles[front ? 'front' : 'back'];
      const legFreq = M.paint?.pattern?.legFreq ?? 1;
      // Ring heights are shares of the leg length; under a deep body (short legs) they squeeze in below the top ring,
      // so the knee never sits above the hip and the leg doesn't fold back on itself.
      const hMax = Math.max(...prof.map((pr) => (pr.h === 'top' ? 0 : pr.h)));
      const yScale = Math.min(lg.len, (top * 0.85) / hMax);
      const legKeys = prof.map((pr) => {
        const y = pr.h === 'top' ? top : pr.h * yScale;
        const [wb, wu, wl, wf] = pr.w;
        return {
          // The thigh reaches back to the rump (a share of the body). Short legs under a deep body (bears, pigs)
          // reach back less, or the thigh would bulge out below the rump.
          c: [x, y, fc[2] + pr.z * lg.len - (!front && pr.h === 'top' ? b.l * (torso.thigh ?? 0.2) * longLegs ** 2 : 0)],
          a: r * pr.a,
          // A short hind leg's thigh is shorter along the body, or its back would poke out below the rump.
          b: r * pr.b * (!front && pr.h === 'top' ? lerp(0.6, 1, longLegs) : 1),
          w: { [parent]: wb, [`upper${name}`]: wu, [`lower${name}`]: wl, [`foot${name}`]: wf },
          ch: { S: fS + (top - y) * legFreq, UNDER: -0.3, LEG: 1, PS: lerp(0.65, 0.95, y / top) },
          hold: pr.h !== 'top' && pr.h < 0.15,
          // The top ring lies flat under the body (not tilted towards the next ring, which can sit well forward).
          ...(pr.h === 'top' ? { t: [0, -1, 0] } : {}),
        };
      });
      const rings = cage.extrude(fi, resample(legKeys, q.legStep));
      // Joints: shoulder or hip inside the body, then the elbow/stifle and the fetlock/hock rings' centres.
      joints[`upper${name}`] = [x, bodyY - b.h * 0.25 + lift(fc[2]), fc[2]];
      joints[`lower${name}`] = legKeys[1].c;
      joints[`foot${name}`] = legKeys[front ? 3 : 2].c;
      legInfo.push({ name, front, side, len });
      void rings;
    }
  }

  // ---- Tail --------------------------------------------------------------------------------------------------------
  const tl = L.tail ?? { kind: 'stub' };
  {
    const f = cage.faces[tailRoot];
    const fc = v3.mul(f.map((i) => cage.pos(i)).reduce(v3.add), 0.25);
    const fS = f.reduce((s, i) => s + cage.ch(i, 'S'), 0) / 4;
    const len = tl.len ?? (tl.kind === 'stub' ? (tl.r ?? 0.04) * 2.2 : 0.2);
    const r = tl.kind === 'bushy' ? (tl.r ?? len * 0.07) : (tl.r ?? len * 0.06);
    const profile = TAIL_PROFILE[tl.kind] ?? ((t) => lerp(1.7, 1, Math.min(1, t * 2.5)));
    const path = (TAILS[tl.kind] ?? TAILS.tuft).map((pt) => v3.add(fc, v3.mul(pt, len)));
    const tipLen = path.reduce((s, pt, i) => (i ? s + v3.len(v3.sub(pt, path[i - 1])) : 0), 0);
    let d = 0;
    const tufted = M.tailTuft ?? (tl.kind === 'tuft' || (tl.tip && (tl.kind === 'long' || tl.kind === 'up')));
    // Ringed tails: a periodic field along the tail (seven bands), painted by a marking on AUX. It is set after the
    // rings are spaced out (resample would interpolate it linearly between the key rings).
    const bands = tl.kind === 'ringed' ? (2 * Math.PI * 3.5) / tipLen : 0;
    const tk = path.map((c, i) => {
      if (i) d += v3.len(v3.sub(c, path[i - 1]));
      const t = d / tipLen;
      const rr = r * profile(t);
      const w = t < 0.3 ? { hips: 0.6 - t, tail0: 0.4 + t } : t < 0.65 ? { tail0: 0.65 - t, tail1: t } : { tail1: 1 - t, tail2: t };
      return { c, a: rr, b: rr, w, ch: { TAIL: tipLen - d, S: fS + d * 1.2 } };
    });
    joints.tail0 = path[1];
    joints.tail1 = path[Math.floor(path.length / 2)];
    joints.tail2 = path[path.length - 2];
    if (tufted) {
      // A tuft: the end of the tail swells into a teardrop.
      const last = tk[tk.length - 1];
      const prev = tk[tk.length - 2];
      const along = v3.norm(v3.sub(last.c, prev.c));
      const tuftLen = len * 0.22;
      tk.pop();
      tk.push({ ...last, c: v3.sub(last.c, v3.mul(along, tuftLen * 0.75)), a: r * 1.1, b: r * 1.1, ch: { TAIL: tuftLen * 0.85, S: last.ch.S } });
      tk.push({ ...last, c: v3.sub(last.c, v3.mul(along, tuftLen * 0.4)), a: r * 2.3, b: r * 2.3, ch: { TAIL: tuftLen * 0.45, S: last.ch.S } });
      tk.push({ ...last, c: last.c, a: r * 1.6, b: r * 1.6, ch: { TAIL: 0, S: last.ch.S } });
    }
    // Tails bend smoothly and are thin: sparser rings than the legs.
    const tailRings = resample(tk, Math.min(q.legStep * 1.5, bands ? tipLen / 28 : Infinity));
    cage.extrude(tailRoot, tailRings.map((k) => ({ ...k, s: [1, 0, 0], ch: bands ? { ...k.ch, AUX: Math.sin((tipLen - k.ch.TAIL) * bands) } : k.ch })));
  }

  // ---- Head parts: ears, ossicones, tusks; eyes --------------------------------------------------------------------
  const ears = M.ears ?? (L.ears?.kind === 'big' ? { kind: 'flap', size: L.ears.size } : L.ears) ?? { kind: 'round', size: hd.h * 0.6 };
  const es = ears.size ?? L.ears?.size ?? hd.h * 0.6;
  const earRings = [named.H0, spineAfter(spine, named.H0)];
  for (const side of [1, -1]) {
    const bone = side > 0 ? 'earR' : 'earL';
    const k = ears.kind === 'side' || ears.kind === 'flap' || ears.kind === 'floppy' ? (side > 0 ? 7 : 3) : side > 0 ? 0 : 2;
    const fi = cage.faceBetween(earRings[0], earRings[1], k);
    const f = cage.faces[fi];
    const fc = v3.mul(f.map((i) => cage.pos(i)).reduce(v3.add), 0.25);
    joints[bone] = fc;
    const w = { head: 0.15, [bone]: 0.85 };
    const fS = f.reduce((s, i) => s + cage.ch(i, 'S'), 0) / 4;
    const front = (sideSign) => (co, si) => ({ EAR: si * sideSign > 0.3 ? 1 : -1, S: fS });
    let specs;
    if (ears.kind === 'round' || ears.kind === 'small') {
      // Through a mane the ears grow on a stalk (hidden in the hair), so they show above it.
      const t = v3.norm([side * 0.45, 1, -0.15]);
      const lift = mane ? maneR * (mane.earLift ?? 0.6) : 0;
      specs = [
        { c: v3.add(fc, v3.mul(t, es * 0.15)), t, s: [1, 0, 0], a: es * (mane ? 0.42 : 0.34), b: es * (mane ? 0.24 : 0.16), w, ch: { S: fS } },
        { c: v3.add(fc, v3.mul(t, es * 0.5 + lift)), t, s: [1, 0, 0], a: es * 0.5, b: es * 0.13, w, ch: front(-1) },
        { c: v3.add(fc, v3.mul(t, es * 0.78 + lift)), t, s: [1, 0, 0], a: es * 0.36, b: es * 0.1, w, ch: { S: fS } },
      ];
    } else if (ears.kind === 'long') {
      // Rabbits and donkeys: tall, spoon-shaped, leaning back.
      const t = v3.norm([side * (ears.splay ?? 0.2) * 1.5, 1, -(ears.back ?? 0.3)]);
      specs = [
        { c: v3.add(fc, v3.mul(t, es * 0.1)), t, s: [1, 0, 0], a: es * 0.14, b: es * 0.1, w, ch: { S: fS } },
        { c: v3.add(fc, v3.mul(t, es * 0.4)), t, s: [1, 0, 0], a: es * 0.2, b: es * 0.07, w, ch: front(-1) },
        { c: v3.add(fc, v3.mul(t, es * 0.8)), t, s: [1, 0, 0], a: es * 0.19, b: es * 0.06, w, ch: front(-1) },
        { c: v3.add(fc, v3.mul(t, es * 1.08)), t, s: [1, 0, 0], a: es * 0.09, b: es * 0.04, w, ch: front(-1) },
        { c: v3.add(fc, v3.mul(t, es * 1.18)), t, s: [1, 0, 0], a: es * 0.02, b: es * 0.02, w, ch: { S: fS } },
      ];
    } else if (ears.kind === 'floppy') {
      // Sheep, goats and pigs: flat ears hanging out and down from the sides of the head.
      const droop = ears.droop ?? 0.45;
      const P = (x, y, z) => v3.add(fc, v3.mul([side * x, y, z], es));
      const t = v3.norm([side, -droop * 1.4, 0.1]);
      specs = [
        { c: P(0.1, 0.02, 0), t: [side, 0, 0], s: [0, 0, 1], a: es * 0.18, b: es * 0.09, w, ch: { S: fS } },
        { c: P(0.38, -0.1 * droop * 2, 0.04), t, s: [0, 0, 1], a: es * 0.26, b: es * 0.06, w, ch: front(side) },
        { c: P(0.62, -0.32 * droop * 2, 0.06), t, s: [0, 0, 1], a: es * 0.24, b: es * 0.05, w, ch: front(side) },
        { c: P(0.74, -0.46 * droop * 2, 0.06), t, s: [0, 0, 1], a: es * 0.08, b: es * 0.03, w, ch: { S: fS } },
      ];
    } else if (ears.kind === 'pointy') {
      const t = v3.norm([side * 0.4, 1, -0.3]);
      specs = [
        { c: v3.add(fc, v3.mul(t, es * 0.15)), t, s: [1, 0, 0], a: es * 0.24, b: es * 0.14, w, ch: { S: fS } },
        { c: v3.add(fc, v3.mul(t, es * 0.55)), t, s: [1, 0, 0], a: es * 0.3, b: es * 0.1, w, ch: front(-1) },
        { c: v3.add(fc, v3.mul(t, es * 1.0)), t, s: [1, 0, 0], a: es * 0.16, b: es * 0.06, w, ch: front(-1) },
        { c: v3.add(fc, v3.mul(t, es * 1.25)), t, s: [1, 0, 0], a: es * 0.03, b: es * 0.03, w, ch: { S: fS } },
      ];
    } else if (ears.kind === 'side') {
      const t = v3.norm([side, 0.35, -0.25]);
      specs = [
        { c: v3.add(fc, v3.mul(t, es * 0.15)), t, s: [0, 1, 0], a: es * 0.2, b: es * 0.14, w, ch: { S: fS } },
        { c: v3.add(fc, v3.mul(t, es * 0.55)), t, s: [0, 1, 0], a: es * 0.32, b: es * 0.1, w, ch: front(side) },
        { c: v3.add(fc, v3.mul(t, es * 1.0)), t, s: [0, 1, 0], a: es * 0.16, b: es * 0.06, w, ch: front(side) },
        { c: v3.add(fc, v3.mul(t, es * 1.25)), t, s: [0, 1, 0], a: es * 0.03, b: es * 0.03, w, ch: { S: fS } },
      ];
    } else {
      // Elephant: a big flat flap hanging back along the side of the head.
      const t = v3.norm([side * 0.55, -0.05, -1]);
      const out = [side, 0, 0];
      const c = (along, o, dy) => v3.add(fc, v3.add(v3.mul(t, along), v3.add(v3.mul(out, o), [0, dy, 0])));
      specs = [
        { c: c(0.02, 0.02, 0), t, s: [0, 1, 0], a: es * 0.3, b: 0.05, w, ch: { S: fS } },
        { c: c(es * 0.25, 0.05, -es * 0.1), t, s: [0, 1, 0], a: es * 0.85, b: 0.035, w, ch: front(side) },
        { c: c(es * 0.7, 0.07, -es * 0.25), t, s: [0, 1, 0], a: es * 0.9, b: 0.03, w, ch: front(side) },
        { c: c(es * 1.0, 0.08, -es * 0.4), t, s: [0, 1, 0], a: es * 0.45, b: 0.025, w, ch: { S: fS } },
      ];
      // The flap hangs over the neck and the shoulder, so it stands off them at every height it covers instead
      // of cutting into the body. Its back half follows the neck a little, so it stays clear when the head turns.
      for (const sp of specs.slice(1)) {
        let need = 0;
        for (let k = -1; k <= 1; k += 0.25) need = Math.max(need, bodyHalfWidth(sp.c[2], sp.c[1] + k * sp.a));
        sp.c = [side * Math.max(Math.abs(sp.c[0]), need + es * 0.08), sp.c[1], sp.c[2]];
      }
      specs[2].w = { head: 0.15, neck1: 0.15, [bone]: 0.7 };
      specs[3].w = { head: 0.1, neck1: 0.25, neck0: 0.1, [bone]: 0.55 };
    }
    cage.extrude(fi, specs);
  }
  if (ex.ossicones) {
    const o = ex.ossicones;
    for (const side of [1, -1]) {
      const fi = cage.faceBetween(named.H1, spineAfter(spine, named.H1), side > 0 ? 0 : 2);
      const f = cage.faces[fi];
      const fc = v3.mul(f.map((i) => cage.pos(i)).reduce(v3.add), 0.25);
      const t = v3.norm([side * 0.2, 1, -0.15]);
      const w = { head: 1 };
      const L0 = o.len * 1.2;
      cage.extrude(fi, [
        { c: v3.add(fc, v3.mul(t, L0 * 0.3)), t, a: o.r * 1.1, b: o.r * 1.1, w, ch: { TIP: L0 } },
        { c: v3.add(fc, v3.mul(t, L0 * 0.75)), t, a: o.r * 0.9, b: o.r * 0.9, w, ch: { TIP: L0 * 0.35 } },
        { c: v3.add(fc, v3.mul(t, L0 * 0.95)), t, a: o.r * 1.3, b: o.r * 1.3, w, ch: { TIP: 0.02 } },
        { c: v3.add(fc, v3.mul(t, L0 * 1.08)), t, a: o.r * 0.8, b: o.r * 0.8, w, ch: { TIP: 0 } },
      ]);
    }
  }
  if (ex.horns) {
    // Goats: horns sweeping up and back from the top of the head.
    const h = ex.horns;
    const sz = h.size;
    for (const side of [1, -1]) {
      const fi = cage.faceBetween(named.H1, spineAfter(spine, named.H1), side > 0 ? 0 : 2);
      const fc = faceCentre(cage, fi);
      const pts = (h.curve ?? [[0, 0, 0], [0.06, 0.45, -0.2], [0.14, 0.62, -0.62], [0.22, 0.45, -0.98]]).map(([x, y, z]) => v3.add(fc, [side * x * sz, y * sz, z * sz]));
      const r = h.r ?? sz * 0.11;
      cage.extrude(fi, horn(pts, r, r * 0.2, { head: 1 }, 0.1 * sz));
    }
  }
  if (ex.antlers) {
    // Reindeer: a beam up and back then forward, two tines off it, and a brow tine over the face.
    const sz = ex.antlers.size;
    const r = ex.antlers.r ?? sz * 0.035;
    for (const side of [1, -1]) {
      const fi = cage.faceBetween(named.H1, spineAfter(spine, named.H1), side > 0 ? 0 : 2);
      const fc = faceCentre(cage, fi);
      const beam = [[0, 0, 0], [0.12, 0.25, -0.18], [0.28, 0.55, -0.15], [0.32, 0.8, 0.05], [0.26, 0.98, 0.25]].map(([x, y, z]) => v3.add(fc, [side * x * sz, y * sz, z * sz]));
      const rings = cage.extrude(fi, horn(beam, r * 1.4, r * 0.55, { head: 1 }, r));
      for (const [i, len, up] of [[1, 0.24, 0.35], [3, 0.2, 0.5], [5, 0.2, 0.6]]) {
        if (!rings[i + 1]) continue;
        const tf = facingFace(cage, rings[i], rings[i + 1], [0, up, 1]);
        const tc = faceCentre(cage, tf);
        const tip = v3.add(tc, v3.mul(v3.norm([side * 0.05, up, 1]), len * sz));
        cage.extrude(tf, horn([tc, v3.lerp(tc, tip, 0.5), tip], r * 0.75, r * 0.3, { head: 1 }, r * 0.5).slice(1));
      }
    }
  }
  if (ex.beard) {
    // Goats: a tuft under the chin.
    const fi = cage.faceBetween(named.S0, spineAfter(spine, named.S0), 5);
    const fc = faceCentre(cage, fi);
    const len = ex.beard.len;
    cage.extrude(fi, [
      { c: v3.add(fc, [0, -len * 0.35, -len * 0.05]), t: [0, -1, -0.2], a: sn.w * 0.3, b: sn.w * 0.22, w: { head: 1 }, ch: { AUX: 1 } },
      { c: v3.add(fc, [0, -len * 0.9, -len * 0.15]), t: [0, -1, -0.2], a: sn.w * 0.16, b: sn.w * 0.12, w: { head: 1 }, ch: { AUX: 1 } },
      { c: v3.add(fc, [0, -len * 1.1, -len * 0.2]), t: [0, -1, -0.2], a: sn.w * 0.04, b: sn.w * 0.04, w: { head: 1 }, ch: { AUX: 1 } },
    ]);
  }
  if (ex.topknot) {
    // Sheep and alpacas: a woolly tuft on the crown.
    const fi = cage.faceBetween(named.H0, spineAfter(spine, named.H0), 1);
    const fc = faceCentre(cage, fi);
    const r = hd.w * (ex.topknot.size ?? 0.45);
    const t = v3.norm(v3.add(hup, v3.mul(hdir, 0.3)));
    cage.extrude(fi, [
      { c: v3.add(fc, v3.mul(t, r * 0.35)), t, a: r * 1.1, b: r * 1.1, w: { head: 1 }, ch: { FUR: 1 } },
      { c: v3.add(fc, v3.mul(t, r * 0.8)), t, a: r * 0.85, b: r * 0.85, w: { head: 1 }, ch: { FUR: 1 } },
    ]);
  }
  if (ex.tusks) {
    const tu = ex.tusks;
    for (const side of [1, -1]) {
      const fi = cage.faceBetween(named.S0, spineAfter(spine, named.S0), side > 0 ? 6 : 4);
      const f = cage.faces[fi];
      const fc = v3.mul(f.map((i) => cage.pos(i)).reduce(v3.add), 0.25);
      const pts = (tu.curve ?? [[0, 0, 0], [0.15, 0.2, 0.55], [0.3, 0.75, 0.85]]).map(([x, y, z]) => v3.add(fc, [side * x * tu.len, y * tu.len, z * tu.len]));
      const specs = pts.slice(1).map((c, i, arr) => ({ c, a: lerp(tu.r, tu.r * 0.4, (i + 1) / arr.length), b: lerp(tu.r, tu.r * 0.4, (i + 1) / arr.length), w: { head: 1 }, ch: { TUSK: 1 } }));
      specs.unshift({ c: v3.lerp(fc, pts[1], 0.15), a: tu.r * 1.15, b: tu.r * 1.15, w: { head: 1 }, ch: { TUSK: -0.2 } });
      cage.extrude(fi, resample(specs, 1e9));
    }
  }

  if (mane) {
    // The ruff frames the face: its front edge runs over the forehead in front of the ears, down the cheeks like
    // sideburns and under the jaw, then it sweeps back over the neck to the withers and hangs down the chest.
    const sh = keys.find((k) => k.name === 'shB');
    ruff(cage, {
      head: (along) => headSection(headRings, along, at),
      edge: { top: (mane.edge ?? 0.08) * hd.l, side: (mane.edge ?? 0.08) * hd.l, chin: H.H3.along - 0.12 * hd.l },
      headLen: hd.l,
      U: hup,
      neck: { c: neckAt(0.45), r: nk.r },
      shoulder: { c: sh.c, a: sh.a, b: sh.b },
      back: b.l * 0.3,
      out: maneR,
      hang: (mane.chest ?? 0.6) * b.h,
      n: 12,
      lobe: mane.lobe ?? 0.45,
    });
  }

  // Eyes are placed on the subdivided surface (index.js): where the head faces the eye's direction, within a band
  // along the head.
  const ey = M.eye ?? { t: 0.5, ang: 0.4, fwd: 0.3 };
  const eyeAlong = lerp(H.H1.along, H.H3.along, ey.t);
  const eyes = {
    snout: H.S1.along - eyeAlong,
    band: 0.12 * hd.l,
    size: (L.eyes?.size ?? hd.h * 0.2) * (M.eyeScale ?? 1.45),
    dirs: [1, -1].map((side) => v3.norm(v3.add(v3.add(v3.mul([side, 0, 0], Math.cos(ey.ang)), v3.mul(hup, Math.sin(ey.ang))), v3.mul(hdir, ey.fwd ?? 0.3)))),
    hup,
    hdir,
  };
  // A nose pad on the tip of the snout (not for trunks): flat for pigs and warthogs, a small cushion otherwise.
  if (L.nose && !trunk) {
    const disc = L.nose.kind === 'disc';
    eyes.nose = disc
      ? { dir: hdir, a: sn.w * 0.72, b: sn.h * 0.68, d: sn.l * 0.18, band: sn.l * 0.3 }
      : { dir: v3.norm(v3.add(hdir, v3.mul(hup, 0.55))), a: sn.w * (M.nose?.w ?? 0.42), b: sn.h * (M.nose?.h ?? 0.26), d: sn.h * 0.16, band: sn.l * 0.45 };
  }

  const headLen = H.S1.along - H.H0.along;
  return { cage, joints, parents, eyes, info: { kind: 'mesh-quad', legs: legInfo, legLen: lg.len, bodyH: b.h, bodyL: b.l, neckLen: nk.len, headLen, gait: L.gait ?? 'walk', stance: L.stance ?? null, headTurn: ears.kind === 'flap' ? 0.3 : 1 } };
}

/** The head's cross-section at a distance along its axis (between the head rings): centre and half sizes. */
function headSection(rings, along, at) {
  let i = 0;
  while (i + 2 < rings.length && rings[i + 1][1] < along) i++;
  const [, a0, u0, ra0, rb0] = rings[i];
  const [, a1, u1, ra1, rb1] = rings[i + 1];
  const t = clamp01((along - a0) / (a1 - a0));
  return { c: at(along, lerp(u0, u1, t)), ra: lerp(ra0, ra1, t), rb: lerp(rb0, rb1, t) };
}

/**
 * A lion's mane: a lobed collar of hair, open at the face. Each of n sections around the head axis is a loop: from
 * the front edge (sunk into the face) out through short hair to the tuft, back over the neck and the shoulders, in
 * under the skin there and back to the edge inside the neck. Every other section reaches further out, so the rim
 * subdivides into soft tufts; the lower sections hang down the chest.
 */
function ruff(cage, { head, edge, headLen, U, neck, shoulder, back, out, hang, n, lobe, streaks = 16 }) {
  const X = [1, 0, 0];
  const UP = [0, 1, 0];
  // Tuft sizes around the face and reach over the shoulders: fixed, uneven rhythms so the mane doesn't look machined.
  // (Subdivision evens out section-to-section changes to about a third, so they are drawn large.)
  const RHYTHM = [1, 0.8, 1.05, 0.85, 0.95, 0.75];
  const REACH = [0.6, 1.5, 0.5, 1.4, 0.4, 1.3, 0.9];
  const secs = [];
  for (let i = 0; i < n; i++) {
    // Sections start under the chin; the streak coordinate (AUX) mirrors left and right, so it has no seam.
    const th = Math.PI + (i / n) * Math.PI * 2;
    const co = Math.cos(th);
    const si = Math.sin(th);
    const low = Math.max(0, -co);
    const top = Math.max(0, co);
    const odd = i % 2;
    // Tufts reach out on even sections; less on the crown (the ears show above it), more on the cheeks.
    const k = (odd ? 1 - 0.5 * lobe : (1 + lobe) * RHYTHM[(i / 2) % RHYTHM.length]) * (1 - 0.3 * top);
    // Behind the face the second row is staggered against the first.
    const k2 = (odd ? 1 + 0.5 * lobe : 1 - 0.3 * lobe) * (1 - 0.15 * top);
    const onHead = (along, s, r) => {
      const h = head(along);
      return v3.add(h.c, v3.add(v3.mul(U, co * (h.rb * s + r)), v3.mul(X, si * (h.ra * s + r))));
    };
    const around = (c, rb, ra) => v3.add(c, v3.add(v3.mul(UP, co * rb), v3.mul(X, si * ra)));
    // The edge: over the forehead, down the cheeks, and forward along the jaw to under the chin.
    const e = co >= 0 ? lerp(edge.side, edge.top, co) : lerp(edge.side, edge.chin, low ** 1.5);
    // The lower sections hang down the chest: in front, below the chin; behind, over the elbows.
    const sink = [0, -low * hang, 0];
    // How far back over the shoulders each section reaches: an uneven rhythm, mirrored left and right.
    const reach = REACH[Math.min(i, n - i) % REACH.length];
    const pts = [
      // The edge point sits deep in the head and a little ahead of the visible edge: subdivision pulls the surface
      // back towards its neighbours, and a shallow edge left a dark crevice between the face and the hair.
      [onHead(e + 0.12 * headLen, 0.62, 0), { head: 1 }, 0],
      [onHead(e - 0.12 * headLen, 1, out * 0.15 * k), { head: 1 }, 0.1],
      [onHead(e - 0.55 * headLen, 1, out * k), { head: 0.85, neck1: 0.15 }, 0.5],
      [v3.add(around(neck.c, neck.r + out * (0.85 + 0.2 * top) * k2, neck.r + out * 0.75 * k2), [0, -low * hang * 0.6, low * out * 0.6]), { neck1: 0.4, neck0: 0.6 }, 0.8],
      [v3.add(around(v3.add(shoulder.c, [0, 0, -back * reach * 0.4]), shoulder.b + out * 0.6 * k2, shoulder.a + out * 0.5 * k2), sink), { chest: 0.85, neck0: 0.15 }, 1],
      // A thin layer just over the coat carries the hair back to its ragged edge (without it, subdivision would pull
      // the surface under the skin long before the edge), then the loop turns in under the skin.
      [v3.add(around(v3.add(shoulder.c, [0, 0, -back * reach]), shoulder.b + out * 0.32, shoulder.a + out * 0.3), v3.mul(sink, 0.8)), { chest: 1 }, 1],
      [v3.add(around(v3.add(shoulder.c, [0, 0, -back * (reach + 0.3)]), shoulder.b * 0.8, shoulder.a * 0.8), v3.mul(sink, 0.5)), { chest: 1 }, 0],
    ];
    const phi = i / n;
    secs.push(pts.map(([p, w, fur], q) => cage.vert(p, w, { MANE: 1, FUR: Math.min(1, fur * (1 + 0.3 * low)), UNDER: -co, PS: 0.7, AUX: streaks * Math.min(phi, 1 - phi) + (q ? 0.5 * Math.sin(i * 2.3 + q * 1.9) : 0) })));
  }
  const m = secs[0].length;
  const faces = [];
  for (let i = 0; i < n; i++) {
    const a = secs[i];
    const b = secs[(i + 1) % n];
    for (let q = 0; q < m; q++) faces.push([a[q], a[(q + 1) % m], b[(q + 1) % m], b[q]]);
  }
  // Outward winding: the enclosed volume must come out positive.
  let vol = 0;
  for (const f of faces) {
    const [p0, p1, p2, p3] = f.map((i) => cage.pos(i));
    vol += v3.dot(p0, v3.cross(p1, p2)) + v3.dot(p0, v3.cross(p2, p3));
  }
  for (const f of faces) cage.face(...(vol < 0 ? f.reverse() : f));
}

/** Centre of a cage face. */
function faceCentre(cage, fi) {
  const f = cage.faces[fi];
  return v3.mul(f.map((i) => cage.pos(i)).reduce(v3.add), 1 / f.length);
}

/** The face between two rings that faces most along `dir`. */
function facingFace(cage, r1, r2, dir) {
  let best = -1;
  let bestD = -Infinity;
  const c = v3.mul(r1.map((i) => cage.pos(i)).reduce(v3.add), 1 / r1.length);
  for (let k = 0; k < r1.length; k++) {
    const fi = cage.faceBetween(r1, r2, k);
    const d = v3.dot(v3.norm(v3.sub(faceCentre(cage, fi), c)), v3.norm(dir));
    if (d > bestD) {
      bestD = d;
      best = fi;
    }
  }
  return best;
}

/** Ring specs along a horn's centre line (first point = the face it grows from), tapering r0 → r1; TUSK paints it. */
function horn(pts, r0, r1, w, base) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += v3.len(v3.sub(pts[i], pts[i - 1]));
  let d = 0;
  return pts.slice(1).map((c, i) => {
    d += v3.len(v3.sub(c, pts[i]));
    const r = lerp(r0, r1, d / len);
    return { c, t: v3.sub(c, pts[i]), a: r, b: r, w, ch: { TUSK: d > base ? 1 : -1 } };
  });
}

/** Sums ring shape functions (falsy entries skipped). */
function combine(...fns) {
  const list = fns.filter(Boolean);
  return (co, si) => list.reduce((acc, f) => {
    const [a, b] = f(co, si);
    return [acc[0] + a, acc[1] + b];
  }, [0, 0]);
}

/** The spine ring after `ring`. */
function spineAfter(spine, ring) {
  return spine[spine.indexOf(ring) + 1];
}

export { CHANNELS };
