// Code-driven animation: every frame the rig goes back to its rest pose and the pose is applied on top, so nothing
// drifts. Pure (no DOM, no clock): the caller passes the time in seconds.

import { resetRest } from './rig.js';

export const POSES = ['idle', 'walk', 'eat', 'sleep'];

const sin = Math.sin;
const cos = Math.cos;

/** Eyes close briefly every few seconds (and stay shut while sleeping). `t` already includes the rig's phase. */
function blink(rig, t, closed = false) {
  if (!rig.eyes) return;
  const p = t % 4.3;
  rig.eyes.scale.y = closed ? 0.08 : p < 0.14 ? 0.12 : 1;
}

/**
 * Poses a rig.
 * @param {object} rig  from buildAnimal
 * @param {'idle'|'walk'|'eat'|'sleep'} pose
 * @param {number} t  time in seconds
 * @param {{ reduced?: boolean, blink?: boolean }} [opts]  reduced motion: smaller, slower movement; blink: false keeps
 *   the eyes open (except asleep), for repeatable screenshots
 */
export function animate(rig, pose, t, opts = {}) {
  resetRest(rig.rest);
  const tt = t + (rig.phase ?? 0);
  const amp = opts.reduced ? 0.4 : 1;
  switch (rig.kind) {
    case 'quad':
      quad(rig, pose, tt, amp);
      break;
    case 'bird':
    case 'penguin':
      bird(rig, pose, tt, amp);
      break;
    case 'pinniped':
      pinniped(rig, pose, tt, amp);
      break;
    case 'lizard':
      lizard(rig, pose, tt, amp);
      break;
    case 'turtle':
      turtle(rig, pose, tt, amp);
      break;
  }
  if (opts.blink === false && pose !== 'sleep' && rig.eyes) rig.eyes.scale.y = 1;
}

function quad(r, pose, t, amp) {
  const { legLen, bodyH } = r.size;
  const upright = r.stance === 'upright' && pose === 'idle';
  // Bigger animals move more slowly.
  const f = 7 / (1 + legLen * 3.2);
  if (pose === 'idle') {
    r.body.position.y += sin(t * 2) * bodyH * 0.015 * amp;
    r.neck.rotation.x += sin(t * 0.6) * 0.08 * amp;
    r.head.rotation.y += sin(t * 0.37) * 0.35 * amp;
    r.tail.rotation.y += sin(t * 2.6) * 0.3 * amp;
    if (r.trunk) r.trunk.rotation.x += sin(t * 1.1) * 0.12 * amp;
    blink(r, t);
    if (upright) {
      // Meerkat sentry: sit up on the haunches.
      r.body.rotation.x = -1.15;
      r.body.position.y += r.size.bodyL * 0.55;
      r.body.position.z -= r.size.bodyL * 0.45;
      r.neck.rotation.x = 1.0;
      for (const l of r.legs) l.g.rotation.x = l.front ? 1.0 : 1.35;
      // The tail props the sitting animal up, lying along the ground behind it.
      r.tail.rotation.x = 1.45;
    }
  } else if (pose === 'walk') {
    const ph = t * f;
    if (r.gait === 'hop') {
      const s = sin(ph);
      r.body.position.y += Math.max(0, s) * bodyH * 0.6;
      r.body.rotation.x = -s * 0.15 * amp;
      for (const l of r.legs) l.g.rotation.x = (l.front ? -1 : 1) * Math.max(0, s) * 0.6 * amp;
    } else {
      for (const l of r.legs) {
        const diag = (l.front ? 1 : -1) * l.side > 0 ? 0 : Math.PI;
        l.g.rotation.x = sin(ph + diag) * 0.42 * amp;
      }
      r.body.position.y += Math.abs(sin(ph)) * bodyH * 0.04 * amp;
      r.body.rotation.z = sin(ph) * 0.025 * amp;
    }
    r.neck.rotation.x += sin(ph * 2) * 0.05 * amp;
    r.tail.rotation.y += sin(ph) * 0.35 * amp;
    if (r.trunk) r.trunk.rotation.x += sin(ph) * 0.2 * amp;
    blink(r, t);
  } else if (pose === 'eat') {
    r.neck.rotation.x += 0.95;
    r.head.rotation.x += 0.15 + sin(t * 7) * 0.04 * amp;
    if (r.trunk) r.trunk.rotation.x += -0.5 + sin(t * 2) * 0.25 * amp;
    r.tail.rotation.y += sin(t * 2) * 0.25 * amp;
    blink(r, t);
  } else if (pose === 'sleep') {
    r.body.position.y -= legLen * 0.72;
    r.body.scale.y *= 1 + sin(t * 1.2) * 0.02 * amp;
    for (const l of r.legs) l.g.rotation.x = l.front ? -1.35 : 1.35;
    r.neck.rotation.x += 0.45;
    r.head.rotation.z += 0.25;
    if (r.trunk) r.trunk.rotation.x += -0.4;
    blink(r, t, true);
  }
}

function bird(r, pose, t, amp) {
  const { legLen } = r.size;
  const f = 9 / (1 + legLen * 3);
  if (pose === 'idle') {
    r.head.rotation.y += sin(t * 0.8) * 0.5 * amp;
    r.neck.rotation.x += sin(t * 0.5) * 0.06 * amp;
    r.tail.rotation.x += sin(t * 1.7) * 0.06 * amp;
    // A short wing stretch now and then.
    const burst = (t % 7) < 0.6;
    for (const w of r.wings) w.g.rotation.z = burst ? w.side * (0.4 + sin(t * 22) * 0.35) * amp : 0;
    blink(r, t);
  } else if (pose === 'walk') {
    const ph = t * f;
    for (const l of r.legs) l.g.rotation.x = sin(ph + (l.side > 0 ? 0 : Math.PI)) * 0.5 * amp;
    if (r.kind === 'penguin') {
      r.body.rotation.z = sin(ph) * 0.14 * amp;
      for (const w of r.wings) w.g.rotation.z = w.side * 0.35;
    } else {
      // The forward-and-back head bob of walking birds.
      r.neck.position.z += sin(ph * 2) * r.size.bodyL * 0.12 * amp;
      r.body.position.y += Math.abs(sin(ph)) * legLen * 0.03 * amp;
    }
    blink(r, t);
  } else if (pose === 'eat') {
    r.neck.rotation.x += 1.15 + Math.max(0, sin(t * 7)) * 0.2 * amp;
    blink(r, t);
  } else if (pose === 'sleep') {
    if (r.kind === 'penguin') {
      r.neck.rotation.x += 0.35;
    } else if (legLen > 0.4) {
      // Long-legged birds sleep standing on one leg with the head tucked in.
      r.legs[1].g.rotation.x = -1.6;
      r.neck.rotation.x += -0.5;
      r.head.rotation.y += 2.4;
    } else {
      r.body.position.y -= legLen * 0.85;
      r.neck.rotation.x += 0.35;
      for (const l of r.legs) l.g.scale.y = 0.15;
    }
    r.body.scale.y *= 1 + sin(t * 1.4) * 0.02 * amp;
    blink(r, t, true);
  }
}

function pinniped(r, pose, t, amp) {
  const [fl, fr, rear] = r.flippers;
  if (pose === 'idle') {
    r.neck.rotation.x += sin(t * 0.5) * 0.12 * amp;
    r.head.rotation.y += sin(t * 0.33) * 0.45 * amp;
    rear.g.rotation.y += sin(t * 1.3) * 0.15 * amp;
    blink(r, t);
  } else if (pose === 'walk') {
    const ph = t * 3.2;
    r.body.rotation.x = sin(ph) * 0.07 * amp;
    r.body.position.y += Math.abs(sin(ph)) * r.size.bodyH * 0.12 * amp;
    fl.g.rotation.x = sin(ph) * 0.45 * amp;
    fr.g.rotation.x = sin(ph + Math.PI) * 0.45 * amp;
    rear.g.rotation.y = sin(ph) * 0.3 * amp;
    r.neck.rotation.x += -sin(ph) * 0.12 * amp;
    blink(r, t);
  } else if (pose === 'eat') {
    r.neck.rotation.x += 0.7 + sin(t * 6) * 0.06 * amp;
    blink(r, t);
  } else if (pose === 'sleep') {
    if (r.upright) r.body.rotation.x = 0.22;
    r.neck.rotation.x += 0.55;
    r.head.rotation.z += 0.3;
    r.body.scale.y *= 1 + sin(t * 1.1) * 0.025 * amp;
    blink(r, t, true);
  }
}

function lizard(r, pose, t, amp) {
  const sway = (ph, k) => r.tail.forEach((s, i) => (s.rotation.y = sin(ph - i * 0.9) * k * amp));
  if (pose === 'idle') {
    sway(t * 0.8, 0.12);
    // Head bobs (iguanas) and tongue flicks (monitors).
    const bob = (t % 5) < 0.8;
    r.neck.rotation.x += bob ? -Math.abs(sin(t * 12)) * 0.2 * amp : 0;
    if (r.tongue) r.tongue.scale.z = (t % 3) < 0.35 ? Math.abs(sin(t * 18)) : 0.001;
    blink(r, t);
  } else if (pose === 'walk') {
    const ph = t * 4;
    r.body.rotation.y = sin(ph) * 0.14 * amp;
    for (const l of r.legs) l.g.rotation.y = sin(ph + ((l.front ? 1 : -1) * l.side > 0 ? 0 : Math.PI)) * 0.5 * amp;
    sway(ph, 0.25);
    r.neck.rotation.y = -sin(ph) * 0.12 * amp;
    if (r.tongue) r.tongue.scale.z = (t % 2) < 0.3 ? Math.abs(sin(t * 18)) : 0.001;
    blink(r, t);
  } else if (pose === 'eat') {
    r.neck.rotation.x += 0.4 + sin(t * 5) * 0.08 * amp;
    sway(t, 0.08);
    if (r.tongue) r.tongue.scale.z = 0.6 + sin(t * 9) * 0.3;
    blink(r, t);
  } else if (pose === 'sleep') {
    r.body.position.y -= r.size.legLen * 0.3;
    for (const l of r.legs) l.g.rotation.z = l.side * 0.35;
    sway(t * 0.3, 0.04);
    r.neck.rotation.x += 0.15;
    blink(r, t, true);
  }
}

function turtle(r, pose, t, amp) {
  const neckLen = r.size.neckLen;
  if (pose === 'idle') {
    r.head.rotation.y += sin(t * 0.4) * 0.4 * amp;
    r.neck.rotation.x += sin(t * 0.3) * 0.08 * amp;
    blink(r, t);
  } else if (pose === 'walk') {
    const ph = t * 2.2;
    for (const l of r.legs) l.g.rotation.x = sin(ph + ((l.front ? 1 : -1) * l.side > 0 ? 0 : Math.PI)) * 0.35 * amp;
    r.body.rotation.z = sin(ph) * 0.03 * amp;
    r.body.position.y += Math.abs(cos(ph)) * 0.005 * amp;
    blink(r, t);
  } else if (pose === 'eat') {
    r.neck.rotation.x += 0.55;
    r.head.rotation.x += Math.max(0, sin(t * 4)) * 0.2 * amp;
    blink(r, t);
  } else if (pose === 'sleep') {
    // Head pulled into the shell.
    r.neck.position.z -= neckLen * 0.85;
    r.neck.scale.setScalar(0.85);
    r.body.position.y -= r.size.legLen * 0.25;
    for (const l of r.legs) l.g.scale.y = 0.6;
    blink(r, t, true);
  }
}
