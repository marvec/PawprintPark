# Pawprint Park: economy

These are the economy numbers, tuned with the pacing simulation in `scripts/economy-sim.js` (§8). Once the project
is scaffolded they move into `src/data/economy.js` (the single source of truth, CLAUDE.md), and the simulation
becomes bun tests that check the pacing targets in §1. This document explains *why* each number is what it is. When
tuning changes a number, update it here and rerun the simulation.

Time: 1 in-game day is 2 real minutes at 1×. 1 month is 7 days (about 14 minutes). 1 hour of play is about 30
in-game days (PRD §2). "Z" means ZooCoins.

---

## 1. Pacing targets

| Play time | Keeper level | Zoo | Feels like |
|---|---|---|---|
| 10 min | 2 | Sheep healthy, goat bought | Tutorial done |
| 30 min | 4 | 3–4 enclosures, 6–8 animals | First caretaker hired, first stand |
| 1 h | 7 | First tier 3 species (giraffe, red panda) | First baby born |
| 5 h | 15 | ~8 enclosures, 5–6 staff | Staff do most routine chores |
| 10 h | 20 | Lions, tigers, 3–4 biomes | Managing more than doing |
| 30 h | 32 | Elephants, polar bears | Large zoo; prices and reputation matter |
| 80–100 h | 50 (cap) | Everything unlocked | Endless play for awards and a perfect zoo |
| ~175 h | 50 | Every species owned | The long-term collection goal |

**Two rules of thumb:**

- Coins and stars should **both** limit progress until about level 50. If one piles up while the other limits
  progress, the one piling up stops mattering.
- After that, coins flow into habitat upgrades and conservation projects (§3.8) instead of piling up.

## 2. Visitors and income

### 2.1 Appeal

| Tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Appeal per species | 2 | 4 | 8 | 14 | 22 | 35 | 55 | 80 |

- The first animal of a species counts in full. Each extra animal of the same species adds 25% of the species'
  appeal.
- A baby counts ×1.5 while it is a baby.
- Each **habitat upgrade** level of the enclosure adds 15% (§3.8).
- The total is multiplied by the zoo's **average animal happiness** (0–1), so neglect directly costs visitors.

### 2.2 Visitors per day

```
visitors/day = 12 × Appeal^0.5 × reputationFactor × priceFactor × weatherFactor
```

- `reputationFactor = 0.5 + reputation / 100`, so it ranges from 0.5 to 1.5.
- `weatherFactor`: sun 1.0, heat wave 0.8, rain 0.7, snow 0.6.
- The square root keeps late-game income in check. A first version with exponent 0.6 piled up millions of coins by
  30 hours (§8).

### 2.3 Prices

```
fairEntranceFee = 4 + 0.15 × √Appeal        (≈ 5 Z at the start, ≈ 7 Z mid-game, ≈ 10 Z late)
```

The 5-step slider (PRD §11.2):

| Step | Price | Visitors | Visitor happiness |
|---|---|---|---|
| Very cheap | ×0.5 | ×1.3 | +5 |
| Cheap | ×0.75 | ×1.15 | +2 |
| Fair | ×1.0 | ×1.0 | 0 |
| Pricey | ×1.3 | ×0.85 | −5 |
| Expensive | ×1.6 | ×0.65 | −15 |

"Pricey" earns about 10% more in tickets, but it brings fewer visitors to the stands and lowers happiness, so there
is no single best setting. Cheap prices are a real tool for rebuilding reputation.

### 2.4 Stands

Fair prices are below. 40% of every sale is the cost of the goods. One stand serves up to 250 visitors a day.

| Item | Fair price | Chance a visitor buys |
|---|---|---|
| Drink | 2 Z | 50% |
| Coffee | 3 Z | 30% |
| Ice cream | 3 Z | 30% |
| Hotdog | 4 Z | 40% |
| Souvenir | 8 Z | 20% |
| Restaurant meal | 10 Z | 15% |

### 2.5 Simulated income (full catalogue)

| Play time | Visitors/day | Income/month | Running costs/month |
|---|---|---|---|
| 1 h | ~40 | ~1.2k | ~0.7k |
| 10 h | ~240 | ~16k | ~12k |
| 30 h | ~570 | ~55k | ~41k |
| 100 h | ~1,380 | ~200k | ~130k |

## 3. Costs

### 3.1 Animals

| Tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Price (Z) | 50–250 | 300–600 | 800–1.5k | 2k–3.5k | 5k–8k | 10k–18k | 25k–40k | 50k–80k |

Anchors: the sheep costs 120 Z; the giant panda costs 35,000 Z.

```
sellPrice = basePrice × condition × ageFactor × 0.6       (0.6 = dealer's cut)
condition = average(health, happiness), clamped to 0.3–1.0
ageFactor = juvenile 1.0, adult 0.9, elderly 0.3
```

**Transfer to a partner zoo:** ⌈tier ÷ 2⌉ stars plus 1–3 reputation, and no coins.

### 3.2 Food

| Food | Cost per portion |
|---|---|
| Hay | 2 Z |
| Vegetables | 3 Z |
| Pellets | 3 Z |
| Fruit | 4 Z |
| Insects | 5 Z |
| Plankton | 5 Z |
| Fish | 6 Z |
| Nectar | 6 Z |
| Meat | 8 Z |

Portions per day: small animals 1, medium 2, large 4, elephant 8. So a sheep costs about 30 Z a month to feed, and
a lion about 170 Z.

### 3.3 Staff

| Role | Wage per month (quality 1 → 5) | Capacity |
|---|---|---|
| Caretaker | 150–450 | 30–70 work points per day |
| Janitor | 120–360 | 30–70 work points per day |
| Guard | 180–500 | Covers a radius of 4–7 enclosures |
| Vet | 800–2000 | About 40 animals |

Work points per chore:

| Chore | Points |
|---|---|
| Pick up a poop pile | 0.5 |
| Fill water | 1 |
| Fill a feeder | 1 |
| Treatment | 2 |
| Repair | 3 |
| Clean the enclosure | 3 |

The keeper does about 20 work points a day by hand. One caretaker looks after roughly 15–30 animals. The hiring
hint on the statistics page divides the daily work by these capacities.

### 3.4 Vet and medicine

- External vet: 250 Z + 50 Z × tier per visit.
- Over-the-counter medicine: 30 Z.

### 3.5 Enclosures: stars **and** coins

```
enclosureStars = base × (1 + 0.08 × enclosuresOwned)     base: S 5, M 10, L 18, XL 30
enclosureCoins = S 300, M 1,500, L 10,000, XL 40,000
landPlotStars  = 15 × (1 + 0.25 × plotsOwned)
```

- Stars limit how *many* enclosures you can have; coins make *big* enclosures a real investment.
- The 8% growth puts owning every species at about 175 hours. At 15%, it would take about 240 hours.

### 3.6 Upkeep

- Enclosures, per in-game day: S 3, M 10, L 30, XL 80 Z.
- Facilities: 60–400 Z per month each.

### 3.7 Facilities and equipment

| Facility | Price |
|---|---|
| Bin | 30 |
| Bench | 50 |
| Toilet | 600 |
| Drinks stand | 800 |
| Coffee stand | 1,000 |
| Ice cream stand | 1,000 |
| Hotdog stand | 1,200 |
| Playground | 2,000 |
| Souvenir shop | 2,500 |
| Staff quarters | 4,000 |
| Restaurant | 6,000 |

| Equipment | Price |
|---|---|
| Water point | 80 |
| Feeder | 100 |
| Enrichment toys | 150–800 |
| Shelter | 400 |
| Heater | 600 |
| Cooler | 800 |

### 3.8 Late-game coin uses

Without these, the simulation piled up 1.8M coins by 80 hours with nothing to buy.

- **Habitat upgrades** (PRD §5): each enclosure can be upgraded 3 times (better terrain, plants, viewing areas).
  - Cost: 1×, 2× and then 4× the enclosure's coin price.
  - Each level adds 15% to the species' appeal.
  - This gives existing enclosures something to aim for, and gives the endgame a "perfect zoo" goal.
- **Landmarks** (PRD §11.9): about 15–20 one-of-a-kind showpieces priced 50,000–500,000 Z, unlocked with levels.
  - Each gives a small visitor-happiness bonus. The total from all landmarks is capped at +5 visitor happiness, so
    they barely raise income.
  - All of them together cost about 3–5M Z, roughly 15 hours of late-game surplus. Players aim for these first.
  - The simulation doesn't model them yet. Conservation projects stand in for all late-game spending there.
- **Conservation projects** (PRD §11.9): fund a real-world-style project. These take over once the landmarks are
  built.
  - Cost: 1,000 Z × keeper level.
  - Reward: +1 reputation, plus progress toward the Conservation Star award and achievements.
  - They never run out, so coins always have somewhere to go.
  - They never give stars, because coins can't buy stars.

### 3.9 Starting money, tutorial and loans

- **Starting money: 2,000 Z.**
- **Tutorial reward: 1,000 Z** for finishing the tutorial goals. Without it, the first tier 3 species arrives at
  about 2.8 hours instead of 1.3.
- **Loans:** the limit is 5,000 + 20% of the zoo's value. Interest is 2% per in-game month. Loans can be repaid at
  any time. The game never ends (PRD §11.4).

## 4. Stars

### 4.1 Earning

| Source | Stars |
|---|---|
| Happy-zoo bonus: every animal at or above 75% happiness that day | 1 per day (up to about 30 an hour), the main source |
| Level-up | 2, plus 1 per 10 levels |
| Goal | 3–5 |
| First birth of a species | 3 |
| Inspection grade A | 5 |
| Yearly award | 5–10 |
| Transfer to a partner zoo | ⌈tier ÷ 2⌉ |

The simulation also tried 1 happy-zoo star every 2 days. That left too few stars in mid-game, so it stays at 1 per
day.

### 4.2 Spending

Enclosures and land plots (§3.5).

### 4.3 Exchange

**1 star = 100 Z**, fixed. Exchange works one way only: coins can never buy stars. In the simulation the player
exchanged about 800 stars by 30 hours, using it as the safety valve it was meant to be.

### 4.4 Free "Get stars" packs

The packs hold 25, 100 or 500 stars, and they bypass all of this balance. **Undecided** (PRD §21). The options
are:

- a once-a-day limit;
- an "achievements disabled for this zoo" flag;
- labelling the packs as a test feature until real purchases exist.

## 5. XP and levels

```
xpToNextLevel(level) = round(30 × level^1.55)
```

| Level-up | XP needed |
|---|---|
| 1 → 2 | 30 |
| 5 → 6 | 364 |
| 10 → 11 | 1,064 |
| 20 → 21 | 3,117 |
| 30 → 31 | 5,843 |
| 49 → 50 | 12,500 |

The total XP to reach the cap (level 50) is about 246k.

| Action | XP |
|---|---|
| Fill water | 1 |
| Pick up poop | 1 |
| Feed | 2 |
| Pet | 2 |
| Repair | 3 |
| Clean | 5 |
| Treat | 10 |
| Birth | 25 |
| First time owning a species | 25 + 25 × tier |
| Goal | 60 + 10 × level |
| Yearly award | 150 |
| Inspection | 50–100 |

Only the keeper's own chores earn XP. Goal XP was 20 × level at first, but that made late levels come too fast
(level 50 at 60 hours).

**When each tier unlocks:**

| Tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Unlocks at level | 1 | 2 | 5 | 11 | 17 | 24 | 32 | 41 |

## 6. Reputation

```
targetReputation = 0.40 × animalWelfare
                 + 0.25 × visitorHappiness
                 + 0.15 × varietyAndRarity
                 + 0.10 × cleanliness
                 + 0.10 × lastInspection          (each component 0–100)
                 − 5 per preventable death (fades over 1 in-game year)
```

Reputation moves at most **1 point per day** toward the target. A single bad day doesn't crash the zoo, and a
single good day doesn't fix it.

## 7. Simulation results

`node scripts/economy-sim.js` (add `--v1` for the 30 v1 species, `--until=180` for a long run, or `--key=value` to
override any number).

**Full catalogue**:

| Time | Level | Enclosures | Animals | Staff | Coins | Stars | Target |
|---|---|---|---|---|---|---|---|
| 10 min | 3 | 2 | 4 | 0 | 1,031 | 4 | L2 ✓ |
| 30 min | 5 | 3 | 7 | 1 | 929 | 15 | L4, 3–4 encl, first hire ✓ |
| 1 h | 6 | 3 | 8 | 1 | 2,096 | 43 | L7 at 1.4 h, first tier 3 at 1.3 h ~ |
| 5 h | 12 | 10 | 36 | 5 | 5.7k | 50 | L15 at 7.1 h ~ |
| 10 h | 17 | 17 | 70 | 9 | 17k | 47 | L20 at 12.6 h ~ |
| 30 h | 29 | 37 | 164 | 22 | 73k | 68 | L32 at 34 h ✓ |
| 80 h | 49 | 66 | 325 | 39 | 206k | 226 | L50 at 82 h ✓ |
| 180 h | 50 | 233 | 1,165 | 136 | 1.4M | 3,252 | Every species owned ✓ |

- **Coins** stay at roughly one late-game expansion's worth until about 80 hours. After that, habitat upgrades and
  conservation projects take the surplus.
- **v1 (30 species)** runs out of new species at about 30 hours. From then on, habitat upgrades and conservation
  projects are the goals, and spare stars get exchanged. That's acceptable as long as new species arrive in batches
  after launch.

## 8. Tuning history

1. **The first numbers** (exponent 0.6, fee slope 0.3, no coin price on enclosures, goal XP 20 × level). Coins
   piled up from about 5 hours: 305k at 10 hours and 4.4M at 30 hours. Late income was about 3× running costs.
   Level 50 came at 60 hours.
2. **First fix** (visitor exponent 0.5, fee slope 0.15, coin prices for enclosures, higher upkeep, flatter XP).
   Coins stayed meaningful up to about 50 hours, then piled up again (1.8M at 80 hours). The first tier 3 species
   came at about 2 hours.
3. **Second fix** (habitat upgrades, conservation projects, tier 3 at level 5, a tutorial reward, cheaper S/M/L
   enclosures, 8% star growth). That gives the current numbers.

## 9. Open items

1. **Animal count on screen. Decided:** there's no cap on the number of animals. Everything is simulated, but only
   the animals near the camera are drawn in full (PRD §17.1).
2. **The happiness model in the simulation is optimistic.** Once staffed, happiness always settles at 90%, so the
   happy-zoo star comes every day. Real players will miss days. Once the real simulation exists in `src/core/`,
   rerun the pacing tests against it with random events (illness, weather, escapes) and a less perfect player.
3. **Prices always stay at "fair"** in the simulation, and the player buys greedily. Add a few player profiles
   (cautious, greedy, neglectful) to the tests.
4. **Free "Get stars" packs** (§4.4).
