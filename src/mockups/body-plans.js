// Art-direction mockup: every v1 body plan and species in the summer-afternoon look (PRD §17).
// Dev-only page: http://localhost:5427/mockups/body-plans/
//
// URL parameters for screenshots: ?pose=walk&focus=cat&species=plains-zebra&quality=low&scale=uniform&flat=1&babies=0&ui=0
// Close-ups: species=<id> plus view=side|front, only=<id> (hide other species), sex=male|female (one adult),
// zoom=2, still=1 (frozen pose, eyes open). builder=single|current: the single-mesh builder (src/scene/animals/mesh/,
// experiment) or the current one; /mockups/single-mesh/plans/ opens with the single mesh. Species the single-mesh
// builder can't make yet fall back to the current builder (their labels say so).

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { PALETTE } from '../data/palette.js';
import { QUALITY, QUALITY_NAMES, defaultQuality } from '../data/quality.js';
import { SPECIES_BY_ID } from '../data/species.js';
import { initPlatform, isTouch, reducedMotion } from '../engine/platform.js';
import { createRenderer } from '../engine/renderer.js';
import { LOOKS, POSES, V1_PLANS, animate as animateCurrent, buildAnimal as buildCurrent, createAnimalMaterial, isDimorphic } from '../scene/animals/index.js';
import * as single from '../scene/animals/mesh/index.js';
import { detail } from '../scene/animals/shapes.js';
import { buildLights, buildMeadow, buildSky } from '../scene/backdrop.js';

const PLAN_NAMES = {
  hoof: ['hoof', 'Hoofed animals'],
  cat: ['cat', 'Big cats'],
  dog: ['dog', 'Dogs and foxes'],
  bear: ['bear', 'Bears'],
  small: ['small', 'Small mammals'],
  pachy: ['pachy', 'Elephants and tapirs'],
  pinniped: ['pinniped', 'Seals and sea lions'],
  'bird-walk': ['bird-walk', 'Walking birds'],
  'bird-perch': ['bird-perch', 'Perching birds'],
  penguin: ['penguin', 'Penguins'],
  lizard: ['lizard', 'Lizards'],
  turtle: ['turtle', 'Tortoises'],
};

const params = new URLSearchParams(location.search);
const state = {
  pose: POSES.includes(params.get('pose')) ? params.get('pose') : 'idle',
  scale: params.get('scale') === 'uniform' ? 'uniform' : 'true',
  flat: params.get('flat') === '1',
  babies: params.get('babies') !== '0',
  turntable: false,
  quality: QUALITY_NAMES.includes(params.get('quality')) ? params.get('quality') : defaultQuality(isTouch()),
  focus: -1, // -1 = overview, otherwise an index into V1_PLANS
  builder: params.get('builder') === 'single' || (!params.has('builder') && location.pathname.includes('single-mesh')) ? 'single' : 'current',
};
const reduced = reducedMotion();
const still = params.get('still') === '1';
/** ?only=<species id>: show just that species (clean side views). */
const only = LOOKS[params.get('only')] ? params.get('only') : null;

initPlatform();

// ---- Scene ---------------------------------------------------------------------------------------------------------

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(PALETTE.fog, 60, 190);
scene.add(buildSky());
scene.add(buildMeadow({ seed: 7, clearRadius: 48, trees: 70 }).group);
let lights = buildLights({ extent: 45, ...QUALITY[state.quality] });
scene.add(lights.group);

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 900);
camera.position.set(0, 22, 46);

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('view'));
const labels = new CSS2DRenderer();
Object.assign(labels.domElement.style, { position: 'fixed', inset: '0', pointerEvents: 'none' });
document.body.appendChild(labels.domElement);

const materials = {
  smooth: createAnimalMaterial(),
  flat: createAnimalMaterial({ flat: true }),
  single: single.createMeshAnimalMaterial(),
  singleFlat: single.createMeshAnimalMaterial({ flat: true }),
};

/** Builds with the chosen builder; the single mesh falls back to the current builder for species it can't make. */
function buildAnimal(id, opts) {
  if (state.builder === 'single' && single.MESH_SPECIES.includes(id)) {
    const material = state.flat ? materials.singleFlat : materials.single;
    const a = single.buildAnimal(id, { ...opts, material, detail: QUALITY[state.quality].detail, cache: true });
    return { ...a, single: true };
  }
  return { ...buildCurrent(id, opts), single: false };
}
const animate = (rig, ...rest) => (rig.kind?.startsWith('mesh-') ? single.animate : animateCurrent)(rig, ...rest);
const lineup = new THREE.Group();
scene.add(lineup);
/** @type {{ rig: object }[]} */
let animals = [];
/** @type {{ plan: string, center: THREE.Vector3, radius: number }[]} */
let rows = [];
/** Species labels fade out with distance so the overview stays readable; row signs always show. */
let speciesLabels = [];
/** Where each species' cluster stands, for close-ups: id → { center, radius }. */
let spots = {};

function triangles(group) {
  let n = 0;
  group.traverse((o) => o.isMesh && (n += (o.geometry.index ? o.geometry.index.count : o.geometry.getAttribute('position').count) / 3));
  return n;
}

function disposeLineup() {
  lineup.traverse((o) => {
    // Single-mesh geometry is cached and shared between rebuilds.
    if (o.isMesh && o.geometry && !o.isSkinnedMesh) o.geometry.dispose();
    if (o.isCSS2DObject) o.element.remove();
  });
  lineup.clear();
  animals = [];
  rows = [];
  speciesLabels = [];
  spots = {};
}

function tag(html, cls) {
  const el = document.createElement('div');
  el.className = cls;
  el.innerHTML = html;
  return new CSS2DObject(el);
}

/** Lays the body plans out as rows, front to back; species side by side; variants grouped. */
function buildLineup() {
  disposeLineup();
  detail.level = QUALITY[state.quality].detail;
  const material = state.flat ? materials.flat : materials.smooth;
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  let z = 0;
  for (const plan of V1_PLANS) {
    const ids = Object.keys(LOOKS).filter((id) => LOOKS[id].plan === plan && (!only || id === only));
    if (!ids.length) continue;
    const clusters = [];
    let rowDepth = 0;
    for (const id of ids) {
      const variants = isDimorphic(id) ? [['male', 'adult'], ['female', 'adult']] : [['female', 'adult']];
      if (state.babies) variants.push(['female', 'baby']);
      // ?sex=male|female keeps just that adult (close-ups of one animal).
      if (params.has('sex')) variants.splice(0, variants.length, ...variants.filter(([sx, age]) => age === 'adult' && sx === params.get('sex')).slice(0, 1));
      if (!variants.length) variants.push(['female', 'adult']);
      const members = variants.map(([sex, age]) => {
        const a = buildAnimal(id, { sex, age, material });
        // Side views turn the animals to face right, so the row shows their profiles.
        if (params.get('view') === 'side') a.group.rotation.y = Math.PI / 2;
        animate(a.rig, 'idle', 0);
        a.group.updateMatrixWorld(true);
        box.setFromObject(a.group);
        box.getSize(size);
        if (state.scale === 'uniform') {
          const k = (age === 'baby' ? 0.75 : 1.3) / Math.max(size.y, size.z * 0.55);
          a.group.scale.multiplyScalar(k);
          size.multiplyScalar(k);
        }
        rowDepth = Math.max(rowDepth, size.z);
        return { a, sex, age, w: Math.max(size.x, size.z * 0.42), h: size.y, tris: triangles(a.group) };
      });
      clusters.push({ id, members, fallback: members.some((m) => !m.a.single) && state.builder === 'single' });
    }

    // Place clusters left to right, then centre the row.
    const items = [];
    let x = 0;
    for (const c of clusters) {
      const start = x;
      for (const m of c.members) {
        items.push({ m, x: x + m.w / 2 });
        x += m.w + Math.max(0.25, m.w * 0.25);
      }
      c.center = (start + x) / 2;
      c.top = Math.max(...c.members.map((m) => m.h));
      x += 1.2;
    }
    const width = x - 1.2;
    const rowZ = z - rowDepth / 2;
    for (const { m, x: px } of items) {
      m.a.group.position.set(px - width / 2, 0, rowZ);
      lineup.add(m.a.group);
      animals.push({ rig: m.a.rig });
    }
    for (const c of clusters) {
      const sp = SPECIES_BY_ID[c.id];
      const kinds = c.members.map((m) => (m.age === 'baby' ? 'baby' : m.sex === 'male' ? '♂' : isDimorphic(c.id) ? '♀' : 'adult')).join(' · ');
      const tris = c.members.map((m) => `${(m.tris / 1000).toFixed(1)}k`).join(' · ');
      const label = tag(`${sp.name} <small>${kinds}${c.fallback ? ' · current builder' : ''}${params.get('tris') === '1' ? `<br>${tris} tris` : ''}</small>`, 'tag');
      speciesLabels.push(label);
      label.position.set(c.center - width / 2, c.top + 0.35, rowZ);
      lineup.add(label);
      const span = c.members.reduce((n, m) => n + m.w * 1.25, 0);
      spots[c.id] = { center: new THREE.Vector3(c.center - width / 2, c.top * 0.45, rowZ), radius: Math.max(span, c.top) / 2 };
    }
    // A sandy strip under the row and a sign at its left end.
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(width + 3, rowDepth + 1.4).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: PALETTE.path, roughness: 1 }),
    );
    strip.position.set(0, 0.012, rowZ);
    strip.receiveShadow = true;
    lineup.add(strip);
    const [code, title] = PLAN_NAMES[plan];
    const sign = tag(`${title}<small>${code} · ${ids.length} species</small>`, 'sign');
    sign.position.set(-width / 2 - 2.2, 0.5, rowZ);
    lineup.add(sign);

    rows.push({ plan, center: new THREE.Vector3(0, 0.6, rowZ), radius: Math.max(width / 2 + 1.5, rowDepth) });
    z -= rowDepth + 4.5;
  }
  // Centre the whole lineup on the origin.
  const shift = -z / 2;
  lineup.position.z = shift;
  for (const r of rows) r.center.z += shift;
  for (const sp of Object.values(spots)) sp.center.z += shift;
}

// ---- Camera focus --------------------------------------------------------------------------------------------------

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.48;
controls.minDistance = 1;
controls.maxDistance = 180;
controls.autoRotateSpeed = 0.8;
let tween = null;
controls.addEventListener('start', () => (tween = null));

function focusOn(i) {
  state.focus = i;
  let target;
  let dist;
  if (i < 0 || !rows[i]) {
    target = new THREE.Vector3(0, 0, 0);
    dist = 78;
  } else {
    const r = rows[i];
    target = r.center.clone();
    dist = r.radius * 1.9 + 1.5;
  }
  const dir = new THREE.Vector3(0.3, i < 0 ? 0.9 : 0.62, 1).normalize();
  tween = { target, pos: target.clone().addScaledVector(dir, dist) };
  syncButtons();
}

/** Camera directions for close-ups (?view=): the in-game three-quarter angle, or straight on (side turns the animals). */
const VIEWS = { game: [0.55, 0.75, 1], side: [0, 0.12, 1], front: [0, 0.15, 1] };

/** Close-up of one species from a high three-quarter angle, like the in-game camera. */
function focusSpecies(id) {
  const sp = spots[id];
  if (!sp) return;
  state.focus = V1_PLANS.indexOf(LOOKS[id].plan);
  const dir = new THREE.Vector3(...(VIEWS[params.get('view')] ?? VIEWS.game)).normalize();
  // Front views aim at the face rather than the middle of the body.
  const target = sp.center.clone();
  if (params.get('view') === 'front') target.y *= 1.6;
  tween = { target, pos: target.clone().addScaledVector(dir, (sp.radius * 3.1 + 0.8) / (Number(params.get('zoom')) || 1)) };
  syncButtons();
}

// ---- UI ------------------------------------------------------------------------------------------------------------

/** @type {Record<string, HTMLButtonElement[]>} */
const groups = {};
function buttons(containerId, items, onClick) {
  const el = document.getElementById(containerId);
  groups[containerId] = items.map(([key, label]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.dataset.key = String(key);
    b.addEventListener('click', () => onClick(key));
    el.appendChild(b);
    return b;
  });
}
const press = (id, isOn) => groups[id].forEach((b) => b.setAttribute('aria-pressed', String(isOn(b.dataset.key))));

function syncButtons() {
  press('poses', (k) => k === state.pose);
  press('focus', (k) => Number(k) === state.focus);
  press('quality', (k) => k === state.quality);
  press('look', (k) => (k === 'scale' ? state.scale === 'uniform' : k === 'flat' ? state.flat : k === 'babies' ? state.babies : state.turntable));
  press('builder', (k) => k === state.builder);
}

buttons('poses', POSES.map((p) => [p, p[0].toUpperCase() + p.slice(1)]), (p) => {
  state.pose = p;
  syncButtons();
});
buttons('focus', [[-1, 'Overview'], ...V1_PLANS.map((p, i) => [i, PLAN_NAMES[p][0]])], (i) => focusOn(Number(i)));
buttons('look', [['scale', 'Same size'], ['flat', 'Faceted'], ['babies', 'Babies'], ['turntable', 'Turntable']], (k) => {
  if (k === 'scale') state.scale = state.scale === 'uniform' ? 'true' : 'uniform';
  if (k === 'flat') state.flat = !state.flat;
  if (k === 'babies') state.babies = !state.babies;
  if (k === 'turntable') state.turntable = !state.turntable;
  if (k !== 'turntable') rebuild();
  controls.autoRotate = state.turntable;
  syncButtons();
});
buttons('quality', QUALITY_NAMES.map((q) => [q, q[0].toUpperCase() + q.slice(1)]), (q) => setQuality(q));
buttons('builder', [['single', 'Single mesh'], ['current', 'Current']], (k) => {
  state.builder = k;
  rebuild();
  syncButtons();
});

const panel = document.getElementById('panel');
const togglePanel = () => panel.classList.toggle('hidden');
document.getElementById('toggle').addEventListener('click', togglePanel);
if (params.get('ui') === '0') panel.classList.add('hidden');

function rebuild() {
  const f = state.focus;
  buildLineup();
  focusOn(f);
}

function setQuality(q) {
  state.quality = q;
  view.setQuality(q);
  scene.remove(lights.group);
  lights = buildLights({ extent: 45, ...QUALITY[q] });
  scene.add(lights.group);
  rebuild();
}

addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k >= '1' && k <= '4') state.pose = POSES[Number(k) - 1];
  else if (k === 'arrowright') focusOn(Math.min(V1_PLANS.length - 1, state.focus + 1));
  else if (k === 'arrowleft') focusOn(Math.max(-1, state.focus - 1));
  else if (k === '0') focusOn(-1);
  else if (k === 'u') {
    state.scale = state.scale === 'uniform' ? 'true' : 'uniform';
    rebuild();
  } else if (k === 'f') {
    state.flat = !state.flat;
    rebuild();
  } else if (k === 'b') {
    state.babies = !state.babies;
    rebuild();
  } else if (k === 'm') {
    state.builder = state.builder === 'single' ? 'current' : 'single';
    rebuild();
  } else if (k === 'r') {
    state.turntable = !state.turntable;
    controls.autoRotate = state.turntable;
  } else if (k === 'q') setQuality(QUALITY_NAMES[(QUALITY_NAMES.indexOf(state.quality) + 1) % QUALITY_NAMES.length]);
  else if (k === 'h') togglePanel();
  else return;
  e.preventDefault();
  syncButtons();
});

// ---- Loop ----------------------------------------------------------------------------------------------------------

const stats = document.getElementById('stats');
let fpsT = 0;
let fpsN = 0;
const view = createRenderer(canvas, {
  quality: state.quality,
  scene,
  camera,
  preserveDrawingBuffer: params.has('capture'),
  onFrame(dt, t) {
    // ?still=1 freezes the pose with open eyes, so screenshots are repeatable.
    for (const a of animals) animate(a.rig, state.pose, still ? 1 : t, { reduced, blink: !still });
    if (tween) {
      controls.target.lerp(tween.target, 0.08);
      camera.position.lerp(tween.pos, 0.08);
      if (camera.position.distanceTo(tween.pos) < 0.05) tween = null;
    }
    controls.update();
    const p = new THREE.Vector3();
    for (const l of speciesLabels) l.visible = camera.position.distanceTo(l.getWorldPosition(p)) < 26;
    fpsN++;
    fpsT += dt;
    if (fpsT > 0.5) {
      const info = view.renderer.info.render;
      stats.textContent = `${Math.round(fpsN / fpsT)} fps · ${info.calls} draws · ${(info.triangles / 1000).toFixed(0)}k tris · ${animals.length} animals · ${state.quality} · ${state.builder === 'single' ? 'single mesh' : 'current builder'}`;
      fpsT = 0;
      fpsN = 0;
    }
  },
  render(renderer) {
    renderer.render(scene, camera);
    labels.render(scene, camera);
  },
});
addEventListener('resize', () => labels.setSize(innerWidth, innerHeight));
labels.setSize(innerWidth, innerHeight);

buildLineup();
const startFocus = V1_PLANS.indexOf(params.get('focus'));
focusOn(startFocus);
if (params.has('species')) focusSpecies(params.get('species'));
if (tween) {
  camera.position.copy(tween.pos);
  controls.target.copy(tween.target);
}
syncButtons();

// Console helpers for agents and screenshots.
Object.assign(globalThis, {
  __step: (n = 1) => view.step(n),
  __mockup: { state, focusOn, focusSpecies, setQuality, rebuild, animals: () => animals },
});
