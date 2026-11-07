// Shared pieces of the world scene: the tile size in metres, a kit that merges coloured low-poly parts into one
// geometry (one draw call per enclosure or building instead of one per post), and the world materials, which share
// the weather uniforms (snow on upward faces, wet darkening, dry grass). Pure: no WebGL until a renderer draws it.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** One grid tile is this many metres across. Map heights are in tiles too. */
export const TILE = 2;

/** Converts a tile coordinate (corner-based, fractional allowed) to metres. */
export const tm = (t) => t * TILE;

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();

/**
 * A transform for `kit.add`: position, Euler rotation (radians, YXZ order so `ry` turns the part first) and scale.
 * @typedef {{ x?: number, y?: number, z?: number, rx?: number, ry?: number, rz?: number,
 *   sx?: number, sy?: number, sz?: number, s?: number }} Place
 */

/** A matrix from a Place. */
export function placeMatrix(t = {}, out = new THREE.Matrix4()) {
  _e.set(t.rx ?? 0, t.ry ?? 0, t.rz ?? 0, 'YXZ');
  _q.setFromEuler(_e);
  const s = t.s ?? 1;
  _s.set((t.sx ?? 1) * s, (t.sy ?? 1) * s, (t.sz ?? 1) * s);
  _p.set(t.x ?? 0, t.y ?? 0, t.z ?? 0);
  return out.compose(_p, _q, _s);
}

/**
 * Collects flat-shaded, vertex-coloured parts and merges them into one geometry. Parts can be placed inside a
 * frame (a parent matrix), so a whole prop can be built at the origin and then dropped into the world.
 */
export function createKit() {
  /** @type {THREE.BufferGeometry[]} */
  const parts = [];
  /** @type {THREE.Matrix4[]} */
  const frames = [];
  const kit = {
    /**
     * Adds a part. `color` is a hex number, or a function of the world-space vertex position returning one.
     * @param {THREE.BufferGeometry} geo
     * @param {number | ((x: number, y: number, z: number) => number)} color
     * @param {Place | THREE.Matrix4} [t]
     * @param {{ smooth?: boolean }} [opts] smooth keeps the geometry's own normals (rounded shapes); otherwise
     *   every face is flat.
     */
    add(geo, color, t, { smooth = false } = {}) {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      for (const name of Object.keys(g.attributes)) if (name !== 'position' && !(smooth && name === 'normal')) g.deleteAttribute(name);
      g.applyMatrix4(t instanceof THREE.Matrix4 ? t : placeMatrix(t, _m));
      for (let i = frames.length - 1; i >= 0; i--) g.applyMatrix4(frames[i]);
      if (!smooth || !g.getAttribute('normal')) g.computeVertexNormals();
      const pos = g.getAttribute('position');
      const colors = new Float32Array(pos.count * 3);
      if (typeof color === 'number') _c.setHex(color);
      for (let i = 0; i < pos.count; i++) {
        if (typeof color === 'function') _c.setHex(color(pos.getX(i), pos.getY(i), pos.getZ(i)));
        colors[i * 3] = _c.r;
        colors[i * 3 + 1] = _c.g;
        colors[i * 3 + 2] = _c.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      parts.push(g);
      geo.dispose?.();
      return kit;
    },
    /** Runs `fn` with every part placed inside the frame `t` (frames nest). */
    within(t, fn) {
      frames.push(t instanceof THREE.Matrix4 ? t.clone() : placeMatrix(t));
      try {
        fn();
      } finally {
        frames.pop();
      }
      return kit;
    },
    get count() {
      return parts.length;
    },
    /** The merged geometry, or null when nothing was added. */
    geometry() {
      if (!parts.length) return null;
      const g = mergeGeometries(parts, false);
      for (const p of parts) p.dispose();
      parts.length = 0;
      return g;
    },
    /** A mesh of the merged geometry, or null. */
    mesh(material, { name = '', shadows = true, receive = true } = {}) {
      const g = kit.geometry();
      if (!g) return null;
      const mesh = new THREE.Mesh(g, material);
      mesh.name = name;
      mesh.castShadow = shadows;
      mesh.receiveShadow = receive;
      return mesh;
    },
  };
  return kit;
}

/** Lerps two hex colours. */
export function mixHex(a, b, t) {
  return _c.setHex(a).lerp(new THREE.Color(b), t).getHex();
}

/** Multiplies a hex colour's brightness. */
export function shadeHex(a, k) {
  _c.setHex(a).multiplyScalar(k);
  return _c.getHex();
}

// ---- Weather-aware materials ---------------------------------------------------------------------------------------

/**
 * Uniforms every world material shares, so one change re-dresses the whole world:
 * `uSnow` whitens upward faces, `uWet` darkens, `uDry` turns green towards straw (terrain and plants only).
 */
export const WEATHER_UNIFORMS = {
  uSnow: { value: 0 },
  uWet: { value: 0 },
  uDry: { value: 0 },
};

const WEATHER_VERTEX_HEAD = /* glsl */ `
varying vec3 vWPos;
varying vec3 vWNormal;
`;
const WEATHER_VERTEX_BODY = /* glsl */ `
{
  vec4 wp = vec4(transformed, 1.0);
  vec3 wn = objectNormal;
  #ifdef USE_INSTANCING
    wp = instanceMatrix * wp;
    wn = mat3(instanceMatrix) * wn;
  #endif
  wp = modelMatrix * wp;
  vWPos = wp.xyz;
  vWNormal = normalize(mat3(modelMatrix) * wn);
}
`;
const WEATHER_FRAGMENT_HEAD = /* glsl */ `
varying vec3 vWPos;
varying vec3 vWNormal;
uniform float uSnow;
uniform float uWet;
uniform float uDry;
`;
const WEATHER_FRAGMENT_BODY = /* glsl */ `
{
  float green = clamp((diffuseColor.g - max(diffuseColor.r, diffuseColor.b)) * 6.0, 0.0, 1.0);
  vec3 straw = vec3(dot(diffuseColor.rgb, vec3(0.45, 0.45, 0.1))) * vec3(1.32, 1.12, 0.62);
  diffuseColor.rgb = mix(diffuseColor.rgb, straw, uDry * green * DRY_STRENGTH);
  diffuseColor.rgb *= 1.0 - 0.22 * uWet;
  float up = smoothstep(0.45, 0.85, normalize(vWNormal).y);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.96, 1.0), uSnow * up * SNOW_STRENGTH);
}
`;

/**
 * Patches a material with the shared weather uniforms. `extra` adds more uniforms and fragment code that runs after
 * the weather (the terrain's grid and locked plots use it).
 * @param {THREE.Material} material
 * @param {{ dry?: number, snow?: number, uniforms?: Record<string, { value: unknown }>, fragmentHead?: string,
 *   fragmentBody?: string, key?: string }} [opts]
 */
export function withWeather(material, { dry = 1, snow = 1, uniforms = {}, fragmentHead = '', fragmentBody = '', key = '' } = {}) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, WEATHER_UNIFORMS, uniforms);
    shader.vertexShader = WEATHER_VERTEX_HEAD + shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>\n${WEATHER_VERTEX_BODY}`);
    shader.fragmentShader = `${WEATHER_FRAGMENT_HEAD}${fragmentHead}\n${shader.fragmentShader}`.replace(
      '#include <color_fragment>',
      `#include <color_fragment>\n#define DRY_STRENGTH ${dry.toFixed(2)}\n#define SNOW_STRENGTH ${snow.toFixed(2)}\n${WEATHER_FRAGMENT_BODY}\n${fragmentBody}`,
    );
  };
  material.customProgramCacheKey = () => `weather:${dry}:${snow}:${key}`;
  return material;
}

/**
 * The shared world materials: flat-shaded vertex colours for props, smooth for soft shapes (the keeper), glass,
 * net, emissive lamps. Create once per scene; `dispose()` frees them.
 */
export function createWorldMaterials() {
  const m = {
    /** Faceted props, fences, buildings, rocks, trees. */
    flat: withWeather(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, flatShading: true }), { dry: 0.6, key: 'flat' }),
    /** Soft shapes: people, carts, ground patches. */
    smooth: withWeather(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }), { dry: 0.6, key: 'smooth' }),
    /** Paths: swept, so only a dusting of snow. */
    path: withWeather(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true }), { dry: 0, snow: 0.25, key: 'path' }),
    /** Indoor things under a roof: no snow, no rain. */
    indoor: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true }),
    glass: new THREE.MeshStandardMaterial({ color: 0xd8f0f4, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.28, depthWrite: false }),
    /** Pools and troughs: vertex colours carry clean or murky water. */
    water: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.85 }),
    /** Aviary nets: a faint dark veil (the cords are solid parts). */
    net: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
    lamp: new THREE.MeshStandardMaterial({ color: 0xfff1c8, emissive: 0xffd890, emissiveIntensity: 0.2, roughness: 0.4 }),
    dispose() {
      for (const v of Object.values(m)) if (v && v.isMaterial) v.dispose();
    },
  };
  return m;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _x = new THREE.Vector3(1, 0, 0);

/**
 * Adds a box beam from point a to point b (a rail, a fallen post): `t` thick, `h` tall (defaults to `t`).
 * @param {ReturnType<typeof createKit>} kit
 */
export function addBeam(kit, a, b, t, color, h = t) {
  _a.set(a[0], a[1], a[2]);
  _b.set(b[0], b[1], b[2]);
  const len = _a.distanceTo(_b);
  const dir = _b.clone().sub(_a).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(_x, dir);
  const m = new THREE.Matrix4().compose(_a.clone().add(_b).multiplyScalar(0.5), q, new THREE.Vector3(len, 1, 1));
  kit.add(new THREE.BoxGeometry(1, h, t), color, m);
}

/**
 * The frame of a placement: its centre in metres and its turn, with helpers to go from local coordinates (origin
 * at the footprint's centre, front towards +z) to the world. `W` and `D` are the local width and depth in metres.
 * @param {{ x0: number, z0: number, x1: number, z1: number }} rect footprint in tiles (footprintRect)
 * @param {number} rot 0–3
 */
export function placementFrame(rect, rot) {
  const cx = ((rect.x0 + rect.x1) / 2) * TILE;
  const cz = ((rect.z0 + rect.z1) / 2) * TILE;
  const theta = (rot * Math.PI) / 2;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const odd = rot % 2 === 1;
  const W = (odd ? rect.z1 - rect.z0 : rect.x1 - rect.x0) * TILE;
  const D = (odd ? rect.x1 - rect.x0 : rect.z1 - rect.z0) * TILE;
  return {
    cx,
    cz,
    theta,
    W,
    D,
    matrix: new THREE.Matrix4().makeRotationY(theta).setPosition(cx, 0, cz),
    /** World x, z of a local point. */
    toWorld: (lx, lz) => [cx + lx * cos + lz * sin, cz - lx * sin + lz * cos],
  };
}

/** Runs `fn` with every kit in `kits` (an object of kits) inside the frame `t`. */
export function withinAll(kits, t, fn) {
  const list = Object.values(kits);
  const step = (i) => (i === list.length ? fn() : list[i].within(t, () => step(i + 1)));
  step(0);
}
