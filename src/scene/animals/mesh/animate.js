// Poses for single-mesh animals: every frame the bones go back to rest and the pose is applied on top, so nothing
// drifts. The animal's own group is never touched. Pure: the caller passes the time in seconds.

export const POSES = ['idle', 'walk', 'eat', 'sleep'];

const sin = Math.sin;
const cos = Math.cos;

function reset(rest) {
  for (const [b, r] of rest) {
    b.position.copy(r.p);
    b.quaternion.copy(r.q);
    b.scale.copy(r.s);
  }
}

/** Eyes close briefly every few seconds, and stay shut while sleeping. */
function blink(r, t, closed) {
  const p = t % 4.3;
  r.bones.eyes.scale.y = closed ? 0.06 : p < 0.14 ? 0.1 : 1;
}

/**
 * Poses a rig.
 * @param {object} rig  from buildAnimal
 * @param {'idle'|'walk'|'eat'|'sleep'} pose
 * @param {number} t  time in seconds
 * @param {{ reduced?: boolean, blink?: boolean }} [opts]  reduced motion; blink: false keeps the eyes open (not asleep)
 */
export function animate(rig, pose, t, opts = {}) {
  reset(rig.rest);
  const tt = t + (rig.phase ?? 0);
  const amp = opts.reduced ? 0.4 : 1;
  const B = rig.bones;
  const { legLen, bodyH } = rig.size;
  const cat = rig.plan === 'cat';
  const f = 7 / (1 + legLen * 3.2);
  const tailSway = (k, speed) => {
    B.tail0.rotation.y += sin(tt * speed) * k * 0.5 * amp;
    B.tail1.rotation.y += sin(tt * speed - 0.8) * k * 0.7 * amp;
    B.tail2.rotation.y += sin(tt * speed - 1.6) * k * amp;
  };
  const trunk = (k, base = 0) => {
    if (!B.trunk0) return;
    B.trunk0.rotation.x += base * 0.4 + sin(tt * 1.1) * k * 0.4;
    B.trunk1.rotation.x += base * 0.6 + sin(tt * 1.1 - 0.7) * k * 0.6;
    B.trunk2.rotation.x += base + sin(tt * 1.1 - 1.4) * k;
  };
  const ears = (k) => {
    const flick = tt % 5.7 < 0.25 ? sin(tt * 40) * 0.25 : 0;
    B.earR.rotation.z += (flick + sin(tt * 0.9) * 0.05) * k;
    B.earL.rotation.z -= sin(tt * 0.9 + 1) * 0.05 * k;
  };

  if (pose === 'idle') {
    B.hips.position.y += sin(tt * 2) * bodyH * 0.012 * amp;
    B.neck0.rotation.x += sin(tt * 0.6) * 0.05 * amp;
    B.neck1.rotation.x += sin(tt * 0.6) * 0.04 * amp;
    B.head.rotation.y += sin(tt * 0.37) * 0.3 * amp;
    tailSway(0.25, 2.6);
    trunk(0.12 * amp);
    ears(amp);
    blink(rig, tt);
  } else if (pose === 'walk') {
    const ph = tt * f;
    for (const l of rig.legs) {
      const diag = (l.front ? 1 : -1) * l.side > 0 ? 0 : Math.PI;
      const a = ph + diag;
      const swing = Math.max(0, -cos(a));
      l.upper.rotation.x = sin(a) * 0.4 * amp;
      // Lift the foot while the leg swings forward: front knees fold back, hind hocks fold forward.
      if (l.front) {
        l.lower.rotation.x = swing * 0.9 * amp;
        l.foot.rotation.x = swing * 0.3 * amp;
      } else {
        l.lower.rotation.x = -swing * 0.35 * amp;
        l.foot.rotation.x = swing * 0.8 * amp;
      }
    }
    B.hips.position.y += Math.abs(sin(ph)) * bodyH * 0.04 * amp;
    B.hips.rotation.z = sin(ph) * 0.02 * amp;
    B.neck0.rotation.x += sin(ph * 2) * 0.04 * amp;
    B.head.rotation.x += -sin(ph * 2) * 0.03 * amp;
    tailSway(0.3, f);
    trunk(0.2 * amp);
    blink(rig, tt);
  } else if (pose === 'eat') {
    B.neck0.rotation.x += 0.6;
    B.neck1.rotation.x += 0.45;
    B.head.rotation.x += 0.25 + sin(tt * 7) * 0.04 * amp;
    tailSway(0.2, 2);
    trunk(0.25 * amp, -0.5);
    ears(amp);
    blink(rig, tt);
  } else if (pose === 'sleep') {
    B.hips.position.y -= legLen * 0.72;
    B.hips.scale.y *= 1 + sin(tt * 1.2) * 0.015 * amp;
    for (const l of rig.legs) {
      if (cat) {
        // Cats lie with the forelegs stretched out in front and the hind legs folded alongside.
        if (l.front) {
          l.upper.rotation.x = -1.25;
          l.lower.rotation.x = 0.1;
          l.foot.rotation.x = 1.0;
        } else {
          l.upper.rotation.x = -0.9;
          l.lower.rotation.x = 1.9;
          l.foot.rotation.x = -0.8;
        }
      } else if (l.front) {
        // Hoofed animals fold the forelegs under the chest.
        l.upper.rotation.x = -0.35;
        l.lower.rotation.x = 2.3;
        l.foot.rotation.x = 0.4;
      } else {
        l.upper.rotation.x = -0.7;
        l.lower.rotation.x = 0.4;
        l.foot.rotation.x = 1.6;
      }
    }
    B.neck0.rotation.x += 0.3;
    B.neck1.rotation.x += 0.2;
    B.head.rotation.z += 0.2;
    tailSway(0.05, 0.4);
    trunk(0.05, -0.3);
    blink(rig, tt, true);
  }
  if (opts.blink === false && pose !== 'sleep') B.eyes.scale.y = 1;
}
