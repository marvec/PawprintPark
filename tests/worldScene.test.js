// The world scene builders (src/scene/world/) and the world mockup's showcase zoo (src/mockups/world/layout.js).
// Everything here builds plain Object3D trees, so it runs under bun test with no WebGL and no DOM.

import { describe, expect, test } from 'bun:test';
import * as THREE from 'three';
import { doorTile, footprintRect } from '../src/core/paths.js';
import { BIOMES, ENCLOSURE_SIZES } from '../src/data/world.js';
import { EQUIPMENT, FENCE_WEAR, UPGRADE_LEVELS, showcaseWorld } from '../src/mockups/world/layout.js';
import { TIMES, WEATHERS, createAtmosphere } from '../src/scene/world/atmosphere.js';
import { BIOME_LOOKS, buildEnclosure } from '../src/scene/world/enclosures.js';
import { buildWorldScene, groundY } from '../src/scene/world/index.js';
import { TILE, WEATHER_UNIFORMS, createKit, createWorldMaterials, placementFrame, withinAll } from '../src/scene/world/kit.js';
import { KEEPER_HEIGHT, animateKeeper, buildCart, buildKeeper } from '../src/scene/world/people.js';

const zoo = showcaseWorld();
const materials = createWorldMaterials();
const V1_BIOMES = BIOMES.filter((b) => b.v1).map((b) => b.id);

/** Vertices in every mesh under an object (instanced meshes count each instance). */
function vertices(obj) {
  let n = 0;
  obj.traverse((o) => {
    if (!o.isMesh) return;
    n += o.geometry.getAttribute('position').count * (o.isInstancedMesh ? o.count : 1);
  });
  return n;
}

const ground = (x, z) => groundY(zoo.map, x, z);
const enclosure = (overrides = {}, look = {}) =>
  buildEnclosure({ id: 99, kind: 'enclosure', x: 150, z: 199, rot: 0, size: 'S', biome: 'farmyard', ...overrides }, look, { ground, materials });

describe('the showcase zoo', () => {
  test('every showcase placement passes the placement rules and connects to the paths', () => {
    expect(zoo.invalid).toEqual([]);
    expect(zoo.network.failed).toEqual([]);
  });

  test('it covers every biome, size, fence state, habitat level and piece of equipment', () => {
    const of = (section) => zoo.placements.filter((p) => p.section === section);
    expect(of('biomes').map((p) => p.biome).sort()).toEqual([...V1_BIOMES].sort());
    expect(of('sizes').map((p) => p.size)).toEqual(Object.keys(ENCLOSURE_SIZES));
    expect(of('wear').map((p) => p.wear)).toEqual([...FENCE_WEAR]);
    expect(of('upgrades').map((p) => p.upgrade)).toEqual(UPGRADE_LEVELS);
    expect(of('equipment')[0].equipment).toEqual(EQUIPMENT);
    expect(of('dirt')[0].care.poop).toBeGreaterThan(0);
  });

  test('it starts from a new zoo: the gate, the storehouse, the sheep and the empty enclosure', () => {
    const start = zoo.placements.filter((p) => p.section === 'start');
    expect(start.map((p) => p.kind).sort()).toEqual(['enclosure', 'enclosure', 'entrance-gate', 'storehouse']);
    expect(start.find((p) => p.dirty).residents[0].species).toBe('domestic-sheep');
  });

  test('is the same every time', () => {
    expect(JSON.stringify(showcaseWorld().placements)).toBe(JSON.stringify(zoo.placements));
  });
});

describe('kit and frames', () => {
  test('a kit merges coloured parts into one geometry with flat normals', () => {
    const kit = createKit();
    kit.add(new THREE.BoxGeometry(1, 1, 1), 0xff0000, { x: 2 });
    kit.add(new THREE.BoxGeometry(1, 1, 1), 0x00ff00, { x: -2 });
    const g = kit.geometry();
    expect(g.getAttribute('position').count).toBe(72);
    expect(g.getAttribute('color').getX(0)).toBeCloseTo(1);
    g.computeBoundingBox();
    expect(g.boundingBox.min.x).toBeCloseTo(-2.5);
    expect(g.boundingBox.max.x).toBeCloseTo(2.5);
  });

  test('withinAll places parts in every kit inside the same frame', () => {
    const kits = { a: createKit(), b: createKit() };
    withinAll(kits, { x: 10 }, () => {
      kits.a.add(new THREE.BoxGeometry(1, 1, 1), 0xffffff);
      kits.b.add(new THREE.BoxGeometry(1, 1, 1), 0xffffff);
    });
    for (const k of Object.values(kits)) {
      const g = k.geometry();
      g.computeBoundingBox();
      expect(g.boundingBox.min.x).toBeCloseTo(9.5);
    }
  });

  test('a placement frame turns the local front (+z) to face the placement\'s side', () => {
    const rect = { x0: 10, z0: 20, x1: 16, z1: 22 };
    const facing = (rot) => {
      const f = placementFrame(rect, rot);
      const [x, z] = f.toWorld(0, 1);
      return [Math.round(x - f.cx), Math.round(z - f.cz)];
    };
    expect(facing(0)).toEqual([0, 1]);
    expect(facing(1)).toEqual([1, 0]);
    expect(facing(2)).toEqual([0, -1]);
    expect(facing(3)).toEqual([-1, 0]);
    // A 6×2 footprint turned once is 2 wide in x but still 6 wide along its own front.
    expect(placementFrame({ x0: 0, z0: 0, x1: 2, z1: 6 }, 1).W).toBe(6 * TILE);
  });
});

describe('enclosures', () => {
  test('every v1 biome builds, with a spot for each resident', () => {
    for (const biome of V1_BIOMES) {
      const residents = [{ species: 'domestic-goat', sex: 'female', age: 'adult' }, { species: 'domestic-goat', sex: 'male', age: 'adult' }];
      const e = enclosure({ biome, size: 'L', x: 40, z: 200 }, { upgrade: 1, residents });
      expect(BIOME_LOOKS[biome]).toBeDefined();
      expect(e.group.getObjectByName('solid')).toBeDefined();
      expect(e.spots.length).toBe(2);
    }
  });

  test('the Reptile House has a roof and tanks; the Aviary has a net', () => {
    expect(enclosure({ biome: 'reptile-house', size: 'M' }).group.getObjectByName('roof')).toBeDefined();
    expect(enclosure({ biome: 'reptile-house', size: 'M' }).group.getObjectByName('glass')).toBeDefined();
    expect(enclosure({ biome: 'aviary', size: 'L' }).group.getObjectByName('net')).toBeDefined();
  });

  test('worn and broken fences look different from new ones', () => {
    const look = (wear) => vertices(enclosure({}, { wear }).group);
    const worn = enclosure({}, { wear: 'worn' }).group.getObjectByName('solid').geometry.getAttribute('color');
    const fresh = enclosure({}, { wear: 'new' }).group.getObjectByName('solid').geometry.getAttribute('color');
    expect(Array.from(worn.array)).not.toEqual(Array.from(fresh.array));
    expect(look('broken')).not.toBe(look('new'));
  });

  test('each habitat level adds to the one before', () => {
    const counts = UPGRADE_LEVELS.map((upgrade) => vertices(enclosure({ biome: 'asian-jungle', size: 'M', x: 60, z: 176 }, { upgrade }).group));
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThan(counts[i - 1]);
  });

  test('poop piles and an empty feeder show up', () => {
    const clean = { cleanliness: 100, poop: 0, feeder: 4, water: 100, waterQuality: 100 };
    const base = vertices(enclosure({}, { care: clean }).group);
    expect(vertices(enclosure({}, { care: { ...clean, poop: 6 } }).group)).toBeGreaterThan(base);
    expect(vertices(enclosure({}, { care: { ...clean, feeder: 0 } }).group)).toBeLessThan(base);
  });

  test('the equipment showcase labels every item', () => {
    const e = enclosure({ biome: 'asian-jungle', size: 'L', x: 184, z: 191 }, { equipment: EQUIPMENT });
    expect(e.labels.map((l) => l.key)).toEqual(EQUIPMENT.map((id) => `equipment.${id}`));
  });
});

describe('the world scene', () => {
  const world = buildWorldScene({ map: zoo.map, plots: zoo.world.plots, placements: zoo.placements, network: zoo.network, name: 'Test Zoo', materials, detail: 0.6 });

  test('draws the whole map in chunks, with water, paths, trees, rocks and lamps', () => {
    expect(world.terrain.group.children.filter((o) => o.name === 'terrain-chunk').length).toBe(25);
    expect(world.terrain.water).toBeDefined();
    expect(world.paths).toBeDefined();
    expect(world.lamps.count).toBeGreaterThan(10);
    expect(world.enclosures.length).toBe(zoo.placements.length);
  });

  test('building clears the trees and rocks under footprints and paths', () => {
    const { leafy, pines, rocks } = world.scatter.counts;
    expect(leafy + pines).toBeLessThan(zoo.map.trees.length);
    expect(rocks).toBeLessThanOrEqual(zoo.map.rocks.length);
    const crowns = world.group.getObjectByName('trunks');
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    for (let i = 0; i < crowns.count; i++) {
      crowns.getMatrixAt(i, m);
      p.setFromMatrixPosition(m);
      const tx = Math.floor(p.x / TILE);
      const tz = Math.floor(p.z / TILE);
      expect(zoo.network.path[tz * zoo.map.size + tx]).toBe(0);
      for (const pl of zoo.placements) {
        const r = footprintRect(pl);
        expect(tx >= r.x0 && tx < r.x1 && tz >= r.z0 && tz < r.z1).toBe(false);
      }
    }
  });

  test('no lamp stands in a gateway or against a fence or building', () => {
    const n = zoo.map.size;
    const lanterns = world.group.getObjectByName('lanterns');
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const doors = zoo.placements.map((pl) => doorTile(pl));
    for (let i = 0; i < lanterns.count; i++) {
      lanterns.getMatrixAt(i, m);
      p.setFromMatrixPosition(m);
      const tx = Math.floor(p.x / TILE);
      const tz = Math.floor(p.z / TILE);
      expect(zoo.network.path[tz * n + tx]).toBe(1);
      for (const d of doors) expect(Math.abs(d.x - tx) + Math.abs(d.z - tz)).toBeGreaterThan(1);
    }
  });

  test('roofs can be lifted to look inside the houses', () => {
    const roofs = [];
    world.group.traverse((o) => o.name === 'roof' && roofs.push(o));
    expect(roofs.length).toBe(1);
    world.setRoofs(false);
    expect(roofs[0].visible).toBe(false);
    world.setRoofs(true);
    expect(roofs[0].visible).toBe(true);
  });

  test('is the same every time', () => {
    const again = buildWorldScene({ map: zoo.map, plots: zoo.world.plots, placements: zoo.placements, network: zoo.network, name: 'Test Zoo', materials, detail: 0.6 });
    expect(vertices(again.group)).toBe(vertices(world.group));
  });
});

describe('atmosphere', () => {
  test('weather sets the shared snow, wet and dry uniforms and the falling particles', () => {
    const scene = new THREE.Scene();
    const a = createAtmosphere(scene, { shadows: false, shadowMapSize: 0, particles: 100 });
    a.set({ weather: 'snow' });
    expect(WEATHER_UNIFORMS.uSnow.value).toBe(1);
    expect(a.group.getObjectByName('snow').visible).toBe(true);
    a.set({ weather: 'rain' });
    expect(WEATHER_UNIFORMS.uSnow.value).toBe(0);
    expect(WEATHER_UNIFORMS.uWet.value).toBe(1);
    expect(a.group.getObjectByName('rain').visible).toBe(true);
    a.set({ weather: 'heat' });
    expect(WEATHER_UNIFORMS.uDry.value).toBe(1);
    a.set({ weather: 'sun' });
    expect(WEATHER_UNIFORMS.uDry.value + WEATHER_UNIFORMS.uWet.value + WEATHER_UNIFORMS.uSnow.value).toBe(0);
  });

  test('night is darker than day and lights the lamps; unknown names fall back to day and sun', () => {
    const scene = new THREE.Scene();
    const a = createAtmosphere(scene, { shadows: false, shadowMapSize: 0, particles: 100 });
    const day = { ...a.set({ time: 'day' }) };
    const dayLight = a.sun.intensity;
    const night = { ...a.set({ time: 'night' }) };
    expect(a.sun.intensity).toBeLessThan(dayLight);
    expect(night.lamps).toBeGreaterThan(day.lamps);
    expect(a.set({ time: 'teatime', weather: 'hail' })).toMatchObject({ time: 'day', weather: 'sun' });
    expect(TIMES).toContain('dusk');
    expect(WEATHERS).toEqual(['sun', 'rain', 'snow', 'heat']);
  });
});

describe('the keeper and the cart', () => {
  test('the keeper swings opposite legs when walking and bends both to sit', () => {
    const k = buildKeeper(materials);
    animateKeeper(k.rig, 'walk', 0.2);
    expect(Math.sign(k.rig.legL.rotation.x)).toBe(-Math.sign(k.rig.legR.rotation.x));
    animateKeeper(k.rig, 'sit', 0);
    expect(k.rig.legL.rotation.x).toBeLessThan(-1);
    expect(k.rig.legR.rotation.x).toBe(k.rig.legL.rotation.x);
  });

  test('the keeper is 1.8 m tall and the cart has a seat', () => {
    const k = buildKeeper(materials);
    expect(new THREE.Box3().setFromObject(k.group).max.y).toBeCloseTo(KEEPER_HEIGHT, 1);
    expect(KEEPER_HEIGHT).toBe(1.8);
    expect(buildCart(materials).seat.y).toBeGreaterThan(0);
  });
});
