// Single-mesh animals (experiment): buildAnimal(id, { sex, age, seed, detail }) → { group, rig, look }.
// Each animal is ONE skinned mesh: a code-built quad cage (quadruped.js), Catmull-Clark subdivided (subdivide.js),
// skinned to a bone hierarchy, painted by the shared material (material.js). Pure: plain Object3D trees, no WebGL,
// no DOM. Geometry depends on species, sex, age and detail only; the seed shifts the coat pattern through the
// skeleton's seed bone, so geometry can be cached and shared between individuals.

import * as THREE from 'three';
import { hashString } from '../../../core/rng.js';
import { LOOKS, mergeLook, resolveLook } from '../index.js';
import { CHANNELS, Cage, v3 } from './cage.js';
import { MESH_LOOKS, MESH_PLAN_DEFAULTS } from './looks.js';
import { createMeshAnimalMaterial } from './material.js';
import { PAT_NONE } from './material.js';
import { buildBirdCage } from './bird.js';
import { buildPinnipedCage } from './pinniped.js';
import { buildQuadCage } from './quadruped.js';
import { buildLizardCage, buildTurtleCage } from './reptile.js';
import { subdivide, toLimit } from './subdivide.js';

export { animate, POSES } from './animate.js';
export { createMeshAnimalMaterial } from './material.js';
export { MESH_LOOKS, MESH_SPECIES } from './looks.js';

/**
 * Cage builders per body plan: (look, meshLook, detail settings) → { cage, joints, parents, eyes, info }.
 * info.kind picks the animation family (animate.js); info.legs lists the legs ({ name, front, side }) whose bones are
 * upper<name>, lower<name>, foot<name>.
 */
const BUILDERS = {
  hoof: buildQuadCage,
  cat: buildQuadCage,
  dog: buildQuadCage,
  bear: buildQuadCage,
  small: buildQuadCage,
  pachy: buildQuadCage,
  'bird-walk': buildBirdCage,
  'bird-perch': buildBirdCage,
  penguin: buildBirdCage,
  pinniped: buildPinnipedCage,
  lizard: buildLizardCage,
  turtle: buildTurtleCage,
};

/** Resolves the single-mesh extras for a sex and age (same override scheme as the species looks). */
export function resolveMeshLook(id, { sex = 'female', age = 'adult' } = {}) {
  const base = MESH_LOOKS[id];
  if (!base) throw new Error(`No single-mesh look for species "${id}"`);
  const { male, female, baby, ...rest } = base;
  let M = mergeLook(mergeLook(MESH_PLAN_DEFAULTS[LOOKS[id]?.plan] ?? {}, rest), sex === 'male' ? male : female);
  if (age === 'baby') {
    // Babies: no mane, bigger ears (as resolveLook does for the species looks).
    M = mergeLook({ ...M, mane: undefined }, baby);
    if (M.ears?.size) M.ears = { ...M.ears, size: M.ears.size * 1.25 };
  }
  return M;
}

/**
 * Detail → cage density and subdivision levels. Ring spacing is relative to the animal's size, so a giraffe and
 * a lion cub get about the same triangle count. Every tier lands on the cage's limit surface, so a tier only changes
 * how finely that surface is sampled: low is the high cage subdivided once (a quarter of the triangles, the same
 * shape); medium subdivides once a cage with about twice the rings along the body and limbs.
 */
export function detailSettings(look, detail = 1) {
  const bodyL = look.body?.l ?? look.shell?.rz ?? 0.3;
  const legLen = look.legs?.len ?? bodyL * 0.4;
  const size = bodyL + legLen * 0.5 + (look.neck?.len ?? 0) * 0.5;
  // `size` and `detail` let builders scale their own densities (loops of a mane, feathers, shell rows).
  if (detail >= 0.9) return { tier: 0, levels: 2, step: size * 0.13, legStep: legLen * 0.22, size, detail };
  // Short-legged animals (otters) would get very dense legs and tails; the floor keeps them in budget.
  if (detail >= 0.7) return { tier: 1, levels: 1, step: size * 0.07, legStep: Math.max(legLen * 0.12, size * 0.05), size, detail };
  return { tier: 2, levels: 1, step: size * 0.13, legStep: Math.max(legLen * 0.22, size * 0.07), size, detail };
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
  const build = BUILDERS[look.plan];
  if (!build) throw new Error(`No single-mesh builder for body plan "${look.plan}"`);
  const { cage, joints, parents, info, eyes } = build(look, M, settings);
  let poly = cage.poly();
  let cageFaces = poly.faces.length;
  for (let i = 0; i < settings.levels; i++) poly = subdivide(poly);
  // Two levels shade smoothly as they are; one level gets its normals from one level finer.
  const extra = settings.levels < 2 ? 1 : 0;
  const bodyNormals = extra ? limitNormals(poly, extra) : null;
  poly = toLimit(poly);
  const eyeCage = placeEyes(poly, cage, eyes, joints);
  cageFaces += eyeCage.faces.length;
  let eyePoly = eyeCage.poly();
  for (let i = 0; i < settings.levels; i++) eyePoly = subdivide(eyePoly);
  let normals = null;
  if (bodyNormals) {
    normals = new Float32Array((poly.count + eyePoly.count) * 3);
    normals.set(bodyNormals);
    normals.set(limitNormals(eyePoly, 1), bodyNormals.length);
  }
  poly = append(poly, toLimit(eyePoly));
  const geometry = toGeometry(poly, cage, M, joints, { ...info, eyeCentres: eyes.centres }, look, normals);
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
  const centres = [];
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
    centres.push(c);
  }
  joints.eyes = [0, y, z];
  eyes.centres = centres;
  if (eyes.nose) {
    // The nose: where the snout tip faces the nose direction, sunk in by a third of its depth.
    const n = eyes.nose;
    let best = -Infinity;
    let p = null;
    for (let v = 0; v < count; v++) {
      const o = v * stride;
      if (data[o + head] < 0.95 || data[o + snout] > n.band) continue;
      const d = data[o] * n.dir[0] + data[o + 1] * n.dir[1] + data[o + 2] * n.dir[2];
      if (d > best) {
        best = d;
        p = [data[o], data[o + 1], data[o + 2]];
      }
    }
    if (p) out.blob({ c: v3.add(p, v3.mul(n.dir, -n.d * 0.35)), t: n.dir, s: [1, 0, 0], a: n.a, b: n.b, d: n.d, w: { head: 1 }, ch: { NOSE: 1 } });
  }
  return out;
}

/** Concatenates two polys with the same stride. */
function append(a, b) {
  const data = new Float64Array(a.data.length + b.data.length);
  data.set(a.data);
  data.set(b.data, a.data.length);
  return { data, stride: a.stride, count: a.count + b.count, faces: [...a.faces, ...b.faces.map((f) => f.map((i) => i + a.count))] };
}

/**
 * Smooth normals for a subdivided mesh: positions alone are subdivided `extra` more times and moved to the limit
 * surface, and the normals there are read back at the original vertices (subdivide() keeps their indices). This is
 * cheap (3 floats a vertex instead of the whole data vector) and makes the one-level tiers shade like the two-level one.
 */
function limitNormals(poly, extra) {
  const { data, stride, count } = poly;
  const pos = new Float64Array(count * 3);
  for (let v = 0; v < count; v++) for (let d = 0; d < 3; d++) pos[v * 3 + d] = data[v * stride + d];
  let p = { data: pos, stride: 3, count, faces: poly.faces };
  for (let i = 0; i < extra; i++) p = subdivide(p);
  p = toLimit(p);
  const P = p.data;
  const acc = new Float64Array(p.count * 3);
  for (const [a, b, c, d] of p.faces) {
    // Quad normal: the cross product of its diagonals (twice its area, outward for counter-clockwise quads).
    const ux = P[c * 3] - P[a * 3], uy = P[c * 3 + 1] - P[a * 3 + 1], uz = P[c * 3 + 2] - P[a * 3 + 2];
    const vx = P[d * 3] - P[b * 3], vy = P[d * 3 + 1] - P[b * 3 + 1], vz = P[d * 3 + 2] - P[b * 3 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const k of [a, b, c, d]) {
      acc[k * 3] += nx;
      acc[k * 3 + 1] += ny;
      acc[k * 3 + 2] += nz;
    }
  }
  const out = new Float32Array(count * 3);
  for (let v = 0; v < count; v++) {
    const l = Math.hypot(acc[v * 3], acc[v * 3 + 1], acc[v * 3 + 2]) || 1;
    for (let d = 0; d < 3; d++) out[v * 3 + d] = acc[v * 3 + d] / l;
  }
  return out;
}

function toGeometry(poly, cage, M, joints, info, look, normals) {
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
  // Parts that carry their own colour: the mane (darker at the tips) and the nose pad.
  const allMarks = [...(paint.marks ?? [])];
  // The mane on the neck is a marking; the ruff (MANE with a FUR coordinate) is painted as hair below.
  if (M.mane) allMarks.push({ color: M.mane.color, field: (p) => (p.FUR < 0 ? p.MANE * 0.05 : -0.05) });
  const maneRgb = M.mane && [hex(M.mane.color), hex(M.mane.tips ?? M.mane.color), hex(M.mane.streak ?? M.mane.tips ?? M.mane.color)];
  if (look.nose?.color !== undefined) allMarks.push({ color: M.noseColor ?? look.nose.color, field: (p) => p.NOSE * 0.05 });
  const marks = allMarks.map((m) => ({ ...m, rgb: hex(m.color) }));
  // What marking fields see: the vertex's rest position (x, y, z), its channels (CHANNELS), sizes, the eye centres
  // (eyeDist), and its bone weights (bone(name)).
  const ground = minY;
  const eyeC = (info.eyeCentres ?? []).map((c) => [c[0], c[1] - ground, c[2]]);
  let rowOff = 0;
  const painted = new Uint8Array(count);
  const v = {
    legLen: info.legLen,
    bodyL: info.bodyL,
    bodyH: info.bodyH,
    headLen: info.headLen ?? 0,
    /** Distance to the nearest eye centre, measured from a point shifted by (dy, dz) from it. */
    eyeDist(dy = 0, dz = 0) {
      let m = Infinity;
      for (const c of eyeC) m = Math.min(m, Math.hypot(this.x - c[0], this.y - c[1] - dy, this.z - c[2] - dz));
      return m;
    },
    bone: (name) => (cage.boneIndex[name] === undefined ? 0 : data[rowOff + 3 + cage.boneIndex[name]]),
  };
  const w = new Float64Array(NB);
  for (let i = 0; i < count; i++) {
    const o = i * stride;
    rowOff = o;
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
    painted[i] = top ? 1 : 0;
    color.set(base, i * 3);
    color2.set(patColor, i * 3);
    color3.set(bestRgb, i * 3);
    mark[i] = marks.length ? bestF : -1;
    // The stripe coordinate for stripes; the local pattern scale for cell patterns. (The rest position the patterns
    // also need is `position` itself: the geometry is stored in its bind pose.)
    stripe[i] = patVec[0] === 1 ? v.S : v.PS;
    pat.set(patVec, i * 4);
    if (maneRgb && v.MANE > 0.5 && v.FUR >= 0) {
      // Ruff hair: the base shades from the mane colour at the roots to the tips colour, with darker streaks
      // (the stripe pattern on the AUX coordinate) running out from the face. The streaks fade out where AUX folds
      // over (the middle of the crown and of the chest: UNDER ±1), so they never close into rings there.
      const t = Math.min(1, Math.max(0, (v.FUR - 0.25) / 0.75));
      for (let k = 0; k < 3; k++) {
        const c = maneRgb[0][k] + (maneRgb[1][k] - maneRgb[0][k]) * t;
        color[i * 3 + k] = Math.round(c);
        color2[i * 3 + k] = M.mane.streak === undefined ? Math.round(c * 0.8) : maneRgb[2][k];
      }
      stripe[i] = v.AUX;
      pat.set([1, 1, (M.mane.streakWidth ?? 0.42) * Math.max(0, 1 - v.UNDER * v.UNDER) ** 2, 0.55], i * 4);
      // No markings on the ruff (the belly marking would reach its underside).
      mark[i] = -1;
    }
  }
  // Unpainted vertices next to a marking take that marking's colour, so across the edge the shader blends between the
  // coat and that colour only (not towards whichever other marking happened to be least negative there).
  // (The most strongly painted neighbour wins.)
  const from = new Float32Array(count).fill(-Infinity);
  for (const f of faces) {
    for (let j = 0; j < 4; j++) {
      const a = f[j];
      if (painted[a]) continue;
      for (const b of [f[(j + 1) % 4], f[(j + 3) % 4]]) {
        if (painted[b] && mark[b] > from[a]) {
          from[a] = mark[b];
          color3.copyWithin(a * 3, b * 3, b * 3 + 3);
        }
      }
    }
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
  if (normals) g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  else g.computeVertexNormals();
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
  const legs = (tpl.info.legs ?? []).map((l) => ({ ...l, upper: bones[`upper${l.name}`], lower: bones[`lower${l.name}`], foot: bones[`foot${l.name}`] }));
  const rig = {
    kind: tpl.info.kind ?? 'mesh-quad',
    info: tpl.info,
    plan: look.plan,
    root: group,
    mesh,
    bones,
    rest,
    legs,
    body: bones.hips,
    neck: bones.neck0 ?? null,
    head: bones.head,
    eyes: bones.eyes,
    tail: bones.tail0 ?? null,
    trunk: bones.trunk0 ?? null,
    size: { legLen: tpl.info.legLen, bodyH: tpl.info.bodyH, bodyL: tpl.info.bodyL, neckLen: tpl.info.neckLen },
    phase: (seed % 1000) / 159,
    stats: tpl.stats,
  };
  group.scale.setScalar(look.scale);
  group.userData = { species: id, sex, age, plan: look.plan, seed, builder: 'single-mesh' };
  return { group, rig, look };
}
