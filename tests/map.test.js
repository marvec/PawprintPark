import { describe, expect, test } from 'bun:test';
import { HILL_HEIGHT, MAX_BUILD_SLOPE, generateMap, heightAt, isLand, isWater, tileSlope } from '../src/core/map.js';
import { hashString } from '../src/core/rng.js';

const fingerprint = (m) =>
  hashString(
    [
      Array.from(m.heights, (h) => Math.round(h * 100)).join(','),
      m.water.join(''),
      m.trees.map((t) => `${t.x.toFixed(2)},${t.z.toFixed(2)},${t.seed}`).join(';'),
      m.rocks.map((t) => `${t.x.toFixed(2)},${t.z.toFixed(2)}`).join(';'),
    ].join('|'),
  );

const SEEDS = [1, 2, 3, 42, 1234, 99999, 0xdeadbeef];
const maps = new Map(SEEDS.map((s) => [s, generateMap(s)]));

describe('map generation', () => {
  test('the same seed gives the same map', () => {
    for (const s of [1, 42]) expect(fingerprint(generateMap(s))).toBe(fingerprint(maps.get(s)));
  });

  test('different seeds give different maps', () => {
    const prints = new Set(SEEDS.map((s) => fingerprint(maps.get(s))));
    expect(prints.size).toBe(SEEDS.length);
  });

  test('known seeds still give the maps they always gave (RNG draw order is stable)', () => {
    // If this fails after an intended change to the generator, every existing zoo changes shape: say so in the
    // commit and update the numbers.
    expect(fingerprint(maps.get(1))).toBe(1316661505);
    expect(fingerprint(maps.get(42))).toBe(954066433);
  });

  test('every map has hills, a river or a lake, trees and rocks', () => {
    for (const m of maps.values()) {
      const top = Math.max(...m.heights);
      expect(top).toBeGreaterThan(HILL_HEIGHT * 0.6);
      expect(['river', 'lake']).toContain(m.waterBody.kind);
      expect(m.water.reduce((a, b) => a + b, 0)).toBeGreaterThan(200);
      expect(m.trees.length).toBeGreaterThan(200);
      expect(m.rocks.length).toBeGreaterThan(40);
    }
    const kinds = new Set([...maps.values()].map((m) => m.waterBody.kind));
    expect(kinds).toEqual(new Set(['river', 'lake']));
  });

  test('the start area is flat, dry and clear, with a margin of gentle land around it', () => {
    for (const m of maps.values()) {
      const { x0, z0, x1, z1 } = m.start;
      for (let z = z0; z < z1; z++) {
        for (let x = x0; x < x1; x++) {
          expect(heightAt(m, x + 0.5, z + 0.5)).toBe(0);
          expect(isWater(m, x, z)).toBe(false);
        }
      }
      const inside = (o, pad) => o.x > x0 - pad && o.x < x1 + pad && o.z > z0 - pad && o.z < z1 + pad;
      expect(m.trees.some((t) => inside(t, 2))).toBe(false);
      expect(m.rocks.some((t) => inside(t, 2))).toBe(false);
      // A ring of 4 tiles around it is buildable land too (where it's on the map).
      for (let z = z0 - 4; z < Math.min(z1 + 4, m.size); z++) {
        for (const x of [x0 - 4, x0 - 1, x1, x1 + 3]) expect(isLand(m, x, z)).toBe(true);
      }
    }
  });

  test('trees and rocks never stand in water', () => {
    for (const m of maps.values()) {
      for (const t of [...m.trees, ...m.rocks]) expect(isWater(m, Math.floor(t.x), Math.floor(t.z))).toBe(false);
    }
  });

  test('most of the map is buildable and the water is low', () => {
    for (const m of maps.values()) {
      let land = 0;
      for (let z = 0; z < m.size; z++) {
        for (let x = 0; x < m.size; x++) {
          if (isLand(m, x, z)) land++;
          if (isWater(m, x, z)) expect(heightAt(m, x + 0.5, z + 0.5)).toBeLessThan(0.5);
        }
      }
      expect(land / (m.size * m.size)).toBeGreaterThan(0.8);
      expect(tileSlope(m, m.start.x0, m.start.z0)).toBeLessThanOrEqual(MAX_BUILD_SLOPE);
    }
  });
});
