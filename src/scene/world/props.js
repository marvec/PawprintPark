// Faceted low-poly props (PRD §17): enclosure equipment, plants and rocks for the habitats, poop, the entrance gate,
// the storehouse and path lamps. Each `addX(kits, ...)` adds parts at the origin, facing +z, in metres; callers place
// them with `kit.within(...)`. `kits` holds the kits a scene part merges: `solid` (faceted), `smooth` (rounded),
// `water` and `glass`.

import * as THREE from 'three';
import { mixHex, shadeHex } from './kit.js';

/** @typedef {{ solid: ReturnType<typeof import('./kit.js').createKit>, smooth: ReturnType<typeof import('./kit.js').createKit>,
 *   water: ReturnType<typeof import('./kit.js').createKit>, glass: ReturnType<typeof import('./kit.js').createKit> }} Kits */

/** Prop colours. */
export const PROP_COLORS = {
  wood: 0xb58a5c,
  woodDark: 0x8a6446,
  woodLight: 0xd8b07a,
  hay: 0xe8c86a,
  feed: 0xc89a52,
  stone: 0xc9bfae,
  stoneDark: 0xa39a8a,
  metal: 0x9aa4a8,
  water: 0x7cc7d4,
  murky: 0x8a9a5a,
  poop: 0x6b4a2c,
  heater: 0xe0663a,
  heaterGlow: 0xffb050,
  cooler: 0x5aa6d6,
  roofRed: 0xc8644a,
  roofGreen: 0x6f9a5a,
  cream: 0xf4e8cf,
  white: 0xf7f3ea,
  ball: [0xe0503c, 0xf2c23c, 0x4a90d0],
  flowers: [0xf08aa0, 0xf6d04a, 0xffffff, 0xb08ae0, 0xf49a4a],
  rope: 0xd8c08a,
  tyre: 0x3d3a38,
};

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, seg = 7) => new THREE.CylinderGeometry(rt, rb, h, seg);

/** A food trough on legs, full of hay (or empty). */
export function addFeeder(kits, { full = true } = {}) {
  const k = kits.solid;
  for (const x of [-0.75, 0.75]) for (const z of [-0.3, 0.3]) k.add(box(0.12, 0.5, 0.12), PROP_COLORS.woodDark, { x, y: 0.25, z });
  k.add(box(1.8, 0.1, 0.8), PROP_COLORS.wood, { y: 0.5 });
  k.add(box(1.8, 0.4, 0.08), PROP_COLORS.wood, { y: 0.7, z: 0.38, rx: -0.15 });
  k.add(box(1.8, 0.4, 0.08), PROP_COLORS.wood, { y: 0.7, z: -0.38, rx: 0.15 });
  k.add(box(0.08, 0.4, 0.8), PROP_COLORS.woodDark, { x: -0.88, y: 0.7 });
  k.add(box(0.08, 0.4, 0.8), PROP_COLORS.woodDark, { x: 0.88, y: 0.7 });
  if (full) {
    k.add(new THREE.DodecahedronGeometry(0.45, 0), PROP_COLORS.hay, { x: -0.4, y: 0.78, sx: 1.2, sy: 0.55, sz: 0.8 });
    k.add(new THREE.DodecahedronGeometry(0.45, 0), shadeHex(PROP_COLORS.hay, 0.92), { x: 0.4, y: 0.8, sx: 1.2, sy: 0.6, sz: 0.8, ry: 0.7 });
  }
}

/** A stone water trough. `level` 0–1 fills it; low `quality` (0–1) turns the water murky. */
export function addWaterTrough(kits, { level = 1, quality = 1 } = {}) {
  const k = kits.solid;
  k.add(box(1.6, 0.12, 0.9), PROP_COLORS.stoneDark, { y: 0.06 });
  k.add(box(1.6, 0.55, 0.12), PROP_COLORS.stone, { y: 0.33, z: 0.4 });
  k.add(box(1.6, 0.55, 0.12), PROP_COLORS.stone, { y: 0.33, z: -0.4 });
  k.add(box(0.12, 0.55, 0.9), PROP_COLORS.stone, { x: -0.74, y: 0.33 });
  k.add(box(0.12, 0.55, 0.9), PROP_COLORS.stone, { x: 0.74, y: 0.33 });
  // A tap on a post at one end.
  k.add(cyl(0.05, 0.05, 0.9, 6), PROP_COLORS.metal, { x: 0.95, y: 0.45 });
  k.add(cyl(0.04, 0.04, 0.3, 6), PROP_COLORS.metal, { x: 0.82, y: 0.85, rz: Math.PI / 2 });
  if (level > 0.02) {
    kits.water.add(box(1.38, 0.04, 0.68), mixHex(PROP_COLORS.murky, PROP_COLORS.water, quality), { y: 0.14 + 0.36 * level });
  }
}

/** A wooden shelter: an open-fronted hut with a sloping roof. */
export function addShelter(kits, { w = 3, d = 2.4, h = 2.2, roof = PROP_COLORS.roofGreen } = {}) {
  const k = kits.solid;
  k.add(box(w, h, 0.14), PROP_COLORS.wood, { y: h / 2, z: -d / 2 });
  k.add(box(0.14, h * 0.9, d), PROP_COLORS.wood, { x: -w / 2, y: (h * 0.9) / 2 });
  k.add(box(0.14, h * 0.9, d), PROP_COLORS.wood, { x: w / 2, y: (h * 0.9) / 2 });
  for (const x of [-w / 2, w / 2]) k.add(box(0.18, h * 0.85, 0.18), PROP_COLORS.woodDark, { x, y: (h * 0.85) / 2, z: d / 2 });
  k.add(box(w + 0.5, 0.14, d + 0.6), roof, { y: h + 0.02, rx: -0.14 });
  k.add(box(w - 0.3, 0.1, d - 0.2), PROP_COLORS.hay, { y: 0.05 });
}

/** A heat lamp on a post over a warm stone slab. */
export function addHeater(kits) {
  const k = kits.solid;
  k.add(box(1.6, 0.18, 1.2), PROP_COLORS.stoneDark, { y: 0.09 });
  k.add(cyl(0.07, 0.09, 2.4, 6), PROP_COLORS.metal, { x: -0.9, y: 1.2 });
  k.add(box(1.0, 0.08, 0.08), PROP_COLORS.metal, { x: -0.45, y: 2.35 });
  k.add(new THREE.ConeGeometry(0.32, 0.36, 8, 1, true), PROP_COLORS.heater, { y: 2.15, rx: Math.PI });
  k.add(new THREE.SphereGeometry(0.16, 8, 6), PROP_COLORS.heaterGlow, { y: 2.06 });
  k.add(box(0.5, 0.5, 0.35), PROP_COLORS.heater, { x: -0.9, y: 0.4, z: 0.3 });
  for (let i = 0; i < 3; i++) k.add(box(0.36, 0.04, 0.02), PROP_COLORS.heaterGlow, { x: -0.9, y: 0.3 + i * 0.1, z: 0.48 });
}

/** A cooler: a blue box with a fan grille and a misting pole. */
export function addCooler(kits) {
  const k = kits.solid;
  k.add(box(1.0, 1.0, 0.8), PROP_COLORS.cooler, { y: 0.5 });
  k.add(cyl(0.36, 0.36, 0.06, 12), shadeHex(PROP_COLORS.cooler, 0.7), { y: 0.55, z: 0.42, rx: Math.PI / 2 });
  for (let i = 0; i < 4; i++) k.add(box(0.6, 0.06, 0.02), PROP_COLORS.white, { y: 0.55, z: 0.46, rz: (i * Math.PI) / 4 });
  k.add(cyl(0.05, 0.05, 2.6, 6), PROP_COLORS.metal, { x: 0.9, y: 1.3 });
  k.add(box(1.4, 0.06, 0.06), PROP_COLORS.metal, { x: 0.3, y: 2.6 });
  for (const x of [-0.2, 0.3, 0.8]) k.add(new THREE.ConeGeometry(0.06, 0.12, 5), PROP_COLORS.white, { x, y: 2.52, rx: Math.PI });
}

/** A round pool with a stone rim, `r` metres across the water. */
export function addPool(kits, { r = 1.4, seg = 12 } = {}) {
  const k = kits.solid;
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const s = 0.32 + ((i * 37) % 7) / 40;
    k.add(new THREE.DodecahedronGeometry(s, 0), i % 2 ? PROP_COLORS.stone : PROP_COLORS.stoneDark, { x: Math.cos(a) * (r + 0.2), y: 0.12, z: Math.sin(a) * (r + 0.2), sy: 0.6, ry: a });
  }
  k.add(cyl(r + 0.1, r + 0.1, 0.06, 16), shadeHex(PROP_COLORS.stoneDark, 0.8), { y: 0.03 });
  kits.water.add(cyl(r, r, 0.04, 16), PROP_COLORS.water, { y: 0.16 });
}

/** A climbing frame: log posts, two platforms and a ramp. */
export function addClimbingFrame(kits) {
  const k = kits.solid;
  for (const [x, z, h] of [[-0.9, -0.9, 2.8], [0.9, -0.9, 2.8], [-0.9, 0.9, 2.8], [0.9, 0.9, 2.8], [2.2, -0.6, 1.5], [2.2, 0.6, 1.5]]) {
    k.add(cyl(0.12, 0.15, h, 6), PROP_COLORS.woodDark, { x, y: h / 2, z });
  }
  k.add(box(2.1, 0.12, 2.1), PROP_COLORS.wood, { y: 2.4 });
  k.add(box(1.4, 0.12, 1.4), PROP_COLORS.wood, { x: 1.8, y: 1.4 });
  k.add(box(0.8, 0.1, 2.6), PROP_COLORS.woodLight, { x: -0.2, y: 1.2, z: 2.0, rx: 0.95 });
  // Ropes hanging from the top platform.
  for (const x of [-0.5, 0.5]) k.add(cyl(0.03, 0.03, 1.4, 4), PROP_COLORS.rope, { x, y: 1.7, z: -1.0 });
  k.add(cyl(0.05, 0.05, 2.0, 5), PROP_COLORS.woodLight, { x: 0, y: 2.8, z: 0, rz: Math.PI / 2 });
}

/** Enrichment toys: a big ball and a tyre swing. */
export function addToy(kits) {
  kits.smooth.add(new THREE.SphereGeometry(0.55, 16, 12), PROP_COLORS.ball[0], { x: -0.6, y: 0.55 }, { smooth: true });
  kits.smooth.add(new THREE.SphereGeometry(0.2, 10, 8), PROP_COLORS.ball[1], { x: -0.6, y: 1.05, s: 0.6 }, { smooth: true });
  const k = kits.solid;
  k.add(cyl(0.1, 0.12, 2.6, 6), PROP_COLORS.woodDark, { x: 0.6, y: 1.3 });
  k.add(box(1.2, 0.12, 0.12), PROP_COLORS.woodDark, { x: 1.1, y: 2.55 });
  k.add(cyl(0.02, 0.02, 1.2, 4), PROP_COLORS.rope, { x: 1.5, y: 1.95 });
  k.add(new THREE.TorusGeometry(0.38, 0.13, 6, 10), PROP_COLORS.tyre, { x: 1.5, y: 1.2 });
  k.add(box(0.5, 0.5, 0.5), PROP_COLORS.ball[2], { x: 0.2, y: 0.25, z: 0.8, ry: 0.5 });
}

/**
 * A keeper feeding chute through the fence: a hopper outside on a stand, a tube sloping down into the enclosure.
 * Built facing +z: the hopper sits at z = -1 (outside, behind the fence line at z = 0), the tube ends inside.
 */
export function addChute(kits) {
  const k = kits.solid;
  k.add(cyl(0.45, 0.2, 0.6, 8), PROP_COLORS.metal, { y: 1.9, z: -1.0 });
  for (const x of [-0.3, 0.3]) k.add(cyl(0.05, 0.05, 1.6, 5), PROP_COLORS.metal, { x, y: 0.8, z: -1.0 });
  k.add(cyl(0.14, 0.14, 2.1, 8), PROP_COLORS.cooler, { y: 1.15, z: -0.05, rx: 0.95 });
  k.add(box(0.7, 0.08, 0.5), PROP_COLORS.metal, { y: 0.32, z: 0.85 });
}

/** A poop pile: two or three small brown blobs. */
export function addPoop(kits, rng) {
  const n = rng.int(2, 3);
  for (let i = 0; i < n; i++) {
    const s = rng.range(0.1, 0.16) * (1 - i * 0.18);
    kits.solid.add(new THREE.DodecahedronGeometry(s, 0), shadeHex(PROP_COLORS.poop, rng.range(0.85, 1.1)), {
      x: rng.range(-0.1, 0.1), y: s * 0.5 + i * 0.07, z: rng.range(-0.1, 0.1), sy: 0.7, ry: rng.range(0, 3),
    });
  }
}

// ---- Plants and scenery ---------------------------------------------------------------------------------------------

/** A round bush. */
export function addBush(kits, rng, color = 0x6fa04a, s = 1) {
  for (let i = 0; i < 3; i++) {
    const r = rng.range(0.45, 0.65) * s;
    kits.solid.add(new THREE.IcosahedronGeometry(r, 0), shadeHex(color, rng.range(0.9, 1.08)), {
      x: rng.range(-0.35, 0.35) * s, y: r * 0.8, z: rng.range(-0.35, 0.35) * s, ry: rng.range(0, 3),
    });
  }
}

/** A tuft of grass blades. */
export function addTuft(kits, rng, color = 0x8fbf55, s = 1) {
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    kits.solid.add(new THREE.ConeGeometry(0.07 * s, rng.range(0.45, 0.75) * s, 3), shadeHex(color, rng.range(0.9, 1.1)), {
      x: Math.cos(a) * 0.12 * s, y: 0.28 * s, z: Math.sin(a) * 0.12 * s, rx: Math.sin(a) * 0.3, rz: -Math.cos(a) * 0.3,
    });
  }
}

/** A small flower bed. */
export function addFlowers(kits, rng, w = 1.6) {
  kits.solid.add(box(w, 0.12, 0.7), 0x8a6a4a, { y: 0.06 });
  for (let i = 0; i < 7; i++) {
    const x = rng.range(-w / 2 + 0.15, w / 2 - 0.15);
    const z = rng.range(-0.25, 0.25);
    kits.solid.add(new THREE.ConeGeometry(0.05, 0.3, 3), 0x6f9e48, { x, y: 0.25, z });
    kits.solid.add(new THREE.IcosahedronGeometry(0.1, 0), rng.pick(PROP_COLORS.flowers), { x, y: 0.42, z });
  }
}

/** A boulder (or a pile of them). */
export function addBoulder(kits, rng, s = 1, color = PROP_COLORS.stone) {
  const n = rng.int(1, 3);
  for (let i = 0; i < n; i++) {
    const r = rng.range(0.5, 0.9) * s * (1 - i * 0.2);
    kits.solid.add(new THREE.DodecahedronGeometry(r, 0), shadeHex(color, rng.range(0.88, 1.06)), {
      x: i * 0.7 * s * rng.range(-1, 1), y: r * 0.45, z: i * 0.6 * s * rng.range(-1, 1), sy: 0.7, rx: rng.range(0, 1), ry: rng.range(0, 3),
    });
  }
}

/** A fallen log. */
export function addLog(kits, rng, len = 2.4) {
  kits.solid.add(cyl(0.28, 0.32, len, 7), PROP_COLORS.woodDark, { y: 0.28, rz: Math.PI / 2, ry: rng.range(0, 3) });
}

/** A hay bale. */
export function addHayBale(kits, rng) {
  kits.solid.add(cyl(0.55, 0.55, 0.9, 10), PROP_COLORS.hay, { y: 0.55, rz: Math.PI / 2, ry: rng.range(0, 3) });
}

/** A leafy tree, `h` metres to the top of the crown. */
export function addTree(kits, rng, { h = 5, color = 0x6fa04a, trunk = PROP_COLORS.woodDark } = {}) {
  const k = kits.solid;
  k.add(cyl(0.16, 0.26, h * 0.55, 6), trunk, { y: h * 0.275 });
  for (let i = 0; i < 3; i++) {
    const r = rng.range(0.22, 0.3) * h;
    k.add(new THREE.IcosahedronGeometry(r, 0), shadeHex(color, rng.range(0.9, 1.1)), {
      x: rng.range(-0.12, 0.12) * h, y: h * (0.62 + i * 0.12), z: rng.range(-0.12, 0.12) * h, ry: rng.range(0, 3),
    });
  }
}

/** An acacia: a bent trunk and a flat, wide crown. */
export function addAcacia(kits, rng, h = 5) {
  const k = kits.solid;
  k.add(cyl(0.14, 0.22, h * 0.75, 6), PROP_COLORS.woodDark, { x: 0.3, y: h * 0.37, rz: -0.12 });
  for (let i = 0; i < 3; i++) {
    k.add(new THREE.IcosahedronGeometry(1, 0), shadeHex(0x7a9a48, rng.range(0.92, 1.1)), {
      x: 0.6 + rng.range(-1.2, 1.2), y: h * 0.82 + i * 0.12, z: rng.range(-0.9, 0.9), sx: h * 0.32, sy: h * 0.09, sz: h * 0.28, ry: rng.range(0, 3),
    });
  }
}

/** A palm-like jungle plant: a stem and drooping leaves. */
export function addPalm(kits, rng, h = 3.2) {
  const k = kits.solid;
  k.add(cyl(0.1, 0.16, h, 6), 0x8a7a4a, { y: h / 2, rz: rng.range(-0.1, 0.1) });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rng.range(0, 0.5);
    k.add(box(0.5, 0.05, 1.8), shadeHex(0x4f9a46, rng.range(0.9, 1.1)), { x: Math.cos(a) * 0.8, y: h - 0.15, z: Math.sin(a) * 0.8, ry: -a + Math.PI / 2, rx: 0.4 });
  }
}

/** A clump of bamboo. */
export function addBamboo(kits, rng) {
  for (let i = 0; i < 6; i++) {
    const h = rng.range(2.5, 4.2);
    const x = rng.range(-0.5, 0.5);
    const z = rng.range(-0.5, 0.5);
    kits.solid.add(cyl(0.06, 0.07, h, 5), shadeHex(0x9ab84a, rng.range(0.9, 1.1)), { x, y: h / 2, z });
    kits.solid.add(new THREE.ConeGeometry(0.35, 0.9, 4), 0x5f9a42, { x, y: h, z, rx: rng.range(-0.4, 0.4) });
  }
}

/** A fern: low fronds. */
export function addFern(kits, rng) {
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    kits.solid.add(box(0.28, 0.04, 1.0), shadeHex(0x4a8a3e, rng.range(0.9, 1.15)), { x: Math.cos(a) * 0.35, y: 0.3, z: Math.sin(a) * 0.35, ry: -a + Math.PI / 2, rx: 0.5 });
  }
}

/** Reeds at a water edge. */
export function addReeds(kits, rng) {
  for (let i = 0; i < 8; i++) {
    const h = rng.range(0.8, 1.5);
    const x = rng.range(-0.5, 0.5);
    const z = rng.range(-0.5, 0.5);
    kits.solid.add(cyl(0.02, 0.03, h, 3), 0x7a9a48, { x, y: h / 2, z, rz: rng.range(-0.15, 0.15) });
    if (i % 3 === 0) kits.solid.add(cyl(0.05, 0.05, 0.25, 5), 0x7a5232, { x, y: h - 0.1, z });
  }
}

/** A chunk of ice. */
export function addIce(kits, rng, s = 1) {
  kits.solid.add(new THREE.OctahedronGeometry(0.7 * s, 0), mixHex(0xdff2fa, 0xb8dcef, rng.next()), { y: 0.3 * s, sy: 0.6, ry: rng.range(0, 3), rx: rng.range(-0.3, 0.3) });
}

/** A small snowy pine. */
export function addSnowPine(kits, rng, h = 3.5) {
  const k = kits.solid;
  k.add(cyl(0.1, 0.14, h * 0.3, 5), PROP_COLORS.woodDark, { y: h * 0.15 });
  for (let i = 0; i < 3; i++) {
    const r = (0.42 - i * 0.1) * h;
    k.add(new THREE.ConeGeometry(r, h * 0.42, 7), i === 2 ? 0xe8f2f6 : shadeHex(0x4a7a52, rng.range(0.9, 1.1)), { y: h * (0.35 + i * 0.22) });
  }
}

/** A termite mound. */
export function addTermiteMound(kits, rng) {
  kits.solid.add(new THREE.ConeGeometry(0.6, 2.0, 7), 0xc08a58, { y: 1.0, rz: rng.range(-0.08, 0.08) });
  kits.solid.add(new THREE.ConeGeometry(0.35, 1.2, 6), 0xb07e50, { x: 0.45, y: 0.6, z: 0.2 });
}

/** A perch for birds: a post with a cross branch. Returns the perch height. */
export function addPerch(kits, rng, h = 2.4) {
  kits.solid.add(cyl(0.1, 0.14, h, 6), PROP_COLORS.woodDark, { y: h / 2 });
  kits.solid.add(cyl(0.06, 0.06, 1.6, 5), PROP_COLORS.wood, { y: h, rz: Math.PI / 2, ry: rng.range(0, 3) });
  return h;
}

/** A visitor bench. */
export function addBench(kits) {
  const k = kits.solid;
  k.add(box(1.6, 0.08, 0.45), PROP_COLORS.wood, { y: 0.45 });
  k.add(box(1.6, 0.35, 0.06), PROP_COLORS.wood, { y: 0.72, z: -0.22, rx: -0.15 });
  for (const x of [-0.65, 0.65]) k.add(box(0.08, 0.45, 0.4), PROP_COLORS.metal, { x, y: 0.22 });
}

/** An information board on two posts. */
export function addInfoBoard(kits, color = 0x4f8a5a) {
  const k = kits.solid;
  for (const x of [-0.5, 0.5]) k.add(box(0.08, 1.3, 0.08), PROP_COLORS.woodDark, { x, y: 0.65 });
  k.add(box(1.2, 0.75, 0.06), color, { y: 1.2, rx: -0.2 });
  k.add(box(1.0, 0.55, 0.02), PROP_COLORS.cream, { y: 1.2, z: 0.04, rx: -0.2 });
}

/** A raised viewing deck with a railing, `w` metres wide; its front (+z) faces into the enclosure. */
export function addViewingDeck(kits, w = 3.6) {
  const k = kits.solid;
  for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) for (const z of [-0.8, 0.8]) k.add(box(0.16, 0.9, 0.16), PROP_COLORS.woodDark, { x, y: 0.45, z });
  k.add(box(w, 0.12, 1.9), PROP_COLORS.woodLight, { y: 0.9 });
  k.add(box(w, 0.08, 0.08), PROP_COLORS.wood, { y: 1.85, z: 0.9 });
  for (let x = -w / 2 + 0.2; x <= w / 2 - 0.1; x += 0.6) k.add(box(0.06, 0.95, 0.06), PROP_COLORS.wood, { x, y: 1.4, z: 0.9 });
  for (const x of [-w / 2, w / 2]) k.add(box(0.08, 0.08, 1.9), PROP_COLORS.wood, { x, y: 1.85 });
}

// ---- Buildings and the gate ----------------------------------------------------------------------------------------

/**
 * The storehouse: a small barn with a pitched roof, big doors on the front (+z) and crates outside. `w`, `d` in
 * metres.
 */
export function addStorehouse(kits, { w = 7, d = 7 } = {}) {
  const k = kits.solid;
  const h = 2.8;
  k.add(box(w, 0.2, d), PROP_COLORS.stoneDark, { y: 0.1 });
  k.add(box(w - 0.4, h, d - 0.4), 0xc8704a, { y: 0.2 + h / 2 });
  // Gable ends and a roof of two slopes.
  const gable = new THREE.BufferGeometry();
  gable.setAttribute('position', new THREE.Float32BufferAttribute([-(w - 0.4) / 2, 0, 0, (w - 0.4) / 2, 0, 0, 0, 1.6, 0], 3));
  k.add(gable, 0xc8704a, { y: h + 0.2, z: (d - 0.4) / 2 });
  const back = gable.clone();
  back.index = null;
  back.setAttribute('position', new THREE.Float32BufferAttribute([(w - 0.4) / 2, 0, 0, -(w - 0.4) / 2, 0, 0, 0, 1.6, 0], 3));
  k.add(back, 0xc8704a, { y: h + 0.2, z: -(d - 0.4) / 2 });
  const slope = Math.atan2(1.6, w / 2 - 0.2);
  const len = Math.hypot(1.6, w / 2) + 0.3;
  for (const s of [-1, 1]) k.add(box(len, 0.16, d + 0.3), 0x7a5a48, { x: (s * w) / 4, y: h + 0.2 + 0.85, rz: -s * slope });
  // White trim, the double door with its cross braces, and a hay window.
  k.add(box(2.4, 2.2, 0.08), PROP_COLORS.woodDark, { y: 1.3, z: d / 2 - 0.16 });
  for (const s of [-1, 1]) k.add(box(1.7, 0.1, 0.04), PROP_COLORS.white, { x: s * 0.6, y: 1.3, z: d / 2 - 0.1, rz: s * 0.9 });
  k.add(box(2.6, 0.12, 0.06), PROP_COLORS.white, { y: 2.45, z: d / 2 - 0.12 });
  k.add(box(0.9, 0.7, 0.06), PROP_COLORS.white, { y: h + 0.75, z: d / 2 - 0.12 });
  // Crates and a sack by the door.
  k.add(box(0.8, 0.8, 0.8), PROP_COLORS.woodLight, { x: w / 2 - 0.3, y: 0.4, z: d / 2 + 0.6, ry: 0.2 });
  k.add(box(0.6, 0.6, 0.6), PROP_COLORS.wood, { x: w / 2 - 0.4, y: 1.1, z: d / 2 + 0.6, ry: -0.3 });
  kits.smooth.add(new THREE.SphereGeometry(0.4, 8, 6), PROP_COLORS.cream, { x: -w / 2 + 0.6, y: 0.35, z: d / 2 + 0.6, sy: 1.2 }, { smooth: true });
}

/**
 * The entrance gate, `w` metres wide: two stone-and-wood towers, an arch with a sign board, a ticket booth and
 * turnstiles. Built facing +z (into the zoo); the sign faces both ways. Returns where the sign board sits.
 */
export function addGate(kits, { w = 12 } = {}) {
  const k = kits.solid;
  const tower = (x) => {
    k.add(box(1.6, 0.4, 1.6), PROP_COLORS.stoneDark, { x, y: 0.2 });
    k.add(box(1.3, 4.6, 1.3), PROP_COLORS.stone, { x, y: 2.5 });
    k.add(box(1.5, 0.2, 1.5), PROP_COLORS.woodDark, { x, y: 4.9 });
    k.add(new THREE.ConeGeometry(1.25, 1.4, 4), PROP_COLORS.roofGreen, { x, y: 5.7, ry: Math.PI / 4 });
    k.add(cyl(0.03, 0.03, 1.4, 4), PROP_COLORS.metal, { x, y: 7.0 });
    k.add(box(0.7, 0.4, 0.02), x < 0 ? 0xe0603c : 0xf2c23c, { x: x + 0.35, y: 7.45 });
  };
  tower(-w / 2 + 0.8);
  tower(w / 2 - 0.8);
  // The arch beam and the sign board's frame.
  k.add(box(w - 1.6, 0.4, 0.5), PROP_COLORS.woodDark, { y: 4.4 });
  k.add(box(7.4, 1.9, 0.3), PROP_COLORS.woodDark, { y: 5.4 });
  // A paw print on top of the board.
  kits.smooth.add(new THREE.SphereGeometry(0.42, 12, 8), 0xe08a3a, { y: 6.75, sz: 0.4 }, { smooth: true });
  for (const [x, y] of [[-0.5, 7.25], [-0.17, 7.45], [0.17, 7.45], [0.5, 7.25]]) {
    kits.smooth.add(new THREE.SphereGeometry(0.17, 10, 6), 0xe08a3a, { x, y, sz: 0.5 }, { smooth: true });
  }
  // Ticket booth on the outside (-z), turnstiles in the opening.
  k.add(box(1.8, 2.4, 1.6), PROP_COLORS.cream, { x: -w / 2 + 2.7, y: 1.2, z: -1.6 });
  k.add(box(2.2, 0.18, 2.0), PROP_COLORS.roofRed, { x: -w / 2 + 2.7, y: 2.5, z: -1.6 });
  k.add(box(1.0, 0.7, 0.04), 0x7fb6d0, { x: -w / 2 + 2.7, y: 1.5, z: -2.42 });
  for (const x of [-1.2, 0, 1.2]) {
    k.add(cyl(0.08, 0.08, 1.0, 6), PROP_COLORS.metal, { x, y: 0.5 });
    k.add(box(0.7, 0.05, 0.05), PROP_COLORS.metal, { x, y: 0.9, ry: 0.6 });
    k.add(box(0.7, 0.05, 0.05), PROP_COLORS.metal, { x, y: 0.9, ry: -0.6 });
  }
  // Flower boxes either side, outside.
  for (const x of [-w / 2 + 0.8, w / 2 - 0.8]) {
    k.add(box(1.6, 0.4, 0.6), PROP_COLORS.woodDark, { x, y: 0.2, z: -1.3 });
    for (let i = 0; i < 4; i++) k.add(new THREE.IcosahedronGeometry(0.2, 0), PROP_COLORS.flowers[i], { x: x - 0.55 + i * 0.37, y: 0.5, z: -1.3 });
  }
  return { sign: { y: 5.4, w: 7, h: 1.6, depth: 0.3 } };
}

/** A path lamp: a dark post and a lantern (the lantern is a separate emissive part the scene lights at night). */
export function addLampPost(kits) {
  kits.solid.add(cyl(0.06, 0.09, 3.0, 6), 0x4a4a4a, { y: 1.5 });
  kits.solid.add(new THREE.ConeGeometry(0.32, 0.26, 6), 0x4a4a4a, { y: 3.35 });
  return { lantern: { y: 3.08, r: 0.2 } };
}
