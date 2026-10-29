// Economy pacing simulation for docs/economy.md.
//
// Plays a greedy "reasonable player" day by day and prints checkpoints against the pacing targets (economy.md §1).
// Deterministic: it uses expected values (illness rates, purchase chances) instead of an RNG.
//
//   node scripts/economy-sim.js              full catalogue (233 species)
//   node scripts/economy-sim.js --v1         only the 30 v1 species
//   node scripts/economy-sim.js --visitorExp=0.6 --sinks=0   any numeric setting can be overridden
//
// This is a throwaway prototype. The real numbers move to src/data/economy.js with bun tests on top.

import { readFileSync } from 'node:fs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v === undefined ? true : Number(v)];
  }),
);

// ---- Numbers from docs/economy.md ---------------------------------------------------------------------------------

const E = {
  startCoins: 2000,
  startRep: 30,
  appeal: [0, 2, 4, 8, 14, 22, 35, 55, 80],
  extraAnimalAppeal: 0.25,
  babyAppealMult: 1.5,
  visitorK: 12,
  visitorExp: 0.5,
  weatherAvg: 0.9, // sun/rain/snow/heat averaged over a year
  feeBase: 4,
  feeK: 0.15,
  // stand: [price, purchase chance per visitor, upkeep per month, build cost]
  stands: {
    drink: [2, 0.5, 60, 800],
    coffee: [3, 0.3, 80, 1000],
    hotdog: [4, 0.4, 100, 1200],
    icecream: [3, 0.3, 80, 1000],
    souvenir: [8, 0.2, 200, 2500],
    restaurant: [10, 0.15, 400, 6000],
  },
  standMargin: 0.6,
  standCapacity: 250, // visitors per day one stand can serve
  toilet: { cost: 600, upkeep: 60, per: 200 },
  playground: { cost: 2000, upkeep: 100 },
  animalPrice: [0, 120, 450, 1100, 2700, 6500, 14000, 32000, 65000], // tier midpoints
  foodPerDay: [0, 4, 8, 10, 16, 24, 32, 40, 48], // portions × cost per portion
  enclosureUpkeep: { S: 3, M: 10, L: 30, XL: 80 },
  enclosureCoins: { S: 300, M: 1500, L: 10000, XL: 40000 },
  habitatAppeal: 0.15, // per habitat upgrade level (max 3)
  habitatCostMult: [1, 2, 4], // × enclosureCoins for upgrade 1, 2, 3
  conservationCost: 1000, // × keeper level per project
  conservationRep: 1,
  enclosureStars: { S: 5, M: 10, L: 18, XL: 30 },
  enclosureGrowth: 0.08,
  plotStars: 15,
  plotGrowth: 0.25,
  enclosuresPerPlot: 6,
  // staff at quality 3: [wage per month, work points per day]
  caretaker: [300, 50],
  janitor: [240, 50],
  guard: [340],
  vet: [1400],
  vetAnimals: 40,
  keeperPoints: 20, // what the player does by hand per in-game day
  xpPerPoint: 1.6, // feed 2/pt, water 1/pt, poop 2/pt, clean 1.67/pt
  workPerAnimal: 2.5, // feed + water + poop
  workPerEnclosure: 1.5, // a full clean every 2 days
  litterPerVisitors: 25, // 1 work point per 25 visitors
  illnessRate: 0.003, // mild illnesses per animal per day, well cared for
  seriousShare: 0.25,
  otcMedicine: 30,
  vetCallout: (tier) => 250 + 50 * tier,
  vetVisits: 2,
  happyThreshold: 0.75,
  happyStarEvery: 1, // days
  levelUpStars: (level) => 2 + Math.floor(level / 10),
  goalEvery: 6, // days per completed goal (3 active goals)
  goalStars: 4,
  goalXpBase: 60,
  goalXpPerLevel: 10,
  firstBirthStars: 3,
  birthXp: 25,
  newSpeciesXp: 25,
  newSpeciesXpPerTier: 25,
  xpBase: 30,
  xpExp: 1.55,
  janitorAtLitter: 8, // unattended litter points before the player hires a janitor

  levelCap: 50,
  tierUnlock: [0, 1, 2, 5, 11, 17, 24, 32, 41],
  tier3Level: 5,
  tutorialCoins: 1000, // reward for finishing the tutorial goals
  sinks: 1, // 0 turns off habitat upgrades and conservation projects
  gestationDays: [0, 25, 30, 40, 45, 50, 80, 100, 120], // also used as days to maturity
  groupCap: 5,
  starToCoins: 100,
  loanInterest: 0.02,
  yearDays: 84,
};

// --key=value overrides any numeric setting; --enclosureCoins=a,b,c,d sets S,M,L,XL.
for (const [k, v] of Object.entries(args)) {
  if (typeof E[k] === 'number') E[k] = v;
}
if (process.argv.some((a) => a.startsWith('--enclosureCoins='))) {
  const v = process.argv.find((a) => a.startsWith('--enclosureCoins=')).split('=')[1].split(',').map(Number);
  E.enclosureCoins = { S: v[0], M: v[1], L: v[2], XL: v[3] };
}
if (process.argv.some((a) => a.startsWith('--enclosureUpkeep='))) {
  const v = process.argv.find((a) => a.startsWith('--enclosureUpkeep=')).split('=')[1].split(',').map(Number);
  E.enclosureUpkeep = { S: v[0], M: v[1], L: v[2], XL: v[3] };
}
E.tierUnlock[3] = E.tier3Level;
E.xpToNext = (level) => Math.round(E.xpBase * level ** E.xpExp);
E.goalXp = (level) => E.goalXpBase + E.goalXpPerLevel * level;

const MONTH = 7;
const MIN_PER_DAY = 2;

// ---- Species catalogue -------------------------------------------------------------------------------------------

const catalogue = readFileSync(new URL('../docs/species.md', import.meta.url), 'utf8')
  .split('\n')
  .filter((l) => /^\| \d+ \|/.test(l))
  .map((l) => {
    const c = l.split('|').map((x) => x.trim());
    return { name: c[2], tier: Number(c[5]), v1: c[8].includes('v1') };
  })
  .filter((sp) => !args.v1 || sp.v1);

const sizeForTier = (t) => (t <= 2 ? 'S' : t <= 4 ? 'M' : t <= 6 ? 'L' : 'XL');

// ---- State -------------------------------------------------------------------------------------------------------

const sheep = catalogue.find((sp) => sp.name === 'Domestic sheep');
const s = {
  day: 0,
  coins: E.startCoins,
  stars: 0,
  xp: 0,
  level: 1,
  rep: E.startRep,
  happiness: 0.3, // the neglected sheep
  loan: 0,
  plots: 0,
  enclosures: [
    { size: 'S', species: sheep },
    { size: 'S', species: null },
  ],
  groups: new Map([[sheep.name, { sp: sheep, adults: 1, babies: [], lastBirth: -999 }]]),
  staff: { caretaker: 0, janitor: 0, guard: 0, vet: 0 },
  stands: { drink: 0, coffee: 0, hotdog: 0, icecream: 0, souvenir: 0, restaurant: 0 },
  toilets: 0,
  playground: 0,
  firstBirth: new Set(),
  visitors: 0,
  litterCov: 1,
  inspection: 50,
  month: { income: 0, expense: 0, capex: 0 },
  last: { income: 0, expense: 0, capex: 0 },
  lastMonthProfit: 0,
  events: [],
};

const log = (what) => s.events.push({ day: s.day, what });
const animalCount = () => [...s.groups.values()].reduce((n, g) => n + g.adults + g.babies.length, 0);
const ownedNames = () => new Set([...s.enclosures].filter((e) => e.species).map((e) => e.species.name));
const topTier = () => Math.max(0, ...[...s.groups.values()].map((g) => g.sp.tier));

// Running costs (food, upkeep, wages, medicine) vs purchases (animals, enclosures, facilities).
function spend(amount) {
  s.coins -= amount;
  s.month.expense += amount;
}
function buy(amount) {
  s.coins -= amount;
  s.month.capex += amount;
}
function earn(amount) {
  s.coins += amount;
  s.month.income += amount;
}
function addXp(xp) {
  s.xp += xp;
  while (s.level < E.levelCap && s.xp >= E.xpToNext(s.level)) {
    s.xp -= E.xpToNext(s.level);
    s.level++;
    s.stars += E.levelUpStars(s.level);
    log(`level ${s.level}`);
  }
}

function monthlyCosts() {
  const wages =
    s.staff.caretaker * E.caretaker[0] + s.staff.janitor * E.janitor[0] + s.staff.guard * E.guard[0] + s.staff.vet * E.vet[0];
  let daily = 0;
  for (const g of s.groups.values()) daily += (g.adults + g.babies.length * 0.5) * E.foodPerDay[g.sp.tier];
  for (const e of s.enclosures) daily += E.enclosureUpkeep[e.size];
  let upkeep = s.toilets * E.toilet.upkeep + s.playground * E.playground.upkeep;
  for (const [k, n] of Object.entries(s.stands)) upkeep += n * E.stands[k][2];
  return wages + daily * MONTH + upkeep;
}
const reserve = () => monthlyCosts();
const canAfford = (cost) => s.coins - cost >= reserve();

// ---- One in-game day ---------------------------------------------------------------------------------------------

function simulateDay() {
  const animals = animalCount();

  // Work: staff first, the keeper covers the rest, litter last.
  const animalWork = animals * E.workPerAnimal + s.enclosures.length * E.workPerEnclosure;
  const careCap = s.staff.caretaker * E.caretaker[1];
  const keeperOnAnimals = Math.min(E.keeperPoints, Math.max(0, animalWork - careCap));
  const coverage = animalWork === 0 ? 1 : Math.min(1, (careCap + keeperOnAnimals) / animalWork);
  const litterWork = s.visitors / E.litterPerVisitors;
  const keeperLeft = E.keeperPoints - keeperOnAnimals;
  const keeperOnLitter = Math.min(keeperLeft, Math.max(0, litterWork - s.staff.janitor * E.janitor[1]));
  s.litterCov = litterWork === 0 ? 1 : Math.min(1, (s.staff.janitor * E.janitor[1] + keeperOnLitter) / litterWork);
  addXp((keeperOnAnimals + keeperOnLitter) * E.xpPerPoint);

  // Happiness drifts toward what the care level supports.
  const target = 0.35 + 0.55 * coverage;
  s.happiness += (target - s.happiness) * 0.1;

  // Illness (expected values).
  const guardsOk = s.staff.guard >= Math.ceil(s.enclosures.length / 6) || s.visitors < 100;
  const ill = animals * E.illnessRate * (1 + 2 * (1 - coverage)) * (guardsOk ? 1 : 1.5);
  spend(ill * (1 - E.seriousShare) * E.otcMedicine);
  if (!s.staff.vet) spend(ill * E.seriousShare * E.vetVisits * E.vetCallout(Math.max(1, topTier() - 1)));

  // Appeal and visitors.
  let appeal = 0;
  for (const e of s.enclosures) {
    const g = e.species && s.groups.get(e.species.name);
    if (!g) continue;
    const base = E.appeal[g.sp.tier] * (1 + E.habitatAppeal * (e.quality ?? 0));
    const youngBabies = g.babies.filter((age) => age < 30).length;
    const extra = Math.max(0, g.adults - 1) + (g.babies.length - youngBabies) + youngBabies * E.babyAppealMult;
    appeal += base * (1 + E.extraAnimalAppeal * extra);
  }
  appeal *= s.happiness;
  s.appeal = appeal;
  s.visitors = appeal > 0 ? E.visitorK * appeal ** E.visitorExp * (0.5 + s.rep / 100) * E.weatherAvg : 0;
  const fee = E.feeBase + E.feeK * Math.sqrt(appeal);
  s.fee = fee;
  let standGross = 0;
  for (const [k, n] of Object.entries(s.stands)) {
    if (!n) continue;
    const served = Math.min(1, (n * E.standCapacity) / Math.max(1, s.visitors));
    standGross += s.visitors * served * E.stands[k][1] * E.stands[k][0];
  }
  earn(s.visitors * fee + standGross * E.standMargin);

  // Daily costs; wages, facility upkeep and loan interest monthly.
  let food = 0;
  for (const g of s.groups.values()) food += (g.adults + g.babies.length * 0.5) * E.foodPerDay[g.sp.tier];
  let upkeep = 0;
  for (const e of s.enclosures) upkeep += E.enclosureUpkeep[e.size];
  spend(food + upkeep);
  if (s.day % MONTH === MONTH - 1) {
    const wages =
      s.staff.caretaker * E.caretaker[0] + s.staff.janitor * E.janitor[0] + s.staff.guard * E.guard[0] + s.staff.vet * E.vet[0];
    let fac = s.toilets * E.toilet.upkeep + s.playground * E.playground.upkeep;
    for (const [k, n] of Object.entries(s.stands)) fac += n * E.stands[k][2];
    spend(wages + fac + s.loan * E.loanInterest);
    s.lastMonthProfit = s.month.income - s.month.expense;
    s.last = s.month;
    s.month = { income: 0, expense: 0, capex: 0 };
  }

  // Breeding and transfers of surplus adults.
  for (const g of s.groups.values()) {
    g.babies = g.babies.map((a) => a + 1);
    const grown = g.babies.filter((a) => a >= E.gestationDays[g.sp.tier]).length;
    g.babies = g.babies.filter((a) => a < E.gestationDays[g.sp.tier]);
    g.adults += grown;
    while (g.adults + g.babies.length > E.groupCap - 1 && g.adults > 2 && grown) {
      g.adults--;
      s.stars += Math.ceil(g.sp.tier / 2);
      s.rep = Math.min(100, s.rep + 2);
      break;
    }
    const total = g.adults + g.babies.length;
    if (g.adults >= 2 && s.happiness >= 0.7 && total < E.groupCap && s.day - g.lastBirth >= E.gestationDays[g.sp.tier]) {
      g.babies.push(0);
      g.lastBirth = s.day;
      addXp(E.birthXp);
      if (!s.firstBirth.has(g.sp.name)) {
        s.firstBirth.add(g.sp.name);
        s.stars += E.firstBirthStars;
        if (s.firstBirth.size === 1) log(`first birth (${g.sp.name})`);
      }
    }
  }

  // Stars and XP from care, goals and the yearly events.
  if (animals && s.happiness >= E.happyThreshold && s.day % E.happyStarEvery === 0) s.stars++;
  if (s.day === 5) earn(E.tutorialCoins);
  if (s.day > 0 && s.day % E.goalEvery === 0) {
    s.stars += E.goalStars;
    addXp(E.goalXp(s.level));
  }
  if (s.day > 0 && s.day % E.yearDays === 0) {
    if (s.happiness >= 0.8 && s.litterCov >= 0.9) [s.inspection, s.stars] = [90, s.stars + 5];
    else if (s.happiness >= 0.65) [s.inspection, s.stars] = [70, s.stars + 2];
    else [s.inspection] = [40, spend(500)];
    addXp(75);
    if (s.rep >= 60) {
      s.stars += 7;
      addXp(150);
    }
  }

  // Reputation drifts toward its target by at most 1 a day.
  const hasFood = s.stands.coffee + s.stands.hotdog + s.stands.restaurant > 0;
  const toiletsOk = s.toilets >= Math.ceil(s.visitors / E.toilet.per);
  const visitorHappy =
    40 + 10 * (s.stands.drink > 0) + 10 * hasFood + 10 * toiletsOk + 10 + 10 * (s.playground + s.stands.souvenir > 0);
  const variety = 100 * (1 - Math.exp(-s.groups.size / 25));
  const repTarget =
    0.4 * s.happiness * 100 + 0.25 * visitorHappy + 0.15 * variety + 0.1 * s.litterCov * 100 + 0.1 * s.inspection;
  s.rep += Math.max(-1, Math.min(1, repTarget - s.rep));

  // Loans.
  if (s.coins < 0) {
    s.loan += -s.coins + 500;
    s.coins = 500;
  } else if (s.loan && s.coins > s.loan + 3 * reserve()) {
    s.coins -= s.loan;
    s.loan = 0;
  }

  decide(animalWork, careCap, litterWork);
  s.day++;
}

// ---- The player's choices ----------------------------------------------------------------------------------------

function hire(role, wage) {
  if (s.coins - 2 * wage < reserve() * 0.5) return false;
  s.staff[role]++;
  if (s.staff[role] === 1) log(`first ${role}`);
  return true;
}

// The highest-tier unlocked species we don't own yet that we can stock soon.
function pickSpecies() {
  const owned = ownedNames();
  const open = catalogue.filter((sp) => !owned.has(sp.name) && E.tierUnlock[sp.tier] <= s.level);
  const affordable = open.filter((sp) => 2 * E.animalPrice[sp.tier] <= s.coins + Math.max(0, s.lastMonthProfit));
  return affordable.sort((a, b) => b.tier - a.tier)[0] ?? null;
}

function decide(animalWork, careCap, litterWork) {
  // Staff: keep the keeper's own load at or below their capacity.
  if (animalWork - careCap > E.keeperPoints) hire('caretaker', E.caretaker[0]);
  const janitorCap = s.staff.janitor * E.janitor[1];
  const unattended = litterWork - janitorCap - Math.max(0, E.keeperPoints - Math.max(0, animalWork - careCap));
  if (unattended > E.janitorAtLitter) hire('janitor', E.janitor[0]);
  if (s.visitors >= 100 && s.staff.guard < Math.ceil(s.enclosures.length / 6)) hire('guard', E.guard[0]);
  const animals = animalCount();
  if (animals >= 25 && s.staff.vet < Math.ceil(animals / E.vetAnimals)) hire('vet', E.vet[0]);

  // Basic visitor facilities first.
  const v = s.visitors;
  const wantToilets = v > 40 ? Math.ceil(v / E.toilet.per) : 0;
  if (s.toilets < wantToilets && canAfford(E.toilet.cost)) {
    buy(E.toilet.cost);
    s.toilets++;
  }
  const standWants = [
    ['drink', v > 0 ? Math.ceil(v / E.standCapacity) : 0],
    ['coffee', v > 60 ? Math.ceil(v / E.standCapacity) : 0],
    ['hotdog', v > 100 ? Math.ceil(v / E.standCapacity) : 0],
  ];
  for (const [k, want] of standWants) {
    if (s.stands[k] < want && canAfford(E.stands[k][3])) {
      buy(E.stands[k][3]);
      s.stands[k]++;
      if (k === 'drink' && s.stands[k] === 1) log('first stand');
    }
  }

  // Animals: fill empty enclosures with a breeding pair; give lone animals a partner.
  for (const e of s.enclosures) if (!e.species) e.species = pickSpecies();
  for (const e of s.enclosures) {
    if (!e.species || s.groups.has(e.species.name)) continue;
    const price = E.animalPrice[e.species.tier];
    if (canAfford(2 * price)) {
      buy(2 * price);
      s.groups.set(e.species.name, { sp: e.species, adults: 2, babies: [], lastBirth: s.day });
      addXp(E.newSpeciesXp + E.newSpeciesXpPerTier * e.species.tier);
      if (e.species.tier >= 3 && !s.events.some((x) => x.what.startsWith('first tier 3')))
        log(`first tier 3+ species (${e.species.name})`);
    }
  }
  for (const g of s.groups.values()) {
    if (g.adults === 1 && canAfford(E.animalPrice[g.sp.tier])) {
      buy(E.animalPrice[g.sp.tier]);
      g.adults++;
    }
  }

  // New enclosure (stars) once every enclosure is stocked: the best species we can stock soon.
  const allStocked = s.enclosures.every((e) => e.species && s.groups.has(e.species.name));
  if (allStocked) {
    const pick = pickSpecies();
    if (pick) {
      const plotsNeeded = Math.max(0, Math.ceil((s.enclosures.length + 1) / E.enclosuresPerPlot) - 1);
      if (s.plots < plotsNeeded) {
        const cost = Math.round(E.plotStars * (1 + E.plotGrowth * s.plots));
        if (s.stars >= cost) {
          s.stars -= cost;
          s.plots++;
        }
      } else {
        const size = sizeForTier(pick.tier);
        const cost = Math.round(E.enclosureStars[size] * (1 + E.enclosureGrowth * s.enclosures.length));
        if (s.stars >= cost && canAfford(E.enclosureCoins[size] + 2 * E.animalPrice[pick.tier])) {
          s.stars -= cost;
          buy(E.enclosureCoins[size]);
          s.enclosures.push({ size, species: pick });
        }
      }
    }
  }

  // Exchange stars the player can't use soon (more than two enclosures' worth) when coins are the bottleneck.
  const nextEnclosure = Math.round(E.enclosureStars.L * (1 + E.enclosureGrowth * s.enclosures.length));
  const spare = s.stars - 2 * nextEnclosure;
  if (spare > 0 && s.coins < 2 * reserve() + 2 * E.animalPrice[Math.min(8, topTier() + 1)]) {
    s.stars -= spare;
    s.coins += spare * E.starToCoins;
    s.exchanged = (s.exchanged ?? 0) + spare;
  }

  // Extras once the basics are covered.
  const extras = [
    ['icecream', v > 150 ? Math.ceil(v / E.standCapacity) : 0],
    ['souvenir', v > 200 ? Math.ceil(v / E.standCapacity) : 0],
    ['restaurant', v > 400 ? Math.ceil(v / E.standCapacity / 2) : 0],
  ];
  for (const [k, want] of extras) {
    if (s.stands[k] < want && canAfford(E.stands[k][3] * 2)) {
      buy(E.stands[k][3]);
      s.stands[k]++;
    }
  }
  if (v > 150 && !s.playground && canAfford(E.playground.cost * 2)) {
    buy(E.playground.cost);
    s.playground = 1;
  }
  if (!E.sinks) return;

  // Habitat upgrades: the cheapest one first, once next expansion is funded.
  const owned = ownedNames();
  const nextSp = catalogue
    .filter((sp) => !owned.has(sp.name) && E.tierUnlock[sp.tier] <= s.level)
    .sort((a, b) => b.tier - a.tier)[0];
  const expansion = nextSp ? E.enclosureCoins[sizeForTier(nextSp.tier)] + 2 * E.animalPrice[nextSp.tier] : 0;
  const upgradable = s.enclosures
    .filter((e) => e.species && (e.quality ?? 0) < 3)
    .map((e) => ({ e, cost: E.enclosureCoins[e.size] * E.habitatCostMult[e.quality ?? 0] }))
    .sort((a, b) => a.cost - b.cost)[0];
  if (upgradable && canAfford(upgradable.cost + expansion)) {
    buy(upgradable.cost);
    upgradable.e.quality = (upgradable.e.quality ?? 0) + 1;
    s.upgrades = (s.upgrades ?? 0) + 1;
  }

  // Conservation projects soak up anything beyond six months of costs plus the next expansion.
  const project = E.conservationCost * s.level;
  while (s.coins - project > 6 * reserve() + expansion) {
    buy(project);
    s.conservation = (s.conservation ?? 0) + project;
    s.rep = Math.min(100, s.rep + E.conservationRep);
  }
}

// ---- Run and report ----------------------------------------------------------------------------------------------

const checkpoints = [
  [10, 'L2, sheep healthy, goat bought'],
  [30, 'L4, 3–4 encl, 6–8 animals, 1st hire'],
  [60, 'L7, first tier 3, first baby'],
  [300, 'L15, ~8 encl, 5–6 staff'],
  [600, 'L20, lions/tigers, 3–4 biomes'],
  [1800, 'L32, elephants, polar bears'],
  [4800, 'L50 between 80 and 100 h'],
  [6000, 'L50, everything unlocked'],
];
for (const h of [args.until].flat().filter(Boolean)) checkpoints.push([h * 60, 'long run']);

const fmt = (n) => (Math.abs(n) >= 10000 ? `${Math.round(n / 1000)}k` : Math.round(n).toLocaleString('en'));
const time = (min) => (min < 60 ? `${min} min` : `${+(min / 60).toFixed(1)} h`);
const rows = [];
let ci = 0;
const endDay = checkpoints.at(-1)[0] / MIN_PER_DAY;
while (s.day <= endDay) {
  simulateDay();
  if (ci < checkpoints.length && s.day * MIN_PER_DAY >= checkpoints[ci][0]) {
    const st = s.staff;
    rows.push([
      time(checkpoints[ci][0]),
      s.level,
      s.enclosures.length,
      s.groups.size,
      animalCount(),
      topTier(),
      `${st.caretaker}/${st.janitor}/${st.guard}/${st.vet}`,
      fmt(s.visitors),
      fmt(s.last.income),
      fmt(s.last.expense),
      fmt(s.last.capex),
      fmt(s.coins),
      fmt(s.stars),
      Math.round(s.rep),
      fmt(s.exchanged ?? 0),
      s.upgrades ?? 0,
      fmt(s.conservation ?? 0),
      `${Math.round(s.happiness * 100)}%`,
      checkpoints[ci][1],
    ]);
    ci++;
  }
}

const head = ['Time', 'Lvl', 'Encl', 'Spec', 'Anim', 'Tier', 'Staff C/J/G/V', 'Vis/day', 'Income/mo', 'Running/mo', 'Bought/mo', 'Coins', 'Stars', 'Rep', 'Exch', 'Upgr', 'Conserv', 'Happy', 'Target'];
const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i]).length)));
const line = (r) => r.map((c, i) => String(c).padEnd(widths[i])).join('  ');
console.log(`Catalogue: ${catalogue.length} species${args.v1 ? ' (v1)' : ''}; visitors = ${E.visitorK} × Appeal^${E.visitorExp}; happy star every ${E.happyStarEvery} day(s)\n`);
console.log(line(head));
console.log(widths.map((w) => '-'.repeat(w)).join('  '));
rows.forEach((r) => console.log(line(r)));

console.log('\nMilestones:');
const levelMarks = new Set([2, 4, 7, 15, 20, 32, 50]);
for (const e of s.events) {
  const lv = e.what.match(/^level (\d+)$/);
  if (lv && !levelMarks.has(Number(lv[1]))) continue;
  console.log(`  ${time(e.day * MIN_PER_DAY).padStart(8)}  ${e.what}`);
}
