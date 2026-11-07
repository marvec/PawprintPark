// Dev-only console helpers. Stripped from production builds (tests/devOnly.test.js checks that).

import { generateMap } from './core/map.js';
import { buildPathNetwork } from './core/paths.js';
import { createSlotStore } from './core/slots.js';
import { createWorld, serialize } from './core/state.js';
import { calendarOf } from './core/time.js';

const DEV_MARKER = 'pawprint-dev-helpers';

Object.assign(globalThis, {
  __pawprint: {
    marker: DEV_MARKER,
    /** Opens the body-plan art-direction mockup. */
    mockup: () => location.assign('/mockups/body-plans/'),
    /** A new zoo's world state for a seed (not saved). */
    world: (seed = 1, name) => createWorld({ seed, name }),
    /** A summary of the map for a seed: water, trees, rocks, path tiles of the starting layout. */
    map(seed = 1) {
      const map = generateMap(seed);
      const w = createWorld({ seed });
      const net = buildPathNetwork(map, w.plots, w.placements);
      return {
        water: map.waterBody.kind,
        waterTiles: map.water.reduce((a, b) => a + b, 0),
        trees: map.trees.length,
        rocks: map.rocks.length,
        pathTiles: net.path.reduce((a, b) => a + b, 0),
        start: map.start,
      };
    },
    /** The save slots on this origin, and how full the storage is. */
    slots() {
      const store = createSlotStore(localStorage);
      return { slots: store.list(), usage: store.usage() };
    },
    /** Saves a fresh zoo for a seed into a new slot (for trying the slot store). */
    saveNew(seed = 1, name) {
      const w = createWorld({ seed, name });
      return createSlotStore(localStorage).save(serialize(w), { name: w.name, savedAt: Date.now(), day: calendarOf(w.clock.minute).dayIndex });
    },
  },
});

console.info('Pawprint Park dev helpers: __pawprint.{ mockup(), world(seed), map(seed), slots(), saveNew(seed) }, __step(frames)');
