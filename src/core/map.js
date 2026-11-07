// The seeded map (PRD §3): terrain heights, hills, a river or a lake, trees and rocks, and a flat start area.
// Pure and deterministic: the same seed always gives the same map, so saves store only the seed.
//
// Each feature draws from its own generator, seeded from a hash of the map seed and the feature's name, so adding
// a feature later never reshuffles the others (CLAUDE.md, handbook §4.3).

import { MAP_SIZE, PLOT_SIZE, START_PLOTS } from '../data/world.js';
import { createRng, hashString } from './rng.js';

/** Highest hill, in tile units. */
export const HILL_HEIGHT = 6;
/** Height of the water surface and of a river or lake bed. */
export const WATER_LEVEL = -0.35;
export const WATER_BED = -1.2;
/** Tiles around the start area where hills fade out to flat ground. */
const START_FADE = 14;
/** A tile is buildable when its corners differ by at most this much. */
export const MAX_BUILD_SLOPE = 0.6;

/**
 * @typedef {{ x: number, z: number, scale: number, seed: number }} Scatter
 * @typedef {{
 *   seed: number, size: number,
 *   heights: Float32Array, water: Uint8Array,
 *   waterBody: { kind: 'river' | 'lake', points: number[][], width: number },
 *   trees: Scatter[], rocks: Scatter[],
 *   start: { x0: number, z0: number, x1: number, z1: number },
 * }} GameMap
 * `heights` holds (size + 1)² corner heights, row by row along x. `water` holds size² tiles, 1 = water.
 * `start` is the start area in tiles, end-exclusive.
 */

const smooth = (t) => t * t * (3 - 2 * t);
const smoothstep = (a, b, x) => smooth(Math.min(1, Math.max(0, (x - a) / (b - a))));

/** A hash of an integer lattice point to [0, 1). */
function lattice(salt, ix, iz) {
  let h = Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iz, 0x165667b1) ^ salt;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise in [0, 1). */
function valueNoise(salt, x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = smooth(x - ix);
  const fz = smooth(z - iz);
  const a = lattice(salt, ix, iz);
  const b = lattice(salt, ix + 1, iz);
  const c = lattice(salt, ix, iz + 1);
  const d = lattice(salt, ix + 1, iz + 1);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

/** Fractal noise in [0, 1): four octaves of value noise. */
function fbm(salt, x, z, wavelength) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1 / wavelength;
  for (let o = 0; o < 4; o++) {
    sum += valueNoise(salt + o * 7919, x * f, z * f) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

/** Distance from a point to a polyline. */
function distToPolyline(points, x, z) {
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i];
    const [bx, bz] = points[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return best;
}

/** The start area in tiles. */
export function startArea() {
  return {
    x0: START_PLOTS.px0 * PLOT_SIZE,
    z0: START_PLOTS.pz0 * PLOT_SIZE,
    x1: (START_PLOTS.px1 + 1) * PLOT_SIZE,
    z1: (START_PLOTS.pz1 + 1) * PLOT_SIZE,
  };
}

/** How far a point lies outside a rectangle (0 inside). */
function outside(r, x, z) {
  const dx = Math.max(r.x0 - x, 0, x - r.x1);
  const dz = Math.max(r.z0 - z, 0, z - r.z1);
  return Math.hypot(dx, dz);
}

/**
 * A river from the north edge that leaves by the west or east edge, well north of the start area, or a lake.
 * @returns {{ kind: 'river' | 'lake', points: number[][], width: number, dist: (x: number, z: number) => number }}
 */
function makeWater(seed, size, start) {
  const rng = createRng(hashString(`${seed}:water`));
  if (rng.next() < 0.6) {
    const width = rng.range(3, 5);
    const exitZ = rng.range(size * 0.25, start.z0 - START_FADE - 24);
    const toEast = rng.next() < 0.5;
    // A bend from the north edge to a side edge (a quadratic curve), with a gentle sideways wander.
    const p0 = [rng.range(size * 0.25, size * 0.75), -2];
    const p2 = [toEast ? size + 2 : -2, exitZ];
    const p1 = [p0[0] + rng.range(-0.2, 0.2) * size, exitZ * rng.range(0.8, 1.1)];
    const amp = rng.range(4, 9);
    const freq = rng.range(2, 3.5) * Math.PI;
    const phase = rng.range(0, Math.PI * 2);
    const points = [];
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const u = 1 - t;
      const x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0];
      const z = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1];
      // Tangent, for the sideways wander; the wander fades out at both ends.
      const tx = 2 * u * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
      const tz = 2 * u * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
      const len = Math.hypot(tx, tz) || 1;
      const off = amp * Math.sin(freq * t + phase) * Math.sin(Math.PI * t);
      points.push([x - (tz / len) * off, Math.min(z + (tx / len) * off, exitZ + 4)]);
    }
    return { kind: 'river', points, width, dist: (x, z) => distToPolyline(points, x, z) - width / 2 };
  }
  const r = rng.range(9, 16);
  const cx = rng.range(r + 10, size - r - 10);
  const cz = rng.range(r + 10, start.z0 - START_FADE - r - 8);
  const wobble = [rng.range(0, Math.PI * 2), rng.range(0.1, 0.25), rng.range(0, Math.PI * 2), rng.range(0.05, 0.15)];
  const edge = (a) => r * (1 + wobble[1] * Math.sin(2 * a + wobble[0]) + wobble[3] * Math.sin(3 * a + wobble[2]));
  const points = [];
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    points.push([cx + Math.cos(a) * edge(a), cz + Math.sin(a) * edge(a)]);
  }
  return { kind: 'lake', points, width: 0, dist: (x, z) => Math.hypot(x - cx, z - cz) - edge(Math.atan2(z - cz, x - cx)) };
}

/**
 * Scatters `count` candidates and keeps those `keep(x, z, rng)` accepts.
 * @returns {Scatter[]}
 */
function scatter(seed, name, count, size, keep, scaleRange) {
  const rng = createRng(hashString(`${seed}:${name}`));
  const out = [];
  for (let i = 0; i < count; i++) {
    const x = rng.range(0.5, size - 0.5);
    const z = rng.range(0.5, size - 0.5);
    const scale = rng.range(scaleRange[0], scaleRange[1]);
    const itemSeed = Math.floor(rng.next() * 4294967296);
    if (keep(x, z, rng.next())) out.push({ x, z, scale, seed: itemSeed });
  }
  return out;
}

/**
 * Generates the map for a seed.
 * @param {number} seed
 * @returns {GameMap}
 */
export function generateMap(seed) {
  const size = MAP_SIZE;
  const start = startArea();
  const hillSalt = hashString(`${seed}:hills`);
  const water = makeWater(seed, size, start);

  const heights = new Float32Array((size + 1) * (size + 1));
  for (let z = 0; z <= size; z++) {
    for (let x = 0; x <= size; x++) {
      const n = fbm(hillSalt, x, z, 56);
      let h = HILL_HEIGHT * smoothstep(0.48, 0.85, n);
      h *= smoothstep(0, START_FADE, outside(start, x, z));
      const d = water.dist(x, z);
      if (d < 4) h = WATER_BED + (h - WATER_BED) * smoothstep(-0.5, 4, d);
      heights[z * (size + 1) + x] = h;
    }
  }

  const tiles = new Uint8Array(size * size);
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) if (water.dist(x + 0.5, z + 0.5) < 0) tiles[z * size + x] = 1;
  }

  const forestSalt = hashString(`${seed}:forest`);
  const clearOf = (x, z, margin) =>
    outside(start, x, z) > margin && water.dist(x, z) > 1.2 && tiles[Math.floor(z) * size + Math.floor(x)] === 0;
  const trees = scatter(seed, 'trees', 2600, size, (x, z, r) => {
    if (!clearOf(x, z, 2)) return false;
    const forest = fbm(forestSalt, x, z, 40);
    return r < (forest > 0.55 ? 0.75 : 0.06);
  }, [0.8, 1.4]);
  const rocks = scatter(seed, 'rocks', 900, size, (x, z, r) => {
    if (!clearOf(x, z, 2)) return false;
    const hilly = fbm(hillSalt, x, z, 56) > 0.6;
    return r < (hilly ? 0.5 : 0.08);
  }, [0.4, 1.3]);

  return {
    seed,
    size,
    heights,
    water: tiles,
    waterBody: { kind: water.kind, points: water.points, width: water.width },
    trees,
    rocks,
    start,
  };
}

/** Corner height. */
export const cornerHeight = (map, x, z) => map.heights[z * (map.size + 1) + x];

/** Terrain height at any point, bilinear between corners. Clamped to the map. */
export function heightAt(map, x, z) {
  const cx = Math.min(map.size - 1e-6, Math.max(0, x));
  const cz = Math.min(map.size - 1e-6, Math.max(0, z));
  const ix = Math.floor(cx);
  const iz = Math.floor(cz);
  const fx = cx - ix;
  const fz = cz - iz;
  const a = cornerHeight(map, ix, iz);
  const b = cornerHeight(map, ix + 1, iz);
  const c = cornerHeight(map, ix, iz + 1);
  const d = cornerHeight(map, ix + 1, iz + 1);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

export const inMap = (map, tx, tz) => tx >= 0 && tz >= 0 && tx < map.size && tz < map.size;
export const isWater = (map, tx, tz) => map.water[tz * map.size + tx] === 1;

/** Height difference across a tile's corners. */
export function tileSlope(map, tx, tz) {
  const h = [cornerHeight(map, tx, tz), cornerHeight(map, tx + 1, tz), cornerHeight(map, tx, tz + 1), cornerHeight(map, tx + 1, tz + 1)];
  return Math.max(...h) - Math.min(...h);
}

/** Land that can be built on or walked over: on the map, dry and not too steep. Ignores plots and placements. */
export const isLand = (map, tx, tz) => inMap(map, tx, tz) && !isWater(map, tx, tz) && tileSlope(map, tx, tz) <= MAX_BUILD_SLOPE;
