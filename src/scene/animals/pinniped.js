// Pinniped body plan: sea lions and seals. A tapering body that lies on the ground, front and rear flippers.
// Sea lions prop themselves up on their front flippers (`upright`); seals lie flat. The animal faces +z.

import * as THREE from 'three';
import { Segment, chain, ellipsoid, onEllipsoid, place } from './shapes.js';
import { buildEyes } from './quadruped.js';
import { captureRest, pivot, segMesh } from './rig.js';

const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

export function buildPinniped(L, material) {
  const b = L.body;
  const hd = L.head;
  const sn = L.snout;
  const coat = L.coat ?? b.color;
  const lift = L.upright ? 0.42 : 0.08; // how far the chest is raised (radians)

  const root = new THREE.Group();
  root.name = 'animal';
  const bodyY = b.h * 0.92;
  const body = pivot('body', root, [0, bodyY, 0]);
  const seg = new Segment([0, bodyY, 0]);
  // Chest, raised by `lift`, and a tapering rear that rests on the ground.
  seg.add(place(ellipsoid(b.w, b.h, b.l * 0.6, 20), [0, Math.sin(lift) * b.l * 0.3, b.l * 0.2], [-lift, 0, 0]), L.bodyPaint ?? coat);
  seg.add(chain([[0, 0, -b.l * 0.1], [0, -b.h * 0.35, -b.l * 0.75], [0, -b.h * 0.55, -b.l * 1.15]], b.h * 0.92, b.h * 0.3, 16), L.bodyPaint ?? coat);
  body.add(segMesh(seg, material, 'body'));

  // Neck and head, from the top of the chest.
  const nPos = [0, b.h * 0.55 + Math.sin(lift) * b.l * 0.55, b.l * 0.62];
  const neck = pivot('neck', body, nPos);
  const nOrigin = add3([0, bodyY, 0], nPos);
  const nk = L.neck;
  const end = [0, Math.sin(nk.angle) * nk.len, Math.cos(nk.angle) * nk.len];
  const nSeg = new Segment(nOrigin);
  nSeg.add(chain([[0, -nk.r * 0.4, -nk.r * 0.6], end], nk.r, nk.r * 0.75, 14), L.bodyPaint ?? coat);
  neck.add(segMesh(nSeg, material, 'neck'));

  const head = pivot('head', neck, end);
  const hc = [0, hd.h * 0.1, hd.l * 0.3];
  const hSeg = new Segment(add3(nOrigin, end));
  hSeg.add(place(ellipsoid(hd.w, hd.h, hd.l, 18), hc), hd.color ?? coat);
  const sc = add3(hc, [0, -hd.h * 0.25, hd.l * 0.75 + sn.l * 0.3]);
  hSeg.add(place(ellipsoid(sn.w, sn.h, sn.l), sc), sn.color ?? hd.color ?? coat);
  hSeg.add(place(ellipsoid(sn.w * 0.4, sn.h * 0.3, sn.l * 0.2), add3(sc, [0, sn.h * 0.45, sn.l * 0.8])), L.nose ?? 0x1c1714);
  for (const s of [1, -1]) {
    // Whisker pads.
    hSeg.add(place(ellipsoid(sn.w * 0.5, sn.h * 0.55, sn.l * 0.55), add3(sc, [s * sn.w * 0.45, -sn.h * 0.1, sn.l * 0.35])), mix2(sn.color ?? hd.color ?? coat));
    if (L.earFlaps) hSeg.add(place(ellipsoid(hd.w * 0.1, hd.h * 0.22, hd.l * 0.12), add3(hc, onEllipsoid(hd.w, hd.h, hd.l, s * 0.85, 0.35, -0.3, 1.0)), [0, 0, s * 0.4]), hd.color ?? coat);
  }
  head.add(segMesh(hSeg, material, 'head'));
  head.add(buildEyes({ eyes: { x: 0.55, y: 0.35, z: 0.72, size: hd.h * 0.2, ...L.eyes } }, hd, hc, material));
  const eyes = head.children.find((c) => c.name === 'eyes');

  // Flippers: front ones under the chest, rear ones at the tail end.
  const fl = L.flippers;
  const flippers = [];
  for (const side of [1, -1]) {
    const p = [side * b.w * 0.75, -b.h * 0.15 + Math.sin(lift) * b.l * 0.25, b.l * 0.35];
    const g = pivot(`flipperF${side > 0 ? 'L' : 'R'}`, body, p);
    const fs = new Segment(add3([0, bodyY, 0], p));
    // Tilted down onto the ground: the flipper's lowest point sits at ground level.
    const down = bodyY + p[1];
    const rx = L.upright ? -1.05 : -0.2;
    const cy = -down + fl.front * (Math.abs(Math.sin(rx)) * 0.92 + 0.12 * Math.cos(rx));
    fs.add(place(ellipsoid(fl.front * 0.3, fl.front * 0.12, fl.front), [side * fl.front * 0.45, cy, fl.front * 0.35], [rx, side * 0.3, side * 0.2]), fl.color ?? coat);
    g.add(segMesh(fs, material, 'flipper'));
    flippers.push({ g, side, front: true });
  }
  const rearPos = [0, -b.h * 0.55, -b.l * 1.15];
  const rear = pivot('flipperB', body, rearPos);
  const rs = new Segment(add3([0, bodyY, 0], rearPos));
  for (const side of [1, -1]) rs.add(place(ellipsoid(fl.rear * 0.4, fl.rear * 0.1, fl.rear), [side * fl.rear * 0.35, -b.h * 0.25, -fl.rear * 0.75], [0.1, side * 0.35, 0]), fl.color ?? coat);
  rear.add(segMesh(rs, material, 'flipper'));
  flippers.push({ g: rear, side: 0, front: false });

  const rig = { kind: 'pinniped', upright: !!L.upright, root, body, neck, head, eyes, flippers, size: { bodyH: b.h, bodyL: b.l } };
  rig.rest = captureRest([body, neck, head, eyes, ...flippers.map((f) => f.g)]);
  return { group: root, rig };
}

/** Slightly lighter whisker pads. */
function mix2(hex) {
  const r = Math.min(255, ((hex >> 16) & 255) + 28);
  const g = Math.min(255, ((hex >> 8) & 255) + 28);
  const b = Math.min(255, (hex & 255) + 28);
  return (r << 16) | (g << 8) | b;
}
