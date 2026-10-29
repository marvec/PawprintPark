// The WebGL renderer: quality tiers, resizing, context loss, and pausing in the background.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { QUALITY } from '../data/quality.js';
import { onAppState } from './platform.js';

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ quality: keyof typeof QUALITY, onFrame: (dt: number, t: number) => void, render: () => void,
 *   camera: THREE.PerspectiveCamera, scene: THREE.Scene, preserveDrawingBuffer?: boolean }} opts
 */
export function createRenderer(canvas, opts) {
  let tier = QUALITY[opts.quality];
  let renderer = make();
  let running = true;
  let lost = false;
  let last = performance.now();
  let t = 0;
  let raf = 0;

  function make() {
    const r = new THREE.WebGLRenderer({
      canvas,
      antialias: tier.antialias,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: !!opts.preserveDrawingBuffer,
    });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = tier.shadows;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, tier.maxDpr));
    // Soft image-based fill light without an HDR file.
    const pmrem = new THREE.PMREMGenerator(r);
    opts.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    opts.scene.environmentIntensity = 0.35;
    pmrem.dispose();
    return r;
  }

  function resize() {
    const w = canvas.clientWidth || globalThis.innerWidth;
    const h = canvas.clientHeight || globalThis.innerHeight;
    renderer.setSize(w, h, false);
    opts.camera.aspect = w / h;
    opts.camera.updateProjectionMatrix();
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    // Clamp dt: the first timestamp can precede performance.now(), and a long stall must not teleport anything.
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    if (!running || lost) return;
    step(dt);
  }

  function step(dt) {
    t += dt;
    opts.onFrame(dt, t);
    opts.render(renderer);
  }

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    lost = true;
  });
  canvas.addEventListener('webglcontextrestored', () => {
    renderer.dispose();
    renderer = make();
    resize();
    lost = false;
  });
  globalThis.addEventListener('resize', resize);
  onAppState((active) => {
    running = active;
    last = performance.now();
  });

  resize();
  raf = requestAnimationFrame(frame);

  return {
    get renderer() {
      return renderer;
    },
    get tier() {
      return tier;
    },
    /** Switches quality; shadows and pixel ratio need a fresh renderer state. */
    setQuality(name) {
      tier = QUALITY[name];
      renderer.dispose();
      renderer = make();
      resize();
    },
    /** Advances by hand (background tabs pause requestAnimationFrame; agents drive the page this way). */
    step(frames = 1) {
      for (let i = 0; i < frames; i++) step(1 / 60);
    },
    stop() {
      cancelAnimationFrame(raf);
      renderer.dispose();
    },
  };
}
