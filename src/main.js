// Entry point. For now: a title scene with the neglected sheep in a meadow. The game proper comes next.

import * as THREE from 'three';
import { PALETTE } from './data/palette.js';
import { defaultQuality, QUALITY } from './data/quality.js';
import { initPlatform, isTouch, reducedMotion } from './engine/platform.js';
import { createRenderer } from './engine/renderer.js';
import { animate, buildAnimal } from './scene/animals/index.js';
import { detail } from './scene/animals/shapes.js';
import { buildLights, buildMeadow, buildSky } from './scene/backdrop.js';

// Bun's HTML bundler rewrites <link> tags, so the icon and manifest are injected at runtime (handbook §11).
for (const [rel, href] of [['icon', './icon.svg'], ['manifest', './manifest.webmanifest'], ['apple-touch-icon', './icon.svg']]) {
  const link = document.createElement('link');
  link.rel = rel;
  link.href = href;
  document.head.appendChild(link);
}

initPlatform();
const quality = defaultQuality(isTouch());
detail.level = QUALITY[quality].detail;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(PALETTE.fog, 30, 140);
scene.add(buildSky());
scene.add(buildMeadow({ seed: 3, clearRadius: 14, trees: 50 }).group);
scene.add(buildLights({ extent: 8, ...QUALITY[quality] }).group);

const sheep = buildAnimal('domestic-sheep', { sex: 'female' });
scene.add(sheep.group);

const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 600);
const reduced = reducedMotion();

const view = createRenderer(/** @type {HTMLCanvasElement} */ (document.getElementById('view')), {
  quality,
  scene,
  camera,
  onFrame(dt, t) {
    animate(sheep.rig, Math.floor(t / 6) % 2 ? 'eat' : 'idle', t, { reduced });
    const a = reduced ? 0.6 : t * 0.12;
    camera.position.set(Math.sin(a) * 4.2, 1.6, Math.cos(a) * 4.2);
    camera.lookAt(0, 0.45, 0);
  },
  render(renderer) {
    renderer.render(scene, camera);
  },
});

globalThis.__step = (n = 1) => view.step(n);

if (typeof __DEV__ === 'undefined' || __DEV__) import('./debug.js');
