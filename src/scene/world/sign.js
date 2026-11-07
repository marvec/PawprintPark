// The entrance sign's face: the zoo's name painted on a canvas (browser only; the pure scene builder takes this as
// an optional callback, so tests build a plain board instead).

import * as THREE from 'three';

/** Paints the zoo's name in cream letters on a warm wooden board with a paw print at each end. */
export function paintSignTexture(name) {
  const w = 1024;
  const h = 232;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  g.fillStyle = '#7a5236';
  g.fillRect(0, 0, w, h);
  // Planks.
  g.strokeStyle = 'rgba(40, 22, 10, 0.35)';
  g.lineWidth = 4;
  for (const y of [h / 3, (2 * h) / 3]) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(w, y);
    g.stroke();
  }
  g.strokeStyle = '#f2dfb8';
  g.lineWidth = 10;
  g.strokeRect(14, 14, w - 28, h - 28);
  const paw = (cx, cy, s) => {
    g.fillStyle = '#f2a04a';
    g.beginPath();
    g.ellipse(cx, cy + s * 0.25, s * 0.42, s * 0.34, 0, 0, Math.PI * 2);
    g.fill();
    for (const [dx, dy] of [[-0.42, -0.2], [-0.15, -0.42], [0.15, -0.42], [0.42, -0.2]]) {
      g.beginPath();
      g.ellipse(cx + dx * s, cy + dy * s, s * 0.14, s * 0.17, 0, 0, Math.PI * 2);
      g.fill();
    }
  };
  paw(90, h / 2, 90);
  paw(w - 90, h / 2, 90);
  g.fillStyle = '#fff4dc';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = 112;
  do {
    g.font = `800 ${size}px ui-rounded, 'SF Pro Rounded', system-ui, sans-serif`;
    size -= 4;
  } while (g.measureText(name).width > w - 260 && size > 40);
  g.shadowColor = 'rgba(30, 15, 5, 0.5)';
  g.shadowOffsetY = 5;
  g.fillText(name, w / 2, h / 2 + 6);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
