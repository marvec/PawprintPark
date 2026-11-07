# Pawprint Park v1: milestones

The v1 release scope ([PRD.md](PRD.md) §20) is built in 12 milestones. Each one is run with `/goal` using the prompt
below, and each ends by stopping so it can be reviewed before the next one starts.

| # | Milestone | Kind |
|---|---|---|
| 1 | Foundations: checklist, pure-core time, map and saves | code |
| 2 | **Mockup: the world** (terrain, enclosures, props, keeper, weather) | review stop |
| 3 | **Mockup: HUD and UI** | review stop |
| 4 | Playable world: keeper, camera, input, build mode, autosave | code |
| 5 | Animals and care (PRD §5, §6) | code |
| 6 | Economy, progression, shop, tutorial (PRD §11, §12, §15.1) | code |
| 7 | **Mockup: people and buildings** (visitors, staff, facilities, landmarks, holidays) | review stop |
| 8 | Staff and visitors (PRD §9, §10, §11.9) | code |
| 9 | Events, seasons, weather, holidays (PRD §13) | code |
| 10 | Drawing a big zoo (PRD §17.1) | code |
| 11 | Zoopedia, photo mode, audio, settings, Czech (PRD §14, §16, §18, §19) | code + audio preview page |
| 12 | v1 wrap-up: audit, fresh-context review, tuning | code |

## Review gates

- Milestones 2, 3 and 7 build mockups only and stop.
- Iterate on them in normal chat until they look right. Then mark the milestone `approved` in
  `docs/v1-checklist.md` and write any review notes there.
- The milestones that build those visuals (4 after 2 and 3; 8 after 7) check for the `approved` mark first. If it
  is missing, they stop.
- Milestone 11 ends with an audio preview page to listen to.
- If a milestone is too big for one goal (5, 6 and 8 are the largest), split it: core and tests first, then scene
  and UI.

## Rules for every milestone

- Work in a git worktree on `feature/v1-mNN-<name>`, branched from `develop`. Never switch branches or stash in
  the main checkout.
- When a milestone is done:
  - commit it, with full-sentence messages and the `Co-Authored-By` trailer;
  - fast-forward `develop` locally.
- Never push; never touch `main`.
- CLAUDE.md wins on any conflict.
- **Pure core.**
  - Game logic lives in `src/core/` and `src/data/`.
  - It is deterministic (`createRng`/`hashString`, stable draw order).
  - It is tested under `bun test` with no DOM.
  - The scene builder stays separate from the renderer.
  - Saves store seeds and decisions.
- **No asset files.** Animals use the existing builder in `src/scene/animals/` (`buildAnimal` with `cache: true`
  and the quality tier's `detail`); don't rebuild it.
- **Mockups first.** New visuals are built only after their mockup is marked `approved` in
  `docs/v1-checklist.md`; otherwise stop and say what is missing.
- **Strings table from day one.** All UI text goes through it (English now, Czech in milestone 11).
- Every interaction works by keyboard, mouse and touch.
- Every feature gets:
  - tests;
  - a dev-only helper in `src/debug.js`;
  - its CLAUDE.md entry, in the same commit.
- Economy numbers live in one data file.
- **Open questions** (PRD §21): pick a sensible default, log it under "Decisions to review" in the checklist, and
  continue.
- If something can't work as specified, log the problem and a proposed change under "Problems" in the checklist
  rather than deviating silently.
- **Ports:** dev server 5428, headless Chrome 9438; never 5427 or 3000. Stop every process you started.
- Never read `.env`.
- **Out of scope:**
  - Capacitor apps, the service worker, analytics, the domain and the feedback form;
  - the "Later" list in PRD §20.
- Finish each milestone by stopping. Do not start the next milestone.

---

## Prompts

### Milestone 1: Foundations

```
Milestone 1 of 12 for Pawprint Park v1: foundations.

Read CLAUDE.md, docs/milestones.md, docs/web-game-handbook.md, docs/PRD.md, docs/economy.md and
docs/species.md. Follow "Rules for every milestone" in docs/milestones.md.

Write docs/v1-checklist.md:
- one line per testable v1 requirement (PRD §1–§6 and §9–§19, as scoped by §20);
- each line has a milestone number (from docs/milestones.md), a checkbox and a proof column (test name,
  screenshot path or debug helper);
- mockup milestones 2, 3 and 7 each get a status line reading "awaiting review";
- empty "Decisions to review" and "Problems" sections.

Then implement in src/core/ and src/data/ (pure, tested):
- the clock and calendar: 2 real minutes per day, 7-day months, 12-month years, pause/1×/2×/3×, day and night;
- the world state with serialize/deserialize;
- the seeded map: terrain heights, hills, a river or lake, trees and rocks, a flat start area;
- the grid with plots that are locked or unlocked;
- automatic path-network logic: connecting a placed footprint to the network on its entrance side;
- the starting layout from PRD §3;
- the slot store: unlimited slots, metadata, storage-usage estimate, export/import as JSON;
- the strings-table module.

Done when:
- docs/v1-checklist.md exists;
- `bun test` passes (show the output), with determinism tests for map generation and save round-trips;
- the work is committed and develop is fast-forwarded;
- the checklist lines for milestone 1 are ticked with proof;
- you have stopped.
```

### Milestone 2: World mockup (review stop)

```
Milestone 2 of 12 for Pawprint Park v1: the world mockup.

Follow "Rules for every milestone" in docs/milestones.md.

Build src/mockups/world/ in the style of PRD §17: warm summer-afternoon palette, soft toy-like low-poly, faceted
props. It covers:
- terrain from the milestone-1 map generator, with hills, river or lake, trees and rocks;
- grid and plot borders, locked versus unlocked land;
- automatic paths;
- the entrance gate with a name sign, and a small storehouse;
- enclosures for all 8 v1 biomes in sizes S, M, L and XL, with fences in new, worn and broken states;
- the Reptile & Amphibian House as an indoor building, and the Aviary;
- habitat upgrade levels 0–3 shown side by side;
- feeders, water points, shelter, heater, cooler, pool, climbing frame, enrichment toy, feeding chute;
- poop piles and a dirty-enclosure look;
- the keeper figure and the golf cart;
- the 3/4 camera, rotation in 90° steps, and the zoomed-out overview;
- day, dusk and night lighting;
- sun, rain, snow and heat-wave looks;
- a few existing animals placed in the enclosures for scale.

Use URL params and keys like the body-plan mockup has (time of day, weather, biome, size, wear, upgrade level,
quality, ui=0). Add a `__world` debug helper. Register the page in server.js and CLAUDE.md. Measure triangles and
draw calls per quality tier.

Done when:
- screenshots under docs/mockups/world/ show the overview, every biome, fence wear, upgrade levels, the
  equipment, the keeper and cart, and day/night/weather, each at High and Low;
- `bun test` passes;
- the work is committed and develop is fast-forwarded;
- you have stopped and listed what to review, plus any open art questions.

Do not build any game systems on this page.
```

### Milestone 3: HUD and UI mockup (review stop)

```
Milestone 3 of 12 for Pawprint Park v1: the HUD and UI mockup.

Follow "Rules for every milestone" in docs/milestones.md.

Build src/mockups/ui/ with DOM over a static world backdrop. Use fake data from a fixture, and route all text
through the strings table. It covers:
- The HUD (PRD §15.2): coins, stars, level and XP bar, date and time, speed controls, reputation, and buttons for
  alerts, shop, stats, Zoopedia and menu.
- The alert feed.
- Colour-blind-safe warning icons (shape and colour).
- The animal details panel (§6.3).
- The chore progress ring.
- The on-screen joystick and action button.
- Quick-travel.
- Build mode: the ghost preview in valid and invalid states, rotate, move, sell.
- The shop with every section in §11.5, the "Get stars" dialog, and the market listing.
- The statistics page with charts.
- Staff hiring and work zones.
- Tutorial goal cards and one-off tips.
- Naming dialogs.
- The level-up moment.
- Overview badges (species icon, count, warnings) and the badge animal list.
- The Zoopedia list and a species page with bronze/silver/gold marks.
- The photo mode UI.
- The settings screen.
- The slot picker with storage usage.
- The pause menu.

Show each screen at phone portrait, phone landscape, tablet and desktop widths. Add a long-text switch that
simulates Czech string lengths. Each screen must be reachable by URL param and keyboard. Add a `__ui` debug
helper, and register the page in server.js and CLAUDE.md.

Done when:
- screenshots under docs/mockups/ui/ cover every screen at a phone width and at desktop;
- `bun test` passes;
- the work is committed and develop is fast-forwarded;
- you have stopped and listed what to review.

Do not build any game systems.
```

### Milestone 4: Playable world

```
Milestone 4 of 12 for Pawprint Park v1: the playable world.

Follow "Rules for every milestone" in docs/milestones.md. Milestones 2 and 3 must be marked approved in
docs/v1-checklist.md; if not, stop. Apply the review notes recorded there.

Turn the game page into a playable world:
- a new-game flow with naming the zoo, saved to a slot from a seed;
- buildScene from world state, with the approved world visuals;
- the keeper moving by WASD/arrows, the on-screen joystick, and tap/click-to-walk;
- the 3/4 follow camera with zoom to the overview and 90° rotation;
- the clock running only while the game is open, with speed controls, day and night, and night fast-forward;
- build mode from the overview (PRD §4): shop item, ghost preview, place/rotate/move/sell, automatic paths;
- placing enclosures by biome and size;
- buying plots (stub costs from the economy data file; real economy in milestone 6);
- autosave every in-game day and on going to the background;
- the slot picker;
- the HUD shell from the approved mockup;
- dispose and context-loss handling that keeps working while scenes change;
- debug helpers to jump to states (`__pawprint.newZoo(seed)`, `.time(...)`, `.build(...)`).

Done when:
- `bun test` passes (show the output), including a smoke test of the main loop with random input;
- `bun run build` succeeds;
- screenshots at 5428 show walking, the overview, build mode with the ghost, and night;
- a save reloads identically;
- the milestone-4 checklist lines are ticked;
- the work is committed and develop is fast-forwarded;
- you have stopped.
```

### Milestone 5: Animals and care

```
Milestone 5 of 12 for Pawprint Park v1: animals and care.

Follow "Rules for every milestone" in docs/milestones.md.

Implement PRD §5 and §6 in the core first, then wire them to the scene:
- §5: feeders and water points, extra equipment, habitat upgrades, fence wear and breaking, poop piles,
  cleanliness and water quality;
- §6:
  - species needs and soft scoring from docs/species.md;
  - stats;
  - feeding and water with storehouse stock;
  - illness and the vet call-out;
  - breeding and the life cycle (babies use the existing builder's age);
  - death;
  - personality and interaction (pet, brush, treat);
  - the four animations idle/walk/eat/sleep, driven by the simulation, with nocturnal species active at night.

Keeper chores (PRD §4) use the action button and the progress ring. The details panel and the alert feed come
from the approved UI mockup; alerts warn before things become critical, and tapping one quick-travels there.

Done when:
- core tests cover every need, stat, illness and breeding rule deterministically;
- `bun test` passes and `bun run build` succeeds;
- screenshots show a hungry animal with its alert, a chore in progress, poop and a dirty enclosure, a sick animal,
  a baby, and the details panel;
- the milestone-5 checklist lines are ticked;
- the work is committed and develop is fast-forwarded;
- you have stopped.
```

### Milestone 6: Economy, progression and tutorial

```
Milestone 6 of 12 for Pawprint Park v1: economy, progression and tutorial.

Follow "Rules for every milestone" in docs/milestones.md.

Implement, with every number in one economy data file matching docs/economy.md:
- PRD §11:
  - coins and stars, prices, the entrance fee, reputation, loans and bankruptcy;
  - the shop sections that exist so far;
  - the free "Get stars" dialog;
  - selling animals and transferring them to partner zoos;
  - the market refreshing weekly;
  - the statistics page;
  - conservation projects in the core;
- PRD §12: XP and levels with unlocks for species, equipment and buildings; goals; achievements; zoo awards;
- PRD §15.1: the neglected-sheep tutorial as guided goals, skippable, paying 1,000 Z either way, plus one-off
  tips when a feature unlocks.

Point `bun run sim` at the real core instead of the simplified model, keeping its flags.

Done when:
- `bun test` passes, including economy tests;
- `bun run sim --v1` runs on the real core (show the output and compare it with the economy.md §7 targets; log
  any gaps in the checklist);
- screenshots show each tutorial step, the shop, the statistics page and a level-up;
- the milestone-6 checklist lines are ticked;
- the work is committed and develop is fast-forwarded;
- you have stopped.
```

### Milestone 7: People and buildings mockup (review stop)

```
Milestone 7 of 12 for Pawprint Park v1: the people and buildings mockup.

Follow "Rules for every milestone" in docs/milestones.md.

Build src/mockups/people/ in the approved style. It covers:
- code-built, toy-like visitors: varied ages, body shapes and colours from a seed;
- visitor emotion icons (PRD §10.1);
- holiday outfits for Halloween and Christmas;
- staff for each role (caretaker, janitor, guard, vet) with readable uniforms;
- the welfare inspector;
- walk, idle and sit animations;
- facilities from §11.5: toilets, benches, bins, coffee, hotdog and drink stands, a restaurant, kids'
  attractions and a playground, a souvenir shop, staff quarters, a show arena, the storehouse;
- decorations: plants, rocks, fountains, statues;
- 15–20 landmarks (§11.9);
- the conservation wall;
- Halloween and Christmas decorations;
- litter.

Include a crowd view at each tier's visitor cap, with triangles and draw calls measured. Add a `__people` debug
helper, and register the page in server.js and CLAUDE.md.

Done when:
- screenshots under docs/mockups/people/ cover everything above at High and Low;
- `bun test` passes;
- the work is committed and develop is fast-forwarded;
- you have stopped and listed what to review.

Do not build any game systems.
```

### Milestone 8: Staff and visitors

```
Milestone 8 of 12 for Pawprint Park v1: staff and visitors.

Follow "Rules for every milestone" in docs/milestones.md. Milestone 7 must be marked approved in
docs/v1-checklist.md; if not, stop. Apply the review notes recorded there.

Implement:
- PRD §9: hiring with a weekly-refreshing list, work quality, speed, wage, work zones, capacity in work points,
  workload hints, night shifts only with staff quarters, and missed wages leading to unpaid staff and then
  quitting. Staff do chores through the same core actions as the keeper.
- PRD §10: the whole-crowd model (count, spending, needs, happiness), a capped walking sample per tier, emotion
  icons, needs met by facilities, and incidents with guard coverage.
- The facilities, decorations, landmarks (with the capped happiness bonus) and conservation wall from §11.9,
  using the approved visuals.

Done when:
- core tests cover workload, wages, the crowd model and incident odds;
- `bun test` passes and `bun run build` succeeds;
- `bun run sim --v1` is rerun (show any changes against the targets);
- screenshots show a busy zoo with staff working, visitor emotions, facilities and a landmark;
- the milestone-8 checklist lines are ticked;
- the work is committed and develop is fast-forwarded;
- you have stopped.
```

### Milestone 9: Events and seasons

```
Milestone 9 of 12 for Pawprint Park v1: events and seasons.

Follow "Rules for every milestone" in docs/milestones.md.

Implement PRD §13:
- incidents wired to notifications and to the cause shown in the details panel;
- escapes from broken fences: visitors panic, reputation drops, catch by holding the action button, and dangerous
  species need a guard or the vet with a tranquilliser;
- the yearly welfare inspector with grades, rewards and fines;
- seasons driving temperature;
- weather (sun, rain, snow, heat wave) affecting visitor numbers and animal comfort, with heatstroke and
  frostbite, mitigated by shelters, heaters and coolers;
- real-world holidays from the device date: at least Halloween and Christmas, with limited shop decorations that
  stay for good and themed visitor outfits.

Every event can be triggered by a debug helper.

Done when:
- core tests cover the event odds and outcomes deterministically;
- `bun test` passes and `bun run build` succeeds;
- screenshots show an escape and its catch, an inspection result, snow, a heat wave, and the Halloween and
  Christmas zoo;
- the milestone-9 checklist lines are ticked;
- the work is committed and develop is fast-forwarded;
- you have stopped.
```

### Milestone 10: Drawing a big zoo

```
Milestone 10 of 12 for Pawprint Park v1: drawing a big zoo.

Follow "Rules for every milestone" in docs/milestones.md.

Implement PRD §17.1:
- choosing what to draw is a pure, tested function of world state, camera and budget, with the priority order
  from §17.1 and tier budgets of about 40, 80 and 150;
- staff follow the same rule with a smaller budget;
- detail by distance with hysteresis, with the tier capping the best mesh resolution;
- shadows always use the low mesh with a small shadow map;
- instanced stand-ins per species with an idle bob;
- overview badges with no animal models;
- fades instead of popping;
- sounds only from drawn animals (hook only; audio comes in milestone 11).

Add a debug helper that fills a zoo to economy.md §7's late-game size (1,000+ animals, 100+ staff).

Done when:
- `bun test` passes, with tests for selection, priority and hysteresis;
- a perf report from that full zoo at each tier (triangles, draw calls, shadow-pass share) is written to the
  checklist proof;
- screenshots show near, mid and overview distances;
- the milestone-10 checklist lines are ticked;
- the work is committed and develop is fast-forwarded;
- you have stopped.
```

### Milestone 11: Zoopedia, photo mode, audio, settings, languages

```
Milestone 11 of 12 for Pawprint Park v1: Zoopedia, photo mode, audio, settings and languages.

Follow "Rules for every milestone" in docs/milestones.md.

Implement:
- PRD §14:
  - the Zoopedia for all 233 species: owned species show facts, range, diet, lifespan, status and their sound;
    others show the silhouette and where they unlock;
  - bronze, silver and gold marks;
  - photo mode with a free camera and no HUD, photos saved to the Zoopedia, download on the web and the share
    hook through platform.js.
- PRD §16:
  - synthesized positional animal calls with one voice per body plan, tuned per species and heard relative to
    the keeper;
  - day and night ambient music;
  - UI sounds and a level-up fanfare;
  - the AudioContext gesture and resume handling from the handbook.
  Build src/mockups/audio/ where each species call and the music can be played for review.
- PRD §19:
  - settings for quality (auto-picked, changeable), music and sound volume and mute, language, and controls help;
  - a complete Czech translation of the strings table, with a test that every key exists in both languages;
  - an accessibility pass (keyboard, mouse and touch on every screen; colour-blind-safe icons).
- PRD §18: finish slot export, import and the near-full storage warning.

Mark any species facts written from memory in the "Decisions to review" section.

Done when:
- `bun test` passes and `bun run build` succeeds;
- screenshots show the Zoopedia (owned and not owned), photo mode, and settings in English and Czech;
- the audio page exists;
- the milestone-11 checklist lines are ticked;
- the work is committed and develop is fast-forwarded;
- you have stopped and listed what to review, including listening on the audio page.
```

### Milestone 12: v1 wrap-up

```
Milestone 12 of 12 for Pawprint Park v1: the wrap-up.

Follow "Rules for every milestone" in docs/milestones.md.

1. Audit docs/v1-checklist.md against docs/PRD.md line by line. Implement anything missing and fix anything
   unproven.
2. Run a fresh-context review of the whole v1 diff since 65649fc with subagents, covering:
   - correctness;
   - the pure-core and determinism rules;
   - saves round-tripping across every system;
   - dispose and context loss;
   - input parity across keyboard, mouse and touch.
   Fix everything the review confirms.
3. Retune the economy until `bun run sim --v1` meets the docs/economy.md §7 targets, or log the remaining gaps.
   Update economy.md to match.
4. Play the first hour through debug helpers: tutorial, first expansion, first staff hire, first event. Fix what
   breaks.
5. Bring CLAUDE.md, PRD.md ("not built yet" notes) and the handbook lessons up to date.

Done when:
- every v1 line in the checklist is ticked with proof;
- `bun test` passes and `bun run build` succeeds (show both);
- screenshots at 5428 show a fresh zoo with the tutorial sheep and a mid-game zoo loaded via a debug helper;
- the sim output is shown;
- the review findings and their fixes are listed;
- the work is committed, develop is fast-forwarded, and nothing was pushed;
- you have stopped with a summary and the "Decisions to review" list.
```
