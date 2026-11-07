# Pawprint Park

A zoo builder and management game (in the spirit of Planet Zoo), built as a 3D web game that is later wrapped as
iOS and Android apps.

**Tech stack, setup and lessons learned: [docs/web-game-handbook.md](docs/web-game-handbook.md).** Read it before
setting up tooling, adding a system, or touching rendering, audio, saves, platform code or deployment. It is the
source of truth for how we build; this file records the decisions specific to Pawprint Park and grows as the
project does (handbook §15).

The handbook comes from a pixel-art (DOS-style) 2D game. Its general rules apply here (pure core, seeded RNG,
quality tiers, saves, platform, deployment, testing), but **its pixel-art parts do not**: no fixed 480×270
resolution, no integer scaling, no bitmap font. The HUD is DOM, and the look is the soft 3D style in PRD §17.
SynergyTower's code isn't available, so everything is written fresh.

**What we're building: [docs/PRD.md](docs/PRD.md)** (product requirements) and
[docs/species.md](docs/species.md) (all 233 species; the 30 marked ✅ are v1),
[docs/economy.md](docs/economy.md) (economy numbers and pacing targets).

## Stack at a glance

- **Bun 1.4**: dev server, bundler, test runner. `three` (pinned exact version, `bun.lock` committed) is the only
  runtime dependency.
- Vanilla ES modules, plain JS with JSDoc, no framework.
- **Three.js (WebGL)** for the world; a 2D canvas or DOM layer for the HUD and text.
- **No asset files**: geometry, textures (canvas-painted), lighting, music and sound effects are all generated in
  code.
- Saves in localStorage (slot store), mirrored to native storage inside the apps. No cookies, no accounts.
- Website on GitHub Pages via Actions; apps via Capacitor 8 around the same bundle.

## Commands

```
bun run dev        # dev server with hot reload → http://localhost:5427 (PORT=5428 for a second one)
bun run build      # website → dist/ (mockup pages are dev-only and not built)
bun run preview    # serve dist/ → http://localhost:4427
bun test           # all tests (they gate the deploy)
bun run sim        # economy pacing simulation: [--v1] [--until=180] [--key=value] (docs/economy.md §7)
bun scripts/species-from-md.js            # regenerate src/data/species.js after editing docs/species.md
bun scripts/screenshot.js <url> <out.png> # headless-Chrome screenshot (port 9438, CDP_PORT overrides); WIDTH, HEIGHT, WAIT env vars; .jpg saves JPEG
bun scripts/world-mockup-shots.js [--only=a,b]   # world mockup screenshots, High and Low → docs/mockups/world/ (dev server on 5428)
```

Not yet: `bun run build:app` (Capacitor, `mobile/`), the service worker, analytics. Saves exist in the core
(`src/core/slots.js`) but the game doesn't use them until milestone 4.

## Pages

- `/` (`src/index.html`, `src/main.js`): the game. For now a title scene with the neglected sheep.
- `/mockups/body-plans/` (`src/mockups/`): **art-direction mockup** of the 12 v1 body plans and 30 species (male,
  female, baby). URL params for screenshots: `?pose=walk&focus=cat&species=plains-zebra&quality=low&scale=uniform&flat=1&babies=0&ui=0`
  Close-ups: `species=<id>` (in-game angle), `view=side|front`, `only=<id>` (hide the others), `sex=male|female`
  (one adult), `zoom=2`, `still=1` (frozen pose with open eyes: headless Chrome renders slowly, so without it a
  screenshot can catch a blink). `bun scripts/screenshot.js` takes `EVAL='expr'` to print page state.
  Keys: 1–4 pose, ←/→ body plan, 0 overview, U same size, F faceted, B babies, R turntable, Q quality, H panel.
  `tris=1` adds triangle counts.

- `/mockups/world/` (`src/mockups/world/`): **art-direction mockup of the world**. The milestone-1 map (seed 6)
  with the starting zoo plus a showcase placed through the real path rules (`layout.js`): the 8 v1 biomes, sizes
  S–XL, fence wear, dirt, habitat levels 0–3, every piece of equipment, the keeper and the golf cart. No game
  systems run on it. URL params: `focus=overview|start|biomes|sizes|wear|upgrades|equipment|houses|keeper`, or one
  enclosure by `biome=<id>`, `size=S|M|L|XL`, `wear=new|worn|broken`, `upgrade=0-3`; `time=dawn|day|dusk|night`,
  `weather=sun|rain|snow|heat`, `quality=`, `rot=0-3`, `zoom=2`, `grid=1`, `roofs=0|1`, `labels=0`, `ui=0`,
  `still=1`, `seed=`. Keys: ←/→ focus, 0 overview, WASD pan, Q/E rotate 90°, +/− zoom, B biome, Z size, F fence,
  U level, T time, Y weather, G grid, R roofs, L labels, X quality, H panel; drag pans, scroll or pinch zooms,
  click or tap an enclosure to focus it. Screenshots and per-tier costs: `docs/mockups/world/`.

## Key files

- `src/core/rng.js`: `createRng(seed)`, `hashString(str)`.
- `src/core/time.js`: clock and calendar. `createClock()`, `advanceClock(clock, realSeconds)` returns the hour,
  day, month and year boundaries crossed (each once). `setSpeed` (0–3), `skipNight` (12× until 6:00),
  `calendarOf(minute)`, `phaseOf`, `daylight`, `isZooOpen`. Time is in-game minutes since 1 January, year 1; a
  new zoo starts on 1 March at 7:00.
- `src/core/map.js`: `generateMap(seed)`, 240×240 tiles with corner `heights`, `water` tiles, `waterBody`
  (river or lake), `trees`, `rocks` and the flat `start` area. Each feature uses its own hashed RNG stream, and
  `tests/map.test.js` pins two seeds' fingerprints. If you change the generator on purpose, update them and say so
  in the commit (every zoo changes shape). Also `heightAt`, `isWater`, `tileSlope`, `isLand`.
- `src/core/plots.js`: land plots (24×24 tiles, 10×10 of them); the state stores unlocked plot indices.
  `startingPlots`, `buyablePlots`, `unlockPlot`, `plotStarCost`.
- `src/core/paths.js`: automatic paths. A placement is `{ id, kind, x, z, rot, size? }`; its front (+z at rot 0)
  connects to the network. `buildPathNetwork(map, plots, placements)` replays placements in order: the gate's
  12-tile avenue, then the cheapest route from each door. `canPlace(...)` returns `{ ok, route }` or a `reason`
  (`off-map`, `locked`, `water`, `steep`, `overlap`, `path`, `no-path`). Paths are derived, never saved.
- `src/core/layout.js`: the starting layout: gate, storehouse, two Farmyard S enclosures.
- `src/core/state.js`: the world state.
  - `createWorld({ seed, name })` builds a new zoo, including the neglected sheep.
  - `serialize` / `deserialize` handle saves. Loading merges the save over defaults (and `clock` and `flags` one
    level down) and refuses saves from newer versions.
  - State keys: `version`, `seed`, `name`, `clock`, `coins`, `stars`, `plots`, `placements` (enclosures carry
    `biome`, `name` and `care`), `animals`, `flags`, `nextId`.
- `src/core/slots.js`: `createSlotStore(storage)` works on any localStorage-like store, under the `pawprint.`
  prefix (index `pawprint.slots`, saves under `pawprint.slot.<id>`, thumbnails under `pawprint.thumb.<id>`).
  - Slots: `list`, `save`, `load`, `thumbnail`, `remove`.
  - `usage()` reports storage use, with `nearlyFull` from 80% of 5 MB.
  - `exportSlot` and `importSlot` move a slot in and out as a file.
  - Storage errors come back as `{ ok: false }`, never thrown.
- `src/core/strings.js` + `src/data/strings.js`: the strings table (all UI text). `createStrings(lang).t(key,
  params)` fills `{placeholders}` and plural forms (`count`), and falls back to English and then to the key.
  `formatDate`, `formatTime`.
- `src/data/world.js`: map, plot and start-area sizes, `ENCLOSURE_SIZES`, `BIOMES` (16, the first 8 in v1; ids
  match `species.js`), `FOOTPRINTS`. `src/data/economy.js`: `ECONOMY`, every economy number (fills up in
  milestone 6).
- `docs/milestones.md` (the v1 plan and the rules for each milestone) and `docs/v1-checklist.md` (every v1
  requirement with its proof, mockup review status, decisions to review).
- `src/data/species.js`: the 233-species catalogue, **generated** from `docs/species.md` (a test checks they match).
- `src/data/palette.js`, `src/data/quality.js`: world colours; quality tiers (`low`/`medium`/`high`: DPR cap,
  shadows, geometry detail, animal draw budget).
- `src/scene/animals/`: code-built animals, one skinned mesh each. `buildAnimal(id, { sex, age, seed, detail, cache })`
  → `{ group, rig, look }`; `animate(rig, pose, t, opts)` with poses `idle | walk | eat | sleep`. Pass the quality
  tier's `detail`; `cache: true` shares geometry per species, sex, age and detail. A code-built quad cage (`cage.js`:
  lofted spine tube, limbs extruded from its faces) is Catmull-Clark subdivided to its limit surface (`subdivide.js`);
  skin weights and coat channels ride the same stencils. Cage builders per plan family: `quadruped.js` (hoof, cat,
  dog, bear, small, pachy), `bird.js` (bird-walk, bird-perch, penguin), `pinniped.js`, `reptile.js` (lizard,
  turtle); `info.kind` picks the pose family in `animate*.js`. Species sizes live in `looks.js` (metres, radii;
  `male`/`female`/`baby` overrides); ears, head pitch, paint and shape tweaks in `looks-quadrupeds.js` (with
  per-plan defaults), `looks-birds.js`, `looks-reptiles.js`. The shared material (`material.js`) paints stripes,
  patches, spots and markings per pixel, so every animal uses one material and no textures. The individual's seed
  travels in bone 0 of the skeleton. Detail tiers (`detailSettings` in `index.js`) sample the same limit surface:
  high subdivides the cage twice, low subdivides the same cage once, and medium subdivides once a cage with twice
  the rings. Animating resets the bones to rest every frame and never touches the animal's own position, rotation or
  scale.
- `src/scene/world/`: the world scene (approved visuals feed milestone 4). One tile is `TILE` = 2 m; map heights
  are in tiles too.
  - `index.js`: `buildWorldScene({ map, plots, placements, network, name, materials, detail, sign })` → terrain,
    scatter, paths, lamps, one entry per placement (`enclosures[]` with animal `spots` and equipment `labels`),
    `setRoofs(visible)`.
  - `kit.js`: `createKit()` merges flat-shaded, vertex-coloured parts into one geometry (one draw call per
    enclosure); `withinAll(kits, frame, fn)`; `placementFrame(rect, rot)` (local +z = the placement's front);
    `createWorldMaterials()`; `WEATHER_UNIFORMS` (`uSnow`, `uWet`, `uDry`) shared by every world material.
  - `terrain.js`: 5×5 terrain chunks (the shader draws the grid, plot borders and muted locked plots), water,
    land beyond the map, paths with kerbs, instanced trees and rocks (cleared under footprints and paths).
  - `enclosures.js`: `buildEnclosure(placement, look, ctx)`: biome ground, fences per biome (`BIOME_LOOKS`) in
    `new`/`worn`/`broken`, habitat levels 0–3 (more plants; glass panes and an info board from 2; a viewing deck,
    flower beds and a pond at 3), equipment, poop and dirt, the Reptile House (tanks, liftable roof) and the Aviary
    (net).
  - `props.js` (equipment, plants, gate, storehouse, lamps), `people.js` (`buildKeeper`, `animateKeeper` with
    `walk`/`idle`/`sit`, `buildCart`), `atmosphere.js` (`createAtmosphere`: `TIMES`, `WEATHERS`, sky, sun, fog,
    stars, rain and snow on the GPU), `sign.js` (the gate's name board; browser only).
- `src/scene/backdrop.js`: sky dome, warm sun + hemisphere light, seeded meadow with trees and rocks.
- `src/engine/renderer.js`: WebGL renderer with quality tiers, clamped dt, context-loss rebuild, background pause,
  and `step(frames)` for driving it by hand. `src/engine/platform.js`: runtime platform questions.

## Debug helpers

- `__step(frames)`: advance the render loop by hand (game and mockup).
- `__pawprint.mockup()`: open the body-plan mockup (game, dev only; `src/debug.js` is stripped from production and
  `tests/devOnly.test.js` checks it).
- `__pawprint.world(seed, name)`: a new zoo's world state. `__pawprint.map(seed)`: a map summary (water, trees,
  rocks, path tiles). `__pawprint.slots()`: the slots and storage use on this origin. `__pawprint.saveNew(seed)`:
  save a fresh zoo into a new slot.
- `__pawprint.worldMockup(query)`: open the world mockup with URL parameters.
- `__world.{ state, rig, zoo, focusOn(stop), focusBiome(id), focusSize(s), focusWear(w), focusUpgrade(n), rotate(±1),
  setTime(t), setWeather(w), setQuality(q), perf(frames), built() }` (world mockup). `perf()` reports draw calls and
  triangles per part (terrain, trees, rocks, paths, enclosures, gate and storehouse, lamps, animals, keeper and
  cart, sky and weather), the shadow pass and GPU memory.
- `__mockup.{ state, focusOn(i), focusSpecies(id), setQuality(name), rebuild(), animals() }`: drive the mockup.
- `__mockup.perf(frames = 20)` (body-plan mockup): what a frame costs, from `renderer.info`. It reports:
  - draw calls and triangles per part (animals, trees, rocks, ground, sky, strips), measured by hiding each part;
  - the main pass and the shadow pass;
  - per species: triangles, meshes, bones;
  - GPU memory and shader programs;
  - milliseconds for posing, matrices, rendering, rendering without the shadow pass, and rendering without animals.

  Timings wait for the GPU (`gl.finish`), so run it in a real browser; headless Chrome renders in software.

## Ports

- Dev server: **:5427**
- Production preview: **:4427**
- Extra dev server for agents/tools: **:5428**; headless Chrome: **:9438**

Each port is its own localStorage origin. Port 3000 is taken by another project. Never kill a process you didn't
start.

## Architecture rules

- **Pure core.** `src/core/` and `src/data/` never touch the DOM, `window`, canvas or WebGL. Everything there runs
  under `bun test` with no mocks.
- **Seeded, deterministic logic.** Use `createRng(seed)` / `hashString` from `src/core/rng.js`; never
  `Math.random()` in logic. Keep RNG draw order stable; new features derive randomness from a hash, not from an
  existing generator's RNG. Store seeds and decisions, never generated content.
- **Scene builder separate from renderer.** `buildScene(worldData)` returns plain `THREE.Object3D` trees and is
  tested without WebGL; renderer, composer and canvas live in `src/engine/`.
- **One bundle, every platform.** Never branch on build flags for platform behaviour; ask at runtime via
  `src/engine/platform.js`. The web bundle has no npm dependency on Capacitor.
- **Quality tiers from day one** (pixel ratio cap, shadows, post-processing). Dispose GPU resources on scene changes;
  handle WebGL context loss; pause rendering in the background.
- **Art direction must suit code-built geometry**: stylized / low-poly / toy-like animals and guests, not realistic
  rigged models (handbook §5.2). Approve visuals on a mockup page before building systems.
- Economy numbers live in one file with simulation tests on top.
- Every interaction works by keyboard **and** mouse/touch.

## Branching (git-flow)

- `main`: released code. **Pushing `main` deploys production**, so it must always be shippable.
- `develop`: integration branch, the GitHub default.
- `feature/*` from `develop` → `develop`; `release/*` from `develop` → `main` + `develop`; `hotfix/*` from `main` →
  `main` + `develop`. Tag releases on `main`.

## House rules

- Commit only when asked; push only when asked.
- Never stash or switch branches in a shared working tree (parallel sessions share it).
- Don't read `.env`.
- Commit messages describe the change for players and developers in full sentences.
- Update this file in the same commit as the feature it describes (commands, key files, state keys, debug helpers,
  analytics events).
- Big features go spec → plan → implementation with tests → fresh-context review (handbook §15).
