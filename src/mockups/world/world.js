// Art-direction mockup of the world (PRD §3–§5, §13.4, §17): the generated map with the starting zoo and a showcase
// of every v1 biome, the four sizes, fence wear, habitat levels, equipment, dirt, the keeper and the golf cart,
// under every time of day and weather. Dev-only page: http://localhost:5427/mockups/world/
//
// URL parameters for screenshots:
//   focus=overview|start|biomes|sizes|wear|upgrades|equipment|houses|keeper   biome=<id>  size=S|M|L|XL
//   wear=new|worn|broken  upgrade=0-3  time=dawn|day|dusk|night  weather=sun|rain|snow|heat  quality=low|medium|high
//   rot=0-3 (camera turn)  zoom=2 (closer)  grid=1  roofs=0|1 (default: off when close)  labels=0  ui=0
//   still=1 (frozen poses)  seed=<n>
// No game systems run here: nothing eats, wears down or gets dirty; the page only shows how things look.

import * as THREE from 'three';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { footprintRect } from '../../core/paths.js';
import { createStrings } from '../../core/strings.js';
import { QUALITY, QUALITY_NAMES, defaultQuality } from '../../data/quality.js';
import { BIOMES, ENCLOSURE_SIZES } from '../../data/world.js';
import { initPlatform, isTouch, reducedMotion } from '../../engine/platform.js';
import { createRenderer } from '../../engine/renderer.js';
import { animate, buildAnimal } from '../../scene/animals/index.js';
import { TIMES, WEATHERS, createAtmosphere } from '../../scene/world/atmosphere.js';
import { buildWorldScene, groundY, TILE } from '../../scene/world/index.js';
import { createWorldMaterials } from '../../scene/world/kit.js';
import { animateKeeper, buildCart, buildKeeper } from '../../scene/world/people.js';
import { paintSignTexture } from '../../scene/world/sign.js';
import { FENCE_WEAR, MOCKUP_SEED, UPGRADE_LEVELS, sectionBounds, showcaseWorld } from './layout.js';

const params = new URLSearchParams(location.search);
const { t } = createStrings('en');
const V1_BIOMES = BIOMES.filter((b) => b.v1).map((b) => b.id);
const SIZES = Object.keys(ENCLOSURE_SIZES);
const STOPS = ['overview', 'start', 'biomes', 'sizes', 'wear', 'upgrades', 'equipment', 'houses', 'keeper'];
const STOP_NAMES = { overview: 'Overview', start: 'Start', biomes: 'Biomes', sizes: 'Sizes', wear: 'Wear & dirt', upgrades: 'Levels', equipment: 'Equipment', houses: 'Houses', keeper: 'Keeper & cart' };
const TIME_NAMES = { dawn: 'Dawn', day: 'Day', dusk: 'Dusk', night: 'Night' };

const pick = (value, list, fallback) => (list.includes(value) ? value : fallback);
const state = {
  seed: Number(params.get('seed')) || MOCKUP_SEED,
  quality: pick(params.get('quality'), QUALITY_NAMES, defaultQuality(isTouch())),
  time: pick(params.get('time'), TIMES, 'day'),
  weather: pick(params.get('weather'), WEATHERS, 'sun'),
  grid: params.get('grid') === '1',
  labels: params.get('labels') !== '0',
  /** 'auto' takes roofs off when the camera is close; 'off' always hides them; 'on' always shows them. */
  roofs: { 0: 'off', 1: 'on' }[params.get('roofs')] ?? 'auto',
  /** What the camera is looking at: a stop, or one enclosure picked by biome, size, wear or level. */
  focus: 'overview',
  biome: null,
  size: null,
  wear: null,
  upgrade: null,
};
const reduced = reducedMotion();
const still = params.get('still') === '1';

initPlatform();

// ---- Scene ---------------------------------------------------------------------------------------------------------

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.3, 5000);
const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('view'));
const labelLayer = new CSS2DRenderer();
Object.assign(labelLayer.domElement.style, { position: 'fixed', inset: '0', pointerEvents: 'none' });
document.body.appendChild(labelLayer.domElement);

const zoo = showcaseWorld(state.seed);
if (zoo.invalid.length) console.warn('Showcase placements the rules rejected:', zoo.invalid);

/** Everything built for the current quality tier; rebuilt when the tier changes. */
let built = null;

function build() {
  const tier = QUALITY[state.quality];
  const materials = createWorldMaterials();
  const world = buildWorldScene({
    map: zoo.map,
    plots: zoo.world.plots,
    placements: zoo.placements,
    network: zoo.network,
    name: zoo.world.name,
    materials,
    detail: tier.detail,
    sign: paintSignTexture,
  });
  const atmosphere = createAtmosphere(scene, { ...tier, particles: { low: 1500, medium: 3000, high: 5000 }[state.quality] });
  const labels = new THREE.Group();
  const animals = [];
  for (const e of world.enclosures) {
    const p = e.placement;
    (p.residents ?? []).forEach((r, i) => {
      const spot = e.spots[i];
      if (!spot) return;
      const a = buildAnimal(r.species, { sex: r.sex, age: r.age, detail: tier.detail, cache: true, seed: p.id * 31 + i });
      a.group.position.set(spot.x, spot.y, spot.z);
      a.group.rotation.y = spot.yaw;
      world.group.add(a.group);
      animals.push({ ...a, pose: i % 3 === 1 ? 'eat' : 'idle', offset: i * 1.7 + p.id });
    });
    for (const l of labelsFor(e)) labels.add(l);
  }
  // The keeper walks the avenue; a second one waits in the cart by the storehouse.
  const keeper = buildKeeper(materials);
  const cart = buildCart(materials);
  const driver = buildKeeper(materials, { bucket: false });
  const cartAt = [122.6 * TILE, 229.5 * TILE];
  cart.group.position.set(cartAt[0], groundY(zoo.map, ...cartAt), cartAt[1]);
  cart.group.rotation.y = Math.PI * 0.92;
  driver.group.position.set(cart.seat.x, cart.seat.y - 0.45, cart.seat.z);
  cart.group.add(driver.group);
  world.group.add(keeper.group, cart.group);
  for (const [obj, key, y] of [[keeper.group, 'staff.keeper', 2.3], [cart.group, 'vehicle.golf-cart', 2.6]]) {
    const l = tag(t(key), 'tag small');
    l.position.y = y;
    l.userData.near = 40;
    obj.add(l);
  }
  scene.add(world.group, atmosphere.group, labels);
  built = { tier, materials, world, atmosphere, labels, animals, keeper, cart, driver };
  applyLook();
  world.terrain.uniforms.uGrid.value = state.grid ? 1 : 0;
}

function dispose() {
  if (!built) return;
  built.labels.traverse((o) => o.isCSS2DObject && o.element.remove());
  built.world.group.traverse((o) => o.isCSS2DObject && o.element.remove());
  scene.remove(built.world.group, built.atmosphere.group, built.labels);
  built.world.dispose();
  built.atmosphere.dispose();
  built.materials.dispose();
  built = null;
}

function tag(html, cls = 'tag') {
  const el = document.createElement('div');
  el.className = cls;
  el.innerHTML = html;
  return new CSS2DObject(el);
}

/** Labels over the showcase: what each enclosure shows, and the equipment's names. */
function labelsFor(e) {
  const p = e.placement;
  const out = [];
  let text = null;
  if (p.kind !== 'enclosure') text = t(`building.${p.kind}`);
  else if (p.section === 'sizes') text = `${t(`size.${p.size}`)} <small>${t('size.tag', { size: p.size, tiles: ENCLOSURE_SIZES[p.size] })}</small>`;
  else if (p.section === 'wear') text = t(`fence.${p.wear}`);
  else if (p.section === 'dirt') text = t('enclosure.dirty');
  else if (p.section === 'upgrades') text = t('habitat.level', { level: p.upgrade });
  else if (p.section === 'start') text = p.residents?.length ? t(`biome.${p.biome}`) : t('enclosure.empty');
  else text = t(`biome.${p.biome}`);
  if (text) {
    const l = tag(text);
    const r = footprintRect(p);
    l.position.copy(e.centre).add(new THREE.Vector3(0, p.kind === 'enclosure' ? Math.min(8, 2 + r.w * 0.35) : 9, 0));
    l.userData.near = 160;
    out.push(l);
  }
  if (p.section === 'equipment') {
    for (const eq of e.labels) {
      const l = tag(t(eq.key), 'tag small');
      l.position.set(eq.x, eq.y, eq.z);
      l.userData.near = 70;
      l.userData.small = true;
      out.push(l);
    }
  }
  return out;
}

/** Applies time of day and weather to the atmosphere, lamps, exposure and fill light. */
function applyLook() {
  const s = built.atmosphere.set({ time: state.time, weather: state.weather });
  built.world.lamps.setLevel(s.lamps);
  scene.environmentIntensity = s.env;
  syncButtons();
}

// ---- Camera: a 3/4 view that turns in 90° steps --------------------------------------------------------------------

const rig = {
  target: new THREE.Vector3(),
  dist: 400,
  yaw: Math.PI / 4,
  step: Number(params.get('rot')) % 4 || 0,
  goal: { target: new THREE.Vector3(), dist: 400 },
};
const MIN_DIST = 6;
const MAX_DIST = 620;
const yawOf = (step) => Math.PI / 4 + (step * Math.PI) / 2;
/** Steeper from far away: close views look across, the overview looks down. */
const pitchFor = (d) => THREE.MathUtils.lerp(0.62, 1.08, THREE.MathUtils.smoothstep(d, 25, 420));
rig.yaw = yawOf(rig.step);

function placeCamera() {
  const p = pitchFor(rig.dist);
  camera.position.set(
    rig.target.x + Math.sin(rig.yaw) * Math.cos(p) * rig.dist,
    rig.target.y + Math.sin(p) * rig.dist,
    rig.target.z + Math.cos(rig.yaw) * Math.cos(p) * rig.dist,
  );
  camera.lookAt(rig.target);
}

function flyTo(x, z, dist, now = false) {
  const zoom = Number(params.get('zoom')) || 1;
  rig.goal.target.set(x, groundY(zoo.map, x, z), z);
  rig.goal.dist = THREE.MathUtils.clamp(dist / zoom, MIN_DIST, MAX_DIST);
  if (now) {
    rig.target.copy(rig.goal.target);
    rig.dist = rig.goal.dist;
  }
}

const sectionCentre = (section) => {
  const b = sectionBounds(zoo.placements, section);
  return [b.x * TILE, b.z * TILE, b.radius * TILE];
};
const enclosureCentre = (p) => {
  const r = footprintRect(p);
  return [((r.x0 + r.x1) / 2) * TILE, ((r.z0 + r.z1) / 2) * TILE, r.w * TILE];
};

/** Focuses a stop by name. */
function focusOn(stop, now = false) {
  state.focus = stop;
  state.biome = state.size = state.wear = state.upgrade = null;
  if (stop === 'overview') flyTo(240 * TILE / 2, 205 * TILE, 560, now);
  else if (stop === 'houses') {
    const a = zoo.placements.find((p) => p.biome === 'reptile-house');
    const b = zoo.placements.find((p) => p.biome === 'aviary');
    const [ax, az] = enclosureCentre(a);
    const [bx, bz] = enclosureCentre(b);
    flyTo((ax + bx) / 2, (az + bz) / 2, 78, now);
  } else if (stop === 'keeper') flyTo(121.6 * TILE, 229.2 * TILE, 17, now);
  else {
    const [x, z, r] = sectionCentre(stop === 'wear' ? 'wear' : stop);
    const extra = stop === 'wear' ? 8 : 0;
    flyTo(x + extra, z, r * 2.3 + 14, now);
  }
  syncButtons();
}

/** Focuses one enclosure. */
function focusPlacement(p, now = false) {
  const [x, z, w] = enclosureCentre(p);
  flyTo(x, z, w * 1.55 + 10, now);
  state.focus = p.section;
}

function focusBiome(id, now) {
  const p = zoo.placements.find((q) => q.section === 'biomes' && q.biome === id);
  if (!p) return;
  focusPlacement(p, now);
  state.biome = id;
  state.size = state.wear = state.upgrade = null;
  syncButtons();
}
function focusSize(size, now) {
  const p = zoo.placements.find((q) => q.section === 'sizes' && q.size === size);
  if (!p) return;
  focusPlacement(p, now);
  state.size = size;
  state.biome = state.wear = state.upgrade = null;
  syncButtons();
}
function focusWear(wear, now) {
  const p = zoo.placements.find((q) => q.section === 'wear' && q.wear === wear);
  if (!p) return;
  focusPlacement(p, now);
  state.wear = wear;
  state.biome = state.size = state.upgrade = null;
  syncButtons();
}
function focusUpgrade(level, now) {
  const p = zoo.placements.find((q) => q.section === 'upgrades' && q.upgrade === level);
  if (!p) return;
  focusPlacement(p, now);
  state.upgrade = level;
  state.biome = state.size = state.wear = null;
  syncButtons();
}

function rotate(delta) {
  rig.step = (rig.step + delta + 4) % 4;
}

function zoomBy(k) {
  rig.goal.dist = THREE.MathUtils.clamp(rig.goal.dist * k, MIN_DIST, MAX_DIST);
}

/** Pans by screen-space amounts (pixels), along the ground as the camera sees it. */
function panBy(dx, dy) {
  const k = (rig.dist * 1.6) / innerHeight;
  const fx = -Math.sin(rig.yaw);
  const fz = -Math.cos(rig.yaw);
  const rx = Math.cos(rig.yaw);
  const rz = -Math.sin(rig.yaw);
  const sy = 1 / Math.sin(pitchFor(rig.dist));
  rig.goal.target.x += (-dx * rx + dy * fx * sy) * k;
  rig.goal.target.z += (-dx * rz + dy * fz * sy) * k;
  const max = zoo.map.size * TILE;
  rig.goal.target.x = THREE.MathUtils.clamp(rig.goal.target.x, 0, max);
  rig.goal.target.z = THREE.MathUtils.clamp(rig.goal.target.z, 0, max);
  rig.goal.target.y = groundY(zoo.map, rig.goal.target.x, rig.goal.target.z);
}

// ---- Input: mouse, touch, keyboard ---------------------------------------------------------------------------------

const pointers = new Map();
let pinch = 0;
let moved = 0;
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  moved = 0;
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch = Math.hypot(a.x - b.x, a.y - b.y);
  }
});
canvas.addEventListener('pointermove', (e) => {
  const prev = pointers.get(e.pointerId);
  if (!prev) return;
  const dx = e.clientX - prev.x;
  const dy = e.clientY - prev.y;
  prev.x = e.clientX;
  prev.y = e.clientY;
  moved += Math.abs(dx) + Math.abs(dy);
  if (pointers.size === 1) panBy(dx, dy);
  else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinch > 0) zoomBy(pinch / d);
    pinch = d;
  }
});
const release = (e) => {
  const wasTap = pointers.size === 1 && moved < 8;
  pointers.delete(e.pointerId);
  pinch = 0;
  if (wasTap && e.type === 'pointerup') pickAt(e.clientX, e.clientY);
};
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  zoomBy(Math.exp(e.deltaY * 0.0015));
}, { passive: false });

const raycaster = new THREE.Raycaster();
/** Clicking or tapping an enclosure focuses it. */
function pickAt(x, y) {
  raycaster.setFromCamera(new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1), camera);
  const groups = built.world.enclosures.filter((e) => e.placement.kind === 'enclosure').map((e) => e.group);
  const hit = raycaster.intersectObjects(groups, true)[0];
  if (!hit) return;
  const e = built.world.enclosures.find((en) => {
    let o = hit.object;
    while (o && o !== en.group) o = o.parent;
    return !!o;
  });
  if (e) focusPlacement(e.placement);
}

const held = new Set();
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  const cycle = (list, v) => list[(list.indexOf(v) + 1) % list.length];
  if (['w', 'a', 's', 'd'].includes(k)) held.add(k);
  else if (k === 'arrowright') focusOn(STOPS[(STOPS.indexOf(state.focus) + 1) % STOPS.length]);
  else if (k === 'arrowleft') focusOn(STOPS[(STOPS.indexOf(state.focus) + STOPS.length - 1) % STOPS.length]);
  else if (k === 'arrowup' || k === '+' || k === '=') zoomBy(0.8);
  else if (k === 'arrowdown' || k === '-') zoomBy(1.25);
  else if (k === '0') focusOn('overview');
  else if (k === 'q') rotate(-1);
  else if (k === 'e') rotate(1);
  else if (k === 'b') focusBiome(cycle(V1_BIOMES, state.biome));
  else if (k === 'z') focusSize(cycle(SIZES, state.size));
  else if (k === 'f') focusWear(cycle([...FENCE_WEAR], state.wear));
  else if (k === 'u') focusUpgrade(cycle(UPGRADE_LEVELS, state.upgrade ?? -1));
  else if (k === 't') setTime(cycle([...TIMES], state.time));
  else if (k === 'y') setWeather(cycle([...WEATHERS], state.weather));
  else if (k === 'g') toggle('grid');
  else if (k === 'r') toggle('roofs');
  else if (k === 'l') toggle('labels');
  else if (k === 'x') setQuality(cycle([...QUALITY_NAMES], state.quality));
  else if (k === 'h') togglePanel();
  else return;
  e.preventDefault();
});
addEventListener('keyup', (e) => held.delete(e.key.toLowerCase()));
addEventListener('blur', () => held.clear());

// ---- Panel ---------------------------------------------------------------------------------------------------------

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
const press = (id, isOn) => groups[id]?.forEach((b) => b.setAttribute('aria-pressed', String(isOn(b.dataset.key))));

function syncButtons() {
  const exact = state.biome || state.size || state.wear || state.upgrade !== null;
  press('focus', (k) => !exact && k === state.focus);
  press('biome', (k) => k === state.biome);
  press('size', (k) => k === state.size);
  press('wear', (k) => k === state.wear);
  press('upgrade', (k) => Number(k) === state.upgrade);
  press('time', (k) => k === state.time);
  press('weather', (k) => k === state.weather);
  press('quality', (k) => k === state.quality);
  press('view-buttons', (k) => (k === 'grid' ? state.grid : k === 'labels' ? state.labels : k === 'roofs' ? state.roofs === 'off' : false));
}

buttons('focus', STOPS.map((s) => [s, STOP_NAMES[s]]), (s) => focusOn(s));
buttons('biome', V1_BIOMES.map((b) => [b, t(`biome.${b}`)]), (b) => focusBiome(b));
buttons('size', SIZES.map((s) => [s, s]), (s) => focusSize(s));
buttons('wear', FENCE_WEAR.map((w) => [w, t(`fence.${w}`)]), (w) => focusWear(w));
buttons('upgrade', UPGRADE_LEVELS.map((l) => [l, t('habitat.level', { level: l })]), (l) => focusUpgrade(Number(l)));
buttons('time', TIMES.map((x) => [x, TIME_NAMES[x]]), (x) => setTime(x));
buttons('weather', WEATHERS.map((w) => [w, t(`weather.${w}`)]), (w) => setWeather(w));
buttons('view-buttons', [['left', '⟲ Turn'], ['right', 'Turn ⟳'], ['in', 'Zoom +'], ['out', 'Zoom −'], ['grid', 'Grid'], ['roofs', 'Roofs off'], ['labels', 'Labels']], (k) => {
  if (k === 'left') rotate(-1);
  else if (k === 'right') rotate(1);
  else if (k === 'in') zoomBy(0.75);
  else if (k === 'out') zoomBy(1.33);
  else toggle(k);
});
buttons('quality', QUALITY_NAMES.map((q) => [q, q[0].toUpperCase() + q.slice(1)]), (q) => setQuality(q));

const panel = document.getElementById('panel');
const togglePanel = () => panel.classList.toggle('hidden');
document.getElementById('toggle').addEventListener('click', togglePanel);
if (params.get('ui') === '0') {
  panel.classList.add('hidden');
  document.getElementById('toggle').style.display = 'none';
  document.getElementById('stats').style.display = 'none';
}

function setTime(x) {
  state.time = x;
  applyLook();
}
function setWeather(w) {
  state.weather = w;
  applyLook();
}
function toggle(what) {
  if (what === 'grid') {
    state.grid = !state.grid;
    built.world.terrain.uniforms.uGrid.value = state.grid ? 1 : 0;
  } else if (what === 'labels') state.labels = !state.labels;
  else if (what === 'roofs') state.roofs = state.roofs === 'off' ? 'auto' : 'off';
  syncButtons();
}
function setQuality(q) {
  state.quality = q;
  dispose();
  view.setQuality(q);
  build();
}

// ---- Loop ----------------------------------------------------------------------------------------------------------

const stats = document.getElementById('stats');
let fpsT = 0;
let fpsN = 0;
const tmp = new THREE.Vector3();
const frustum = new THREE.Frustum();
const projView = new THREE.Matrix4();
const sphere = new THREE.Sphere(new THREE.Vector3(), 4);
const KEEPER_WALK = { x: 120.5 * TILE, z0: 226.5 * TILE, z1: 235 * TILE, speed: 1.3 };

const view = createRenderer(canvas, {
  quality: state.quality,
  scene,
  camera,
  preserveDrawingBuffer: params.has('capture'),
  onFrame(dt, time) {
    const tt = still ? 2 : time;
    // Keys pan; the rig eases towards its goal and its turn.
    const pan = 500 * dt;
    if (held.has('w')) panBy(0, pan);
    if (held.has('s')) panBy(0, -pan);
    if (held.has('a')) panBy(pan, 0);
    if (held.has('d')) panBy(-pan, 0);
    const ease = 1 - Math.pow(0.0015, dt);
    rig.target.lerp(rig.goal.target, ease);
    rig.dist = Math.exp(THREE.MathUtils.lerp(Math.log(rig.dist), Math.log(rig.goal.dist), ease));
    const goalYaw = yawOf(rig.step);
    let dy = goalYaw - rig.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    rig.yaw += dy * ease;
    placeCamera();
    const b = built;
    b.atmosphere.update(camera, rig.target, rig.dist, time);
    b.world.terrain.uniforms.uPlotLines.value = state.grid ? 1 : THREE.MathUtils.smoothstep(rig.dist, 180, 380);
    // Roofs come off near a house, unless set on or off.
    b.world.setRoofs(state.roofs === 'auto' ? rig.dist > 110 : state.roofs === 'on');
    // No animal models in the overview (PRD §17.1), and none outside the view: skinned animals skip three's own
    // culling, so each one is checked against the camera's frustum here.
    frustum.setFromProjectionMatrix(projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const showAnimals = rig.dist < 260;
    for (const a of b.animals) {
      sphere.center.copy(a.group.position);
      a.group.visible = showAnimals && frustum.intersectsSphere(sphere);
      if (a.group.visible) animate(a.rig, a.pose, tt + a.offset, { reduced, blink: !still });
    }
    // The keeper walks up and down the avenue.
    const span = KEEPER_WALK.z1 - KEEPER_WALK.z0;
    const phase = ((tt * KEEPER_WALK.speed) / span) % 2;
    const back = phase > 1;
    const kz = KEEPER_WALK.z0 + (back ? 2 - phase : phase) * span;
    b.keeper.group.position.set(KEEPER_WALK.x, groundY(zoo.map, KEEPER_WALK.x, kz), kz);
    b.keeper.group.rotation.y = back ? Math.PI : 0;
    animateKeeper(b.keeper.rig, 'walk', tt);
    animateKeeper(b.driver.rig, 'sit', tt);
    // Labels show near the camera only.
    const near = rig.dist < 220;
    b.labels.visible = state.labels && near;
    b.labels.children.forEach((l) => (l.visible = camera.position.distanceTo(l.position) < (l.userData.small ? l.userData.near : Math.max(l.userData.near, rig.dist * 1.6))));
    b.world.group.traverse((o) => o.isCSS2DObject && (o.visible = state.labels && camera.position.distanceTo(o.getWorldPosition(tmp)) < o.userData.near));
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
    labelLayer.render(scene, camera);
  },
});
addEventListener('resize', () => labelLayer.setSize(innerWidth, innerHeight));
labelLayer.setSize(innerWidth, innerHeight);

build();
if (params.has('biome')) focusBiome(params.get('biome'), true);
else if (params.has('size')) focusSize(params.get('size'), true);
else if (params.has('wear')) focusWear(params.get('wear'), true);
else if (params.has('upgrade')) focusUpgrade(Number(params.get('upgrade')), true);
else focusOn(pick(params.get('focus'), STOPS, 'overview'), true);
rig.yaw = yawOf(rig.step);
placeCamera();

/**
 * What a frame costs, from renderer.info: draw calls and triangles per part (each part hidden in turn, so culling
 * and the shadow pass count as they really do), the shadow pass on its own, GPU memory and programs, and
 * milliseconds per frame. Timings wait for the GPU (gl.finish), so they mean something in a real browser.
 */
function perf(frames = 20) {
  const r = view.renderer;
  const gl = r.getContext();
  const b = built;
  const frame = () => {
    r.render(scene, camera);
    return { draws: r.info.render.calls, tris: r.info.render.triangles };
  };
  const byName = (...names) => {
    const out = [];
    b.world.group.traverse((o) => names.includes(o.name) && out.push(o));
    return out;
  };
  const things = b.world.group.getObjectByName('placements').children;
  const parts = {
    terrain: [b.world.terrain.group],
    trees: byName('trunks', 'crowns', 'pines'),
    rocks: byName('rocks'),
    paths: [b.world.paths].filter(Boolean),
    enclosures: things.filter((o) => o.name.startsWith('enclosure')),
    'gate, storehouse': things.filter((o) => !o.name.startsWith('enclosure')),
    lamps: [b.world.lamps.group],
    animals: b.animals.map((a) => a.group),
    'keeper, cart': [b.keeper.group, b.cart.group],
    'sky, weather': [b.atmosphere.sky, b.atmosphere.group.getObjectByName('stars'), b.atmosphere.group.getObjectByName('rain'), b.atmosphere.group.getObjectByName('snow')],
  };
  const total = frame();
  r.shadowMap.autoUpdate = false;
  const main = frame();
  r.shadowMap.autoUpdate = true;
  const breakdown = {};
  for (const [name, objs] of Object.entries(parts)) {
    const was = objs.map((o) => o.visible);
    objs.forEach((o) => (o.visible = false));
    const without = frame();
    objs.forEach((o, i) => (o.visible = was[i]));
    breakdown[name] = { draws: total.draws - without.draws, tris: total.tris - without.tris };
  }
  const time = (fn) => {
    fn();
    gl.finish();
    const t0 = performance.now();
    for (let i = 0; i < frames; i++) fn();
    gl.finish();
    return +((performance.now() - t0) / frames).toFixed(2);
  };
  const ms = { render: time(() => r.render(scene, camera)) };
  r.shadowMap.autoUpdate = false;
  ms.renderNoShadowPass = time(() => r.render(scene, camera));
  r.shadowMap.autoUpdate = true;
  const size = r.getDrawingBufferSize(new THREE.Vector2());
  return {
    quality: state.quality,
    focus: state.focus,
    distance: Math.round(rig.dist),
    canvas: `${size.x}×${size.y} (dpr ${r.getPixelRatio()})`,
    total,
    mainPass: main,
    shadowPass: { draws: total.draws - main.draws, tris: total.tris - main.tris },
    breakdown,
    memory: { ...r.info.memory, programs: r.info.programs.length },
    ms,
  };
}

// Console helpers for agents and screenshots.
Object.assign(globalThis, {
  __step: (n = 1) => view.step(n),
  __world: {
    state,
    rig,
    zoo,
    focusOn,
    focusBiome,
    focusSize,
    focusWear,
    focusUpgrade,
    rotate,
    setTime,
    setWeather,
    setQuality,
    perf,
    built: () => built,
  },
});
