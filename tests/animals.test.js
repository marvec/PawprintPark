// The animal builder runs without WebGL: these tests check the Object3D trees it returns.

import { describe, expect, test } from 'bun:test';
import * as THREE from 'three';
import { LOOKS, POSES, animate, buildAnimal, createAnimalMaterial, isDimorphic, resolveLook } from '../src/scene/animals/index.js';
import { CELL_PATCHES, CELL_SPOTS } from '../src/scene/animals/rig.js';
import { detail, limb } from '../src/scene/animals/shapes.js';

const material = createAnimalMaterial();
const ids = Object.keys(LOOKS);
const variants = (id) => [...(isDimorphic(id) ? ['male', 'female'] : ['female']).map((sex) => ({ sex, age: 'adult' })), { sex: 'female', age: 'baby' }];

function sizeOf(group) {
  group.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
}

/** The body mesh (the body pivot group has the same name). */
const bodyMesh = (id) => meshes(buildAnimal(id, { material }).group).find((m) => m.name === 'body');

function meshes(group) {
  const out = [];
  group.traverse((o) => o.isMesh && out.push(o));
  return out;
}

describe('buildAnimal', () => {
  for (const id of ids) {
    describe(id, () => {
      for (const v of variants(id)) {
        test(`${v.sex} ${v.age}: builds finite geometry with vertex colours and a rig`, () => {
          const { group, rig } = buildAnimal(id, { ...v, material });
          const ms = meshes(group);
          expect(ms.length).toBeGreaterThanOrEqual(6);
          for (const m of ms) {
            const pos = m.geometry.getAttribute('position');
            for (const name of ['color', 'color2', 'mask', 'cell', 'apos']) {
              expect(m.geometry.getAttribute(name)).toBeDefined();
              expect(m.geometry.getAttribute(name).count).toBe(pos.count);
            }
            for (const x of pos.array) expect(Number.isFinite(x)).toBe(true);
            expect(m.material).toBe(material);
          }
          expect(rig.body).toBeDefined();
          expect(rig.head).toBeDefined();
          expect(rig.eyes).toBeDefined();
        });
      }

      test('stands on the ground at rest', () => {
        const { group, rig } = buildAnimal(id, { material });
        animate(rig, 'idle', 0);
        group.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(group);
        // Feet touch the ground: the lowest point is within a few centimetres of y = 0 (perching birds stand on a perch).
        const tolerance = LOOKS[id].plan === 'bird-perch' ? 0.5 : 0.13 * group.scale.y;
        expect(Math.abs(box.min.y)).toBeLessThan(tolerance);
      });

      test('the baby is smaller than the adult', () => {
        const adult = sizeOf(buildAnimal(id, { material }).group);
        const baby = sizeOf(buildAnimal(id, { age: 'baby', material }).group);
        expect(baby.y).toBeLessThan(adult.y * 0.8);
      });

      test('every pose keeps the rig finite and returns to rest', () => {
        const { group, rig } = buildAnimal(id, { material });
        const rest = [...rig.rest].map(([o]) => o.position.clone());
        for (const pose of POSES) {
          for (const t of [0, 0.7, 3.3, 11.1]) {
            animate(rig, pose, t);
            group.traverse((o) => {
              for (const v of [o.position.x, o.position.y, o.position.z, o.rotation.x, o.rotation.y, o.rotation.z, o.scale.y])
                expect(Number.isFinite(v)).toBe(true);
            });
          }
        }
        // Reset happens at the start of animate; the walk pose must not accumulate drift.
        animate(rig, 'walk', 0);
        animate(rig, 'walk', 0);
        const again = [...rig.rest].map(([o]) => o.position.clone());
        animate(rig, 'walk', 0);
        [...rig.rest].forEach(([o], i) => expect(o.position.distanceTo(again[i])).toBeLessThan(1e-9));
        expect(rest.length).toBe(again.length);
      });
    });
  }

  test('is deterministic: the same species builds the same geometry', () => {
    const a = meshes(buildAnimal('plains-zebra', { material }).group);
    const b = meshes(buildAnimal('plains-zebra', { material }).group);
    expect(a.length).toBe(b.length);
    a.forEach((m, i) => expect(Array.from(m.geometry.getAttribute('color').array)).toEqual(Array.from(b[i].geometry.getAttribute('color').array)));
  });

  test('sexes differ where the species does: the male lion has a mane, the female none', () => {
    const verts = (sex) => meshes(buildAnimal('lion', { sex, material }).group).reduce((n, m) => n + m.geometry.getAttribute('position').count, 0);
    expect(verts('male')).toBeGreaterThan(verts('female'));
  });

  test('babies lose adult-only parts (antlers, tusks, manes)', () => {
    expect(resolveLook('reindeer', { sex: 'male' }).extras.antlers).toBeDefined();
    expect(resolveLook('reindeer', { sex: 'male', age: 'baby' }).extras?.antlers).toBeUndefined();
    expect(resolveLook('asian-elephant', { sex: 'male', age: 'baby' }).extras?.tusks).toBeUndefined();
  });

  test('true sizes are plausible: a giraffe is tall, a meerkat is small', () => {
    expect(sizeOf(buildAnimal('reticulated-giraffe', { material }).group).y).toBeGreaterThan(3.5);
    expect(sizeOf(buildAnimal('asian-elephant', { material }).group).y).toBeGreaterThan(2.2);
    expect(sizeOf(buildAnimal('meerkat', { material }).group).y).toBeLessThan(0.4);
  });

  test('animating never moves or rescales the animal itself, only its parts', () => {
    const { group, rig } = buildAnimal('lion', { age: 'baby', material });
    group.position.set(5, 0, -3);
    group.rotation.y = 1;
    const scale = group.scale.x;
    for (const pose of POSES) animate(rig, pose, 2);
    expect(group.position.toArray()).toEqual([5, 0, -3]);
    expect(group.rotation.y).toBe(1);
    expect(group.scale.x).toBe(scale);
  });

  test('two-tone paint: zebra stripes give a mask field on both sides of the edge', () => {
    const mask = bodyMesh('plains-zebra').geometry.getAttribute('mask').array;
    expect(mask.some((f) => f > 0)).toBe(true);
    expect(mask.some((f) => f < 0)).toBe(true);
  });

  test('cell patterns are marked for the shader: giraffe patches, goat spots', () => {
    const kinds = (id) => new Set(Array.from(bodyMesh(id).geometry.getAttribute('cell').array).filter((_, i) => i % 4 === 0));
    expect(kinds('reticulated-giraffe').has(CELL_PATCHES)).toBe(true);
    expect(kinds('domestic-goat').has(CELL_SPOTS)).toBe(true);
    expect([...kinds('lion')]).toEqual([0]);
  });

  test('limb caps meet the cylinder without cracks at every detail level', () => {
    const before = detail.level;
    for (const level of [1, 0.8, 0.6]) {
      detail.level = level;
      const p = limb([0, 0, 0], [0, 1, 0], 0.1, 0.1).getAttribute('position');
      const rim = [];
      for (let i = 0; i < p.count; i++) if (Math.abs(p.getY(i)) < 1e-9) rim.push([p.getX(i), p.getZ(i)]);
      for (const a of rim) expect(rim.some((b) => b !== a && Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-9)).toBe(true);
    }
    detail.level = before;
  });

  test('the material shader replaces three.js vertex colours with the two-tone paint', () => {
    const shader = { vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
    material.onBeforeCompile(shader);
    expect(shader.vertexShader).toContain('attribute vec3 color2;');
    expect(shader.fragmentShader).not.toContain('#include <color_fragment>');
    expect(shader.fragmentShader).toContain('cellular(');
  });

  test('an unknown species throws', () => {
    expect(() => buildAnimal('unicorn')).toThrow();
  });
});
