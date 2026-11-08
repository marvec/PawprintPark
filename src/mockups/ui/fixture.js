// Fake data for the UI mockup: one mid-game zoo (level 12, year 2, early summer). Pure and deterministic, so the
// screens render the same under `bun test` and in screenshots. Text is never stored here: entries carry strings-table
// keys and parameters, plus names (animals, staff, zoos), which are data.
//
// Numbers follow docs/economy.md where it has them (prices, wages, XP curve, star packs); the rest are plausible
// placeholders. Nothing here is a game system: no value is ever recomputed.

import { createRng } from '../../core/rng.js';
import { MINUTES_PER_DAY, MINUTES_PER_HOUR, DAYS_PER_MONTH } from '../../core/time.js';
import { SPECIES } from '../../data/species.js';

/** XP to the next level (economy.md §5). */
export const xpToNext = (level) => Math.round(30 * level ** 1.55);

/** Level at which each species tier unlocks (economy.md §5). */
export const TIER_LEVEL = { 1: 1, 2: 2, 3: 5, 4: 11, 5: 17, 6: 24, 7: 32, 8: 41 };

const LEVEL = 12;
/** Level at which each biome unlocks, where it isn't open from the start (placeholder until milestone 6). */
const BIOME_LOCKS = { wetland: 13, coast: 14, 'reptile-house': 16 };
/** Year 2, 4 June, 10:35. */
const MINUTE = ((1 * 12 + 5) * DAYS_PER_MONTH + 3) * MINUTES_PER_DAY + 10 * MINUTES_PER_HOUR + 35;

/** Species owned in the fixture zoo, with how many and which marks they have (PRD §14: own, breed, photograph). */
const OWNED = {
  'domestic-sheep': { count: 4, bred: true, photo: true },
  'domestic-goat': { count: 3, bred: true, photo: false },
  'domestic-pig': { count: 2, bred: false, photo: true },
  'domestic-rabbit': { count: 6, bred: true, photo: false },
  chicken: { count: 8, bred: true, photo: true },
  donkey: { count: 2, bred: false, photo: false },
  alpaca: { count: 3, bred: false, photo: false },
  meerkat: { count: 7, bred: true, photo: true },
  'plains-zebra': { count: 5, bred: true, photo: true },
  'common-ostrich': { count: 2, bred: false, photo: false },
  'reticulated-giraffe': { count: 3, bred: false, photo: true },
  lion: { count: 3, bred: false, photo: false },
  'red-panda': { count: 2, bred: false, photo: false },
  'gentoo-penguin': { count: 9, bred: true, photo: false },
  'arctic-fox': { count: 2, bred: false, photo: true },
  'scarlet-macaw': { count: 5, bred: false, photo: false },
};

/** Each species' Zoopedia state: owned (with marks), unlocked but not owned, locked by level, or not built yet. */
function zoopedia() {
  return SPECIES.map((s) => {
    const own = OWNED[s.id];
    const unlockLevel = Math.max(TIER_LEVEL[s.tier], BIOME_LOCKS[s.biome] ?? 1);
    let status = 'locked';
    if (!s.v1) status = 'soon';
    else if (own) status = 'owned';
    else if (unlockLevel <= LEVEL) status = 'available';
    return {
      id: s.id,
      status,
      unlockLevel,
      count: own?.count ?? 0,
      marks: { bronze: !!own, silver: !!own?.bred, gold: !!own?.photo },
    };
  });
}

/** Twelve months of money by category (income positive, expenses negative), oldest first. */
function months() {
  const rng = createRng(1207).next;
  const out = [];
  for (let i = 0; i < 12; i++) {
    const growth = 0.55 + i * 0.05;
    const income = {
      tickets: Math.round((3200 + rng() * 500) * growth),
      food: Math.round((1300 + rng() * 300) * growth),
      souvenirs: Math.round((500 + rng() * 200) * growth),
      animalSales: i % 4 === 2 ? 900 : 0,
    };
    const expenses = {
      wages: Math.round(1800 * growth + (i > 7 ? 600 : 0)),
      food: Math.round((900 + rng() * 150) * growth),
      upkeep: Math.round(1100 * growth),
      vet: Math.round(rng() * 400),
      building: i === 3 ? 10000 : i === 9 ? 6000 : Math.round(rng() * 1200),
      loan: i < 6 ? 100 : 0,
    };
    out.push({ income, expenses });
  }
  return out;
}

/** Visitors per day for the last 28 days, with their average happiness. */
function visitorDays() {
  const rng = createRng(2804).next;
  return Array.from({ length: 28 }, (_, i) => {
    const weekend = i % 7 >= 5;
    const rain = i === 9 || i === 10 || i === 19;
    const visitors = Math.round(180 + i * 2.2 + (weekend ? 45 : 0) - (rain ? 70 : 0) + rng() * 20);
    return { visitors, happiness: Math.round(68 + rng() * 10 - (rain ? 9 : 0)) };
  });
}

export const FIXTURE = {
  zoo: {
    name: 'Pawprint Park',
    seed: 6,
    coins: 18450,
    stars: 42,
    level: LEVEL,
    xp: 1180,
    xpNext: xpToNext(LEVEL),
    reputation: 64,
    minute: MINUTE,
    speed: 1,
    weather: 'sun',
    temperature: 24,
    visitorsToday: 212,
    animals: 73,
  },

  /** The alert feed (PRD §15.2): warnings before things become critical. Newest first. */
  alerts: [
    { kind: 'hunger', level: 'warn', key: 'alert.hungrySoon', params: { name: 'Leo', days: 1 }, place: { biome: 'african-savanna', n: 2 }, ago: 4 },
    { kind: 'hunger', level: 'critical', key: 'alert.feederEmpty', params: { species: 'gentoo-penguin' }, place: { biome: 'polar', n: 1 }, ago: 12 },
    { kind: 'fence', level: 'warn', key: 'alert.fenceWearing', params: {}, place: { biome: 'african-savanna', n: 2 }, ago: 26 },
    { kind: 'health', level: 'warn', key: 'alert.ill', params: { name: 'Bramble', illness: 'cold', severity: 'mild' }, place: { biome: 'farmyard', n: 1 }, ago: 40 },
    { kind: 'thirst', level: 'warn', key: 'alert.waterDirty', params: {}, place: { biome: 'farmyard', n: 2 }, ago: 55 },
    { kind: 'dirt', level: 'warn', key: 'alert.dirty', params: { percent: 31 }, place: { biome: 'asian-jungle', n: 1 }, ago: 70 },
    { kind: 'happiness', level: 'warn', key: 'alert.tooSmall', params: { species: 'reticulated-giraffe', tiles: 40 }, place: { biome: 'african-savanna', n: 1 }, ago: 95 },
    { kind: 'temperature', level: 'warn', key: 'alert.tooHot', params: { species: 'gentoo-penguin' }, place: { biome: 'polar', n: 1 }, ago: 130 },
    { kind: 'info', level: 'warn', key: 'alert.workload', params: { role: 'caretaker', percent: 140 }, place: null, ago: 180 },
    { kind: 'info', level: 'warn', key: 'alert.due', params: { name: 'Nala', days: 3 }, place: { biome: 'african-savanna', n: 2 }, ago: 240 },
  ],

  /** The animal in the details panel (PRD §6.3). */
  animal: {
    name: 'Nala',
    species: 'lion',
    sex: 'female',
    ageYears: 4,
    stage: 'adult',
    enclosure: { biome: 'african-savanna', n: 2 },
    stats: { happiness: 71, health: 88, food: 34, water: 62 },
    /** Happiness drivers, each 0–100 (PRD §6.2), with a note key for the ones that are low. */
    drivers: [
      { id: 'space', score: 58, note: 'driver.space.short', params: { tiles: 24 } },
      { id: 'biome', score: 92 },
      { id: 'social', score: 95 },
      { id: 'enrichment', score: 40, note: 'driver.enrichment.missing', params: { item: 'climbing-frame' } },
      { id: 'cleanliness', score: 77 },
      { id: 'temperature', score: 100 },
      { id: 'visitors', score: 66, note: 'driver.visitors.crowded' },
      { id: 'personality', score: 80 },
      { id: 'treat', score: 100, note: 'driver.treat.recent' },
    ],
    traits: ['playful', 'greedy'],
    history: [
      { illness: 'parasites', severity: 'mild', day: 'calendar.ago', params: { count: 34 }, outcome: 'treated' },
      { illness: 'injury', severity: 'serious', day: 'calendar.ago', params: { count: 81 }, outcome: 'treated' },
    ],
    breeding: { allowed: true, pregnant: true, dueDays: 3, litter: '2–3' },
    parents: { mother: { name: 'Zuri', origin: 'zoo.partner.1' }, father: { name: 'Kito', origin: 'zoo.partner.2' } },
    family: { mate: 'Leo', siblings: ['Asha'] },
    compatibility: {
      good: ['plains-zebra'],
      neutral: ['common-ostrich', 'meerkat'],
      never: ['reticulated-giraffe', 'common-warthog'],
    },
    fact: 'fact.lion.1',
  },

  /** The chore under way (PRD §4): which, how far along, and the XP it gives. */
  chore: { key: 'chore.feed', target: 'Leo', progress: 0.62, seconds: 1.5, xp: 2 },

  /** Quick-travel (PRD §4): where to, from the alert feed, and the places on the list. */
  travel: {
    to: { biome: 'african-savanna', n: 2 },
    seconds: 4,
    places: [
      { biome: 'farmyard', n: 1, warn: 'health', distance: 18 },
      { biome: 'farmyard', n: 2, warn: 'thirst', distance: 26 },
      { biome: 'african-savanna', n: 2, warn: 'hunger', distance: 64 },
      { biome: 'african-savanna', n: 1, warn: 'happiness', distance: 82 },
      { biome: 'asian-jungle', n: 1, warn: 'dirt', distance: 95 },
      { biome: 'polar', n: 1, warn: 'temperature', distance: 120 },
      { biome: 'aviary', n: 1, warn: null, distance: 141 },
      { building: 'storehouse', warn: null, distance: 22 },
    ],
  },

  /** Build mode (PRD §4): the item being placed, and what it costs. */
  build: { biome: 'african-savanna', size: 'M', stars: 19, coins: 1500, refund: 750, reason: 'path' },

  shop: {
    sections: ['animals', 'food', 'medicine', 'enclosures', 'equipment', 'facilities', 'decorations', 'conservation', 'stars'],
    /** Market listings refresh weekly (PRD §11.5); `bred` ones come from this zoo. */
    market: [
      { species: 'reticulated-giraffe', name: 'Tamu', sex: 'male', age: 'juvenile', price: 1240, health: 96, from: 'zoo.partner.3', traits: ['curious'] },
      { species: 'plains-zebra', name: 'Kibo', sex: 'female', age: 'adult', price: 480, health: 90, from: 'zoo.partner.1', traits: ['social'] },
      { species: 'lion', name: 'Simba', sex: 'male', age: 'adult', price: 2900, health: 84, from: 'zoo.partner.2', traits: ['lazy', 'grumpy'] },
      { species: 'meerkat', name: 'Pip', sex: 'female', age: 'juvenile', price: 320, health: 100, from: 'zoo.partner.4', traits: ['curious', 'playful'] },
      { species: 'red-panda', name: 'Mei', sex: 'female', age: 'adult', price: 1100, health: 92, from: 'zoo.partner.5', traits: ['shy'] },
      { species: 'malayan-tapir', name: 'Bayu', sex: 'male', age: 'adult', price: 2400, health: 88, from: 'zoo.partner.3', traits: ['lazy'] },
      { species: 'domestic-goat', name: 'Clover', sex: 'female', age: 'juvenile', price: 90, health: 100, bred: true, traits: ['greedy'] },
      { species: 'chicken', name: 'Pepper', sex: 'female', age: 'adult', price: 40, health: 97, bred: true, traits: ['social'] },
      { species: 'bengal-tiger', locked: true, unlockLevel: 17 },
      { species: 'giant-panda', locked: true, unlockLevel: 32 },
    ],
    food: [
      { id: 'hay', price: 2, stock: 140, perDay: 22 },
      { id: 'vegetables', price: 3, stock: 60, perDay: 14 },
      { id: 'pellets', price: 3, stock: 85, perDay: 9 },
      { id: 'fruit', price: 4, stock: 18, perDay: 8 },
      { id: 'insects', price: 5, stock: 40, perDay: 7 },
      { id: 'fish', price: 6, stock: 26, perDay: 18 },
      { id: 'meat', price: 8, stock: 9, perDay: 12 },
      { id: 'nectar', price: 6, stock: 0, perDay: 0, locked: true, unlockLevel: 14 },
      { id: 'plankton', price: 5, stock: 0, perDay: 0, locked: true, unlockLevel: 20 },
    ],
    bulk: [10, 50, 200],
    medicine: [
      { id: 'cold', price: 30, stock: 2 },
      { id: 'parasites', price: 30, stock: 0 },
      { id: 'food-poisoning', price: 30, stock: 1 },
      { id: 'overfeeding', price: 30, stock: 0 },
      { id: 'dental', price: 30, stock: 0 },
    ],
    enclosures: [
      { size: 'S', stars: 10, coins: 300 },
      { size: 'M', stars: 19, coins: 1500 },
      { size: 'L', stars: 35, coins: 10000 },
      { size: 'XL', stars: 58, coins: 40000, locked: true, unlockLevel: 15 },
    ],
    biomes: ['farmyard', 'african-savanna', 'asian-jungle', 'polar', 'coast', 'wetland', 'reptile-house', 'aviary'],
    biomeLocks: BIOME_LOCKS,
    plot: { stars: 26, buyable: 5 },
    equipment: [
      { id: 'feeder', price: 100 },
      { id: 'water', price: 80 },
      { id: 'shelter', price: 400 },
      { id: 'heater', price: 600 },
      { id: 'cooler', price: 800 },
      { id: 'pool', price: 1200 },
      { id: 'climbing-frame', price: 450 },
      { id: 'toy', price: 150 },
      { id: 'chute', price: 350 },
      { id: 'feeder-auto', price: 900, locked: true, unlockLevel: 18 },
    ],
    facilities: [
      { id: 'bin', price: 30 },
      { id: 'bench', price: 50 },
      { id: 'toilet', price: 600 },
      { id: 'drinks', price: 800 },
      { id: 'coffee', price: 1000 },
      { id: 'ice-cream', price: 1000 },
      { id: 'hotdog', price: 1200 },
      { id: 'playground', price: 2000 },
      { id: 'souvenir', price: 2500 },
      { id: 'storehouse', price: 3000 },
      { id: 'quarters', price: 4000 },
      { id: 'restaurant', price: 6000, locked: true, unlockLevel: 13 },
      { id: 'show-arena', price: 15000, locked: true, unlockLevel: 19 },
    ],
    decorations: [
      { id: 'flowers', price: 20 },
      { id: 'bush', price: 35 },
      { id: 'rock', price: 40 },
      { id: 'tree', price: 60 },
      { id: 'fountain', price: 900 },
      { id: 'statue', price: 1500 },
      { id: 'pumpkins', price: 120, seasonal: 'halloween' },
      { id: 'lantern', price: 90, seasonal: 'halloween' },
    ],
    landmarks: [
      { id: 'clock-tower', price: 50000, owned: true },
      { id: 'fountain-plaza', price: 80000 },
      { id: 'panda-statue', price: 150000, locked: true, unlockLevel: 32 },
      { id: 'light-show', price: 300000, locked: true, unlockLevel: 38 },
    ],
    conservation: [
      { id: 'snow-leopard-valley', species: 'snow-leopard', funded: 0 },
      { id: 'turtle-beach', species: 'green-sea-turtle', funded: 2 },
      { id: 'rhino-patrol', species: 'black-rhinoceros', funded: 1 },
    ],
    funded: 3,
    /** Free star packs (PRD §11.6, economy.md §4.4). */
    starPacks: [25, 100, 500],
    exchangeRate: 100,
  },

  stats: {
    months: months(),
    days: visitorDays(),
    /** Why visitors were unhappy this week, as shares of complaints. */
    complaints: [
      { id: 'queues', share: 0.31 },
      { id: 'toilets', share: 0.24 },
      { id: 'litter', share: 0.18 },
      { id: 'prices', share: 0.15 },
      { id: 'shade', share: 0.12 },
    ],
    reputation: [52, 54, 53, 55, 57, 58, 58, 60, 61, 61, 63, 64],
    reputationDrivers: [
      { id: 'welfare', value: 78 },
      { id: 'visitors', value: 71 },
      { id: 'variety', value: 55 },
      { id: 'cleanliness', value: 66 },
      { id: 'deaths', value: 100 },
      { id: 'inspection', value: 70 },
    ],
    /** Work against capacity per role (PRD §9); `hire` is how many more would cover it. */
    workload: [
      { role: 'caretaker', work: 168, capacity: 120, staff: 2, hire: 1 },
      { role: 'janitor', work: 64, capacity: 90, staff: 2, hire: 0 },
      { role: 'guard', work: 7, capacity: 6, staff: 1, hire: 1, unit: 'enclosures' },
      { role: 'vet', work: 73, capacity: 0, staff: 0, hire: 1, unit: 'animals' },
    ],
    welfare: { happy: 58, ok: 11, unhappy: 4, sick: 2, pregnant: 1 },
  },

  staff: {
    /** Hired staff with their zones. */
    team: [
      { name: 'Marta', role: 'caretaker', quality: 3, speed: 3, wage: 280, zone: 'farm', morale: 'happy' },
      { name: 'Dev', role: 'caretaker', quality: 4, speed: 2, wage: 340, zone: 'savanna', morale: 'happy' },
      { name: 'Ola', role: 'janitor', quality: 2, speed: 4, wage: 190, zone: 'all', morale: 'ok' },
      { name: 'Tomás', role: 'janitor', quality: 3, speed: 3, wage: 240, zone: 'all', morale: 'happy' },
      { name: 'Ines', role: 'guard', quality: 3, speed: 3, wage: 300, zone: 'savanna', morale: 'unpaid' },
    ],
    /** This week's candidates (the list refreshes weekly). */
    candidates: [
      { name: 'Ada', role: 'caretaker', quality: 4, speed: 4, wage: 390 },
      { name: 'Ben', role: 'caretaker', quality: 2, speed: 3, wage: 210 },
      { name: 'Chloe', role: 'vet', quality: 3, speed: 2, wage: 1300 },
      { name: 'Dario', role: 'guard', quality: 5, speed: 3, wage: 480 },
      { name: 'Eva', role: 'janitor', quality: 1, speed: 5, wage: 150 },
    ],
    refreshDays: 4,
    /** Work zones on the overview: each a set of showcase sections. */
    zones: [
      { id: 'farm', color: '#e58f3c', sections: ['start', 'wear', 'dirt'] },
      { id: 'savanna', color: '#3d8fd6', sections: ['sizes'] },
      { id: 'all', color: '#7a5bc4', sections: [] },
    ],
  },

  /** Three active goals (PRD §12.2); during the tutorial they are the tutorial steps (§15.1). */
  goals: {
    tutorial: [
      { key: 'goal.tutorial.walk', done: true },
      { key: 'goal.tutorial.clean', done: true },
      { key: 'goal.tutorial.feed', progress: [1, 2] },
      { key: 'goal.tutorial.name' },
      { key: 'goal.tutorial.treat' },
      { key: 'goal.tutorial.goat' },
      { key: 'goal.tutorial.fee' },
    ],
    active: [
      { key: 'goal.breed', params: { species: 'gentoo-penguin' }, progress: [0, 1], stars: 4, xp: 180 },
      { key: 'goal.visitors', params: { count: 300 }, progress: [212, 300], stars: 3, xp: 180 },
      { key: 'goal.open', params: { biome: 'polar' }, progress: [1, 1], stars: 5, xp: 180, done: true },
    ],
    tutorialReward: 1000,
    tip: { key: 'tip.joining', icon: 'grid' },
  },

  /** The level-up moment (PRD §12.1). */
  levelUp: {
    level: 13,
    stars: 3,
    unlocks: [
      { kind: 'biome', id: 'wetland' },
      { kind: 'species', id: 'chilean-flamingo' },
      { kind: 'facility', id: 'restaurant' },
    ],
  },

  /** The newborn waiting for a name, with a suggested random one. */
  naming: { zoo: 'Pawprint Park', animal: 'Nala', baby: { species: 'gentoo-penguin', suggestion: 'Pebble' }, max: 24 },

  zoopedia: zoopedia(),
  /** The species page shown (PRD §14). */
  species: { id: 'plains-zebra', facts: ['fact.plains-zebra.1', 'fact.plains-zebra.2', 'fact.plains-zebra.3'], range: 'range.plains-zebra', lifespan: 25, diet: 'herb', status: 'NT', gestationDays: 52, portions: 4 },

  photo: { subject: 'reticulated-giraffe', taken: 14, goldNeeds: 'reticulated-giraffe' },

  settings: { quality: 'medium', auto: 'medium', music: 60, sound: 80, muted: false, language: 'en', reducedMotion: false },

  /** Save slots (PRD §18), newest first. `bytes` is the slot's size in storage. */
  slots: [
    { name: 'Pawprint Park', seed: 6, day: 87, savedAgo: 2, bytes: 412_000, level: 12, current: true },
    { name: 'Penguin Point', seed: 21, day: 312, savedAgo: 3 * 24 * 60, bytes: 1_380_000, level: 27 },
    { name: 'Tiny Farm', seed: 3, day: 9, savedAgo: 9 * 24 * 60, bytes: 64_000, level: 2 },
    { name: 'Savanna Dreams', seed: 44, day: 140, savedAgo: 30 * 24 * 60, bytes: 905_000, level: 16 },
  ],
  /** Storage used on this origin, as a share of about 5 MB; `nearlyFull` from 80% (src/core/slots.js). */
  storage: { used: 2_870_000, quota: 5 * 1024 * 1024 },
  storageFull: { used: 4_420_000, quota: 5 * 1024 * 1024 },
  autosavedAgo: 2,
};

/** The "{biome} {n}" name of a fixture enclosure. */
export const placeKey = (place) => (place ? `${place.biome}:${place.n}` : '');

/** Warnings the badges show, cycled over the enclosures so every kind and both levels appear. */
const BADGE_WARNINGS = [[], [{ kind: 'hunger', level: 'warn' }], [], [{ kind: 'dirt', level: 'warn' }, { kind: 'thirst', level: 'critical' }], [], [{ kind: 'fence', level: 'warn' }], [{ kind: 'health', level: 'critical' }], []];

/**
 * Overview badges (PRD §17.1) for placed enclosures: the most common species' icon, the animal count and any
 * warnings.
 * @param {{ id: number, kind: string, residents?: { species: string }[] }[]} placements
 */
export function overviewBadges(placements) {
  return placements
    .filter((p) => p.kind === 'enclosure' && p.residents?.length)
    .map((p, i) => {
      const counts = {};
      for (const r of p.residents) counts[r.species] = (counts[r.species] ?? 0) + 1;
      const species = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
      return { id: p.id, species, count: p.residents.length, warnings: BADGE_WARNINGS[i % BADGE_WARNINGS.length] };
    });
}
