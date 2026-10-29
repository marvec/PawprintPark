// A coarse quad cage, built like a box-modeller would: a lofted tube (the spine, rump to nose) with limbs, tail and
// ears extruded from its faces, plus closed islands (eyes). Catmull-Clark (subdivide.js) turns it into one smooth,
// watertight surface. Each vertex carries a data vector: position, skin weights per bone, and named channels.
// Pure: no three.js.

/** Channels carried through subdivision (after the position and the bone weights). */
// FUR: 0 at the root of a hair mass (mane, ruff) to 1 at its tips. BEAK, WING, SHELL: signed part fields (positive
// on the part). AUX: a free signed field a builder can use for one species-specific marking.
export const CHANNELS = ['S', 'UNDER', 'SNOUT', 'TAIL', 'MANE', 'RIDGE', 'EAR', 'TIP', 'EYE', 'GLINT', 'TUSK', 'LEG', 'PS', 'FUR', 'BEAK', 'WING', 'SHELL', 'AUX', 'NOSE'];
/** Value for "far from this feature" in distance-like channels (metres). */
export const FAR = 4;

const DEFAULTS = { S: 0, UNDER: 0, SNOUT: FAR, TAIL: FAR, MANE: -1, RIDGE: -3, EAR: -1, TIP: FAR, EYE: -1, GLINT: -1, TUSK: -1, LEG: -1, PS: 1, FUR: -1, BEAK: -1, WING: -1, SHELL: -1, AUX: -1, NOSE: -1 };

export const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
};

/**
 * Catmull-Clark pulls the surface inside its cage. These factors push ring vertices out so the limit surface lands
 * near the requested radii (a uniform cubic B-spline over a regular n-gon reaches about 0.90–0.94 of its radius).
 */
const PUFF = { 8: 1.1, 4: 1.08 };

export class Cage {
  /** @param {string[]} bones  bone names, in skeleton order */
  constructor(bones) {
    this.bones = bones;
    this.boneIndex = Object.fromEntries(bones.map((b, i) => [b, i]));
    this.stride = 3 + bones.length + CHANNELS.length;
    this.chOffset = 3 + bones.length;
    /** @type {number[]} */
    this.data = [];
    /** @type {number[][]} */
    this.faces = [];
    this.count = 0;
  }

  /**
   * Adds a vertex.
   * @param {number[]} p  position
   * @param {Record<string, number>} w  bone name → weight (normalised here)
   * @param {Record<string, number>} [ch]  channel values; the rest get defaults
   */
  vert(p, w, ch = {}) {
    const row = new Array(this.stride).fill(0);
    row[0] = p[0];
    row[1] = p[1];
    row[2] = p[2];
    let sum = 0;
    for (const k in w) sum += w[k];
    for (const k in w) {
      const i = this.boneIndex[k];
      if (i === undefined) throw new Error(`Unknown bone ${k}`);
      row[3 + i] += w[k] / sum;
    }
    CHANNELS.forEach((c, i) => (row[this.chOffset + i] = ch[c] ?? DEFAULTS[c]));
    this.data.push(...row);
    return this.count++;
  }

  pos(i) {
    const o = i * this.stride;
    return [this.data[o], this.data[o + 1], this.data[o + 2]];
  }

  set(i, name, value) {
    this.data[i * this.stride + this.chOffset + CHANNELS.indexOf(name)] = value;
  }

  ch(i, name) {
    return this.data[i * this.stride + this.chOffset + CHANNELS.indexOf(name)];
  }

  face(...idx) {
    this.faces.push(idx);
  }

  /**
   * Adds one ring of n vertices around a centre. Frame: tangent t, side axis s (made perpendicular to t), and
   * u = t × s. Vertex k sits at angle phase + k·360°/n from s towards u, at radii a (along s) and b (along u).
   * `shape(cos, sin)` → [da, db, ch] lets a ring bulge (crests, manes); `ch(cos, sin)` gives per-vertex channels.
   */
  ring({ c, t, s = [1, 0, 0], a, b, n = 8, w, ch, shape }) {
    const T = v3.norm(t);
    const S = v3.norm(v3.sub(s, v3.mul(T, v3.dot(s, T))));
    const U = v3.cross(T, S);
    const phase = n === 8 ? Math.PI / 8 : Math.PI / 4;
    const k = PUFF[n] ?? 1.05;
    const out = [];
    for (let i = 0; i < n; i++) {
      const ang = phase + (i * Math.PI * 2) / n;
      const co = Math.cos(ang);
      const si = Math.sin(ang);
      let ra = a;
      let rb = b;
      if (shape) {
        const [da, db] = shape(co, si);
        ra += da;
        rb += db;
      }
      const p = v3.add(c, v3.add(v3.mul(S, co * ra * k), v3.mul(U, si * rb * k)));
      out.push(this.vert(p, w, typeof ch === 'function' ? ch(co, si) : ch));
    }
    out.frame = { T, S, U };
    return out;
  }

  /** Joins two rings with the same vertex count by quads (outward when ring order is counter-clockwise about t). */
  bridge(r1, r2) {
    const n = r1.length;
    for (let i = 0; i < n; i++) this.face(r1[i], r1[(i + 1) % n], r2[(i + 1) % n], r2[i]);
  }

  /** Lofts rings into a tube; caps the start (facing back) and/or the end (facing forward). */
  tube(rings, { capStart = true, capEnd = true } = {}) {
    for (let i = 0; i + 1 < rings.length; i++) this.bridge(rings[i], rings[i + 1]);
    if (capStart) this.face(...[...rings[0]].reverse());
    if (capEnd) this.face(...rings[rings.length - 1]);
  }

  /**
   * Extrudes a quad face of the cage along a list of 4-vertex ring specs (see ring()); the face is removed and
   * replaced by the tube, so the limb grows out of the surface with no seam. Ring corners are matched to the face's
   * corners by direction.
   * @param {number} fi  face index
   * @param {object[]} specs  ring specs for ring(): c, t, s, a, b, w, ch
   * @param {{ cap?: boolean }} [opts]
   */
  extrude(fi, specs, { cap = true } = {}) {
    const f = this.faces[fi];
    if (f.length !== 4) throw new Error('extrude needs a quad face');
    const fc = v3.mul(f.map((i) => this.pos(i)).reduce(v3.add), 0.25);
    const rings = specs.map((spec) => this.ring({ ...spec, n: 4 }));
    // Rotate the ring order so ring corner j sits in the direction of face corner j.
    const first = rings[0];
    const dirs = first.map((i) => v3.norm(v3.sub(this.pos(i), specs[0].c)));
    let best = 0;
    let bestScore = -Infinity;
    for (let r = 0; r < 4; r++) {
      let score = 0;
      for (let j = 0; j < 4; j++) score += v3.dot(v3.norm(v3.sub(this.pos(f[j]), fc)), dirs[(j + r) % 4]);
      if (score > bestScore) {
        bestScore = score;
        best = r;
      }
    }
    const order = (ring) => [0, 1, 2, 3].map((j) => ring[(j + best) % 4]);
    const ordered = rings.map(order);
    this.faces.splice(fi, 1);
    this.bridge(f, ordered[0]);
    for (let i = 0; i + 1 < ordered.length; i++) this.bridge(ordered[i], ordered[i + 1]);
    if (cap) this.face(...ordered[ordered.length - 1]);
    return ordered;
  }

  /** Finds the quad between rings r1 and r2 starting at vertex k of r1 (as built by bridge). */
  faceBetween(r1, r2, k) {
    const n = r1.length;
    const want = [r1[k], r1[(k + 1) % n], r2[(k + 1) % n], r2[k]];
    const fi = this.faces.findIndex((f) => f.length === 4 && f.every((v, i) => v === want[i]));
    if (fi < 0) throw new Error('face not found');
    return fi;
  }

  /** A closed box cage (a rounded blob after subdivision): centre, half sizes along s, u, t. */
  blob({ c, t = [0, 0, 1], s = [1, 0, 0], a, b, d, w, ch }) {
    const T = v3.norm(t);
    const S = v3.norm(v3.sub(s, v3.mul(T, v3.dot(s, T))));
    const U = v3.cross(T, S);
    const k = 1.25;
    const lo = this.ring({ c: v3.add(c, v3.mul(T, -d * k)), t: T, s: S, a: a * 1.18, b: b * 1.18, n: 4, w, ch });
    const hi = this.ring({ c: v3.add(c, v3.mul(T, d * k)), t: T, s: S, a: a * 1.18, b: b * 1.18, n: 4, w, ch });
    this.tube([lo, hi]);
    return { S, U, T };
  }

  /** The cage as a Poly for subdivide(). */
  poly() {
    return { data: Float64Array.from(this.data), stride: this.stride, count: this.count, faces: this.faces.map((f) => [...f]) };
  }
}

/** Interpolates numeric fields (and nested weight/channel records) of two ring specs. */
export function lerpSpec(A, B, t) {
  const out = { ...A };
  out.c = v3.lerp(A.c, B.c, t);
  out.a = A.a + (B.a - A.a) * t;
  out.b = A.b + (B.b - A.b) * t;
  out.w = lerpRecord(A.w, B.w, t);
  if (typeof A.ch !== 'function' && typeof B.ch !== 'function') out.ch = lerpRecord(A.ch ?? {}, B.ch ?? {}, t);
  if (A.shape || B.shape) {
    const sa = A.shape ?? (() => [0, 0]);
    const sb = B.shape ?? (() => [0, 0]);
    out.shape = (c, s) => {
      const [a1, b1] = sa(c, s);
      const [a2, b2] = sb(c, s);
      return [a1 + (a2 - a1) * t, b1 + (b2 - b1) * t];
    };
  }
  if (typeof A.ch === 'function' || typeof B.ch === 'function') out.ch = t < 0.5 ? A.ch : B.ch;
  return out;
}

function lerpRecord(a = {}, b = {}, t) {
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[k] ?? DEFAULTS[k] ?? 0;
    const y = b[k] ?? DEFAULTS[k] ?? 0;
    out[k] = x + (y - x) * t;
  }
  return out;
}

/**
 * Inserts rings between key rings so no gap is longer than `step` (metres). Tangents follow the centres.
 * Key rings marked `keep: true` stay exactly where they are (hoof crease, mane edge).
 */
export function resample(keys, step) {
  const out = [];
  for (let i = 0; i < keys.length; i++) {
    out.push(keys[i]);
    if (i + 1 === keys.length) break;
    const gap = v3.len(v3.sub(keys[i + 1].c, keys[i].c));
    const n = keys[i].hold ? 0 : Math.floor(gap / step);
    for (let j = 1; j <= n; j++) out.push({ ...lerpSpec(keys[i], keys[i + 1], j / (n + 1)), name: undefined, hold: false, inserted: true });
  }
  // Tangents: central differences unless given.
  for (let i = 0; i < out.length; i++) {
    if (out[i].t && !out[i].inserted) continue;
    const prev = out[Math.max(0, i - 1)].c;
    const next = out[Math.min(out.length - 1, i + 1)].c;
    out[i] = { ...out[i], t: v3.sub(next, prev) };
  }
  return out;
}
