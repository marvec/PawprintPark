// Sky, sun and a meadow with low-poly trees and rocks. Pure: plain Object3D trees, no WebGL.

import * as THREE from 'three';
import { createRng } from '../core/rng.js';
import { PALETTE } from '../data/palette.js';

/** Vertex colours on a geometry from a function of the vertex position. */
function paintVertices(g, fn) {
  const pos = g.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    c.setHex(fn(pos.getX(i), pos.getY(i), pos.getZ(i)));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

/** A gradient sky dome: blue overhead, warm haze at the horizon. */
export function buildSky(radius = 400) {
  const g = new THREE.SphereGeometry(radius, 32, 16);
  const top = new THREE.Color(PALETTE.skyTop);
  const hor = new THREE.Color(PALETTE.skyHorizon);
  paintVertices(g, (x, y) => {
    const t = Math.max(0, Math.min(1, y / radius));
    return hor.clone().lerp(top, Math.pow(t, 0.55)).getHex();
  });
  const sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.name = 'sky';
  sky.renderOrder = -1;
  return sky;
}

/**
 * Warm low sun with a soft fill. The sun's shadow camera covers `extent` metres around `target`.
 * @param {{ extent?: number, shadows?: boolean, shadowMapSize?: number }} opts
 */
export function buildLights({ extent = 30, shadows = true, shadowMapSize = 2048 } = {}) {
  const group = new THREE.Group();
  group.name = 'lights';
  group.add(new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 1.1));
  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.6);
  sun.name = 'sun';
  sun.position.set(-extent * 0.9, extent * 0.75, extent * 0.6);
  sun.castShadow = shadows;
  if (shadows) {
    sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    const s = sun.shadow.camera;
    s.left = -extent;
    s.right = extent;
    s.top = extent;
    s.bottom = -extent;
    s.near = 1;
    s.far = extent * 4;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 4;
  }
  group.add(sun);
  group.add(sun.target);
  return { group, sun };
}

/** A low-poly tree: a trunk and two or three leafy blobs. */
export function buildTree(rng, scale = 1) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: PALETTE.trunk, roughness: 0.9, flatShading: true });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * scale, 0.18 * scale, 1.6 * scale, 6), mat);
  trunk.position.y = 0.8 * scale;
  trunk.castShadow = true;
  g.add(trunk);
  const blobs = rng.int(2, 3);
  for (let i = 0; i < blobs; i++) {
    const r = rng.range(0.7, 1.1) * scale;
    const leaf = new THREE.Mesh(
      new THREE.IcosahedronGeometry(r, 1),
      new THREE.MeshStandardMaterial({ color: rng.pick(PALETTE.leaves), roughness: 0.85, flatShading: true }),
    );
    leaf.position.set(rng.range(-0.4, 0.4) * scale, (1.9 + i * 0.55) * scale, rng.range(-0.4, 0.4) * scale);
    leaf.castShadow = true;
    g.add(leaf);
  }
  return g;
}

/**
 * A meadow: a large gently rolling ground with trees and rocks outside a clear area of `clearRadius`.
 * @param {{ seed?: number, size?: number, clearRadius?: number, trees?: number }} opts
 */
export function buildMeadow({ seed = 1, size = 220, clearRadius = 30, trees = 60 } = {}) {
  const rng = createRng(seed);
  const group = new THREE.Group();
  group.name = 'meadow';

  const g = new THREE.PlaneGeometry(size, size, 80, 80);
  g.rotateX(-Math.PI / 2);
  const pos = g.getAttribute('position');
  const height = (x, z) => {
    const d = Math.hypot(x, z);
    const rise = Math.max(0, d - clearRadius) / (size / 2 - clearRadius);
    return (Math.sin(x * 0.07) * Math.cos(z * 0.06) * 1.5 + Math.sin(x * 0.023 + z * 0.031) * 3) * rise * rise;
  };
  for (let i = 0; i < pos.count; i++) pos.setY(i, height(pos.getX(i), pos.getZ(i)));
  g.computeVertexNormals();
  const light = new THREE.Color(PALETTE.grassLight);
  const dark = new THREE.Color(PALETTE.grassDark);
  paintVertices(g, (x, y, z) => {
    const n = (Math.sin(x * 0.31) * Math.cos(z * 0.27) + Math.sin((x + z) * 0.13)) * 0.25 + 0.5;
    return dark.clone().lerp(light, n).getHex();
  });
  const ground = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  ground.name = 'ground';
  ground.receiveShadow = true;
  group.add(ground);

  for (let i = 0; i < trees; i++) {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(clearRadius + 4, size * 0.42);
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const tree = buildTree(rng, rng.range(0.9, 1.6));
    tree.position.set(x, height(x, z) - 0.1, z);
    group.add(tree);
  }
  for (let i = 0; i < trees / 2; i++) {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(clearRadius + 2, size * 0.4);
    const r = rng.range(0.3, 0.9);
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), new THREE.MeshStandardMaterial({ color: PALETTE.rock, roughness: 0.9, flatShading: true }));
    rock.position.set(Math.cos(a) * d, height(Math.cos(a) * d, Math.sin(a) * d) + r * 0.3, Math.sin(a) * d);
    rock.rotation.set(rng.range(0, 3), rng.range(0, 3), 0);
    rock.castShadow = true;
    group.add(rock);
  }
  return { group, height };
}
