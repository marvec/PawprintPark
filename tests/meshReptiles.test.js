// Single-mesh pinnipeds, lizards and tortoises (src/scene/animals/mesh/pinniped.js, reptile.js). The generic checks
// (closed surface, ground contact, budgets, no drift, build time) run for every species in meshAnimals.test.js; these
// check what is particular to these body plans.

import { describe, expect, test } from 'bun:test';
import * as THREE from 'three';
import { resolveLook } from '../src/scene/animals/index.js';
import { animate, buildAnimal, buildTemplate, createMeshAnimalMaterial } from '../src/scene/animals/mesh/index.js';

const material = createMeshAnimalMaterial();
const worldPos = (bone) => {
  bone.updateWorldMatrix(true, false);
  return new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld);
};
/** Rest-pose geometry bounds, in the animal's own (unscaled) units. */
const bounds = (id, opts) => buildTemplate(id, opts).geometry.boundingBox;

describe('single-mesh pinnipeds', () => {
  test('rig: the pinniped family, two front and two rear flippers', () => {
    for (const id of ['california-sea-lion', 'harbour-seal']) {
      const { rig } = buildAnimal(id, { material });
      expect(rig.kind).toBe('mesh-pinniped');
      expect(rig.legs.filter((l) => l.front).length).toBe(2);
      expect(rig.legs.filter((l) => !l.front).length).toBe(2);
    }
  });

  test('sea lions prop themselves up; seals lie low', () => {
    const lion = bounds('california-sea-lion').max.y / resolveLook('california-sea-lion').body.h;
    const seal = bounds('harbour-seal').max.y / resolveLook('harbour-seal').body.h;
    expect(lion).toBeGreaterThan(seal * 1.4);
  });

  test('the harbour seal is spotted; asleep, a sea lion lowers its chest', () => {
    expect(buildTemplate('harbour-seal').geometry.getAttribute('pat').getX(0)).toBe(3);
    const { rig } = buildAnimal('california-sea-lion', { material });
    animate(rig, 'idle', 0, { blink: false });
    const awake = worldPos(rig.bones.head).y;
    animate(rig, 'sleep', 0);
    expect(worldPos(rig.bones.head).y).toBeLessThan(awake - 0.1);
  });
});

describe('single-mesh lizards', () => {
  test('rig: the lizard family, four legs and a tail of four bones', () => {
    const { rig } = buildAnimal('komodo-dragon', { material });
    expect(rig.kind).toBe('mesh-lizard');
    expect(rig.legs.length).toBe(4);
    for (const n of ['tail0', 'tail1', 'tail2', 'tail3']) expect(rig.bones[n]).toBeDefined();
  });

  test('the iguana has a crest of spikes above its back', () => {
    const L = resolveLook('green-iguana');
    const g = buildTemplate('green-iguana').geometry;
    const pos = g.getAttribute('position');
    let backTop = 0;
    for (let i = 0; i < pos.count; i++) if (Math.abs(pos.getZ(i)) < L.body.l * 0.5) backTop = Math.max(backTop, pos.getY(i));
    // Ground to the top of the body is about legs + body height; spikes stand well above that.
    expect(backTop).toBeGreaterThan(L.body.h * 2 + L.legs.len * 0.15);
  });

  test('walking swings the tail from side to side', () => {
    const { rig, group } = buildAnimal('green-iguana', { material });
    const tipX = (t) => {
      animate(rig, 'walk', t);
      group.updateMatrixWorld(true);
      return worldPos(rig.bones.tail3).x;
    };
    const xs = [0, 0.3, 0.6, 0.9, 1.2].map(tipX);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0.02);
  });
});

describe('single-mesh tortoises', () => {
  test('rig: the turtle family; a patterned shell and skin markings off it', () => {
    const { rig } = buildAnimal('leopard-tortoise', { material });
    expect(rig.kind).toBe('mesh-turtle');
    const g = buildTemplate('leopard-tortoise').geometry;
    expect(g.getAttribute('pat').getX(0)).toBe(2);
    const mark = g.getAttribute('mark').array;
    expect(mark.some((f) => f > 0)).toBe(true);
    expect(mark.some((f) => f < 0)).toBe(true);
  });

  test('asleep, the head pulls back into the shell', () => {
    const { rig } = buildAnimal('leopard-tortoise', { material });
    animate(rig, 'idle', 0, { blink: false });
    const awake = worldPos(rig.bones.head).z;
    animate(rig, 'sleep', 0);
    expect(worldPos(rig.bones.head).z).toBeLessThan(awake - rig.size.neckLen * 0.5);
    expect(rig.eyes.scale.y).toBeLessThan(0.2);
  });
});
