// Catmull-Clark subdivision of a polygon cage whose vertices carry a data vector each (position first, then any
// number of channels: skin weights, coat coordinates, marking fields). Every channel goes through the same affine
// stencils as the position, so weights stay normalised and fields stay continuous across the whole mesh.
// Pure: typed arrays only, no three.js.

/**
 * @typedef {{ data: Float64Array, stride: number, count: number, faces: number[][] }} Poly
 *   data holds `count` vectors of `stride` numbers; faces are vertex index lists, counter-clockwise from outside.
 */

/** One Catmull-Clark step: arbitrary polygons in, quads out. Closed meshes; boundary edges fall back to midpoints. */
export function subdivide({ data, stride, count, faces }) {
  const D = stride;
  // Edges: key → index; per edge its two vertices and up to two faces.
  const edgeOf = new Map();
  const ev = [];
  const ef = [];
  const edge = (a, b) => {
    const k = a < b ? a * count + b : b * count + a;
    let e = edgeOf.get(k);
    if (e === undefined) {
      e = ev.length / 2;
      edgeOf.set(k, e);
      ev.push(a, b);
      ef.push(-1, -1);
    }
    return e;
  };
  const faceEdges = faces.map((f, fi) =>
    f.map((v, i) => {
      const e = edge(v, f[(i + 1) % f.length]);
      if (ef[e * 2] < 0) ef[e * 2] = fi;
      else ef[e * 2 + 1] = fi;
      return e;
    }),
  );
  const nE = ev.length / 2;
  const nF = faces.length;
  const out = new Float64Array((count + nE + nF) * D);
  const fpBase = count + nE;

  // Face points: centroids.
  for (let fi = 0; fi < nF; fi++) {
    const f = faces[fi];
    const o = (fpBase + fi) * D;
    for (const v of f) for (let d = 0; d < D; d++) out[o + d] += data[v * D + d];
    for (let d = 0; d < D; d++) out[o + d] /= f.length;
  }
  // Edge points: average of the two ends and the two face points.
  const boundary = new Uint8Array(count);
  for (let e = 0; e < nE; e++) {
    const a = ev[e * 2];
    const b = ev[e * 2 + 1];
    const f1 = ef[e * 2];
    const f2 = ef[e * 2 + 1];
    const o = (count + e) * D;
    if (f2 < 0) {
      boundary[a] = boundary[b] = 1;
      for (let d = 0; d < D; d++) out[o + d] = (data[a * D + d] + data[b * D + d]) / 2;
    } else {
      for (let d = 0; d < D; d++)
        out[o + d] = (data[a * D + d] + data[b * D + d] + out[(fpBase + f1) * D + d] + out[(fpBase + f2) * D + d]) / 4;
    }
  }
  // Vertex points: (F + 2R + (n - 3) P) / n.
  const F = new Float64Array(count * D);
  const R = new Float64Array(count * D);
  const nFaces = new Uint16Array(count);
  const nEdges = new Uint16Array(count);
  for (let fi = 0; fi < nF; fi++)
    for (const v of faces[fi]) {
      nFaces[v]++;
      for (let d = 0; d < D; d++) F[v * D + d] += out[(fpBase + fi) * D + d];
    }
  for (let e = 0; e < nE; e++) {
    const a = ev[e * 2];
    const b = ev[e * 2 + 1];
    nEdges[a]++;
    nEdges[b]++;
    for (let d = 0; d < D; d++) {
      const m = (data[a * D + d] + data[b * D + d]) / 2;
      R[a * D + d] += m;
      R[b * D + d] += m;
    }
  }
  for (let v = 0; v < count; v++) {
    const o = v * D;
    if (boundary[v] || !nFaces[v]) {
      for (let d = 0; d < D; d++) out[o + d] = data[o + d];
      continue;
    }
    const n = nEdges[v];
    for (let d = 0; d < D; d++) out[o + d] = (F[o + d] / nFaces[v] + (2 * R[o + d]) / n + (n - 3) * data[o + d]) / n;
  }
  // Quads: corner, next edge point, face point, previous edge point.
  const quads = [];
  for (let fi = 0; fi < nF; fi++) {
    const f = faces[fi];
    const es = faceEdges[fi];
    const k = f.length;
    for (let i = 0; i < k; i++) quads.push([f[i], count + es[i], fpBase + fi, count + es[(i + k - 1) % k]]);
  }
  return { data: out, stride: D, count: count + nE + nF, faces: quads };
}

/**
 * Moves every vertex of an all-quad mesh to its Catmull-Clark limit position (and limits every channel the same
 * way): (n²P + 4ΣE + ΣF) / (n(n + 5)), with E the edge neighbours and F the opposite corners of the faces around P.
 * After this, one or two subdivision steps give the same shape at different densities.
 */
export function toLimit({ data, stride, count, faces }) {
  const D = stride;
  const E = new Float64Array(count * D);
  const C = new Float64Array(count * D);
  const n = new Uint16Array(count);
  for (const f of faces) {
    for (let i = 0; i < 4; i++) {
      const v = f[i];
      const next = f[(i + 1) % 4];
      const opp = f[(i + 2) % 4];
      n[v]++;
      // Each edge is shared by two faces; count each edge neighbour once by only taking the forward edge per face,
      // then the backward edge comes from the neighbouring face.
      for (let d = 0; d < D; d++) {
        E[v * D + d] += data[next * D + d];
        C[v * D + d] += data[opp * D + d];
      }
    }
  }
  const out = new Float64Array(data.length);
  for (let v = 0; v < count; v++) {
    const k = n[v];
    const o = v * D;
    if (!k) {
      for (let d = 0; d < D; d++) out[o + d] = data[o + d];
      continue;
    }
    for (let d = 0; d < D; d++) out[o + d] = (k * k * data[o + d] + 4 * E[o + d] + C[o + d]) / (k * (k + 5));
  }
  return { data: out, stride: D, count, faces };
}
