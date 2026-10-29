// Poses for single-mesh birds (bird.js): walking and perching birds, and penguins. Bones go back to rest every frame
// (animate.js); `t` already includes the rig's phase.

import { blink } from './blink.js';

const sin = Math.sin;
const cos = Math.cos;

/**
 * @param {object} rig  from buildAnimal (kind 'mesh-bird')
 * @param {'idle'|'walk'|'eat'|'sleep'} pose
 * @param {number} t  seconds, with the rig's phase
 * @param {number} amp  1, or less for reduced motion
 */
export function animateBird(rig, pose, t, amp) {
  const B = rig.bones;
  const { legLen, bodyL } = rig.size;
  const penguin = rig.info.penguin;
  const f = 9 / (1 + legLen * 3);
  const wings = (k) => {
    B.wingR.rotation.z += k;
    B.wingL.rotation.z -= k;
  };
  if (pose === 'idle') {
    B.head.rotation.y += sin(t * 0.8) * 0.5 * amp;
    B.neck0.rotation.x += sin(t * 0.5) * 0.06 * amp;
    B.tail0.rotation.x += sin(t * 1.7) * 0.06 * amp;
    // A short wing stretch now and then.
    if (t % 7 < 0.6) wings((0.4 + sin(t * 22) * 0.3) * amp);
    blink(rig, t);
  } else if (pose === 'walk') {
    const ph = t * f;
    for (const l of rig.legs) {
      const a = ph + (l.side > 0 ? 0 : Math.PI);
      const lift = Math.max(0, -cos(a));
      l.upper.rotation.x = sin(a) * (penguin ? 0.35 : 0.45) * amp;
      // The foot folds back while the leg swings forward, then the toes reach out again.
      l.lower.rotation.x = lift * 0.7 * amp;
      l.foot.rotation.x = -lift * 0.6 * amp;
    }
    if (penguin) {
      // Waddle: the body rocks from foot to foot, flippers held out.
      B.hips.rotation.z = sin(ph) * 0.14 * amp;
      wings(0.35);
    } else {
      // The forward-and-back head bob of walking birds.
      B.neck0.position.z += sin(ph * 2) * bodyL * 0.1 * amp;
      B.hips.position.y += Math.abs(sin(ph)) * legLen * 0.03 * amp;
    }
    B.tail0.rotation.y += sin(ph) * 0.1 * amp;
    blink(rig, t);
  } else if (pose === 'eat') {
    // Pecking.
    const peck = Math.max(0, sin(t * 7)) * 0.2 * amp;
    B.neck0.rotation.x += (penguin ? 0.5 : 0.75) + peck;
    B.neck1.rotation.x += (penguin ? 0.2 : 0.45) + peck * 0.5;
    B.head.rotation.x += 0.2;
    B.tail0.rotation.x -= 0.15;
    blink(rig, t);
  } else if (pose === 'sleep') {
    if (penguin) {
      B.neck0.rotation.x += 0.35;
      B.head.rotation.x += 0.3;
    } else if (legLen > 0.4) {
      // Long-legged birds sleep standing on one leg (the other folded up under the belly), the neck laid back
      // and the head turned onto the back.
      const l = rig.legs[1];
      // (The shank is shortened as if drawn up into the belly feathers.)
      l.upper.rotation.x = -1.0;
      l.lower.rotation.x = 2.9;
      l.lower.scale.y = 0.45;
      l.foot.rotation.x = -1.2;
      B.neck0.rotation.x -= 0.7;
      B.neck1.rotation.x += 1.1;
      B.head.rotation.y += 2.6;
      B.head.rotation.x += 0.4;
    } else {
      // Short-legged birds sit down on their folded legs.
      B.hips.position.y -= rig.info.bodyLift * 0.9;
      for (const l of rig.legs) {
        l.upper.rotation.x = -0.9;
        l.lower.rotation.x = 1.9;
        l.foot.rotation.x = -1.0;
      }
      B.neck0.rotation.x += 0.35;
      B.neck1.rotation.x -= 0.2;
    }
    // Breathing (in the chest, so a bird standing asleep keeps its foot on the ground).
    B.chest.scale.y *= 1 + sin(t * 1.4) * 0.02 * amp;
    blink(rig, t, true);
  }
}
