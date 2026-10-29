// Single-mesh animals (experiment): buildAnimal(id, { sex, age, seed, detail }) → { group, rig, look }.
// Each animal is ONE skinned mesh: a code-built quad cage (quadruped.js), Catmull-Clark subdivided (subdivide.js),
// skinned to a bone hierarchy, painted by the shared material (material.js). Pure: plain Object3D trees, no WebGL,
// no DOM. Geometry depends on species, sex, age and detail only; the seed shifts the coat pattern through the
// skeleton's seed bone, so geometry can be cached and shared between individuals.

import * as THREE from 'three';
import { hashString } from '../../../core/rng.js';
import { mergeLook, resolveLook } from '../index.js';
import { CHANNELS, Cage, v3 } from './cage.js';
import { MESH_LOOKS } from './looks.js';
import { createMeshAnimalMaterial } from './material.js';
import { PAT_NONE } from './material.js';
import { buildQuadCage } from './quadruped.js';
import { subdivide, toLimit } from './subdivide.js';

export { animate, POSES } from './animate.js';
export { createMeshAnimalMaterial } from './material.js';
export { MESH_LOOKS, MESH_SPECIES } from './looks.js';

/** Resolves the single-mesh extras for a sex and age (same override scheme as the species looks). */
export function resolveMeshLook(id, { sex = 'female', age = 'adult' } = {}) {
  const base = MESH_LOOKS[id];
  if (!base) throw new Error(`No single-mesh look for species "${id}"`);
  const { male, female, baby, ...rest } = base;
  let M = mergeLook(rest, sex === 'male' ? male : female);
  if (age === 'baby') {
    // Babies: no mane, bigger ears (as resolveLook does for the species looks).
    M = mergeLook({ ...M, mane: undefined }, baby);
    if (M.ears?.size) M.ears = { ...M.ears, size: M.ears.size * 1.25 };
  }
  return M;
}

/**
 * Detail → cage density and subdivision levels. Ring spacing is relative to the animal's size, so a giraffe and
 * a lion cub get about the same triangle count.
 */
export function detailSettings(look, detail = 1) {
  const size = look.body.l + look.legs.len * 0.5 + look.neck.len * 0.5;
  if (detail >= 0.9) return { levels: 2, step: size * 0.13, legStep: look.legs.len * 0.22 };
  if (detail >= 0.7) return { levels: 1, step: size * 0.034, legStep: look.legs.len * 0.042 };
  // Low: one subdivision step over a denser cage (moved to the limit surface, so the shape matches).
  return { levels: 1, step: size * 0.055, legStep: look.legs.len * 0.07 };
}

const hex = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

/**
 * Builds the shareable part of an animal: geometry with skin weights and paint, plus the bones' rest positions.
 * @returns {{ geometry: THREE.BufferGeometry, joints: Record<string, number[]>, parents: Record<string, string|null>, bones: string[], info: object, stats: object }}
 */
export function buildTemplate(id, { sex = 'female', age = 'adult', detail = 1 } = {}) {
  const t0 = performance.now();
  const look = resolveLook(id, { sex, age });
  const M = resolveMeshLook(id, { sex, age });
  const settings = detailSettings(look, detail);
  const { cage, joints, parents, info, eyes } = buildQuadCage(look, M, settings);
  let poly = cage.poly();
  let cageFaces = poly.faces.length;
  for (let i = 0; i < settings.levels; i++) poly = subdivide(poly);
  poly = toLimit(poly);
  const eyeCage = placeEyes(poly, cage, eyes, joints);
  cageFaces += eyeCage.faces.length;
  let eyePoly = eyeCage.poly();
  for (let i = 0; i < settings.levels; i++) eyePoly = subdivide(eyePoly);
  poly = append(poly, toLimit(eyePoly));
  const geometry = toGeometry(poly, cage, M, joints, info);
  return { geometry, joints, parents, bones: cage.bones, info, stats: { cageFaces, triangles: geometry.index.count / 3, vertices: poly.count, ms: performance.now() - t0 } };
}

/**
 * Eyes: closed islands sitting on the head's limit surface, weighted to the eyes bone so they can close. Each eye
 * goes where the head surface faces the eye's direction (the support point), within a band along the head, and sinks
 * in by a little under half its size; a small glint island sits on its upper front.
 */
function placeEyes(poly, cage, eyes, joints) {
  const { data, stride, count } = poly;
  const head = 3 + cage.boneIndex.head;
  const snout = cage.chOffset + CHANNELS.indexOf('SNOUT');
  const out = new Cage(cage.bones);
  const r = eyes.size;
  let y = 0;
  let z = 0;
  for (const dir of eyes.dirs) {
    let best = -Infinity;
    let p = null;
    for (let v = 0; v < count; v++) {
      const o = v * stride;
      if (data[o + head] < 0.95 || Math.abs(data[o + snout] - eyes.snout) > eyes.band) continue;
      const d = data[o] * dir[0] + data[o + 1] * dir[1] + data[o + 2] * dir[2];
      if (d > best) {
        best = d;
        p = [data[o], data[o + 1], data[o + 2]];
      }
    }
    const c = v3.add(p, v3.mul(dir, -r * 0.3));
    out.blob({ c, t: dir, s: eyes.hup, a: r, b: r, d: r * 0.6, w: { eyes: 1 }, ch: { EYE: 1 } });
    const g = v3.add(c, v3.add(v3.mul(dir, r * 0.5), v3.add(v3.mul(eyes.hup, r * 0.36), v3.mul(eyes.hdir, r * 0.12))));
    out.blob({ c: g, t: dir, s: eyes.hup, a: r * 0.26, b: r * 0.26, d: r * 0.14, w: { eyes: 1 }, ch: { GLINT: 1 } });
    y += c[1] / 2;
    z += c[2] / 2;
  }
  joints.eyes = [0, y, z];
  return out;
}

/** Concatenates two polys with the same stride. */
function append(a, b) {
  const data = new Float64Array(a.data.length + b.data.length);
  data.set(a.data);
  data.set(b.data, a.data.length);
  return { data, stride: a.stride, count: a.count + b.count, faces: [...a.faces, ...b.faces.map((f) => f.map((i) => i + a.count))] };
}

function toGeometry(poly, cage, M, joints, info) {
  const { data, stride, count, faces } = poly;
  const NB = cage.bones.length;
  const chOff = cage.chOffset;
  // Stand on the ground: the lowest point of the legs goes to y = 0 (bones move with it). Only legs count, so a
  // trunk or tail hanging low doesn't lift the feet off the ground.
  const leg = chOff + CHANNELS.indexOf('LEG');
  let minY = Infinity;
  for (let v = 0; v < count; v++) if (data[v * stride + leg] > 0.5) minY = Math.min(minY, data[v * stride + 1]);
  for (const k in joints) joints[k] = [joints[k][0], joints[k][1] - minY, joints[k][2]];

  const position = new Float32Array(count * 3);
  const skinIndex = new Uint8Array(count * 4);
  const skinWeight = new Uint16Array(count * 4);
  const wq = new Float64Array(4);
  const color = new Uint8Array(count * 3);
  const color2 = new Uint8Array(count * 3);
  const color3 = new Uint8Array(count * 3);
  const mark = new Float32Array(count);
  const stripe = new Float32Array(count);
  const pat = new Float32Array(count * 4);

  const paint = M.paint ?? {};
  const pattern = paint.pattern;
  const patVec = !pattern
    ? [PAT_NONE, 1, 0, 0]
    : pattern.kind === 1
      ? [1, pattern.freq, pattern.width, pattern.wobble ?? 0.1]
      : pattern.kind === 2
        ? [2, pattern.size, pattern.line, pattern.tint ?? 0]
        : [3, pattern.size, pattern.radius, pattern.density];
  const base = hex(paint.base ?? 0x999999);
  const patColor = hex(pattern?.color ?? paint.base ?? 0x999999);
  const allMarks = M.mane ? [...(paint.marks ?? []), { color: M.mane.color, field: (p) => p.MANE * 0.05 }] : paint.marks ?? [];
  const marks = allMarks.map((m) => ({ ...m, rgb: hex(m.color) }));
  const v = { legLen: info.legLen };
  const w = new Float64Array(NB);
  for (let i = 0; i < count; i++) {
    const o = i * stride;
    const y = data[o + 1] - minY;
    position.set([data[o], y, data[o + 2]], i * 3);
    // Skin: the four largest weights, renormalised.
    for (let k = 0; k < NB; k++) w[k] = data[o + 3 + k];
    for (let j = 0; j < 4; j++) {
      let best = 0;
      for (let k = 1; k < NB; k++) if (w[k] > w[best]) best = k;
      skinIndex[i * 4 + j] = best;
      wq[j] = Math.max(0, w[best]);
      w[best] = -1;
    }
    // Normalised 16-bit weights; the largest takes the rounding, so the four sum to exactly 1.
    const sum = wq[0] + wq[1] + wq[2] + wq[3];
    let rest = 65535;
    for (let j = 3; j > 0; j--) rest -= skinWeight[i * 4 + j] = Math.round((wq[j] / sum) * 65535);
    skinWeight[i * 4] = rest;
    // Paint.
    v.x = data[o];
    v.y = y;
    v.z = data[o + 2];
    CHANNELS.forEach((c, k) => (v[c] = data[o + chOff + k]));
    // The field is the union (max) of all markings, so every marking's edge with the coat is drawn per pixel. Where
    // markings overlap, the later one in the list wins (hooves over lower legs); edges between two markings are only
    // as sharp as the mesh, so keep them on dense rings (hoof creases).
    let bestF = -Infinity;
    let bestRgb = base;
    let top = null;
    for (const m of marks) {
      const f = m.field(v);
      if (f > bestF) {
        bestF = f;
        bestRgb = m.rgb;
      }
      if (f > 0) top = m.rgb;
    }
    if (top) bestRgb = top;
    color.set(base, i * 3);
    color2.set(patColor, i * 3);
    color3.set(bestRgb, i * 3);
    mark[i] = marks.length ? bestF : -1;
    // The stripe coordinate for stripes; the local pattern scale for cell patterns. (The rest position the patterns
    // also need is `position` itself: the geometry is stored in its bind pose.)
    stripe[i] = patVec[0] === 1 ? v.S : v.PS;
    pat.set(patVec, i * 4);
  }
  // Quads → triangles along the shorter diagonal.
  const index = new Uint32Array(faces.length * 6);
  const d2 = (a, b) => (position[a * 3] - position[b * 3]) ** 2 + (position[a * 3 + 1] - position[b * 3 + 1]) ** 2 + (position[a * 3 + 2] - position[b * 3 + 2]) ** 2;
  faces.forEach(([a, b, c, d], f) => {
    const tri = d2(a, c) <= d2(b, d) ? [a, b, c, a, c, d] : [a, b, d, b, c, d];
    index.set(tri, f * 6);
  });
  const g = new THREE.BufferGeometry();
  g.setIndex(new THREE.BufferAttribute(count > 65535 ? index : Uint16Array.from(index), 1));
  g.setAttribute('position', new THREE.BufferAttribute(position, 3));
  g.setAttribute('skinIndex', new THREE.Uint8BufferAttribute(skinIndex, 4));
  g.setAttribute('skinWeight', new THREE.Uint16BufferAttribute(skinWeight, 4, true));
  g.setAttribute('color', new THREE.Uint8BufferAttribute(color, 3, true));
  g.setAttribute('color2', new THREE.Uint8BufferAttribute(color2, 3, true));
  g.setAttribute('color3', new THREE.Uint8BufferAttribute(color3, 3, true));
  g.setAttribute('mark', new THREE.BufferAttribute(mark, 1));
  g.setAttribute('stripe', new THREE.BufferAttribute(stripe, 1));
  g.setAttribute('pat', new THREE.BufferAttribute(pat, 4));
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/** Bytes the geometry's attributes and index take (GPU memory, roughly). */
export function geometryBytes(g) {
  let n = g.index ? g.index.array.byteLength : 0;
  for (const a of Object.values(g.attributes)) n += a.array.byteLength;
  return n;
}

/** Seed → the seed bone's offset (0..1 per axis). */
export function seedOffset(seed) {
  const h = hashString(`coat:${seed}`);
  return [(h & 1023) / 1023, ((h >>> 10) & 1023) / 1023, ((h >>> 20) & 1023) / 1023];
}

const cache = new Map();

/**
 * Builds an animal.
 * @param {string} id  species id (MESH_SPECIES)
 * @param {{ sex?: 'male'|'female', age?: 'adult'|'baby', seed?: number, detail?: number, material?: THREE.Material, cache?: boolean }} [opts]
 *   cache: reuse the geometry of an earlier build of the same species, sex, age and detail.
 */
export function buildAnimal(id, opts = {}) {
  const sex = opts.sex ?? 'female';
  const age = opts.age ?? 'adult';
  const detail = opts.detail ?? 1;
  const key = `${id}|${sex}|${age}|${detail}`;
  let tpl = opts.cache ? cache.get(key) : null;
  if (!tpl) {
    tpl = buildTemplate(id, { sex, age, detail });
    if (opts.cache) cache.set(key, tpl);
  }
  const look = resolveLook(id, { sex, age });
  const seed = opts.seed ?? hashString(id);
  const material = opts.material ?? createMeshAnimalMaterial();

  const group = new THREE.Group();
  group.name = 'animal';
  const bones = {};
  for (const name of tpl.bones) {
    const b = new THREE.Bone();
    b.name = name;
    bones[name] = b;
  }
  for (const name of tpl.bones) {
    const parent = tpl.parents[name];
    const p = tpl.joints[name];
    const pp = parent ? tpl.joints[parent] : [0, 0, 0];
    bones[name].position.set(p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]);
    (parent ? bones[parent] : group).add(bones[name]);
  }
  const mesh = new THREE.SkinnedMesh(tpl.geometry, material);
  mesh.name = 'body';
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  group.add(mesh);
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(tpl.bones.map((n) => bones[n]));
  mesh.bind(skeleton);
  // The seed bone carries the individual's pattern offset (material.js).
  bones.seed.position.set(...seedOffset(seed));

  const rest = new Map();
  for (const b of Object.values(bones)) rest.set(b, { p: b.position.clone(), q: b.quaternion.clone(), s: b.scale.clone() });
  const legs = tpl.info.legs.map((l) => ({ ...l, upper: bones[`upper${l.name}`], lower: bones[`lower${l.name}`], foot: bones[`foot${l.name}`] }));
  const rig = {
    kind: 'mesh-quad',
    plan: look.plan,
    root: group,
    mesh,
    bones,
    rest,
    legs,
    body: bones.hips,
    neck: bones.neck0,
    head: bones.head,
    eyes: bones.eyes,
    tail: bones.tail0,
    trunk: bones.trunk0 ?? null,
    size: { legLen: tpl.info.legLen, bodyH: tpl.info.bodyH, bodyL: tpl.info.bodyL },
    phase: (seed % 1000) / 159,
    stats: tpl.stats,
  };
  group.scale.setScalar(look.scale);
  group.userData = { species: id, sex, age, plan: look.plan, seed, builder: 'single-mesh' };
  return { group, rig, look };
}
