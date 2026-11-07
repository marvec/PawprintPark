// Every economy number, in one place (CLAUDE.md). docs/economy.md explains each one; keep the two in step.
// Milestone 1 holds only what the world state needs so far; the rest moves here from scripts/economy-sim.js in
// milestone 6.

export const ECONOMY = {
  /** ZooCoins in a new zoo (economy.md §3.9). */
  startingCoins: 2000,
  /** Stars in a new zoo. */
  startingStars: 0,
  /** Land plot stars: plotStars × (1 + plotGrowth × plots bought) (economy.md §3.5). */
  plotStars: 15,
  plotGrowth: 0.25,
};
