// Pinniped cage: sea lions and seals. One lofted tube from the tail end to the nose, with the front flippers and the
// two rear flippers extruded from its faces, and ear flaps for sea lions. Sea lions (`upright`) prop the front half
// up on their front flippers; seals lie flat on their bellies. Units are metres; the animal faces +z, y = 0 is the
// ground. Sizes come from the species look (../looks.js).

import { Cage, v3 } from './cage.js';
import { after, chainWeights, densify, eyeSpec, faceCenter, faceChannel, limbFrames, loftSpine } from './reptile.js';

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Body rings, tail end to chest: [z (share of the half length), half width, half height (shares of the body's)].
 * The rings sit on the ground (centre height = half height) up to z = 0; from there the front half is raised by the
 * plan's lift.
 */
const BODY = [
  [-1.12, 0.2, 0.18, 'tail'],
  [-1.0, 0.34, 0.3, 'rearA'],
  [-0.84, 0.5, 0.46],
  [-0.55, 0.78, 0.72],
  [-0.2, 0.96, 0.92],
  [0.15, 1.0, 1.0],
  [0.42, 0.98, 1.0, 'shA'],
  [0.68, 0.84, 0.88],
];

/**
 * Builds the cage for a pinniped.
 * @param {object} L  resolved species look; M  resolved MESH_LOOKS entry; q  detail settings (index.js)
 */
export function buildPinnipedCage(L, M, q) {
  const b = L.body;
  const nk = L.neck;
  const hd = L.head;
  const sn = L.snout;
  const fl = L.flippers;
  const upright = !!L.upright;
  const lift = upright ? 0.5 : 0.06;
  const bones = ['seed', 'hips', 'chest', 'neck0', 'neck1', 'head', 'eyes', 'tail0'];
  const parents = { seed: null, hips: null, chest: 'hips', neck0: 'chest', neck1: 'neck0', head: 'neck1', eyes: 'head', tail0: 'hips' };
  if (M.earFlaps) {
    bones.push('earL', 'earR');
    parents.earL = parents.earR = 'head';
  }
  for (const n of ['FL', 'FR', 'BL', 'BR']) {
    bones.push(`upper${n}`, `lower${n}`, `foot${n}`);
    parents[`upper${n}`] = n[0] === 'F' ? 'chest' : 'tail0';
    parents[`lower${n}`] = `upper${n}`;
    parents[`foot${n}`] = `lower${n}`;
  }
  const cage = new Cage(bones);
  // Detail tier: 0 high (two subdivision levels), 1 medium, 2 low (one level over a denser cage).
  const tier = q.levels === 2 ? 0 : q.detail >= 0.7 ? 1 : 2;
  const total = b.l * 2.3 + nk.len + hd.l * 2;
  const step = total / [14, 100, 60][tier];

  // The front half pivots up round the middle of the back.
  const pivot = [0, b.h, 0];
  const raise = (p) => {
    const d = v3.sub(p, pivot);
    if (d[2] <= 0) return p;
    const k = Math.min(1, d[2] / (b.l * 0.35));
    const a = lift * k;
    return v3.add(pivot, [d[0], d[1] * Math.cos(a) + d[2] * Math.sin(a), -d[1] * Math.sin(a) + d[2] * Math.cos(a)]);
  };
  const keys = [];
  const stops = [-1.2, -0.75, 0.05];
  for (const [z, a, bb, name] of BODY) {
    const c = raise([0, b.h * bb, z * b.l]);
    keys.push({
      name,
      hold: name === 'shA' || name === 'rearA',
      c,
      a: b.w * a,
      b: b.h * bb,
      w: chainWeights(z, ['tail0', 'hips', 'chest'], stops, 0.2),
      // The belly lies on the ground (all of it for seals, the back half for sea lions).
      ch: (co, si) => ({ LEG: si < -0.8 && (z < 0.05 || !upright) ? 1 : -1 }),
    });
  }
  // Neck: from the top of the chest, at the look's angle.
  const front = keys[keys.length - 1].c;
  const nRoot = v3.add(front, raiseDir([0, b.h * 0.12, b.l * 0.12], lift));
  const dir = [0, Math.sin(nk.angle), Math.cos(nk.angle)];
  const end = v3.add(nRoot, v3.mul(dir, nk.len));
  const neckJoint = v3.add(front, [0, 0, 0]);
  keys.push({ c: v3.lerp(nRoot, end, 0.15), a: lerp(b.w * 0.84, nk.r, 0.55), b: lerp(b.h * 0.88, nk.r, 0.55), w: { chest: 0.6, neck0: 0.4 } });
  keys.push({ c: v3.lerp(nRoot, end, 0.6), a: nk.r * 0.95, b: nk.r * 0.98, w: { neck0: 0.6, neck1: 0.4 } });
  // Head.
  const p = M.pitch ?? 0.05;
  const hdir = [0, -Math.sin(p), Math.cos(p)];
  const hup = [0, Math.cos(p), Math.sin(p)];
  const at = (al, up) => v3.add(end, v3.add(v3.mul(hdir, al), v3.mul(hup, up)));
  const crest = M.crest ?? 0;
  const crestShape = (co, si) => [0, si > 0.85 ? crest : 0];
  const pads = (co, si) => [si < 0.2 ? sn.w * 0.12 : 0, si < -0.5 ? sn.h * 0.12 : 0];
  const head = [
    ['H0', -0.1 * hd.l, 0.05 * hd.h, 0.94 * hd.w, 0.94 * hd.h, { neck1: 0.3, head: 0.7 }, crest ? crestShape : undefined],
    ['H1', 0.4 * hd.l, 0.1 * hd.h, 1.0 * hd.w, 1.0 * hd.h, { head: 1 }, crest ? crestShape : undefined],
    ['H2', 0.85 * hd.l, 0.02 * hd.h, 0.86 * hd.w, 0.84 * hd.h, { head: 1 }],
    ['S0', 1.05 * hd.l + 0.45 * sn.l, -0.12 * hd.h, 1.12 * sn.w, 1.05 * sn.h, { head: 1 }, pads],
    ['S1', 1.05 * hd.l + 1.0 * sn.l, -0.14 * hd.h, 0.85 * sn.w, 0.8 * sn.h, { head: 1 }],
    ['T', 1.05 * hd.l + 1.3 * sn.l, -0.12 * hd.h, 0.4 * sn.w, 0.38 * sn.h, { head: 1 }],
  ];
  for (const [name, al, up, a, bb, w, shape] of head) keys.push({ name, c: at(al, up), a, b: bb, w, shape, hold: name === 'H0', step: hd.l * (tier ? 0.25 : 0.6) });
  const joints = {
    seed: [0, 0, 0],
    hips: [0, b.h * 0.9, -b.l * 0.35],
    chest: raise([0, b.h, b.l * 0.08]),
    tail0: [0, b.h * 0.45, -b.l * 0.78],
    neck0: neckJoint,
    neck1: v3.lerp(nRoot, end, 0.5),
    head: end,
  };
  const { spine, named } = loftSpine(cage, keys, step);

  // ---- Flippers ----------------------------------------------------------------------------------------------------
  const legInfo = [];
  const fColor = (k) => ({ WING: k, PS: 0.7 });
  for (const side of [1, -1]) {
    // Front flippers: down from the chest's lower sides. Sea lions stand on them, paddles flat on the ground,
    // pointing forward and out; seals hold them alongside the belly.
    const name = `F${side > 0 ? 'R' : 'L'}`;
    const fi = cage.faceBetween(named.shA, after(spine, named.shA), side > 0 ? 6 : 4);
    const fc = faceCenter(cage, fi);
    const fS = faceChannel(cage, fi, 'S');
    const f = fl.front;
    const W = { u: `upper${name}`, l: `lower${name}`, f: `foot${name}` };
    let specs;
    if (upright) {
      const x = side * (Math.abs(fc[0]) + f * 0.15);
      const wrist = [x * 1.05, f * 0.1, fc[2] + f * 0.15];
      const pdir = v3.norm([side * 0.55, 0, 1]);
      const flat = [-pdir[2], 0, pdir[0]];
      specs = [
        { c: v3.add(fc, [side * f * 0.12, -f * 0.1, 0]), a: f * 0.34, b: f * 0.3, w: { chest: 0.4, [W.u]: 0.6 }, ch: { S: fS, ...fColor(-1) } },
        { c: [x, lerp(fc[1], wrist[1], 0.55), fc[2] + f * 0.08], a: f * 0.26, b: f * 0.22, w: { [W.u]: 0.4, [W.l]: 0.6 }, ch: { S: fS, ...fColor(0.3) } },
        { c: wrist, a: f * 0.3, b: f * 0.1, flat, w: { [W.l]: 0.4, [W.f]: 0.6 }, ch: { S: fS, ...fColor(1), LEG: 1 } },
        { c: v3.add(wrist, v3.add(v3.mul(pdir, f * 0.45), [0, -f * 0.04, 0])), a: f * 0.36, b: f * 0.06, flat, w: { [W.f]: 1 }, ch: { S: fS, ...fColor(1), LEG: 1 } },
        { c: v3.add(wrist, v3.add(v3.mul(pdir, f * 0.85), [0, -f * 0.05, 0])), a: f * 0.24, b: f * 0.035, flat, w: { [W.f]: 1 }, ch: { S: fS, ...fColor(1), LEG: 1 } },
      ];
      joints[`lower${name}`] = specs[1].c;
      joints[`foot${name}`] = wrist;
    } else {
      const pdir = v3.norm([side * 0.7, -0.25, -0.65]);
      const flat = [-pdir[2], 0, pdir[0]];
      const base = v3.add(fc, [side * f * 0.1, -f * 0.05, 0]);
      specs = [
        { c: base, a: f * 0.32, b: f * 0.26, w: { chest: 0.4, [W.u]: 0.6 }, ch: { S: fS, ...fColor(-1) } },
        { c: v3.add(base, v3.mul(pdir, f * 0.4)), a: f * 0.32, b: f * 0.1, flat, w: { [W.u]: 0.3, [W.l]: 0.7 }, ch: { S: fS, ...fColor(1) } },
        { c: v3.add(base, v3.mul(pdir, f * 0.8)), a: f * 0.3, b: f * 0.06, flat, w: { [W.l]: 0.3, [W.f]: 0.7 }, ch: { S: fS, ...fColor(1) } },
        { c: v3.add(base, v3.mul(pdir, f * 1.1)), a: f * 0.18, b: f * 0.04, flat, w: { [W.f]: 1 }, ch: { S: fS, ...fColor(1) } },
      ];
      joints[`lower${name}`] = specs[1].c;
      joints[`foot${name}`] = specs[2].c;
    }
    cage.extrude(fi, limbFrames(densify(specs, tier ? 2 : 1), fc, [0, 0, 1]));
    joints[`upper${name}`] = [fc[0] * 0.6, fc[1] + f * 0.05, fc[2]];
    legInfo.push({ name, front: true, side, len: f });

    // Rear flippers: from the tail end's lower sides, back and out, flat on the ground.
    const rn = `B${side > 0 ? 'R' : 'L'}`;
    const ri = cage.faceBetween(named.rearA, after(spine, named.rearA), side > 0 ? 6 : 4);
    const rc = faceCenter(cage, ri);
    const rS = faceChannel(cage, ri, 'S');
    const r = fl.rear;
    const pdir = v3.norm([side * 0.42, 0, -1]);
    const flat = [-pdir[2], 0, pdir[0]];
    const RW = { u: `upper${rn}`, l: `lower${rn}`, f: `foot${rn}` };
    const lowY = r * 0.06;
    const rs = [
      { c: v3.add(rc, [side * r * 0.08, -r * 0.03, -r * 0.12]), a: r * 0.2, b: r * 0.16, w: { tail0: 0.4, [RW.u]: 0.6 }, ch: { S: rS, ...fColor(-1) } },
      { c: [rc[0] + side * r * 0.22, lowY + r * 0.04, rc[2] - r * 0.42], a: r * 0.24, b: r * 0.07, flat, w: { [RW.u]: 0.3, [RW.l]: 0.7 }, ch: { S: rS, ...fColor(1), LEG: 1 } },
      { c: [rc[0] + side * r * 0.4, lowY, rc[2] - r * 0.78], a: r * 0.34, b: r * 0.05, flat, w: { [RW.l]: 0.3, [RW.f]: 0.7 }, ch: { S: rS, ...fColor(1), LEG: 1 } },
      { c: [rc[0] + side * r * 0.52, lowY, rc[2] - r * 1.02], a: r * 0.4, b: r * 0.035, flat, w: { [RW.f]: 1 }, ch: { S: rS, ...fColor(1), LEG: 1 } },
    ];
    cage.extrude(ri, limbFrames(densify(rs, tier ? 2 : 1), rc, [0, 0, 1]));
    joints[`upper${rn}`] = [rc[0] * 0.5, rc[1], rc[2]];
    joints[`lower${rn}`] = rs[1].c;
    joints[`foot${rn}`] = rs[2].c;
    legInfo.push({ name: rn, front: false, side, len: r });
  }

  // ---- Ear flaps (sea lions): small rolled flaps behind the eyes -----------------------------------------------------
  if (M.earFlaps) {
    for (const side of [1, -1]) {
      const bone = side > 0 ? 'earR' : 'earL';
      const fi = cage.faceBetween(named.H0, after(spine, named.H0), side > 0 ? 0 : 2);
      const fc = faceCenter(cage, fi);
      joints[bone] = fc;
      const t = v3.norm([side * 0.6, 0.2, -1]);
      const e = hd.h * 0.32;
      const w = { head: 0.2, [bone]: 0.8 };
      cage.extrude(fi, [
        { c: v3.add(fc, v3.mul(t, e * 0.35)), t, s: [0, 1, 0], a: e * 0.22, b: e * 0.14, w },
        { c: v3.add(fc, v3.add(v3.mul(t, e * 0.85), [0, -e * 0.15, 0])), t, s: [0, 1, 0], a: e * 0.14, b: e * 0.06, w },
      ]);
    }
  }

  const ey = M.eye ?? { t: 0.45, ang: 0.3, fwd: 0.55 };
  const eyeAlong = lerp(head[1][1], head[2][1], ey.t);
  const eyes = eyeSpec({ snout: head[head.length - 1][1] - eyeAlong, band: 0.16 * hd.l, size: (L.eyes?.size ?? hd.h * 0.2) * (M.eyeScale ?? 1.6), hdir, hup, ang: ey.ang, fwd: ey.fwd });
  return { cage, joints, parents, eyes, info: { kind: 'mesh-pinniped', plan: L.plan, upright, lift, legs: legInfo, legLen: b.h, bodyH: b.h, bodyL: b.l, neckLen: nk.len } };
}

/** An offset turned up by the front half's lift. */
function raiseDir(d, lift) {
  return [d[0], d[1] * Math.cos(lift) + d[2] * Math.sin(lift), -d[1] * Math.sin(lift) + d[2] * Math.cos(lift)];
}
