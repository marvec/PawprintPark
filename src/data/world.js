// World layout data: the grid, plots, the start area and the footprints of things placed on the grid.
// One tile is one grid square (PRD §3); the scene decides how big a tile is in metres.

/** Tiles per side of a land plot. */
export const PLOT_SIZE = 24;
/** Plots per side of the map. */
export const PLOTS_ACROSS = 10;
/** Tiles per side of the map. */
export const MAP_SIZE = PLOT_SIZE * PLOTS_ACROSS;

/**
 * The start area: the plots unlocked in a new zoo, at the middle of the map's south edge so the entrance gate faces
 * the road in. Plot coordinates, inclusive.
 */
export const START_PLOTS = { px0: 4, pz0: 8, px1: 5, pz1: 9 };

/** Enclosure sizes (PRD §5): tiles per side. */
export const ENCLOSURE_SIZES = { S: 6, M: 10, L: 14, XL: 20 };

/** The 16 biomes in PRD order; v1 ships the first 8. Houses are buildings with indoor tanks. */
export const BIOMES = [
  { id: 'farmyard', v1: true },
  { id: 'african-savanna', v1: true },
  { id: 'asian-jungle', v1: true },
  { id: 'polar', v1: true },
  { id: 'coast', v1: true },
  { id: 'wetland', v1: true },
  { id: 'reptile-house', v1: true, house: true },
  { id: 'aviary', v1: true },
  { id: 'temperate-forest', v1: false },
  { id: 'desert', v1: false },
  { id: 'tropical-rainforest', v1: false },
  { id: 'mountain', v1: false },
  { id: 'outback', v1: false },
  { id: 'aquarium', v1: false, house: true },
  { id: 'nocturnal-house', v1: false, house: true },
  { id: 'bug-house', v1: false, house: true },
];

/**
 * Footprints of placeable things, in tiles at rotation 0 (`w` along x, `d` along z). The front faces +z at rotation 0
 * and is where the path connects (an enclosure's viewing side, a building's door). Enclosures take their size from
 * `ENCLOSURE_SIZES`.
 */
export const FOOTPRINTS = {
  // The gate starts the path network with a straight avenue into the zoo, `avenue` tiles long.
  'entrance-gate': { w: 6, d: 2, avenue: 12 },
  storehouse: { w: 4, d: 4 },
};
