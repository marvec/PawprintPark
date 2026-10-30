// Poses for single-mesh pinnipeds (pinniped.js). The rig is back at rest when this runs (animate.js); `t` already
// includes the rig's phase. Pure.

import { blink } from './blink.js';

const sin = Math.sin;

/** Sea lions and seals: a galumphing, rocking walk; asleep, sea lions lower the chest and everyone rests the head. */
export function animatePinniped(rig, pose, t, amp) {
  const B = rig.bones;
  const { bodyH } = rig.size;
  const front = rig.legs.filter((l) => l.front);
  const rear = rig.legs.filter((l) => !l.front);
  if (pose === 'idle') {
    B.neck0.rotation.x += sin(t * 0.5) * 0.1 * amp;
    B.head.rotation.y += sin(t * 0.33) * 0.4 * amp;
    B.tail0.rotation.y += sin(t * 1.3) * 0.12 * amp;
    for (const l of rear) l.foot.rotation.x += sin(t * 1.3 + l.side) * 0.08 * amp;
    blink(rig, t);
  } else if (pose === 'walk') {
    const ph = t * 3.2;
    // The body humps forward: chest and hips lift in turn.
    B.hips.position.y += Math.max(0, sin(ph)) * bodyH * 0.1 * amp;
    B.hips.rotation.x = sin(ph) * 0.06 * amp;
    B.chest.rotation.x -= sin(ph + 1) * 0.06 * amp;
    for (const l of front) l.upper.rotation.x += sin(ph + (l.side > 0 ? 0 : Math.PI)) * 0.35 * amp;
    B.tail0.rotation.y += sin(ph) * 0.25 * amp;
    B.neck0.rotation.x -= sin(ph) * 0.1 * amp;
    blink(rig, t);
  } else if (pose === 'eat') {
    B.neck0.rotation.x += 0.6 + sin(t * 6) * 0.05 * amp;
    B.head.rotation.x += 0.2;
    blink(rig, t);
  } else if (pose === 'sleep') {
    if (rig.info.upright) {
      // Chest down on the ground, front flippers splayed flat.
      B.chest.rotation.x += rig.info.lift * 0.9;
      for (const l of front) {
        l.upper.rotation.x -= rig.info.lift * 0.9;
        l.upper.rotation.z += l.side * 0.5;
      }
    }
    B.neck0.rotation.x += 0.55;
    B.head.rotation.z += 0.2;
    B.hips.scale.y *= 1 + sin(t * 1.1) * 0.025 * amp;
    blink(rig, t, true);
  }
}
