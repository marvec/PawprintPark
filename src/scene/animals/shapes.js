// Geometry helpers for code-built animals. Pure: Three.js geometry only, no WebGL, no DOM.
//
// Every shape is an indexed BufferGeometry with position and normal (uv is dropped), so the parts of one rig
// segment can be merged into a single mesh with vertex colours.
//
// Paint: each vertex carries two colours and a mask field (`color`, `color2`, `mask`). The animal material picks
// color2 where the interpolated mask is above zero, per pixel, so stripe edges stay crisp however coarse the mesh
// is. Cell patterns add `cell` (kind, size, width, param) and `apos` (rest position) and run in the shader (rig.js).

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Detail multiplier for segment counts; the quality tier lowers it on phones. */
export const detail = { level: 1 };
const seg = (n) => Math.max(3, Math.round(n * detail.level));

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _c = new THREE.Color();

/** Ellipsoid centred on the origin, radii along x, y, z. */
export function ellipsoid(rx, ry, rz, s = 20) {
  const g = new THREE.SphereGeometry(1, seg(s), seg(s * 0.75));
  g.scale(rx, ry, rz);
  return g;
}

/** Welds a geometry's seams and recomputes smooth normals (after moving its vertices). */
export function smooth(g) {
  if (g.getAttribute('uv')) g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  const out = mergeVertices(g, 1e-6);
  g.dispose();
  out.computeVertexNormals();
  return out;
}

/**
 * Moves every vertex of a unit sphere through fn(x, y, z) → [x, y, z], then smooths the normals. The sphere's poles
 * point along z (front and back), so the back and belly get even triangles that patterns interpolate cleanly over.
 */
function deformSphere(s, fn) {
  const g = new THREE.SphereGeometry(1, seg(s), seg(s * 0.75));
  g.rotateX(Math.PI / 2);
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) pos.setXYZ(i, ...fn(pos.getX(i), pos.getY(i), pos.getZ(i)));
  return smooth(g);
}

/**
 * A rounded, slightly boxy torso along z: a superellipsoid (exponent `round` across, `blunt` along the length; 2 is
 * an ellipsoid, higher is squarer), a chest that is `chest` wider than the rump, a back that rises `slope` (share of
 * the height) towards the shoulders, a belly that hangs `sag`, and a belly that `tuck`s up towards the rump.
 */
export function torso(w, h, l, { round = 2.3, blunt = 2.5, chest = 0.06, slope = 0, sag = 0, tuck = 0 } = {}, s = 40) {
  return deformSphere(s, (x, y, z) => {
    const k = 1 / ((Math.abs(x) ** round + Math.abs(y) ** round) ** (blunt / round) + Math.abs(z) ** blunt) ** (1 / blunt);
    const ux = x * k;
    const uy = y * k;
    const uz = z * k;
    const wide = 1 + chest * uz;
    const hang = uy < 0 ? sag * (1 - uz * uz) * -uy : 0;
    // tuck: the belly rises towards the hind legs (cats, dogs), a waist rather than a loaf.
    const lift = uy < 0 ? tuck * Math.max(0, -uz) * -uy : 0;
    return [ux * w * wide, (uy * wide - hang + lift + slope * uz) * h, uz * l];
  });
}

/** An ellipsoid that narrows towards +z by `taper` (0 = none, 0.5 = half as wide at the front): heads, snouts. */
export function egg(w, h, l, taper = 0.2, s = 28, drop = 0) {
  return deformSphere(s, (x, y, z) => {
    const k = 1 - taper * (z + 1) * 0.5;
    return [x * w * k, (y * k - drop * Math.max(0, z)) * h, z * l];
  });
}

/** Cone along +y, centred on the origin. */
export function cone(r, h, s = 10) {
  return new THREE.ConeGeometry(r, h, seg(s), 1);
}

/**
 * A tapered limb between two points: a cylinder from r1 (at `from`) to r2 (at `to`), capped with spheres so joints
 * look rounded. Used for legs, necks, antler tines, tusks and trunk segments.
 */
export function limb(from, to, r1, r2 = r1, s = 14) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const len = a.distanceTo(b);
  // Rings along the length as close together as the vertices around it, so patterns follow the surface.
  const rings = Math.min(32, Math.max(1, Math.round(len / ((Math.PI * 2 * Math.max(r1, r2)) / seg(s)))));
  const body = new THREE.CylinderGeometry(r2, r1, len, seg(s), rings, true);
  // Hemispherical caps (the other half would be hidden inside the cylinder). Starting them at a quarter turn puts
  // their rim vertices exactly on the cylinder's, so no cracks open between them.
  const capA = new THREE.SphereGeometry(r1, seg(s), seg(s * 0.3), Math.PI / 2, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  capA.translate(0, -len / 2, 0);
  const capB = new THREE.SphereGeometry(r2, seg(s), seg(s * 0.3), Math.PI / 2, Math.PI * 2, 0, Math.PI / 2);
  capB.translate(0, len / 2, 0);
  const g = merge([body, capA, capB]);
  _q.setFromUnitVectors(_up, _v.subVectors(b, a).normalize());
  _m.compose(a.clone().add(b).multiplyScalar(0.5), _q, new THREE.Vector3(1, 1, 1));
  g.applyMatrix4(_m);
  return g;
}

/** A chain of limbs through the given points, tapering from r1 to r2. */
export function chain(points, r1, r2, s = 14) {
  const parts = [];
  for (let i = 0; i < points.length - 1; i++) {
    const t0 = i / (points.length - 1);
    const t1 = (i + 1) / (points.length - 1);
    parts.push(limb(points[i], points[i + 1], r1 + (r2 - r1) * t0, r1 + (r2 - r1) * t1, s));
  }
  return merge(parts);
}

/** Torus arc, e.g. a curly tail. */
export function torus(r, tube, arc, s = 10) {
  return new THREE.TorusGeometry(r, tube, seg(s * 0.6), seg(s * 1.2), arc);
}

/** Moves, rotates (Euler XYZ, radians) and scales a geometry in place; returns it. */
export function place(g, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  _q.setFromEuler(new THREE.Euler(...rot));
  _m.compose(new THREE.Vector3(...pos), _q, new THREE.Vector3(...scale));
  g.applyMatrix4(_m);
  return g;
}

/** Mirrors a geometry across the x = 0 plane (for left/right pairs) and fixes the winding. */
export function mirrorX(g) {
  const m = g.clone();
  m.scale(-1, 1, 1);
  const idx = m.index;
  for (let i = 0; i < idx.count; i += 3) {
    const t = idx.getX(i + 1);
    idx.setX(i + 1, idx.getX(i + 2));
    idx.setX(i + 2, t);
  }
  m.computeVertexNormals();
  return m;
}

/** The point on an ellipsoid's surface in direction (ux, uy, uz), scaled by k (1 = on the surface). */
export function onEllipsoid(rx, ry, rz, ux, uy, uz, k = 1) {
  const n = Math.hypot(ux, uy, uz) || 1;
  const dx = ux / n;
  const dy = uy / n;
  const dz = uz / n;
  const t = 1 / Math.sqrt((dx / rx) ** 2 + (dy / ry) ** 2 + (dz / rz) ** 2);
  return [dx * t * k, dy * t * k, dz * t * k];
}

function merge(list) {
  for (const g of list) g.deleteAttribute('uv');
  const out = mergeGeometries(list, false);
  for (const g of list) g.dispose();
  return out;
}

/**
 * Collects the parts of one rig segment, paints them and merges them into one geometry.
 * Paint is a hex colour or a function (local xyz, animal-space xyz) → hex | [hexA, hexB, field], so patterns run
 * continuously across segments. With [a, b, field], the surface shows b where the field is above zero and a below,
 * with the edge drawn per pixel.
 */
export class Segment {
  /** @param {[number, number, number]} origin  the segment's pivot in animal space (rest pose) */
  constructor(origin = [0, 0, 0]) {
    this.origin = origin;
    this.parts = [];
  }

  /** @param {THREE.BufferGeometry} g  @param {number | ((x:number,y:number,z:number,ax:number,ay:number,az:number)=>number|number[])} paint */
  add(g, paint) {
    this.parts.push([g, paint]);
    return this;
  }

  get empty() {
    return this.parts.length === 0;
  }

  /** Paints and merges the parts; returns a geometry with position, normal, color, color2, mask, cell and apos. */
  build() {
    const [ox, oy, oz] = this.origin;
    const geos = this.parts.map(([g, paint]) => {
      if (g.getAttribute('uv')) g.deleteAttribute('uv');
      const pos = g.getAttribute('position');
      const colors = new Float32Array(pos.count * 3);
      const colors2 = new Float32Array(pos.count * 3);
      const mask = new Float32Array(pos.count);
      const cell = new Float32Array(pos.count * 4);
      const apos = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const v = typeof paint === 'function' ? paint(x, y, z, x + ox, y + oy, z + oz) : paint;
        const [a, b, f, c] = typeof v === 'number' ? [v, v, -1] : v;
        if (c) {
          cell.set(c.slice(0, 4), i * 4);
          apos.set([x + ox + c[4] * 1.37, y + oy + c[4] * 2.11, z + oz + c[4] * 0.73], i * 3);
        }
        _c.setHex(a);
        colors[i * 3] = _c.r;
        colors[i * 3 + 1] = _c.g;
        colors[i * 3 + 2] = _c.b;
        _c.setHex(b);
        colors2[i * 3] = _c.r;
        colors2[i * 3 + 1] = _c.g;
        colors2[i * 3 + 2] = _c.b;
        mask[i] = f;
      }
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      g.setAttribute('color2', new THREE.BufferAttribute(colors2, 3));
      g.setAttribute('mask', new THREE.BufferAttribute(mask, 1));
      g.setAttribute('cell', new THREE.BufferAttribute(cell, 4));
      g.setAttribute('apos', new THREE.BufferAttribute(apos, 3));
      return g;
    });
    const out = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    return out;
  }
}
