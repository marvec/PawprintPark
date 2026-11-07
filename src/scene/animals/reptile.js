// Reptile cages: lizards (iguana, Komodo dragon) and tortoises, plus the lofting helpers the pinniped cage shares.
// Units are metres; the animal faces +z and stands on y = 0. Sizes come from the species look (looks.js).
//
// Lizards are one lofted tube from the tail tip to the nose, with sprawling legs (and an iguana's crest spikes)
// extruded from its faces. Tortoises are a skin tube (tail, body, neck, head, legs) under a shell that is a closed
// island of the same mesh: a dome revolved around the vertical axis, with a rim and a flat plastron.

import { Cage, lerpSpec, v3 } from './cage.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => Math.min(1, Math.max(0, x));

// ---- Shared helpers ------------------------------------------------------------------------------------------------

/**
 * Like cage.js resample, but each key's own `step` (metres) sets the ring spacing up to the next key, so a lizard's
 * body can be dense where its crest needs rings and its tail sparse.
 */
export function resampleVar(keys, step) {
  const out = [];
  for (let i = 0; i < keys.length; i++) {
    out.push(keys[i]);
    if (i + 1 === keys.length) break;
    const gap = v3.len(v3.sub(keys[i + 1].c, keys[i].c));
    const n = keys[i].hold ? 0 : Math.floor(gap / (keys[i].step ?? step));
    for (let j = 1; j <= n; j++) out.push({ ...lerpSpec(keys[i], keys[i + 1], j / (n + 1)), name: undefined, hold: false, inserted: true });
  }
  for (let i = 0; i < out.length; i++) {
    if (out[i].t && !out[i].inserted) continue;
    const prev = out[Math.max(0, i - 1)].c;
    const next = out[Math.min(out.length - 1, i + 1)].c;
    out[i] = { ...out[i], t: v3.sub(next, prev) };
  }
  return out;
}

/**
 * Lofts key rings (8 vertices each, tail end first, nose last) into the spine tube and fills the S, UNDER and SNOUT
 * channels: S runs along the spine, UNDER is 1 under the belly and -1 along the back, SNOUT is the distance back from
 * the nose (the last ring).
 * @returns {{ spine: number[][], named: Record<string, number[]>, keys: object[], arcs: number[] }}
 */
export function loftSpine(cage, keys, step) {
  const ks = resampleVar(keys, step);
  const arcs = [];
  let arc = 0;
  ks.forEach((k, i) => {
    if (i) arc += v3.len(v3.sub(k.c, ks[i - 1].c));
    arcs.push(arc);
  });
  const nose = arcs[arcs.length - 1];
  const spine = [];
  const named = {};
  ks.forEach((k, i) => {
    const ring = cage.ring({ ...k, ch: k.ch ?? {} });
    const { U } = ring.frame;
    for (const vi of ring) {
      const up = v3.dot(v3.sub(cage.pos(vi), k.c), U);
      cage.set(vi, 'UNDER', -up / (k.b * 1.1));
      cage.set(vi, 'S', arcs[i]);
      cage.set(vi, 'SNOUT', nose - arcs[i]);
    }
    spine.push(ring);
    if (k.name) named[k.name] = ring;
  });
  cage.tube(spine);
  return { spine, named, keys: ks, arcs };
}

/** Inserts `k - 1` interpolated rings between neighbouring limb rings (denser limbs for one subdivision level). */
export function densify(specs, k) {
  if (k <= 1) return specs;
  const out = [];
  specs.forEach((sp, i) => {
    out.push(sp);
    if (i + 1 < specs.length) for (let j = 1; j < k; j++) out.push({ ...lerpSpec(sp, specs[i + 1], j / k), t: undefined });
  });
  return out;
}

/** Centre of a cage face. */
export function faceCenter(cage, fi) {
  const f = cage.faces[fi];
  return v3.mul(f.map((i) => cage.pos(i)).reduce(v3.add), 1 / f.length);
}

/** Average of a channel over a face's corners. */
export function faceChannel(cage, fi, name) {
  const f = cage.faces[fi];
  return f.reduce((s, i) => s + cage.ch(i, name), 0) / f.length;
}

/** The spine ring after `ring`. */
export function after(spine, ring) {
  return spine[spine.indexOf(ring) + 1];
}

/**
 * Gives limb rings explicit frames, so a limb can bend from sideways to down to forward without twisting: the side
 * axis is carried along the limb (parallel transport). A ring with `flat` (a direction) turns its wide axis (a) that
 * way, snapping to the nearest quarter turn of the carried frame, so the ring order never jumps.
 * @param {number[]} start  where the limb leaves the body (the face centre)
 * @param {number[]} s0  the first ring's side axis
 */
export function limbFrames(specs, start, s0) {
  let S = s0;
  return specs.map((sp, i) => {
    const prev = i ? specs[i - 1].c : start;
    const next = i + 1 < specs.length ? specs[i + 1].c : sp.c;
    const t = v3.norm(sp.t ?? v3.sub(next, prev));
    S = v3.norm(v3.sub(S, v3.mul(t, v3.dot(S, t))));
    let { a, b } = sp;
    if (sp.flat) {
      const W = v3.norm(v3.sub(sp.flat, v3.mul(t, v3.dot(sp.flat, t))));
      const P = v3.cross(t, W);
      const cands = [[W, false], [P, true], [v3.mul(W, -1), false], [v3.mul(P, -1), true]];
      let best = cands[0];
      for (const c of cands) if (v3.dot(c[0], S) > v3.dot(best[0], S)) best = c;
      S = best[0];
      if (best[1]) [a, b] = [b, a];
    }
    return { ...sp, t, s: S, a, b };
  });
}

/**
 * Weights for a point at `u` along a chain of bones (bone i starts at stops[i]); neighbours blend over `blend`
 * either side of each joint, so the chain bends smoothly.
 */
export function chainWeights(u, names, stops, blend = 0.08) {
  let i = 0;
  while (i + 1 < stops.length && u >= stops[i + 1]) i++;
  const w = { [names[i]]: 1 };
  if (i > 0 && u - stops[i] < blend) {
    const f = 0.5 + (u - stops[i]) / (2 * blend);
    w[names[i]] = f;
    w[names[i - 1]] = 1 - f;
  } else if (i + 1 < stops.length && stops[i + 1] - u < blend) {
    const f = 0.5 + (stops[i + 1] - u) / (2 * blend);
    w[names[i]] = f;
    w[names[i + 1]] = 1 - f;
  }
  return w;
}

/**
 * Eye placement data for index.js: the eyes sit where the head surface faces `dirs`, `snout` back from the nose.
 * @param {number[]} hdir  head forward axis; hup its up axis
 */
export function eyeSpec({ snout, band, size, hdir, hup, ang, fwd }) {
  const right = v3.norm(v3.cross(hup, hdir));
  const dirs = [1, -1].map((side) => v3.norm(v3.add(v3.add(v3.mul(right, side * Math.cos(ang)), v3.mul(hup, Math.sin(ang))), v3.mul(hdir, fwd))));
  return { snout, band, size, dirs, hup, hdir };
}

/** Bone lists for four legs named FL, FR, BL, BR. */
function legBones(bones, parents, front, back) {
  for (const n of ['FL', 'FR', 'BL', 'BR']) {
    bones.push(`upper${n}`, `lower${n}`, `foot${n}`);
    parents[`upper${n}`] = n[0] === 'F' ? front : back;
    parents[`lower${n}`] = `upper${n}`;
    parents[`foot${n}`] = `lower${n}`;
  }
}

// ---- Lizards -------------------------------------------------------------------------------------------------------

/** Body rings of a lizard: [z (share of the half length), half width, half height (shares), centre y (× height)]. */
const LIZARD_BODY = [
  [-1.0, 0.6, 0.62, -0.08],
  [-0.62, 0.9, 0.88, 0, 'hipA'],
  [-0.2, 1.0, 0.97, 0.02],
  [0.25, 1.0, 1.0, 0.03],
  [0.62, 0.92, 0.95, 0.05, 'shA'],
  [0.95, 0.72, 0.8, 0.08],
];

/**
 * Builds the cage for a lizard.
 * @param {object} L  resolved species look; M  resolved MESH_LOOKS entry; q  detail settings (index.js)
 */
export function buildLizardCage(L, M, q) {
  const b = L.body;
  const lg = L.legs;
  const hd = L.head;
  const tl = L.tail;
  const neckLen = L.neck?.len ?? b.l * 0.25;
  const bones = ['seed', 'hips', 'chest', 'neck0', 'neck1', 'head', 'eyes', 'tail0', 'tail1', 'tail2', 'tail3'];
  const parents = { seed: null, hips: null, chest: 'hips', neck0: 'chest', neck1: 'neck0', head: 'neck1', eyes: 'head', tail0: 'hips', tail1: 'tail0', tail2: 'tail1', tail3: 'tail2' };
  const tongue = M.tongue;
  if (tongue) {
    bones.push('tongue');
    parents.tongue = 'head';
  }
  legBones(bones, parents, 'chest', 'hips');
  const cage = new Cage(bones);
  const bodyY = b.h * 0.95 + lg.len * 0.15;
  const joints = { seed: [0, 0, 0], hips: [0, bodyY, -b.l * 0.3], chest: [0, bodyY, b.l * 0.35] };

  // Ring spacing: the spine is long (most of it tail), so density follows the detail level rather than the size.
  const total = b.l * 2 + neckLen + hd.l * 1.6 + tl.len;
  // Low is the high cage subdivided once; medium has twice its rings (index.js).
  const rings = q.tier === 1 ? 52 : 26;
  const step = total / rings;
  const crest = M.crest;
  // Crest spikes stand one per ring gap along the back, so the back is at least that dense.
  const crestStep = crest ? Math.min(step, (b.l * 1.9 + neckLen) / crest.count) : step;

  // ---- Spine: tail tip → body → neck → head → nose ----------------------------------------------------------------
  const keys = [];
  const tailBase = [0, bodyY - b.h * 0.12, -b.l];
  const tailStops = [0, 0.18, 0.42, 0.68];
  const curl = M.tailCurl ?? 0.06;
  const tailAt = (u) => {
    // u: 0 at the base, 1 at the tip. The tail sinks to the ground and curves a little to one side.
    const y = lerp(tailBase[1], tl.r * 0.3 + 0.004, Math.min(1, u * 2.2) ** 0.8);
    return [Math.sin(u * Math.PI) * curl * tl.len, Math.max(y, lerp(tl.r, Math.max(0.004, tl.r * 0.08), u ** 0.85) + 0.002), tailBase[2] - u * tl.len];
  };
  const nT = Math.max(4, Math.round(tl.len / (step * 2.4)));
  for (let i = nT; i >= 1; i--) {
    const u = i / nT;
    const r = lerp(tl.r, Math.max(0.004, tl.r * 0.08), u ** 0.85);
    keys.push({
      c: tailAt(u),
      a: r * 1.05,
      b: r * 0.95,
      w: u < 0.06 ? { hips: 0.5, tail0: 0.5 } : chainWeights(u, ['tail0', 'tail1', 'tail2', 'tail3'], tailStops),
      ch: { TAIL: u * tl.len },
      hold: true,
    });
  }
  tailStops.forEach((u, i) => (joints[`tail${i}`] = tailAt(Math.max(u, 0.02))));
  // A crest pinches the two top vertices together and lifts them: a narrow ridge for the spikes to stand on.
  const crestShape = (h) => (co, si) => (si > 0.85 ? [-b.w * 0.45, h] : [0, 0]);
  for (const [z, a, bb, y, name] of LIZARD_BODY) {
    const hipW = clamp01((0.3 - z) / 0.6);
    keys.push({
      name,
      hold: !!name,
      c: [0, bodyY + y * b.h, z * b.l],
      a: b.w * a,
      b: b.h * bb,
      w: { hips: hipW, chest: 1 - hipW },
      ch: { TAIL: z < -0.9 ? tl.len * 1.05 : 4 },
      step: crestStep,
      shape: crest ? crestShape(b.h * 0.04) : undefined,
    });
  }
  // Legs grow from the faces between hipA / shA and the ring one leg-width further on.
  for (const nm of ['hipA', 'shA']) {
    const i = keys.findIndex((k) => k.name === nm);
    const k = keys[i];
    keys.splice(i + 1, 0, { ...lerpSpec(k, keys[i + 1], 0), c: v3.add(k.c, [0, 0, lg.r * 2.3]), name: `${nm}2`, hold: false, step: crestStep });
  }
  // Neck and head: along a line rising gently to the head.
  const nRoot = [0, bodyY + b.h * 0.1, b.l * 0.95];
  const end = v3.add(nRoot, [0, neckLen * 0.35, neckLen]);
  joints.neck0 = nRoot;
  joints.neck1 = v3.lerp(nRoot, end, 0.5);
  joints.head = end;
  const dew = M.dewlap;
  const dewShape = (h) => (co, si) => (si < -0.85 ? [-0.6 * b.w * 0.5, h] : [0, 0]);
  keys.push({ c: v3.lerp(nRoot, end, 0.45), a: lerp(b.w * 0.72, hd.w * 1.05, 0.6), b: lerp(b.h * 0.8, hd.h * 1.0, 0.6), w: { neck0: 0.6, neck1: 0.4 }, step: crestStep, shape: dew ? dewShape(dew.size * 0.7) : crest ? crestShape(b.h * 0.03) : undefined });
  const p = M.pitch ?? 0.08;
  const hdir = [0, -Math.sin(p), Math.cos(p)];
  const hup = [0, Math.cos(p), Math.sin(p)];
  const at = (al, up) => v3.add(end, v3.add(v3.mul(hdir, al), v3.mul(hup, up)));
  const flat = M.headFlat ?? 0.85;
  const head = [
    ['H0', -0.1 * hd.l, 0.05 * hd.h, 0.98 * hd.w, 0.92 * hd.h * flat, { neck1: 0.3, head: 0.7 }],
    ['H1', 0.35 * hd.l, 0.05 * hd.h, 1.0 * hd.w, 0.95 * hd.h * flat, { head: 1 }],
    ['H2', 0.85 * hd.l, -0.02 * hd.h, 0.86 * hd.w, 0.82 * hd.h * flat, { head: 1 }],
    ['S0', 1.3 * hd.l, -0.1 * hd.h, 0.62 * hd.w, 0.62 * hd.h * flat, { head: 1 }],
    ['S1', 1.6 * hd.l, -0.16 * hd.h, 0.42 * hd.w, 0.4 * hd.h * flat, { head: 1 }],
    // A small last ring rounds the nose off (the cap after it is tiny).
    ['T', 1.72 * hd.l, -0.18 * hd.h, 0.2 * hd.w, 0.18 * hd.h * flat, { head: 1 }],
  ];
  // Eye turrets: the upper side vertices of the rings round the eyes bulge out and up, so the eyes sit proud of the
  // head under a brow instead of flat in its side.
  const turret = M.eyeTurret ?? 0;
  const turretShape = (k) => (co, si) => (si > 0.2 && si < 0.6 ? [hd.w * turret * k, hd.h * turret * k * 0.9] : [0, 0]);
  const eyeT = M.eye?.t ?? 0.55;
  for (const [name, al, up, a, bb, w] of head) {
    const cheek = name === 'H1' && M.cheek;
    const tk = turret ? Math.max(0, 1 - Math.abs((al - lerp(head[1][1], head[2][1], eyeT)) / (0.5 * hd.l))) : 0;
    keys.push({
      name,
      c: at(al, up),
      a,
      b: bb,
      w,
      // Cheek scale (iguanas): the jaw vertices of the ring behind the eyes.
      ch: cheek ? (co, si) => ({ AUX: Math.abs(co) > 0.85 && si < 0 ? 1 : -1 }) : {},
      shape: name === 'H0' && dew ? dewShape(dew.size * 0.45) : tk > 0 ? turretShape(tk) : undefined,
      step: hd.l * (q.tier === 1 ? 0.3 : 0.6),
    });
  }
  const { spine, named, arcs } = loftSpine(cage, keys, step);

  // ---- Legs: out sideways, then down, then a flat foot on the ground ---------------------------------------------
  const legInfo = [];
  for (const front of [true, false]) {
    for (const side of [1, -1]) {
      const name = `${front ? 'F' : 'B'}${side > 0 ? 'R' : 'L'}`;
      const A = named[front ? 'shA' : 'hipA'];
      const fi = cage.faceBetween(A, after(spine, A), side > 0 ? 7 : 3);
      const fc = faceCenter(cage, fi);
      const fS = faceChannel(cage, fi, 'S');
      const r = lg.r * (M.legScale ?? 1);
      const len = lg.len;
      const f = front ? 1 : -1;
      const out = Math.abs(fc[0]);
      const footDir = v3.norm(front ? [side * 0.5, 0, 1] : [side * 1, 0, -0.15]);
      const wrist = [side * (out + len * 0.62), r * 1.05, fc[2] + f * len * 0.12];
      const toe = (k) => v3.add(wrist, v3.add(v3.mul(footDir, r * k), [0, -r * 0.55 + r * 0.12 * (k > 1.5 ? 0 : 1), 0]));
      const W = { up: front ? 'chest' : 'hips', u: `upper${name}`, l: `lower${name}`, f: `foot${name}` };
      const ch = (y, extra = {}) => ({ S: fS, PS: 0.8, UNDER: -0.2, ...extra, ...(y < r * 1.2 ? { LEG: 1 } : {}) });
      // The thigh leaves the body low on its side and runs out level, so it never shows above the back.
      const thighY = fc[1] - r * 0.45;
      const specs = [
        { c: [side * (out + r * 0.5), thighY, fc[2]], a: r * 1.25, b: r * 1.15, w: { [W.up]: 0.4, [W.u]: 0.6 }, ch: ch(9) },
        { c: [side * (out + len * 0.42), Math.min(fc[1] - r * 0.4, thighY - r * 0.2), fc[2] + f * len * 0.06], a: r * 1.0, b: r * 1.0, w: { [W.u]: 0.5, [W.l]: 0.5 }, ch: ch(9) },
        { c: [side * (out + len * 0.56), lerp(fc[1], r, 0.55), fc[2] + f * len * 0.1], a: r * 0.85, b: r * 0.9, w: { [W.l]: 1 }, ch: ch(9) },
        { c: wrist, a: r * 0.8, b: r * 0.8, w: { [W.l]: 0.5, [W.f]: 0.5 }, ch: ch(9) },
        { c: toe(1.0), a: r * 1.2, b: r * 0.5, flat: footDir[0] ? [-footDir[2], 0, footDir[0]] : [1, 0, 0], w: { [W.f]: 1 }, ch: ch(0) },
        // The palm ends short; the toes fan out from it.
        { c: toe(1.6), a: r * 1.15, b: r * 0.36, flat: [-footDir[2], 0, footDir[0]], w: { [W.f]: 1 }, ch: ch(0, { TIP: r * (M.toeLen ?? 1.3) }) },
      ];
      const framed = limbFrames(densify(specs, q.tier === 1 ? 2 : 1), fc, [0, 0, 1]);
      const [rA, rB] = cage.extrude(fi, framed).slice(-2);
      // Toes: three, fanned out and extruded from the palm's front cap and its two edges, so they grow out of the
      // foot with no seam. TIP runs to 0 at each toe's tip, for claws. One ring per toe on high (two subdivision
      // levels round it into a tapering toe), two on the lower tiers.
      const capFi = cage.faces.length - 1;
      const toeLen = r * (M.toeLen ?? 1.3);
      const lat = [footDir[2], 0, -footDir[0]];
      const toeSpecs = (from, d, tl) => {
        const tip = v3.add(from, v3.add(v3.mul(d, tl), [0, -r * 0.12, 0]));
        const tch = (tipD) => ({ S: fS, PS: 0.8, UNDER: -0.2, LEG: 1, TIP: tipD });
        return q.levels === 2
          ? [{ c: tip, t: d, s: [0, 1, 0], a: r * 0.13, b: r * 0.1, w: { [W.f]: 1 }, ch: tch(0) }]
          : [
              { c: v3.lerp(from, tip, 0.5), t: d, s: [0, 1, 0], a: r * 0.24, b: r * 0.18, w: { [W.f]: 1 }, ch: tch(tl * 0.5) },
              { c: tip, t: d, s: [0, 1, 0], a: r * 0.1, b: r * 0.08, w: { [W.f]: 1 }, ch: tch(0) },
            ];
      };
      // Side faces first (finding them by direction needs the faces as they are before the cap is extruded).
      const sideFaces = [1, -1].map((k) => [k, facingFace(cage, rA, rB, v3.mul(lat, k))]);
      const sideCentres = sideFaces.map(([k, f2]) => [k, faceCenter(cage, f2), cage.faces[f2]]);
      cage.extrude(capFi, toeSpecs(faceCenter(cage, capFi), footDir, toeLen));
      for (const [k, centre, verts] of sideCentres) {
        // Face indices shift as extrusions remove faces; find this one again by its corners.
        const f2 = cage.faces.findIndex((f) => f.length === 4 && f.every((x, j) => x === verts[j]));
        const d = v3.norm(v3.add(v3.mul(footDir, 0.85), v3.mul(lat, k * 0.7)));
        cage.extrude(f2, toeSpecs(centre, d, toeLen * 0.8));
      }
      joints[`upper${name}`] = [side * out * 0.7, fc[1], fc[2]];
      joints[`lower${name}`] = specs[1].c;
      joints[`foot${name}`] = specs[3].c;
      legInfo.push({ name, front, side, len });
    }
  }

  // ---- Crest spikes (iguanas): one per ring gap along the neck and back -------------------------------------------
  if (crest) {
    // From a little behind the hips to the back of the head, one spike every `gap` of spine.
    const i1 = spine.indexOf(named.H0);
    const s1 = arcs[i1];
    const s0 = arcs[spine.indexOf(named.hipA)] - b.l * 0.3;
    const gap = (s1 - s0) / crest.count;
    let next = s0;
    for (let i = 0; i < i1; i++) {
      const mid = (arcs[i] + arcs[i + 1]) / 2;
      if (mid < next) continue;
      next += gap;
      const fi = cage.faceBetween(spine[i], spine[i + 1], 1);
      const fc = faceCenter(cage, fi);
      const len = arcs[i + 1] - arcs[i];
      const u = (mid - s0) / (s1 - s0);
      // Tallest over the shoulders, smaller along the hips and towards the head.
      const h = crest.size * (0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, u * 1.25)));
      const t = v3.norm([0, 1, -0.45]);
      const w = { ...lerpWeights(cage, fi) };
      // One ring at the tip: the subdivided pyramid is a soft cone.
      cage.extrude(fi, [{ c: v3.add(fc, v3.mul(t, h * 1.15)), t, s: [1, 0, 0], a: len * 0.05, b: len * 0.08, w, ch: { RIDGE: 1, TIP: 0 } }]);
    }
  }

  // ---- Tongue (monitors): a long forked tongue out of the mouth, two thin prongs (islands) on their own bone, which
  // animate-reptile.js scales to nothing (back into the mouth) between flicks.
  if (tongue) {
    const T = head[head.length - 1];
    const mouth = at(T[1] - hd.l * 0.25, T[2] - hd.h * 0.1);
    joints.tongue = mouth;
    const len = hd.l * (tongue.len ?? 0.9);
    const right = v3.norm(v3.cross(hdir, hup));
    for (const side of [1, -1]) {
      const d0 = v3.norm(v3.add(hdir, v3.mul(hup, -0.12)));
      const fork = v3.add(mouth, v3.mul(d0, len * 0.62));
      const tip = v3.add(fork, v3.add(v3.mul(d0, len * 0.38), v3.mul(right, side * len * 0.22)));
      const r0 = hd.h * 0.17;
      const ring = (c, t, rad) => cage.ring({ c, t, s: right, a: rad * 1.4, b: rad * 0.6, n: 4, w: { tongue: 1 }, ch: { TUSK: 1, PS: 0.6 } });
      // Each prong overlaps the other along the shared stem, so together they read as one forked tongue.
      cage.tube([ring(v3.add(mouth, v3.mul(right, side * r0 * 0.3)), d0, r0), ring(fork, d0, r0 * 0.8), ring(tip, v3.sub(tip, fork), r0 * 0.35)]);
    }
  }

  // ---- Eyes ----------------------------------------------------------------------------------------------------------
  const ey = M.eye ?? { t: 0.55, ang: 0.35, fwd: 0.25 };
  const eyeAlong = lerp(head[1][1], head[2][1], ey.t);
  const eyes = eyeSpec({ snout: head[head.length - 1][1] - eyeAlong, band: 0.18 * hd.l, size: (L.eyes?.size ?? hd.h * 0.2) * (M.eyeScale ?? 1.4), hdir, hup, ang: ey.ang, fwd: ey.fwd });
  // headLen lets markings scale with the head (eye lids).
  return { cage, joints, parents, eyes, info: { kind: 'mesh-lizard', plan: L.plan, legs: legInfo, legLen: lg.len, bodyH: b.h, bodyL: b.l, neckLen, headLen: hd.l } };
}

/** The face between rings r1 and r2 (as bridged) whose centre lies furthest along `dir`. */
function facingFace(cage, r1, r2, dir) {
  const c = v3.mul([...r1, ...r2].map((i) => cage.pos(i)).reduce(v3.add), 1 / (r1.length * 2));
  let best = -1;
  let bestD = -Infinity;
  for (let k = 0; k < r1.length; k++) {
    const fi = cage.faceBetween(r1, r2, k);
    const d = v3.dot(v3.sub(faceCenter(cage, fi), c), dir);
    if (d > bestD) {
      bestD = d;
      best = fi;
    }
  }
  return best;
}

/** The bone weights at a face's centre (the average of its corners). */
function lerpWeights(cage, fi) {
  const f = cage.faces[fi];
  const w = {};
  for (const vi of f)
    cage.bones.forEach((name, k) => {
      const x = cage.data[vi * cage.stride + 3 + k];
      if (x > 0) w[name] = (w[name] ?? 0) + x / f.length;
    });
  return w;
}

// ---- Tortoises -----------------------------------------------------------------------------------------------------

/**
 * The shell's profile, bottom to top: [radius (share of the shell's), height (share of its height)]. The bottom ring
 * is capped flat (the plastron), the top one with the dome's crown; the outermost ring is the rim.
 */
const SHELL = [
  [0.8, -0.14],
  [0.97, -0.08],
  [1.06, 0.0],
  [1.02, 0.09],
  [0.96, 0.3],
  [0.8, 0.62],
  [0.52, 0.88],
  [0.22, 1.0],
];

/**
 * Builds the cage for a tortoise.
 * @param {object} L  resolved species look; M  resolved MESH_LOOKS entry; q  detail settings (index.js)
 */
export function buildTurtleCage(L, M, q) {
  const sh = L.shell;
  const lg = L.legs;
  const hd = L.head;
  const neckLen = L.neck?.len ?? hd.l * 1.4;
  const bones = ['seed', 'hips', 'neck0', 'neck1', 'head', 'eyes', 'tail0'];
  const parents = { seed: null, hips: null, neck0: 'hips', neck1: 'neck0', head: 'neck1', eyes: 'head', tail0: 'hips' };
  legBones(bones, parents, 'hips', 'hips');
  const cage = new Cage(bones);
  const bodyY = lg.len * 0.7;
  const joints = { seed: [0, 0, 0], hips: [0, bodyY, 0] };
  // Detail tier (index.js): low is the high cage subdivided once; medium is denser.
  const tier = q.tier ?? 0;

  // ---- Shell: a closed island, revolved around the vertical axis ------------------------------------------------
  {
    const N = [16, 24, 16][tier];
    const prof = refineProfile(SHELL, [0, 1, 0][tier]);
    const loops = prof.map(([r, h], li) => {
      const ring = [];
      for (let k = 0; k < N; k++) {
        const ang = (k / N) * Math.PI * 2;
        const x = Math.sin(ang) * sh.rx * r * 1.07;
        const z = Math.cos(ang) * sh.rz * r * 1.07;
        // The dome rises a little higher at the back (leopard tortoises are tall and domed).
        const y = bodyY + h * sh.ry * 1.08 * (1 + 0.06 * Math.cos(ang) * -Math.max(0, h));
        const rim = h > -0.1 && h < 0.12 ? 1 : -1;
        const below = h < -0.03 ? 1 : -1;
        ring.push(cage.vert([x, y, z], { hips: 1 }, { SHELL: 1, AUX: Math.max(rim, below) > 0 ? (h < -0.03 ? 2 : 1) : -1, PS: 1, UNDER: h < -0.03 ? 1 : -1, S: li }));
      }
      return ring;
    });
    for (let i = 0; i + 1 < loops.length; i++) {
      const r1 = loops[i];
      const r2 = loops[i + 1];
      for (let k = 0; k < N; k++) cage.face(r1[k], r1[(k + 1) % N], r2[(k + 1) % N], r2[k]);
    }
    cage.face(...[...loops[0]].reverse());
    cage.face(...loops[loops.length - 1]);
  }

  // ---- Skin: tail → body (inside the shell) → neck → head --------------------------------------------------------
  const step = sh.rz / [3, 6, 3][tier];
  const tailLen = lg.r * 1.6;
  const back = -sh.rz * 0.72;
  const keys = [
    { c: [0, bodyY - lg.r * 0.1, back - tailLen], a: lg.r * 0.12, b: lg.r * 0.12, w: { tail0: 1 }, ch: { TAIL: 0 } },
    { c: [0, bodyY + lg.r * 0.05, back - tailLen * 0.55], a: lg.r * 0.28, b: lg.r * 0.26, w: { tail0: 1 }, ch: { TAIL: tailLen * 0.5 } },
    { c: [0, bodyY + sh.ry * 0.12, back], a: sh.rx * 0.55, b: sh.ry * 0.4, w: { hips: 0.6, tail0: 0.4 } },
    { c: [0, bodyY + sh.ry * 0.25, -sh.rz * 0.48], name: 'hipA', hold: true, a: sh.rx * 0.82, b: sh.ry * 0.5, w: { hips: 1 } },
    { c: [0, bodyY + sh.ry * 0.25, -sh.rz * 0.18], a: sh.rx * 0.85, b: sh.ry * 0.52, w: { hips: 1 } },
    { c: [0, bodyY + sh.ry * 0.25, sh.rz * 0.3], name: 'shA', hold: true, a: sh.rx * 0.82, b: sh.ry * 0.52, w: { hips: 1 } },
    { c: [0, bodyY + sh.ry * 0.25, sh.rz * 0.62], a: sh.rx * 0.62, b: sh.ry * 0.45, w: { hips: 1 } },
  ];
  // Neck: out of the front opening, rising to the head.
  const nRoot = [0, bodyY + sh.ry * 0.12, sh.rz * 0.78];
  const end = v3.add(nRoot, [0, neckLen * 0.4, neckLen]);
  joints.neck0 = nRoot;
  joints.neck1 = v3.lerp(nRoot, end, 0.5);
  joints.head = end;
  joints.tail0 = [0, bodyY, back];
  const nr = hd.h * 0.66;
  keys.push({ c: nRoot, a: nr * 1.25, b: nr * 1.1, w: { hips: 0.5, neck0: 0.5 } });
  keys.push({ c: v3.lerp(nRoot, end, 0.45), a: nr * 1.05, b: nr * 0.98, w: { neck0: 0.7, neck1: 0.3 } });
  keys.push({ c: v3.lerp(nRoot, end, 0.85), a: nr, b: nr * 0.95, w: { neck0: 0.15, neck1: 0.85 } });
  const p = M.pitch ?? 0.12;
  const hdir = [0, -Math.sin(p), Math.cos(p)];
  const hup = [0, Math.cos(p), Math.sin(p)];
  const at = (al, up) => v3.add(end, v3.add(v3.mul(hdir, al), v3.mul(hup, up)));
  const head = [
    ['H0', 0.0, 0.08 * hd.h, 0.9 * hd.w, 0.88 * hd.h, { neck1: 0.25, head: 0.75 }],
    ['H1', 0.45 * hd.l, 0.12 * hd.h, 1.0 * hd.w, 0.98 * hd.h, { head: 1 }],
    ['H2', 0.95 * hd.l, 0.02 * hd.h, 0.9 * hd.w, 0.85 * hd.h, { head: 1 }],
    ['S0', 1.32 * hd.l, -0.12 * hd.h, 0.62 * hd.w, 0.6 * hd.h, { head: 1 }],
    ['S1', 1.5 * hd.l, -0.2 * hd.h, 0.4 * hd.w, 0.4 * hd.h, { head: 1 }],
    ['T', 1.62 * hd.l, -0.24 * hd.h, 0.18 * hd.w, 0.18 * hd.h, { head: 1 }],
  ];
  for (const [name, al, up, a, bb, w] of head) keys.push({ name, c: at(al, up), a, b: bb, w, step: hd.l * (tier === 1 ? 0.35 : 0.7) });
  const { spine, named } = loftSpine(cage, keys, step);

  // ---- Legs: stout columns from under the shell, splayed a little ------------------------------------------------
  const legInfo = [];
  for (const front of [true, false]) {
    for (const side of [1, -1]) {
      const name = `${front ? 'F' : 'B'}${side > 0 ? 'R' : 'L'}`;
      const A = named[front ? 'shA' : 'hipA'];
      const fi = cage.faceBetween(A, after(spine, A), side > 0 ? 6 : 4);
      const fc = faceCenter(cage, fi);
      const r = lg.r;
      const f = front ? 1 : -1;
      const x = side * sh.rx * 0.78;
      const W = { u: `upper${name}`, l: `lower${name}`, f: `foot${name}` };
      const legY = (y) => ({ PS: 0.6, UNDER: -0.2, ...(y < r * 0.5 ? { LEG: 1 } : {}) });
      const specs = [
        { c: [lerp(fc[0], x, 0.6), lerp(fc[1], bodyY, 0.5), fc[2] + f * r * 0.2], a: r * 1.05, b: r * 1.1, w: { hips: 0.3, [W.u]: 0.7 }, ch: legY(1) },
        { c: [x, bodyY - lg.len * 0.25, fc[2] + f * r * 0.45], a: r * 1.0, b: r * 1.05, w: { [W.u]: 0.4, [W.l]: 0.6 }, ch: legY(1) },
        { c: [x * 1.04, r * 0.55, fc[2] + f * r * 0.55], a: r * 1.02, b: r * 1.08, w: { [W.l]: 0.4, [W.f]: 0.6 }, ch: legY(1) },
        { c: [x * 1.05, r * 0.12, fc[2] + f * r * 0.62], a: r * 1.12, b: r * 1.15, w: { [W.f]: 1 }, ch: legY(0) },
      ];
      cage.extrude(fi, limbFrames(densify(specs, q.tier === 1 ? 2 : 1), fc, [0, 0, 1]));
      joints[`upper${name}`] = [lerp(fc[0], x, 0.4), bodyY, fc[2]];
      joints[`lower${name}`] = specs[1].c;
      joints[`foot${name}`] = specs[2].c;
      legInfo.push({ name, front, side, len: lg.len });
    }
  }

  const ey = M.eye ?? { t: 0.4, ang: 0.3, fwd: 0.35 };
  const eyeAlong = lerp(head[1][1], head[2][1], ey.t);
  const eyes = eyeSpec({ snout: head[head.length - 1][1] - eyeAlong, band: 0.2 * hd.l, size: (L.eyes?.size ?? hd.h * 0.2) * (M.eyeScale ?? 1.3), hdir, hup, ang: ey.ang, fwd: ey.fwd });
  return { cage, joints, parents, eyes, info: { kind: 'mesh-turtle', plan: L.plan, legs: legInfo, legLen: lg.len, bodyH: sh.ry, bodyL: sh.rz, neckLen } };
}

/** Adds rings between the shell profile's rings (1: one between each pair). */
function refineProfile(prof, k) {
  const out = [];
  for (let i = 0; i < prof.length; i++) {
    out.push(prof[i]);
    if (i + 1 < prof.length) for (let j = 1; j <= k; j++) out.push([lerp(prof[i][0], prof[i + 1][0], j / (k + 1)), lerp(prof[i][1], prof[i + 1][1], j / (k + 1))]);
  }
  return out;
}
