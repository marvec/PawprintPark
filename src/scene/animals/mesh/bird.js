// Bird cage: one lofted tube from the rump to the beak tip (body, neck, head, beak), with legs and toes, wings and the
// tail extruded from its faces, and the comb and wattles as small islands. Units are metres; the bird faces +z and
// stands on y = 0. Sizes come from the species look (../looks.js); MESH_LOOKS (looks-birds.js) adds the paint.
//
// Paint channels (cage.js CHANNELS) as birds use them:
// - AUX: progress up the neck: 0 at the neck root, 1 at the nape, more on the head and beak, negative on the body.
// - BEAK: 0 at the beak base to 1 at its tip (negative behind). UNDER: below the spine (breast, throat, lower beak).
// - EAR: the bare face patch beside the eye (positive). WING: distance out along the wing (negative off it).
// - TAIL: distance to the tail tip (FAR off it). TIP: 0 on the comb and wattles. LEG: positive on the bare legs.

import { CHANNELS, Cage, lerpSpec, resample, v3 } from './cage.js';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Body rings along the body axis (t: share of the half length, back to front; y: centre offset along the body's up
 * axis, a/b: half width/height, both shares of the body's). Legs grow between hipA and the next ring, wings after shA.
 */
const BODY = {
  walk: [
    { t: -1.0, y: 0.12, a: 0.36, b: 0.4 },
    { t: -0.8, y: 0.05, a: 0.8, b: 0.82 },
    { t: -0.45, y: 0, a: 0.98, b: 0.98, name: 'hipA', hold: true },
    { t: -0.1, y: 0, a: 1, b: 1, name: 'hipB' },
    { t: 0.2, y: 0, a: 1, b: 1, name: 'shA', hold: true },
    { t: 0.5, y: 0.04, a: 0.92, b: 0.95, name: 'shB' },
  ],
  // Penguins: an upright torpedo; the feet sit near its lower end.
  penguin: [
    { t: -1.0, y: 0, a: 0.4, b: 0.42 },
    { t: -0.84, y: 0, a: 0.82, b: 0.84, name: 'hipA', hold: true },
    { t: -0.58, y: 0, a: 0.98, b: 1, name: 'hipB' },
    { t: -0.2, y: 0, a: 1, b: 1.02 },
    { t: 0.2, y: 0, a: 0.94, b: 0.96, name: 'shA', hold: true },
    { t: 0.5, y: 0, a: 0.8, b: 0.82, name: 'shB' },
  ],
};

/** Tail centre lines (× tail length; world axes: y up, z forward), ring half sizes (× length), from the root. */
const TAILS = {
  // A small wedge, lifted a little.
  short: { path: [[0, 0.0, -0.3], [0, 0.06, -0.62], [0, 0.1, -0.9]], a: [0.55, 0.42, 0.14], b: [0.2, 0.14, 0.06], flat: 'x', widthOfBody: true },
  // Hen: an upright fan.
  fan: { path: [[0, 0.25, -0.2], [0, 0.65, -0.45], [0, 0.95, -0.6]], a: [0.1, 0.09, 0.05], b: [0.32, 0.46, 0.26], flat: 'x' },
  // Rooster: tall arched sickle feathers.
  sickle: { path: [[0, 0.25, -0.12], [0, 0.62, -0.3], [0, 0.78, -0.6], [0, 0.55, -0.88], [0, 0.3, -0.98]], a: [0.07, 0.06, 0.05, 0.04, 0.015], b: [0.16, 0.2, 0.18, 0.13, 0.04], flat: 'x' },
  // Macaw: long, flat, pointed, hanging down behind (angled to reach just above the ground: see below).
  long: { path: [[0, -0.12, -0.2], [0, -0.4, -0.45], [0, -0.62, -0.72], [0, -0.72, -0.98]], a: [0.08, 0.075, 0.055, 0.012], b: [0.03, 0.022, 0.016, 0.006], flat: 'x' },
  // Ostrich: a fluffy plume.
  plume: { path: [[0, 0.15, -0.2], [0, 0.3, -0.45], [0, 0.36, -0.7]], a: [0.5, 0.55, 0.2], b: [0.38, 0.42, 0.14], flat: 'x' },
};

/**
 * One subdivision level (medium and low quality) needs a denser cage for the same shape: inserts `n` rings between
 * consecutive ring specs of a fixed-count part (wings, tail, toes).
 */
function densify(specs, n) {
  if (!n) return specs;
  const out = [];
  for (let i = 0; i < specs.length; i++) {
    out.push(specs[i]);
    if (i + 1 < specs.length) for (let j = 1; j <= n; j++) out.push({ ...lerpSpec(specs[i], specs[i + 1], j / (n + 1)), t: v3.lerp(specs[i].t, specs[i + 1].t, j / (n + 1)) });
  }
  return out;
}

/**
 * Builds the cage for a bird.
 * @param {object} L  resolved species look
 * @param {object} M  resolved MESH_LOOKS entry
 * @param {{ step: number, legStep: number }} q  ring spacing (metres)
 */
export function buildBirdCage(L, M, q) {
  const b = L.body;
  const lg = L.legs;
  const nk = L.neck;
  const hd = L.head;
  const bk = L.beak;
  const penguin = L.plan === 'penguin';
  // MESH_LOOKS can override the stance: a perching parrot stands more upright than the species look's pitch.
  const pitch = M.pitch ?? L.pitch ?? 0.15;
  const hipDrop = M.hipDrop ?? L.hipDrop ?? 0.55;
  const bodyY = lg.len + b.h * hipDrop;
  const dir = [0, Math.sin(pitch), Math.cos(pitch)];
  const up = [0, Math.cos(pitch), -Math.sin(pitch)];
  const C = [0, bodyY, 0];
  // Extra rings in the fixed-count parts when the cage is subdivided only once.
  const dense = q.levels === undefined || q.levels >= 2 ? 0 : 1;
  const bodyAt = (t, y = 0) => v3.add(C, v3.add(v3.mul(dir, t * b.l), v3.mul(up, y * b.h)));

  const bones = ['seed', 'hips', 'chest', 'neck0', 'neck1', 'head', 'eyes', 'tail0', 'tail1', 'wingL', 'wingR'];
  for (const n of ['L', 'R']) bones.push(`upper${n}`, `lower${n}`, `foot${n}`);
  const parents = { seed: null, hips: null, chest: 'hips', neck0: 'chest', neck1: 'neck0', head: 'neck1', eyes: 'head', tail0: 'hips', tail1: 'tail0', wingL: 'chest', wingR: 'chest' };
  for (const n of ['L', 'R']) {
    parents[`upper${n}`] = 'hips';
    parents[`lower${n}`] = `upper${n}`;
    parents[`foot${n}`] = `lower${n}`;
  }
  const cage = new Cage(bones);
  const joints = { seed: [0, 0, 0], hips: bodyAt(-0.3), chest: bodyAt(0.35) };

  // ---- Spine: body, neck, head, beak ---------------------------------------------------------------------------------
  const keys = [];
  const rings = BODY[penguin ? 'penguin' : 'walk'];
  // Loose plumage (ostrich): ring vertices alternate in and out, staggered ring to ring, so the body subdivides into
  // soft feather lumps; the lower vertices hang down further on every other ring, a scalloped skirt.
  const pl = M.plumage;
  let parity = 0;
  const plumage = () => {
    const flip = (parity++ % 2) * 2 - 1;
    return (co, si) => {
      const j = Math.round((Math.atan2(si, co) - Math.PI / 8) / (Math.PI / 4));
      const e = Math.min(b.w, b.h) * pl.lumps * flip * (j % 2 ? 1 : -1);
      // Scallops both along the body (ring to ring) and around it (vertex to vertex).
      const skirt = si < -0.3 ? b.h * pl.skirt * -si * (flip > 0 ? 1 : 0.35) * (j % 2 ? 1 : 0.45) : 0;
      return [e, e + skirt];
    };
  };
  for (const r of rings) {
    const hipW = clamp01((0.35 - r.t) / 0.7);
    const shape = pl && r.t > -0.95 && r.t < 0.6 ? plumage() : undefined;
    keys.push({ name: r.name, hold: r.hold, part: 'body', c: bodyAt(r.t, r.y), a: b.w * r.a, b: b.h * r.b, w: { hips: hipW, chest: 1 - hipW }, shape });
  }
  // Neck: a straight stalk at an angle, or a curve (flamingo).
  const nRoot = bodyAt(nk.z ?? 0.75, (nk.y ?? 0.45) * (penguin ? 1 : 1));
  const angle = nk.angle ?? 1.2;
  const curve = nk.curve ?? [[0, 0], [Math.sin(angle), Math.cos(angle)]];
  const cpts = curve.map(([y, z]) => v3.add(nRoot, [0, y * nk.len, z * nk.len]));
  const neckAt = (t) => {
    const x = t * (cpts.length - 1);
    const i = Math.min(cpts.length - 2, Math.floor(x));
    return v3.lerp(cpts[i], cpts[i + 1], x - i);
  };
  const end = cpts[cpts.length - 1];
  const r2 = nk.r2 ?? nk.r * 0.8;
  joints.neck0 = nRoot;
  joints.neck1 = neckAt(0.5);
  joints.head = end;
  // From the breast to the neck: a ring halfway, so the loft turns smoothly.
  const last = keys[keys.length - 1];
  const n0 = neckAt(0.1);
  keys.push({ part: 'body', c: v3.lerp(last.c, n0, 0.5), a: lerp(last.a, nk.r * 1.25, 0.55), b: lerp(last.b, nk.r * 1.3, 0.55), w: { chest: 0.8, neck0: 0.2 }, aux: -0.25 });
  const neckTs = curve.length > 2 ? curve.map((_, i) => i / (curve.length - 1)).filter((t) => t > 0.05 && t < 0.95) : [0.15, 0.5, 0.85];
  if (!neckTs.includes(0.15) && curve.length > 2) neckTs.unshift(0.08);
  for (const t of neckTs) {
    keys.push({ part: 'neck', c: neckAt(t), a: lerp(nk.r * 1.15, r2, t), b: lerp(nk.r * 1.15, r2, t), w: t < 0.4 ? { chest: 0.4 - t, neck0: 0.6 + t } : { neck0: 1.2 - t, neck1: t - 0.2 }, aux: t * 0.8 });
  }
  // Head: a ball on the end of the neck, then the beak, along the head's own axis.
  const r = hd.r;
  const sq = hd.squash ?? 0.95;
  const hp = M.head?.pitch ?? 0.08;
  const hdir = [0, -Math.sin(hp), Math.cos(hp)];
  const hup = [0, Math.cos(hp), Math.sin(hp)];
  const hc = v3.add(end, v3.add(v3.mul(hup, r * 0.45), v3.mul(hdir, r * 0.15)));
  const at = (along, upk) => v3.add(hc, v3.add(v3.mul(hdir, along), v3.mul(hup, upk)));
  keys.push({ part: 'head', name: 'Hn', c: at(-r * 0.5, -r * 0.32), a: r * 0.8, b: r * 0.82 * sq, w: { neck1: 0.3, head: 0.7 }, aux: 1 });
  keys.push({ part: 'head', name: 'H1', c: at(0, 0), a: r, b: r * sq, w: { head: 1 } });
  keys.push({ part: 'head', name: 'H2', c: at(r * 0.55, -r * 0.05), a: r * 0.78, b: r * 0.78 * sq, w: { head: 1 } });
  // Beak.
  const kind = bk.kind ?? 'cone';
  const flat = bk.flat ? 0.55 : 1;
  const base = at(r * 0.88, -r * (bk.drop ?? 0.12));
  const bl = bk.len;
  const br = bk.r;
  let beak;
  if (kind === 'hook') {
    // Parrot: a deep beak curving down to a point; the lower mandible tucked under.
    beak = [
      { c: base, a: br * 1.05, b: br * 1.25 },
      { c: v3.add(base, v3.add(v3.mul(hdir, bl * 0.35), v3.mul(hup, bl * 0.02))), a: br * 0.85, b: br * 1.05 },
      { c: v3.add(base, v3.add(v3.mul(hdir, bl * 0.62), v3.mul(hup, -bl * 0.12))), a: br * 0.55, b: br * 0.65 },
      { c: v3.add(base, v3.add(v3.mul(hdir, bl * 0.76), v3.mul(hup, -bl * 0.38))), a: br * 0.3, b: br * 0.3 },
      { c: v3.add(base, v3.add(v3.mul(hdir, bl * 0.72), v3.mul(hup, -bl * 0.55))), a: br * 0.08, b: br * 0.08 },
    ];
  } else if (kind === 'bent') {
    // Flamingo: straight, then bent sharply down.
    const mid = v3.add(base, v3.add(v3.mul(hdir, bl * 0.5), v3.mul(hup, -bl * 0.04)));
    beak = [
      { c: base, a: br * 1.1, b: br * 1.25 },
      { c: v3.add(base, v3.mul(hdir, bl * 0.25)), a: br * 1.0, b: br * 1.15 },
      { c: mid, a: br * 0.85, b: br * 0.95 },
      { c: v3.add(mid, v3.add(v3.mul(hdir, bl * 0.15), v3.mul(hup, -bl * 0.2))), a: br * 0.6, b: br * 0.6 },
      { c: v3.add(mid, v3.add(v3.mul(hdir, bl * 0.2), v3.mul(hup, -bl * 0.4))), a: br * 0.25, b: br * 0.25 },
    ];
  } else {
    beak = [
      { c: base, a: br * 1.15, b: br * 1.15 * flat },
      { c: v3.add(base, v3.mul(hdir, bl * 0.45)), a: br * 0.72, b: br * 0.68 * flat },
      { c: v3.add(base, v3.mul(hdir, bl * 0.85)), a: br * 0.32, b: br * 0.3 * flat },
      { c: v3.add(base, v3.mul(hdir, bl * 1.0)), a: br * 0.08, b: br * 0.08 },
    ];
  }
  beak.forEach((k, i) => keys.push({ ...k, part: 'beak', name: i ? undefined : 'B0', hold: true, w: { head: 1 } }));
  // With two subdivision levels, keep the head rings as they are (no rings inserted between them).
  if (!dense) for (const k of keys) if (k.part === 'head') k.hold = true;

  const spineKeys = resample(keys, q.step);
  const arcs = [];
  let arc = 0;
  spineKeys.forEach((k, i) => {
    if (i) arc += v3.len(v3.sub(k.c, spineKeys[i - 1].c));
    arcs.push(arc);
  });
  const idx = (name) => spineKeys.findIndex((k) => k.name === name);
  const tip = arcs[arcs.length - 1];
  const beakBase = arcs[idx('B0')];
  const beakLen = tip - beakBase;
  const rootArc = arcs[spineKeys.findIndex((k) => k.part === 'neck')] - v3.len(v3.sub(spineKeys.find((k) => k.part === 'neck').c, nRoot));
  const napeArc = arcs[idx('Hn')];
  const neckArc = Math.max(1e-3, napeArc - rootArc);
  // The bare face patch: an ellipse on each side of the head, in head coordinates (× head radius).
  const fp = { along: 0.25, up: 0, ra: 0.42, rb: 0.36, ...M.face };
  const facePatch = (p) => {
    const rel = v3.sub(p, hc);
    const da = (v3.dot(rel, hdir) / r - fp.along) / fp.ra;
    const du = (v3.dot(rel, hup) / r - fp.up) / fp.rb;
    return Math.min(1 - da * da - du * du, (Math.abs(rel[0]) / r - 0.45) * 3);
  };
  const spine = [];
  const named = {};
  spineKeys.forEach((k, i) => {
    const ring = cage.ring({ ...k, ch: {} });
    const { U } = ring.frame;
    const aux = k.part === 'body' ? Math.min(k.aux ?? -1, (arcs[i] - rootArc) / neckArc) : (arcs[i] - rootArc) / neckArc;
    for (const vi of ring) {
      const off = v3.sub(cage.pos(vi), k.c);
      const upk = v3.dot(off, U) / (k.b * 1.1);
      cage.set(vi, 'UNDER', -upk);
      cage.set(vi, 'S', arcs[i]);
      cage.set(vi, 'SNOUT', tip - arcs[i]);
      cage.set(vi, 'AUX', aux);
      cage.set(vi, 'BEAK', (arcs[i] - beakBase) / beakLen);
      cage.set(vi, 'EAR', k.part === 'body' ? -1 : facePatch(cage.pos(vi)));
    }
    spine.push(ring);
    if (k.name) named[k.name] = ring;
  });
  cage.tube(spine);
  // Kept by reference: extruding legs and wings removes faces, which shifts indices.
  const tailFace = cage.faces[cage.faceBetween(spine[0], spine[1], 1)];

  const faceCentre = (fi) => v3.mul(cage.faces[fi].map((i) => cage.pos(i)).reduce(v3.add), 0.25);
  /** Of the quads between two rings, the one facing most along `d`. */
  const faceToward = (r1, r2, d) => {
    let best = -1;
    let bestDot = -Infinity;
    for (let k = 0; k < r1.length; k++) {
      const fi = cage.faceBetween(r1, r2, k);
      const mid = v3.mul([...r1, ...r2].map((i) => cage.pos(i)).reduce(v3.add), 1 / (r1.length * 2));
      const s = v3.dot(v3.norm(v3.sub(faceCentre(fi), mid)), d);
      if (s > bestDot) {
        bestDot = s;
        best = fi;
      }
    }
    return best;
  };
  const after = (ring) => spine[spine.indexOf(ring) + 1];
  const bodyHalfWidth = (t) => {
    for (let i = 0; i + 1 < rings.length; i++) if (t <= rings[i + 1].t) return b.w * lerp(rings[i].a, rings[i + 1].a, (t - rings[i].t) / (rings[i + 1].t - rings[i].t));
    return b.w * rings[rings.length - 1].a;
  };

  // ---- Legs: feathered thigh, bare shank, toes -----------------------------------------------------------------------
  const legInfo = [];
  const toe = lg.toe ?? lg.len * 0.22;
  const bodyBottom = bodyY - b.h * 0.95;
  for (const side of [1, -1]) {
    const name = side > 0 ? 'R' : 'L';
    const fi = cage.faceBetween(named.hipA, after(named.hipA), side > 0 ? 6 : 4);
    const fc = faceCentre(fi);
    const x = side * Math.max(b.w * 0.4, Math.abs(fc[0]) * 0.75);
    const z = fc[2];
    const hipY = lg.len;
    const thighLen = lg.thigh?.len ?? Math.max(b.h * 0.45, hipY - bodyBottom + b.h * 0.15);
    // Drumsticks (ostrich): the bare thigh hangs out below the body instead of hiding in it.
    const out = M.drumstick ? thighLen * M.drumstick : 0;
    const kneeY = Math.max(lg.r * 3, Math.min(hipY - thighLen * 0.9, bodyBottom + lg.r * 1.5) - out);
    const thighR = lg.thigh?.r ?? Math.max(lg.r * 2.2, b.w * 0.24);
    const ankleY = Math.max(lg.r * 1.6, toe * 0.25);
    const w = (wb, wu, wl, wf) => ({ hips: wb, [`upper${name}`]: wu, [`lower${name}`]: wl, [`foot${name}`]: wf });
    // Bones: upper = thigh and drumstick down to the heel (the joint that shows, halfway down the bare leg, bending
    // backwards), lower = the shank from heel to ankle, foot = the toes. So a folded leg bends at the heel, as birds'
    // do.
    const heelY = lerp(kneeY, ankleY, 0.5);
    // Drumsticks: out of the plumage the bare thigh swells, then narrows hard into the knee.
    const thigh = out
      ? [
          { c: [x, bodyBottom + b.h * 0.05, z], a: thighR * 0.95, b: thighR, w: w(0.2, 0.8, 0, 0), ch: { LEG: -0.5 }, hold: true },
          { c: [x, lerp(bodyBottom, kneeY, 0.5), z + thighR * 0.2], a: thighR * 1.2, b: thighR * 1.4, w: w(0, 1, 0, 0), ch: { LEG: -0.5 }, hold: true },
          { c: [x, lerp(bodyBottom, kneeY, 0.85), z], a: thighR * 0.55, b: thighR * 0.6, w: w(0, 1, 0, 0), ch: { LEG: -0.5 }, hold: true },
        ]
      : [{ c: [x, lerp(fc[1], kneeY, 0.55), z], a: thighR * 0.95, b: thighR, w: w(0, 1, 0, 0), ch: { LEG: -0.5 } }];
    const legKeys = [
      { c: [fc[0] * 0.92, fc[1] - b.h * 0.05, z], a: thighR * 1.05, b: thighR * 1.1, w: w(0.45, 0.55, 0, 0), ch: { LEG: -1 } },
      // LEG: -1 on the body, -0.5 on the (feathered) thigh, 1 on the bare leg and toes.
      ...thigh,
      { c: [x, kneeY + lg.r * 0.6, z - lg.r * 0.4], a: lg.r * 1.25, b: lg.r * 1.3, w: w(0, 1, 0, 0), ch: { LEG: 1 }, hold: true },
      // (resample adds rings between these on long legs.)
      { c: [x, heelY, z - lg.r * 0.3], a: lg.r * 1.12, b: lg.r * 1.15, w: w(0, 0.5, 0.5, 0), ch: { LEG: 1 } },
      { c: [x, ankleY + lg.r * 0.4, z], a: lg.r * 1.1, b: lg.r * 1.1, w: w(0, 0, 0.5, 0.5), ch: { LEG: 1 }, hold: true },
      { c: [x, ankleY - lg.r * 0.2, z], a: lg.r * 1.15, b: lg.r * 1.15, w: w(0, 0, 0, 1), ch: { LEG: 1 } },
    ];
    // Short legs (parrots, penguins) need no rings beyond their key rings.
    const legRings = cage.extrude(fi, resample(legKeys, lg.len < b.h ? Infinity : q.legStep), { cap: true });
    joints[`upper${name}`] = [x, hipY, z];
    joints[`lower${name}`] = legKeys[legKeys.length - 3].c;
    joints[`foot${name}`] = legKeys[legKeys.length - 2].c;
    const ankle = legRings[legRings.length - 1];
    const above = legRings[legRings.length - 2];
    const footW = { [`foot${name}`]: 1 };
    const th = Math.max(lg.r * 0.55, toe * 0.1);
    if (penguin) {
      // Webbed paddles, flat on the ground, pointing forward.
      const fiF = faceToward(above, ankle, [0, 0, 1]);
      const o = [x, th, z];
      cage.extrude(fiF, densify([
        { c: v3.add(o, [0, th * 0.2, toe * 0.35]), t: [0, 0, 1], s: [0, 1, 0], a: th, b: toe * 0.32, w: footW, ch: { LEG: 1 } },
        { c: v3.add(o, [side * toe * 0.05, 0, toe * 0.75]), t: [0, 0, 1], s: [0, 1, 0], a: th * 0.8, b: toe * 0.42, w: footW, ch: { LEG: 1 } },
        { c: v3.add(o, [side * toe * 0.08, -th * 0.1, toe * 1.0]), t: [0, 0, 1], s: [0, 1, 0], a: th * 0.6, b: toe * 0.3, w: footW, ch: { LEG: 1 } },
      ], dense));
    } else {
      // Three toes forward, one back, from the faces just above the ankle; each reaches the ground.
      const toes = [
        { d: [0, 0, 1], face: [0, 0, 1], len: 1 },
        { d: [0.62, 0, 0.78], face: [1, 0, 0], len: 0.85 },
        { d: [-0.62, 0, 0.78], face: [-1, 0, 0], len: 0.85 },
        { d: [0, 0, -1], face: [0, 0, -1], len: 0.45 },
      ];
      // The ankle's four faces point forward, back and to the sides; the side toes splay forward from theirs.
      const faces = toes.map((tt) => cage.faces[faceToward(above, ankle, tt.face)]);
      for (let i = 0; i < toes.length; i++) {
        const { d, len } = toes[i];
        const fiT = cage.faces.indexOf(faces[i]);
        const tl = toe * len;
        const o = [x, th, z];
        cage.extrude(fiT, densify([
          { c: v3.add(o, v3.add(v3.mul(d, lg.r * 1.2 + tl * 0.15), [0, th * 0.4, 0])), t: d, s: [0, 1, 0], a: th * 1.05, b: th * 1.05, w: footW, ch: { LEG: 1 } },
          { c: v3.add(o, v3.mul(d, lg.r + tl * 0.6)), t: d, s: [0, 1, 0], a: th * 0.9, b: th * 0.85, w: footW, ch: { LEG: 1 } },
          { c: v3.add(o, v3.add(v3.mul(d, lg.r + tl), [0, -th * 0.15, 0])), t: d, s: [0, 1, 0], a: th * 0.5, b: th * 0.45, w: footW, ch: { LEG: 1 } },
        ], dense));
      }
    }
    legInfo.push({ name, front: false, side });
  }

  // ---- Wings (flippers): flat, folded back along the body's sides -------------------------------------------------------
  const wg = { ...L.wings, ...M.wing };
  const wk = M.wingScale ?? 1;
  const wLen = (wg.len ?? b.l * 0.95) * wk;
  const thick = b.w * (wg.thick ?? 0.16);
  const depth = b.h * (wg.depth ?? 0.62) * wk;
  // Plumes (ostrich): the wing hangs lower at the back, and its trailing rings alternate wider and narrower, so the
  // edge subdivides into soft feather tips.
  const droop = wg.droop ?? 0;
  const plume = wg.plume ?? 0;
  const shT = rings.find((rr) => rr.name === 'shA').t;
  for (const side of [1, -1]) {
    const bone = side > 0 ? 'wingR' : 'wingL';
    const fi = cage.faceBetween(named.shA, after(named.shA), side > 0 ? 7 : 3);
    const fc = faceCentre(fi);
    joints[bone] = fc;
    // Along the wing: s = 0 at the shoulder to 1 at the tip. Its centre follows the body's side, a little high.
    const prof = penguin
      ? [[0.08, 0.5, 0.55], [0.3, 1, 1], [0.65, 0.85, 0.8], [0.9, 0.45, 0.55], [1.02, 0.12, 0.3]]
      : plume
        ? [[0.06, 0.45, 0.55], [0.22, 1, 1], [0.42, 1.05, 1.1], [0.6, 0.8, 0.95], [0.76, 1.0, 0.9], [0.9, 0.6, 0.7], [1.04, 0.3, 0.45]]
        : [[0.06, 0.45, 0.55], [0.25, 1, 1], [0.6, 0.82, 0.8], [0.88, 0.4, 0.5], [1.04, 0.08, 0.25]];
    const specs = prof.map(([s, ka, kb], i) => {
      const t = shT - (s * wLen) / b.l;
      // Tucked plumes (ostrich) lie against the flank instead of standing off it.
      const tuck = wg.tuck ?? 0;
      const sideX = bodyHalfWidth(Math.max(-1, t)) * (penguin ? 0.92 : lerp(0.95, 0.8, tuck)) + thick * lerp(0.45 + 0.4 * Math.min(1, s * 3), 0.3, tuck);
      const c = v3.add(bodyAt(t, penguin ? 0 : 0.12 - s * 0.15 - droop * s * s), [side * sideX, 0, 0]);
      return {
        c,
        t: v3.mul(dir, -1),
        s: up,
        a: depth * ka,
        b: thick * kb,
        shape: plume && i > 1 ? (co) => [depth * plume * (i % 2 ? 1 : -0.5) * (co < 0 ? 1.4 : 0.6), 0] : undefined,
        w: i === 0 ? { chest: 0.4, [bone]: 0.6 } : { [bone]: 1 },
        ch: { WING: i === 0 ? -0.2 * wLen : s * wLen },
      };
    });
    cage.extrude(fi, densify(specs, dense));
  }

  // ---- Tail ------------------------------------------------------------------------------------------------------------
  const tl = L.tail ?? { kind: 'short' };
  {
    const T = TAILS[tl.kind] ?? TAILS.short;
    const len = (tl.len ?? b.l * 0.3) * (M.tailScale ?? 1);
    const fc = faceCentre(cage.faces.indexOf(tailFace));
    // Penguins: out of the lower back, pointing back and down.
    // Hanging tails stop just above the ground (a macaw standing on it lays its tail along it).
    const minY = Math.min(...T.path.map((p) => p[1]));
    const drop = minY < 0 ? Math.min(1, (fc[1] - 0.6 * T.b[T.b.length - 2] * len - 0.004) / (-minY * len)) : 1;
    let pts = T.path.map(([x, y, z]) => v3.add(fc, penguin ? [x * len, -Math.abs(z) * len * 0.6 - y * len * 0.2, z * len * 0.8] : [x * len, y * len * (y < 0 ? drop : 1), z * len]));
    if (tl.kind === 'long') {
      // A hanging tail on a bird standing on the ground: a straight line down and back from the rump, its tip just
      // clear of the ground (not lying along it).
      const sinA = Math.min(0.9, Math.max(0.2, (fc[1] - 0.012) / len));
      const d = [0, -sinA, -Math.sqrt(1 - sinA * sinA)];
      pts = T.path.map((_, i) => v3.add(fc, v3.mul(d, (len * (0.2 + (0.8 * i) / (T.path.length - 1))))));
    }
    const tipLen = pts.reduce((s, p, i) => s + v3.len(v3.sub(p, i ? pts[i - 1] : fc)), 0);
    let d = 0;
    // M.tailWidth: the tail's half width at its base (× the body's half width), tapering to the tip.
    const wideK = M.tailWidth ? (b.w * M.tailWidth) / (T.a[0] * len) : T.widthOfBody ? b.w / len : 1;
    // M.tailDepth: its half thickness at the base (× the body's half height); a feather tail stays flat but not thin.
    const deepK = M.tailDepth ? (b.h * M.tailDepth) / (T.b[0] * len) : 1;
    const specs = pts.map((c, i) => {
      d += v3.len(v3.sub(c, i ? pts[i - 1] : fc));
      const f = i / (pts.length - 1);
      return { c, s: [1, 0, 0], a: T.a[i] * len * wideK, b: T.b[i] * len * deepK, w: f < 0.5 ? { hips: 0.4 - f * 0.6, tail0: 0.6 + f * 0.6 } : { tail0: 1.5 - f, tail1: f - 0.5 }, ch: { TAIL: tipLen - d } };
    });
    // Rings: tangents from the path.
    for (let i = 0; i < specs.length; i++) specs[i].t = v3.sub(specs[Math.min(specs.length - 1, i + 1)].c, i ? specs[i - 1].c : fc);
    joints.tail0 = fc;
    joints.tail1 = pts[Math.floor(pts.length / 2)];
    cage.extrude(cage.faces.indexOf(tailFace), densify(specs, dense));
  }

  // ---- Comb and wattles: islands on the head (they sink into it a little) -----------------------------------------------
  if (L.comb) {
    // Overlapping lobes along the crown, the middle ones tallest; they merge into one serrated comb.
    const k = L.comb.size ?? 1;
    const n = 4;
    if (dense) {
      // Subdivided once, separate lobes read as beads: loft one comb instead, a blade along the crown whose ring
      // heights alternate peak and notch, so its top edge is serrated.
      const PEAK = [0.8, 1, 0.95, 0.7];
      const specs = [];
      for (let j = 0; j <= 2 * n; j++) {
        const i = j / 2;
        const al = r * (0.4 + 0.12 - i * 0.24);
        const h = r * 0.36 * k * (j % 2 ? PEAK[Math.floor(i)] * 1.15 : 0.55);
        const rise = j === 0 || j === 2 * n ? 0.4 : 1;
        // The blade's base sits just inside the crown; the limit surface pulls rings in, so they are made generous.
        specs.push({ c: at(al, r * sq * 0.86 + h * rise * 0.5), t: v3.mul(hdir, -1), s: [1, 0, 0], a: r * 0.13 * Math.sqrt(k), b: h * rise * 0.8, n: 8, w: { head: 1 }, ch: { TIP: 0 } });
      }
      cage.tube(specs.map((sp) => cage.ring(sp)));
    } else for (let i = 0; i < n; i++) {
      const al = r * (0.4 - i * 0.24);
      const h = r * 0.3 * k * [0.8, 1, 0.95, 0.7][i];
      const c = at(al, r * sq * 0.78 + h * 0.55);
      lobe(cage, { c, t: hdir, a: r * 0.1 * Math.sqrt(k), b: h, d: r * 0.16 * k, w: { head: 1 }, ch: { TIP: 0 } }, dense);
    }
  }
  if (L.wattle) {
    const k = L.wattle.size ?? 1;
    for (const s of [1, -1]) {
      const c = v3.add(base, v3.add(v3.mul(hdir, -r * 0.12), v3.add(v3.mul(hup, -r * 0.42 * k), [s * r * 0.11, 0, 0])));
      lobe(cage, { c, t: hdir, a: r * 0.1 * k, b: r * 0.26 * k, d: r * 0.14 * k, w: { head: 1 }, ch: { TIP: 0, SNOUT: 4 } }, dense);
    }
  }

  // Eyes are placed on the subdivided surface (index.js): on the sides of the head, a little ahead of its middle.
  const ey = M.eye ?? { t: 0.25, ang: 0.15, fwd: 0.35 };
  const snoutAt = (name) => tip - arcs[idx(name)];
  const eyes = {
    snout: lerp(snoutAt('H1'), snoutAt('H2'), ey.t),
    band: 0.18 * r,
    size: (L.eyes?.size ?? r * 0.2) * (M.eyeScale ?? 1.3),
    dirs: [1, -1].map((side) => v3.norm(v3.add(v3.add(v3.mul([side, 0, 0], Math.cos(ey.ang)), v3.mul(hup, Math.sin(ey.ang))), v3.mul(hdir, ey.fwd ?? 0.3)))),
    hup,
    hdir,
  };

  return {
    cage,
    joints,
    parents,
    eyes,
    info: { kind: 'mesh-bird', plan: L.plan, legs: legInfo, legLen: lg.len, bodyH: b.h, bodyL: b.l, neckLen: nk.len, bodyLift: bodyBottom, penguin },
  };
}

/**
 * A closed lobe (comb, wattle). Subdivided twice, a box cage is round enough; subdivided once it stays boxy, so the
 * dense cage is three eight-sided rings (fuller in the middle) instead.
 */
function lobe(cage, { c, t, a, b, d, w, ch }, dense) {
  if (!dense) return cage.blob({ c, t, s: [1, 0, 0], a, b, d, w, ch });
  const T = v3.norm(t);
  const rs = [-0.85, 0, 0.85].map((k, i) => cage.ring({ c: v3.add(c, v3.mul(T, d * k)), t: T, s: [1, 0, 0], a: a * (i === 1 ? 1.12 : 0.8), b: b * (i === 1 ? 1.12 : 0.8), n: 8, w, ch }));
  cage.tube(rs);
}

export { CHANNELS };
