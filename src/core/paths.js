// Automatic paths (PRD §3): the player never draws paths. Each placed footprint connects to the path network from the
// tile in front of its front side (an enclosure's viewing side, a building's door) by the cheapest route over free,
// unlocked land, joining the network wherever it is nearest.
//
// Paths are derived, not stored: replaying the placements in order rebuilds the same network. Every footprint
// blocks routing from the start of the replay, so removing a placement never makes a route cross another one.

import { ENCLOSURE_SIZES, FOOTPRINTS } from '../data/world.js';
import { isLand } from './map.js';
import { plotMask, plotOfTile } from './plots.js';

/**
 * @typedef {{ id: number, kind: string, x: number, z: number, rot: 0 | 1 | 2 | 3, size?: string }} Placement
 * `x`, `z` are the footprint's lowest tile corner. At rotation 0 the front faces +z; each step turns it 90°:
 * 1 faces +x, 2 faces −z, 3 faces −x.
 */

/** Width (x) and depth (z) of a placement at rotation 0. */
function baseSize(p) {
  if (p.kind === 'enclosure') {
    const s = ENCLOSURE_SIZES[p.size];
    if (!s) throw new Error(`Unknown enclosure size ${p.size}`);
    return { w: s, d: s };
  }
  const f = FOOTPRINTS[p.kind];
  if (!f) throw new Error(`Unknown placement kind ${p.kind}`);
  return f;
}

/** The tiles a placement covers, end-exclusive. */
export function footprintRect(p) {
  const { w, d } = baseSize(p);
  const [rw, rd] = p.rot % 2 ? [d, w] : [w, d];
  return { x0: p.x, z0: p.z, x1: p.x + rw, z1: p.z + rd, w: rw, d: rd };
}

/** The tile just outside the middle of the front side, where the path connects. */
export function doorTile(p) {
  const r = footprintRect(p);
  const mx = r.x0 + Math.floor(r.w / 2);
  const mz = r.z0 + Math.floor(r.d / 2);
  switch (p.rot) {
    case 0: return { x: mx, z: r.z1 };
    case 1: return { x: r.x1, z: mz };
    case 2: return { x: mx, z: r.z0 - 1 };
    default: return { x: r.x0 - 1, z: mz };
  }
}

/** Calls fn(tx, tz) for each tile of a placement. */
export function eachTile(p, fn) {
  const r = footprintRect(p);
  for (let z = r.z0; z < r.z1; z++) for (let x = r.x0; x < r.x1; x++) fn(x, z);
}

/** A min-heap keyed on [cost, order], so ties resolve the same way every time. */
function createHeap() {
  const items = [];
  const less = (a, b) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
  return {
    get size() { return items.length; },
    push(item) {
      items.push(item);
      let i = items.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (!less(items[i], items[p])) break;
        [items[i], items[p]] = [items[p], items[i]];
        i = p;
      }
    },
    pop() {
      const top = items[0];
      const last = items.pop();
      if (items.length) {
        items[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1;
          const r = l + 1;
          let m = i;
          if (l < items.length && less(items[l], items[m])) m = l;
          if (r < items.length && less(items[r], items[m])) m = r;
          if (m === i) break;
          [items[i], items[m]] = [items[m], items[i]];
          i = m;
        }
      }
      return top;
    },
  };
}

const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];
/** A change of direction costs a little, so paths run straight where they can. */
const TURN_COST = 0.3;

/**
 * The cheapest route from `door` to any tile of `path`, as a list of tile indices from the door up to (not
 * including) the network tile it joins. Returns [] when the door is already on the network, null when there's no
 * route.
 */
function route(map, walkable, path, door) {
  const size = map.size;
  const start = door.z * size + door.x;
  if (path[start]) return [];
  if (!walkable(door.x, door.z)) return null;
  const best = new Float64Array(size * size * 4).fill(Infinity);
  const prev = new Int32Array(size * size * 4).fill(-1);
  const heap = createHeap();
  let order = 0;
  for (let d = 0; d < 4; d++) {
    best[start * 4 + d] = 0;
    heap.push([0, order++, start * 4 + d]);
  }
  while (heap.size) {
    const [cost, , state] = heap.pop();
    if (cost > best[state]) continue;
    const tile = state >> 2;
    const dir = state & 3;
    const tx = tile % size;
    const tz = (tile - tx) / size;
    for (let d = 0; d < 4; d++) {
      const nx = tx + DIRS[d][0];
      const nz = tz + DIRS[d][1];
      if (nx < 0 || nz < 0 || nx >= size || nz >= size) continue;
      const n = nz * size + nx;
      const step = cost + 1 + (d === dir || tile === start ? 0 : TURN_COST);
      if (path[n]) {
        // Reached the network: walk back to the door.
        const out = [];
        for (let s = state; s !== -1; s = prev[s]) out.push(s >> 2);
        return out.reverse();
      }
      if (!walkable(nx, nz)) continue;
      const ns = n * 4 + d;
      if (step < best[ns]) {
        best[ns] = step;
        prev[ns] = state;
        heap.push([step, order++, ns]);
      }
    }
  }
  return null;
}

/**
 * Builds the masks for routing: which tiles are blocked by footprints and which tiles are walkable land.
 * @param {import('./map.js').GameMap} map
 * @param {number[]} plots
 * @param {Placement[]} placements
 */
function routingContext(map, plots, placements) {
  const size = map.size;
  const blocked = new Uint8Array(size * size);
  for (const p of placements) eachTile(p, (x, z) => { if (x >= 0 && z >= 0 && x < size && z < size) blocked[z * size + x] = 1; });
  const mask = plotMask(plots);
  const walkable = (x, z) => isLand(map, x, z) && mask[plotOfTile(x, z)] === 1 && blocked[z * size + x] === 0;
  return { blocked, walkable };
}

/**
 * Rebuilds the path network from the placements, in order. The entrance gate's door is the root.
 * @returns {{ path: Uint8Array, routes: Map<number, number[]>, failed: number[] }}
 *   `path` marks path tiles (size² entries); `routes` maps a placement id to the tiles its route added;
 *   `failed` lists placements that couldn't connect.
 */
export function buildPathNetwork(map, plots, placements) {
  const size = map.size;
  const path = new Uint8Array(size * size);
  const routes = new Map();
  const failed = [];
  const gate = placements.find((p) => p.kind === 'entrance-gate');
  if (!gate) throw new Error('The map has no entrance gate');
  const { walkable } = routingContext(map, plots, placements);
  // The gate's avenue: straight on from its door while the land allows.
  const root = doorTile(gate);
  const [dx, dz] = DIRS[gate.rot];
  const avenue = [];
  for (let i = 0, x = root.x, z = root.z; i < (FOOTPRINTS['entrance-gate'].avenue ?? 1); i++, x += dx, z += dz) {
    if (i > 0 && !walkable(x, z)) break;
    avenue.push(z * size + x);
    path[z * size + x] = 1;
  }
  routes.set(gate.id, avenue);
  for (const p of placements) {
    if (p === gate) continue;
    const tiles = route(map, walkable, path, doorTile(p));
    if (!tiles) {
      failed.push(p.id);
      continue;
    }
    for (const t of tiles) path[t] = 1;
    routes.set(p.id, tiles);
  }
  return { path, routes, failed };
}

/**
 * Whether a new placement fits: on unlocked, dry, gentle land, clear of other footprints and of the path network,
 * and with a route to the network. Returns the route it would add.
 * @returns {{ ok: true, route: number[] } | { ok: false, reason: 'off-map' | 'locked' | 'water' | 'steep' | 'overlap' | 'path' | 'no-path' }}
 */
export function canPlace(map, plots, placements, candidate, network = buildPathNetwork(map, plots, placements)) {
  const size = map.size;
  const { blocked } = routingContext(map, plots, placements);
  const mask = plotMask(plots);
  /** @type {null | 'off-map' | 'locked' | 'water' | 'steep' | 'overlap' | 'path'} */
  let reason = null;
  eachTile(candidate, (x, z) => {
    if (reason) return;
    if (x < 0 || z < 0 || x >= size || z >= size) reason = 'off-map';
    else if (!mask[plotOfTile(x, z)]) reason = 'locked';
    else if (map.water[z * size + x]) reason = 'water';
    else if (!isLand(map, x, z)) reason = 'steep';
    else if (blocked[z * size + x]) reason = 'overlap';
    else if (network.path[z * size + x]) reason = 'path';
  });
  if (reason) return { ok: false, reason };
  const all = routingContext(map, plots, [...placements, candidate]);
  const tiles = route(map, all.walkable, network.path, doorTile(candidate));
  if (!tiles) return { ok: false, reason: 'no-path' };
  return { ok: true, route: tiles };
}
