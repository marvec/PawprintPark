// The UI mockup's static world backdrop: the approved world scene (milestone 2) seen from three fixed cameras, drawn
// only when something changes. It also projects world anchors (the keeper, animals, enclosures, the build ghost)
// to screen positions for the DOM layer, draws build-mode ghosts and work-zone outlines, and renders species
// portraits from the real animal models. Browser only.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { canPlace, footprintRect } from '../../core/paths.js';
import { QUALITY } from '../../data/quality.js';
import { SPECIES } from '../../data/species.js';
import { animate, buildAnimal, LOOKS } from '../../scene/animals/index.js';
import { createAtmosphere } from '../../scene/world/atmosphere.js';
import { buildWorldScene, groundY, TILE } from '../../scene/world/index.js';
import { createWorldMaterials } from '../../scene/world/kit.js';
import { animateKeeper, buildKeeper } from '../../scene/world/people.js';
import { paintSignTexture } from '../../scene/world/sign.js';
import { showcaseWorld } from '../world/layout.js';

/** The keeper's spot on the avenue, by the sheep (tiles). */
const KEEPER_AT = { x: 120.5, z: 228.5 };

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ quality: 'low' | 'medium' | 'high' }} opts
 */
export function createBackdrop(canvas, { quality }) {
  const tier = QUALITY[quality];
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: tier.antialias, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = tier.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, tier.maxDpr));

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.3, 5000);

  const zoo = showcaseWorld();
  const materials = createWorldMaterials();
  const world = buildWorldScene({ map: zoo.map, plots: zoo.world.plots, placements: zoo.placements, network: zoo.network, name: zoo.world.name, materials, detail: tier.detail, sign: paintSignTexture });
  const atmosphere = createAtmosphere(scene, { ...tier, particles: 0 });
  const look = atmosphere.set({ time: 'day', weather: 'sun' });
  world.lamps.setLevel(look.lamps);
  scene.environmentIntensity = look.env;
  scene.add(world.group, atmosphere.group);

  const kx = KEEPER_AT.x * TILE;
  const kz = KEEPER_AT.z * TILE;
  const keeper = buildKeeper(materials);
  keeper.group.position.set(kx, groundY(zoo.map, kx, kz), kz);
  keeper.group.rotation.y = -Math.PI / 2;
  animateKeeper(keeper.rig, 'idle', 1);
  world.group.add(keeper.group);

  // Animals, posed once (the backdrop never moves).
  const animals = [];
  for (const e of world.enclosures) {
    (e.placement.residents ?? []).forEach((r, i) => {
      const spot = e.spots[i];
      if (!spot) return;
      const a = buildAnimal(r.species, { sex: r.sex, age: r.age, detail: tier.detail, cache: true, seed: e.placement.id * 31 + i });
      a.group.position.set(spot.x, spot.y, spot.z);
      a.group.rotation.y = spot.yaw;
      animate(a.rig, i % 3 === 1 ? 'eat' : 'idle', 2 + i, { blink: false });
      world.group.add(a.group);
      animals.push({ group: a.group, enclosure: e.placement.id, species: r.species });
    });
  }

  const centreOf = (p) => {
    const r = footprintRect(p);
    const x = ((r.x0 + r.x1) / 2) * TILE;
    const z = ((r.z0 + r.z1) / 2) * TILE;
    return new THREE.Vector3(x, groundY(zoo.map, x, z), z);
  };
  const sheepPen = zoo.placements.find((p) => p.section === 'start' && p.residents?.length);
  const emptyPen = zoo.placements.find((p) => p.section === 'start' && p.kind === 'enclosure' && !p.residents?.length);
  const giraffes = zoo.placements.find((p) => p.section === 'biomes' && p.biome === 'african-savanna');

  // Views: near the keeper by the sheep, the overview for building, and a close shot for photo mode.
  const VIEWS = {
    near: { target: keeper.group.position.clone().lerp(centreOf(sheepPen), 0.4), dist: 30, pitch: 0.62 },
    far: { target: centreOf(sheepPen).add(new THREE.Vector3(-30, 0, -50)), dist: 300, pitch: 1.0 },
    photo: { target: centreOf(giraffes).add(new THREE.Vector3(0, 3, 4)), dist: 30, pitch: 0.3 },
  };
  let view = 'near';
  const farHome = VIEWS.far.target.clone();
  /** Build mode looks at what's being placed, from closer than the overview. */
  const focusFar = (p) => {
    VIEWS.far.target.set(p.x, p.y - 2, p.z);
    VIEWS.far.dist = 130;
  };

  // Build-mode ghosts and zone outlines live in one group that's rebuilt per screen.
  const overlay = new THREE.Group();
  scene.add(overlay);
  const overlayAnchors = {};

  /** A translucent slab with an outline over a footprint. */
  function slab(rect, color, { opacity = 0.32, height = 0.6 } = {}) {
    const w = (rect.x1 - rect.x0) * TILE;
    const d = (rect.z1 - rect.z0) * TILE;
    const cx = ((rect.x0 + rect.x1) / 2) * TILE;
    const cz = ((rect.z0 + rect.z1) / 2) * TILE;
    const y = groundY(zoo.map, cx, cz);
    const geo = new THREE.BoxGeometry(w, height, d);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
    mesh.position.set(cx, y + height / 2 + 0.12, cz);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color }));
    edges.position.copy(mesh.position);
    overlay.add(mesh, edges);
    return new THREE.Vector3(cx, y + height + 1, cz);
  }

  /** The first spot near the start where an M enclosure fits (`ok`), or where it's refused for blocking a path. */
  function findSpot(wantOk) {
    for (let dz = -20; dz <= 30; dz += 2) {
      for (let dx = -40; dx <= 40; dx += 2) {
        const c = { id: 9999, kind: 'enclosure', x: Math.round(KEEPER_AT.x) + dx, z: Math.round(KEEPER_AT.z) - 30 + dz, rot: 0, size: 'M' };
        const r = canPlace(zoo.map, zoo.world.plots, zoo.placements, c, zoo.network);
        if (wantOk ? r.ok : r.reason === 'path') return c;
      }
    }
    return null;
  }

  /** Scene extras for a screen: build ghosts, the selection, work zones. */
  function setScene(extra, zones = []) {
    for (const o of [...overlay.children]) {
      overlay.remove(o);
      o.geometry.dispose();
      o.material.dispose();
    }
    for (const k of Object.keys(overlayAnchors)) delete overlayAnchors[k];
    VIEWS.far.target.copy(farHome);
    VIEWS.far.dist = 300;
    if (extra === 'valid' || extra === 'invalid') {
      const c = findSpot(extra === 'valid');
      if (c) {
        overlayAnchors.ghost = slab(footprintRect(c), extra === 'valid' ? 0x4cc76a : 0xe2513c, { height: 2.2, opacity: 0.5 });
        focusFar(overlayAnchors.ghost);
      }
    } else if (extra === 'selected' || extra === 'sell') {
      overlayAnchors.selected = slab(footprintRect(emptyPen), 0x8fd3ff, { height: 2.4, opacity: 0.45 });
      focusFar(overlayAnchors.selected);
    } else if (extra === 'zones') {
      for (const z of zones) {
        for (const p of zoo.placements) if (p.kind === 'enclosure' && z.sections.includes(p.section)) slab(footprintRect(p), new THREE.Color(z.color).getHex(), { height: 0.8, opacity: z.id === 'farm' ? 0.45 : 0.22 });
      }
    }
  }

  function placeCamera() {
    const v = VIEWS[view];
    // Narrow (portrait) screens keep the keeper in the middle; wide ones also fit the sheep's pen.
    if (view === 'near') v.target.copy(keeper.group.position).lerp(centreOf(sheepPen), camera.aspect < 1 ? 0.12 : 0.4);
    const yaw = Math.PI / 4;
    camera.position.set(v.target.x + Math.sin(yaw) * Math.cos(v.pitch) * v.dist, v.target.y + Math.sin(v.pitch) * v.dist, v.target.z + Math.cos(yaw) * Math.cos(v.pitch) * v.dist);
    camera.lookAt(v.target);
    camera.near = THREE.MathUtils.clamp(v.dist * 0.03, 0.3, 20);
    camera.updateProjectionMatrix();
  }

  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function draw() {
    resize();
    placeCamera();
    const showAnimals = view !== 'far';
    for (const a of animals) a.group.visible = showAnimals;
    world.setRoofs(view === 'far');
    world.terrain.uniforms.uPlotLines.value = view === 'far' ? 0.6 : 0;
    atmosphere.update(camera, VIEWS[view].target, VIEWS[view].dist, 0);
    renderer.render(scene, camera);
  }

  // ---- Anchors -----------------------------------------------------------------------------------------------------

  const nearAnimals = () => {
    const k = keeper.group.position;
    return animals.filter((a) => a.group.position.distanceTo(k) < 40).sort((a, b) => a.group.position.distanceTo(k) - b.group.position.distanceTo(k));
  };

  /** World position of a named anchor, or null. */
  function anchorAt(name) {
    const [kind, arg] = name.split(':');
    if (kind === 'keeper') return keeper.group.position.clone().add(new THREE.Vector3(0, 1.0, 0));
    if (kind === 'keeper-head') return keeper.group.position.clone().add(new THREE.Vector3(0, 2.6, 0));
    if (kind === 'keeper-pen') return centreOf(sheepPen).add(new THREE.Vector3(2, 1, 3));
    if (kind === 'travel-target') return view === 'far' ? centreOf(giraffes).add(new THREE.Vector3(0, 4, 0)) : centreOf(emptyPen).add(new THREE.Vector3(0, 1.5, 0));
    if (kind === 'sheep-feeder') {
      const e = world.enclosures.find((x) => x.placement === sheepPen);
      const f = e?.labels.find((l) => l.key === 'equipment.feeder');
      return f ? new THREE.Vector3(f.x, f.y - 0.6, f.z) : centreOf(sheepPen);
    }
    if (kind === 'animal') {
      const list = view === 'photo' ? animals.filter((a) => a.enclosure === giraffes.id) : nearAnimals();
      const a = list[Number(arg)] ?? list[0];
      return a ? a.group.position.clone().add(new THREE.Vector3(0, 2.4, 0)) : null;
    }
    if (kind === 'enc') {
      const p = zoo.placements.find((x) => x.id === Number(arg));
      return p ? centreOf(p).add(new THREE.Vector3(0, 6, 0)) : null;
    }
    return overlayAnchors[kind]?.clone() ?? null;
  }

  const v3 = new THREE.Vector3();
  /** Screen position (CSS px within the canvas) of an anchor; `visible` is false behind the camera or off screen. */
  function project(name) {
    const p = anchorAt(name);
    if (!p) return null;
    v3.copy(p).project(camera);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const x = ((v3.x + 1) / 2) * w;
    const y = ((1 - v3.y) / 2) * h;
    return { x, y, visible: v3.z < 1 && x > -40 && y > -40 && x < w + 40 && y < h + 40 };
  }

  return {
    zoo,
    renderer,
    get view() {
      return view;
    },
    setView(v) {
      view = VIEWS[v] ? v : 'near';
    },
    setScene,
    draw,
    project,
    /** Draw calls and triangles of the last frame. */
    info: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, overlay: overlay.children.length, anchors: Object.fromEntries(Object.entries(overlayAnchors).map(([k, v]) => [k, v.toArray().map(Math.round)])) }),
  };
}

/**
 * Species portraits from the real models, in their own small WebGL canvas (so they work without the backdrop).
 * `portrait(id, { silhouette, size })` returns a PNG data URL, or null for a species whose body plan has no builder
 * yet (the page shows a paw instead).
 */
export function createPortraits() {
  const portraitCache = new Map();
  let portraitKit = null;
  const SPECIES_BY_ID = Object.fromEntries(SPECIES.map((s) => [s.id, s]));
  /** For species not built yet: a built species with the same body plan, drawn as a silhouette only. */
  const PLAN_STAND_IN = {};
  for (const id of Object.keys(LOOKS)) PLAN_STAND_IN[SPECIES_BY_ID[id].plan] ??= id;

  /**
   * A species portrait as a data URL: the real model at three-quarter view, or its silhouette. Species whose body
   * plan has no builder yet get null (the page shows a paw instead).
   */
  function portrait(id, { silhouette = false, size = 128 } = {}) {
    const key = `${id}|${silhouette}|${size}`;
    if (portraitCache.has(key)) return portraitCache.get(key);
    const built = LOOKS[id] ? id : PLAN_STAND_IN[SPECIES_BY_ID[id]?.plan];
    if (!built || (!LOOKS[id] && !silhouette)) {
      portraitCache.set(key, null);
      return null;
    }
    if (!portraitKit) {
      const c = document.createElement('canvas');
      const r = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true });
      r.outputColorSpace = THREE.SRGBColorSpace;
      r.toneMapping = THREE.NeutralToneMapping;
      const s = new THREE.Scene();
      s.add(new THREE.HemisphereLight(0xfff1d8, 0x9a8a60, 2.2));
      const sun = new THREE.DirectionalLight(0xffe6c0, 2.2);
      sun.position.set(3, 5, 4);
      s.add(sun);
      portraitKit = { renderer: r, scene: s, camera: new THREE.PerspectiveCamera(30, 1, 0.05, 100), dark: new THREE.MeshBasicMaterial({ color: 0x6b5a48 }) };
    }
    const { renderer: r, scene: s, camera: cam, dark } = portraitKit;
    r.setPixelRatio(1);
    r.setSize(size, size, false);
    const a = buildAnimal(built, { detail: 0.8, cache: true, seed: 7 });
    animate(a.rig, 'idle', 2, { blink: false });
    a.group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(a.group, true);
    const centre = box.getCenter(new THREE.Vector3());
    const extent = box.getSize(new THREE.Vector3());
    const radius = Math.max(extent.x, extent.y, extent.z) * 0.62;
    // Three-quarter front view, a little from above: how the game sees animals.
    const dir = new THREE.Vector3(0.62, 0.32, 1).normalize();
    cam.position.copy(centre).addScaledVector(dir, radius / Math.tan(THREE.MathUtils.degToRad(15)));
    cam.lookAt(centre);
    cam.near = radius * 0.1;
    cam.far = radius * 20;
    cam.updateProjectionMatrix();
    s.add(a.group);
    s.overrideMaterial = silhouette ? dark : null;
    r.setClearColor(0x000000, 0);
    r.render(s, cam);
    const url = r.domElement.toDataURL('image/png');
    s.remove(a.group);
    portraitCache.set(key, url);
    return url;
  }

  return { portrait };
}
