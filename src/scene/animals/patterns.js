// Coat patterns painted into vertex colours. Each pattern returns a paint function
// (lx, ly, lz, ax, ay, az) → hex | [a, b, field], where l* are segment-local and a* are animal-space coordinates
// (metres, rest pose). Patterns use animal space, so stripes and patches continue across body, neck and legs.
//
// Two-colour patterns return [a, b, field]: the material shows b where the field is above zero, deciding per pixel
// (shapes.js, rig.js). Fields should be smooth and roughly proportional to distance from the edge, so the edge is
// clean between vertices.
//
// Cell patterns (patches, spots) have details finer than the mesh, so the shader computes them per pixel from the
// rest-pose position: they return [a, b, 0, cell] with cell = [kind, size, width, param, seed] (CELL_* in rig.js).
// The seed shifts the pattern; it comes from the look, never from Math.random().

import { CELL_PATCHES, CELL_SPOTS } from './rig.js';

/** Mixes two hex colours: t = 0 → a, 1 → b. */
export function mix(a, b, t) {
  const r = ((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * t;
  const g = ((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * t;
  const bl = (a & 255) + ((b & 255) - (a & 255)) * t;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}

/** Two colours split by a field: `b` where field(...) > 0, else `a`. The field gets the paint's arguments. */
export function split(a, b, field) {
  return (...p) => [a, b, field(...p)];
}

/** Solid colour, with a lighter belly below `beltY` (segment-local, relative to the segment's centre). */
export function belly(top, under, beltY = 0) {
  return (lx, ly) => [top, under, beltY - ly];
}

/**
 * Bands across the body (zebra, tiger). `freq` = stripes per 2 metres along z, `width` = share of the period that
 * is striped (0.5 = equal bands), `tilt` bends them with height. The field is the distance to the nearest stripe
 * edge, so edges stay straight between vertices.
 */
export function stripes({ base, stripe, freq = 6, width = 0.35, tilt = 0.8, wobble = 0.25, belly: under, beltY = -Infinity, taper }) {
  const half = Math.acos(1 - width * 2) / (Math.PI * 2);
  return (lx, ly, lz, ax, ay, az) => {
    if (under !== undefined && ly < beltY) return under;
    const q = ((az + ay * tilt + Math.sin(ay * 9 + ax * 3) * wobble * 0.3) * freq) / 2 - 0.25;
    const fromCentre = 0.5 - Math.abs(q - Math.floor(q) - 0.5);
    // taper: [y0, y1] in animal space; stripes narrow to points below y1 and stop at y0 (tiger flanks).
    const k = taper ? Math.min(1, Math.max(0, (ay - taper[0]) / (taper[1] - taper[0]))) : 1;
    return [base, stripe, half * k - fromCentre];
  };
}

/** Polygonal patches separated by lines (giraffe, tortoise shell). Sizes in metres; each patch is up to `tint` darker. */
export function patches({ base, line, size = 0.22, lineWidth = 0.12, seed = 1, tint = 0.12 }) {
  const cell = [CELL_PATCHES, size, lineWidth, tint, seed];
  return () => [base, line, 0, cell];
}

/** Round spots on a base colour (goat, seal). `density` = share of cells that get a spot; `radius` in cell units. */
export function spots({ base, spot, size = 0.08, radius = 0.32, density = 0.7, seed = 1 }) {
  const cell = [CELL_SPOTS, size, radius, density, seed];
  return () => [base, spot, 0, cell];
}

/** Rings along an axis of the segment (red panda tail). */
export function rings({ base, ring, period = 0.08, axis = 'z' }) {
  return (lx, ly, lz) => {
    const v = { x: lx, y: ly, z: lz }[axis];
    return [base, ring, -Math.sin((Math.abs(v) / period) * Math.PI)];
  };
}

/** Darker towards the tip of a limb (legs, ears): below `y` (segment-local) the colour becomes `tip`. */
export function tipped(base, tip, y) {
  return (lx, ly) => [base, tip, y - ly];
}

/** Wraps a paint so a region defined by a predicate gets another colour; predicate receives the same args. */
export function where(paint, test, color) {
  const p = typeof paint === 'function' ? paint : () => paint;
  return (...a) => (test(...a) ? color : p(...a));
}
