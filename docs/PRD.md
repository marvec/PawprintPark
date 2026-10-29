# Pawprint Park: product requirements

A zoo builder and management game for ages 12+. You take over **Pawprint Park**, a small, neglected zoo, and walk
around it as its keeper: you feed, water, clean and heal the animals, grow the zoo with new habitats and species,
hire staff to take over chores, and keep visitors happy enough to pay for it all. Players learn real facts about
real animals along the way.

It plays like **Transport Tycoon**: you can keep playing indefinitely, but at some point there are no more species,
equipment or buildings left to unlock. From then on the goal is to run the best zoo you can.

- **Platforms**: browser (desktop, phone, tablet), plus iOS and Android apps from the same bundle (see the handbook).
- **Price**: free. No ads, no accounts, no real-money payments (§11.6).
- **App icon**: a panda paw.
- **Look**: the warm palette and soft light of <https://summer-afternoon.vlucendo.com/>, with the view and gameplay
  of <https://zooki.world/> (§17).

Related docs: [species.md](species.md) (full species catalogue) and [web-game-handbook.md](web-game-handbook.md)
(how we build).

---

## 1. Core loop

1. Walk to an animal or enclosure that needs something and do the chore.
2. Chores earn **XP**. Happy animals and goals earn **stars**. Visitors pay **ZooCoins**.
3. Spend coins on food, equipment, staff and visitor facilities. Spend stars on new enclosures and land.
4. Levels unlock new species, equipment and buildings.
5. As the zoo grows, hire staff to take over chores. The game shifts from doing everything yourself to managing a
   zoo, but the keeper can always step in.

## 2. Time

- The game runs **only while it is open**. Nothing happens while it's closed or in the background.
- **Calendar** (compressed year):
  - 1 in-game day = 2 real minutes at 1×;
  - 1 month = 7 days (about 14 minutes);
  - 1 year = 12 months (about 2.8 hours).
- **Speed**: pause, 1×, 2× and 3×. The game pauses automatically while a full-screen menu is open on a phone.
- **Day and night**. The zoo opens in the morning, and visitors leave in the evening. At night, animals sleep and
  nocturnal species are active. Only staff who have **staff quarters** work night shifts; otherwise the keeper is
  alone. Night can be fast-forwarded.
- **In-game seasons** drive temperature and weather (§13.4). **Real-world holidays** drive seasonal shop offers and
  decorations (§13.5).
- **Wages** are paid monthly. Loan interest is charged monthly too.

## 3. World and map

- Each new zoo is generated from a **seed**: terrain, hills, a river or lake, trees and rocks. The starting area is
  always flat enough for the entrance and the first two enclosures.
- The map is a grid. More land is unlocked plot by plot with **stars**.
- **Paths are automatic.** Placing an enclosure, stand or building connects it to the path network on its viewing
  or entrance side. The player never draws paths.
- At the start: the entrance gate with a sign, two Farmyard enclosures and a small storehouse. One enclosure is
  empty. The other holds a **neglected sheep**: dirty enclosure, empty feeder and water trough, low happiness and a
  mild illness. This is the tutorial (§15.1).
- The player names the zoo at the start ("Pawprint Park" by default). The name appears on the entrance sign and in
  awards. The entrance gate can be decorated.

## 4. The keeper, camera and controls

- **Camera**: a 3/4 view follows the keeper. Zooming out far gives the overview used for building and managing.
  The camera rotates in 90° steps.
- **Movement**: WASD or arrow keys, or an on-screen joystick, or tap or click a spot to walk there. Tapping an
  alert, an animal in a list or an enclosure on the map makes the keeper **quick-travel** there (a fast walk with a
  short camera move). An unlockable **golf cart** makes the keeper faster.
- **Chores**: walk up to the target and press the action button (E, Space, a click or a tap on the on-screen
  button). A 1–2 second progress ring fills while the keeper does the chore. Chores include: fill a feeder, fill
  water, pick up poop, clean the enclosure, give medicine, pet/brush/give a treat, and repair a fence.
- **Building** (build mode, from the zoomed-out view): choose an item in the shop, then place it on the grid using
  a ghost preview that shows if the spot is valid. Items can be rotated, moved and sold back. The keeper doesn't
  need to walk there.
- Everything works by keyboard, by mouse and by touch.

## 5. Enclosures and habitats

- Enclosures are bought with **stars** as a **biome + size**: S (6×6), M (10×10), L (14×14) and XL (20×20).
  Then they're placed and rotated on the grid.
- **Biomes** (16; v1 ships the first 8):
  1. Farmyard
  2. African Savanna
  3. Asian Jungle
  4. Polar & Tundra
  5. Coast & Sea (outdoor pools)
  6. Wetland & Rivers
  7. Reptile & Amphibian House
  8. Aviary
  9. Temperate Forest
  10. Desert & Dry Plains
  11. Tropical Rainforest
  12. Mountain
  13. Australian Outback
  14. Aquarium
  15. Nocturnal House
  16. Bug House

  Houses (Reptile, Aquarium, Nocturnal, Bug) are buildings with indoor tanks. The Nocturnal House reverses the
  day/night cycle so visitors see active nocturnal animals during the day.
- Every enclosure has a **feeder** and a **water point**. Extra feeders, water points and other equipment can be
  installed. Equipment includes shelters, heaters, coolers, pools, climbing frames, enrichment toys and keeper
  feeding chutes.
- **Habitat upgrades**: every enclosure can be upgraded 3 times with coins (richer terrain, plants, viewing
  areas). Each level makes the species more attractive to visitors (economy.md §3.8).
- **Fences wear down** over time. Worn fences can break, which lets animals escape (§13.2). Janitors repair them,
  or the keeper can.
- **Dirt**: animals leave **poop piles** that can be seen and cleaned one at a time. Each enclosure also has a
  **cleanliness %** (and **water quality %** if it has water). Low cleanliness raises the risk of disease.

## 6. Animals

### 6.1 Species needs (soft scoring)

Each species has data for biome, space per animal, group size (min–max), temperature comfort range, water need,
diet and preferred enrichment. Each need scores 0–100% and contributes to **happiness**. A mismatch makes an
animal unhappy, but never blocks placing it. The details panel shows exactly what's missing, e.g. "Too small: needs
40 more tiles".

### 6.2 Stats

Four bars on every animal:

- **Happiness**: tap it to see what drives it: space, biome, social group, enrichment, cleanliness, temperature,
  visitors (noise, crowding), personality, and any recent petting or treats.
- **Health**: falls with illness, injury and old age.
- **Hunger**
- **Thirst**

When a stat crosses a warning threshold, an icon floats above the animal. Warning icons differ in **shape**, not
only colour (colour-blind safe). Earlier warnings also go into the alert feed (§15.2).

### 6.3 Details panel

Clicking or tapping an animal opens its details:

- name (editable), species, sex (where it can be told), age and life stage (baby, juvenile, adult, elderly);
- the four stats and the happiness breakdown;
- personality traits (§6.8);
- illness and treatment history;
- breeding status: whether it's allowed to breed, pregnancy with days to birth, and its parents (family tree);
- **compatibility**: which species it can share an enclosure with ("good with"), which are neutral, and which it
  must never be with;
- a short real-world fact card and a link to its Zoopedia page (§14);
- actions: rename, toggle breeding, move to another enclosure, sell, transfer to a partner zoo.

### 6.4 Feeding and water

- Each species eats **N portions per day** of its diet type: hay, vegetables, fruit, meat, fish, insects, pellets,
  nectar or plankton.
- The feeder shows the portions in it against today's need, e.g. **3/4**. Eating well above the need for several
  days raises the risk of **overfeeding** illness.
- Uneaten food goes **stale** and then **rots** after about 2 in-game days. Animals that eat rotten food can get
  food poisoning.
- Water points drain and get dirty. Dirty water also causes illness.
- Food is bought in the shop and kept in the **storehouse**, which has a capacity that can be upgraded. Stored food
  expires slowly. The keeper and caretakers take food from the storehouse. **Auto-reorder** can be unlocked later.

### 6.5 Illness and the vet

- There are about 12 named illnesses, such as food poisoning, overfeeding, parasites, injury (from fights), a cold,
  infection, dental trouble, heatstroke and frostbite. Each has 3 severities: **mild**, **serious** and **critical**.
- Causes include dirt, rotten food, overfeeding, harmful feeding by visitors (§10.3), fights, temperature, old age,
  and rarely, nothing at all.
- **Mild**: the keeper can treat it with over-the-counter medicine from the shop.
- **Serious**: needs a **vet**. This can be a vet on staff, or an **external call-out**, which is expensive and
  arrives after a delay. Serious illnesses can take several visits. The animal must be checked again between
  visits, and the details panel shows "next check due".
- **Critical** for too long leads to **death**.

### 6.6 Breeding and life cycle

- Lifespan, gestation or incubation, litter size and age at maturity follow **real biology**, scaled to the game
  calendar. For example, a lion is pregnant for about 3.5 months (about 50 minutes of play), and an elephant for
  22 months.
- A male and a female of the same species, both adult, in the same enclosure, both above a happiness threshold and
  both with **breeding allowed**, have a chance to mate. The animals show hearts when this happens.
- **Breeding toggle** on each animal (like contraception in real zoos). **Overcrowding** lowers happiness for
  everyone in the enclosure.
- **Lineage**: every animal records its parents. Breeding close relatives (parent with child, or siblings) has a
  health penalty and the UI warns about it. Animals bought from the market bring in new bloodlines.
- Newborns get a name prompt (a random name is suggested). Every species has male, female (where they look
  different) and baby versions.

### 6.7 Death

Animals die of old age, of illness that stays critical too long, or in fights in incompatible enclosures (the weaker
animal). A respectful notice names the cause. The animal is added to the **Remembered** list in the zoo records.
**Reputation drops for preventable deaths**, but not for old age.

### 6.8 Personality and interaction

- Each animal has 1–2 **traits**: shy, playful, greedy, grumpy, social, lazy, curious. Traits change behaviour
  (where it hangs out, how often it plays), needs (a greedy animal gets hungry faster) and how much visitors like it.
- The keeper can **pet, brush or give a treat** to tame species, which gives a happiness boost (with a cooldown) and
  hearts. Dangerous species only get treats, through a feeding chute.

### 6.9 Animations

The minimum for every body plan: idle, walk, run, eat, drink, sleep, play, and mating hearts. Species-specific
extras come later (a lion roaring, a penguin sliding, a meerkat standing guard).

## 7. Species

- The catalogue lists **233 species** across 16 biomes: [species.md](species.md).
- **v1 builds 30 of them** across 8 biomes (marked ✅ there). Among them are the farm basics, lions, giraffes,
  tigers, elephants, polar bears, penguins, sea lions, a Komodo dragon, and the **giant panda** as the top v1 goal.
- Early levels unlock farm and other everyday animals. Later levels bring rarer, more spectacular and more
  endangered species.
- Models are built from **parametric body plans** (§17). Each species is data: proportions, colours, patterns,
  sounds, facts and needs.

## 8. Species not yet built

Species that aren't built yet appear in the Zoopedia and the animal market as **locked silhouettes** with their
name, biome and unlock level, marked **"Coming soon"**. They can't be bought. A generic placeholder model for each
body plan exists only in dev and debug builds.

## 9. Staff

| Role | Does | Notes |
|---|---|---|
| **Caretaker** | Feeds, waters, picks up poop, cleans enclosures | Draws food from the storehouse |
| **Janitor** | Litter, bins, toilets, path cleanliness, fence and equipment repairs | |
| **Guard** | Prevents visitor incidents (§10.3) and vandalism, helps catch escaped animals | Covers a radius |
| **Vet** | Checks and treats animals on site; serious illnesses without call-out fees | Expensive |

- Every candidate has **work quality**, **speed** and a **monthly wage**. Better staff cost more. The hiring list
  refreshes weekly.
- **Work zones**: each employee is assigned to chosen enclosures or areas, or to the whole zoo.
- **Capacity**: each employee produces *work points per day* (speed × quality). The economy page shows how much work
  each role has against its capacity, e.g. "Caretakers: workload 140%. Hire 1 more to keep up". Work that staff
  can't cover is left for the keeper and shows up as alerts.
- **Night shifts** need **staff quarters** (§2).
- **Missed wages**: on a missed payday, staff become **unpaid**, which lowers their morale, and the player gets a
  warning. If the next payday is missed too, they **quit**.

## 10. Visitors

### 10.1 Crowd model

The core simulation tracks the visitor count, spending, needs and happiness for the whole crowd at once. Only a
**capped sample** walks around as figures: about 40 on phones and 150 on desktop, scaled by quality tier. Visitors
show **emotion icons** (happy, hungry, thirsty, needs a toilet, tired, bored, disgusted by litter, wowed by an
animal).

### 10.2 Needs

- **Hunger and thirst**: coffee stands, hotdog stands, drink stands and restaurants.
- **Toilets**: there must be enough, and they must be clean.
- **Rest and shade**: benches and trees along the paths.
- **Fun and souvenirs**: kids' attractions, playgrounds, shows (e.g. a sea lion show) and a souvenir shop.

Unmet needs lower visitor happiness. Overall visitor happiness feeds into reputation (§11.3).

### 10.3 Incidents

Every in-game hour, each enclosure has a small chance of a visitor **incident**: feeding the animals something
harmful, throwing litter in, or banging on the glass. The chance grows with the number of visitors and drops with
**guard coverage**. When an incident happens, the player gets a notification, and the affected animal's details
show the cause.

## 11. Economy

All numbers live in one economy file, with simulation tests on top (CLAUDE.md). The starting numbers and the reasons
for them are in [economy.md](economy.md).

### 11.1 Currencies

- **ZooCoins** (symbol: a **Z** with two horizontal strokes through it, like $). Earned from entrance fees,
  attractions, food, drinks and souvenirs, and from selling animals. Spent on food, medicine, equipment, staff,
  facilities, animals and vet call-outs.
- **Stars**. Spent on new enclosures and land plots. Earned from level-ups, completed goals, first births of a
  species, awards and inspections, and **one star per in-game day if every animal is above the happiness
  threshold**. Stars **can be exchanged for ZooCoins** at a fixed rate. Coins can never be exchanged for stars.
- **XP**: see §12.1.

### 11.2 Prices

- Entrance fee, attraction tickets and the prices at each stand type are set on a **5-step slider**: very cheap,
  cheap, fair, pricey, expensive. The steps are relative to a **fair price** that rises with reputation and star
  animals. Moving the slider shows a live **prediction of how visitor numbers will change**. It works with touch
  and with arrow keys.
- Interesting and rare animals attract more visitors and raise the fair price. Neglect lowers it: poop, litter,
  unhappy or sick animals, or nowhere to buy food and drinks.

### 11.3 Reputation

**Zoo Reputation** runs from 0 to 100 and is shown as paw icons. It's separate from stars. It is driven by animal
welfare, visitor happiness, species variety and rarity, cleanliness, preventable deaths and inspection grades. It
sets how many visitors come.

### 11.4 Loans and bankruptcy

- A **bank loan** with monthly interest. The amount the player can borrow grows with the zoo's value.
- The **game never ends**. If the zoo runs out of money, staff leave (§9), nothing can be bought, and reputation
  sinks, but the player can always recover by caring for animals, exchanging stars, selling animals or
  borrowing.

### 11.5 Shop

| Section | Contents |
|---|---|
| Animals | Market listings (refresh weekly), plus animals bred in your zoo for sale |
| Food | Diet types by the portion or in bulk |
| Medicine | Over-the-counter treatments for mild illnesses |
| Enclosures & land | Biome + size enclosures, land plots (stars) |
| Equipment | Feeders, water points, shelters, heaters, coolers, pools, enrichment, chutes. More and better items unlock with levels |
| Facilities | Toilets, benches, bins, stands, restaurants, kids' attractions, souvenir shop, storehouse, staff quarters, show arenas |
| Decorations | Plants, rocks, fountains, statues, **seasonal decorations** (§13.5) and **landmarks** (§11.9) |
| Conservation | Projects to fund (§11.9) |
| Stars | The "Get stars" dialog (§11.6) |

### 11.6 "Get stars" dialog

There's a **Get stars** dialog with a few star packs. For now, clicking a pack **adds the stars for free**: there
are no payments, no card, and no store SDK. It's there so the flow and UI exist if real purchases are added later.
Adding real purchases would be a separate decision with its own legal review.

### 11.7 Selling and transferring animals

- **Sell** for ZooCoins. The price depends on species rarity, age, health and happiness.
- **Transfer to a partner zoo**: no coins, but **stars and reputation**. This is the "good" option for surplus
  animals.

### 11.8 Statistics page

The statistics page shows:

- visitors per day and visitor happiness, with the reasons for unhappiness;
- income and expenses by category, and profit, with charts for the last 12 months;
- reputation and what drives it;
- **staff workload versus capacity for each role, with hiring hints**;
- food stock and how many days it will last;
- animal welfare summary.

### 11.9 Late-game coin uses: landmarks and conservation projects

A large zoo earns more coins than its running costs (economy.md §3.8). Two things give those coins a purpose. Neither
gives stars, because coins can never buy stars.

**Landmarks** are the expensive top end of the Decorations section of the shop. They're one-of-a-kind showpieces,
such as a giant panda statue, a fountain plaza, a light show, a themed gate or a big clock tower.

- There are about 15–20 of them, priced from 50,000 to 500,000 Z, and they unlock with levels.
- Each gives a small visitor-happiness bonus. The total bonus from all landmarks is capped, so they barely raise
  income and money doesn't snowball.
- They're visible and personal: they decorate the zoo, they're good photo-mode subjects, and they count toward
  achievements.

**Conservation projects** never run out. The zoo funds projects with coins, e.g. "Protect a snow leopard valley" or
"Clean a turtle beach".

- A project costs 1,000 Z × keeper level.
- It gives reputation, and counts toward the Conservation Star award and achievements.
- Each project gets a short card with real facts about the threat it addresses.
- A **conservation wall** at the entrance shows a plaque for every funded project, with a pin on a world map, so
  the projects are visible in the zoo too.
- Funding projects is a coins-only decision. Animals never leave the zoo for it, unlike the release programme we
  decided against.

Landmarks are what players aim for first. Conservation projects take over once the landmarks are built.

## 12. Progression

### 12.1 XP and levels

- The **keeper's own chores** earn small XP. Staff work doesn't earn XP.
- Bigger XP comes from births, new species, finished goals, awards and inspections.
- Levels unlock species tiers (species.md), equipment, facilities, biomes and staff upgrades.
- Each level-up gets a short **celebration**: confetti, a fanfare, and a card showing what was unlocked. A new biome
  gets a ribbon-cutting.
- The **level cap** is reached when everything is unlocked. Endless play continues after that (see the introduction).

### 12.2 Goals

There are always **3 active goals**, e.g. "Breed a penguin", "Reach 500 visitors a day" or "Open the Savanna".
They give stars and XP. Each finished goal is replaced by a new one that fits the zoo's current state.

### 12.3 Achievements

A permanent list of feats, e.g. "Own 50 species", "No preventable deaths for 5 years" or "A Zoopedia page at gold".

### 12.4 Zoo awards

At the end of each in-game year there are awards: Best Animal Welfare, Most Visitors, Conservation Star and others.
Winners get stars and a **trophy** shown at the entrance.

## 13. Events

### 13.1 Visitor incidents

See §10.3.

### 13.2 Escapes

A broken fence can let an animal out. Visitors nearby panic and leave, and reputation drops. The keeper and guards
catch the animal: walk up to it and hold the action button. Dangerous species need a guard or the vet with a
tranquilliser.

### 13.3 Welfare inspector

The inspector comes once a year at a random time. They grade welfare, cleanliness and safety. A good grade gives
stars and reputation. A bad grade gives a fine and lowers reputation.

### 13.4 Seasons and weather

Seasons change the temperature, and weather (sun, rain, snow, heat waves) changes how many visitors come. Animals
outside their comfort range lose happiness, and can get heatstroke or frostbite, unless their enclosure has shelter,
heaters or coolers.

### 13.5 Real-world holidays

Halloween, Christmas, Easter and possibly others follow the **device's real date**. Limited decorations appear in
the shop, and visitors wear themed outfits. Decorations bought during a holiday stay in the player's zoo for good.

## 14. Zoopedia and photo mode

- The **Zoopedia** lists all 233 species. Owned species show facts, range, diet, lifespan, conservation status and
  their sound. Species that aren't owned show the silhouette and where they're unlocked. Each page has
  **bronze / silver / gold** marks: **own it**, **breed it**, **photograph it**.
- **Photo mode**: a free camera with the HUD hidden. Photos are saved to the Zoopedia, and can be saved or shared
  through the native share sheet in the apps or a download on the web.

## 15. Onboarding and UI

### 15.1 Tutorial: the neglected sheep

The tutorial covers roughly the first 10 minutes, as guided goals:

1. walk to the sheep;
2. clean up its enclosure;
3. fill its feeder and water;
4. name it;
5. treat its mild illness with medicine;
6. buy a goat for the empty enclosure;
7. set the entrance fee.

Finishing the tutorial gives a 1,000 Z reward, which also goes to players who skip it. The tutorial can be
skipped. Later features introduce themselves with one-off tips when they unlock.

### 15.2 HUD and alerts

- **HUD**: ZooCoins, stars, level and XP bar, date and time, speed controls, reputation, and buttons for the alert
  feed, shop, stats, Zoopedia and menu.
- **Alert feed**: warns **before** things become critical, e.g. "Leo will be hungry in 1 day", "Penguin feeder
  empty" or "Fence wearing out at Savanna 2". Tapping an alert quick-travels the keeper there.

## 16. Audio

All audio is synthesized, with no files (handbook §6).

- **Positional animal calls** come from the animals and are heard relative to the keeper, getting louder as you get
  closer: a lion roars, a sheep bleats, an elephant trumpets. Each body plan has a synth voice, tuned per species.
- Calm ambient music changes between day and night.
- UI sounds and a level-up fanfare.

## 17. Art direction

- **From summer-afternoon**: the warm pastel palette, a low warm sun and gentle haze or fog. We don't copy its
  dense grass or heavy post-processing; phones can't afford them (handbook §5).
- **Toy-like, soft, rounded low-poly** animals, guests, staff and props, built in code from **parametric body
  plans** (species.md). The reference for animals is [Zooki](https://zooki.world/): smooth chunky bodies, slightly
  big heads and eyes, clean graphic coat patterns (crisp zebra stripes, a giraffe's net), dark hooves.
- Coat patterns are drawn per pixel by the animal shader, so edges stay crisp at any mesh density. Props and
  scenery stay faceted low-poly (rocks, trees, fences).
- Quality tiers: pixel-ratio cap, shadows, and the visible visitor count. Swaying foliage and post-processing are
  high tier only.
- Visuals get approved on a mockup page before the systems are built (CLAUDE.md).

### 17.1 Drawing a big zoo

A complete zoo holds over 1,000 animals and more than 100 staff (economy.md §7). Every one of them is always
**simulated** in `src/core/`, but only the ones near the camera are **drawn** in full.

- **Full detail**: animated, code-built models for animals near the camera, up to a budget per quality tier: about
  40 on Low, 80 on Medium and 150 on High. Staff follow the same rule with a smaller budget. Visitors already use a
  capped sample (§10.1).
- **Priority** when there are more animals than the budget allows:
  1. the selected animal;
  2. animals with an active warning;
  3. babies;
  4. then the nearest to the camera's focus point.
- **Further away, still on screen**: cheap stand-ins. These are one instanced, low-detail mesh per species with a
  gentle idle bob, so a distant enclosure still looks inhabited.
- **Zoomed out to the overview** (build and management view): no animal models. Each enclosure shows a badge with
  the species icon, the animal count and any warning icons. Tapping a badge lists the animals.
- **No popping**: models fade in and out. There's a small margin around the detail range so animals near its edge
  don't flicker between detailed and stand-in.
- **Sounds** come only from drawn animals, plus the ambient mix (§16).
- Choosing which animals to draw is a **pure function** of world state, camera and budget, so it is tested under
  `bun test` like the rest of the core.

## 18. Saves

- **Unlimited save slots**, one zoo per slot, with a slot picker that shows the zoo name, date and a thumbnail.
- **Autosave** every in-game day and when the app goes to the background.
- Saves store seeds and decisions, not generated content. Saves stay on the device: localStorage, mirrored to
  native storage in the apps.
- localStorage holds about 5 MB per origin. The slot picker shows how much storage is used and warns when it's
  nearly full. Old slots can be deleted, and slots can be exported and imported as a file.

## 19. Languages, settings and accessibility

- **English and Czech at launch.** All UI text, species names and Zoopedia facts live in a strings table.
- **Settings**: graphics quality (Low/Medium/High, picked automatically for the device, can be changed), music and
  sound volume plus mute, language, and controls help.
- **Accessibility**: warning icons are colour-blind safe (shapes as well as colours), and every action works by
  keyboard, by mouse and by touch.

## 20. Release scope

**v1**:

- Everything in §1–§6, §9–§12 and §15–§19.
- The 30 v1 species and 8 biomes.
- Escapes and the inspector (§13.2–§13.3).
- Seasons and weather (§13.4).
- Real-world holidays (§13.5), with at least Halloween and Christmas.
- The Zoopedia and photo mode (§14).

**Later, ordered by priority**:

1. The remaining 8 biomes and 203 species, added in batches by body plan.
2. More holidays.
3. Species-specific animations.
4. Auto-reorder of food and other quality-of-life features.
5. Possibly real star purchases (§11.6).

## 21. Open questions

- The economy numbers in [economy.md](economy.md) were tuned with a simplified simulation and a perfect player.
  Rerun them against the real simulation, with random events and less perfect players.
- The free "Get stars" packs bypass the economy's balance. Should they have a once-a-day limit, disable
  achievements for that zoo, or be labelled as a test feature until real purchases exist? (economy.md §4.4)
- Who writes and fact-checks the species texts, in English and in Czech? IUCN statuses in species.md were written
  from memory and need checking.
- The exact contents and amounts of the "Get stars" packs.
- How compatibility works between each pair of species, and how fights are resolved (this needs its own small
  spec).
- The list of shows and attractions, and their schedules.
