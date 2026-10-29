// Shared rig helpers: meshes from segments, and rest-pose capture so poses are applied from rest every frame
// (nothing accumulates).

import * as THREE from 'three';

/** Cell patterns computed in the shader: kind ids in the `cell` attribute (patterns.js). */
export const CELL_PATCHES = 1;
export const CELL_SPOTS = 2;

// Cellular noise in GLSL: x = distance to the border between the two nearest cells (the plane halfway between their
// points), y = distance to the nearest point, z = the nearest cell's random id. One pass over the 27 neighbours.
const CELLULAR = /* glsl */ `
vec3 cellHash3(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453123);
}
float cellId(vec3 p) {
  return fract(sin(dot(p, vec3(7.1, 157.3, 113.9))) * 43758.5453);
}
vec3 neighbour(int k) {
  return vec3(float(k % 3) - 1.0, float((k / 3) % 3) - 1.0, float(k / 9) - 1.0);
}
vec3 cellular(vec3 x) {
  vec3 n = floor(x);
  vec3 f = x - n;
  vec3 r1 = vec3(0.0);
  vec3 r2 = vec3(0.0);
  vec3 g1 = vec3(0.0);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int k = 0; k < 27; k++) {
    vec3 g = neighbour(k);
    vec3 r = g + cellHash3(n + g) - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; r2 = r1; d1 = d; r1 = r; g1 = g; }
    else if (d < d2) { d2 = d; r2 = r; }
  }
  return vec3(dot(0.5 * (r1 + r2), normalize(r2 - r1)), sqrt(d1), cellId(n + g1));
}
// Distance inside the nearest spot (negative outside); a share (density) of the cells have a spot.
float spotField(vec3 x, float radius, float density) {
  vec3 n = floor(x);
  vec3 f = x - n;
  float best = -1.0;
  for (int k = 0; k < 27; k++) {
    vec3 g = neighbour(k);
    if (cellId(n + g) < density) best = max(best, radius - length(g + cellHash3(n + g) - f));
  }
  return best;
}
`;

const PAINT = /* glsl */ `
float paintMask = vMask;
vec3 paintA = vColor.rgb;
if (vCell.x > 1.5) {
  paintMask = spotField(vApos / vCell.y, vCell.z, vCell.w);
} else if (vCell.x > 0.5) {
  vec3 c = cellular(vApos / vCell.y);
  paintMask = vCell.z * 0.5 - c.x;
  paintA *= 1.0 - c.z * vCell.w;
}
float paintEdge = max(fwidth(paintMask), 1e-5);
diffuseColor.rgb *= mix(paintA, vColor2, smoothstep(-paintEdge, paintEdge, paintMask));
`;

/**
 * One shared material for every animal: colours live in the vertices. Each vertex has two colours and a mask field
 * (shapes.js, Segment.build); the fragment shader shows color2 where the interpolated mask is above zero, with an
 * anti-aliased edge one pixel wide. Cell patterns (giraffe patches, spots) are computed per pixel from the rest
 * position. That keeps stripes and patches crisp without dense meshes.
 */
export function createAnimalMaterial({ flat = false } = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0, flatShading: flat });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute vec3 color2;\nattribute float mask;\nattribute vec4 cell;\nattribute vec3 apos;\nvarying vec3 vColor2;\nvarying float vMask;\nvarying vec4 vCell;\nvarying vec3 vApos;',
      )
      .replace('#include <color_vertex>', '#include <color_vertex>\nvColor2 = color2;\nvMask = mask;\nvCell = cell;\nvApos = apos;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vColor2;\nvarying float vMask;\nvarying vec4 vCell;\nvarying vec3 vApos;\n${CELLULAR}`)
      .replace('#include <color_fragment>', PAINT);
  };
  m.customProgramCacheKey = () => 'animal-two-tone';
  return m;
}

/** Builds a mesh from a Segment, names it and enables shadows. */
export function segMesh(segment, material, name) {
  const mesh = new THREE.Mesh(segment.build(), material);
  mesh.name = name;
  mesh.castShadow = true;
  return mesh;
}

/** Creates a named pivot group at a position. */
export function pivot(name, parent, pos = [0, 0, 0]) {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(...pos);
  parent.add(g);
  return g;
}

/** Stores the rest position, rotation and scale of every object in the rig. */
export function captureRest(objects) {
  const rest = new Map();
  for (const o of objects) {
    if (!o) continue;
    rest.set(o, { p: o.position.clone(), r: o.rotation.clone(), s: o.scale.clone() });
  }
  return rest;
}

/** Puts every captured object back into its rest pose. */
export function resetRest(rest) {
  for (const [o, r] of rest) {
    o.position.copy(r.p);
    o.rotation.copy(r.r);
    o.scale.copy(r.s);
  }
}
