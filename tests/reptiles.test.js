// Pinnipeds, lizards and tortoises (src/scene/animals/pinniped.js, reptile.js). The generic checks
// (closed surface, ground contact, budgets, no drift, build time) run for every species in animals.test.js; these
// check what is particular to these body plans.

import { describe, expect, test } from 'bun:test';
import * as THREE from 'three';
import { resolveLook } from '../src/scene/animals/index.js';
import { animate, buildAnimal, buildTemplate, createAnimalMaterial } from '../src/scene/animals/index.js';

/** Vertices painted (mark > 0) with a marking colour. */
const painted = (id, opts, hex) => {
  const g = buildTemplate(id, opts).geometry;
  const c = g.getAttribute('color3').array;
  const m = g.getAttribute('mark');
  let n = 0;
  for (let i = 0; i < m.count; i++) if (m.getX(i) > 0 && c[i * 3] === (hex >> 16) && c[i * 3 + 1] === ((hex >> 8) & 255) && c[i * 3 + 2] === (hex & 255)) n++;
  return n;
};

const material = createAnimalMaterial();
const worldPos = (bone) => {
  bone.updateWorldMatrix(true, false);
  return new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld);
};
/** Rest-pose geometry bounds, in the animal's own (unscaled) units. */
const bounds = (id, opts) => buildTemplate(id, opts).geometry.boundingBox;

describe('pinnipeds', () => {
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

  test('pinniped faces: whisker pads, a nose pad, ear flaps on sea lions only', () => {
    expect(painted('california-sea-lion', { sex: 'female' }, 0xb08e6a)).toBeGreaterThan(40); // whisker pads
    expect(painted('california-sea-lion', { sex: 'female' }, 0x3a2a20)).toBeGreaterThan(10); // nose
    expect(buildAnimal('california-sea-lion', { material }).rig.bones.earL).toBeDefined();
    expect(buildAnimal('harbour-seal', { material }).rig.bones.earL).toBeUndefined();
  });
});

describe('lizards', () => {
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

  test('feet have toes with dark claws at their tips', () => {
    // Komodo claws: a marking at the toe tips (TIP → 0), on every foot.
    expect(painted('komodo-dragon', {}, 0x2e2a26)).toBeGreaterThan(4 * 3 * 4);
  });

  test('the Komodo dragon flicks a forked yellow tongue: out while eating, back in the mouth asleep', () => {
    expect(painted('komodo-dragon', {}, 0xe6c64a)).toBeGreaterThan(20);
    const { rig } = buildAnimal('komodo-dragon', { material });
    animate(rig, 'eat', 1);
    expect(rig.bones.tongue.scale.z).toBeGreaterThan(0.4);
    animate(rig, 'sleep', 1);
    expect(rig.bones.tongue.scale.z).toBeLessThan(0.01);
    // Idle flicks are timed so a still frame at t = 1 shows the tongue out.
    animate(rig, 'idle', 1);
    expect(rig.bones.tongue.scale.z).toBeGreaterThan(0.8);
  });

  test('lizard eyes sit on raised turrets with a lid ring round them', () => {
    expect(painted('green-iguana', {}, 0x86b85a)).toBeGreaterThan(10);
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

describe('tortoises', () => {
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
