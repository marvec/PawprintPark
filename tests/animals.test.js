// Animals (src/scene/animals/): the builder runs without WebGL, so these tests check the skinned meshes it returns,
// posed on the CPU with three.js's own bone transform.

import { describe, expect, test } from 'bun:test';
import * as THREE from 'three';
import { MESH_SPECIES, POSES, animate, buildAnimal, buildTemplate, createAnimalMaterial, detailSettings, isDimorphic, resolveLook, resolveMeshLook, seedOffset } from '../src/scene/animals/index.js';
import { buildQuadCage } from '../src/scene/animals/quadruped.js';
import { subdivide, toLimit } from '../src/scene/animals/subdivide.js';

const material = createAnimalMaterial();
/** Both sexes where they look different, plus the baby. */
const VARIANTS = Object.fromEntries(MESH_SPECIES.map((id) => [id, [...(isDimorphic(id) ? [['male', 'adult']] : []), ['female', 'adult'], ['female', 'baby']]]));
/** Triangle budgets per detail level (quality.js: high 1, medium 0.8, low 0.6). */
const BUDGET = { 1: 15500, 0.8: 10500, 0.6: 6500 };

/** World-space positions of the skinned mesh in its current pose. */
function posed(group, mesh) {
  group.updateMatrixWorld(true);
  const pos = mesh.geometry.getAttribute('position');
  const out = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    mesh.getVertexPosition(i, v);
    v.applyMatrix4(mesh.matrixWorld);
    out[i * 3] = v.x;
    out[i * 3 + 1] = v.y;
    out[i * 3 + 2] = v.z;
  }
  return out;
}

function minY(arr) {
  let m = Infinity;
  for (let i = 1; i < arr.length; i += 3) m = Math.min(m, arr[i]);
  return m;
}

describe('buildAnimal', () => {
  for (const id of MESH_SPECIES) {
    describe(id, () => {
      for (const [sex, age] of VARIANTS[id]) {
        test(`${sex} ${age}: one skinned mesh with finite geometry and normalised skin weights`, () => {
          const { group, rig } = buildAnimal(id, { sex, age, material });
          const meshes = [];
          group.traverse((o) => o.isMesh && meshes.push(o));
          expect(meshes.length).toBe(1);
          const mesh = meshes[0];
          expect(mesh.isSkinnedMesh).toBe(true);
          expect(mesh.material).toBe(material);
          const g = mesh.geometry;
          const n = g.getAttribute('position').count;
          for (const name of ['position', 'normal', 'skinIndex', 'skinWeight', 'color', 'color2', 'color3', 'mark', 'stripe', 'pat']) expect(g.getAttribute(name).count).toBe(n);
          for (const name of ['position', 'normal', 'mark', 'stripe', 'pat']) for (const x of g.getAttribute(name).array) expect(Number.isFinite(x)).toBe(true);
          const w = g.getAttribute('skinWeight');
          const si = g.getAttribute('skinIndex');
          for (let i = 0; i < n; i++) {
            // Stored as normalised 16-bit integers.
            expect(Math.abs(w.getX(i) + w.getY(i) + w.getZ(i) + w.getW(i) - 1)).toBeLessThan(1e-4);
            expect(Math.min(w.getX(i), w.getY(i), w.getZ(i), w.getW(i))).toBeGreaterThanOrEqual(0);
            // Nothing is weighted to the seed bone (bone 0), which carries the pattern offset.
            for (const k of [si.getX(i), si.getY(i), si.getZ(i), si.getW(i)]) expect(k < mesh.skeleton.bones.length).toBe(true);
            if (w.getX(i) > 0) expect(si.getX(i)).not.toBe(0);
          }
          expect(rig.eyes).toBeDefined();
          expect(rig.head).toBeDefined();
        });

        test(`${sex} ${age}: the surface is closed (every edge has two triangles)`, () => {
          const g = buildTemplate(id, { sex, age }).geometry;
          const idx = g.index.array;
          const edges = new Map();
          for (let t = 0; t < idx.length; t += 3)
            for (let k = 0; k < 3; k++) {
              const a = idx[t + k];
              const b = idx[t + ((k + 1) % 3)];
              const key = a < b ? `${a},${b}` : `${b},${a}`;
              edges.set(key, (edges.get(key) ?? 0) + 1);
            }
          for (const c of edges.values()) expect(c).toBe(2);
        });
      }

      test('stands on the ground at rest, and every pose stays finite without drift', () => {
        const { group, rig } = buildAnimal(id, { material });
        const mesh = rig.mesh;
        // The bind pose (some idles sit up, like the meerkat's sentry).
        expect(Math.abs(minY(posed(group, mesh)))).toBeLessThan(0.03);
        for (const pose of POSES) {
          for (const t of [0, 0.7, 3.3, 11.1]) {
            animate(rig, pose, t);
            for (const x of posed(group, mesh)) expect(Number.isFinite(x)).toBe(true);
          }
        }
        animate(rig, 'walk', 0.4);
        const a = posed(group, mesh);
        animate(rig, 'sleep', 2);
        animate(rig, 'walk', 0.4);
        const b = posed(group, mesh);
        let maxd = 0;
        for (let i = 0; i < a.length; i++) maxd = Math.max(maxd, Math.abs(a[i] - b[i]));
        expect(maxd).toBeLessThan(1e-6);
      });

      test('triangle budgets hold at every detail level', () => {
        for (const [sex, age] of VARIANTS[id])
          for (const level of [1, 0.8, 0.6]) {
            const { stats } = buildTemplate(id, { sex, age, detail: level });
            expect(stats.triangles).toBeLessThanOrEqual(BUDGET[level]);
          }
      });
    });
  }

  test('is deterministic: the same species builds the same geometry', () => {
    const a = buildTemplate('plains-zebra').geometry;
    const b = buildTemplate('plains-zebra').geometry;
    for (const name of ['position', 'skinWeight', 'stripe', 'color3', 'mark']) expect(Array.from(a.getAttribute(name).array)).toEqual(Array.from(b.getAttribute(name).array));
  });

  test('individuals share geometry and differ only by the seed bone', () => {
    const a = buildAnimal('plains-zebra', { seed: 1, cache: true, material });
    const b = buildAnimal('plains-zebra', { seed: 2, cache: true, material });
    expect(a.rig.mesh.geometry).toBe(b.rig.mesh.geometry);
    expect(a.rig.bones.seed.position.toArray()).toEqual(seedOffset(1));
    expect(a.rig.bones.seed.position.toArray()).not.toEqual(b.rig.bones.seed.position.toArray());
    // The seed bone keeps its offset through animation.
    animate(a.rig, 'walk', 1.3);
    expect(a.rig.bones.seed.position.toArray()).toEqual(seedOffset(1));
  });

  test('animating never moves or rescales the animal itself, only its bones', () => {
    const { group, rig } = buildAnimal('lion', { age: 'baby', material });
    group.position.set(5, 0, -3);
    group.rotation.y = 1;
    const scale = group.scale.x;
    for (const pose of POSES) animate(rig, pose, 2);
    expect(group.position.toArray()).toEqual([5, 0, -3]);
    expect(group.rotation.y).toBe(1);
    expect(group.scale.x).toBe(scale);
  });

  test('eyes close: asleep the eyes bone is squashed, awake (blink off) it is open', () => {
    const { rig } = buildAnimal('lion', { material });
    animate(rig, 'sleep', 1);
    expect(rig.eyes.scale.y).toBeLessThan(0.2);
    animate(rig, 'idle', 1, { blink: false });
    expect(rig.eyes.scale.y).toBe(1);
  });

  test('coat paint: zebra stripes, giraffe patches, lion cub spots; markings on both sides of their edges', () => {
    const kind = (id, opts) => buildTemplate(id, opts).geometry.getAttribute('pat').getX(0);
    expect(kind('plains-zebra')).toBe(1);
    expect(kind('reticulated-giraffe')).toBe(2);
    expect(kind('lion', { age: 'baby' })).toBe(3);
    expect(kind('lion')).toBe(0);
    const mark = buildTemplate('plains-zebra').geometry.getAttribute('mark').array;
    expect(mark.some((f) => f > 0)).toBe(true);
    expect(mark.some((f) => f < 0)).toBe(true);
  });

  test('the male lion has a mane, so his mesh is bigger around the neck', () => {
    const width = (sex) => buildTemplate('lion', { sex }).geometry.boundingBox.getSize(new THREE.Vector3()).x;
    expect(width('male')).toBeGreaterThan(width('female') * 1.1);
  });

  /** The quadruped cage for a species (before subdivision), with its joints. */
  const quadCage = (id, opts = {}) => {
    const L = resolveLook(id, opts);
    return buildQuadCage(L, resolveMeshLook(id, opts), detailSettings(L, 1));
  };
  /** Positions of cage vertices that pass a test (channel and weight readers). */
  const cagePoints = ({ cage }, keep) => {
    const out = [];
    for (let i = 0; i < cage.count; i++) {
      const w = (bone) => cage.data[i * cage.stride + 3 + cage.boneIndex[bone]];
      if (keep((c) => cage.ch(i, c), w)) out.push(cage.pos(i));
    }
    return out;
  };

  test("the lion's mane starts at the face, in front of the ears, and reaches back over the shoulders", () => {
    const lion = quadCage('lion', { sex: 'male' });
    const mane = cagePoints(lion, (ch) => ch('MANE') > 0.5 && ch('FUR') >= 0);
    const front = Math.max(...mane.map((p) => p[2]));
    const back = Math.min(...mane.map((p) => p[2]));
    expect(front).toBeGreaterThan(lion.joints.earR[2]);
    expect(back).toBeLessThan(lion.joints.upperFR[2]);
    // It hangs down the chest, below the shoulder joints.
    expect(Math.min(...mane.map((p) => p[1]))).toBeLessThan(lion.joints.upperFR[1]);
  });

  test('the back of the hind thigh runs on down from the rump (no rump hangs out behind the legs)', () => {
    for (const id of ['lion', 'plains-zebra', 'asian-elephant', 'giant-panda']) {
      const c = quadCage(id);
      const L = resolveLook(id);
      const body = cagePoints(c, (ch, w) => w('hips') > 0.9 && ch('LEG') < 0 && ch('TAIL') > 3);
      const thigh = cagePoints(c, (ch, w) => w('upperBR') > 0.3);
      const rump = Math.min(...body.map((p) => p[2]));
      const thighBack = Math.min(...thigh.map((p) => p[2]));
      expect(thighBack - rump).toBeLessThan(L.body.l * 0.2);
    }
  });

  test("the elephant's ear flaps hang outside the neck and shoulders, also when the head turns", () => {
    const material = createAnimalMaterial();
    for (const sex of ['female', 'male']) {
      const { geometry, joints } = buildTemplate('asian-elephant', { sex });
      const a = buildAnimal('asian-elephant', { sex, seed: 1, material });
      let mesh;
      a.group.traverse((o) => o.isSkinnedMesh && (mesh = o));
      const names = mesh.skeleton.bones.map((b) => b.name);
      const pos = geometry.getAttribute('position');
      const si = geometry.getAttribute('skinIndex');
      const sw = geometry.getAttribute('skinWeight');
      const weight = (i, bone) => {
        let s = 0;
        for (let j = 0; j < 4; j++) if (names[si.getComponent(i, j)] === bone) s += sw.getComponent(i, j);
        return s;
      };
      // The flap behind its root (where it grows out of the head and neck), and the body without the head.
      const flap = [];
      const body = [];
      for (let i = 0; i < pos.count; i++) {
        const ear = weight(i, 'earR') + weight(i, 'earL');
        if (ear > 0.5 && pos.getZ(i) < joints.earR[2] - 0.2) flap.push(i);
        else if (ear < 0.01 && weight(i, 'head') < 0.3) body.push(i);
      }
      // Rest, and the idle pose's widest head turns either way.
      for (const t of [0, 4.25, 12.7]) {
        animate(a.rig, 'idle', t - a.rig.phase, { blink: false });
        a.group.updateMatrixWorld(true);
        mesh.skeleton.update();
        const P = (i) => mesh.applyBoneTransform(i, new THREE.Vector3().fromBufferAttribute(pos, i));
        const B = body.map(P);
        let inside = 0;
        for (const i of flap) {
          const p = P(i);
          const widest = Math.max(0, ...B.filter((q) => Math.sign(q.x) === Math.sign(p.x) && Math.abs(q.y - p.y) < 0.04 && Math.abs(q.z - p.z) < 0.04).map((q) => Math.abs(q.x)));
          if (Math.abs(p.x) < widest - 0.01) inside++;
        }
        expect(inside).toBeLessThan(flap.length * 0.05);
      }
    }
  });

  test('a short, steep neck leaves no groove between the shoulders and the head (warthog, pig)', () => {
    for (const id of ['common-warthog', 'domestic-pig']) {
      const c = quadCage(id, { sex: 'male' });
      const up = (ch, w) => ch('LEG') < 0 && ch('EAR') < -0.5;
      // The top of the body's front ring, and the upper half of the neck rings: none of them sits behind it.
      const shoulders = cagePoints(c, (ch, w) => up(ch, w) && w('chest') > 0.99).filter((p) => p[1] > c.joints.chest[1]);
      const neck = cagePoints(c, (ch, w) => up(ch, w) && w('neck0') > 0.3).filter((p) => p[1] > c.joints.neck0[1]);
      const front = Math.max(...shoulders.map((p) => p[2]));
      expect(Math.min(...neck.map((p) => p[2]))).toBeGreaterThan(front - 0.01);
    }
  });

  /** Vertices painted with a marking colour (mark > 0). */
  const painted = (id, opts, hex) => {
    const g = buildTemplate(id, opts).geometry;
    const c = g.getAttribute('color3');
    const m = g.getAttribute('mark');
    const rgb = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
    let n = 0;
    for (let i = 0; i < m.count; i++) if (m.getX(i) > 0 && c.array[i * 3] === rgb[0] && c.array[i * 3 + 1] === rgb[1] && c.array[i * 3 + 2] === rgb[2]) n++;
    return n;
  };

  test('parts that carry their own colour: nose pads, the ruff, horns, antlers, beards, ringed tails', () => {
    expect(painted('lion', {}, 0x7a4a3a)).toBeGreaterThan(20); // nose
    expect(painted('lion', { sex: 'male' }, 0xb57a38)).toBeGreaterThan(50); // mane on the neck (under the ruff)
    expect(painted('domestic-goat', { sex: 'male' }, 0x8a7b6a)).toBeGreaterThan(50); // horns
    expect(painted('domestic-goat', { sex: 'male' }, 0xe2d8c6)).toBeGreaterThan(20); // beard
    expect(painted('reindeer', { sex: 'male' }, 0xcbb79a)).toBeGreaterThan(100); // antlers
    expect(painted('domestic-goat', { age: 'baby' }, 0x8a7b6a)).toBe(0); // babies have none
    // The red panda's tail alternates between coat and ring colour along its length.
    const g = buildTemplate('red-panda').geometry;
    const pos = g.getAttribute('position');
    const mark = g.getAttribute('mark');
    const c3 = g.getAttribute('color3');
    const bands = [];
    for (let i = 0; i < pos.count; i++) if (c3.array[i * 3] === 0xe3 && Math.abs(pos.getX(i)) < 0.01) bands.push([pos.getZ(i), mark.getX(i) > 0]);
    bands.sort((a, b) => a[0] - b[0]);
    let flips = 0;
    for (let i = 1; i < bands.length; i++) if (bands[i][1] !== bands[i - 1][1]) flips++;
    expect(flips).toBeGreaterThanOrEqual(8);
  });

  test('builds fast enough to cache per variant (under 100 ms)', () => {
    // Warm builds (the JIT needs a few runs); the best of three, so a busy machine doesn't fail it.
    for (let i = 0; i < 3; i++) buildTemplate('reticulated-giraffe');
    const ms = Math.min(...[0, 1, 2].map(() => buildTemplate('reticulated-giraffe').stats.ms));
    expect(ms).toBeLessThan(100);
  });

  test('subdivision keeps channels affine: weights that sum to 1 still do', () => {
    // A cube with a weight channel pair (w, 1 - w).
    const P = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
    const data = Float64Array.from(P.flatMap((p, i) => [...p, i / 7, 1 - i / 7]));
    const faces = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 4, 7, 3]];
    const out = toLimit(subdivide(subdivide({ data, stride: 5, count: 8, faces })));
    for (let v = 0; v < out.count; v++) expect(Math.abs(out.data[v * 5 + 3] + out.data[v * 5 + 4] - 1)).toBeLessThan(1e-12);
    // The limit surface of a cube cage is inside the cage and roughly round.
    for (let v = 0; v < out.count; v++) {
      const r = Math.hypot(out.data[v * 5], out.data[v * 5 + 1], out.data[v * 5 + 2]);
      expect(r).toBeLessThan(1.0);
      expect(r).toBeGreaterThan(0.5);
    }
  });

  test('babies are smaller than adults and lose adult-only parts (antlers, tusks, manes)', () => {
    for (const id of MESH_SPECIES) {
      const adult = new THREE.Box3().setFromObject(buildAnimal(id, { material, cache: true }).group);
      const baby = new THREE.Box3().setFromObject(buildAnimal(id, { age: 'baby', material, cache: true }).group);
      expect(baby.max.y - baby.min.y).toBeLessThan((adult.max.y - adult.min.y) * 0.8);
    }
    expect(resolveLook('reindeer', { sex: 'male' }).extras.antlers).toBeDefined();
    expect(resolveLook('reindeer', { sex: 'male', age: 'baby' }).extras?.antlers).toBeUndefined();
    expect(resolveLook('asian-elephant', { sex: 'male', age: 'baby' }).extras?.tusks).toBeUndefined();
  });

  test('true sizes are plausible: a giraffe is tall, a meerkat is small', () => {
    const height = (id) => {
      const box = new THREE.Box3().setFromObject(buildAnimal(id, { material, cache: true }).group);
      return box.max.y - box.min.y;
    };
    expect(height('reticulated-giraffe')).toBeGreaterThan(3.5);
    expect(height('asian-elephant')).toBeGreaterThan(2.2);
    expect(height('meerkat')).toBeLessThan(0.4);
  });

  test('an unknown species throws', () => {
    expect(() => buildAnimal('unicorn')).toThrow();
  });

  test('the material reads the seed from the skeleton and paints per pixel', () => {
    const shader = { vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
    material.onBeforeCompile(shader);
    expect(shader.vertexShader).toContain('getBoneMatrix(0.0)');
    expect(shader.fragmentShader).not.toContain('#include <color_fragment>');
    expect(shader.fragmentShader).toContain('cellular(');
  });
});
