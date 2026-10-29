// Reptile body plans: lizard (iguana, Komodo dragon) and turtle (tortoises). The animal faces +z.

import * as THREE from 'three';
import { Segment, chain, cone, ellipsoid, limb, place } from './shapes.js';
import { buildEyes } from './quadruped.js';
import { captureRest, pivot, segMesh } from './rig.js';

const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/** Lizards: a low body on sprawling legs, a long tail in jointed segments so it can sway. */
export function buildLizard(L, material) {
  const b = L.body;
  const lg = L.legs;
  const hd = L.head;
  const coat = L.coat ?? b.color;
  const root = new THREE.Group();
  root.name = 'animal';
  const bodyY = lg.len * 0.55 + b.h * 0.2;
  const body = pivot('body', root, [0, bodyY, 0]);
  const bs = new Segment([0, bodyY, 0]);
  bs.add(ellipsoid(b.w, b.h, b.l, 20), L.bodyPaint ?? coat);
  if (L.spikes) {
    const n = L.spikes.count;
    for (let i = 0; i < n; i++) {
      const z = b.l * (0.9 - (1.8 * i) / n);
      const h = L.spikes.size * (1 - Math.abs(z / b.l) * 0.5);
      bs.add(place(cone(h * 0.3, h, 6), [0, b.h * 0.92 * Math.sqrt(Math.max(0, 1 - (z / b.l) ** 2)) + h * 0.35, z], [-0.25, 0, 0]), L.spikes.color);
    }
  }
  body.add(segMesh(bs, material, 'body'));

  // Sprawling legs: out sideways, then down.
  const legs = [];
  for (const front of [true, false]) {
    for (const side of [1, -1]) {
      const hip = [side * b.w * 0.75, -b.h * 0.2, (front ? 1 : -1) * b.l * 0.62];
      const g = pivot(`leg${front ? 'F' : 'B'}${side > 0 ? 'L' : 'R'}`, body, hip);
      const s = new Segment(add3([0, bodyY, 0], hip));
      const knee = [side * lg.len * 0.55, -lg.len * 0.05, front ? lg.len * 0.1 : -lg.len * 0.05];
      const foot = [side * lg.len * 0.62, -(bodyY - b.h * 0.2) + lg.r * 0.6, front ? lg.len * 0.2 : -lg.len * 0.05];
      s.add(limb([0, 0, 0], knee, lg.r, lg.r * 0.85), L.legPaint ?? coat);
      s.add(limb(knee, foot, lg.r * 0.85, lg.r * 0.6), L.legPaint ?? coat);
      for (const a of [-0.6, -0.2, 0.2, 0.6]) s.add(limb(foot, add3(foot, [Math.sin(a) * lg.r * 2.4, -lg.r * 0.3, Math.cos(a) * lg.r * 2.4]), lg.r * 0.35, lg.r * 0.2, 5), L.claw ?? L.legPaint ?? coat);
      g.add(segMesh(s, material, 'leg'));
      legs.push({ g, front, side });
    }
  }

  // Head on a short neck.
  const nPos = [0, b.h * 0.25, b.l * 0.92];
  const neck = pivot('neck', body, nPos);
  const nOrigin = add3([0, bodyY, 0], nPos);
  const end = [0, b.h * 0.15, L.neck?.len ?? b.l * 0.25];
  const ns = new Segment(nOrigin);
  ns.add(limb([0, 0, -b.h * 0.3], end, b.h * 0.72, hd.h * 0.85), L.neckPaint ?? coat);
  if (L.dewlap) ns.add(place(ellipsoid(b.w * 0.08, L.dewlap.size, L.dewlap.size * 1.1), add3(end, [0, -hd.h * 0.9, -hd.l * 0.2])), L.dewlap.color);
  neck.add(segMesh(ns, material, 'neck'));
  const head = pivot('head', neck, end);
  const hc = [0, hd.h * 0.1, hd.l * 0.5];
  const hs = new Segment(add3(nOrigin, end));
  hs.add(place(ellipsoid(hd.w, hd.h, hd.l, 16), hc), L.headPaint ?? hd.color ?? coat);
  hs.add(place(ellipsoid(hd.w * 0.7, hd.h * 0.6, hd.l * 0.55), add3(hc, [0, -hd.h * 0.2, hd.l * 0.7])), L.headPaint ?? hd.color ?? coat);
  if (L.cheek) for (const s of [1, -1]) hs.add(place(ellipsoid(hd.w * 0.3, hd.h * 0.3, hd.h * 0.3), add3(hc, [s * hd.w * 0.85, -hd.h * 0.35, -hd.l * 0.1])), L.cheek.color);
  head.add(segMesh(hs, material, 'head'));
  head.add(buildEyes({ eyes: { x: 0.75, y: 0.4, z: 0.25, ...L.eyes } }, hd, hc, material));
  const eyes = head.children.find((c) => c.name === 'eyes');

  // A forked tongue for flicking (hidden at rest by scaling it to zero length).
  let tongue = null;
  if (L.tongue) {
    tongue = pivot('tongue', head, add3(hc, [0, -hd.h * 0.25, hd.l * 1.2]));
    const ts = new Segment();
    const tl = hd.l * 0.9;
    ts.add(limb([0, 0, 0], [0, 0, tl * 0.75], hd.h * 0.06, hd.h * 0.05, 6), L.tongue.color);
    for (const s of [1, -1]) ts.add(limb([0, 0, tl * 0.75], [s * tl * 0.1, 0, tl], hd.h * 0.05, hd.h * 0.025, 5), L.tongue.color);
    tongue.add(segMesh(ts, material, 'tongue'));
    tongue.scale.set(1, 1, 0.001);
  }

  // Tail: nested segments so a sway travels down it.
  const tl = L.tail;
  const tail = [];
  let parent = body;
  let pos = [0, -b.h * 0.05, -b.l * 0.9];
  let origin = [0, bodyY, 0];
  const n = 4;
  for (let i = 0; i < n; i++) {
    const g = pivot(`tail${i}`, parent, pos);
    origin = add3(origin, pos);
    const r0 = tl.r * (1 - i / n);
    const r1 = tl.r * (1 - (i + 1) / n) + 0.004;
    const len = tl.len / n;
    const s = new Segment(origin);
    s.add(limb([0, 0, 0], [0, i === 0 ? -b.h * 0.15 : 0, -len], r0, r1, 10), tl.paint ?? coat);
    g.add(segMesh(s, material, 'tail'));
    tail.push(g);
    parent = g;
    pos = [0, i === 0 ? -b.h * 0.15 : 0, -len];
  }

  const rig = { kind: 'lizard', root, body, neck, head, eyes, tongue, legs, tail, size: { legLen: lg.len, bodyH: b.h, bodyL: b.l } };
  rig.rest = captureRest([body, neck, head, eyes, tongue, ...legs.map((l) => l.g), ...tail]);
  return { group: root, rig };
}

/** Turtles and tortoises: a domed shell on four stubby legs, a head that can pull in. */
export function buildTurtle(L, material) {
  const sh = L.shell;
  const lg = L.legs;
  const hd = L.head;
  const skin = L.skin;
  const root = new THREE.Group();
  root.name = 'animal';
  const bodyY = lg.len * 0.7;
  const body = pivot('body', root, [0, bodyY, 0]);
  const bs = new Segment([0, bodyY, 0]);
  const dome = new THREE.SphereGeometry(1, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  dome.scale(sh.rx, sh.ry, sh.rz);
  bs.add(dome, sh.paint);
  bs.add(place(ellipsoid(sh.rx * 1.02, sh.ry * 0.16, sh.rz * 1.02), [0, 0, 0]), sh.rim ?? L.plastron);
  bs.add(place(ellipsoid(sh.rx * 0.92, sh.ry * 0.12, sh.rz * 0.92), [0, -sh.ry * 0.12, 0]), L.plastron);
  body.add(segMesh(bs, material, 'body'));

  const legs = [];
  for (const front of [true, false]) {
    for (const side of [1, -1]) {
      const p = [side * sh.rx * 0.68, -sh.ry * 0.05, (front ? 1 : -1) * sh.rz * 0.6];
      const g = pivot(`leg${front ? 'F' : 'B'}${side > 0 ? 'L' : 'R'}`, body, p);
      const s = new Segment(add3([0, bodyY, 0], p));
      s.add(limb([0, 0, 0], [side * lg.r * 0.4, -bodyY + lg.r * 0.7 - p[1], front ? lg.r * 0.3 : 0], lg.r, lg.r * 1.05, 10), skin);
      for (const a of [-0.4, 0, 0.4]) s.add(place(cone(lg.r * 0.18, lg.r * 0.45, 5), [side * lg.r * 0.4 + Math.sin(a) * lg.r * 0.7, -bodyY - p[1] + lg.r * 0.25, Math.cos(a) * lg.r * 0.8], [Math.PI / 2, 0, 0]), L.claw ?? 0xe8dcc0);
      g.add(segMesh(s, material, 'leg'));
      legs.push({ g, front, side });
    }
  }

  const nPos = [0, sh.ry * 0.05, sh.rz * 0.82];
  const neck = pivot('neck', body, nPos);
  const nOrigin = add3([0, bodyY, 0], nPos);
  const len = L.neck?.len ?? hd.l * 1.4;
  const ns = new Segment(nOrigin);
  ns.add(limb([0, 0, 0], [0, len * 0.35, len], hd.h * 0.62, hd.h * 0.55), skin);
  neck.add(segMesh(ns, material, 'neck'));
  const head = pivot('head', neck, [0, len * 0.35, len]);
  const hc = [0, hd.h * 0.1, hd.l * 0.35];
  const hs = new Segment(add3(nOrigin, [0, len * 0.35, len]));
  hs.add(place(ellipsoid(hd.w, hd.h, hd.l, 14), hc), skin);
  hs.add(place(ellipsoid(hd.w * 0.75, hd.h * 0.5, hd.l * 0.35), add3(hc, [0, -hd.h * 0.35, hd.l * 0.65])), L.beak ?? skin);
  head.add(segMesh(hs, material, 'head'));
  head.add(buildEyes({ eyes: { x: 0.75, y: 0.3, z: 0.45, ...L.eyes } }, hd, hc, material));
  const eyes = head.children.find((c) => c.name === 'eyes');

  const tPos = [0, -sh.ry * 0.05, -sh.rz * 0.95];
  const tail = pivot('tail', body, tPos);
  const ts = new Segment(add3([0, bodyY, 0], tPos));
  ts.add(limb([0, 0, 0], [0, -lg.r * 0.4, -lg.r * 1.2], lg.r * 0.4, lg.r * 0.12, 6), skin);
  tail.add(segMesh(ts, material, 'tail'));

  const rig = { kind: 'turtle', root, body, neck, head, eyes, legs, tail, size: { legLen: lg.len, bodyH: sh.ry, bodyL: sh.rz, neckLen: len } };
  rig.rest = captureRest([body, neck, head, eyes, tail, ...legs.map((l) => l.g)]);
  return { group: root, rig };
}
