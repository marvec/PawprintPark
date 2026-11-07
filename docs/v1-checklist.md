# Pawprint Park v1 checklist

One line per testable v1 requirement from [PRD.md](PRD.md) (§1–§6 and §9–§19, as scoped by §20). **M** is the
milestone that delivers it ([milestones.md](milestones.md)). A line is ticked only when its proof exists: a test name
(`file › test`), a screenshot path or a debug helper.

## Mockup reviews

| Milestone | Mockup | Status | Review notes |
|---|---|---|---|
| 2 | World: terrain, enclosures, props, keeper, weather | awaiting review | |
| 3 | HUD and UI | awaiting review | |
| 7 | People and buildings | awaiting review | |

---

## §1 Core loop

| ✓ | Requirement | M | Proof |
|---|---|---|---|
| [ ] | Chores earn XP; happy animals and goals earn stars; visitors pay coins | 6 | |
| [ ] | Coins buy food, equipment, staff and facilities; stars buy enclosures and land | 6 | |
| [ ] | Levels unlock species, equipment and buildings | 6 | |
| [ ] | Staff take over chores; the keeper can always step in | 8 | |

## §2 Time

| ✓ | Requirement | M | Proof |
|---|---|---|---|
| [x] | 1 in-game day = 2 real minutes at 1×; 7-day months; 12-month years | 1 | `time.test.js › clock › one in-game day takes 2 real minutes at 1×`; `› calendar › a month is 7 days and a year is 12 months` |
| [x] | Speeds: pause, 1×, 2×, 3× | 1 | `time.test.js › clock › 2× and 3× run two and three times as fast; pause stops time` |
| [x] | Day and night phases; the zoo opens in the morning and closes in the evening | 1 | `time.test.js › clock › day, dusk, night and dawn; the zoo opens 8:00–18:00` |
| [x] | Night can be fast-forwarded | 1 | `time.test.js › clock › night can be fast-forwarded, and the skip ends at sunrise` |
| [x] | Hourly, daily, monthly and yearly work runs exactly once per boundary (wages and interest monthly) | 1 | `time.test.js › clock › every boundary is reported once, even across a long step` |
| [x] | In-game seasons follow the months | 1 | `time.test.js › calendar › seasons follow the months` |
| [ ] | The game runs only while open; nothing happens while closed or in the background | 4 | |
| [ ] | Speed controls in the HUD, by keyboard, mouse and touch | 4 | |
| [ ] | The game pauses automatically while a full-screen menu is open on a phone | 4 | |
| [ ] | Visitors leave in the evening; animals sleep at night and nocturnal species are active | 5 | |
| [ ] | Only staff with staff quarters work night shifts | 8 | |
| [ ] | Wages and loan interest are charged monthly | 6 | |

## §3 World and map

| ✓ | Requirement | M | Proof |
|---|---|---|---|
| [x] | Each zoo is generated from a seed: terrain, hills, a river or lake, trees and rocks | 1 | `map.test.js › map generation › every map has hills, a river or a lake, trees and rocks`; `› the same seed gives the same map`; `› known seeds still give the maps they always gave`; `__pawprint.map(seed)` |
| [x] | The starting area is flat enough for the entrance and the first two enclosures | 1 | `map.test.js › map generation › the start area is flat, dry and clear, with a margin of gentle land around it` |
| [x] | The map is a grid; land unlocks plot by plot | 1 | `paths.test.js › plots › a new zoo owns the 2×2 start plots; their neighbours can be bought`; `› plots unlock next to owned land only, and each costs more stars` |
| [x] | Paths are automatic: placing something connects it to the network on its viewing or entrance side | 1 | `paths.test.js › automatic paths › a new enclosure gets a route from its viewing side to the network`; `› removing a placement keeps every other one connected` |
| [x] | Start: entrance gate with a sign, two Farmyard enclosures, a small storehouse | 1 | `paths.test.js › starting layout › gate, storehouse and two Farmyard enclosures sit in the start area without overlapping`; `› every starting placement connects to the gate on the same paths for every seed` |
| [x] | One enclosure is empty; the other holds a neglected sheep (dirty, empty feeder and water, low happiness, mild illness) | 1 | `state.test.js › a new zoo › holds a neglected sheep next to an empty enclosure (PRD §3)` |
| [x] | The player names the zoo ("Pawprint Park" by default) | 1 | `state.test.js › a new zoo › starts with 2,000 Z, the default name and the start plots` (core); naming UI in M4 |
| [ ] | The world scene: terrain, water, trees, rocks, plots and paths drawn from the world state | 4 | |
| [ ] | The new-zoo flow asks for the name; the name shows on the entrance sign and in awards | 4 | |
| [ ] | Land plots are bought with stars | 6 | |
| [ ] | The entrance gate can be decorated | 8 | |

## §4 The keeper, camera and controls

| ✓ | Requirement | M | Proof |
|---|---|---|---|
| [ ] | A 3/4 camera follows the keeper; zooming out gives the overview; rotation in 90° steps | 4 | |
| [ ] | Movement by WASD/arrows, an on-screen joystick, and tap/click to walk | 4 | |
| [ ] | Quick-travel to alerts, listed animals and enclosures | 5 | |
| [ ] | An unlockable golf cart makes the keeper faster | 6 | |
| [ ] | Chores: walk up and press E, Space, click or tap; a 1–2 s progress ring | 5 | |
| [ ] | Chores: fill feeder, fill water, pick up poop, clean, give medicine, pet/brush/treat, repair fence | 5 | |
| [ ] | Build mode from the overview: pick a shop item, ghost preview shows valid spots | 4 | |
| [ ] | Items can be rotated, moved and sold back; the keeper doesn't need to walk there | 4 | |
| [ ] | Everything works by keyboard, mouse and touch | 4 | |

## §5 Enclosures and habitats

| ✓ | Requirement | M | Proof |
|---|---|---|---|
| [x] | Enclosure sizes S (6×6), M (10×10), L (14×14), XL (20×20) | 1 | `src/data/world.js` `ENCLOSURE_SIZES`; `paths.test.js › automatic paths › a new enclosure gets a route…` (M footprint) |
| [ ] | Enclosures are bought with stars as biome + size, then placed and rotated | 6 | |
| [ ] | The 8 v1 biomes, each drawn distinctly | 2 | |
| [ ] | The Reptile & Amphibian House is a building with indoor tanks | 5 | |
| [ ] | Every enclosure has a feeder and a water point; more can be installed | 5 | |
| [ ] | Equipment: shelters, heaters, coolers, pools, climbing frames, enrichment toys, feeding chutes | 5 | |
| [ ] | Habitat upgrades: 3 levels for coins, each more attractive to visitors | 5 | |
| [ ] | Fences wear down and can break; janitors or the keeper repair them | 5 | |
| [ ] | Animals leave poop piles, seen and cleaned one at a time | 5 | |
| [ ] | Cleanliness % (and water quality % with water); low cleanliness raises disease risk | 5 | |

## §6 Animals

| ✓ | Requirement | M | Proof |
|---|---|---|---|
| [ ] | Species data: biome, space per animal, group size, temperature range, water need, diet, enrichment | 5 | |
| [ ] | Each need scores 0–100% into happiness; mismatches never block placing | 5 | |
| [ ] | The details panel says exactly what's missing ("Too small: needs 40 more tiles") | 5 | |
| [ ] | Four stats: happiness, health, hunger, thirst | 5 | |
| [ ] | Happiness breakdown: space, biome, group, enrichment, cleanliness, temperature, visitors, personality, petting | 5 | |
| [ ] | Warning icons float above animals and differ in shape, not only colour | 5 | |
| [ ] | Details panel: name (editable), species, sex, age and life stage | 5 | |
| [ ] | Details panel: personality, illness history, breeding status, parents (family tree) | 5 | |
| [ ] | Details panel: compatibility (good with, neutral, never with) | 5 | |
| [ ] | Details panel: fact card and link to the Zoopedia | 11 | |
| [ ] | Details panel actions: rename, toggle breeding, move, sell, transfer | 6 | |
| [ ] | N portions per day of the species' diet type; feeder shows portions vs need (3/4) | 5 | |
| [ ] | Overfeeding for several days raises illness risk | 5 | |
| [ ] | Uneaten food goes stale, then rots after about 2 days; rotten food causes food poisoning | 5 | |
| [ ] | Water points drain and get dirty; dirty water causes illness | 5 | |
| [ ] | Food is bought and kept in the storehouse, which has an upgradable capacity; stored food expires slowly | 6 | |
| [ ] | The keeper and caretakers take food from the storehouse | 5 | |
| [ ] | About 12 named illnesses, each mild, serious or critical | 5 | |
| [ ] | Illness causes: dirt, rotten food, overfeeding, visitor feeding, fights, temperature, old age, chance | 5 | |
| [ ] | Mild: the keeper treats with shop medicine; serious: a vet on staff or a delayed, costly call-out | 5 | |
| [ ] | Serious illnesses take several visits; "next check due" | 5 | |
| [ ] | Critical for too long leads to death | 5 | |
| [ ] | Lifespan, gestation, litter size and maturity follow real biology scaled to the calendar | 5 | |
| [ ] | Mating needs adult male and female, same enclosure, happy, breeding allowed; hearts show | 5 | |
| [ ] | Breeding toggle per animal; overcrowding lowers everyone's happiness | 5 | |
| [ ] | Lineage recorded; inbreeding has a health penalty and a UI warning; market animals bring new bloodlines | 5 | |
| [ ] | Newborns get a name prompt with a suggested name; male, female and baby versions | 5 | |
| [ ] | Deaths from old age, critical illness, or fights; a respectful notice; the Remembered list | 5 | |
| [ ] | Reputation drops for preventable deaths, not for old age | 6 | |
| [ ] | 1–2 traits per animal changing behaviour, needs and visitor appeal | 5 | |
| [ ] | Pet, brush or treat tame species (boost with cooldown, hearts); dangerous ones only via a feeding chute | 5 | |
| [ ] | Animations for every body plan: idle, walk, run, eat, drink, sleep, play, mating hearts | 5 | |

## §9 Staff

| ✓ | Requirement | M | Proof |
|---|---|---|---|
| [ ] | Caretakers, janitors, guards and vets with their duties | 8 | |
| [ ] | Candidates have work quality, speed and wage; the hiring list refreshes weekly | 8 | |
| [ ] | Work zones: chosen enclosures, areas or the whole zoo | 8 | |
| [ ] | Capacity in work points per day; workload vs capacity per role with hiring hints | 8 | |
| [ ] | Uncovered work is left for the keeper and shows as alerts | 8 | |
| [ ] | Night shifts need staff quarters | 8 | |
| [ ] | A missed payday makes staff unpaid (morale drops, warning); a second one makes them quit | 8 | |

## §10 Visitors

| ✓ | Requirement | M | Proof |
|---|---|---|---|
| [ ] | The core tracks visitor count, spending, needs and happiness for the whole crowd | 8 | |
| [ ] | A capped sample walks around (about 40 on phones, 150 on desktop, by tier) | 8 | |
| [ ] | Emotion icons: happy, hungry, thirsty, toilet, tired, bored, disgusted, wowed | 8 | |
| [ ] | Needs: food and drink stands, clean toilets, benches and shade, fun and souvenirs | 8 | |
| [ ] | Unmet needs lower happiness, which feeds reputation | 8 | |
| [ ] | Hourly incident chance per enclosure, growing with visitors and dropping with guard coverage | 8 | |
| [ ] | Incidents notify the player, and the animal's details show the cause | 9 | |

## §11 Economy

| ✓ | Requirement | M | Proof |
|---|---|---|---|
| [ ] | All economy numbers in one file, with simulation tests | 6 | |
| [ ] | ZooCoins with their symbol; income and spending categories from §11.1 | 6 | |
| [ ] | Stars from level-ups, goals, first births, awards, inspections and the happy-zoo day bonus | 6 | |
| [ ] | Stars exchange for coins at a fixed rate; never the other way | 6 | |
| [ ] | 5-step price sliders with a live visitor prediction, by touch and arrow keys | 6 | |
| [ ] | The fair price rises with reputation and star animals; neglect lowers it | 6 | |
| [ ] | Reputation 0–100 as paw icons, from welfare, visitors, variety, cleanliness, deaths and inspections | 6 | |
| [ ] | Bank loan with monthly interest; the limit grows with zoo value | 6 | |
| [ ] | The game never ends; a broke zoo can always recover | 6 | |
| [ ] | Shop sections: animals, food, medicine, enclosures & land, equipment, facilities, decorations, conservation, stars | 6 | |
| [ ] | The "Get stars" dialog adds stars for free; no payments | 6 | |
| [ ] | Selling animals (price from rarity, age, health, happiness) and transferring them (stars, reputation) | 6 | |
| [ ] | The market refreshes weekly; bred animals can be sold | 6 | |
| [ ] | Statistics page: visitors and happiness, income and expenses (12-month charts), reputation, staff workload, food stock, welfare | 6 | |
| [ ] | Landmarks: 15–20 showpieces, 50k–500k Z, unlocked by level, capped happiness bonus | 8 | |
| [ ] | Conservation projects: 1,000 Z × level, reputation, a fact card, the conservation wall | 8 | |
| [ ] | Locked "Coming soon" silhouettes for species not yet built in the market (§8) | 6 | |

## §12 Progression

| ✓ | Requirement | M | Proof |
|---|---|---|---|
| [ ] | Keeper chores earn small XP; staff work doesn't; births, new species, goals, awards and inspections earn more | 6 | |
| [ ] | Levels unlock species tiers, equipment, facilities, biomes and staff upgrades | 6 | |
| [ ] | Level-up celebration: confetti, fanfare, unlock card; a new biome gets a ribbon-cutting | 6 | |
| [ ] | A level cap once everything is unlocked; endless play after | 6 | |
| [ ] | Always 3 active goals giving stars and XP, replaced to fit the zoo | 6 | |
| [ ] | A permanent achievements list | 6 | |
| [ ] | Yearly zoo awards with stars and a trophy at the entrance | 6 | |

## §13 Events

| ✓ | Requirement | M | Proof |
|---|---|---|---|
| [ ] | Escapes through broken fences: visitors panic and leave, reputation drops | 9 | |
| [ ] | Catching: walk up and hold the action button; dangerous species need a guard or vet with a tranquilliser | 9 | |
| [ ] | The yearly welfare inspector grades welfare, cleanliness and safety; stars and reputation or a fine | 9 | |
| [ ] | Seasons change temperature; weather (sun, rain, snow, heat wave) changes visitor numbers | 9 | |
| [ ] | Animals outside their comfort range lose happiness and can get heatstroke or frostbite unless sheltered | 9 | |
| [ ] | Real-world holidays from the device date: at least Halloween and Christmas | 9 | |
| [ ] | Limited holiday decorations stay for good; visitors wear themed outfits | 9 | |

## §14 Zoopedia and photo mode

| ✓ | Requirement | M | Proof |
|---|---|---|---|
| [ ] | All 233 species listed; owned ones show facts, range, diet, lifespan, status and sound | 11 | |
| [ ] | Species not owned show the silhouette and where they unlock | 11 | |
| [ ] | Bronze, silver and gold marks: own, breed, photograph | 11 | |
| [ ] | Photo mode: free camera, HUD hidden; photos saved to the Zoopedia; download or share | 11 | |

## §15 Onboarding and UI

| ✓ | Requirement | M | Proof |
|---|---|---|---|
| [ ] | Tutorial: walk to the sheep, clean, feed and water, name it, treat it, buy a goat, set the entrance fee | 6 | |
| [ ] | Tutorial reward 1,000 Z, also when skipped; the tutorial can be skipped | 6 | |
| [ ] | One-off tips when later features unlock | 6 | |
| [ ] | HUD: coins, stars, level and XP, date and time, speed, reputation, buttons for alerts, shop, stats, Zoopedia, menu | 4 | |
| [ ] | The alert feed warns before things become critical; tapping an alert quick-travels there | 5 | |

## §16 Audio

| ✓ | Requirement | M | Proof |
|---|---|---|---|
| [ ] | All audio synthesized, no files | 11 | |
| [ ] | Positional animal calls relative to the keeper, a synth voice per body plan tuned per species | 11 | |
| [ ] | Calm ambient music that changes between day and night | 11 | |
| [ ] | UI sounds and a level-up fanfare | 11 | |

## §17 Art direction and drawing a big zoo

| ✓ | Requirement | M | Proof |
|---|---|---|---|
| [ ] | Warm pastel palette, low warm sun, gentle haze | 2 | |
| [ ] | Toy-like animals, guests, staff and props; faceted scenery | 2, 7 | |
| [ ] | Quality tiers: pixel ratio, shadows, best animal mesh, visitor count; foliage sway and post-processing on High only | 10 | |
| [ ] | Full-detail animals up to a budget per tier (~40/80/150); staff with a smaller budget | 10 | |
| [ ] | Detail by distance with a margin; the tier caps the best resolution | 10 | |
| [ ] | Shadows always from the low mesh; small shadow map | 10 | |
| [ ] | Priority: selected, warnings, babies, then nearest | 10 | |
| [ ] | Instanced stand-ins further away; overview badges with icon, count and warnings | 10 | |
| [ ] | Models fade in and out; no flicker at the edge of the detail range | 10 | |
| [ ] | Sounds only from drawn animals | 11 | |
| [ ] | Choosing what to draw is a pure, tested function | 10 | |

## §18 Saves

| ✓ | Requirement | M | Proof |
|---|---|---|---|
| [x] | Unlimited save slots, one zoo each, with name, date and thumbnail in the index | 1 | `slots.test.js › slot store › saves any number of zoos and lists them newest first`; `› saving into a slot overwrites it; thumbnails are kept apart from the index`; `__pawprint.slots()` |
| [x] | Saves store seeds and decisions, not generated content | 1 | `state.test.js › saves › round-trip exactly, and the world regenerates from the seed`; `› a save holds seeds and decisions only: it stays small` |
| [x] | Older saves keep loading; damaged and foreign saves are refused | 1 | `state.test.js › saves › older saves missing fields load with defaults`; `› damaged, foreign and future saves are refused with a reason` |
| [x] | Storage use is reported and the picker warns when nearly full (core) | 1 | `slots.test.js › slot store › reports storage use and warns when nearly full` |
| [x] | A full or blocked storage never crashes the game | 1 | `slots.test.js › slot store › a full or blocked storage returns an error instead of throwing` |
| [x] | Slots can be deleted, exported and imported as a file (core) | 1 | `slots.test.js › slot store › deleting a slot removes its save and thumbnail`; `› exports a slot as a file and imports it into a new slot`; `› refuses imports that are not saves` |
| [ ] | Autosave every in-game day and when the app goes to the background | 4 | |
| [ ] | The slot picker shows name, date, thumbnail and storage use | 4 | |
| [ ] | Export, import and delete in the picker UI; the near-full warning on screen | 11 | |
| [ ] | Saves are mirrored to native storage in the apps | — | Out of scope for v1 milestones (Capacitor apps) |

## §19 Languages, settings and accessibility

| ✓ | Requirement | M | Proof |
|---|---|---|---|
| [x] | All UI text lives in a strings table, with placeholders and plurals | 1 | `strings.test.js › strings table › fills placeholders`; `› picks plural forms by count, per language rules`; `› falls back to English, then to the key` |
| [ ] | English and Czech at launch, every key in both | 11 | |
| [ ] | Settings: quality (auto-picked, changeable), music and sound volume and mute, language, controls help | 11 | |
| [ ] | Warning icons are colour-blind safe (shapes as well as colours) | 3 | |
| [ ] | Every action works by keyboard, mouse and touch (audit) | 11 | |

---

## Decisions to review

- **Calendar start** (M1): a new zoo starts on 1 March, year 1, at 7:00. Months carry real names and seasons
  (Dec–Feb winter, Mar–May spring, Jun–Aug summer, Sep–Nov autumn).
- **Day phases** (M1): night 20:00–5:00, dawn 5–6, day 6–19, dusk 19–20. The zoo is open 8:00–18:00. A night
  skip runs time 12× faster and stops at 6:00.
- **Map size** (M1): 240×240 tiles in 10×10 plots of 24×24. The start area is the 2×2 plots in the middle of the
  south edge (48×48 tiles), with the entrance gate facing the road in from the south. The sim assumes about 6
  enclosures per plot; check this in M6.
- **Water** (M1): 60% of seeds get a river (from the north edge, leaving by the west or east edge), 40% a lake.
  Water never comes within reach of the start area.
- **Paths** (M1): paths are derived from the placements, not stored. The gate starts the network with a
  12-tile avenue into the zoo. Footprints can't be placed over existing paths. Trees and rocks under a footprint
  are cleared, so the scene hides them; nothing is stored for that.
- **Starting layout** (M1): both Farmyard enclosures are size S, as in the economy simulation.
- **The neglected sheep** (M1): a three-year-old ewe with a mild cold. Happiness 22, health 64, food 8, water 5.
  Her enclosure has 12% cleanliness and 7 poop piles. These numbers are placeholders until the M5 animal model.
- **Animal stat bars** (M1): stored as 0–100, where 100 is full and good (`food`, `water` rather than
  hunger/thirst). The UI can still label them Hunger and Thirst.

## Problems

(none yet)
