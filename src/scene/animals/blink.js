// Eyes close briefly every few seconds, and stay shut while sleeping. `t` already includes the rig's phase.

/** @param {object} rig  animal rig (its eyes bone squashes the eye islands) */
export function blink(rig, t, closed = false) {
  const p = t % 4.3;
  rig.bones.eyes.scale.y = closed ? 0.06 : p < 0.14 ? 0.1 : 1;
}
