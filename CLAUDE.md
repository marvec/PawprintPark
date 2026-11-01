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
bun scripts/screenshot.js <url> <out.png> # headless-Chrome screenshot (port 9438, CDP_PORT overrides); WIDTH, HEIGHT, WAIT env vars
```

Not yet: `bun run build:app` (Capacitor, `mobile/`), the service worker, analytics, saves.

## Pages

- `/` (`src/index.html`, `src/main.js`): the game. For now a title scene with the neglected sheep.
- `/mockups/body-plans/` (`src/mockups/`): **art-direction mockup** of the 12 v1 body plans and 30 species (male,
  female, baby). URL params for screenshots: `?pose=walk&focus=cat&species=plains-zebra&quality=low&scale=uniform&flat=1&babies=0&ui=0`
  Close-ups: `species=<id>` (in-game angle), `view=side|front`, `only=<id>` (hide the others), `sex=male|female`
  (one adult), `zoom=2`, `still=1` (frozen pose with open eyes: headless Chrome renders slowly, so without it a
  screenshot can catch a blink). `bun scripts/screenshot.js` takes `EVAL='expr'` to print page state.
  Keys: 1–4 pose, ←/→ body plan, 0 overview, U same size, F faceted, B babies, R turntable, M builder, Q quality,
  H panel. `builder=single|current` switches to the single-mesh builder (experiment); `tris=1` adds triangle counts.
- `/mockups/single-mesh/plans/`: the same body-plan mockup, opening with the single-mesh builder (all 12 plans).
- `/mockups/single-mesh/` (`src/mockups/single-mesh.*`): **experiment**: single-mesh animals next to the current
  builder, one species per row (the overview shows lion, zebra, giraffe, elephant). URL params: `species=<id>|all`,
  `view=game|side|front|rear`, `pose=`, `builder=both|old|new`, `quality=`, `sex=`, `babies=0`, `zoom=`, `wire=1`,
  `seeds=4` (individuals with different coats), `still=1`, `ui=0`. Report: `docs/experiments/single-mesh-opus-low.md`.

## Key files

- `src/core/rng.js`: `createRng(seed)`, `hashString(str)`.
- `src/data/species.js`: the 233-species catalogue, **generated** from `docs/species.md` (a test checks they match).
- `src/data/palette.js`, `src/data/quality.js`: world colours; quality tiers (`low`/`medium`/`high`: DPR cap,
  shadows, geometry detail, animal draw budget).
- `src/scene/animals/`: code-built animals. `buildAnimal(id, { sex, age })` → `{ group, rig, look }`;
  `animate(rig, pose, t)` with poses `idle | walk | eat | sleep`. One builder per family of body plans
  (`quadruped.js`: hoof, cat, dog, bear, small, pachy; `bird.js`: bird-walk, bird-perch, penguin; `pinniped.js`;
  `reptile.js`: lizard, turtle). Species parameters live in `looks.js` (metres, radii; `male`/`female`/`baby`
  overrides). Coat patterns (`patterns.js`) are painted into the vertices as two colours plus a mask field; the
  shared animal material (`rig.js`) draws the edge per pixel, and cell patterns (giraffe patches, spots) are
  computed in its shader from the rest position. So every animal uses one material and no textures, and edges
  stay crisp. Bodies are deformed spheres (`torso`, `egg` in `shapes.js`) with poles at front and back, so
  patterns interpolate cleanly over the back. Animating resets the rig's parts to rest every frame and never touches the
  animal's own position, rotation or scale.
- `src/scene/animals/mesh/` (experiment): one skinned mesh per animal. `buildAnimal(id, { sex, age, seed, detail,
  cache })` and `animate(rig, pose, t, opts)` as above. A code-built quad cage (`cage.js`: lofted spine tube, limbs
  extruded from its faces; profiles per plan in `quadruped.js`) is Catmull-Clark subdivided to its limit surface
  (`subdivide.js`); skin weights and coat channels ride the same stencils. The shared material (`material.js`) paints
  stripes, patches, spots and markings per pixel; the individual's seed travels in bone 0 of the skeleton, so
  geometry is shared per species, sex, age and detail. Cage builders per plan family: `quadruped.js`, `bird.js`,
  `pinniped.js`, `reptile.js` (`info.kind` picks the pose family in `animate*.js`). Species extras in `mesh/looks.js`
  (quadrupeds, with per-plan defaults), `looks-birds.js`, `looks-reptiles.js`. Detail tiers (`detailSettings` in
  `mesh/index.js`, `settings.tier`) sample the same limit surface: high subdivides the cage twice, low subdivides the
  same cage once, and medium subdivides once a cage with twice the rings.
- `src/scene/backdrop.js`: sky dome, warm sun + hemisphere light, seeded meadow with trees and rocks.
- `src/engine/renderer.js`: WebGL renderer with quality tiers, clamped dt, context-loss rebuild, background pause,
  and `step(frames)` for driving it by hand. `src/engine/platform.js`: runtime platform questions.

## Debug helpers

- `__step(frames)`: advance the render loop by hand (game and mockup).
- `__pawprint.mockup()`: open the body-plan mockup (game, dev only; `src/debug.js` is stripped from production and
  `tests/devOnly.test.js` checks it).
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
