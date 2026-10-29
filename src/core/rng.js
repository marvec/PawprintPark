// Seeded, deterministic randomness. Never use Math.random() in logic (CLAUDE.md).

/**
 * mulberry32: a small, fast 32-bit generator. Same seed, same sequence.
 * @param {number} seed
 * @returns {{ next(): number, int(min: number, max: number): number, range(min: number, max: number): number, pick<T>(list: T[]): T }}
 */
export function createRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    /** Integer in [min, max], both inclusive. */
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    /** Float in [min, max). */
    range: (min, max) => min + next() * (max - min),
    pick: (list) => list[Math.floor(next() * list.length)],
  };
}

/**
 * FNV-1a hash of a string to an unsigned 32-bit integer. Use it to derive seeds for new features instead of drawing
 * from an existing generator (which would reshuffle everything generated after it).
 * @param {string} str
 */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
