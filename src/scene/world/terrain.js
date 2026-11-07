// The ground of the world: terrain chunks from the map's corner heights, the water surface, the land beyond the map,
// the automatic paths, and the trees and rocks. The terrain shader draws the grid, plot borders and locked land.
// Pure scene building: plain Object3D trees, no WebGL.

import * as THREE from 'three';
import { MAX_BUILD_SLOPE, WATER_LEVEL, cornerHeight, heightAt as tileHeightAt, tileSlope } from '../../core/map.js';
import { createRng } from '../../core/rng.js';
import { PLOT_SIZE, PLOTS_ACROSS } from '../../data/world.js';
import { PALETTE } from '../../data/palette.js';
import { TILE, createKit, mixHex, shadeHex, withWeather } from './kit.js';

/** Terrain chunks are this many tiles across, so the camera's frustum culls what it can't see. */
const CHUNK = 48;

/** Height of the map surface in metres at a point in metres. */
export function groundY(map, x, z) {
  return tileHeightAt(map, x / TILE, z / TILE) * TILE;
}

/** Cheap, smooth colour noise in [0, 1] for terrain shading (not gameplay, so no seeded generator needed). */
function shadeNoise(x, z) {
  return (Math.sin(x * 0.21) * Math.cos(z * 0.17) + Math.sin((x + z) * 0.083) + Math.sin(x * 0.047 - z * 0.061)) / 6 + 0.5;
}

/** Corner colour: grass, sandy banks, wet river bed, and earthy steep slopes. */
function cornerColor(map, x, z) {
  const h = cornerHeight(map, x, z);
  const n = shadeNoise(x, z);
  let c = mixHex(PALETTE.grassDark, PALETTE.grassLight, n * 0.8);
  if (h > 2) c = mixHex(c, PALETTE.grassHigh, Math.min(1, (h - 2) / 4));
  const tx = Math.min(map.size - 1, x);
  const tz = Math.min(map.size - 1, z);
  const slope = tileSlope(map, tx, tz);
  if (slope > MAX_BUILD_SLOPE * 0.8) c = mixHex(c, PALETTE.earth, Math.min(1, (slope - MAX_BUILD_SLOPE * 0.8) * 1.6));
  if (h < 0) c = mixHex(c, PALETTE.sand, Math.min(1, -h / 0.12));
  if (h < WATER_LEVEL) c = mixHex(PALETTE.sand, PALETTE.riverBed, Math.min(1, (WATER_LEVEL - h) / 0.5));
  return c;
}

/** Terrain fragment code: locked plots muted, then grid lines and plot borders. */
const TERRAIN_FRAGMENT_HEAD = /* glsl */ `
uniform sampler2D uPlotMask;
uniform float uGrid;
uniform float uPlotLines;
uniform float uTile;
uniform float uPlotMetres;
uniform float uPlotsAcross;
`;
const TERRAIN_FRAGMENT_BODY = /* glsl */ `
{
  vec2 plot = vWPos.xz / uPlotMetres;
  float unlocked = texture2D(uPlotMask, (floor(plot) + 0.5) / uPlotsAcross).r;
  if (plot.x < 0.0 || plot.y < 0.0 || plot.x >= uPlotsAcross || plot.y >= uPlotsAcross) unlocked = 0.0;
  float grey = dot(diffuseColor.rgb, vec3(0.35, 0.45, 0.2));
  vec3 muted = mix(diffuseColor.rgb, vec3(grey) * vec3(1.0, 0.97, 0.9), 0.55) * 0.86;
  diffuseColor.rgb = mix(diffuseColor.rgb, muted, 1.0 - unlocked);
  vec2 t = vWPos.xz / uTile;
  vec2 g = abs(fract(t - 0.5) - 0.5) / fwidth(t);
  float line = 1.0 - min(min(g.x, g.y), 1.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.99, 0.92), line * 0.22 * uGrid * unlocked);
  vec2 p = abs(fract(plot - 0.5) - 0.5) / fwidth(plot);
  float border = 1.0 - min(min(p.x, p.y) / 1.6, 1.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.93, 0.74), border * mix(0.22, 0.6, unlocked) * uPlotLines);
}
`;

/** A 10×10 texture of unlocked plots (red = 255 when unlocked). */
function plotTexture(plots) {
  const data = new Uint8Array(PLOTS_ACROSS * PLOTS_ACROSS * 4);
  for (const i of plots) data.set([255, 255, 255, 255], i * 4);
  const tex = new THREE.DataTexture(data, PLOTS_ACROSS, PLOTS_ACROSS);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

/**
 * The terrain: chunked meshes over the whole map, plus the water surface and the land around the map.
 * @param {import('../../core/map.js').GameMap} map
 * @param {{ plots: number[] }} opts
 */
export function buildTerrain(map, { plots }) {
  const group = new THREE.Group();
  group.name = 'terrain';
  const uniforms = {
    uPlotMask: { value: plotTexture(plots) },
    uGrid: { value: 0 },
    uPlotLines: { value: 0 },
    uTile: { value: TILE },
    uPlotMetres: { value: PLOT_SIZE * TILE },
    uPlotsAcross: { value: PLOTS_ACROSS },
  };
  const material = withWeather(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), {
    uniforms,
    fragmentHead: TERRAIN_FRAGMENT_HEAD,
    fragmentBody: TERRAIN_FRAGMENT_BODY,
    key: 'terrain',
  });

  const n = map.size;
  const H = (x, z) => cornerHeight(map, Math.max(0, Math.min(n, x)), Math.max(0, Math.min(n, z))) * TILE;
  const color = new THREE.Color();
  for (let cz = 0; cz < n; cz += CHUNK) {
    for (let cx = 0; cx < n; cx += CHUNK) {
      const w = Math.min(CHUNK, n - cx);
      const d = Math.min(CHUNK, n - cz);
      const verts = (w + 1) * (d + 1);
      const pos = new Float32Array(verts * 3);
      const nor = new Float32Array(verts * 3);
      const col = new Float32Array(verts * 3);
      let v = 0;
      for (let z = cz; z <= cz + d; z++) {
        for (let x = cx; x <= cx + w; x++, v++) {
          pos.set([x * TILE, H(x, z), z * TILE], v * 3);
          // Normals from the whole map's heights, so chunk seams don't show.
          const nx = -(H(x + 1, z) - H(x - 1, z)) / (2 * TILE);
          const nz = -(H(x, z + 1) - H(x, z - 1)) / (2 * TILE);
          const len = Math.hypot(nx, 1, nz);
          nor.set([nx / len, 1 / len, nz / len], v * 3);
          color.setHex(cornerColor(map, x, z));
          col.set([color.r, color.g, color.b], v * 3);
        }
      }
      const index = [];
      for (let z = 0; z < d; z++) {
        for (let x = 0; x < w; x++) {
          const a = z * (w + 1) + x;
          const b = a + 1;
          const c = a + (w + 1);
          const e = c + 1;
          index.push(a, c, b, b, c, e);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.setIndex(index);
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, material);
      mesh.name = 'terrain-chunk';
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }

  // Walls down from the map's edge, and land around the map out to the horizon.
  const edge = createKit();
  const metres = n * TILE;
  const wall = (x0, z0, x1, z1, h0, h1) => {
    // Flat edges meet the land outside without a wall (a thin wall there only shows as a dark seam).
    if (h0 < 0.05 && h1 < 0.05 && h0 > -0.05 && h1 > -0.05) return;
    const g = new THREE.BufferGeometry();
    // Both windings, so the wall shows from either side.
    g.setAttribute('position', new THREE.Float32BufferAttribute([
      x0, h0, z0, x1, h1, z1, x0, -4, z0, x1, h1, z1, x1, -4, z1, x0, -4, z0,
      x0, h0, z0, x0, -4, z0, x1, h1, z1, x1, h1, z1, x0, -4, z0, x1, -4, z1,
    ], 3));
    edge.add(g, PALETTE.earth);
  };
  for (let i = 0; i < n; i++) {
    wall(i * TILE, 0, (i + 1) * TILE, 0, H(i, 0), H(i + 1, 0));
    wall((i + 1) * TILE, metres, i * TILE, metres, H(i + 1, n), H(i, n));
    wall(0, (i + 1) * TILE, 0, i * TILE, H(0, i + 1), H(0, i));
    wall(metres, i * TILE, metres, (i + 1) * TILE, H(n, i), H(n, i + 1));
  }
  // Edge walls take no shadows: seen edge-on from far away, shadow acne turns them into a jagged dark line.
  const edgeMesh = edge.mesh(material, { name: 'map-edge', shadows: false, receive: false });
  if (edgeMesh) group.add(edgeMesh);
  const far = 3000;
  const outer = createKit();
  const outerColor = mixHex(PALETTE.grassDark, PALETTE.grassLight, 0.4);
  for (const [x, z, w, d] of [
    [-far, -far, 2 * far + metres, far],
    [-far, metres, 2 * far + metres, far],
    [-far, 0, far, metres],
    [metres, 0, far, metres],
  ]) {
    outer.add(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), outerColor, { x: x + w / 2, y: -0.02, z: z + d / 2 });
  }
  const outerMesh = outer.mesh(material, { name: 'outer-land', shadows: false });
  group.add(outerMesh);

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(metres, metres).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: PALETTE.water, roughness: 0.1, metalness: 0.05, transparent: true, opacity: 0.85 }),
  );
  water.name = 'water';
  water.position.set(metres / 2, WATER_LEVEL * TILE, metres / 2);
  water.receiveShadow = true;
  group.add(water);

  return {
    group,
    uniforms,
    material,
    water,
    /** Updates which plots are unlocked (muted land follows). */
    setPlots(list) {
      uniforms.uPlotMask.value.dispose();
      uniforms.uPlotMask.value = plotTexture(list);
    },
    dispose() {
      group.traverse((o) => o.isMesh && o.geometry.dispose());
      material.dispose();
      water.material.dispose();
      uniforms.uPlotMask.value.dispose();
    },
  };
}

/**
 * The automatic paths: a sandy surface on every path tile, with a low kerb where the path ends.
 * @param {import('../../core/map.js').GameMap} map
 * @param {Uint8Array} path tiles from buildPathNetwork
 */
export function buildPaths(map, path, material) {
  const kit = createKit();
  const n = map.size;
  const lift = 0.05;
  const isPath = (x, z) => x >= 0 && z >= 0 && x < n && z < n && path[z * n + x] === 1;
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      if (!isPath(x, z)) continue;
      const y = (cx, cz) => cornerHeight(map, cx, cz) * TILE + lift;
      const x0 = x * TILE;
      const z0 = z * TILE;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([
        x0, y(x, z), z0, x0, y(x, z + 1), z0 + TILE, x0 + TILE, y(x + 1, z), z0,
        x0 + TILE, y(x + 1, z), z0, x0, y(x, z + 1), z0 + TILE, x0 + TILE, y(x + 1, z + 1), z0 + TILE,
      ], 3));
      const tint = ((x * 7 + z * 13) % 5) / 40;
      kit.add(g, mixHex(PALETTE.path, PALETTE.pathDark, tint));
      // Kerbs on sides that don't continue as path.
      const kerb = (cx0, cz0, cx1, cz1) => {
        const ax = cx0 * TILE;
        const az = cz0 * TILE;
        const bx = cx1 * TILE;
        const bz = cz1 * TILE;
        const len = Math.hypot(bx - ax, bz - az);
        const ym = (y(cx0, cz0) + y(cx1, cz1)) / 2;
        const ang = Math.atan2(bz - az, bx - ax);
        kit.add(new THREE.BoxGeometry(len + 0.12, 0.16, 0.16), PALETTE.kerb, { x: (ax + bx) / 2, y: ym + 0.03, z: (az + bz) / 2, ry: -ang });
      };
      if (!isPath(x, z - 1)) kerb(x, z, x + 1, z);
      if (!isPath(x, z + 1)) kerb(x, z + 1, x + 1, z + 1);
      if (!isPath(x - 1, z)) kerb(x, z, x, z + 1);
      if (!isPath(x + 1, z)) kerb(x + 1, z, x + 1, z + 1);
    }
  }
  return kit.mesh(material, { name: 'paths', shadows: false });
}

/** A white-coloured geometry for instancing (instance colours tint it). */
function white(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  const c = new Float32Array(g.getAttribute('position').count * 3).fill(1);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

/**
 * Trees and rocks from the map, as a few instanced meshes. Anything on a blocked tile (a footprint or a path) is
 * left out: building clears the land.
 * @param {import('../../core/map.js').GameMap} map
 * @param {{ material: THREE.Material, blocked: (tx: number, tz: number) => boolean, detail?: number }} opts
 */
export function buildScatter(map, { material, blocked, detail = 1 }) {
  const group = new THREE.Group();
  group.name = 'scatter';
  const leafy = [];
  const pines = [];
  for (const t of map.trees) {
    const tx = Math.floor(t.x);
    const tz = Math.floor(t.z);
    if (blocked(tx, tz) || blocked(tx + 1, tz) || blocked(tx - 1, tz) || blocked(tx, tz + 1) || blocked(tx, tz - 1)) continue;
    const h = tileHeightAt(map, t.x, t.z);
    (h > 2.2 || t.seed % 10 < 3 ? pines : leafy).push(t);
  }
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  const up = (t) => groundY(map, t.x * TILE, t.z * TILE) - 0.15;

  // Leafy trees: a trunk and three crown blobs each.
  const trunkGeo = white(new THREE.CylinderGeometry(0.2, 0.32, 2.6, 6).translate(0, 1.3, 0));
  // Rounder crowns on High only.
  const blobGeo = white(new THREE.IcosahedronGeometry(1, detail >= 0.95 ? 1 : 0));
  const coneGeo = white(new THREE.ConeGeometry(1, 1, 7));
  const trunks = new THREE.InstancedMesh(trunkGeo, material, leafy.length + pines.length);
  const blobs = new THREE.InstancedMesh(blobGeo, material, leafy.length * 3);
  const cones = new THREE.InstancedMesh(coneGeo, material, pines.length * 3);
  let ti = 0;
  let bi = 0;
  for (const t of leafy) {
    const rng = createRng(t.seed);
    const s = t.scale * 1.15;
    const x = t.x * TILE;
    const z = t.z * TILE;
    const y = up(t);
    m.makeScale(s, s, s).setPosition(x, y, z);
    trunks.setMatrixAt(ti, m);
    trunks.setColorAt(ti++, c.setHex(PALETTE.trunk));
    const base = rng.pick(PALETTE.leaves);
    for (let i = 0; i < 3; i++) {
      const r = rng.range(1.25, 1.7) * s;
      m.makeRotationY(rng.range(0, 6.28));
      m.scale(new THREE.Vector3(r, r * 0.92, r));
      m.setPosition(x + rng.range(-0.7, 0.7) * s, y + (2.9 + i * 0.75) * s, z + rng.range(-0.7, 0.7) * s);
      blobs.setMatrixAt(bi, m);
      blobs.setColorAt(bi++, c.setHex(i === 2 ? mixHex(base, 0xffffff, 0.12) : base));
    }
  }
  let ci = 0;
  for (const t of pines) {
    const rng = createRng(t.seed);
    const s = t.scale * 1.1;
    const x = t.x * TILE;
    const z = t.z * TILE;
    const y = up(t);
    m.makeScale(s * 0.8, s * 0.7, s * 0.8).setPosition(x, y, z);
    trunks.setMatrixAt(ti, m);
    trunks.setColorAt(ti++, c.setHex(PALETTE.trunk));
    const tint = rng.pick(PALETTE.pines);
    for (let i = 0; i < 3; i++) {
      const r = (1.9 - i * 0.5) * s;
      const hgt = (2.4 - i * 0.35) * s;
      m.makeRotationY(rng.range(0, 6.28));
      m.scale(new THREE.Vector3(r, hgt, r));
      m.setPosition(x, y + (2.2 + i * 1.25) * s, z);
      cones.setMatrixAt(ci, m);
      cones.setColorAt(ci++, c.setHex(mixHex(tint, 0xffffff, i * 0.06)));
    }
  }
  for (const [mesh, name] of [[trunks, 'trunks'], [blobs, 'crowns'], [cones, 'pines']]) {
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }

  // Rocks: squashed, turned dodecahedrons.
  const rockList = map.rocks.filter((r) => !blocked(Math.floor(r.x), Math.floor(r.z)));
  const rocks = new THREE.InstancedMesh(white(new THREE.DodecahedronGeometry(1, 0)), material, rockList.length);
  rockList.forEach((r, i) => {
    const rng = createRng(r.seed);
    const s = r.scale * 0.9;
    m.makeRotationFromEuler(new THREE.Euler(rng.range(0, 3), rng.range(0, 6), rng.range(0, 3)));
    m.scale(new THREE.Vector3(s * rng.range(1, 1.5), s * rng.range(0.55, 0.8), s));
    m.setPosition(r.x * TILE, groundY(map, r.x * TILE, r.z * TILE) + s * 0.2, r.z * TILE);
    rocks.setMatrixAt(i, m);
    rocks.setColorAt(i, c.setHex(mixHex(PALETTE.rock, PALETTE.rockDark, rng.next() * 0.6)));
  });
  rocks.name = 'rocks';
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  rocks.computeBoundingSphere();
  group.add(rocks);

  return {
    group,
    counts: { leafy: leafy.length, pines: pines.length, rocks: rockList.length },
    dispose() {
      group.traverse((o) => o.isMesh && (o.geometry.dispose(), o.dispose?.()));
    },
  };
}
