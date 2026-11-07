// Land plots (PRD §3): the map is split into square plots that are unlocked one by one with stars.
// The world state stores the unlocked plot indices; everything else is derived.

import { PLOT_SIZE, PLOTS_ACROSS, START_PLOTS } from '../data/world.js';
import { ECONOMY } from '../data/economy.js';

export const plotIndex = (px, pz) => pz * PLOTS_ACROSS + px;
export const plotCoords = (i) => ({ px: i % PLOTS_ACROSS, pz: Math.floor(i / PLOTS_ACROSS) });
/** The plot a tile lies in. */
export const plotOfTile = (tx, tz) => plotIndex(Math.floor(tx / PLOT_SIZE), Math.floor(tz / PLOT_SIZE));

/** The plots unlocked in a new zoo, sorted. */
export function startingPlots() {
  const out = [];
  for (let pz = START_PLOTS.pz0; pz <= START_PLOTS.pz1; pz++) {
    for (let px = START_PLOTS.px0; px <= START_PLOTS.px1; px++) out.push(plotIndex(px, pz));
  }
  return out.sort((a, b) => a - b);
}

/** Whether the tile at (tx, tz) lies on unlocked land. */
export function isTileUnlocked(plots, tx, tz) {
  const size = PLOT_SIZE * PLOTS_ACROSS;
  if (tx < 0 || tz < 0 || tx >= size || tz >= size) return false;
  return plots.includes(plotOfTile(tx, tz));
}

/** A fast lookup for many tile checks: a Uint8Array over all plots. */
export function plotMask(plots) {
  const mask = new Uint8Array(PLOTS_ACROSS * PLOTS_ACROSS);
  for (const i of plots) mask[i] = 1;
  return mask;
}

/** Locked plots that touch an unlocked one along an edge: the ones that can be bought next. */
export function buyablePlots(plots) {
  const mask = plotMask(plots);
  const out = [];
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) continue;
    const { px, pz } = plotCoords(i);
    const near = [[px - 1, pz], [px + 1, pz], [px, pz - 1], [px, pz + 1]];
    if (near.some(([x, z]) => x >= 0 && z >= 0 && x < PLOTS_ACROSS && z < PLOTS_ACROSS && mask[plotIndex(x, z)])) out.push(i);
  }
  return out;
}

/** Stars for the next plot (economy.md §3.5): grows with each plot bought beyond the start area. */
export function plotStarCost(plots) {
  const bought = plots.length - startingPlots().length;
  return Math.round(ECONOMY.plotStars * (1 + ECONOMY.plotGrowth * bought));
}

/**
 * Unlocks a plot if it is buyable. Returns the new sorted list, or null when it isn't buyable. Paying is the
 * caller's job.
 */
export function unlockPlot(plots, index) {
  if (!buyablePlots(plots).includes(index)) return null;
  return [...plots, index].sort((a, b) => a - b);
}
