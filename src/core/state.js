// The world state: everything a save holds. It stores seeds and decisions; the map, the paths and every model are
// regenerated from them (CLAUDE.md). Plain JSON-safe data, so a save is JSON.stringify of it.
//
// Loading merges the save over a fresh default state, so fields added later get their defaults and old saves keep
// loading (handbook §8).

import { ECONOMY } from '../data/economy.js';
import { startingLayout } from './layout.js';
import { startingPlots } from './plots.js';
import { hashString } from './rng.js';
import { DAYS_PER_YEAR, MINUTES_PER_DAY, createClock } from './time.js';

export const SAVE_VERSION = 1;
export const DEFAULT_ZOO_NAME = 'Pawprint Park';

/**
 * @typedef {{ happiness: number, health: number, food: number, water: number }} AnimalStats
 *   Bars from 0 to 100; 100 is full and good (well fed, fully watered).
 * @typedef {{
 *   id: number, species: string, sex: 'male' | 'female', name: string | null, seed: number, enclosure: number,
 *   bornMinute: number, stats: AnimalStats, illness: null | { id: string, severity: 'mild' | 'serious' | 'critical' },
 * }} Animal
 * @typedef {{ cleanliness: number, poop: number, feeder: number, water: number, waterQuality: number }} EnclosureCare
 *   Cleanliness and water quality 0–100; `poop` counts piles; `feeder` holds portions; `water` 0–100 full.
 * @typedef {import('./paths.js').Placement & { biome?: string, name?: string | null, care?: EnclosureCare }} PlacedThing
 * @typedef {{
 *   version: number, seed: number, name: string,
 *   clock: import('./time.js').Clock,
 *   coins: number, stars: number,
 *   plots: number[],
 *   placements: PlacedThing[],
 *   animals: Animal[],
 *   flags: Record<string, string | number | boolean>,
 *   nextId: number,
 * }} WorldState
 */

/**
 * A new zoo: the starting layout, a neglected sheep (dirty enclosure, empty feeder and water, low happiness and a
 * mild illness) and an empty enclosure next to it (PRD §3).
 * @param {{ seed: number, name?: string }} opts
 * @returns {WorldState}
 */
export function createWorld({ seed, name = DEFAULT_ZOO_NAME }) {
  const { placements, sheepEnclosure, nextId } = startingLayout(1);
  const clock = createClock();
  for (const p of placements) {
    if (p.kind !== 'enclosure') continue;
    const sheep = p.id === sheepEnclosure;
    Object.assign(p, {
      name: null,
      care: sheep
        ? { cleanliness: 12, poop: 7, feeder: 0, water: 0, waterQuality: 30 }
        : { cleanliness: 100, poop: 0, feeder: 0, water: 0, waterQuality: 100 },
    });
  }
  let id = nextId;
  const sheepId = id++;
  /** @type {Animal} */
  const sheep = {
    id: sheepId,
    species: 'domestic-sheep',
    sex: 'female',
    name: null,
    seed: hashString(`${seed >>> 0}:animal:${sheepId}`),
    enclosure: sheepEnclosure,
    // A three-year-old ewe.
    bornMinute: clock.minute - 3 * DAYS_PER_YEAR * MINUTES_PER_DAY,
    stats: { happiness: 22, health: 64, food: 8, water: 5 },
    illness: { id: 'cold', severity: 'mild' },
  };
  return {
    version: SAVE_VERSION,
    seed: seed >>> 0,
    name,
    clock,
    coins: ECONOMY.startingCoins,
    stars: ECONOMY.startingStars,
    plots: startingPlots(),
    placements,
    animals: [sheep],
    flags: { tutorial: 'active' },
    nextId: id,
  };
}

/** Hands out the next id. */
export function newId(state) {
  return state.nextId++;
}

/** The save text. */
export const serialize = (state) => JSON.stringify(state);

/**
 * Loads a save. Fields missing from older saves get their defaults; objects one level down (`clock`, `flags`) are
 * merged too. Throws on text that isn't a Pawprint Park save, or a save from a newer version of the game.
 * @param {string} text
 * @returns {WorldState}
 */
export function deserialize(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This save is damaged and cannot be read.');
  }
  if (!data || typeof data !== 'object' || typeof data.seed !== 'number' || typeof data.version !== 'number') {
    throw new Error('This is not a Pawprint Park save.');
  }
  if (data.version > SAVE_VERSION) throw new Error('This save comes from a newer version of the game.');
  const base = createWorld({ seed: data.seed, name: typeof data.name === 'string' ? data.name : DEFAULT_ZOO_NAME });
  /** @type {WorldState} */
  const state = { ...base, ...data };
  state.clock = { ...base.clock, ...data.clock };
  state.flags = { ...base.flags, ...data.flags };
  state.version = SAVE_VERSION;
  return state;
}
