// One shared material for every animal. The coat is a procedural texture evaluated per pixel:
//
// - `stripe` (float) with the rest-pose `position`: S, a stripe coordinate that runs along the spine, down each leg
//   and along the tail. It is a smooth field on one connected surface, so stripes never meet a seam. For cell patterns
//   it holds the local pattern scale instead (smaller patches on the neck, head and legs).
// - `pat` (vec4): pattern kind and parameters (stripes, patches, spots), constant per species.
// - `color` / `color2`: base and pattern colours. `color3` + `mark`: a marking colour (hooves, muzzle, mane, belly,
//   eyes…) and its signed field; the edge is drawn where the field crosses zero, one pixel wide.
//
// Individuals differ by a seed that shifts the pattern. The geometry is shared per species, sex and age, so the seed
// travels in the skeleton instead: bone 0 is a "seed bone" that no vertex is weighted to, and its offset from rest is
// read from the bone texture (which three.js uploads per skinned mesh anyway). One material, no per-object uniforms.

import * as THREE from 'three';

export const PAT_NONE = 0;
export const PAT_STRIPES = 1;
export const PAT_PATCHES = 2;
export const PAT_SPOTS = 3;

const NOISE = /* glsl */ `
vec3 cellHash3(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453123);
}
float cellId(vec3 p) { return fract(sin(dot(p, vec3(7.1, 157.3, 113.9))) * 43758.5453); }
vec3 neighbour(int k) { return vec3(float(k % 3) - 1.0, float((k / 3) % 3) - 1.0, float(k / 9) - 1.0); }
// x = distance to the border between the two nearest cells, y = distance to the nearest point, z = its cell id.
vec3 cellular(vec3 x) {
  vec3 n = floor(x);
  vec3 f = x - n;
  vec3 r1 = vec3(0.0); vec3 r2 = vec3(0.0); vec3 g1 = vec3(0.0);
  float d1 = 8.0; float d2 = 8.0;
  for (int k = 0; k < 27; k++) {
    vec3 g = neighbour(k);
    vec3 r = g + cellHash3(n + g) - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; r2 = r1; d1 = d; r1 = r; g1 = g; }
    else if (d < d2) { d2 = d; r2 = r; }
  }
  return vec3(dot(0.5 * (r1 + r2), normalize(r2 - r1)), sqrt(d1), cellId(n + g1));
}
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
float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = p - i;
  f = f * f * (3.0 - 2.0 * f);
  float a = mix(mix(cellId(i), cellId(i + vec3(1, 0, 0)), f.x), mix(cellId(i + vec3(0, 1, 0)), cellId(i + vec3(1, 1, 0)), f.x), f.y);
  float b = mix(mix(cellId(i + vec3(0, 0, 1)), cellId(i + vec3(1, 0, 1)), f.x), mix(cellId(i + vec3(0, 1, 1)), cellId(i + vec3(1, 1, 1)), f.x), f.y);
  return mix(a, b, f.z) * 2.0 - 1.0;
}
`;

const VARYINGS = 'varying vec3 vColor2;\nvarying vec3 vColor3;\nvarying float vMark;\nvarying vec4 vCoat;\nvarying vec4 vPat;\nvarying vec3 vSeed;';

const PAINT = /* glsl */ `
// Colours are stored as sRGB bytes (compact, exact for flat colours); light in linear space.
#define LIN(c) sRGBTransferEOTF(vec4(c, 1.0)).rgb
vec3 coatColor = LIN(vColor.rgb);
vec3 patColor = LIN(vColor2);
vec3 markColor = LIN(vColor3);
vec3 seedOff = vSeed * 17.0;
if (vPat.x > 2.5) {
  // Spots: size, radius (cell units), density.
  float f = spotField(vCoat.xyz / (vPat.y * vCoat.w) + seedOff, vPat.z, vPat.w);
  float e = max(fwidth(f), 1e-5);
  coatColor = mix(coatColor, patColor, smoothstep(-e, e, f));
} else if (vPat.x > 1.5) {
  // Patches with lines between them (giraffe): size, line width (cell units), tint.
  vec3 q = vCoat.xyz / (vPat.y * vCoat.w) + seedOff;
  q += 0.07 * vec3(vnoise(q * 1.7), vnoise(q * 1.7 + 5.2), vnoise(q * 1.7 + 9.4));
  vec3 c = cellular(q);
  float f = vPat.z * 0.5 - c.x;
  float e = max(fwidth(f), 1e-5);
  coatColor = mix(coatColor * (1.0 - c.z * vPat.w), patColor, smoothstep(-e, e, f));
} else if (vPat.x > 0.5) {
  // Stripes across S: stripes per metre, share striped, wobble. Width and position wander with the seed.
  vec3 q = vCoat.xyz * 2.2 + seedOff;
  float s = vCoat.w * vPat.y + vnoise(q) * vPat.w + vSeed.x * 3.0;
  float d = abs(fract(s) - 0.5);
  float half_ = vPat.z * 0.5 * (1.0 + 0.45 * vnoise(q * 0.7 + 3.1));
  float f = half_ - d;
  float e = max(fwidth(f), 1e-5);
  coatColor = mix(coatColor, patColor, smoothstep(-e, e, f));
}
float me = max(fwidth(vMark), 1e-5);
diffuseColor.rgb *= mix(coatColor, markColor, smoothstep(-me, me, vMark));
`;

/** The shared animal material (vertex colours, procedural coat, skinning). */
export function createAnimalMaterial({ flat = false } = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, flatShading: flat });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nattribute vec3 color2;\nattribute vec3 color3;\nattribute float mark;\nattribute float stripe;\nattribute vec4 pat;\n${VARYINGS}`)
      .replace(
        '#include <color_vertex>',
        `#include <color_vertex>
vColor2 = color2; vColor3 = color3; vMark = mark; vCoat = vec4(position, stripe); vPat = pat;
#ifdef USE_SKINNING
vSeed = (bindMatrixInverse * getBoneMatrix(0.0) * bindMatrix)[3].xyz;
#else
vSeed = vec3(0.0);
#endif`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${VARYINGS}\n${NOISE}`)
      .replace('#include <color_fragment>', PAINT);
  };
  m.customProgramCacheKey = () => 'animal';
  return m;
}
