// The world scene: terrain, water, paths, trees and rocks, the entrance gate, the storehouse, every enclosure and
// the path lamps, built from the map, the placements and the path network. Pure (CLAUDE.md: the scene builder is
// separate from the renderer): plain Object3D trees, tested under bun test without WebGL.

import * as THREE from 'three';
import { doorTile, footprintRect, eachTile } from '../../core/paths.js';
import { buildEnclosure } from './enclosures.js';
import { TILE, createKit, placementFrame, withinAll } from './kit.js';
import { addGate, addLampPost, addStorehouse } from './props.js';
import { buildPaths, buildScatter, buildTerrain, groundY } from './terrain.js';

export { TILE } from './kit.js';
export { groundY } from './terrain.js';

/**
 * @typedef {import('../../core/paths.js').Placement & import('./enclosures.js').EnclosureLook & { biome?: string }} WorldThing
 */

/**
 * Builds the world.
 * @param {{
 *   map: import('../../core/map.js').GameMap, plots: number[], placements: WorldThing[],
 *   network: { path: Uint8Array }, name: string,
 *   materials: ReturnType<typeof import('./kit.js').createWorldMaterials>, detail?: number,
 *   sign?: (name: string) => THREE.Texture | null,
 * }} opts
 */
export function buildWorldScene({ map, plots, placements, network, name, materials, detail = 1, sign }) {
  const group = new THREE.Group();
  group.name = 'world';
  const ground = (x, z) => groundY(map, x, z);

  const terrain = buildTerrain(map, { plots });
  group.add(terrain.group);

  const n = map.size;
  const occupied = new Uint8Array(n * n);
  for (const p of placements) eachTile(p, (x, z) => x >= 0 && z >= 0 && x < n && z < n && (occupied[z * n + x] = 1));
  const blocked = (x, z) => x >= 0 && z >= 0 && x < n && z < n && (occupied[z * n + x] === 1 || network.path[z * n + x] === 1);
  const scatter = buildScatter(map, { material: materials.flat, blocked, detail });
  group.add(scatter.group);

  const paths = buildPaths(map, network.path, materials.path);
  if (paths) group.add(paths);

  const things = new THREE.Group();
  things.name = 'placements';
  group.add(things);
  /** @type {{ placement: WorldThing, group: THREE.Group, spots: import('./enclosures.js').Spot[], labels: object[], centre: THREE.Vector3 }[]} */
  const enclosures = [];
  let gateSign = null;
  for (const p of placements) {
    const rect = footprintRect(p);
    const f = placementFrame(rect, p.rot);
    const centre = new THREE.Vector3(f.cx, ground(f.cx, f.cz), f.cz);
    if (p.kind === 'enclosure') {
      const e = buildEnclosure(/** @type {any} */ (p), p, { ground, materials });
      things.add(e.group);
      enclosures.push({ placement: p, group: e.group, spots: e.spots, labels: e.labels, centre });
      continue;
    }
    const kits = { solid: createKit(), smooth: createKit(), water: createKit(), glass: createKit() };
    const y = Math.max(ground(...f.toWorld(-f.W / 2, -f.D / 2)), ground(...f.toWorld(f.W / 2, f.D / 2)), ground(f.cx, f.cz));
    const g = new THREE.Group();
    g.name = p.kind;
    let signInfo = null;
    withinAll(kits, f.matrix, () => withinAll(kits, { y }, () => {
      if (p.kind === 'entrance-gate') {
        signInfo = addGate(kits, { w: f.W }).sign;
        addRoad(kits.solid, f.D / 2);
      } else if (p.kind === 'storehouse') addStorehouse(kits, { w: f.W - 0.6, d: f.D - 0.6 });
    }));
    for (const [kit, mat, nm] of [[kits.solid, materials.flat, 'solid'], [kits.smooth, materials.smooth, 'smooth']]) {
      const mesh = kit.mesh(mat, { name: nm });
      if (mesh) g.add(mesh);
    }
    if (signInfo) {
      // The zoo's name on both faces of the board.
      const tex = sign?.(name) ?? null;
      const mat = new THREE.MeshStandardMaterial({ color: tex ? 0xffffff : 0x7a5a3a, map: tex, roughness: 0.7 });
      for (const side of [1, -1]) {
        const board = new THREE.Mesh(new THREE.PlaneGeometry(signInfo.w, signInfo.h), mat);
        board.name = 'sign';
        board.position.set(0, y + signInfo.y, side * (signInfo.depth / 2 + 0.01));
        if (side < 0) board.rotation.y = Math.PI;
        board.position.applyMatrix4(new THREE.Matrix4().makeRotationY(f.theta));
        board.position.x += f.cx;
        board.position.z += f.cz;
        board.rotation.y += f.theta;
        g.add(board);
      }
      gateSign = { name, material: mat };
    }
    things.add(g);
    enclosures.push({ placement: p, group: g, spots: [], labels: [], centre });
  }

  // Lamps keep clear of footprints and of the path tiles at each door, so none stands in a gateway.
  const doors = new Set();
  for (const p of placements) {
    const d = doorTile(p);
    for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) doors.add((d.z + dz) * n + d.x + dx);
  }
  const lampFree = (x, z) => !doors.has(z * n + x);
  const lamps = buildLamps(map, network.path, materials, { free: lampFree, occupied: (x, z) => x >= 0 && z >= 0 && x < n && z < n && occupied[z * n + x] === 1 });
  group.add(lamps.group);

  return {
    group,
    terrain,
    scatter,
    paths,
    lamps,
    enclosures,
    gateSign,
    /** Shows or hides the roofs of buildings (to look inside the Reptile House). */
    setRoofs(visible) {
      group.traverse((o) => o.name === 'roof' && (o.visible = visible));
    },
    dispose() {
      terrain.dispose();
      scatter.dispose();
      group.traverse((o) => {
        // Terrain and scatter free their own; animal geometry is cached and shared, so it stays.
        if (!o.isMesh || o.isSkinnedMesh || o.parent?.name === 'terrain' || o.parent?.name === 'scatter') return;
        o.geometry.dispose();
      });
      if (gateSign) {
        gateSign.material.map?.dispose();
        gateSign.material.dispose();
      }
      lamps.dispose();
    },
  };
}

/**
 * The road in: a warm grey road with a dashed centre line from the gate's outer side out past the map's edge, and
 * a plaza of path stones in front of the gate. Local to the gate (its outside is -z).
 */
function addRoad(kit, back) {
  const len = 160;
  // Layers stay several centimetres apart (plaza and road above the land, markings above the road), or they
  // flicker against each other from far away.
  kit.add(new THREE.BoxGeometry(14, 0.1, 6), 0xe6d3a8, { y: 0.03, z: -back - 3 });
  kit.add(new THREE.BoxGeometry(8, 0.1, len), 0x8f897c, { y: 0.02, z: -back - 6 - len / 2 });
  for (const x of [-4.1, 4.1]) kit.add(new THREE.BoxGeometry(0.25, 0.16, len), 0xc9b48a, { x, y: 0.05, z: -back - 6 - len / 2 });
  for (let z = 4; z < len; z += 6) kit.add(new THREE.BoxGeometry(0.22, 0.04, 2.6), 0xf2ead2, { y: 0.09, z: -back - 6 - z });
}

/**
 * Path lamps every few tiles where a path has a free edge: instanced posts and lanterns, plus glow sprites the
 * scene fades in at dusk and night.
 */
function buildLamps(map, path, materials, { free = () => true, occupied = () => false } = {}) {
  const n = map.size;
  const isPath = (x, z) => x >= 0 && z >= 0 && x < n && z < n && path[z * n + x] === 1;
  const spots = [];
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      if (!isPath(x, z) || (x * 3 + z * 5) % 7 !== 0 || !free(x, z)) continue;
      // A lamp stands on a path edge that faces open land, never against a fence or a building.
      const sides = [[0, -1], [1, 0], [0, 1], [-1, 0]].filter(([dx, dz]) => !isPath(x + dx, z + dz) && !occupied(x + dx, z + dz));
      if (!sides.length) continue;
      const [dx, dz] = sides[0];
      const px = (x + 0.5 + dx * 0.42) * TILE;
      const pz = (z + 0.5 + dz * 0.42) * TILE;
      spots.push([px, groundY(map, px, pz), pz]);
    }
  }
  const kit = createKit();
  const kits = { solid: kit };
  const { lantern } = addLampPost(kits);
  const postGeo = kit.geometry();
  const group = new THREE.Group();
  group.name = 'lamps';
  const posts = new THREE.InstancedMesh(postGeo, materials.flat, Math.max(1, spots.length));
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(lantern.r, 8, 6), materials.lamp, Math.max(1, spots.length));
  const m = new THREE.Matrix4();
  const glow = new Float32Array(spots.length * 3);
  spots.forEach(([x, y, z], i) => {
    posts.setMatrixAt(i, m.makeTranslation(x, y, z));
    heads.setMatrixAt(i, m.makeTranslation(x, y + lantern.y, z));
    glow.set([x, y + lantern.y, z], i * 3);
  });
  posts.count = heads.count = spots.length;
  posts.name = 'lamp-posts';
  heads.name = 'lanterns';
  posts.castShadow = true;
  posts.computeBoundingSphere();
  heads.computeBoundingSphere();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(glow, 3));
  const glowMat = new THREE.PointsMaterial({
    color: 0xffc870, size: 7, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
    map: glowTexture(),
  });
  const halos = new THREE.Points(g, glowMat);
  halos.name = 'lamp-glow';
  group.add(posts, heads, halos);
  return {
    group,
    count: spots.length,
    /** 0 = off, 1 = dusk, 2.6 = full night. */
    setLevel(level) {
      materials.lamp.emissiveIntensity = 0.1 + level;
      glowMat.opacity = Math.min(1, level * 0.45);
      halos.visible = level > 0;
    },
    dispose() {
      postGeo.dispose();
      heads.geometry.dispose();
      g.dispose();
      glowMat.map.dispose();
      glowMat.dispose();
    },
  };
}

/** A soft round glow, painted into a small data texture (no canvas, so this stays pure). */
function glowTexture() {
  const s = 32;
  const data = new Uint8Array(s * s * 4);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const d = Math.hypot(x - s / 2 + 0.5, y - s / 2 + 0.5) / (s / 2);
      const a = Math.max(0, 1 - d) ** 2;
      data.set([255, 255, 255, Math.round(a * 255)], (y * s + x) * 4);
    }
  }
  const tex = new THREE.DataTexture(data, s, s);
  tex.needsUpdate = true;
  return tex;
}
