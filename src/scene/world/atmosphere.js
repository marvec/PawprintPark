// Time of day and weather for the world (PRD §2, §13.4, §17): the sky dome, sun or moon, fill light, fog, stars,
// falling rain or snow, and the shared weather uniforms (snow cover, wet, dry grass). Pure THREE objects; the
// renderer's exposure and environment are left to the caller.

import * as THREE from 'three';
import { createRng } from '../../core/rng.js';
import { WEATHER_UNIFORMS } from './kit.js';

export const TIMES = /** @type {const} */ (['dawn', 'day', 'dusk', 'night']);
export const WEATHERS = /** @type {const} */ (['sun', 'rain', 'snow', 'heat']);

/**
 * Light and colour per time of day. `sun` is the direction the light comes from (x east, y up, z south).
 * `env` scales the image-based fill light; `lamps` lights the path lamps.
 */
export const TIME_LOOKS = {
  dawn: { sun: [0.9, 0.22, 0.35], sunColor: 0xffc49a, sunI: 1.6, hemiSky: 0xd8c8e0, hemiGround: 0x6a7a58, hemiI: 0.75, skyTop: 0x8aa4d0, skyHorizon: 0xf6c4a4, fog: 0xead0bc, env: 0.28, lamps: 0.35, stars: 0 },
  day: { sun: [-0.62, 0.75, 0.55], sunColor: 0xffe0b0, sunI: 2.6, hemiSky: 0xfff1d8, hemiGround: 0x7a9a50, hemiI: 1.1, skyTop: 0x8fbfe0, skyHorizon: 0xf6e3c0, fog: 0xf1dfc0, env: 0.35, lamps: 0, stars: 0 },
  dusk: { sun: [-0.92, 0.17, 0.3], sunColor: 0xff9c5a, sunI: 2.0, hemiSky: 0xc8a0b8, hemiGround: 0x5a5a48, hemiI: 0.7, skyTop: 0x5a6aa8, skyHorizon: 0xf6a062, fog: 0xe2a684, env: 0.22, lamps: 1, stars: 0.15 },
  night: { sun: [0.35, 0.8, 0.45], sunColor: 0x9fb4ff, sunI: 0.55, hemiSky: 0x5a6aa8, hemiGround: 0x1e2430, hemiI: 0.42, skyTop: 0x0b1330, skyHorizon: 0x26375f, fog: 0x1c2848, env: 0.08, lamps: 2.6, stars: 1 },
};

/** How weather bends the time-of-day look: colour pulls (towards `to`, by `k`), light scales and fog. */
export const WEATHER_LOOKS = {
  sun: { sunK: 1, hemiK: 1, tint: null, fogK: 1, snow: 0, wet: 0, dry: 0, fall: null },
  rain: { sunK: 0.3, hemiK: 0.85, tint: { skyTop: 0x8e98a2, skyHorizon: 0xbcc2c4, fog: 0xaab2b8, hemiSky: 0xc0c8d0, k: 0.75 }, fogK: 0.5, snow: 0, wet: 1, dry: 0, fall: 'rain' },
  snow: { sunK: 0.45, hemiK: 1.05, tint: { skyTop: 0xc0ccd6, skyHorizon: 0xe6eaee, fog: 0xe2e8ee, hemiSky: 0xe8f0ff, k: 0.72 }, fogK: 0.45, snow: 1, wet: 0, dry: 0, fall: 'snow' },
  heat: { sunK: 1.2, hemiK: 1.05, tint: { skyTop: 0xa6c4da, skyHorizon: 0xfff0c4, fog: 0xf6e2b0, hemiSky: 0xfff4d0, k: 0.5 }, fogK: 0.7, snow: 0, wet: 0, dry: 1, fall: null },
};

const SKY_RADIUS = 2000;

/** A sky dome whose gradient can be repainted. */
function buildSkyDome() {
  const g = new THREE.SphereGeometry(SKY_RADIUS, 32, 16);
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 3), 3));
  const sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.name = 'sky';
  sky.renderOrder = -2;
  sky.frustumCulled = false;
  return sky;
}

function paintSky(sky, topHex, horizonHex) {
  const pos = sky.geometry.getAttribute('position');
  const col = sky.geometry.getAttribute('color');
  const top = new THREE.Color(topHex);
  const hor = new THREE.Color(horizonHex);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, Math.min(1, pos.getY(i) / SKY_RADIUS));
    c.copy(hor).lerp(top, Math.pow(t, 0.5));
    col.setXYZ(i, c.r, c.g, c.b);
  }
  col.needsUpdate = true;
}

/** Stars on the upper sky, faded in at night. */
function buildStars(rng) {
  const n = 500;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, Math.PI * 2);
    const y = rng.range(0.15, 1);
    const r = Math.sqrt(1 - y * y);
    pos.set([Math.cos(a) * r * SKY_RADIUS * 0.95, y * SKY_RADIUS * 0.95, Math.sin(a) * r * SKY_RADIUS * 0.95], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  stars.name = 'stars';
  stars.renderOrder = -1;
  stars.frustumCulled = false;
  return stars;
}

const FALL_VERTEX = /* glsl */ `
attribute float aEnd;
uniform float uTime;
uniform vec3 uCenter;
uniform vec3 uBox;
uniform float uSpeed;
uniform float uLength;
uniform float uSize;
uniform float uSnowy;
varying float vFade;
void main() {
  vec3 p = position;
  p.y = fract(p.y - uTime * uSpeed / uBox.y);
  // Snow drifts sideways; rain slants with the wind.
  vec3 sway = uSnowy * vec3(sin(uTime * 0.9 + p.x * 40.0), 0.0, cos(uTime * 0.7 + p.z * 40.0)) * 0.6;
  vec3 world = uCenter + (p - vec3(0.5, 0.0, 0.5)) * uBox + sway;
  world += aEnd * vec3(0.12, uLength, 0.06);
  vec4 mv = modelViewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * 180.0 / max(1.0, -mv.z);
  vFade = smoothstep(0.0, 0.08, p.y) * smoothstep(1.0, 0.85, p.y);
}
`;
const FALL_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uSnowy;
varying float vFade;
void main() {
  float a = uOpacity * vFade;
  if (uSnowy > 0.5) {
    vec2 c = gl_PointCoord - 0.5;
    a *= smoothstep(0.5, 0.2, length(c));
  }
  gl_FragColor = vec4(uColor, a);
}
`;

/**
 * Rain (line streaks) or snow (soft points) falling in a box around the camera's focus. Animated on the GPU.
 * @param {'rain' | 'snow'} kind
 */
function buildFall(kind, count, rng) {
  const snowy = kind === 'snow';
  const verts = snowy ? count : count * 2;
  const pos = new Float32Array(verts * 3);
  const end = new Float32Array(verts);
  for (let i = 0; i < count; i++) {
    const x = rng.next();
    const y = rng.next();
    const z = rng.next();
    if (snowy) pos.set([x, y, z], i * 3);
    else {
      pos.set([x, y, z, x, y, z], i * 6);
      end[i * 2 + 1] = 1;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const material = new THREE.ShaderMaterial({
    vertexShader: FALL_VERTEX,
    fragmentShader: FALL_FRAGMENT,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uCenter: { value: new THREE.Vector3() },
      uBox: { value: new THREE.Vector3(80, 40, 80) },
      uSpeed: { value: snowy ? 2.2 : 26 },
      uLength: { value: snowy ? 0 : 0.9 },
      uSize: { value: snowy ? 0.5 : 0 },
      uSnowy: { value: snowy ? 1 : 0 },
      uColor: { value: new THREE.Color(snowy ? 0xffffff : 0xc8d8e8) },
      uOpacity: { value: snowy ? 0.95 : 0.5 },
    },
  });
  const obj = snowy ? new THREE.Points(g, material) : new THREE.LineSegments(g, material);
  obj.name = kind;
  obj.frustumCulled = false;
  obj.visible = false;
  return obj;
}

/**
 * The atmosphere: add `group` to the scene, then `set({ time, weather })` and call `update` every frame with the
 * camera and the point it looks at.
 * @param {THREE.Scene} scene
 * @param {{ shadows: boolean, shadowMapSize: number, particles?: number }} tier
 */
export function createAtmosphere(scene, tier) {
  const rng = createRng(0x5ca1ab1e);
  const group = new THREE.Group();
  group.name = 'atmosphere';
  const sky = buildSkyDome();
  const stars = buildStars(rng);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x7a9a50, 1);
  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.name = 'sun';
  sun.castShadow = tier.shadows;
  if (tier.shadows) {
    sun.shadow.mapSize.set(tier.shadowMapSize, tier.shadowMapSize);
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.04;
    sun.shadow.radius = 3;
  }
  const count = tier.particles ?? 4000;
  const rain = buildFall('rain', count, rng);
  const snow = buildFall('snow', Math.round(count * 0.8), rng);
  group.add(sky, stars, hemi, sun, sun.target, rain, snow);
  scene.fog = new THREE.Fog(0xf1dfc0, 100, 900);

  const state = { time: 'day', weather: 'sun', lamps: 0, fogK: 1 };
  const c = new THREE.Color();
  const pull = (hex, tint, key) => (tint && tint[key] != null ? c.setHex(hex).lerp(new THREE.Color(tint[key]), tint.k).getHex() : hex);

  function set({ time = state.time, weather = state.weather } = {}) {
    state.time = TIMES.includes(time) ? time : 'day';
    state.weather = WEATHERS.includes(weather) ? weather : 'sun';
    const t = TIME_LOOKS[state.time];
    const w = WEATHER_LOOKS[state.weather];
    const night = state.time === 'night';
    paintSky(sky, pull(t.skyTop, night ? null : w.tint, 'skyTop'), pull(t.skyHorizon, night ? null : w.tint, 'skyHorizon'));
    scene.fog.color.setHex(pull(t.fog, night ? null : w.tint, 'fog'));
    if (night && w.tint) scene.fog.color.lerp(new THREE.Color(0x2a3448), 0.4);
    hemi.color.setHex(pull(t.hemiSky, w.tint, 'hemiSky'));
    hemi.groundColor.setHex(t.hemiGround);
    hemi.intensity = t.hemiI * w.hemiK;
    sun.color.setHex(state.weather === 'heat' ? c.setHex(t.sunColor).lerp(new THREE.Color(0xfff2c8), 0.4).getHex() : t.sunColor);
    sun.intensity = t.sunI * w.sunK;
    stars.material.opacity = w.fall ? t.stars * 0.15 : t.stars;
    state.lamps = t.lamps;
    state.fogK = w.fogK;
    state.env = t.env * (w.fall ? 0.8 : 1);
    WEATHER_UNIFORMS.uSnow.value = w.snow;
    WEATHER_UNIFORMS.uWet.value = w.wet;
    WEATHER_UNIFORMS.uDry.value = w.dry;
    rain.visible = w.fall === 'rain';
    snow.visible = w.fall === 'snow';
    // Night rain is darker and bluer.
    rain.material.uniforms.uColor.value.setHex(night ? 0x8090b0 : 0xc8d8e8);
    snow.material.uniforms.uColor.value.setHex(night ? 0xb8c4e0 : 0xffffff);
    state.sunDir = new THREE.Vector3(...t.sun).normalize();
    return state;
  }

  /**
   * Follows the camera: the sky and stars stay centred on it, the sun's shadow box covers the area in view, fog
   * scales with zoom, and rain or snow fall around the focus.
   * @param {THREE.PerspectiveCamera} camera
   * @param {THREE.Vector3} focus
   * @param {number} distance camera distance from the focus
   */
  function update(camera, focus, distance, t) {
    sky.position.copy(camera.position);
    stars.position.copy(camera.position);
    const extent = Math.min(260, distance * 0.75 + 12);
    sun.target.position.copy(focus);
    sun.position.copy(focus).addScaledVector(state.sunDir, extent * 3);
    if (tier.shadows) {
      const s = sun.shadow.camera;
      if (s.right !== extent) {
        s.left = -extent;
        s.right = extent;
        s.top = extent;
        s.bottom = -extent;
        s.near = 1;
        s.far = extent * 7;
        s.updateProjectionMatrix();
      }
    }
    scene.fog.near = (distance * 0.9 + 40) * state.fogK;
    scene.fog.far = (distance * 3.2 + 260) * state.fogK;
    for (const fall of [rain, snow]) {
      if (!fall.visible) continue;
      const u = fall.material.uniforms;
      u.uTime.value = t;
      const box = Math.min(220, Math.max(40, distance * 1.3));
      u.uBox.value.set(box, Math.min(70, box * 0.6), box);
      u.uCenter.value.set(focus.x, focus.y - 2, focus.z);
      u.uSize.value = fall === snow ? 0.35 + distance / 400 : 0;
    }
  }

  set();
  return {
    group,
    sun,
    hemi,
    sky,
    state,
    set,
    update,
    dispose() {
      group.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose?.();
      });
      sun.shadow.map?.dispose();
    },
  };
}
