// Enclosures (PRD §5): biome ground, fences in three states of wear, habitat dressing for upgrade levels 0–3,
// equipment, poop and dirt, and the two v1 buildings, the Reptile & Amphibian House and the Aviary. Pure scene
// building: each enclosure merges into a few meshes (solid, rounded, water, glass, plus a roof or a net).

import * as THREE from 'three';
import { createRng, hashString } from '../../core/rng.js';
import { doorTile, footprintRect } from '../../core/paths.js';
import { TILE, addBeam, createKit, mixHex, placementFrame, shadeHex, withinAll } from './kit.js';
import * as P from './props.js';

/** How each v1 biome looks: ground colours, fence style and colours, and its plants. */
export const BIOME_LOOKS = {
  farmyard: { ground: [0x9cc062, 0xb5a070], fence: 'rail', post: 0xf3ead8, rail: 0xf3ead8, pool: false },
  'african-savanna': { ground: [0xd9c47c, 0xc8a066], fence: 'log', post: 0x8a6446, rail: 0xc9b48a, pool: false },
  'asian-jungle': { ground: [0x5f9a48, 0x7a8a48], fence: 'bamboo', post: 0xb8b45a, rail: 0x8a8a3e, pool: false },
  polar: { ground: [0xeef4f6, 0xc8dce6], fence: 'wall', post: 0xa8b4bc, rail: 0xa8b4bc, pool: true, water: 0x6fb4cf },
  coast: { ground: [0xecdaa8, 0xd6bc86], fence: 'wall', post: 0xd8c4a0, rail: 0xd8c4a0, pool: true, water: 0x5fb8cc },
  wetland: { ground: [0x7f9a52, 0x8a7a58], fence: 'boardwalk', post: 0x6f5440, rail: 0x6f5440, pool: true, water: 0x7cb8b0 },
  'reptile-house': { ground: [0xd8c8a8, 0xc8b490], fence: 'none', post: 0, rail: 0, pool: false },
  aviary: { ground: [0x8fbf5a, 0x76a64a], fence: 'none', post: 0x5a5a5a, rail: 0, pool: true, water: 0x7cc0d0 },
};

const WEATHERED = 0x8c8474;
const DIRT = 0x8a6e4c;

/**
 * Enclosure options, beyond the placement itself.
 * @typedef {{ upgrade?: number, wear?: 'new' | 'worn' | 'broken', dirty?: boolean,
 *   equipment?: readonly string[], care?: import('../../core/state.js').EnclosureCare,
 *   residents?: { species: string, sex: string, age: string }[] }} EnclosureLook
 * A spot where an animal stands: world position and turn; `perch` marks a raised spot.
 * @typedef {{ x: number, y: number, z: number, yaw: number, scale?: number }} Spot
 */

/**
 * Builds one enclosure.
 * @param {import('../../core/paths.js').Placement & { biome: string }} p
 * @param {EnclosureLook} look
 * @param {{ ground: (x: number, z: number) => number, materials: ReturnType<typeof import('./kit.js').createWorldMaterials> }} ctx
 * @returns {{ group: THREE.Group, spots: Spot[], labels: { key: string, x: number, y: number, z: number }[] }}
 */
export function buildEnclosure(p, look, ctx) {
  const biome = BIOME_LOOKS[p.biome] ?? BIOME_LOOKS.farmyard;
  const rect = footprintRect(p);
  const f = placementFrame(rect, p.rot);
  const rng = createRng(hashString(`enclosure:${p.id}:${p.biome}`));
  const level = look.upgrade ?? 0;
  const wear = look.wear ?? 'new';
  const care = look.care ?? { cleanliness: 100, poop: 0, feeder: 1, water: 100, waterQuality: 100 };
  const kits = { solid: createKit(), smooth: createKit(), water: createKit(), glass: createKit() };
  const roofKit = createKit();
  /** Ground height in local coordinates. */
  const gy = (lx, lz) => {
    const [x, z] = f.toWorld(lx, lz);
    return ctx.ground(x, z);
  };
  const spots = [];
  const labels = [];
  /** Local spots already taken, so dressing doesn't land on equipment. */
  const taken = [];
  const free = (lx, lz, r) => taken.every((t) => Math.hypot(t[0] - lx, t[1] - lz) > t[2] + r);
  const take = (lx, lz, r) => taken.push([lx, lz, r]);
  const at = (lx, lz, extra = {}) => ({ x: lx, y: gy(lx, lz), z: lz, ...extra });
  const W = f.W;
  const D = f.D;
  // The keeper gate sits in line with the door tile, in local x.
  const door = doorTile(p);
  const ddx = (door.x + 0.5) * TILE - f.cx;
  const ddz = (door.z + 0.5) * TILE - f.cz;
  const doorLx = ddx * Math.cos(f.theta) - ddz * Math.sin(f.theta);

  const group = new THREE.Group();
  group.name = `enclosure:${p.biome}`;
  const house = p.biome === 'reptile-house';
  const aviary = p.biome === 'aviary';

  kits.solid.within(f.matrix, () => {
    if (!house) groundPatch(kits.solid, f, gy, biome, level, look.dirty ? care.cleanliness : 100, rng);
  });

  // Pools and ponds for water biomes come first so dressing avoids them.
  /** @type {null | { lx: number, lz: number, r: number }} */
  let pool = null;
  if (biome.pool && !house) {
    const r = aviary ? Math.min(W, D) * 0.12 : p.biome === 'wetland' ? Math.min(W, D) * 0.28 : Math.min(W, D) * 0.24;
    pool = { lx: W * 0.12, lz: -D * 0.08, r };
    take(pool.lx, pool.lz, r + 0.6);
  }

  // The roof (or the aviary's net) shares the enclosure's frame.
  withinAll({ ...kits, roof: roofKit }, f.matrix, () => {
    if (house) {
      reptileHouse(kits, roofKit, f, gy, level, rng, spots, take, look.residents ?? []);
      return;
    }
    if (pool) {
      const y = Math.min(gy(pool.lx - pool.r, pool.lz), gy(pool.lx + pool.r, pool.lz), gy(pool.lx, pool.lz - pool.r), gy(pool.lx, pool.lz + pool.r));
      withinAll(kits, { x: pool.lx, y, z: pool.lz }, () => P.addPool(kits, { r: pool.r, seg: Math.max(10, Math.round(pool.r * 5)) }));
      if (look.dirty) kits.water.add(new THREE.CylinderGeometry(pool.r, pool.r, 0.02, 16), P.PROP_COLORS.murky, { x: pool.lx, y: y + 0.19, z: pool.lz });
    }
    // Equipment.
    const equipment = look.equipment ?? ['feeder', 'water'];
    placeEquipment(kits, equipment, { W, D, gy, care, take, labels, pool });
    // Habitat dressing.
    dressHabitat(kits, p.biome, level, rng, { W, D, gy, free, take, pool });
    // Fence (or net), with viewing areas from level 2.
    if (aviary) aviaryNet(kits, roofKit, f, gy, wear, rng);
    else buildFence(kits, f, gy, biome, wear, level, rng, doorLx);
    if (level >= 2 && !aviary) {
      kits.solid.within(at(doorLx - 3.2, D / 2 - 0.15), () => P.addInfoBoard(kits));
    }
    // Poop.
    const poopRng = createRng(hashString(`poop:${p.id}`));
    for (let i = 0; i < care.poop; i++) {
      const lx = poopRng.range(-W / 2 + 1.2, W / 2 - 1.2);
      const lz = poopRng.range(-D / 2 + 1.2, D / 2 - 1.2);
      if (pool && Math.hypot(lx - pool.lx, lz - pool.lz) < pool.r + 0.5) continue;
      kits.solid.within(at(lx, lz), () => P.addPoop(kits, poopRng));
    }
    // Spots for the residents: on free ground, facing anywhere; birds in the aviary get perches.
    const residents = look.residents ?? [];
    residents.forEach((r, i) => {
      if (aviary) {
        const lx = (i - (residents.length - 1) / 2) * 3.2;
        const lz = -D * 0.15 + (i % 2) * 2.4;
        const h = 2.6 + (i % 2) * 0.6;
        kits.solid.within(at(lx, lz), () => P.addPerch(kits, rng, h));
        take(lx, lz, 1);
        spots.push(local(f, gy, lx, lz, rng.range(-0.6, 0.6), h + 0.06));
        return;
      }
      const wet = r.species === 'chilean-flamingo' && pool;
      for (let tries = 0; tries < 30; tries++) {
        let lx;
        let lz;
        if (wet) {
          const a = rng.range(0, Math.PI * 2);
          const d = rng.range(0, pool.r * 0.6);
          lx = pool.lx + Math.cos(a) * d;
          lz = pool.lz + Math.sin(a) * d;
        } else {
          lx = rng.range(-W / 2 + 1.8, W / 2 - 1.8);
          lz = rng.range(-D / 2 + 1.8, D / 2 - 1.8);
          if (!free(lx, lz, 0.9)) continue;
        }
        take(lx, lz, 0.9);
        // Face the viewing side, more or less.
        spots.push(local(f, gy, lx, lz, rng.range(-1.1, 1.1), wet ? 0.05 : 0));
        break;
      }
    });
  });

  const m = ctx.materials;
  for (const [kit, mat, name, shadows] of [
    [kits.solid, house ? m.indoor : m.flat, 'solid', true],
    [kits.smooth, m.smooth, 'smooth', true],
    [kits.water, m.water, 'water', false],
    [kits.glass, m.glass, 'glass', false],
  ]) {
    const mesh = kit.mesh(mat, { name, shadows });
    if (mesh) group.add(mesh);
  }
  const roof = roofKit.mesh(house ? m.flat : m.net, { name: house ? 'roof' : 'net', shadows: house });
  if (roof) group.add(roof);
  // Label anchors are local; turn them into world positions.
  for (const l of labels) {
    const [x, z] = f.toWorld(l.x, l.z);
    l.x = x;
    l.z = z;
  }
  return { group, spots, labels };
}

/** A spot in world space from a local point; `yaw` is relative to the enclosure's front. */
function local(f, gy, lx, lz, yaw, lift = 0) {
  const [x, z] = f.toWorld(lx, lz);
  return { x, y: gy(lx, lz) + lift, z, yaw: f.theta + yaw };
}

/** The ground inside the footprint: biome colours, richer with each level, blotched with dirt when dirty. */
function groundPatch(kit, f, gy, biome, level, cleanliness, rng) {
  const step = TILE / 2;
  const nx = Math.round(f.W / step);
  const nz = Math.round(f.D / step);
  const seedX = rng.range(0, 100);
  const seedZ = rng.range(0, 100);
  const noise = (x, z) => (Math.sin((x + seedX) * 0.9) * Math.cos((z + seedZ) * 0.7) + Math.sin((x - z) * 0.37 + seedX)) / 4 + 0.5;
  const pos = [];
  const lift = 0.04;
  const v = (i, j) => {
    const lx = -f.W / 2 + i * step;
    const lz = -f.D / 2 + j * step;
    return [lx, gy(lx, lz) + lift, lz];
  };
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = v(i, j);
      const b = v(i + 1, j);
      const c = v(i, j + 1);
      const d = v(i + 1, j + 1);
      pos.push(...a, ...c, ...b, ...b, ...c, ...d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const contrast = [0.25, 0.55, 0.7, 0.85][level];
  const dirty = 1 - cleanliness / 100;
  const inv = new THREE.Matrix4().copy(f.matrix).invert();
  const p = new THREE.Vector3();
  kit.add(g, (x, y, z) => {
    p.set(x, y, z).applyMatrix4(inv);
    const n = noise(p.x, p.z);
    let c = mixHex(biome.ground[0], biome.ground[1], Math.max(0, n - 0.5) * 2 * contrast + (level === 0 ? 0.35 : 0));
    // Level 0 is bare: dull, trampled ground, worn to dirt along the fence.
    if (level === 0) {
      c = mixHex(c, mixHex(DIRT, 0xb8a888, 0.5), 0.35 + 0.2 * n);
      const edge = Math.min(f.W / 2 - Math.abs(p.x), f.D / 2 - Math.abs(p.z));
      if (edge < 2) c = mixHex(c, DIRT, 0.45 * (1 - edge / 2));
    }
    if (dirty > 0) {
      const blot = noise(p.x * 1.7 + 3, p.z * 1.7 - 2);
      c = mixHex(c, DIRT, Math.min(0.85, Math.max(0, (blot - (1 - dirty) * 0.75) * 2.2)));
    }
    return c;
  });
}

/** Where equipment goes in local coordinates, by item, for a W×D enclosure. */
function equipmentSpots(equipment, W, D) {
  if (equipment.length > 2) {
    // The equipment showcase: a 3×3 grid, the chute on the back fence.
    const cols = [-W * 0.3, 0, W * 0.3];
    const rows = [-D * 0.28, D * 0.02, D * 0.3];
    const out = {};
    let i = 0;
    for (const e of equipment) {
      if (e === 'chute') {
        out[e] = [W * 0.32, -D / 2 + 0.15, 0];
        continue;
      }
      const c = cols[i % 3];
      const r = rows[Math.floor(i / 3)];
      out[e] = [c, r, 0];
      i++;
    }
    return out;
  }
  return { feeder: [-W / 2 + 2.0, -D / 2 + 1.5, 0], water: [W / 2 - 2.0, -D / 2 + 1.5, 0] };
}

/** Puts the equipment in place, with label anchors (equipment.<id>). */
function placeEquipment(kits, equipment, { W, D, gy, care, take, labels, pool }) {
  const where = equipmentSpots(equipment, W, D);
  for (const e of equipment) {
    let [lx, lz, yaw] = where[e] ?? [0, 0, 0];
    if (e === 'pool' && pool) continue;
    const y = gy(lx, lz);
    withinAll(kits, { x: lx, y, z: lz, ry: yaw }, () => {
      if (e === 'feeder') P.addFeeder(kits, { full: care.feeder > 0 });
      else if (e === 'water') P.addWaterTrough(kits, { level: care.water / 100, quality: care.waterQuality / 100 });
      else if (e === 'shelter') P.addShelter(kits);
      else if (e === 'heater') P.addHeater(kits);
      else if (e === 'cooler') P.addCooler(kits);
      else if (e === 'pool') P.addPool(kits, { r: 1.6 });
      else if (e === 'climbing-frame') P.addClimbingFrame(kits);
      else if (e === 'toy') P.addToy(kits);
      else if (e === 'chute') P.addChute(kits);
    });
    take(lx, lz, e === 'chute' ? 1 : 2);
    labels.push({ key: `equipment.${e}`, x: lx, y: y + (e === 'feeder' || e === 'water' ? 1.6 : 3.4), z: lz });
  }
}

/** Habitat dressing per biome; more and richer with each upgrade level. */
function dressHabitat(kits, biome, level, rng, { W, D, gy, free, take, pool }) {
  const area = (W * D) / 400;
  const count = Math.round([0, 4, 9, 16][level] * Math.max(0.6, area));
  const place = (r, fn) => {
    for (let tries = 0; tries < 25; tries++) {
      const lx = rng.range(-W / 2 + 1.4, W / 2 - 1.4);
      const lz = rng.range(-D / 2 + 1.4, D / 2 - 2.2);
      if (!free(lx, lz, r)) continue;
      take(lx, lz, r);
      kits.solid.within({ x: lx, y: gy(lx, lz), z: lz }, fn);
      return true;
    }
    return false;
  };
  const edgeOfPool = (fn, n) => {
    if (!pool) return;
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, Math.PI * 2);
      const lx = pool.lx + Math.cos(a) * (pool.r + 0.5);
      const lz = pool.lz + Math.sin(a) * (pool.r + 0.5);
      kits.solid.within({ x: lx, y: gy(lx, lz), z: lz }, fn);
    }
  };
  const items = {
    farmyard: [() => P.addHayBale(kits, rng), () => P.addBush(kits, rng, 0x6fa04a), () => P.addTuft(kits, rng)],
    'african-savanna': [() => P.addTuft(kits, rng, 0xc8b45a, 1.3), () => P.addBoulder(kits, rng, 1.2, 0xc8a87a), () => P.addTermiteMound(kits, rng)],
    'asian-jungle': [() => P.addFern(kits, rng), () => P.addBamboo(kits, rng), () => P.addBush(kits, rng, 0x4f8a3e)],
    polar: [() => P.addIce(kits, rng, rng.range(0.8, 1.4)), () => P.addBoulder(kits, rng, 1, 0xb8c4cc)],
    coast: [() => P.addBoulder(kits, rng, 1.3, 0xb8a890), () => P.addTuft(kits, rng, 0xa8b45a)],
    wetland: [() => P.addReeds(kits, rng), () => P.addTuft(kits, rng, 0x7aa04a), () => P.addLog(kits, rng)],
    aviary: [() => P.addBush(kits, rng, 0x6fa04a, 1.2), () => P.addTuft(kits, rng), () => P.addFlowers(kits, rng)],
  }[biome] ?? [];
  if (!items.length) return;
  for (let i = 0; i < count; i++) place(0.9, items[i % items.length]);
  // Feature pieces from level 1 up.
  const big = {
    farmyard: [() => P.addTree(kits, rng, { h: 4.5 }), () => P.addTree(kits, rng, { h: 5.5, color: 0x7fb052 })],
    'african-savanna': [() => P.addAcacia(kits, rng, 5.5), () => P.addAcacia(kits, rng, 6.5)],
    'asian-jungle': [() => P.addPalm(kits, rng, 3.4), () => P.addTree(kits, rng, { h: 7, color: 0x4f8a3e })],
    polar: [() => P.addSnowPine(kits, rng, 3.8), () => P.addSnowPine(kits, rng, 4.6)],
    coast: [() => P.addBoulder(kits, rng, 2.2, 0xb0a088), () => P.addBoulder(kits, rng, 1.8, 0xa89880)],
    wetland: [() => P.addTree(kits, rng, { h: 5, color: 0x8ab05a }), () => P.addReeds(kits, rng)],
    aviary: [() => P.addTree(kits, rng, { h: 7.5, color: 0x5e9142 }), () => P.addTree(kits, rng, { h: 6.5, color: 0x7fb052 })],
  }[biome];
  const nBig = [0, 1, 2, 4][level] * (area > 1.5 ? 2 : 1);
  for (let i = 0; i < nBig; i++) place(2, big[i % big.length]);
  if (pool) edgeOfPool(() => (biome === 'polar' ? P.addIce(kits, rng, 0.8) : biome === 'coast' ? P.addBoulder(kits, rng, 0.8, 0xb8a890) : P.addReeds(kits, rng)), 1 + level * 2);
  if (level >= 3 && !pool && biome !== 'aviary') {
    // A small pond, as the richest habitats have water.
    for (let tries = 0; tries < 20; tries++) {
      const lx = rng.range(-W / 2 + 3, W / 2 - 3);
      const lz = rng.range(-D / 2 + 3, D / 2 - 4);
      if (!free(lx, lz, 2.2)) continue;
      take(lx, lz, 2.2);
      withinAll(kits, { x: lx, y: gy(lx, lz), z: lz }, () => P.addPool(kits, { r: 1.5 }));
      break;
    }
  }
  if (level >= 3) {
    // Flower beds along the front, inside the fence.
    for (const lx of [-W / 2 + 2, W / 2 - 5.5]) kits.solid.within({ x: lx, y: gy(lx, D / 2 - 0.8), z: D / 2 - 0.8 }, () => P.addFlowers(kits, rng, 1.8));
    if (biome === 'wetland' && pool) {
      for (let i = 0; i < 5; i++) {
        const a = rng.range(0, Math.PI * 2);
        const d = rng.range(0.3, pool.r * 0.8);
        kits.solid.add(new THREE.CylinderGeometry(0.35, 0.35, 0.03, 7), 0x5f9a48, { x: pool.lx + Math.cos(a) * d, y: gy(pool.lx, pool.lz) + 0.2, z: pool.lz + Math.sin(a) * d });
      }
    }
  }
}

/**
 * The fence around the footprint, with a keeper gate on the front. Wear: new is clean; worn is weathered with
 * leaning posts and a sagging rail; broken also loses a section, which lies on the ground. From upgrade level 2
 * the front gets glass viewing panes; at level 3 a viewing deck.
 */
function buildFence(kits, f, gy, biome, wear, level, rng, doorLx) {
  if (biome.fence === 'none') return;
  const inset = 0.2;
  const hw = f.W / 2 - inset;
  const hd = f.D / 2 - inset;
  const weathered = wear !== 'new';
  const post = weathered ? mixHex(biome.post, WEATHERED, 0.5) : biome.post;
  const rail = weathered ? mixHex(biome.rail, WEATHERED, 0.5) : biome.rail;
  const k = kits.solid;
  const wrng = createRng(hashString(`wear:${f.cx}:${f.cz}`));
  // Corners, walking around: front (+z) left to right, right side, back, left side.
  const corners = [[-hw, hd], [hw, hd], [hw, -hd], [-hw, -hd]];
  const deckSpan = level >= 3 ? [hw - 4.4, hw] : null;
  let segIndex = 0;
  // The broken section: the second segment of the front side, away from the gate.
  for (let side = 0; side < 4; side++) {
    const [ax, az] = corners[side];
    const [bx, bz] = corners[(side + 1) % 4];
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(len / TILE));
    for (let i = 0; i < n; i++, segIndex++) {
      const t0 = i / n;
      const t1 = (i + 1) / n;
      const x0 = ax + (bx - ax) * t0;
      const z0 = az + (bz - az) * t0;
      const x1 = ax + (bx - ax) * t1;
      const z1 = az + (bz - az) * t1;
      const mx = (x0 + x1) / 2;
      const front = side === 0;
      const gate = front && Math.abs(mx - doorLx) < TILE / 2;
      const broken = wear === 'broken' && front && i === 1;
      const deck = front && deckSpan && mx > deckSpan[0] && mx < deckSpan[1];
      const glass = front && level >= 2 && !gate && !deck && Math.abs(mx - doorLx) < TILE * 2.6 && i % 2 === 0;
      const lean = weathered ? wrng.range(-0.16, 0.16) : 0;
      if (!deck) fencePost(k, biome, post, x0, gy(x0, z0), z0, broken ? 0.75 : lean, side);
      if (deck) continue;
      if (gate) {
        keeperGate(k, biome, post, rail, x0, z0, x1, z1, gy);
        continue;
      }
      if (broken) {
        // The fallen section lies on the ground inside.
        const y = gy(mx, z0 - 0.9) + 0.08;
        addBeam(k, [x0 + 0.2, y, z0 - 0.7], [x1 - 0.1, y, z0 - 1.3], 0.12, rail);
        addBeam(k, [x0 + 0.4, y + 0.1, z0 - 0.4], [x1 - 0.3, y + 0.05, z0 - 0.9], 0.12, rail);
        continue;
      }
      const sag = weathered && wrng.next() < 0.3 ? wrng.range(0.1, 0.3) : 0;
      if (glass) glassPane(kits, biome, x0, z0, x1, z1, gy);
      else fenceSection(kits, biome, post, rail, x0, z0, x1, z1, gy, sag, wrng);
    }
  }
  // Close the last corner.
  fencePost(k, biome, post, corners[0][0], gy(corners[0][0], corners[0][1]), corners[0][1], 0, 0);
  if (deckSpan) {
    const lx = (deckSpan[0] + deckSpan[1]) / 2;
    const lz = hd - 0.8;
    kits.solid.within({ x: lx, y: gy(lx, lz), z: lz, ry: Math.PI }, () => P.addViewingDeck(kits, deckSpan[1] - deckSpan[0]));
  }
}

/** One fence post in the biome's style. */
function fencePost(k, biome, color, x, y, z, lean, side) {
  const rz = side % 2 === 0 ? lean : 0;
  const rx = side % 2 === 1 ? lean : 0;
  if (biome.fence === 'rail') k.add(new THREE.BoxGeometry(0.16, 1.3, 0.16), color, { x, y: y + 0.6, z, rx, rz });
  else if (biome.fence === 'log') k.add(new THREE.CylinderGeometry(0.12, 0.14, 1.7, 6), color, { x, y: y + 0.8, z, rx, rz });
  else if (biome.fence === 'bamboo') k.add(new THREE.CylinderGeometry(0.09, 0.09, 2.1, 6), color, { x, y: y + 1.0, z, rx, rz });
  else if (biome.fence === 'wall') k.add(new THREE.BoxGeometry(0.3, 1.9, 0.3), shadeHex(color, 0.92), { x, y: y + 0.9, z, rx, rz });
  else if (biome.fence === 'boardwalk') k.add(new THREE.BoxGeometry(0.18, 1.4, 0.18), color, { x, y: y + 0.65, z, rx, rz });
}

/** The fence between two posts. */
function fenceSection(kits, biome, post, rail, x0, z0, x1, z1, gy, sag, rng) {
  const k = kits.solid;
  const y0 = gy(x0, z0);
  const y1 = gy(x1, z1);
  const beam = (h, t, color, drop = 0) => addBeam(k, [x0, y0 + h, z0], [x1, y1 + h - drop, z1], t, color);
  if (biome.fence === 'rail') {
    // A worn fence has lost some top rails.
    if (!(sag > 0.25)) beam(1.05, 0.1, rail, sag);
    beam(0.55, 0.1, rail);
  } else if (biome.fence === 'log') {
    beam(1.45, 0.1, shadeHex(post, 1.05), sag * 0.5);
    for (const h of [0.45, 0.8, 1.15]) beam(h, 0.035, rail, sag * (h / 1.15));
  } else if (biome.fence === 'bamboo') {
    beam(1.85, 0.08, rail, sag * 0.5);
    beam(0.6, 0.08, rail);
    const n = 6;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const x = x0 + (x1 - x0) * t;
      const z = z0 + (z1 - z0) * t;
      const h = rng.range(1.65, 1.95);
      k.add(new THREE.CylinderGeometry(0.055, 0.06, h, 5), shadeHex(post, rng.range(0.92, 1.06)), { x, y: gy(x, z) + h / 2, z });
    }
  } else if (biome.fence === 'wall') {
    beam(0.35, 0.3, shadeHex(post, 0.95), 0);
    addBeam(k, [x0, y0 + 0.35, z0], [x1, y1 + 0.35, z1], 0.3, shadeHex(post, 0.95), 0.7);
    addBeam(k, [x0, y0 + 1.8, z0], [x1, y1 + 1.8, z1], 0.08, 0x8a949a);
    addBeam(kits.glass, [x0, y0 + 1.25, z0], [x1, y1 + 1.25, z1], 0.05, 0xffffff, 1.05);
  } else if (biome.fence === 'boardwalk') {
    beam(1.25, 0.12, rail, sag);
    beam(0.75, 0.08, rail);
    beam(0.3, 0.08, rail);
  }
}

/** A glass viewing pane on a low base (upgrade level 2+). */
function glassPane(kits, biome, x0, z0, x1, z1, gy) {
  const y0 = gy(x0, z0);
  const y1 = gy(x1, z1);
  addBeam(kits.solid, [x0, y0 + 0.2, z0], [x1, y1 + 0.2, z1], 0.3, shadeHex(P.PROP_COLORS.stone, 0.95), 0.4);
  addBeam(kits.solid, [x0, y0 + 1.9, z0], [x1, y1 + 1.9, z1], 0.1, 0x6f7a80);
  addBeam(kits.glass, [x0, y0 + 1.15, z0], [x1, y1 + 1.15, z1], 0.06, 0xffffff, 1.5);
}

/** The keeper's gate: a framed panel in the fence's colours, slightly ajar. */
function keeperGate(k, biome, post, rail, x0, z0, x1, z1, gy) {
  const y0 = gy(x0, z0);
  const y1 = gy(x1, z1);
  const h = biome.fence === 'wall' ? 1.9 : biome.fence === 'bamboo' ? 1.9 : 1.3;
  const color = biome.fence === 'wall' ? 0x8a949a : rail;
  for (const hh of [0.25, h - 0.15]) addBeam(k, [x0 + 0.1, y0 + hh, z0], [x1 - 0.1, y1 + hh, z1], 0.08, color);
  for (const t of [0.05, 0.5, 0.95]) {
    const x = x0 + (x1 - x0) * t;
    const z = z0 + (z1 - z0) * t;
    k.add(new THREE.BoxGeometry(0.07, h - 0.2, 0.07), color, { x, y: gy(x, z) + h / 2 + 0.05, z });
  }
  addBeam(k, [x0 + 0.1, y0 + 0.25, z0], [x1 - 0.1, y1 + h - 0.15, z1], 0.06, color);
}

/**
 * The Aviary: tall posts around the footprint and a peaked net over it (the net is its own transparent mesh).
 * Worn nets sag darker; a broken one has a torn flap.
 */
function aviaryNet(kits, netKit, f, gy, wear, rng) {
  const k = kits.solid;
  const hw = f.W / 2 - 0.2;
  const hd = f.D / 2 - 0.2;
  const wallH = 6;
  const peak = 9.5;
  const postColor = wear === 'new' ? 0x5a6a5a : 0x6f6a5f;
  // Posts every 4 m around the edge and a mast in the middle.
  const corners = [[-hw, hd], [hw, hd], [hw, -hd], [-hw, -hd]];
  for (let side = 0; side < 4; side++) {
    const [ax, az] = corners[side];
    const [bx, bz] = corners[(side + 1) % 4];
    const n = Math.round(Math.hypot(bx - ax, bz - az) / 4);
    for (let i = 0; i < n; i++) {
      const x = ax + ((bx - ax) * i) / n;
      const z = az + ((bz - az) * i) / n;
      k.add(new THREE.CylinderGeometry(0.1, 0.13, wallH, 6), postColor, { x, y: gy(x, z) + wallH / 2, z });
    }
  }
  k.add(new THREE.CylinderGeometry(0.14, 0.2, peak, 6), postColor, { y: gy(0, 0) + peak / 2 });
  // The net: four walls and a pyramid roof, on the walls' base height.
  const base = gy(0, 0);
  const walls = [];
  for (let side = 0; side < 4; side++) {
    const [ax, az] = corners[side];
    const [bx, bz] = corners[(side + 1) % 4];
    const ya = gy(ax, az);
    const yb = gy(bx, bz);
    walls.push(ax, ya, az, bx, yb, bz, ax, ya + wallH, az, bx, yb, bz, bx, yb + wallH, bz, ax, ya + wallH, az);
    walls.push(ax, ya + wallH, az, bx, yb + wallH, bz, 0, base + peak, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(walls, 3));
  netKit.add(g, wear === 'new' ? 0x3a4a3a : 0x5a5248);
  // Net cords: verticals every 2 m and rings every 1.5 m, so the net reads as a mesh up close.
  const cord = wear === 'new' ? 0x4a5a4a : 0x6a6258;
  for (let side = 0; side < 4; side++) {
    const [ax, az] = corners[side];
    const [bx, bz] = corners[(side + 1) % 4];
    const n = Math.round(Math.hypot(bx - ax, bz - az) / 2);
    for (let i = 1; i < n; i++) {
      const x = ax + ((bx - ax) * i) / n;
      const z = az + ((bz - az) * i) / n;
      addBeam(k, [x, gy(x, z), z], [x, gy(x, z) + wallH, z], 0.03, cord);
      if (i % 2 === 0) addBeam(k, [x, gy(x, z) + wallH, z], [0, base + peak, 0], 0.03, cord);
    }
    for (let h = 1.5; h < wallH; h += 1.5) addBeam(k, [ax, gy(ax, az) + h, az], [bx, gy(bx, bz) + h, bz], 0.03, cord);
    addBeam(k, [ax, gy(ax, az) + wallH, az], [bx, gy(bx, bz) + wallH, bz], 0.08, postColor);
  }
  // A doorway vestibule at the front.
  k.add(new THREE.BoxGeometry(3, 2.8, 2), 0x6f8a6a, { y: gy(0, hd + 0.2) + 1.4, z: hd - 1.2 });
  k.add(new THREE.BoxGeometry(1.4, 2.2, 0.1), 0x4a5a4a, { y: gy(0, hd) + 1.1, z: hd - 0.15 });
  if (wear === 'broken') {
    // A torn flap hanging out of the front wall.
    addBeam(k, [hw * 0.4, gy(hw * 0.4, hd) + 4.8, hd], [hw * 0.5, gy(hw * 0.5, hd) + 1.2, hd + 0.8], 0.02, 0x3a4a3a, 1.8);
    rng.next();
  }
}

/**
 * The Reptile & Amphibian House: a building on the footprint with glass-fronted tanks along its walls and a walkway
 * down the middle. The roof is its own mesh, so the scene can lift it to look inside.
 */
function reptileHouse(kits, roofKit, f, gy, level, rng, spots, take, residents) {
  const k = kits.solid;
  const hw = f.W / 2 - 0.2;
  const hd = f.D / 2 - 0.2;
  const y = Math.max(gy(-hw, -hd), gy(hw, -hd), gy(-hw, hd), gy(hw, hd), gy(0, 0)) + 0.05;
  const wallH = 4;
  const wall = 0xe9dcc0;
  const trim = 0x4f8a6a;
  // Plinth and floor.
  k.add(new THREE.BoxGeometry(f.W - 0.2, 0.5, f.D - 0.2), P.PROP_COLORS.stoneDark, { y: y - 0.2 });
  k.add(new THREE.BoxGeometry(f.W - 0.8, 0.06, f.D - 0.8), 0xd8cbb0, { y: y + 0.08 });
  k.add(new THREE.BoxGeometry(3, 0.07, f.D - 1), 0xc8a87a, { y: y + 0.1 });
  // Walls, with a door gap in the front.
  const t = 0.35;
  k.add(new THREE.BoxGeometry(f.W - 0.4, wallH, t), wall, { y: y + wallH / 2, z: -hd });
  k.add(new THREE.BoxGeometry(t, wallH, f.D - 0.4), wall, { x: -hw, y: y + wallH / 2 });
  k.add(new THREE.BoxGeometry(t, wallH, f.D - 0.4), wall, { x: hw, y: y + wallH / 2 });
  const side = (f.W - 0.4 - 3.4) / 2;
  for (const s of [-1, 1]) k.add(new THREE.BoxGeometry(side, wallH, t), wall, { x: s * (1.7 + side / 2), y: y + wallH / 2, z: hd });
  k.add(new THREE.BoxGeometry(3.4, wallH - 2.8, t), wall, { y: y + 2.8 + (wallH - 2.8) / 2, z: hd });
  kits.glass.add(new THREE.BoxGeometry(3.2, 2.7, 0.08), 0xffffff, { y: y + 1.4, z: hd });
  // Green trim along the top of the walls and an entrance canopy.
  k.add(new THREE.BoxGeometry(f.W - 0.1, 0.25, 0.5), trim, { y: y + wallH, z: hd });
  k.add(new THREE.BoxGeometry(4.6, 0.18, 1.8), trim, { y: y + 3, z: hd + 0.8, rx: -0.1 });
  // Windows on the sides.
  for (const s of [-1, 1]) for (let zz = -hd + 3; zz < hd - 2; zz += 4) kits.glass.add(new THREE.BoxGeometry(0.08, 1.2, 2.2), 0xffffff, { x: s * hw, y: y + 2.8, z: zz });

  // Tanks: along the back and both sides, each a cabinet, glass box and a little habitat inside.
  const tanks = [];
  const backN = Math.max(1, Math.floor((f.W - 2) / 7));
  const backW = (f.W - 2) / backN;
  for (let i = 0; i < backN; i++) tanks.push({ x: -f.W / 2 + 1 + backW * (i + 0.5), z: -hd + 2.4, w: backW - 0.5, d: 3.8, ry: 0 });
  const sideN = Math.max(1, Math.floor((f.D - 8) / 6));
  const sideD = (f.D - 8) / sideN;
  for (const s of [-1, 1]) for (let i = 0; i < sideN; i++) tanks.push({ x: s * (hw - 2.2), z: -hd + 5.4 + sideD * (i + 0.5), w: sideD - 0.5, d: 3.6, ry: s * -Math.PI / 2 });
  const substrates = [0xd8b07a, 0x7a6a4a, 0xc8a066, 0x6f7a4a];
  tanks.forEach((tank, i) => {
    withinAll(kits, { x: tank.x, y, z: tank.z, ry: tank.ry }, () => {
      k.add(new THREE.BoxGeometry(tank.w, 0.7, tank.d), 0x8a6446, { y: 0.35 });
      k.add(new THREE.BoxGeometry(tank.w - 0.2, 0.18, tank.d - 0.2), substrates[i % substrates.length], { y: 0.79 });
      kits.glass.add(new THREE.BoxGeometry(tank.w, 2.4, tank.d), 0xffffff, { y: 1.9 });
      // The tank's top frame (open, so the camera sees in).
      for (const sz of [-1, 1]) k.add(new THREE.BoxGeometry(tank.w + 0.06, 0.07, 0.07), 0x4f5a54, { y: 3.12, z: (sz * tank.d) / 2 });
      for (const sx of [-1, 1]) k.add(new THREE.BoxGeometry(0.07, 0.07, tank.d), 0x4f5a54, { x: (sx * tank.w) / 2, y: 3.12 });
      // A heat lamp, rocks, plants, more with each level.
      k.add(new THREE.ConeGeometry(0.25, 0.3, 6, 1, true), P.PROP_COLORS.heater, { x: tank.w * 0.3, y: 2.9, rx: Math.PI });
      const lr = createRng(hashString(`tank:${i}`));
      for (let j = 0; j < 1 + level; j++) {
        kits.solid.within({ x: lr.range(-tank.w / 2 + 0.6, tank.w / 2 - 0.6), y: 0.86, z: lr.range(-tank.d / 2 + 0.6, -0.2) }, () =>
          j % 2 ? P.addFern(kits, lr) : P.addBoulder(kits, lr, 0.5, 0xb8a890),
        );
      }
      if (i % 3 === 1) kits.water.add(new THREE.BoxGeometry(tank.w * 0.35, 0.05, 1.2), 0x6fb4bf, { x: -tank.w * 0.25, y: 0.9, z: tank.d * 0.15 });
      if (i % 3 === 2) addBeam(k, [-tank.w * 0.4, 0.9, -0.6], [tank.w * 0.2, 2.2, -1], 0.12, P.PROP_COLORS.woodDark);
    });
    take(tank.x, tank.z, 2);
  });
  // Benches down the walkway, and a few plants from level 2.
  for (const zz of [-1, 3]) k.add(new THREE.BoxGeometry(0.5, 0.45, 1.6), P.PROP_COLORS.wood, { y: y + 0.3, z: zz, x: 2.6 });
  if (level >= 2) for (const zz of [-hd + 6, hd - 3]) kits.solid.within({ x: -2.4, y: y + 0.1, z: zz }, () => P.addPalm(kits, rng, 2.4));
  // Residents go into the tanks, one each, a little inside the glass.
  residents.forEach((_, i) => {
    const tank = tanks[i % tanks.length];
    const c = Math.cos(tank.ry);
    const s = Math.sin(tank.ry);
    const lx = tank.x + 0 * c + 0.2 * s;
    const lz = tank.z - 0 * s + 0.2 * c;
    const [wx, wz] = f.toWorld(lx, lz);
    spots.push({ x: wx, y: y + 0.9, z: wz, yaw: f.theta + tank.ry + 0.4 });
  });

  // The roof: a flat roof with a glass lantern down the middle and a parapet.
  roofKit.add(new THREE.BoxGeometry(f.W + 0.3, 0.3, f.D + 0.3), 0x6f8f7a, { y: y + wallH + 0.15 });
  roofKit.add(new THREE.BoxGeometry(4.2, 1.2, f.D - 4), 0xbfe2ea, { y: y + wallH + 0.9 });
  roofKit.add(new THREE.BoxGeometry(4.6, 0.14, f.D - 3.6), trim, { y: y + wallH + 1.55 });
  // A sign over the door: a lizard silhouette in green.
  roofKit.add(new THREE.BoxGeometry(5, 1.2, 0.2), trim, { y: y + wallH + 0.7, z: hd + 0.1 });
  roofKit.add(new THREE.SphereGeometry(0.3, 6, 4), 0xf2e6c8, { x: -1.2, y: y + wallH + 0.7, z: hd + 0.25, sx: 2.6, sz: 0.3 });
}
