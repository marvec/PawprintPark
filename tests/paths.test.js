import { describe, expect, test } from 'bun:test';
import { generateMap } from '../src/core/map.js';
import { buildPathNetwork, canPlace, doorTile, eachTile, footprintRect } from '../src/core/paths.js';
import { buyablePlots, isTileUnlocked, plotOfTile, plotStarCost, startingPlots, unlockPlot } from '../src/core/plots.js';
import { createWorld } from '../src/core/state.js';
import { MAP_SIZE, PLOT_SIZE, PLOTS_ACROSS } from '../src/data/world.js';

const world = createWorld({ seed: 42 });
const map = generateMap(world.seed);

/** Every path tile reaches the gate's door through path tiles. */
function connected(map, network, gate) {
  const size = map.size;
  const root = doorTile(gate);
  const seen = new Uint8Array(size * size);
  const queue = [root.z * size + root.x];
  seen[queue[0]] = 1;
  while (queue.length) {
    const t = queue.pop();
    const x = t % size;
    const z = (t - x) / size;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = (z + dz) * size + x + dx;
      if (network.path[n] && !seen[n]) {
        seen[n] = 1;
        queue.push(n);
      }
    }
  }
  return network.path.every((v, i) => !v || seen[i]);
}

describe('plots', () => {
  test('a new zoo owns the 2×2 start plots; their neighbours can be bought', () => {
    expect(startingPlots().length).toBe(4);
    const next = buyablePlots(startingPlots());
    // Two plots touch the start area on the west, two on the east and two on the north (it sits on the south edge).
    expect(next.length).toBe(6);
    expect(isTileUnlocked(startingPlots(), map.start.x0, map.start.z0)).toBe(true);
    expect(isTileUnlocked(startingPlots(), 0, 0)).toBe(false);
    expect(isTileUnlocked(startingPlots(), -1, 5)).toBe(false);
    expect(plotOfTile(MAP_SIZE - 1, MAP_SIZE - 1)).toBe(PLOTS_ACROSS * PLOTS_ACROSS - 1);
  });

  test('plots unlock next to owned land only, and each costs more stars', () => {
    const plots = startingPlots();
    expect(plotStarCost(plots)).toBe(15);
    expect(unlockPlot(plots, 0)).toBeNull();
    const more = unlockPlot(plots, buyablePlots(plots)[0]);
    expect(more.length).toBe(5);
    expect(plotStarCost(more)).toBe(19);
  });
});

describe('starting layout', () => {
  test('gate, storehouse and two Farmyard enclosures sit in the start area without overlapping', () => {
    const kinds = world.placements.map((p) => p.kind);
    expect(kinds).toEqual(['entrance-gate', 'storehouse', 'enclosure', 'enclosure']);
    expect(world.placements.filter((p) => p.kind === 'enclosure').every((p) => p.biome === 'farmyard')).toBe(true);
    const used = new Set();
    for (const p of world.placements) {
      eachTile(p, (x, z) => {
        expect(isTileUnlocked(world.plots, x, z)).toBe(true);
        expect(used.has(`${x},${z}`)).toBe(false);
        used.add(`${x},${z}`);
      });
    }
  });

  test('the gate faces the road on the south edge', () => {
    const gate = world.placements[0];
    expect(footprintRect(gate).z1).toBe(MAP_SIZE);
  });

  test('every starting placement connects to the gate on the same paths for every seed', () => {
    for (const seed of [1, 2, 3, 42, 777]) {
      const w = createWorld({ seed });
      const m = generateMap(seed);
      const net = buildPathNetwork(m, w.plots, w.placements);
      expect(net.failed).toEqual([]);
      expect(connected(m, net, w.placements[0])).toBe(true);
      for (const p of w.placements) expect(net.path[doorTile(p).z * m.size + doorTile(p).x]).toBe(1);
      // The start area is flat, so the layout's paths don't depend on the seed.
      expect(net.path).toEqual(buildPathNetwork(map, world.plots, world.placements).path);
    }
  });
});

describe('automatic paths', () => {
  const base = buildPathNetwork(map, world.plots, world.placements);
  const add = (p) => canPlace(map, world.plots, world.placements, { id: 100, kind: 'enclosure', size: 'M', rot: 0, ...p }, base);

  test('a new enclosure gets a route from its viewing side to the network', () => {
    const r = add({ x: 98, z: 196 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const cand = { id: 100, kind: 'enclosure', size: 'M', rot: 0, x: 98, z: 196 };
    const net = buildPathNetwork(map, world.plots, [...world.placements, cand]);
    expect(net.failed).toEqual([]);
    expect(net.routes.get(100)).toEqual(r.route);
    expect(connected(map, net, world.placements[0])).toBe(true);
    // The route starts at the door, in front of the viewing side.
    const door = doorTile(cand);
    expect(r.route[0]).toBe(door.z * map.size + door.x);
    expect(door.z).toBe(196 + 10);
  });

  test('invalid spots say why', () => {
    expect(add({ x: 0, z: 0 })).toEqual({ ok: false, reason: 'locked' });
    expect(add({ x: 98, z: MAP_SIZE - 4 })).toEqual({ ok: false, reason: 'off-map' });
    // On top of the sheep's enclosure.
    expect(add({ x: 106, z: 220 })).toEqual({ ok: false, reason: 'overlap' });
    // Across the entrance avenue.
    expect(add({ x: 116, z: 226 })).toEqual({ ok: false, reason: 'path' });
    // Facing straight into the sheep's enclosure: the door tile is taken.
    const walled = canPlace(map, world.plots, world.placements, { id: 100, kind: 'enclosure', size: 'S', rot: 2, x: 108, z: 228 }, base);
    expect(walled).toEqual({ ok: false, reason: 'no-path' });
  });

  test('locked land, water and steep slopes are refused', () => {
    // Unlock every plot so only the land matters.
    const all = Array.from({ length: PLOTS_ACROSS * PLOTS_ACROSS }, (_, i) => i);
    let water = null;
    let steep = null;
    for (let z = 0; z < map.size && !(water && steep); z++) {
      for (let x = 0; x < map.size; x++) {
        if (!water && map.water[z * map.size + x]) water = { x, z };
      }
    }
    for (let z = 0; z < map.size - PLOT_SIZE && !steep; z++) {
      for (let x = 0; x < map.size; x++) {
        const h = map.heights;
        const s = map.size + 1;
        if (Math.abs(h[z * s + x] - h[z * s + x + 1]) > 0.8 && !map.water[z * map.size + x]) {
          steep = { x, z };
          break;
        }
      }
    }
    const try1 = (pos) => canPlace(map, all, world.placements, { id: 100, kind: 'enclosure', size: 'S', rot: 0, x: pos.x, z: pos.z }, buildPathNetwork(map, all, world.placements));
    expect(try1(water)).toMatchObject({ ok: false });
    expect(['water', 'steep']).toContain(try1(water).reason);
    expect(try1(steep)).toMatchObject({ ok: false, reason: 'steep' });
  });

  test('removing a placement keeps every other one connected', () => {
    let placements = [...world.placements];
    let id = 200;
    for (const [x, z, rot] of [[98, 196, 0], [130, 196, 0], [98, 210, 1], [133, 210, 3]]) {
      const p = { id: id++, kind: 'enclosure', size: 'M', rot, x, z };
      const r = canPlace(map, world.plots, placements, p);
      expect(r.ok).toBe(true);
      placements.push(p);
    }
    placements = placements.filter((p) => p.id !== 200);
    const net = buildPathNetwork(map, world.plots, placements);
    expect(net.failed).toEqual([]);
    expect(connected(map, net, placements[0])).toBe(true);
    // Paths never run under a footprint.
    for (const p of placements) eachTile(p, (x, z) => expect(net.path[z * map.size + x]).toBe(0));
  });
});
