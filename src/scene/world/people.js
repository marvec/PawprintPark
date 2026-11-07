// The keeper and the golf cart (PRD §4): toy-like, rounded figures in the same soft style as the animals.
// Pure scene building; `animateKeeper` poses the keeper without touching its own position or turn.

import * as THREE from 'three';
import { createKit } from './kit.js';

export const KEEPER_COLORS = {
  skin: 0xf0c8a0,
  shirt: 0xc9a86a,
  trousers: 0x5d7a45,
  boots: 0x6a4a32,
  cap: 0x3f6e48,
  hair: 0x6a4a32,
  eye: 0x2e2620,
  bucket: 0x5a9ad0,
};

const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 4, 10);
const sphere = (r) => new THREE.SphereGeometry(r, 14, 10);

/** A mesh from one kit-built part, with its own pivot. */
function part(material, name, build, pivot = [0, 0, 0]) {
  const kit = createKit();
  build(kit);
  const mesh = kit.mesh(material, { name });
  const holder = new THREE.Group();
  holder.name = name;
  holder.position.set(...pivot);
  holder.add(mesh);
  return holder;
}

/**
 * The keeper: about 1.75 m tall, big head, khaki shirt, green cap. Stands on y = 0, faces +z. `seated` bends the
 * legs for the cart.
 * @param {{ smooth: THREE.Material }} materials
 */
export function buildKeeper(materials, { bucket = true } = {}) {
  const m = materials.smooth;
  const C = KEEPER_COLORS;
  const s = { smooth: true };
  const group = new THREE.Group();
  group.name = 'keeper';
  const body = part(m, 'body', (k) => {
    k.add(capsule(0.23, 0.32), C.shirt, { y: 1.12, sz: 0.85 }, s);
    k.add(new THREE.CylinderGeometry(0.235, 0.235, 0.07, 14), C.boots, { y: 0.93 }, s);
    k.add(sphere(0.05), 0xd8b040, { y: 0.93, z: 0.2 }, s);
    // Collar and a pocket badge.
    k.add(new THREE.ConeGeometry(0.2, 0.12, 10), C.shirt, { y: 1.42, rx: Math.PI }, s);
    k.add(sphere(0.045), 0xe08a3a, { x: 0.1, y: 1.24, z: 0.19, sz: 0.4 }, s);
  });
  const head = part(m, 'head', (k) => {
    k.add(sphere(0.22), C.skin, { y: 0.2 }, s);
    k.add(sphere(0.03), C.eye, { x: -0.08, y: 0.22, z: 0.2 }, s);
    k.add(sphere(0.03), C.eye, { x: 0.08, y: 0.22, z: 0.2 }, s);
    k.add(sphere(0.04), 0xe8a888, { y: 0.16, z: 0.22 }, s);
    k.add(sphere(0.05), C.skin, { x: -0.215, y: 0.2, sz: 0.6 }, s);
    k.add(sphere(0.05), C.skin, { x: 0.215, y: 0.2, sz: 0.6 }, s);
    k.add(new THREE.SphereGeometry(0.235, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), C.cap, { y: 0.26 }, s);
    k.add(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 14, 1, false, -Math.PI / 2, Math.PI), C.cap, { y: 0.27, z: 0.12, sx: 1, sz: 0.9 }, s);
    k.add(sphere(0.12), C.hair, { y: 0.17, z: -0.12, sy: 0.8 }, s);
  }, [0, 1.44, 0]);
  const leg = (x) => part(m, x < 0 ? 'legL' : 'legR', (k) => {
    k.add(capsule(0.095, 0.42), C.trousers, { y: -0.3 }, s);
    k.add(capsule(0.1, 0.1), C.boots, { y: -0.78, z: 0.05, rx: Math.PI / 2, sy: 1.1 }, s);
  }, [x, 0.88, 0]);
  const arm = (x) => part(m, x < 0 ? 'armL' : 'armR', (k) => {
    k.add(capsule(0.075, 0.36), C.shirt, { y: -0.22 }, s);
    k.add(sphere(0.075), C.skin, { y: -0.5 }, s);
    if (bucket && x > 0) {
      k.add(new THREE.CylinderGeometry(0.15, 0.12, 0.24, 12, 1, true), C.bucket, { y: -0.72 }, s);
      k.add(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 12), C.bucket, { y: -0.83 }, s);
      k.add(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 12), 0xe8c86a, { y: -0.63 }, s);
    }
  }, [x, 1.36, 0]);
  const legL = leg(-0.11);
  const legR = leg(0.11);
  const armL = arm(-0.29);
  const armR = arm(0.29);
  armL.rotation.z = -0.12;
  armR.rotation.z = 0.12;
  group.add(body, head, legL, legR, armL, armR);
  group.traverse((o) => o.isMesh && (o.castShadow = true));
  return { group, rig: { head, legL, legR, armL, armR, body } };
}

/**
 * Poses the keeper: `walk` swings arms and legs, `idle` breathes and looks around, `sit` bends the legs (cart).
 * @param {ReturnType<typeof buildKeeper>['rig']} rig
 */
export function animateKeeper(rig, pose, t) {
  const { legL, legR, armL, armR, head, body } = rig;
  if (pose === 'walk') {
    const a = Math.sin(t * 7) * 0.55;
    legL.rotation.x = a;
    legR.rotation.x = -a;
    armL.rotation.x = -a * 0.8;
    armR.rotation.x = a * 0.5;
    body.position.y = Math.abs(Math.cos(t * 7)) * 0.04;
    head.position.y = 1.44 + body.position.y;
    head.rotation.y = 0;
  } else if (pose === 'sit') {
    legL.rotation.x = legR.rotation.x = -1.45;
    armL.rotation.x = armR.rotation.x = -0.9;
    body.position.y = 0;
    head.position.y = 1.44;
    head.rotation.y = Math.sin(t * 0.6) * 0.25;
  } else {
    legL.rotation.x = legR.rotation.x = 0;
    armL.rotation.x = armR.rotation.x = 0;
    body.position.y = Math.sin(t * 2) * 0.01;
    head.position.y = 1.44 + body.position.y;
    head.rotation.y = Math.sin(t * 0.5) * 0.4;
  }
}

/**
 * The golf cart: a white-and-green body, a canopy on four posts, a cargo bed with hay. About 2.6 m long, facing
 * +z. Returns where a seated keeper goes.
 * @param {{ flat: THREE.Material, smooth: THREE.Material }} materials
 */
export function buildCart(materials) {
  const group = new THREE.Group();
  group.name = 'golf-cart';
  const k = createKit();
  const r = createKit();
  const s = { smooth: true };
  const body = 0xf4f1e8;
  const green = 0x4f8a5a;
  // Chassis, nose, seat and cargo bed.
  r.add(new THREE.BoxGeometry(1.3, 0.35, 2.5), body, { y: 0.5 });
  r.add(new THREE.SphereGeometry(0.66, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), green, { y: 0.6, z: 0.95, sx: 1, sy: 0.75, sz: 0.65 }, s);
  r.add(new THREE.BoxGeometry(1.2, 0.18, 0.6), 0x3a3a3a, { y: 0.78, z: -0.05 });
  r.add(new THREE.BoxGeometry(1.2, 0.55, 0.14), 0x3a3a3a, { y: 1.05, z: -0.38, rx: -0.12 });
  k.add(new THREE.BoxGeometry(1.25, 0.3, 0.75), green, { y: 0.85, z: -0.9 });
  k.add(new THREE.BoxGeometry(1.05, 0.08, 0.6), 0x8a6446, { y: 1.0, z: -0.9 });
  k.add(new THREE.CylinderGeometry(0.28, 0.28, 0.6, 10), 0xe8c86a, { y: 1.25, z: -0.9, rz: Math.PI / 2 });
  // Canopy on four posts.
  for (const x of [-0.55, 0.55]) for (const z of [-0.35, 0.65]) k.add(new THREE.CylinderGeometry(0.035, 0.035, 1.3, 6), 0xdcdcdc, { x, y: 1.35, z });
  r.add(new THREE.BoxGeometry(1.4, 0.1, 1.5), green, { y: 2.02, z: 0.15 });
  r.add(new THREE.BoxGeometry(1.45, 0.05, 1.55), body, { y: 2.08, z: 0.15 });
  // Steering column and wheel.
  k.add(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 6), 0x3a3a3a, { x: -0.28, y: 1.02, z: 0.55, rx: -0.5 });
  r.add(new THREE.TorusGeometry(0.17, 0.03, 6, 14), 0x3a3a3a, { x: -0.28, y: 1.28, z: 0.42, rx: -1.1 }, s);
  // Wheels and lamps.
  for (const x of [-0.62, 0.62]) {
    for (const z of [-0.8, 0.8]) {
      r.add(new THREE.CylinderGeometry(0.27, 0.27, 0.2, 14), 0x2f2f2f, { x, y: 0.27, z, rz: Math.PI / 2 }, s);
      r.add(new THREE.CylinderGeometry(0.13, 0.13, 0.22, 10), 0xc8c8c8, { x, y: 0.27, z, rz: Math.PI / 2 }, s);
    }
  }
  for (const x of [-0.35, 0.35]) r.add(new THREE.SphereGeometry(0.08, 8, 6), 0xfff4c0, { x, y: 0.72, z: 1.42 }, s);
  const flat = k.mesh(materials.flat, { name: 'cart-parts' });
  const round = r.mesh(materials.smooth, { name: 'cart-body' });
  group.add(flat, round);
  return { group, seat: { x: -0.28, y: 0.62, z: -0.1 } };
}
