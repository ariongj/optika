// Lens outline per frame shape: plain numbers, so the lens simulator's thickness maths can use it without loading three.js.
import type { FrameShape } from './frames';

const TAU = Math.PI * 2;

/** Superellipse lens outline (96 points, counter-clockwise); side is -1 / +1 (+1: x > 0 is the temple side). */
export function outlinePoints(shape: FrameShape, side: number) {
  const points: { x: number; y: number }[] = [];
  const count = 96;
  for (let i = 0; i < count; i += 1) {
    const angle = Math.PI / 2 + (i / count) * TAU;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    let exponent = 3.6;
    let rx = 0.48;
    let ry = 0.34;
    if (shape === 'round') exponent = 2.15;
    if (shape === 'panto') exponent = sin > 0 ? 2.9 : 2.0;
    if (shape === 'square') exponent = 4.8;
    if (shape === 'aviator') {
      // Flat-ish brow, deep teardrop bowl that sweeps towards the nose.
      exponent = sin > 0 ? 3.4 : 2.1;
      rx = 0.5;
      ry = 0.38;
    }
    if (shape === 'cat-eye') {
      exponent = 2.8;
      rx = 0.5;
    }
    if (shape === 'wrap') {
      exponent = 4.2;
      rx = 0.53;
      ry = 0.29;
    }
    if (shape === 'geometric') exponent = 2.6;
    const power = 2 / exponent;
    let x = rx * Math.sign(cos) * Math.pow(Math.abs(cos), power);
    let y = ry * Math.sign(sin) * Math.pow(Math.abs(sin), power);
    const outer = Math.max(0, (side * x) / rx); // 0 at the nose, 1 at the temple side
    if (shape === 'aviator') {
      const low = Math.max(0, -sin);
      x -= side * 0.075 * low * low; // bowl shifts towards the nose
      y -= 0.08 * low * (1 - 0.55 * outer); // deepest on the nasal side
      y += 0.03 * outer * low; // outer bottom tucks up
    }
    if (shape === 'cat-eye') y += 0.1 * outer * Math.max(0, sin + 0.15);
    if (shape === 'wrap') y -= 0.05 * (1 - outer) * Math.max(0, -sin);
    if (shape === 'geometric') {
      const k = 1 + 0.05 * Math.cos(angle * 8);
      x *= k;
      y *= k;
    }
    points.push({ x, y });
  }
  return points;
}
