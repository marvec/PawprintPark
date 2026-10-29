// Quality tiers (CLAUDE.md: from day one). The default is picked from the device; players can change it.

export const QUALITY = {
  low: { maxDpr: 1, shadows: false, shadowMapSize: 0, detail: 0.6, antialias: false, animalBudget: 40 },
  medium: { maxDpr: 1.5, shadows: true, shadowMapSize: 1024, detail: 0.8, antialias: true, animalBudget: 80 },
  high: { maxDpr: 2, shadows: true, shadowMapSize: 2048, detail: 1, antialias: true, animalBudget: 150 },
};

export const QUALITY_NAMES = /** @type {const} */ (['low', 'medium', 'high']);

/** Default tier: touch devices start on medium, desktops on high. */
export const defaultQuality = (isTouch) => (isTouch ? 'medium' : 'high');
