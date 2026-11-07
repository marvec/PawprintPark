// The starting layout of a new zoo (PRD §3): the entrance gate with its sign, a small storehouse and two Farmyard
// enclosures. One is empty; the other holds the neglected sheep from the tutorial (§15.1). All of it sits in the
// flat start area at the middle of the map's south edge, with the gate facing the road in.

import { startArea } from './map.js';

/**
 * Footprints relative to the start area's south-west corner (x0, z1). The gate's front faces into the zoo (north),
 * the enclosures face the path between them.
 */
const LAYOUT = [
  { kind: 'entrance-gate', dx: 21, dz: -2, rot: 2 },
  { kind: 'storehouse', dx: 28, dz: -8, rot: 3 },
  { kind: 'enclosure', size: 'S', biome: 'farmyard', dx: 12, dz: -18, rot: 1, sheep: true },
  { kind: 'enclosure', size: 'S', biome: 'farmyard', dx: 31, dz: -18, rot: 3 },
];

/**
 * The placements of a new zoo, with ids from `firstId` up, and which enclosure gets the sheep.
 * @returns {{ placements: import('./paths.js').Placement[], sheepEnclosure: number, nextId: number }}
 */
export function startingLayout(firstId = 1) {
  const a = startArea();
  let id = firstId;
  let sheepEnclosure = -1;
  const placements = LAYOUT.map((l) => {
    const p = { id: id++, kind: l.kind, x: a.x0 + l.dx, z: a.z1 + l.dz, rot: l.rot };
    if (l.kind === 'enclosure') Object.assign(p, { size: l.size, biome: l.biome });
    if (l.sheep) sheepEnclosure = p.id;
    return /** @type {import('./paths.js').Placement} */ (p);
  });
  return { placements, sheepEnclosure, nextId: id };
}
