// Quadruped cage: one lofted tube from rump to nose (or trunk tip), with legs, tail, ears, ossicones and tusks
// extruded from its faces, and eye islands. Units are metres; the animal faces +z and stands on y = 0.
// Sizes come from the species look (../looks.js, radii and half-lengths); MESH_LOOKS adds the rest.

import { CHANNELS, Cage, FAR, resample, v3 } from './cage.js';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const lerp = (a, b, t) => a + (b - a) * t;

/** Torso shape per plan: belly sag (hoof), tuck towards the rump (cat), back slope towards the shoulders. */
const TORSO = {
  hoof: { sag: 0.08, tuck: 0.1, rump: 0.5 },
  cat: { sag: 0, tuck: 0.3, rump: 0.45 },
  pachy: { sag: 0.06, tuck: 0.05, rump: 0.6 },
};

/**
 * Torso rings along the body (z: share of the half length; y: centre offset, a/b: half width/height, both shares of
 * the body's). The back legs grow from the faces between hipA and the next ring, the front legs after shA.
 */
const TORSO_RINGS = {
  hoof: [
    { z: -1.0, y: 0.1, a: 0.42, b: 0.5 },
    { z: -0.86, y: 0.04, a: 0.86, b: 0.9 },
    { z: -0.58, y: 0.02, a: 1, b: 1, name: 'hipA', hold: true },
    { z: -0.22, y: 0, a: 0.94, b: 0.95, name: 'hipB' },
    { z: 0.08, y: 0, a: 0.96, b: 1, sag: 1 },
    { z: 0.36, y: 0, a: 0.97, b: 1.02, name: 'shA', hold: true },
    { z: 0.7, y: -0.03, a: 0.9, b: 1.04, name: 'shB' },
  ],
  cat: [
    { z: -1.0, y: 0.12, a: 0.45, b: 0.5 },
    { z: -0.86, y: 0.06, a: 0.86, b: 0.84 },
    { z: -0.58, y: 0.05, a: 0.95, b: 0.9, name: 'hipA', hold: true },
    { z: -0.22, y: 0.06, a: 0.86, b: 0.84, name: 'hipB' },
    { z: 0.08, y: 0.02, a: 0.94, b: 0.95 },
    { z: 0.36, y: -0.02, a: 1, b: 1.06, name: 'shA', hold: true },
    { z: 0.7, y: -0.04, a: 0.96, b: 1.08, name: 'shB' },
  ],
  pachy: [
    { z: -1.0, y: 0.06, a: 0.5, b: 0.6 },
    { z: -0.86, y: 0.02, a: 0.9, b: 0.94 },
    { z: -0.58, y: 0, a: 1, b: 1, name: 'hipA', hold: true },
    { z: -0.22, y: 0, a: 1, b: 1, name: 'hipB' },
    { z: 0.08, y: 0, a: 1, b: 1, sag: 1 },
    { z: 0.36, y: 0.02, a: 1, b: 1.02, name: 'shA', hold: true },
    { z: 0.7, y: 0.02, a: 0.95, b: 1, name: 'shB' },
  ],
};

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
      { h: 'top', a: 1.65, b: 2.5, z: -0.06, w: [0.45, 0.55, 0, 0] },
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
      { h: 'top', a: 1.71, b: 2.53, z: -0.06, w: [0.45, 0.55, 0, 0] },
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
      { h: 'top', a: 1.15, b: 1.35, z: -0.03, w: [0.45, 0.55, 0, 0] },
      { h: 0.6, a: 1.0, b: 1.05, z: 0.01, w: [0, 0.5, 0.5, 0] },
      { h: 0.32, a: 0.88, b: 0.9, z: -0.01, w: [0, 0, 1, 0] },
      { h: 0.1, a: 0.92, b: 0.95, z: 0, w: [0, 0, 0.3, 0.7] },
      { h: 0.0, a: 1.0, b: 1.02, z: 0, w: [0, 0, 0, 1] },
    ],
  },
};

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
    ['S0', 1.2 * hd.l + 0.9 * sn.l, -0.75 * drop, 1.04 * sn.w, 1.04 * sn.h],
    ['S1', 1.2 * hd.l + 1.65 * sn.l, -0.85 * drop, 0.9 * sn.w, 0.86 * sn.h],
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
};

/** Tail centre lines (× tail length), from the root. */
const TAILS = {
  tuft: [[0, 0, 0], [0, 0.01, -0.07], [0, -0.14, -0.2], [0, -0.42, -0.3], [0, -0.72, -0.34], [0, -0.86, -0.35]],
  long: [[0, 0, 0], [0, 0.0, -0.08], [0, -0.22, -0.24], [0, -0.48, -0.42], [0, -0.6, -0.68], [0, -0.52, -0.9], [0, -0.44, -0.98]],
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
  const hd = L.head;
  const sn = L.snout;
  const ex = L.extras ?? {};
  const torso = TORSO[L.plan] ?? TORSO.hoof;
  const bodyY = lg.len + b.h * 0.35;
  const slope = b.shape?.slope ?? (L.plan === 'hoof' && nk.angle > 1.05 ? 0.12 : 0);
  const lift = (z) => slope * b.h * (z / b.l);
  const mane = M.mane;
  const trunk = ex.trunk;

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
  for (const r of torsoRings) {
    const z = r.z * b.l;
    const tuck = clamp01((0.1 - r.z) / 1.1) * torso.tuck;
    const sag = (r.sag ?? 0) * torso.sag;
    const hipW = clamp01((0.35 - r.z) / 0.7);
    keys.push({
      name: r.name,
      hold: r.hold,
      c: [0, bodyY + r.y * b.h + lift(z), z],
      a: b.w * r.a,
      b: b.h * r.b,
      // Belly: sags in the middle (hoofed), tucks up towards the rump (cats).
      shape: (co, si) => [0, si < 0 ? b.h * (sag - tuck) * -si : 0],
      w: { hips: hipW, chest: 1 - hipW },
    });
  }
  // Neck.
  const a = nk.angle ?? 0.8;
  const dir = [0, Math.sin(a), Math.cos(a)];
  const nRoot = [0, bodyY + b.h * (nk.y ?? 0.45) + lift(b.l * (nk.z ?? 0.78)), b.l * (nk.z ?? 0.78)];
  const r2 = nk.r2 ?? nk.r * 0.75;
  const neckLen = nk.len * (M.neckLen ?? 1);
  const neckAt = (t) => v3.add(nRoot, v3.mul(dir, neckLen * t));
  const end = neckAt(1);
  joints.neck0 = nRoot;
  joints.neck1 = neckAt(0.5);
  joints.head = end;
  if (a < 0.9) {
    const last = keys[keys.length - 1];
    const n0 = neckAt(0.12);
    keys.push({ c: v3.lerp(last.c, n0, 0.5), a: lerp(last.a, nk.r * 1.3, 0.45), b: lerp(last.b, nk.r * 1.35, 0.45), w: { chest: 0.85, neck0: 0.15 } });
  }
  const crest = M.crest ?? 0;
  const ridge = (co, si) => ({ RIDGE: si > 0.85 ? 1 : si > 0.3 ? -2 : -3 });
  const crestShape = (h) => (co, si) => [0, si > 0.85 ? h : 0];
  const maneR = mane?.r ?? 0;
  // Mane rings alternate their vertices in and out (staggered ring to ring), which subdivides into soft tufts.
  let maneParity = 0;
  const maneShape = (extra, chest) => {
    const flip = (maneParity++ % 2) * 2 - 1;
    return (co, si) => {
      const k = Math.round((Math.atan2(si, co) - Math.PI / 8) / (Math.PI / 4));
      const e = extra * (1 + 0.16 * flip * (k % 2 ? 1 : -1));
      return [e, e + (si < 0 ? chest * -si : 0)];
    };
  };
  const neckRings = [
    { t: 0.12, r: nk.r * 1.28, w: { chest: 0.45, neck0: 0.55 }, m: 0.6 },
    { t: 0.5, r: lerp(nk.r, r2, 0.45), w: { neck0: 0.7, neck1: 0.3 }, m: 0.9 },
    { t: 0.86, r: lerp(nk.r, r2, 0.85), w: { neck0: 0.2, neck1: 0.8 }, m: 0.95 },
  ];
  const neckScale = M.neckScale ?? 1;
  for (const n of neckRings) {
    keys.push({
      c: neckAt(n.t),
      a: n.r * neckScale,
      b: n.r * 1.04 * neckScale,
      w: n.w,
      ch: mane ? { MANE: 1, RIDGE: -3 } : crest ? (co, si) => ({ ...ridge(co, si), PS: lerp(1, 0.7, n.t) }) : { PS: lerp(1, 0.7, n.t) },
      shape: mane ? maneShape(maneR * n.m, n.t < 0.3 ? mane.chest ?? 0 : 0) : crest ? crestShape(crest) : undefined,
    });
  }
  // Head: along its own axis, pitched down from horizontal.
  const p = M.head?.pitch ?? 0.2;
  const hdir = [0, -Math.sin(p), Math.cos(p)];
  const hup = [0, Math.cos(p), Math.sin(p)];
  const at = (along, up) => v3.add(end, v3.add(v3.mul(hdir, along), v3.mul(hup, up)));
  const drop = sn.drop ?? hd.h * 0.25;
  // Behind a mane the face moves forward, so it pokes out of the ruff.
  const faceShift = mane ? maneR * 0.75 : 0;
  const headRings = (HEADS[L.plan] ?? HEADS.hoof)(hd, sn, drop, M.head ?? {}).map(([n, al, ...r]) => [n, n === 'H0' ? al : al + faceShift, ...r]);
  const H = Object.fromEntries(headRings.map(([name, along, up, ra, rb]) => [name, { along, up, ra, rb }]));
  for (const [name, along, up, ra, rb] of headRings) {
    const w = name === 'H0' ? { neck1: 0.35, head: 0.65 } : name === 'S1' && trunk ? { head: 0.8, trunk0: 0.2 } : { head: 1 };
    const isMane = mane && name === 'H0';
    // Ears grow between H0 and H1 (between H1 and H2 behind a mane), ossicones after H1, tusks after S0.
    const hold = name === 'H1' || (name === 'H0' && !mane) || (name === 'S0' && !!ex.tusks);
    keys.push({ name, hold, c: at(along, up), a: ra, b: rb, w, ch: isMane ? { MANE: 1 } : { PS: 0.75 }, shape: isMane ? maneShape(maneR, 0) : undefined });
    if (isMane) {
      // The mane's front rim, just behind the face: the step from rim to face makes the ruff.
      const h1 = H.H1;
      keys.push({ name: 'Hm', hold: true, c: at(h1.along - 0.3 * hd.l, h1.up), a: h1.ra, b: h1.rb, w: { head: 1 }, ch: { MANE: 1 }, shape: maneShape(maneR * 0.9, 0) });
    }
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
      const top = fc[1] - b.h * 0.12;
      const len = top;
      const parent = front ? 'chest' : 'hips';
      const prof = profiles[front ? 'front' : 'back'];
      const legFreq = M.paint?.pattern?.legFreq ?? 1;
      const legKeys = prof.map((pr) => {
        const y = pr.h === 'top' ? top : pr.h * lg.len;
        const [wb, wu, wl, wf] = pr.w;
        return {
          c: [x, y, fc[2] + pr.z * lg.len],
          a: r * pr.a,
          b: r * pr.b,
          w: { [parent]: wb, [`upper${name}`]: wu, [`lower${name}`]: wl, [`foot${name}`]: wf },
          ch: { S: fS + (top - y) * legFreq, UNDER: -0.3, LEG: 1, PS: lerp(0.65, 0.95, y / top) },
          hold: pr.h !== 'top' && pr.h < 0.15,
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
  const tl = L.tail ?? { kind: 'stub', len: 0.1 };
  {
    const f = cage.faces[tailRoot];
    const fc = v3.mul(f.map((i) => cage.pos(i)).reduce(v3.add), 0.25);
    const fS = f.reduce((s, i) => s + cage.ch(i, 'S'), 0) / 4;
    const len = tl.len ?? 0.2;
    const r = tl.r ?? len * 0.06;
    const path = (TAILS[tl.kind] ?? TAILS.tuft).map((pt) => v3.add(fc, v3.mul(pt, len)));
    const tipLen = path.reduce((s, pt, i) => (i ? s + v3.len(v3.sub(pt, path[i - 1])) : 0), 0);
    let d = 0;
    const tufted = tl.kind === 'tuft' || tl.tip;
    const tk = path.map((c, i) => {
      if (i) d += v3.len(v3.sub(c, path[i - 1]));
      const t = d / tipLen;
      const rr = r * lerp(1.7, 1, Math.min(1, t * 2.5));
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
    cage.extrude(tailRoot, resample(tk, q.legStep).map((k) => ({ ...k, s: [1, 0, 0] })));
  }

  // ---- Head parts: ears, ossicones, tusks; eyes --------------------------------------------------------------------
  const ears = M.ears ?? { kind: 'round', size: hd.h * 0.6 };
  const es = ears.size ?? L.ears?.size ?? hd.h * 0.6;
  const earRings = mane ? [named.H1, spineAfter(spine, named.H1)] : [named.H0, spineAfter(spine, named.H0)];
  for (const side of [1, -1]) {
    const bone = side > 0 ? 'earR' : 'earL';
    const k = ears.kind === 'side' || ears.kind === 'flap' ? (side > 0 ? 7 : 3) : side > 0 ? 0 : 2;
    const fi = cage.faceBetween(earRings[0], earRings[1], k);
    const f = cage.faces[fi];
    const fc = v3.mul(f.map((i) => cage.pos(i)).reduce(v3.add), 0.25);
    joints[bone] = fc;
    const w = { head: 0.15, [bone]: 0.85 };
    const fS = f.reduce((s, i) => s + cage.ch(i, 'S'), 0) / 4;
    const front = (sideSign) => (co, si) => ({ EAR: si * sideSign > 0.3 ? 1 : -1, S: fS });
    let specs;
    if (ears.kind === 'round') {
      const t = v3.norm([side * 0.45, 1, -0.15]);
      specs = [
        { c: v3.add(fc, v3.mul(t, es * 0.15)), t, s: [1, 0, 0], a: es * 0.34, b: es * 0.16, w, ch: { S: fS } },
        { c: v3.add(fc, v3.mul(t, es * 0.5)), t, s: [1, 0, 0], a: es * 0.5, b: es * 0.13, w, ch: front(-1) },
        { c: v3.add(fc, v3.mul(t, es * 0.78)), t, s: [1, 0, 0], a: es * 0.36, b: es * 0.1, w, ch: { S: fS } },
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

  return { cage, joints, parents, eyes, info: { legs: legInfo, legLen: lg.len, bodyH: b.h, bodyL: b.l, neckLen: nk.len } };
}

/** The spine ring after `ring`. */
function spineAfter(spine, ring) {
  return spine[spine.indexOf(ring) + 1];
}

export { CHANNELS };
