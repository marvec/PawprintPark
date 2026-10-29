// Experiment mockup: single-mesh animals (src/scene/animals/mesh/) next to the current builder. Dev-only page:
// http://localhost:5428/mockups/single-mesh/
//
// URL parameters: species=<id>|all, view=game|side|front, pose=idle|walk|eat|sleep, builder=both|old|new,
// quality=low|medium|high, sex=male|female (one adult), babies=0, zoom=2, wire=1, still=1 (frozen pose, eyes open),
// seeds=4 (that many single-mesh individuals per variant, seeds 1…n: the coat varies, the geometry is shared),
// ui=0 (hide the panel).

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { PALETTE } from '../data/palette.js';
import { QUALITY, QUALITY_NAMES, defaultQuality } from '../data/quality.js';
import { SPECIES_BY_ID } from '../data/species.js';
import { initPlatform, isTouch, reducedMotion } from '../engine/platform.js';
import { createRenderer } from '../engine/renderer.js';
import * as current from '../scene/animals/index.js';
import * as single from '../scene/animals/mesh/index.js';
import { detail } from '../scene/animals/shapes.js';
import { buildLights, buildMeadow, buildSky } from '../scene/backdrop.js';

const SPECIES = single.MESH_SPECIES;
// species=all would be 30 rows; the overview starts with the first experiment's four (the arrows reach the rest).
const FIRST = ['lion', 'plains-zebra', 'reticulated-giraffe', 'asian-elephant'];
/** Both sexes where they look different, plus the baby. */
const VARIANTS = Object.fromEntries(SPECIES.map((id) => [id, [...(current.isDimorphic(id) ? [['male', 'adult']] : []), ['female', 'adult'], ['female', 'baby']]]));
const VIEWS = { game: [0.55, 0.75, 1], side: [0, 0.08, 1], front: [0, 0.12, 1] };

const params = new URLSearchParams(location.search);
const state = {
  species: SPECIES.includes(params.get('species')) ? params.get('species') : 'all',
  view: VIEWS[params.get('view')] ? params.get('view') : 'game',
  pose: single.POSES.includes(params.get('pose')) ? params.get('pose') : 'idle',
  builder: ['old', 'new'].includes(params.get('builder')) ? params.get('builder') : 'both',
  quality: QUALITY_NAMES.includes(params.get('quality')) ? params.get('quality') : defaultQuality(isTouch()),
  wire: params.get('wire') === '1',
};
const still = params.get('still') === '1';
const reduced = reducedMotion();
initPlatform();

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(PALETTE.fog, 60, 190);
scene.add(buildSky());
scene.add(buildMeadow({ seed: 7, clearRadius: 30, trees: 50 }).group);
let lights = buildLights({ extent: 20, ...QUALITY[state.quality] });
scene.add(lights.group);
const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 900);
const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('view'));
const labels = new CSS2DRenderer();
Object.assign(labels.domElement.style, { position: 'fixed', inset: '0', pointerEvents: 'none' });
document.body.appendChild(labels.domElement);

const materials = {
  old: current.createAnimalMaterial(),
  new: single.createMeshAnimalMaterial(),
  wire: Object.assign(single.createMeshAnimalMaterial(), { wireframe: true }),
};
const lineup = new THREE.Group();
scene.add(lineup);
/** @type {{ kind: 'old'|'new', rig: object, id: string, sex: string, age: string, tris: number }[]} */
let animals = [];
const box = new THREE.Box3();

function tag(html, cls = 'tag') {
  const el = document.createElement('div');
  el.className = cls;
  el.innerHTML = html;
  return new CSS2DObject(el);
}

function clear() {
  lineup.traverse((o) => {
    if (o.isCSS2DObject) o.element.remove();
  });
  lineup.clear();
  animals = [];
}

/** Builds the selected species: pairs of current (left) and single-mesh (right), species in rows. */
function build() {
  clear();
  const q = QUALITY[state.quality];
  detail.level = q.detail;
  const ids = state.species === 'all' ? FIRST : [state.species];
  let z = 0;
  for (const id of ids) {
    let variants = VARIANTS[id];
    if (params.get('babies') === '0') variants = variants.filter(([, age]) => age === 'adult');
    if (params.has('sex')) variants = variants.filter(([sx, age]) => age === 'adult' && sx === params.get('sex')).slice(0, 1);
    const items = [];
    const seeds = Number(params.get('seeds')) || 0;
    const runs = seeds ? Array.from({ length: seeds }, (_, i) => ['new', i + 1]) : [['old'], ['new']];
    for (const [sex, age] of variants) {
      for (const [kind, seed] of runs) {
        if (!seeds && state.builder !== 'both' && state.builder !== kind) continue;
        const a =
          kind === 'old'
            ? current.buildAnimal(id, { sex, age, material: materials.old })
            : single.buildAnimal(id, { sex, age, seed, detail: q.detail, cache: true, material: state.wire ? materials.wire : materials.new });
        if (state.view === 'side') a.group.rotation.y = Math.PI / 2;
        (kind === 'old' ? current.animate : single.animate)(a.rig, 'idle', 1, { blink: false });
        a.group.updateMatrixWorld(true);
        a.group.traverse((o) => o.isSkinnedMesh && o.computeBoundingBox());
        box.setFromObject(a.group);
        const size = box.getSize(new THREE.Vector3());
        let tris = 0;
        a.group.traverse((o) => o.isMesh && (tris += (o.geometry.index ? o.geometry.index.count : o.geometry.getAttribute('position').count) / 3));
        items.push({ a, kind, sex, age, w: size.x, d: size.z, h: size.y, cx: (box.min.x + box.max.x) / 2 - a.group.position.x, tris });
        animals.push({ kind, rig: a.rig, id, sex, age, tris });
      }
    }
    // Lay the row out along x.
    let x = 0;
    const depth = Math.max(...items.map((i) => i.d));
    const gap = Math.max(0.3, Math.max(...items.map((i) => i.w)) * 0.25);
    for (const it of items) {
      it.a.group.position.set(x + it.w / 2 - it.cx, 0, z - depth / 2);
      x += it.w + gap;
      lineup.add(it.a.group);
      const who = it.age === 'baby' ? 'baby' : VARIANTS[id].length > 1 && it.sex === 'male' ? '♂' : VARIANTS[id].filter(([, a]) => a === 'adult').length > 1 ? '♀' : 'adult';
      const label = tag(`${it.kind === 'old' ? 'current' : 'single mesh'} <small>${who} · ${(it.tris / 1000).toFixed(1)}k</small>`);
      label.position.set(it.a.group.position.x, it.h + 0.15, z - depth / 2);
      lineup.add(label);
    }
    const width = x - gap;
    for (const o of lineup.children) if (o.userData.row === undefined) o.userData.row = id;
    for (const o of lineup.children) if (o.userData.row === id) o.position.x -= width / 2;
    const sign = tag(`${SPECIES_BY_ID[id]?.name ?? id}`, 'sign');
    sign.position.set(-width / 2 - 0.6, 0.3, z - depth / 2);
    sign.userData.row = id;
    lineup.add(sign);
    z -= depth + 2;
  }
  frame();
}

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;

/** Frames the lineup from the chosen direction. */
function frame() {
  lineup.updateMatrixWorld(true);
  const b = new THREE.Box3();
  lineup.traverse((o) => {
    if (o.isMesh) {
      if (o.isSkinnedMesh) o.computeBoundingBox();
      b.expandByObject(o);
    }
  });
  const c = b.getCenter(new THREE.Vector3());
  const s = b.getSize(new THREE.Vector3());
  const dir = new THREE.Vector3(...VIEWS[state.view]).normalize();
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const aspect = innerWidth / innerHeight;
  const fitH = (s.y * 0.5) / Math.tan(fov / 2);
  const fitW = (Math.max(s.x, state.view === 'game' ? s.z * 0.6 : 0) * 0.5) / (Math.tan(fov / 2) * aspect);
  const dist = (Math.max(fitH, fitW) * 1.12 + s.z * 0.5) / (Number(params.get('zoom')) || 1);
  controls.target.copy(c);
  camera.position.copy(c).addScaledVector(dir, dist);
  controls.update();
}

// ---- UI ------------------------------------------------------------------------------------------------------------

const groups = {};
function buttons(id, items, onClick) {
  const el = document.getElementById(id);
  groups[id] = items.map(([key, label]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.dataset.key = key;
    b.addEventListener('click', () => onClick(key));
    el.appendChild(b);
    return b;
  });
}
function sync() {
  const press = (id, on) => groups[id].forEach((b) => b.setAttribute('aria-pressed', String(on(b.dataset.key))));
  press('species', (k) => k === state.species);
  press('views', (k) => k === state.view);
  press('poses', (k) => k === state.pose);
  press('builders', (k) => k === state.builder || (k === 'wire' && state.wire));
  press('quality', (k) => k === state.quality);
}
const set = (k, v, rebuild = true) => {
  state[k] = v;
  if (rebuild) build();
  sync();
};
buttons('species', [['all', 'All'], ...SPECIES.map((id) => [id, SPECIES_BY_ID[id]?.name ?? id])], (k) => set('species', k));
buttons('views', [['game', 'In-game'], ['side', 'Side'], ['front', 'Front']], (k) => set('view', k));
buttons('poses', single.POSES.map((p) => [p, p[0].toUpperCase() + p.slice(1)]), (k) => set('pose', k, false));
buttons('builders', [['both', 'Both'], ['old', 'Current'], ['new', 'Single mesh'], ['wire', 'Wireframe']], (k) => (k === 'wire' ? set('wire', !state.wire) : set('builder', k)));
buttons('quality', QUALITY_NAMES.map((q) => [q, q[0].toUpperCase() + q.slice(1)]), (k) => setQuality(k));

const panel = document.getElementById('panel');
const togglePanel = () => panel.classList.toggle('hidden');
document.getElementById('toggle').addEventListener('click', togglePanel);
if (params.get('ui') === '0') panel.classList.add('hidden');

function setQuality(q) {
  state.quality = q;
  view.setQuality(q);
  scene.remove(lights.group);
  lights = buildLights({ extent: 20, ...QUALITY[q] });
  scene.add(lights.group);
  build();
  sync();
}

addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  const list = ['all', ...SPECIES];
  if (k >= '1' && k <= '4') set('pose', single.POSES[Number(k) - 1], false);
  else if (k === 'arrowright' || k === 'arrowleft') set('species', list[(list.indexOf(state.species) + (k === 'arrowright' ? 1 : list.length - 1)) % list.length]);
  else if (k === 'v') set('view', Object.keys(VIEWS)[(Object.keys(VIEWS).indexOf(state.view) + 1) % 3]);
  else if (k === 'b') set('builder', { both: 'old', old: 'new', new: 'both' }[state.builder]);
  else if (k === 'w') set('wire', !state.wire);
  else if (k === 'q') setQuality(QUALITY_NAMES[(QUALITY_NAMES.indexOf(state.quality) + 1) % QUALITY_NAMES.length]);
  else if (k === 'h') togglePanel();
  else return;
  e.preventDefault();
});

// ---- Loop ----------------------------------------------------------------------------------------------------------

const stats = document.getElementById('stats');
let fpsT = 0;
let fpsN = 0;
const view = createRenderer(canvas, {
  quality: state.quality,
  scene,
  camera,
  onFrame(dt, t) {
    for (const a of animals) (a.kind === 'old' ? current.animate : single.animate)(a.rig, state.pose, still ? 1 : t, { reduced, blink: !still });
    controls.update();
    fpsN++;
    fpsT += dt;
    if (fpsT > 0.5) {
      const info = view.renderer.info.render;
      stats.textContent = `${Math.round(fpsN / fpsT)} fps · ${info.calls} draws · ${(info.triangles / 1000).toFixed(0)}k tris · ${state.quality}`;
      fpsT = 0;
      fpsN = 0;
    }
  },
  render(renderer) {
    renderer.render(scene, camera);
    labels.render(scene, camera);
  },
});
addEventListener('resize', () => {
  labels.setSize(innerWidth, innerHeight);
  frame();
});
labels.setSize(innerWidth, innerHeight);
build();
sync();

Object.assign(globalThis, {
  __step: (n = 1) => view.step(n),
  __single: {
    state,
    build,
    animals: () => animals.map(({ kind, id, sex, age, tris, rig }) => ({ kind, id, sex, age, tris, ms: rig.stats?.ms })),
    calls: () => view.renderer.info.render.calls,
  },
});
