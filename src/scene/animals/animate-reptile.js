// Poses for lizards and tortoises (reptile.js). The rig is back at rest when these run (animate.js);
// `t` already includes the rig's phase. Pure.

import { blink } from './blink.js';

const sin = Math.sin;
const cos = Math.cos;

/** Lizards: an S-wave down the spine and tail, sprawling legs that swing round their shoulders. */
export function animateLizard(rig, pose, t, amp) {
  const B = rig.bones;
  // Monitors flick the tongue out now and then; between flicks it is back in the mouth (scaled to nothing).
  if (B.tongue) {
    // While eating (foraging) it tastes the air continuously. Flicks are timed on the caller's clock (without the
    // rig's phase), with a flick out at t = 1 (still screenshots); each individual's period differs a little, so a
    // group drifts out of step after that.
    const raw = t - (rig.phase ?? 0);
    const every = (pose === 'walk' ? 2.1 : 3.2) + ((rig.phase ?? 0) % 1) * 0.7;
    const p = (((raw - 0.75) % every) + every) % every;
    const out = pose === 'eat' ? 0.75 + 0.25 * sin(t * 14) : pose !== 'sleep' && p < 0.5 ? Math.sin((p / 0.5) * Math.PI) : 0;
    B.tongue.scale.setScalar(Math.max(0.001, out));
    // With the head lowered to eat, the tongue tilts back up so it flicks over the ground, not into it.
    B.tongue.rotation.x += out * Math.sin(t * 40) * 0.08 - (pose === 'eat' ? 0.5 : 0);
  }
  const { legLen, bodyH } = rig.size;
  const sway = (ph, k) => ['tail0', 'tail1', 'tail2', 'tail3'].forEach((n, i) => (B[n].rotation.y += sin(ph - i * 0.9) * k * (0.6 + i * 0.25) * amp));
  if (pose === 'idle') {
    sway(t * 0.8, 0.08);
    // Head bobs now and then (iguanas), and a slow look around.
    const bob = t % 5 < 0.8 ? -Math.abs(sin(t * 12)) * 0.18 * amp : 0;
    B.neck0.rotation.x += bob;
    B.head.rotation.y += sin(t * 0.4) * 0.25 * amp;
    blink(rig, t);
  } else if (pose === 'walk') {
    const ph = t * (5 / (1 + legLen * 4));
    B.hips.rotation.y += sin(ph) * 0.12 * amp;
    B.chest.rotation.y -= sin(ph) * 0.26 * amp;
    B.neck0.rotation.y += sin(ph) * 0.12 * amp;
    for (const l of rig.legs) {
      const a = ph + ((l.front ? 1 : -1) * l.side > 0 ? 0 : Math.PI);
      // Swing forward and back round the shoulder; lift the foot while it moves forward.
      l.upper.rotation.y += -l.side * sin(a) * 0.5 * amp;
      l.upper.rotation.z += l.side * Math.max(0, cos(a)) * 0.35 * amp;
      l.foot.rotation.z -= l.side * Math.max(0, cos(a)) * 0.2 * amp;
    }
    sway(ph + 1.2, 0.2);
    blink(rig, t);
  } else if (pose === 'eat') {
    B.neck0.rotation.x += 0.3;
    B.head.rotation.x += 0.2 + sin(t * 5) * 0.08 * amp;
    sway(t, 0.06);
    blink(rig, t);
  } else if (pose === 'sleep') {
    // Belly down on the ground, legs relaxed out to the sides.
    B.hips.position.y -= Math.min(legLen * 0.15, bodyH * 0.25);
    for (const l of rig.legs) {
      l.upper.rotation.z += l.side * 0.28;
      l.foot.rotation.z -= l.side * 0.3;
    }
    B.neck0.rotation.x += 0.12;
    B.hips.scale.y *= 1 + sin(t * 1.1) * 0.02 * amp;
    sway(t * 0.3, 0.03);
    blink(rig, t, true);
  }
}

/** Tortoises: slow, heavy steps; asleep the head pulls into the shell. */
export function animateTurtle(rig, pose, t, amp) {
  const B = rig.bones;
  const { legLen, bodyH, neckLen } = rig.size;
  if (pose === 'idle') {
    B.head.rotation.y += sin(t * 0.4) * 0.35 * amp;
    B.neck0.rotation.x += sin(t * 0.3) * 0.08 * amp;
    blink(rig, t);
  } else if (pose === 'walk') {
    const ph = t * 2.2;
    for (const l of rig.legs) {
      const a = ph + ((l.front ? 1 : -1) * l.side > 0 ? 0 : Math.PI);
      l.upper.rotation.x += sin(a) * 0.35 * amp;
      l.lower.rotation.x -= Math.max(0, cos(a)) * 0.25 * amp;
    }
    B.hips.rotation.z = sin(ph) * 0.03 * amp;
    B.hips.position.y += Math.abs(cos(ph)) * bodyH * 0.03 * amp;
    B.neck0.rotation.x += sin(ph * 2) * 0.05 * amp;
    blink(rig, t);
  } else if (pose === 'eat') {
    B.neck0.rotation.x += 0.55;
    B.head.rotation.x += Math.max(0, sin(t * 4)) * 0.2 * amp;
    blink(rig, t);
  } else if (pose === 'sleep') {
    // Head pulled into the shell, the shell lowered onto shortened legs.
    B.neck0.position.z -= neckLen * 0.85;
    B.neck0.scale.setScalar(0.85);
    B.hips.position.y -= legLen * 0.25;
    for (const l of rig.legs) l.upper.scale.y = 0.6;
    B.hips.scale.y *= 1 + sin(t * 0.9) * 0.01 * amp;
    blink(rig, t, true);
  }
}
