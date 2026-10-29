// Bird body plans: bird-walk (chicken, ostrich, flamingo), bird-perch (macaw) and penguin.
// Units are metres; sizes are radii. The bird faces +z.

import * as THREE from 'three';
import { Segment, chain, cone, ellipsoid, limb, place } from './shapes.js';
import { buildEyes } from './quadruped.js';
import { captureRest, pivot, segMesh } from './rig.js';

const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
/** Rotates a point about the x axis (positive angle tilts +z upwards). */
const tilt = ([x, y, z], a) => [x, y * Math.cos(a) + z * Math.sin(a), -y * Math.sin(a) + z * Math.cos(a)];

/**
 * @param {object} L  the species look
 * @param {THREE.Material} material
 */
export function buildBird(L, material) {
  const b = L.body;
  const lg = L.legs;
  const hd = L.head;
  const coat = L.coat ?? b.color;
  const pitch = L.pitch ?? 0.15;
  const penguin = L.plan === 'penguin';

  const root = new THREE.Group();
  root.name = 'animal';
  const bodyY = lg.len + b.h * (L.hipDrop ?? 0.55);
  const body = pivot('body', root, [0, bodyY, 0]);
  const bodySeg = new Segment([0, bodyY, 0]);
  bodySeg.add(place(ellipsoid(b.w, b.h, b.l, 20), [0, 0, 0], [-pitch, 0, 0]), L.bodyPaint ?? coat);
  if (L.chest) bodySeg.add(place(ellipsoid(b.w * 0.8, b.h * 0.75, b.l * 0.5), tilt([0, -b.h * 0.05, b.l * 0.55], pitch), [-pitch, 0, 0]), L.chest.color);
  body.add(segMesh(bodySeg, material, 'body'));

  // Legs.
  const legs = [];
  for (const side of [1, -1]) {
    const x = side * b.w * 0.42;
    const hip = [x, -b.h * (L.hipDrop ?? 0.55), -b.l * (L.hipBack ?? 0.05)];
    const g = pivot(`leg${side > 0 ? 'L' : 'R'}`, body, hip);
    const seg = new Segment([x, lg.len, hip[2]]);
    if (lg.thigh) seg.add(place(ellipsoid(lg.thigh.r, lg.thigh.len, lg.thigh.r * 1.1), [0, -lg.thigh.len * 0.4, 0]), lg.thigh.color ?? coat);
    seg.add(limb([0, 0, 0], [0, -lg.len + lg.r, 0], lg.r, lg.r * 0.85), lg.color);
    const toe = lg.toe ?? lg.len * 0.22;
    if (penguin) {
      seg.add(place(ellipsoid(lg.r * 1.6, lg.r * 0.45, toe), [0, -lg.len + lg.r * 0.4, toe * 0.6]), lg.color);
    } else {
      for (const a of [-0.45, 0, 0.45]) seg.add(limb([0, -lg.len + lg.r * 0.6, 0], [Math.sin(a) * toe, -lg.len + lg.r * 0.5, Math.cos(a) * toe], lg.r * 0.55, lg.r * 0.35, 6), lg.color);
      seg.add(limb([0, -lg.len + lg.r * 0.6, 0], [0, -lg.len + lg.r * 0.5, -toe * 0.5], lg.r * 0.5, lg.r * 0.3, 6), lg.color);
    }
    g.add(segMesh(seg, material, 'leg'));
    legs.push({ g, side });
  }

  // Neck: a curve of points (S-shaped for flamingos) or a straight stalk at an angle.
  const nk = L.neck;
  const nPos = tilt([0, b.h * (nk.y ?? 0.45), b.l * (nk.z ?? 0.75)], pitch);
  const neck = pivot('neck', body, nPos);
  const nOrigin = add3([0, bodyY, 0], nPos);
  const pts = nk.curve ? nk.curve.map(([y, z]) => [0, y * nk.len, z * nk.len]) : [[0, 0, 0], [0, Math.sin(nk.angle ?? 1.2) * nk.len, Math.cos(nk.angle ?? 1.2) * nk.len]];
  const end = pts[pts.length - 1];
  const neckSeg = new Segment(nOrigin);
  neckSeg.add(chain(pts, nk.r, nk.r2 ?? nk.r * 0.8, 10), L.neckPaint ?? nk.color ?? coat);
  neck.add(segMesh(neckSeg, material, 'neck'));

  // Head and beak.
  const head = pivot('head', neck, end);
  const hOrigin = add3(nOrigin, end);
  const r = hd.r;
  const hc = [0, r * 0.45, r * 0.2];
  const headSeg = new Segment(hOrigin);
  headSeg.add(place(ellipsoid(r, r * (hd.squash ?? 0.95), r * 1.05, 16), hc), L.headPaint ?? hd.color ?? coat);
  const bk = L.beak;
  const bBase = add3(hc, [0, -r * (bk.drop ?? 0.1), r * 0.85]);
  if (bk.kind === 'hook') {
    headSeg.add(chain([bBase, add3(bBase, [0, bk.len * 0.1, bk.len * 0.55]), add3(bBase, [0, -bk.len * 0.45, bk.len * 0.85])], bk.r, bk.r * 0.15, 10), bk.color);
    headSeg.add(place(ellipsoid(bk.r * 0.8, bk.r * 0.55, bk.len * 0.35), add3(bBase, [0, -bk.r * 0.7, bk.len * 0.25])), bk.lower ?? bk.color);
  } else if (bk.kind === 'bent') {
    const mid = add3(bBase, [0, -bk.len * 0.05, bk.len * 0.5]);
    headSeg.add(limb(bBase, mid, bk.r, bk.r * 0.8, 8), bk.color);
    headSeg.add(limb(mid, add3(mid, [0, -bk.len * 0.42, bk.len * 0.25]), bk.r * 0.8, bk.r * 0.3, 8), bk.tip ?? bk.color);
  } else {
    headSeg.add(place(cone(bk.r, bk.len, 10), add3(bBase, [0, 0, bk.len * 0.45]), [Math.PI / 2, 0, 0], [1, bk.flat ? 0.55 : 1, 1]), bk.color);
    if (bk.tip) headSeg.add(place(cone(bk.r * 0.45, bk.len * 0.3, 8), add3(bBase, [0, 0, bk.len * 0.85]), [Math.PI / 2, 0, 0]), bk.tip);
  }
  if (L.comb) {
    const c = L.comb;
    for (let i = 0; i < 4; i++) headSeg.add(place(ellipsoid(r * 0.13 * c.size, r * 0.32 * c.size, r * 0.17 * c.size), add3(hc, [0, r * (0.85 + (i % 2) * 0.08), r * (0.45 - i * 0.3)])), c.color);
  }
  if (L.wattle) for (const s of [1, -1]) headSeg.add(place(ellipsoid(r * 0.12 * L.wattle.size, r * 0.32 * L.wattle.size, r * 0.16 * L.wattle.size), add3(bBase, [s * r * 0.1, -r * 0.42, -r * 0.05])), L.wattle.color);
  if (L.face) for (const s of [1, -1]) headSeg.add(place(ellipsoid(r * 0.35, r * 0.42, r * 0.5), add3(hc, [s * r * 0.62, -r * 0.02, r * 0.42])), L.face.color);
  if (L.brow) for (const s of [1, -1]) headSeg.add(place(ellipsoid(r * 0.28, r * 0.12, r * 0.38), add3(hc, [s * r * 0.55, r * 0.55, r * 0.1]), [0, 0, s * 0.35]), L.brow.color);
  head.add(segMesh(headSeg, material, 'head'));
  head.add(buildEyes({ eyes: { x: 0.72, y: 0.25, z: 0.58, ...L.eyes } }, { w: r, h: r, l: r * 1.05 }, hc, material));
  const eyes = head.children.find((c) => c.name === 'eyes');

  // Wings: pivots at the shoulders so they can flap open.
  const wings = [];
  const w = L.wings;
  for (const side of [1, -1]) {
    const sh = tilt([side * b.w * 0.82, b.h * 0.3, b.l * 0.35], pitch);
    const g = pivot(`wing${side > 0 ? 'L' : 'R'}`, body, sh);
    const seg = new Segment(add3([0, bodyY, 0], sh));
    const len = w.len ?? b.l * 0.95;
    seg.add(place(ellipsoid(b.w * (w.thick ?? 0.16), b.h * (w.depth ?? 0.62), len), tilt([side * b.w * 0.08, -b.h * 0.3, -len * 0.75], pitch), [-pitch, 0, 0]), w.paint ?? w.color ?? coat);
    g.add(segMesh(seg, material, 'wing'));
    wings.push({ g, side });
  }

  // Tail.
  const t = L.tail ?? { kind: 'short' };
  const tPos = tilt([0, b.h * 0.15, -b.l * 0.92], pitch);
  const tail = pivot('tail', body, tPos);
  const tSeg = new Segment(add3([0, bodyY, 0], tPos));
  const tc = t.color ?? coat;
  if (t.kind === 'fan') {
    for (const a of [-0.5, -0.25, 0, 0.25, 0.5]) tSeg.add(place(ellipsoid(t.len * 0.12, t.len * 0.04, t.len * 0.5), [Math.sin(a) * t.len * 0.4, t.len * 0.25, -Math.cos(a) * t.len * 0.4], [0.6 - pitch, a, 0]), tc);
  } else if (t.kind === 'sickle') {
    for (const [s, h] of [[-0.06, 1], [0, 1.15], [0.06, 0.95]]) {
      const pts = [[0, 0, 0], [s * t.len, 0.6 * h * t.len, -0.25 * t.len], [s * t.len * 1.4, 0.75 * h * t.len, -0.6 * t.len], [s * t.len * 1.6, 0.45 * h * t.len, -0.9 * t.len]];
      tSeg.add(chain(pts, t.len * 0.07, t.len * 0.03, 8), tc);
    }
  } else if (t.kind === 'long') {
    tSeg.add(chain([[0, 0, 0], [0, -t.len * 0.45, -t.len * 0.35], [0, -t.len * 0.95, -t.len * 0.5]], t.len * 0.09, t.len * 0.02, 8), t.paint ?? tc);
  } else if (t.kind === 'plume') {
    tSeg.add(place(ellipsoid(t.len * 0.45, t.len * 0.35, t.len * 0.4), [0, t.len * 0.1, -t.len * 0.2]), tc);
  } else {
    tSeg.add(place(cone(b.w * 0.35, t.len ?? b.l * 0.3, 8), [0, 0, -(t.len ?? b.l * 0.3) * 0.4], [-Math.PI / 2 - (t.lift ?? 0.3), 0, 0], [1, 0.4, 1]), tc);
  }
  tail.add(segMesh(tSeg, material, 'tail'));

  const rig = {
    kind: penguin ? 'penguin' : 'bird',
    perch: L.plan === 'bird-perch',
    root,
    body,
    neck,
    head,
    eyes,
    tail,
    wings,
    legs,
    size: { legLen: lg.len, bodyH: b.h, bodyL: b.l },
  };
  rig.rest = captureRest([body, neck, head, eyes, tail, ...wings.map((w) => w.g), ...legs.map((l) => l.g)]);
  return { group: root, rig };
}
