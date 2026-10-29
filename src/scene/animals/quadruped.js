// Four-legged body plans: hoof, cat, dog, bear, small, pachy. One builder, different defaults per plan and
// parameters per species (looks.js). Units are metres; sizes are radii (half-lengths). The animal faces +z.

import * as THREE from 'three';
import { createRng } from '../../core/rng.js';
import { Segment, chain, cone, egg, ellipsoid, limb, onEllipsoid, place, torso, torus } from './shapes.js';
import { mix } from './patterns.js';
import { captureRest, pivot, segMesh } from './rig.js';

const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/** Paints `color` where field > 0 over another paint, keeping a crisp edge between them. */
function over(paint, color, field) {
  return (...p) => {
    const v = typeof paint === 'function' ? paint(...p) : paint;
    const under = typeof v === 'number' ? v : v[2] > 0 ? v[1] : v[0];
    return [under, color, field(...p)];
  };
}

/**
 * Defaults per plan; species looks override them. `torso` shapes the body (shapes.js), `thigh` is the upper leg's
 * thickness relative to the leg, `hock` how far the back leg's joint sits behind it (share of the leg length), and
 * `taper` how much the head narrows towards the muzzle.
 */
export const QUAD_PLANS = {
  hoof: { foot: 'hoof', footColor: 0x3b302a, ears: { kind: 'pointy' }, gait: 'walk', torso: { round: 2.4, blunt: 2.6, chest: 0.06, sag: 0.06, tuck: 0.12 }, thigh: 1.9, hock: 0.07, taper: 0.32 },
  cat: { foot: 'paw', ears: { kind: 'round' }, gait: 'walk', torso: { round: 2.2, blunt: 2.3, chest: 0.12, tuck: 0.35 }, thigh: 1.6, hock: 0.07, taper: 0.1 },
  dog: { foot: 'paw', ears: { kind: 'pointy' }, gait: 'walk', torso: { round: 2.2, blunt: 2.3, chest: 0.14, tuck: 0.35 }, thigh: 1.6, hock: 0.07, taper: 0.2 },
  bear: { foot: 'paw', ears: { kind: 'round' }, gait: 'walk', torso: { round: 2.1, blunt: 2.2, chest: 0.04, slope: 0.05 }, thigh: 1.35, hock: 0.03, taper: 0.15 },
  small: { foot: 'paw', ears: { kind: 'round' }, gait: 'walk', torso: { round: 2.1, blunt: 2.2, chest: 0.04 }, thigh: 1.3, hock: 0.03, taper: 0.15 },
  pachy: { foot: 'pad', ears: { kind: 'round' }, gait: 'walk', torso: { round: 2.3, blunt: 2.4, sag: 0.08 }, thigh: 1.15, hock: 0, taper: 0.1 },
};

/**
 * @param {object} L  the species look (merged with sex and age overrides)
 * @param {THREE.Material} material
 * @param {number} seed
 */
export function buildQuadruped(L, material, seed) {
  const plan = { ...QUAD_PLANS[L.plan], ...L };
  const rng = createRng(seed);
  const b = L.body;
  const lg = L.legs;
  const nk = L.neck;
  const hd = L.head;
  const sn = L.snout;
  const coat = L.coat ?? b.color;
  const headPaint = L.headPaint ?? hd.color ?? coat;

  const root = new THREE.Group();
  root.name = 'animal';
  const bodyY = lg.len + b.h * 0.35;

  // Body and its decorations.
  const body = pivot('body', root, [0, bodyY, 0]);
  const bodySeg = new Segment([0, bodyY, 0]);
  const shape = { ...plan.torso, ...b.shape };
  // A sloping back (giraffe, hyena) lifts the shoulders; front legs and neck move up with it.
  const lift = (z) => (shape.slope ?? 0) * b.h * (z / b.l);
  bodySeg.add(torso(b.w, b.h, b.l, shape, 40), L.bodyPaint ?? coat);
  const ex = L.extras ?? {};
  if (ex.wool) addWool(bodySeg, b, ex.wool, rng);
  if (ex.haunches) {
    const hc = ex.haunches.color ?? b.color;
    for (const s of [1, -1])
      bodySeg.add(place(ellipsoid(b.w * 0.5, b.h * 0.72, b.l * 0.42), [s * b.w * 0.62, -b.h * 0.12, -b.l * 0.5]), hc);
  }
  if (ex.spineMane) {
    const m = ex.spineMane;
    bodySeg.add(limb([0, b.h * 0.9, b.l * 0.75], [0, b.h * 0.97, -b.l * (m.back ?? 0.2)], b.h * (m.r ?? 0.14), b.h * 0.05), m.color);
  }

  // Legs: pivots at the hips and shoulders, reaching the ground in the rest pose. Each has a thigh that blends into
  // the body, a knee (front) or hock (back), and a hoof, pad or paw.
  const legs = [];
  const footH = Math.max(0.025, lg.r * 0.55);
  for (const front of [true, false]) {
    const spec = { ...lg, ...(front ? lg.front : lg.back) };
    for (const side of [1, -1]) {
      const x = side * b.w * (lg.spread ?? 0.55);
      const z = (front ? 1 : -1) * b.l * (lg.inset ?? 0.55);
      const len = lg.len + lift(z);
      const g = pivot(`leg${front ? 'F' : 'B'}${side > 0 ? 'L' : 'R'}`, body, [x, -b.h * 0.35 + lift(z), z]);
      const seg = new Segment([x, len, z]);
      const paint = L.legPaint ?? spec.color ?? coat;
      const r = spec.r;
      const rFoot = spec.rFoot ?? r * 0.8;
      const rTop = r * (spec.thigh ?? plan.thigh) * (front ? 0.9 : 1);
      const thighH = Math.min(len * 0.26, b.h * 0.75);
      // The upper leg is a tall, flattened mass mostly inside the body, slightly inboard, so it reads as a shoulder or
      // haunch rather than a ball on the flank.
      seg.add(place(ellipsoid(rTop * 0.8, thighH * 1.3, rTop * (front ? 1.15 : 1.35), 22), [-side * rTop * 0.3, thighH * 0.35, front ? 0 : -rTop * 0.15]), paint);
      const ankle = [0, -len + footH * (plan.foot === 'paw' ? 1 : 1.6), 0];
      const top = [0, -thighH * 0.7, front ? 0 : -rTop * 0.2];
      if (front) {
        const knee = [0, -len * 0.55, 0.015 * len];
        seg.add(limb(top, knee, rTop * 0.66, r * 0.92, 16), paint);
        seg.add(limb(knee, ankle, r * 0.92, rFoot, 16), paint);
      } else {
        // Hind leg: the knee (stifle) points forward, the hock back.
        const k = spec.hock ?? plan.hock;
        const stifle = [0, -len * 0.3, k * len];
        const hock = [0, -len * 0.64, -k * 1.6 * len];
        seg.add(limb(top, stifle, rTop * 0.7, r * 1.1, 16), paint);
        seg.add(limb(stifle, hock, r * 1.1, r * 0.82, 16), paint);
        seg.add(limb(hock, ankle, r * 0.82, rFoot, 16), paint);
      }
      const fr = rFoot * 1.08;
      const footColor = spec.footColor ?? plan.footColor ?? mix(spec.color ?? b.color, 0x000000, 0.25);
      if (plan.foot === 'hoof')
        seg.add(place(new THREE.CylinderGeometry(fr * 0.95, fr * 1.22, footH * 2, 16), [0, -len + footH, 0]), footColor);
      else if (plan.foot === 'pad')
        seg.add(place(new THREE.CylinderGeometry(fr * 1.05, fr * 1.12, footH * 1.4, 18), [0, -len + footH * 0.7, 0]), spec.footColor ?? mix(spec.color ?? b.color, 0xffffff, 0.15));
      else seg.add(place(ellipsoid(fr * 1.2, Math.max(footH * 1.1, fr * 0.75), fr * 1.5), [0, -len + Math.max(footH * 1.1, fr * 0.75), fr * 0.4]), spec.footColor ?? spec.color ?? coat);
      g.add(segMesh(seg, material, 'leg'));
      legs.push({ g, front, side });
    }
  }

  // Neck, from the front-top of the body. A root inside the chest blends the two, and hides the joint when the
  // neck bends.
  const nz = b.l * (nk.z ?? 0.78);
  const nPos = [0, b.h * (nk.y ?? 0.45) + lift(nz), nz];
  const neck = pivot('neck', body, nPos);
  const nOrigin = [0, bodyY + nPos[1], nPos[2]];
  const a = nk.angle ?? 0.8;
  const end = [0, Math.sin(a) * nk.len, Math.cos(a) * nk.len];
  const rootR = Math.min(nk.r * 1.3, b.w * 0.9, b.h * 0.9);
  bodySeg.add(place(ellipsoid(rootR, rootR * 1.1, rootR * 1.2, 24), add3(nPos, [0, -rootR * 0.3, -rootR * 0.3])), L.neckPaint ?? L.bodyPaint ?? coat);
  const neckSeg = new Segment(nOrigin);
  const r2 = nk.r2 ?? nk.r * 0.75;
  const mid = [0, end[1] * 0.5, end[2] * 0.5];
  neckSeg.add(chain([[0, -nk.r * 0.3, -nk.r * 0.4], mid, end], nk.r * 1.05, r2, 18), L.neckPaint ?? coat);
  if (ex.wool?.neck) addNeckWool(neckSeg, end, nk, ex.wool, rng);
  if (ex.maneRidge) {
    // A flattened crest along the top of the neck, standing up (donkey, zebra, giraffe).
    const m = ex.maneRidge;
    const h = m.r ?? nk.r * 0.32;
    const paint = m.color === 'coat' ? L.neckPaint ?? coat : m.color;
    const rm = (nk.r * 1.05 + r2) / 2;
    const up = [0, Math.cos(a) * rm * 0.75, -Math.sin(a) * rm * 0.75];
    neckSeg.add(place(ellipsoid(h * 0.4, h, nk.len * 0.58, 28), add3(mid, up), [-a, 0, 0]), paint);
  }
  if (ex.mane) addMane(neckSeg, null, end, nk, hd, ex.mane, 'neck');
  neck.add(segMesh(neckSeg, material, 'neck'));
  body.add(segMesh(bodySeg, material, 'body'));

  // Head.
  const head = pivot('head', neck, end);
  const hOrigin = add3(nOrigin, end);
  const hc = [0, hd.h * 0.15, hd.l * 0.35];
  const headSeg = new Segment(hOrigin);
  headSeg.add(place(egg(hd.w, hd.h, hd.l, hd.taper ?? plan.taper, 30), hc), headPaint);
  const sc = [0, hc[1] - (sn.drop ?? hd.h * 0.25), hc[2] + hd.l * 0.72 + sn.l * 0.2];
  // A muzzle `tip` colour covers the front of the snout (zebra, donkey), over the head's own paint.
  const snoutPaint = sn.tip ? over(sn.color ?? headPaint, sn.tip, (lx, ly, lz) => lz - (sc[2] + sn.l * (sn.tipAt ?? 0.1))) : sn.color ?? headPaint;
  headSeg.add(place(egg(sn.w, sn.h, sn.l, 0.1, 22), sc), snoutPaint);
  const nose = L.nose;
  if (nose?.kind === 'disc') {
    headSeg.add(place(new THREE.CylinderGeometry(sn.w * 0.85, sn.w * 0.85, sn.l * 0.25, 14), [0, sc[1], sc[2] + sn.l * 0.92], [Math.PI / 2, 0, 0]), nose.color);
  } else if (nose) {
    headSeg.add(place(ellipsoid(sn.w * 0.5, sn.h * 0.32, sn.l * 0.22), [0, sc[1] + sn.h * 0.45, sc[2] + sn.l * 0.82]), nose.color);
  }
  addEars(headSeg, hd, hc, { ...plan.ears, ...L.ears }, headPaint);
  if (ex.cheeks) for (const s of [1, -1]) headSeg.add(place(ellipsoid(hd.w * 0.42, hd.h * 0.4, hd.l * 0.42), add3(hc, [s * hd.w * 0.62, -hd.h * 0.3, hd.l * 0.35])), ex.cheeks.color);
  if (ex.brows) for (const s of [1, -1]) headSeg.add(place(ellipsoid(hd.w * 0.16, hd.h * 0.1, hd.l * 0.12), add3(hc, onEllipsoid(hd.w, hd.h, hd.l, s * 0.42, 0.62, 0.66, 1.0))), ex.brows.color);
  if (ex.eyePatches) {
    const e = L.eyes?.size ?? hd.h * 0.16;
    for (const s of [1, -1]) {
      const p = add3(hc, onEllipsoid(hd.w, hd.h, hd.l, s * (L.eyes?.x ?? 0.6), L.eyes?.y ?? 0.32, L.eyes?.z ?? 0.72, 0.98));
      headSeg.add(place(ellipsoid(e * 2.1, e * 1.5, e * 1.2), p, [0, 0, s * 0.55]), ex.eyePatches.color);
    }
  }
  if (ex.horns) addHorns(headSeg, hd, hc, ex.horns);
  if (ex.antlers) addAntlers(headSeg, hd, hc, ex.antlers);
  if (ex.ossicones) {
    for (const s of [1, -1]) {
      const base = add3(hc, onEllipsoid(hd.w, hd.h, hd.l, s * 0.3, 0.9, -0.25, 0.9));
      const top = add3(base, [s * 0.02, ex.ossicones.len, -0.03]);
      headSeg.add(limb(base, top, ex.ossicones.r, ex.ossicones.r * 0.85), ex.ossicones.color);
      headSeg.add(place(ellipsoid(ex.ossicones.r * 1.25, ex.ossicones.r * 1.1, ex.ossicones.r * 1.25), top), ex.ossicones.tip);
    }
  }
  if (ex.beard) headSeg.add(place(cone(sn.w * 0.45, ex.beard.len), [0, sc[1] - sn.h - ex.beard.len * 0.35, sc[2] - sn.l * 0.2], [Math.PI, 0, 0]), ex.beard.color);
  if (ex.tusks) addTusks(headSeg, sc, sn, ex.tusks);
  if (ex.warts) for (const s of [1, -1]) headSeg.add(place(ellipsoid(hd.w * 0.18, hd.h * 0.16, hd.l * 0.14), add3(hc, onEllipsoid(hd.w, hd.h, hd.l, s * 0.85, 0.05, 0.55, 1.0))), ex.warts.color);
  if (ex.topknot) addTopknot(headSeg, hd, hc, ex.topknot, rng);
  if (ex.mane) addMane(null, headSeg, end, nk, hd, ex.mane, 'head', hc);
  head.add(segMesh(headSeg, material, 'head'));

  // Eyes: their own mesh so they can close.
  const eyes = buildEyes(L, hd, hc, material);
  head.add(eyes);

  // Trunk (elephant, tapir): its own pivot so it can swing.
  let trunk = null;
  if (ex.trunk) {
    const tPos = [0, sc[1] - sn.h * 0.2, sc[2] + sn.l * 0.55];
    trunk = pivot('trunk', head, tPos);
    const t = ex.trunk;
    const pts = t.curve.map(([y, z]) => [0, y * t.len, z * t.len]);
    const tSeg = new Segment(add3(hOrigin, tPos));
    tSeg.add(chain(pts, t.r, t.r2 ?? t.r * 0.45, 12), t.color ?? headPaint);
    trunk.add(segMesh(tSeg, material, 'trunk'));
  }

  // Tail.
  const tl = L.tail ?? { kind: 'none' };
  const tPos = [0, b.h * (tl.y ?? 0.3), -b.l * 0.95];
  const tail = pivot('tail', body, tPos);
  const tailSeg = new Segment([0, bodyY + tPos[1], tPos[2]]);
  addTail(tailSeg, tl, coat);
  if (!tailSeg.empty) tail.add(segMesh(tailSeg, material, 'tail'));

  const rig = {
    kind: 'quad',
    gait: L.gait ?? plan.gait,
    stance: L.stance ?? null,
    root,
    body,
    neck,
    head,
    eyes,
    tail,
    trunk,
    legs,
    size: { legLen: lg.len, bodyH: b.h, bodyL: b.l },
  };
  rig.rest = captureRest([body, neck, head, eyes, tail, trunk, ...legs.map((l) => l.g)]);
  return { group: root, rig };
}

function addWool(seg, b, wool, rng) {
  const n = wool.count ?? 30;
  const r = Math.min(b.w, b.h) * (wool.size ?? 0.42);
  for (let i = 0; i < n; i++) {
    const u = [rng.range(-1, 1), rng.range(-0.35, 1), rng.range(-1, 1)];
    const p = onEllipsoid(b.w, b.h, b.l, ...u, 0.88);
    seg.add(place(ellipsoid(r, r * 0.9, r, 12), p), mix(wool.color, 0xffffff, rng.range(0, 0.12)));
  }
}

function addNeckWool(seg, end, nk, wool, rng) {
  const n = 7;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const r = nk.r * (1.25 - t * 0.3);
    seg.add(place(ellipsoid(r, r, r, 12), [rng.range(-0.01, 0.01), end[1] * t, end[2] * t]), mix(wool.color, 0xffffff, rng.range(0, 0.1)));
  }
}

function addTopknot(seg, hd, hc, knot, rng) {
  for (let i = 0; i < 6; i++) {
    const p = add3(hc, onEllipsoid(hd.w, hd.h, hd.l, rng.range(-0.5, 0.5), 1, rng.range(-0.6, 0.3), 0.95));
    const r = hd.w * (knot.size ?? 0.42);
    seg.add(place(ellipsoid(r, r, r, 12), p), mix(knot.color, 0xffffff, rng.range(0, 0.1)));
  }
}

function addEars(seg, hd, hc, ears, headPaint) {
  if (!ears || ears.kind === 'none') return;
  const s = ears.size ?? hd.h * 0.7;
  const color = ears.color ?? headPaint;
  for (const side of [1, -1]) {
    if (ears.kind === 'pointy') {
      const p = add3(hc, onEllipsoid(hd.w, hd.h, hd.l, side * 0.55, 0.85, ears.z ?? -0.15, 0.9));
      seg.add(place(cone(s * 0.42, s, 10), add3(p, [0, s * 0.4, 0]), [-0.15, 0, -side * (ears.splay ?? 0.35)], [1, 1, 0.55]), color);
      if (ears.inner) seg.add(place(cone(s * 0.26, s * 0.7, 8), add3(p, [side * -0.004, s * 0.36, s * 0.07]), [-0.15, 0, -side * (ears.splay ?? 0.35)], [1, 1, 0.3]), ears.inner);
    } else if (ears.kind === 'round' || ears.kind === 'small') {
      const p = add3(hc, onEllipsoid(hd.w, hd.h, hd.l, side * 0.62, 0.78, ears.z ?? -0.2, 0.92));
      seg.add(place(ellipsoid(s * 0.5, s * 0.5, s * 0.22), p, [0, 0, -side * 0.3]), color);
      if (ears.inner) seg.add(place(ellipsoid(s * 0.3, s * 0.3, s * 0.1), add3(p, [0, 0, s * 0.12]), [0, 0, -side * 0.3]), ears.inner);
    } else if (ears.kind === 'long') {
      const p = add3(hc, onEllipsoid(hd.w, hd.h, hd.l, side * 0.4, 0.9, -0.3, 0.85));
      const rot = [-(ears.back ?? 0.35), 0, -side * (ears.splay ?? 0.2)];
      seg.add(place(ellipsoid(s * 0.24, s * 0.5, s * 0.11), add3(p, [side * s * 0.1, s * 0.45, -s * 0.15]), rot), color);
      if (ears.inner) seg.add(place(ellipsoid(s * 0.14, s * 0.4, s * 0.06), add3(p, [side * s * 0.1, s * 0.45, -s * 0.1]), rot), ears.inner);
    } else if (ears.kind === 'floppy') {
      const p = add3(hc, onEllipsoid(hd.w, hd.h, hd.l, side * 0.8, 0.45, ears.z ?? 0.0, 0.92));
      seg.add(place(ellipsoid(s * 0.5, s * 0.12, s * 0.26), add3(p, [side * s * 0.38, -s * 0.06, s * 0.05]), [0.2, side * 0.3, -side * (ears.droop ?? 0.45)]), color);
    } else if (ears.kind === 'big') {
      const p = add3(hc, [side * hd.w * 0.92, hd.h * 0.05, -hd.l * 0.2]);
      seg.add(place(ellipsoid(s * 0.07, s, s * 0.8), add3(p, [side * s * 0.12, 0, -s * 0.35]), [0, side * 0.5, 0]), color);
    }
  }
}

function addHorns(seg, hd, hc, h) {
  const s = h.size;
  for (const side of [1, -1]) {
    const base = add3(hc, onEllipsoid(hd.w, hd.h, hd.l, side * 0.38, 0.92, 0.05, 0.85));
    const pts = (h.curve ?? [[0, 0, 0], [0.06, 0.45, -0.2], [0.14, 0.62, -0.62], [0.22, 0.45, -0.98]]).map(([x, y, z]) => add3(base, [side * x * s, y * s, z * s]));
    seg.add(chain(pts, h.r ?? s * 0.13, (h.r ?? s * 0.13) * 0.25, 8), h.color);
  }
}

function addAntlers(seg, hd, hc, an) {
  const s = an.size;
  const r = an.r ?? s * 0.035;
  for (const side of [1, -1]) {
    const base = add3(hc, onEllipsoid(hd.w, hd.h, hd.l, side * 0.4, 0.9, -0.15, 0.85));
    const beam = [[0, 0, 0], [0.12, 0.25, -0.18], [0.28, 0.55, -0.15], [0.32, 0.8, 0.05], [0.26, 0.98, 0.25]].map(([x, y, z]) => add3(base, [side * x * s, y * s, z * s]));
    seg.add(chain(beam, r, r * 0.55, 7), an.color);
    // Tines: forward from the beam, plus the reindeer's brow tine over the face.
    for (const [i, len] of [[2, 0.22], [3, 0.2]]) seg.add(limb(beam[i], add3(beam[i], [side * 0.02 * s, len * s * 0.6, len * s]), r * 0.6, r * 0.3, 6), an.color);
    seg.add(limb(add3(base, [side * 0.03 * s, 0.1 * s, -0.04 * s]), add3(base, [side * 0.01 * s, 0.2 * s, 0.26 * s]), r * 0.7, r * 0.4, 6), an.color);
  }
}

function addTusks(seg, sc, sn, t) {
  for (const side of [1, -1]) {
    const base = add3(sc, [side * sn.w * 0.7, -sn.h * 0.3, sn.l * 0.2]);
    const pts = (t.curve ?? [[0, 0, 0], [0.15, 0.2, 0.55], [0.3, 0.75, 0.85]]).map(([x, y, z]) => add3(base, [side * x * t.len, y * t.len, z * t.len]));
    seg.add(chain(pts, t.r, t.r * 0.35, 8), t.color ?? 0xf3ead5);
  }
}

function addMane(neckSeg, headSeg, end, nk, hd, mane, part, hc) {
  const color = mane.color;
  if (part === 'neck') {
    for (let i = 0; i < 4; i++) {
      const t = i / 3;
      const r = nk.r * (mane.neck ?? 1.55);
      neckSeg.add(place(ellipsoid(r, r, r * 0.9), [0, end[1] * t + nk.r * 0.25, end[2] * t]), mix(color, 0x000000, t * 0.12));
    }
    return;
  }
  // A ring of tufts around the face plus a fill behind it.
  const n = 12;
  const R = hd.w * (mane.size ?? 1.2);
  const cz = hc[2] - hd.l * 0.7;
  headSeg.add(place(ellipsoid(R * 0.95, R * 0.95, hd.l * 0.75), [0, hc[1], cz - hd.l * 0.25]), color);
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    const r = hd.w * 0.55;
    headSeg.add(place(ellipsoid(r, r, r * 0.9, 14), [Math.cos(ang) * R, hc[1] + Math.sin(ang) * R * 1.05, cz]), mix(color, 0x000000, (i % 3) * 0.06));
  }
}

function addTail(seg, t, coat) {
  const c = t.color ?? coat;
  const len = t.len ?? 0.1;
  const r = t.r ?? len * 0.08;
  switch (t.kind) {
    case 'stub':
      seg.add(place(ellipsoid(r * 2.2, r * 2, r * 2.2), [0, 0, -r]), c);
      break;
    case 'thin':
    case 'tuft': {
      const tip = [0, -len * 0.82, -len * 0.45];
      seg.add(limb([0, 0, 0], tip, r, r * 0.6), c);
      if (t.kind === 'tuft') seg.add(place(ellipsoid(r * 2.1, r * 3.4, r * 2.1), add3(tip, [0, -r * 2, -r * 0.6])), t.tip ?? c);
      break;
    }
    case 'up': {
      const tip = [0, len * 0.75, -len * 0.55];
      seg.add(limb([0, 0, 0], tip, r, r * 0.6), c);
      seg.add(place(ellipsoid(r * 1.8, r * 2.8, r * 1.8), add3(tip, [0, r * 2, -r * 0.4])), t.tip ?? c);
      break;
    }
    case 'long': {
      // Hangs from the rump, then curves up and back at the tip.
      const pts = [[0, 0, 0], [0, -len * 0.3, -len * 0.28], [0, -len * 0.55, -len * 0.5], [0, -len * 0.62, -len * 0.78], [0, -len * 0.5, -len * 0.98]];
      seg.add(chain(pts, r, r * 0.75), c);
      if (t.tip) seg.add(place(ellipsoid(r * 1.6, r * 1.6, r * 2.2), add3(pts[4], [0, r * 0.4, -r])), t.tip);
      break;
    }
    case 'bushy': {
      seg.add(place(ellipsoid(len * 0.2, len * 0.2, len * 0.55), [0, -len * 0.3, -len * 0.45], [0.55, 0, 0]), c);
      if (t.tip) seg.add(place(ellipsoid(len * 0.15, len * 0.15, len * 0.17), [0, -len * 0.55, -len * 0.88], [0.55, 0, 0]), t.tip);
      break;
    }
    case 'ringed': {
      const pts = [[0, 0, 0], [0, -len * 0.2, -len * 0.35], [0, -len * 0.3, -len * 0.7], [0, -len * 0.28, -len]];
      const g = chain(pts, r, r * 0.8, 12);
      const ring = t.ring;
      seg.add(g, (x, y, z) => (Math.floor(Math.hypot(y, z) / (len / 7)) % 2 === 1 ? ring : c));
      break;
    }
    case 'curly':
      seg.add(place(torus(len * 0.3, r, Math.PI * 1.6), [0, 0, -len * 0.25], [0, Math.PI / 2, 0]), c);
      break;
    case 'thick': {
      const pts = [[0, 0, 0], [0, -len * 0.25, -len * 0.45], [0, -len * 0.3, -len]];
      seg.add(chain(pts, r, r * 0.3, 10), c);
      break;
    }
    default:
      break;
  }
}

/** Eyes with a highlight; one mesh so it can be scaled shut. */
export function buildEyes(L, hd, hc, material) {
  const e = L.eyes ?? {};
  const r = e.size ?? hd.h * 0.16;
  // The group sits at eye height so closing (scale.y → small) shrinks the eyes in place.
  const c = add3(hc, onEllipsoid(hd.w, hd.h, hd.l, e.x ?? 0.6, e.y ?? 0.32, e.z ?? 0.72, e.depth ?? 0.98));
  const seg = new Segment();
  for (const side of [1, -1]) {
    const p = [side * c[0], 0, 0];
    seg.add(place(ellipsoid(r, r, r * 0.8, 10), p), e.color ?? 0x14100e);
    seg.add(place(ellipsoid(r * 0.3, r * 0.3, r * 0.2, 6), add3(p, [side * r * 0.25, r * 0.35, r * 0.6])), 0xffffff);
  }
  const eyes = new THREE.Group();
  eyes.name = 'eyes';
  eyes.position.set(0, c[1], c[2]);
  eyes.add(segMesh(seg, material, 'eyes'));
  return eyes;
}
