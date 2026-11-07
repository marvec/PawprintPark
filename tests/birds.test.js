// Birds (src/scene/animals/bird.js): walking and perching birds and penguins. The generic checks
// (closed surface, finite geometry, budgets, ground contact, no drift) run over every species in animals.test.js;
// these check what is particular to birds, posed on the CPU with three.js's own bone transform.

import { describe, expect, test } from 'bun:test';
import * as THREE from 'three';
import { animate, buildAnimal, buildTemplate, createAnimalMaterial } from '../src/scene/animals/index.js';

const material = createAnimalMaterial();
const BIRDS = ['chicken', 'common-ostrich', 'chilean-flamingo', 'scarlet-macaw', 'gentoo-penguin'];

/** Lowest world-space y of the vertices weighted mostly to `bone`. */
function lowest(group, mesh, bone) {
  group.updateMatrixWorld(true);
  const k = mesh.skeleton.bones.findIndex((b) => b.name === bone);
  const si = mesh.geometry.getAttribute('skinIndex');
  const sw = mesh.geometry.getAttribute('skinWeight');
  const v = new THREE.Vector3();
  let m = Infinity;
  for (let i = 0; i < si.count; i++) {
    if (si.getX(i) !== k || sw.getX(i) < 0.5) continue;
    mesh.getVertexPosition(i, v);
    v.applyMatrix4(mesh.matrixWorld);
    m = Math.min(m, v.y);
  }
  return m;
}

/** Colours (as hex) the paint marks on the geometry use. */
function markColours(id, opts) {
  const g = buildTemplate(id, opts).geometry;
  const c = g.getAttribute('color3');
  const mark = g.getAttribute('mark');
  const out = new Set();
  for (let i = 0; i < c.count; i++) if (mark.getX(i) > 0) out.add((c.array[i * 3] << 16) | (c.array[i * 3 + 1] << 8) | c.array[i * 3 + 2]);
  return out;
}

describe('birds', () => {
  for (const id of BIRDS) {
    test(`${id}: a bird rig with two legs and two wings, standing on its toes`, () => {
      const { group, rig } = buildAnimal(id, { material });
      expect(rig.kind).toBe('mesh-bird');
      expect(rig.legs.map((l) => l.name)).toEqual(['R', 'L']);
      for (const b of ['wingL', 'wingR', 'neck0', 'neck1', 'head', 'tail0']) expect(rig.bones[b]).toBeDefined();
      animate(rig, 'idle', 0, { blink: false });
      // Both feet reach the ground.
      for (const l of rig.legs) expect(Math.abs(lowest(group, rig.mesh, `foot${l.name}`))).toBeLessThan(0.01);
    });
  }

  test('roosters and hens have a red comb and wattles; chicks have none', () => {
    const RED = 0xd6261f;
    expect(markColours('chicken', { sex: 'male' }).has(RED)).toBe(true);
    expect(markColours('chicken', { sex: 'female' }).has(RED)).toBe(true);
    expect(markColours('chicken', { age: 'baby' }).has(RED)).toBe(false);
    // The comb adds islands to the mesh, so the rooster has more triangles than the chick.
    expect(buildTemplate('chicken', { sex: 'male' }).stats.triangles).toBeGreaterThan(buildTemplate('chicken', { age: 'baby' }).stats.triangles);
  });

  test('paint: macaw wing bands and blue tail, flamingo black beak tip, penguin white front', () => {
    const macaw = markColours('scarlet-macaw');
    for (const c of [0xf2c230, 0x2456b8, 0xf4f0ea, 0x1f1c1b]) expect(macaw.has(c)).toBe(true);
    expect(markColours('chilean-flamingo').has(0x1d1a19)).toBe(true);
    expect(markColours('gentoo-penguin').has(0xf6f4ef)).toBe(true);
  });

  test('walking swings the legs in turn', () => {
    const { rig } = buildAnimal('chicken', { material });
    animate(rig, 'walk', 0.3);
    const [r, l] = rig.legs;
    expect(Math.sign(r.upper.rotation.x)).toBe(-Math.sign(l.upper.rotation.x));
  });

  test('asleep: flamingos stand on one leg, chickens sit down, eyes are shut', () => {
    const fl = buildAnimal('chilean-flamingo', { material });
    animate(fl.rig, 'sleep', 1);
    const [down, up] = fl.rig.legs.map((l) => lowest(fl.group, fl.rig.mesh, `foot${l.name}`));
    expect(Math.abs(down)).toBeLessThan(0.01);
    expect(up).toBeGreaterThan(0.2);
    expect(fl.rig.eyes.scale.y).toBeLessThan(0.2);

    const ch = buildAnimal('chicken', { material });
    animate(ch.rig, 'idle', 1, { blink: false });
    const standing = ch.rig.bones.hips.position.y;
    animate(ch.rig, 'sleep', 1);
    expect(ch.rig.bones.hips.position.y).toBeLessThan(standing - ch.rig.info.bodyLift * 0.8);
  });

  test('penguins waddle: the body rocks from side to side while walking', () => {
    const { rig } = buildAnimal('gentoo-penguin', { material });
    animate(rig, 'walk', 0.2);
    const a = rig.bones.hips.rotation.z;
    animate(rig, 'walk', 0.2 + Math.PI / (9 / (1 + rig.size.legLen * 3)));
    expect(Math.sign(rig.bones.hips.rotation.z)).toBe(-Math.sign(a));
  });
});
