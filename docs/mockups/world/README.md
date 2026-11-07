# World mockup (milestone 2)

The art-direction mockup of the world: `/mockups/world/` on the dev server (`bun run dev`, then
http://localhost:5427/mockups/world/). It shows the milestone-1 map for seed 6 with a new zoo's starting layout,
plus a showcase that is placed through the real path rules. No game systems run on the page.

Every view below is at High (`-high.jpg`) and Low (`-low.jpg`), 1280×800. Regenerate them with
`bun scripts/world-mockup-shots.js` while a dev server runs on port 5428. The URL parameters are in CLAUDE.md.

## Views

| File | What it shows | URL parameters |
|---|---|---|
| `overview` | The zoomed-out overview: the whole zoo on the map, plot borders, locked land muted | `focus=overview` |
| `grid` | Build-mode grid and plot borders over the start area | `focus=start&grid=1` |
| `start` | A new zoo: gate with its name sign, the road in, storehouse, the neglected sheep's dirty enclosure, the empty one | `focus=start` |
| `biome-<id>` | Each of the 8 v1 biomes (M size; the Aviary is L) with animals for scale | `biome=<id>` |
| `biome-reptile-house-roof` | The Reptile & Amphibian House with its roof on (it lifts when the camera comes close) | `biome=reptile-house&roofs=1` |
| `sizes` | S, M, L and XL (African Savanna) side by side, at levels 1, 1, 2 and 3 | `focus=sizes` |
| `fence-wear` | New, worn and broken fences, and a dirty enclosure with poop, murky water and an empty feeder | `focus=wear` |
| `upgrades` | Habitat levels 0–3 side by side (Asian Jungle) | `focus=upgrades` |
| `equipment` | Feeder, water point, shelter, heater, cooler, pool, climbing frame, enrichment toy, feeding chute | `focus=equipment` |
| `keeper` | The keeper walking the avenue, and the golf cart with a second keeper in it | `focus=keeper` |
| `dawn`, `dusk`, `night`, `night-start` | Times of day (day is every other shot) | `time=…` |
| `rain`, `snow`, `heat` | Weather looks | `weather=…` |

## What a frame costs

Measured with `__world.perf()` in headless Chrome at 1280×800. Its software renderer makes the milliseconds
meaningless, but draw calls and triangles are what a real GPU would get. The totals include the shadow pass
(Medium and High only).

| View | Low: draws / triangles | Medium | High |
|---|---|---|---|
| Overview (distance 560 m, no animal models) | 111 / 316k | 159 / 505k | 159 / 655k |
| Biomes (130 m, 25 animals in view) | 78 / 270k | 142 / 555k | 142 / 1.12M |
| Keeper close-up (17 m) | 37 / 126k | 63 / 205k | 63 / 370k |

Where it goes, at High:

- **Trees**: 6 draws and 253k triangles, drawn in full in every view (Low: 3 draws and 52k). This is the first
  problem logged in the checklist.
- **Terrain**: 113k triangles in the overview, 40–50k close up (25 chunks, culled by the camera).
- **Enclosures**: 2–4 draws each (solid, rounded, water, glass, plus a roof or net). The overview's 33 placements
  come to 80 draws and 238k triangles, shadows included.
- **Animals**: 643k triangles for 25 animals in the biomes view. Each animal is checked against the camera's
  frustum and hidden in the overview.
- **Keeper and cart**: 14 draws and 10k triangles per pass (each keeper is six small meshes, so the limbs can
  swing).

## Open art questions

These are listed in the milestone 2 report and under "Decisions to review" in [v1-checklist.md](../../v1-checklist.md).
