// Single-mesh animals (experiment, src/scene/animals/mesh/): the builder runs without WebGL, so these tests check the
// skinned meshes it returns, posed on the CPU with three.js's own bone transform.

import { describe, expect, test } from 'bun:test';
import * as THREE from 'three';
import { MESH_SPECIES, POSES, animate, buildAnimal, buildTemplate, createMeshAnimalMaterial, seedOffset } from '../src/scene/animals/mesh/index.js';
import { subdivide, toLimit } from '../src/scene/animals/mesh/subdivide.js';

const material = createMeshAnimalMaterial();
const VARIANTS = {
  lion: [['male', 'adult'], ['female', 'adult'], ['female', 'baby']],
  'plains-zebra': [['female', 'adult'], ['female', 'baby']],
  'reticulated-giraffe': [['female', 'adult']],
  'asian-elephant': [['male', 'adult'], ['female', 'adult'], ['female', 'baby']],
};
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

describe('single-mesh buildAnimal', () => {
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
        animate(rig, 'idle', 0, { blink: false });
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

  test('builds fast enough to cache per variant (under 100 ms)', () => {
    buildTemplate('reticulated-giraffe');
    const { stats } = buildTemplate('reticulated-giraffe');
    expect(stats.ms).toBeLessThan(100);
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

  test('the material reads the seed from the skeleton and paints per pixel', () => {
    const shader = { vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
    material.onBeforeCompile(shader);
    expect(shader.vertexShader).toContain('getBoneMatrix(0.0)');
    expect(shader.fragmentShader).not.toContain('#include <color_fragment>');
    expect(shader.fragmentShader).toContain('cellular(');
  });
});
