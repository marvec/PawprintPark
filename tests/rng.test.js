import { describe, expect, test } from 'bun:test';
import { createRng, hashString } from '../src/core/rng.js';

describe('createRng', () => {
  test('the same seed gives the same sequence', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  test('different seeds give different sequences', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  test('values stay in range', () => {
    const r = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      const n = r.int(3, 5);
      expect(n === 3 || n === 4 || n === 5).toBe(true);
    }
  });
});

describe('hashString', () => {
  test('is stable and unsigned', () => {
    expect(hashString('lion')).toBe(hashString('lion'));
    expect(hashString('lion')).not.toBe(hashString('tiger'));
    expect(hashString('anything')).toBeGreaterThanOrEqual(0);
  });
});
