# Experiment: single-mesh animals (opus, low effort)

Branch `feature/single-mesh-animals-opus-low`, worktree `../PawprintPark-exp-opus-low`. Code in
`src/scene/animals/mesh/`, mockup at `/mockups/single-mesh/`, tests in `tests/meshAnimals.test.js`. The existing
builder is unchanged.

Note on the branch: `develop` only holds the initial commit, and the rest of the project is untracked in the main
checkout. So the first commit on this branch is a snapshot of that working tree (the baseline), and the experiment
is the commit after it. Diff the two commits to see only the experiment.

## Approach: a code-built quad cage, Catmull-Clark subdivided, skinned

Each animal is built the way a box modeller would build it, but in code:

1. **Spine tube.** A lofted tube of 8-vertex rings runs from the rump through the chest, neck and head to the nose,
   and on along the trunk for the elephant. Ring profiles per body plan (`TORSO_RINGS`, `HEADS` in `quadruped.js`)
   come from the existing look sizes (`looks.js`: body, neck, head and snout radii).
2. **Extrusions.** Legs, tail, ears, ossicones and tusks are extruded from quad faces of that tube, so they grow out
   of the surface with no seam. Legs follow per-plan profiles: hoof, cat (with paws) and pachy, with shoulder,
   elbow or stifle, knee or hock, fetlock and hoof rings. Manes are bulges of the neck and head rings. A zebra or
   giraffe crest is a raised top vertex on the neck rings.
3. **Catmull-Clark subdivision** (`subdivide.js`), then projection to the **limit surface**. Two levels on high; one
   level over a denser cage on medium and low. Because every tier is projected to the same limit surface, the tiers
   differ only in tessellation, not in shape.
4. **Everything rides the subdivision.** Each cage vertex carries a data vector: position, one weight per bone, and
   named channels:
   - `S`: the stripe coordinate along the spine, down the legs and along the tail;
   - `UNDER`: belly side;
   - `SNOUT`: distance from the nose;
   - `TAIL`: distance from the tail tip;
   - `MANE`, `RIDGE`, `EAR`, `TIP`, `TUSK`, `LEG`;
   - `PS`: local pattern scale.

   The same affine stencils apply to all of them. Skin weights therefore stay normalised and blend smoothly across
   every joint, with no separate weight-painting step. The coat fields are continuous over the whole surface by
   construction.
5. **Eyes** are closed islands in the same mesh, weighted to an `eyes` bone that scales to blink and sleep. They are
   placed after subdivision, on the head's limit surface, at the support point in the eye's facing direction.
6. **Skinning.** `THREE.SkinnedMesh` with a ~27-bone skeleton:
   - spine: hips → chest → two neck bones → head;
   - eyes and ears;
   - three tail bones and three trunk bones;
   - three bones per leg.

   `animate()` resets every bone to rest each frame and never touches the group.

### Why this approach and not the others

- **SDF + surface nets / marching cubes.** A uniform grid fits badly with giraffe legs (6 cm radius on a 4.5 m tall
  animal). Resolving them needs about 300k cells, and the triangle count follows surface area, not the budget. There
  is also no natural parametrisation for stripes and no good place for skin weights. Decimation in pure JS is slow.
- **Lofting alone** fails where branches meet the body, which is the hard part. The cage with extrusions *is* a
  loft, plus a clean way to branch.
- **Subdivision of a cage** controls the triangle count exactly: cage quads × 4^levels. Topology is clean quads. Skin
  weights and coat coordinates come for free through the stencils. It is also how stylised toy animals are usually
  box-modelled by hand.

### Texturing: a procedural texture evaluated per pixel, no texture memory

I chose not to bake a `DataTexture`, for three reasons:

- A baked colour texture blurs in close-ups. It would have to be an SDF texture to stay crisp.
- It needs a UV unwrap with seams.
- The pattern must vary per individual while geometry is cached per species, sex and age, so a baked texture would
  be per individual (about 64–256 KB each × 150 animals).

Instead, the shared material (`material.js`) paints per pixel:

- **Stripes:** `S` × frequency, with 3D value-noise wobble and width variation, and an edge one pixel wide
  (`fwidth`). Because `S` is a scalar field on one connected surface, stripes cannot meet a seam. They wrap the
  body, ring the neck and legs, and bend smoothly at the haunches.
- **Patches (giraffe):** the existing 3D cellular net, evaluated on the rest-pose `position`, with `PS` making cells
  smaller on the neck, head and legs.
- **Spots (lion cub):** the existing spot field.
- **Markings:** hooves, muzzle, nose, belly, mane, tail tuft, crest, ear insides, ossicone tips, tusks and eyes. Each
  is a signed field over position and channels (in metres where possible). The union's edge is drawn per pixel.
- **Per-individual seed.** Bone 0 of every skeleton is a *seed bone* that no vertex is weighted to. Its offset is
  read in the vertex shader from the bone texture that three.js already uploads per skinned mesh. Result: one
  material, no per-object uniforms (which three.js won't re-upload for a shared `MeshStandardMaterial`), and
  geometry shared between individuals (`buildAnimal(id, { seed, cache: true })`).

## Results

### Metrics

Measured with Bun on macOS (x64). Build times are medians of 7 warm runs and include subdivision, eyes and paint.

**Single mesh**

| species, variant | tier | triangles | build ms | geometry KB | draw calls |
|---|---|---:|---:|---:|---:|
| lion ♂ | high / med / low | 13,056 / 7,968 / 5,696 | 29 / 18 / 12 | 517 / 316 / 226 | 1 |
| lion ♀ | high / med / low | 12,544 / 7,648 / 5,504 | 26 / 22 / 12 | 497 / 303 / 218 | 1 |
| lion cub | high / med / low | 12,544 / 7,712 / 5,504 | 27 / 20 / 14 | 497 / 306 / 218 | 1 |
| plains zebra | high / med / low | 12,928 / 7,360 / 5,184 | 43 / 25 / 18 | 512 / 292 / 206 | 1 |
| zebra foal | high / med / low | 13,184 / 7,488 / 5,248 | 43 / 24 / 13 | 522 / 297 / 208 | 1 |
| reticulated giraffe | high / med / low | 14,208 / 7,456 / 5,504 | 36 / 24 / 18 | 563 / 296 / 218 | 1 |
| asian elephant ♂ (stretch) | high / med / low | 14,208 / 7,904 / 5,664 | 32 / 22 / 13 | 563 / 313 / 225 | 1 |
| asian elephant ♀ | high / med / low | 13,440 / 7,776 / 5,472 | 28 / 18 / 13 | 532 / 308 / 217 | 1 |
| elephant calf | high / med / low | 13,696 / 7,840 / 5,664 | 27 / 17 / 12 | 542 / 311 / 225 | 1 |

**Current builder**

| species | tier | triangles | build ms | geometry KB | draw calls |
|---|---|---:|---:|---:|---:|
| lion ♂ | high / med / low | 29,508 / 18,160 / 10,072 | 30 / 20 / 16 | 1,569 / 1,010 / 601 | 9 |
| zebra | high / med / low | 19,260 / 12,360 / 7,150 | 22 / 15 / 8 | 1,030 / 693 / 433 | 9 |
| giraffe | high / med / low | 26,616 / 17,020 / 9,916 | 24 / 19 / 10 | 1,393 / 928 / 577 | 9 |
| elephant ♂ | high / med / low | 18,240 / 11,716 / 6,880 | 32 / 14 / 8 | 1,009 / 685 / 438 | 10 |

- **Budgets** (aim 15k / 10k / 6k): high is 12.5–14.2k, medium 7.4–8.0k, low 5.2–5.7k. All are under; the tests
  enforce 15.5k / 10.5k / 6.5k.
- **Build time:** 12–43 ms per variant, well under 100 ms and about the same as the current builder. Geometry is
  seed-independent, so the cache per species, sex and age works as intended.
- **Texture memory:** 0 bytes, with no textures at all. The coat lives in per-vertex attributes. Of the 69 bytes per
  vertex, 33 are paint: 3 × RGB8 colours, a float marking field, a float stripe coordinate, and a vec4 pattern
  parameter. A high-tier zebra has 6.5k vertices, so about 210 KB of paint. The vec4 pattern parameter (16 B/vertex)
  is constant per species and could move into the seed bone's unused matrix entries, saving another ~100 KB per
  variant.
- **Draw calls:** 1 per animal (eyes included), down from 9–10. With shadows on, that is 2 including the shadow
  pass, down from 18–20.

### Screenshots

All in `docs/experiments/shots/opus-low/`. In every comparison image the current builder is left of each pair and
the single mesh is on the right.

| | side | front | in-game ¾ | walk |
|---|---|---|---|---|
| lion (♂, ♀, cub) | `lion-side.png` | `lion-front.png` | `lion-game.png` | `lion-walk.png` |
| plains zebra (adult, foal) | `plains-zebra-side.png` | `plains-zebra-front.png` | `plains-zebra-game.png` | `plains-zebra-walk.png`, `plains-zebra-walk-game.png` |
| reticulated giraffe | `reticulated-giraffe-side.png` | `reticulated-giraffe-front.png` | `reticulated-giraffe-game.png` | `reticulated-giraffe-walk.png` |
| asian elephant (stretch) | `asian-elephant-side.png` | `asian-elephant-front.png` | `asian-elephant-game.png` | `asian-elephant-walk.png` |

Extras:

- `reticulated-giraffe-eat.png`, `lion-sleep.png`: deformation in other poses;
- `zebra-closeup.png`, `giraffe-closeup.png`: pattern crispness and continuity across neck, body and legs;
- `zebra-seeds.png`, `giraffe-seeds.png`: four zebras and three giraffes, one shared geometry, different seeds;
- `zebra-wire-high.png`, `zebra-wire-low.png`: topology;
- `zebra-game-low.png`, `zebra-game-medium.png`: the lower tiers;
- `all-game.png`: everything together.

To reproduce: `PORT=5428 bun run dev`, then

```
bun scripts/screenshot.js 'http://localhost:5428/mockups/single-mesh/?species=plains-zebra&view=side&still=1&ui=0&quality=high' out.png
```

The page also takes `pose=`, `builder=old|new`, `wire=1`, `seeds=4` and `zoom=2`. `CDP_PORT` overrides the
debugging port.

## Side-by-side: an honest comparison

### Clearly better

- **Side profile and silhouette.** Legs flow out of the body through a real shoulder and haunch, and taper through
  elbow, knee, cannon, fetlock and a flared hoof. There are no tubes or kinks at the joints. The neck grows out of
  the withers and chest, and the giraffe and zebra read as one body (`*-side.png`). This was the main complaint
  about the current builder, and it is fixed.
- **Deformation.** Joints bend with smooth skinning: knees fold in the walk (`plains-zebra-walk.png`), and the
  giraffe's neck curves in an arc when eating instead of rotating as a straight tube (`reticulated-giraffe-eat.png`).
  The current builder can only rotate rigid segments.
- **Pattern continuity.**
  - Zebra stripes wrap the body, ring the neck and legs, and bend continuously at the haunch and shoulder
    (`zebra-closeup.png`).
  - The giraffe net continues from the chest up the neck and down the legs, with smaller patches on the neck and
    legs, then the cream lower legs and dark hooves (`giraffe-closeup.png`).
  - Edges stay crisp at every zoom (per pixel, `fwidth`).
- **Cost.** One draw call instead of 9–10. On high, 22–56% fewer triangles (elephant to lion) and 44–67% less
  geometry memory, with no texture memory. Per-individual coats share one geometry.
- **Hooves:** dark, flared and distinct, with a crisp edge on a dense crease ring.

### Worse or unfinished

- **Faces.** The current builder's faces are cuter: big round eyes on a round head facing the camera. Mine:
  - hoofed heads are long and point down from the front, and the eyes sit on the sides (`plains-zebra-front.png`,
    `reticulated-giraffe-front.png`);
  - the lioness's head reads a little dog-like;
  - the nose is a plain marking patch, not a shape.

  This is tuning (`HEADS` profiles, eye placement), not a limit of the approach, but it isn't done.
- **The male lion's mane** reads as a hood or collar from the side (`lion-side.png`, `lion-game.png`). Alternating
  ring vertices give only soft lobes. The current builder's ball of tufts reads more like a mane. Better fix: tufts
  as skinned blob islands in the same mesh (as the eyes are). That keeps one draw call.
- **Medium and low tiers** use one subdivision level. Legs become 8-sided and the body 16-sided, which shows in
  silhouettes at close range (`zebra-game-low.png`). A better scheme: two levels on legs and head only, and one on
  the torso. That needs crack-free mixed-level subdivision (doable: subdivide everything once, then refine a region
  and stitch).
- **Close-ups:**
  - stripe edges follow a piecewise-linear field, so they show slight polygonal kinks at extreme zoom;
  - edges *between two markings* (hoof vs cream leg) are only as sharp as the mesh, so they need dense rings;
  - a thin mane crest stripe ends abruptly at the withers.
- **Small parts:**
  - giraffe ossicones are short;
  - the elephant has no domed forehead, smaller ears than the current builder's discs, and no toenails;
  - lion paws are smooth mittens with no toes.

  These are all one more extrusion or ring each.
- **Authoring cost.** New shapes mean planning topology: which face a feature grows from, and `hold` flags so
  resampling keeps those faces. Catmull-Clark also shrinks everything, so profiles take a few visual iterations
  each. The current builder's "place another ellipsoid" is easier to author.
- **Skinning limits.** Linear blend skinning pinches at extreme rotations (sleep folds the forelegs about 2.3 rad).
  At these angles it is acceptable, but dual-quaternion skinning or helper bones would be needed for tighter folds.
- **The seed-bone trick** depends on three.js reading the bone matrices from a texture in the vertex shader. That's
  true for WebGL today. A WebGPU or TSL port would need an equivalent, such as an instanced attribute or a node
  uniform.

## Round 2: every body plan, a real mane, and the details

After the first review the single mesh was judged better overall. Round 2 extends it to all 12 v1 body plans and all
30 species, reworks the lion's mane, and fixes details.

### All 12 body plans

The mockup `/mockups/single-mesh/plans/` is the body-plan mockup (same layout, keys and URL parameters) switched to
the single-mesh builder. `builder=current` or the `M` key switch back, and `tris=1` adds triangle counts to the labels.
Shots: `shots/opus-low/plans/overview.png` and one `row-<plan>.png` per plan, plus close-ups.

| family | file | plans | what's new |
|---|---|---|---|
| quadrupeds | `quadruped.js` | hoof, cat, dog, bear, small, pachy | dog/bear/small torso, leg and head profiles; floppy and long ears; stub, up, curly, bushy, thick and ringed tails; horns, antlers with tines, beard, topknot, wool, back crest; nose pads |
| birds | `bird.js` | bird-walk, bird-perch, penguin | one tube rump → neck → head → beak (cone, flat, hooked, bent); legs with toes, wings, tails (fan, sickle, plume, long) extruded; comb and wattles as islands |
| pinnipeds | `pinniped.js` | pinniped | tube from tail to nose, raised chest for sea lions; fore and rear flippers; ear flaps |
| reptiles | `reptile.js` | lizard, turtle | lizard: one tube tail tip → nose, sprawling legs, crest spikes, dewlap; tortoise: shell as a closed island over a skin tube with column legs |

Each builder returns the same contract (cage, joints, bones, eye spec, `info.kind`), so `index.js` subdivides, skins,
paints and grounds them all the same way. Poses live per family (`animate.js`, `animate-bird.js`,
`animate-pinniped.js`, `animate-reptile.js`): the meerkat sits up as a sentry, the rabbit hops, the flamingo sleeps on
one leg, the penguin waddles, and the tortoise pulls its head in.

**Numbers, all 75 variants:**

- triangles: high 7.8–15.2k, medium 5.6–8.7k, low 4.0–6.2k (the tests enforce 15.5k / 10.5k / 6.5k for every
  variant);
- build: 24–88 ms warm on high, measured while three headless Chromes were rendering (the first round's 12–43 ms
  was on an idle machine);
- geometry: at most 603 KB per variant; textures: none; draw calls: 1 per animal.

### The lion's mane

Round 1 bulged the neck and head rings, so the mane read as a turtleneck, then a hood. Now it is a **ruff**: a
closed, lobed torus of hair, built as an island in the same mesh, so it is still one draw call.

- It is 14 sections around the face. Each section runs from the face's edge out to a tuft, back to a second row of
  tufts behind the head, out again over the shoulders, then into the body. Tuft sizes follow an uneven rhythm, and
  the second row is staggered against the first, so the rim and the side profile are shaggy, not machined. The lower
  half hangs over the chest.
- **Hair paint:** the base shades from mane colour at the roots to dark tips (a smooth per-vertex gradient on `FUR`).
  Dark streaks are the stripe pattern on a coordinate that runs round the face (`AUX`), so they flow out from the
  face and back over the neck. The coordinate wraps under the chin, where the seam is hidden.
- Shots: `lion-mane-front.png`, `lion-mane-side.png`, `lion-mane-game.png`.

It reads as a mane from the front and from the in-game camera. From the side the streaks are still a little too
regular, and the back edge is a fairly clean line.

### Details fixed

- **Noses** are pads on the snout tip (an island placed on the limit surface, like the eyes). Pigs and warthogs get
  a flat disc.
- **Necks:** short, thick necks are one ring, so pigs, tapirs and pandas lose the collar crease. Long necks taper
  into the head, and the neck base stays inside the chest.
- **Markings can see more:** a field gets the eye centres (`eyeDist`, for eye patches and brows), bone weights (whole
  ears), and the head and body sizes. That gives panda patches and the shoulder band, the tapir's saddle, the red
  panda's face, the meerkat's mask and sheep with dark faces and legs.
- **Edges between a marking and the coat** no longer fringe towards another marking's colour: unpainted vertices
  next to a marking take its colour (suggested by the bird builder, where red rings showed round the knees).
- **Ringed tails** compute their bands after the rings are spaced out, so the bands are even.

### Round 3: fixing the weak spots

Everything listed as weak at the end of round 2 was worked on:

- **Medium and low tiers shade smoothly.** Normals now come from the limit surface one subdivision level finer
  (positions only, cheap), so the one-level tiers no longer look faceted. There are no extra triangles
  (`zebra-game-low.png`).
- **Hoofed faces:** shorter muzzles and much bigger eyes, set further forward. A pale ring round the zebra's eyes
  sets them off from the black face stripes (`plains-zebra-game.png`).
- **Polar bear:** the long neck leaves the front of the chest, not its top, and blends in over three eased rings.
  The crease is gone (`plans/bear-polar-game.png`).
- **Lion's mane:** the streaks curl (the coordinate drifts along each section), and the back edge over the
  shoulders is ragged (`lion-mane-*.png`).
- **Pinnipeds:**
  - a domed skull running into the neck, a short muzzle with whisker-pad lobes and a nose pad, and bigger forward
    eyes; the seal has no visible neck;
  - pointed ear flaps that lie back along the skull;
  - the flipper colour starts at the wrist.
- **Lizards:**
  - three-toed feet with dark claws on the Komodo;
  - raised iguana eyes with pale lids;
  - a forked Komodo tongue that flicks out (visible in still shots);
  - the hind thighs no longer bulge above the back.
- **Birds:**
  - Ostrich: scalloped plumage, big drooping white wing plumes, and bare pink drumsticks that narrow into the knee.
  - Macaw: stands upright like a perched parrot, with a broad red-to-blue tail and wings on the flanks showing the
    yellow band and blue feathers.
  - Penguin: the white front is one clean curve.
  - Flamingo: sleeps with a real Z-fold leg tucked under the belly.
  - Chicken: one serrated comb blade on low and medium (no boxy lobes), and no bib on the hen.

**Left as is, on purpose:**
- Lizards have three toes, not five: the iguana is at 15.0k / 6.4k triangles on high and low, against
  budgets of 15.5k / 6.5k.
- In the in-game view a small point of the sea lion's ear still shows when it sleeps.
- The macaw has a soft fold where the wing meets the back.
- Under heavy machine load the busiest variants build in 60–90 ms (target: under 100 ms).

### Round 4: anatomy (mane, hind legs) and lighter meshes

Feedback from reference photos: a lion's mane grows like human hair, starting round the face (sideburns in front of
the ears), and the hind legs run straight down from the rump. Shots in `round4/` (`lion-before-*.png` are the round 3
lion).

- **The mane frames the face.** The ruff is rebuilt as 12 sections. Each section is a loop:
  - The front edge sinks into the face: over the forehead in front of the ears, down the cheeks like sideburns,
    forward along the jaw to under the chin.
  - From there it runs out through short hair to the tufts, back over the neck, and over the shoulders to a ragged
    edge.
  - Every other section reaches further back; subdivision evens such alternation out to about a third, so it is
    drawn large. A thin layer just over the coat carries the hair out to that edge; without it the surface dived
    under the skin early.
  - The lower sections hang down the chest, in front of and between the forelegs, as dark as in the photos.
  - The edge's cage point sits deep in the head, a little ahead of the visible edge. Subdivision pulls the surface back
    towards its neighbours, and a shallow edge left a dark crevice between the face and the hair
    (`lion-face-closeup.png`).
  - The ears grow on a stalk hidden in the hair, so their tops show above the mane. The face and neck no longer bulge
    for the mane.
  - Hair paint: golden at the face, dark at the back and chest.
  - Streaks are wide locks in a darker shade of the local hair colour. They fade out where their coordinate folds
    (the middle of the crown and of the chest), so no bullseye rings form there.
  - Shots: `lion-front.png`, `lion-side.png`, `lion-game.png`, `lion-rear.png`.
- **Hind legs at the rump (all quadrupeds).** The hip rings moved back (−0.58 → −0.8 of the half length). The thigh's
  top ring reaches back by a share of the body length and starts inside the rump, so its back edge runs on down
  from the buttock (`lioness-side.png`, `plains-zebra-side.png`). A test checks the gap (lion, zebra, elephant,
  panda).
  - Heavy, short-legged animals (bears, pigs, elephants, small mammals) scale this by leg length against body depth,
    or the thigh bulges out under the rump.
  - Two latent leg bugs showed up once the legs moved:
    - On short legs the knee ring sat above the leg's top ring, so the leg folded back on itself. Ring heights now
      squeeze in below the top.
    - The top ring tilted towards a far-forward next ring and stood on edge. It now always lies flat.
  - Bears and small mammals get a flat-footed hind leg and a narrower top ring (no cuff standing out from the body):
    `polar-bear-side.png`. The pig loses the disc under its belly: `domestic-pig-side.png`.
- **Fewer vertices.** Every tier lands on the same limit surface, so a tier only decides how finely it is sampled.
  The one-level tiers had much denser cages than they needed, mostly rings along legs and tails where the shape
  doesn't change.
  - Low is now the high cage subdivided once: the same shape, a quarter of the triangles.
  - Medium subdivides once a cage with about twice the rings of high.
  - Tails use sparser rings than legs.
  - The same rule applies in the bird, pinniped and reptile builders (`settings.tier`).

| all 30 species, males | high | medium | low |
|---|---:|---:|---:|
| triangles before | 380,864 | 209,888 | 154,432 |
| triangles now | 380,288 | 129,632 | 95,488 |
| change | 0% | −38% | −38% |

Per species, medium is now 3.2–5.9k triangles (was 5.4–9.4k), and low 2.1–4.1k (was 4.0–6.4k). The lion
is 15.3k / 4.8k / 3.8k; low and medium hold up in the in-game view (`lion-game-medium.png`, `lion-game-low.png`).
Lizard low tiers keep two rings per toe, because one subdivision level doesn't round a single ring into a toe.

The mockup gained a three-quarter **rear** view (`view=rear`).

### Round 5: elephant ears and the warthog's back

Shots in `round5/`.

- **Elephant ears stay outside the body.** The flap pointed back into the shoulder: about 50 of its 233 vertices
  lay inside the body, up to 26 cm deep. Each flap ring is now pushed out until it clears the neck and shoulder at
  every height it covers (`bodyHalfWidth`, from the spine's key rings).
  - The back of the flap follows the neck a little.
  - Elephants turn their heads a third as far in the idle pose, as real elephants do on their short necks.
  - A test poses the elephant (rest, head turned either way) and checks the flap stays out of the body.
  - Before and after: `elephants-before-after.png`.
  - A narrower neck was tried; it pinched the head into a waist.
- **The warthog's back.** There were three problems:
  - The back crest was a 5 cm flat-topped slab, with a dark stripe on it, that stopped short at the shoulders.
  - The ring joining body and neck had no crest, so it dipped between the two.
  - The rings of its short, steep neck tilted back so far that their tops sank into the shoulders. That left a groove
    behind the head (`warthog-before-*.png`). The pig has the same groove.

  The fixes:
  - The mane is now a painted stripe, narrow on the neck and spine and tapering out mid-back, with no raised slab.
  - The warthog gets a wider head (`headScale`, multipliers).
  - The neck rings of pigs and warthogs face along the neck (`alignNeck`), so the back runs smoothly into the head
    (`warthog-side.png`, `warthog-game.png`, `pig-before-after.png`).
  - `alignNeck` is opt-in. Applied to every short, low neck, it made the tapir, pandas, meerkat, otter and fox
    blockier; their tilted rings round the chest into the neck nicely.
  - A test checks that no neck vertex sits behind the shoulders.

## Recommendation: adopt, with changes

Adopt the single-mesh skinned approach for the four-legged plans. It fixes what it was meant to fix: profile, joints
and continuity. It also deforms properly, and it costs a fraction of the draw calls and memory. The remaining
weaknesses are art tuning, not architecture. Changes before rollout:

1. **Faces first.** Rounder crania, shorter muzzles, bigger and more frontal eyes, and an optional eyelid instead of
   eye squash. Nose as a small extruded bump. Approve on the mockup (CLAUDE.md: visuals before systems).
2. **Tufts as islands.** Manes, tail tufts and wool are skinned blob islands in the same mesh, which beats lofted
   bulges.
3. **Mixed-level subdivision** for medium and low: two levels on legs and head, one on the torso.
4. **Move per-species constants** (`pat`) out of the vertex data, into the seed bone or a tiny per-species palette.
5. **Cache templates** per species, sex, age and tier (already supported: `cache: true`). Instantiate individuals by
   cloning the skeleton only. Cheap stand-ins (PRD §17.1) can reuse the low-tier geometry unskinned.

### What a rollout to all 12 body plans would take

*Round 2 update: the plans below are now built (round 2 above). What remains is the "Shared" row, plus art tuning
per species.*

Estimates assume the current cadence: build, then screenshot-driven tuning.

| plans | work | estimate |
|---|---|---|
| hoof, cat, pachy (done here) | Faces, mane islands; per-species extras: horns and antlers (extrusions with tines), warthog tusks, sheep wool (islands), goat beard. | 3–4 days |
| dog, bear, small | New `TORSO_RINGS`, `LEGS`, `HEADS` profiles (paws exist). Meerkat stance and rabbit hop are pose work. Red panda ringed tail is a channel. | 3–4 days |
| bird-walk, bird-perch, penguin | New cage generator: egg body with neck and head tube, beak extrusion, wing flaps extruded from the flanks, thin legs and toes extruded down (or stick legs as islands). Feather colouring via markings. | 4–5 days |
| pinniped | Spine tube with fore- and hind-flipper extrusions. Close to the quadruped code. | 1–2 days |
| lizard, turtle | Lizard: a long spine tube with sideways legs, a natural fit. Turtle: a shell island (rigid, weighted to the body) plus head, neck and legs extruded from a body tube. | 3 days |
| Shared | Mixed-level subdivision, template cache, LOD stand-ins, tests per plan, replacing `src/scene/animals/index.js` behind the same API, retiring the old builder. | 3–4 days |

**Total: about 3–4 weeks** for parity across all 30 v1 species, with art direction approved on the mockup per plan.
The engine part (cage, subdivision, skinning, material, tests) is done; the cost is in profiles and visual tuning.
