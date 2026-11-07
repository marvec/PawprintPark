import { describe, expect, test } from 'bun:test';
import { generateMap } from '../src/core/map.js';
import { buildPathNetwork } from '../src/core/paths.js';
import { DEFAULT_ZOO_NAME, SAVE_VERSION, createWorld, deserialize, newId, serialize } from '../src/core/state.js';
import { START_MINUTE, advanceClock, setSpeed } from '../src/core/time.js';
import { SPECIES_BY_ID } from '../src/data/species.js';

describe('a new zoo', () => {
  const w = createWorld({ seed: 5 });

  test('starts with 2,000 Z, the default name and the start plots', () => {
    expect(w.coins).toBe(2000);
    expect(w.stars).toBe(0);
    expect(w.name).toBe(DEFAULT_ZOO_NAME);
    expect(createWorld({ seed: 5, name: 'Sunny Acres' }).name).toBe('Sunny Acres');
    expect(w.clock.minute).toBe(START_MINUTE);
    expect(w.plots.length).toBe(4);
    expect(w.version).toBe(SAVE_VERSION);
  });

  test('holds a neglected sheep next to an empty enclosure (PRD §3)', () => {
    const enclosures = w.placements.filter((p) => p.kind === 'enclosure');
    expect(w.animals.length).toBe(1);
    const sheep = w.animals[0];
    expect(SPECIES_BY_ID[sheep.species].name).toBe('Domestic sheep');
    const home = enclosures.find((e) => e.id === sheep.enclosure);
    const empty = enclosures.find((e) => e.id !== sheep.enclosure);
    expect(home.care.cleanliness).toBeLessThan(30);
    expect(home.care.poop).toBeGreaterThan(0);
    expect(home.care.feeder).toBe(0);
    expect(home.care.water).toBe(0);
    expect(sheep.stats.happiness).toBeLessThan(40);
    expect(sheep.illness).toEqual({ id: 'cold', severity: 'mild' });
    expect(w.animals.some((a) => a.enclosure === empty.id)).toBe(false);
    expect(w.flags.tutorial).toBe('active');
  });

  test('ids are unique and handed out in order', () => {
    const ids = [...w.placements, ...w.animals].map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    const copy = createWorld({ seed: 5 });
    const next = copy.nextId;
    expect(newId(copy)).toBe(next);
    expect(copy.nextId).toBe(next + 1);
  });

  test('is the same for the same seed', () => {
    expect(createWorld({ seed: 5 })).toEqual(w);
    expect(createWorld({ seed: 6 }).animals[0].seed).not.toBe(w.animals[0].seed);
  });
});

describe('saves', () => {
  test('round-trip exactly, and the world regenerates from the seed', () => {
    const w = createWorld({ seed: 31337, name: 'Zoo of Tests' });
    setSpeed(w.clock, 3);
    advanceClock(w.clock, 1234.5);
    w.coins = 1777;
    w.flags.tipBuild = true;
    const text = serialize(w);
    const back = deserialize(text);
    expect(back).toEqual(w);
    expect(serialize(back)).toBe(text);
    // The map and paths are rebuilt from the seed and decisions, identical both times.
    const a = buildPathNetwork(generateMap(w.seed), w.plots, w.placements);
    const b = buildPathNetwork(generateMap(back.seed), back.plots, back.placements);
    expect(b.path).toEqual(a.path);
  });

  test('a save holds seeds and decisions only: it stays small', () => {
    expect(serialize(createWorld({ seed: 1 })).length).toBeLessThan(3000);
  });

  test('older saves missing fields load with defaults', () => {
    const w = createWorld({ seed: 8 });
    const old = JSON.parse(serialize(w));
    delete old.flags;
    delete old.clock.skipNight;
    delete old.stars;
    const back = deserialize(JSON.stringify(old));
    expect(back.flags).toEqual({ tutorial: 'active' });
    expect(back.clock.skipNight).toBe(false);
    expect(back.clock.minute).toBe(w.clock.minute);
    expect(back.stars).toBe(0);
  });

  test('damaged, foreign and future saves are refused with a reason', () => {
    expect(() => deserialize('{nope')).toThrow('damaged');
    expect(() => deserialize('{"hello":1}')).toThrow('not a Pawprint Park save');
    expect(() => deserialize(JSON.stringify({ ...createWorld({ seed: 1 }), version: SAVE_VERSION + 1 }))).toThrow('newer version');
  });
});
