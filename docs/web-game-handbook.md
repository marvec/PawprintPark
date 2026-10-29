# Web game handbook: what SynergyTower taught us

Written 2026-10-28 from SynergyTower (168 commits, 9–28 October 2026). It covers the technology, setup and
lessons to carry into the next project:

- a web app that is later wrapped as iOS and Android apps;
- graphics and music generated in code;
- no cookies, with state stored on the device;
- the same hosting setup as SynergyTower.

The C64 port is left out on purpose. Three.js is new, so its section separates what we tried from what is still
untested.

Each section gives the rule first and then the reason, which is usually a bug we hit. File paths point into the
SynergyTower repo, so you can copy the working code from there.

---

## 1. What to keep and what changes

| Area | SynergyTower | Next project |
|---|---|---|
| Runtime and tools | Bun 1.3: dev server, bundler, test runner. No npm dependencies. | Keep Bun. `three` becomes the one dependency: pin an exact version and commit `bun.lock`. |
| Language | Vanilla ES modules, plain JS with JSDoc comments, no framework | Keep |
| Rendering | Canvas 2D at a fixed 480×270, integer-scaled, pixel art | Three.js (WebGL). A 2D canvas or DOM layer for the HUD and text. |
| Art | All drawn in code. No image files apart from icons and the OG image. | All modelled in code: procedural geometry, textures painted on canvases at runtime |
| Audio | WebAudio chiptune tracker and synthesized sound effects. No audio files. | Keep it as it is (`src/engine/audio.js` + `src/data/music.js`) |
| Game logic | Pure modules in `src/core/` with no DOM, seeded RNG, deterministic | Keep, strictly. It is what lets tests and the 3D renderer share the logic. |
| State | localStorage, save slots, mirrored to native storage in the app | Keep |
| Website | GitHub Pages via GitHub Actions; pushing main deploys | Keep |
| API | One Vercel Function (feedback form → Resend email, reCAPTCHA v3) | Keep if you need a contact form |
| Analytics | Cookieless: Cloudflare Web Analytics + Umami, production domain only | Keep |
| Apps | Capacitor 8 shell around the same bundle; platform decided at runtime | Keep |
| Offline | Service worker on the website; files packed inside the apps | Keep |

---

## 2. Repository layout

```
src/
  index.html        page shell: meta/OG/JSON-LD, canvas, sr-only text for crawlers, <script type=module src=main.js>
  main.js           entry: screen, input, audio, game context, main loop, service worker registration
  game.js           game context: state, scene stack (push/pop/set), autosave, toasts
  config.js         public deployment settings (API URL, reCAPTCHA site key): safe to commit
  debug.js          dev-only console helpers, stripped from production builds
  core/             PURE logic, no DOM: economy, state, generators, RNG, pathfinding, save slots
  data/             pure data: text, music, colour tables, content lists
  engine/           browser glue: screen, input, audio, font, UI kit, platform, analytics, reminders
  scenes/           title → setup → game → overlays…
public/             copied as-is: sw.js, manifest, icons, robots.txt, sitemap.xml, llms.txt, og-image.png,
                    static pages (how-to-play/, privacy/)
api/feedback.js     the Vercel Function (Vercel hosts only this folder)
scripts/            build.js (website → dist/), build-app.js (apps → mobile/www), preview.js, buildConfig.js
mobile/             Capacitor project: ios/, android/ committed; www/ built, git-ignored
tests/              bun tests + mock-canvas.js
docs/               design specs, plans, this handbook
server.js           dev server (Bun.serve with HTML routes + public/ fallback)
CLAUDE.md           the living architecture doc (see §15)
```

`package.json` scripts:

```json
"dev": "bun --hot server.js",
"build": "bun scripts/build.js",
"preview": "bun scripts/preview.js",
"test": "bun test",
"build:app": "bun scripts/build-app.js"
```

---

## 3. Dev loop

- **Dev server** (`server.js`): `Bun.serve` with `routes` for each HTML entry (Bun bundles it on the fly with hot
  reload) and a `fetch` fallback that serves `public/`. Folder URLs serve `index.html`, as GitHub Pages does. Reject
  paths containing `..`.
- **Pick fixed, unusual ports** and write them down: game :5317, preview :4317. Port 3000 is taken on Martin's Mac by
  another project. Tools and agents get their own ports too (we used :5318 for a second dev server and :9338 for
  headless Chrome), and nobody kills a process they didn't start.
- **Every port is its own localStorage origin.** Saves made on :5317 are invisible on :5318. Test with the port your
  real save lives on.
- **`bun --hot` sometimes misses a change to a shared module** (seen on SynologyDrive), and the page then mixes old
  and new code (`x is not a function`). Restart the dev server after editing shared engine files.
- **Don't register the service worker on the dev port** (`location.port !== '5317'`), or you will debug stale files.
- **Background tabs pause `requestAnimationFrame`.** Expose `window.__step(frames)` to advance the loop by hand. It
  is essential when an agent drives the page headless.
- **Production preview** (`scripts/preview.js`) serves `dist/` with the service worker active, so offline behaviour
  can be tested before pushing.

---

## 4. Architecture rules that paid off

1. **Pure core.** `src/core/` and `src/data/` never touch the DOM, `window` or canvas. Everything there can be tested
   under `bun test` with no mocks, and a 3D renderer can read the same data a 2D one did. In the 3D experiment the
   whole floor generator moved over unchanged: the Three.js page simply imported `buildFloor(9)`.
2. **Seeded, deterministic generation.** Use `createRng(seed)` (mulberry32) and `hashString` from `src/core/rng.js`
   everywhere, never `Math.random()` in logic. Same seed, same world: tests can check that every station is
   reachable, and saves stay small because generated content is never stored.
3. **Keep the RNG draw order stable.** Generated content depends on the order of RNG calls. A feature added later
   must not draw from the generator's RNG, or every later floor reshuffles. We picked such things "without the RNG"
   (from a hash of the floor number), and when a visual effect was removed we kept its RNG draw.
4. **Economy numbers live in one file** (`src/core/economy.js`), with simulation tests on top (§12).
5. **Scene stack** (`game.push/pop/set`). Overlays set `opaque = false` so the scene below still draws. Dynamic
   `import()` breaks import cycles between scenes. `push`/`pop` consume pending keys and clicks, so one press never
   lands on two scenes.
6. **The main loop clamps dt**: `dt = max(0, min(0.05, (t - last) / 1000))`. The first rAF timestamp can come before
   `performance.now()` at start-up, and a long stall must not teleport anything.
7. **Separate wall-clock timers from play-time timers, and decide for each one.** Regeneration that continues while
   you are away runs on wall-clock (`Date.now()`, via `game.now()` so tests and the console can fake the date). Timed
   challenges run on scene dt, so pausing stops them. Pausing a wall-clock stay must push its `endsAt` back
   (`holdClocks`), or the pause menu costs the player time.
8. **The mini-game contract** (`create({ difficulty, rng, theme, sfx, player })` → `update(dt, input)`,
   `render(g)`, `done`, `score`) made over 50 games testable the same way. Any system with many pluggable parts
   deserves a contract like that, plus a `peek()` that exposes answers to tests.
9. **Bake static things once.** Static scenery was drawn into offscreen canvases (`bake()`) and blitted each frame.
   In 3D the same rule means building geometry and textures once, merging static meshes and reusing materials.

---

## 5. Graphics

### 5.1 Lessons from Canvas 2D (still apply to the HUD and 2D layers)

- Fixed logical resolution (480×270), `imageSmoothingEnabled = false`, `image-rendering: pixelated`, and an integer
  scale whenever the window allows it (`src/engine/screen.js`).
- `screen.fit()` uses the **visual viewport** (it shrinks when a phone keyboard opens) and subtracts the body's
  safe-area padding. It runs again on `resize`, `orientationchange` (after 250 ms, because phones report the new size
  late) and `visualViewport` resize. DOM overlays (text inputs) subscribe to `onFit`, or the iOS keyboard leaves them
  misplaced.
- `toGame(clientX, clientY)` converts pointer coordinates with `getBoundingClientRect()` at the moment of the event.
- Text uses a bitmap font drawn in code (`src/engine/font.js`). A test fails when a string contains a character with
  no glyph. Real text fields are DOM `<input>`s placed over the canvas; canvas text fields are miserable on phones.
- Art style is documented with approved mockups (`docs/minigame-visuals/`). Approving a style on mockups first and
  then implementing it saved rework.

### 5.2 Three.js: what we tried (17 October 2026)

`docs/concepts/realistic.html` (deleted afterwards; its source survives in session `f28cd267-…`) rendered the real
`buildFloor(9)` at 1920×1080 in about an hour of work:

- Three **0.160.0** through an import map from jsDelivr (`three` + `three/addons/`).
- `WebGLRenderer` with `shadowMap.type = PCFSoftShadowMap`, `ACESFilmicToneMapping`, `setPixelRatio(1)`.
- Image-based lighting **with no HDR file**: `PMREMGenerator.fromScene(new RoomEnvironment(), 0.04)`.
- `RoundedBoxGeometry` for furniture. Everything was modelled in code from the floor data.
- Post-processing: `EffectComposer` → `RenderPass` → `GTAOPass` (ambient occlusion) → `UnrealBloomPass`
  (glowing monitors) → `OutputPass`.

What we learned:

- **The world carried over easily; the people did not.** Code-built rooms and furniture looked good. Code-built people
  looked like mannequins. Convincing humans need rigged, animated models, which breaks the "no asset files" rule and
  grows the download from about 1 MB to 50–200 MB. **Pick a style that code-built geometry can carry**: stylized or
  low-poly, voxel, toy-like or abstract characters, or no humans at all.
- Post-processing (GTAO + bloom) is what made it look "real", and it is also the first thing phones can't afford.

### 5.3 Three.js: recommended setup (not yet proven in a shipped game)

- **Bundle `three` from npm** (`bun add three@<exact>`) rather than loading it from a CDN. The game must work offline
  and inside the app, and a CDN import map does neither. Import addons from `three/examples/jsm/...` (or
  `three/addons/...`) so Bun bundles them.
- **No asset files, the 3D way:**
  - Geometry: built-in primitives, `ExtrudeGeometry`/`LatheGeometry`/`TubeGeometry`, merged with
    `BufferGeometryUtils.mergeGeometries`.
  - Textures: paint them on an offscreen canvas and wrap it in `CanvasTexture`, or generate a `DataTexture`.
    Repeat small tiles; set `colorSpace = SRGBColorSpace` on colour maps.
  - Lighting: `RoomEnvironment` + PMREM instead of HDR files.
  - Fonts and HUD: keep the 2D bitmap font on a 2D canvas layer over the WebGL canvas, or use DOM. Also usable as a
    `CanvasTexture` on in-world signs.
  - Characters: build them from primitives grouped into a hierarchy and animate them in code (bob, swing limbs with
    sines), like the 2D `figure.js` poses.
- **Keep the scene builder separate from the renderer.** Write `buildScene(worldData)` so it returns plain
  `THREE.Object3D` trees; that runs under `bun test` without WebGL. The renderer, composer and canvas live in
  `engine/`. Test the builder: object counts, positions, that every station has a mesh, that nothing is NaN.
- **Quality tiers from day one:**
  - cap `setPixelRatio(Math.min(devicePixelRatio, tier.maxDpr))`;
  - shadows on or off, and the shadow map size;
  - post-processing on or off;
  - pick a default tier with `isTouch()` and the measured frame time, and offer a setting.
  - Phones (especially older iPhones) are GPU- and memory-bound. Test on a real device early.
- **Clean up:** `dispose()` geometries, materials, textures and render targets on scene changes. iOS kills WebViews
  that leak GPU memory.
- **Handle `webglcontextlost`/`webglcontextrestored`** (common on mobile after backgrounding): pause on loss, rebuild
  GPU resources on restore.
- **Pause rendering in the background** (`onAppState`). It saves battery, and iOS throttles you anyway.
- **Screenshots**: `renderer.domElement.toDataURL()` returns a blank image unless you call it in the same task as
  `render()` or create the renderer with `preserveDrawingBuffer: true` (slower, so only for capture mode). Headless
  Chrome needs software GL (`--use-angle=swiftshader` / `--enable-unsafe-swiftshader`) for WebGL; Playwright's
  Chromium handled the concept render.
- `reducedMotion()` (prefers-reduced-motion) should calm camera shake, sway and fast pans, as the 2D game did.

---

## 6. Audio: synthesized, no files

Copy `src/engine/audio.js` and the format in `src/data/music.js`. Both work as they are.

- **Tracker format**: songs are data. They have `bpm`, `swing`, a chord list (one per bar, 16 steps per bar),
  bass/arp/comp templates as indexes into chord tones, drum strings (`k s h o r .`), and melody tokens (`C5`, `-`
  hold, `.` rest). Optional `bassLine`, `comp.pattern`, `drums` per bar, chord `N`, `leadDouble`.
  `compileSong()` is pure and tested.
- **Synthesis**: oscillators with gain envelopes, custom pulse waves via `createPeriodicWave` (12.5% and 25% duty),
  and a white-noise buffer through biquad filters for the drums. A look-ahead scheduler (`setInterval(pump, 25)`)
  schedules about 150 ms ahead on `ctx.currentTime`.
- **Buses**: master → music gain + SFX gain, so music and sound effects toggle separately (`setTargetAtTime` ramps,
  no clicks). Continuous sounds (the car's hum) go on the SFX bus so the sound setting mutes them.
- **Unlock on the first gesture**: create or resume the `AudioContext` on the first `pointerdown`/`keydown`.
  Remember the `wanted` song and start it on unlock, so the title music begins on the first click.
- **iOS**: the context is left `interrupted` after a phone call or the app switcher. On coming back, `resume()` when
  `state !== 'running'`. Suspend in the background (`audio.background(hidden)`).
- **Syncing gameplay to music**: the scheduler starts `SONG_LEAD` (0.05 s) after `play()`. A rhythm game restarts its
  song with `play(name, null, { restart: true, from: playT })` whenever play starts or resumes, so the beat and the
  game clock agree after a pause.
- Transcribing real songs into the format worked (the car radio's covers), but the source mp3 was never committed.

---

## 7. Input

`src/engine/input.js`: one input object, polled per frame.

- Keyboard state (`down`), per-frame presses (`pressed`), typed characters, an ordered `keySeq()` for text UIs
  (characters and Enter can land in the same frame), a pointer in game coordinates with
  `clicked/released/moved/inside/touch`, and the wheel.
- WASD alias the arrow keys; `pressedExact` exists for letter hotkeys, so `w` is not "up" there.
- `preventDefault` on arrows, Space and Tab; `blur` clears every key (otherwise keys get stuck after an alt-tab);
  `setPointerCapture` on `pointerdown`; `contextmenu` blocked.
- Every interaction works by keyboard **and** mouse/touch. Hints come in a key version and a tap version
  (`isTouch()`). Buttons forgive taps that miss by a few pixels (`TOUCH_SLOP`). Arrow keys in menus move by screen
  position (`spatialStep`), so any button layout works without a column count.
- Android's back button is fed in as Escape (§9).
- A scene can set `capturesKeys` to switch global hotkeys off while it needs every letter (`M` toggled the music
  during typing games until we added this).

---

## 8. State and saves (no cookies, nothing leaves the device)

- **Saves are JSON in localStorage** under a namespaced prefix (`synergytower.`). Use a **slot store**
  (`src/core/slots.js`, pure, works on any `getItem/setItem/removeItem`): each save under its own key plus a small
  index of summaries, so a picker never parses every save. Up to 100 slots.
- **Every storage call sits inside try/catch.** localStorage throws when site data is blocked or full. The game keeps
  running unsaved instead of crashing.
- **Versioning by merging defaults**: `deserialize` builds a fresh default state and shallow-merges the save over it
  (nested objects like `settings`, `stats`, `flags` merged one level down), then patches specific old shapes. Saves
  from day one still load. Give fields from older saves an explicit meaning (e.g. `-1` = "not counted back then").
- **Autosave**: mark the state dirty and save on a throttle. Also save immediately on `pagehide` and when the app goes
  to the background.
- **The app mirrors saves to native storage** (Capacitor Preferences) and restores them at start-up, because **iOS
  may clear a WebView's localStorage** under storage pressure (`gameStorage()` / `restoreStorage()` in
  `src/engine/platform.js`).
- **iOS gives a Home Screen PWA its own storage**, separate from Safari's, so tell players their Safari save won't
  follow them.
- Never store generated content. Store seeds and decisions, and regenerate the rest.

---

## 9. One bundle, every platform (`src/engine/platform.js`)

**Never branch on build flags for platform behaviour.** The same JS runs as a website, an installed PWA and inside
the Capacitor apps; it asks at runtime:

- `isNative()` / `os()`: `window.Capacitor?.isNativePlatform()`. The web bundle has **no npm dependency on
  Capacitor**: it talks to the bridge Capacitor injects. `plugin(name)` returns `Capacitor.Plugins[name]` (or
  `registerPlugin(name)`) or null. Native plugin packages live only in `mobile/package.json`.
- `isTouch()` (`pointer: coarse`), `isStandalone()` (display-mode standalone/fullscreen), `isIosBrowser()` (iPads
  report "Macintosh", so check `maxTouchPoints > 1`).
- `features.*` getters for what each build may show. **The app stores ban links to outside payments** (tip jar),
  fake checkout screens next to their billing, and badges for other stores, so the app hides all three.
- `openExternal(url)`: a new tab on the web, the in-app browser (`Browser` plugin) in the app. Never `window.open`
  directly.
- `onAppState(fn)`: the `App` plugin's `appStateChange` in the app, `visibilitychange` on the web.
- `haptic(kind)`: a short buzz on mistakes, crashes and level-ups in the app; follows the sound-effects setting.
- `initPlatform()`: `data-platform` and `touch`/`standalone` classes on `<html>` for CSS, hides the splash screen, and
  maps Android **back** to Escape (the app never quits by accident).

### Phones in a browser

- Viewport: `width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no`.
- CSS on html/body: `touch-action: none; user-select: none; -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent; overscroll-behavior: none; overflow: hidden`.
- Safe areas: pad the body with `var(--safe-area-inset-*, env(safe-area-inset-*, 0px))`. Capacitor's `SystemBars`
  sets the CSS variables where Android's WebView reports `env()` wrongly. `screen.fit` reads that padding.
- Landscape game in portrait: a "turn sideways" card (CSS media query: portrait + coarse + narrow) with a "Play
  upright" option that puts the HUD in a DOM dock under the game.
- Android browsers: the first tap requests full screen with `navigationUI: 'hide'` and locks landscape (once per page
  load). iPhone Safari has no full-screen API; installing to the Home Screen is the only way there.
- **PWA install**: catch `beforeinstallprompt` (preventDefault, keep it), offer your own "Install app" button, and
  show the Share → Add to Home Screen steps on iOS. Hide the button when installed or native.

---

## 10. The mobile apps (Capacitor 8)

Setup (`mobile/`, see `mobile/README.md` for the full version):

```bash
cd mobile && npm install           # Capacitor CLI + iOS/Android runtimes + plugins
npm run sync                       # bun ../scripts/build-app.js → www/, then cap sync
npm run ios | npm run android      # sync and open Xcode / Android Studio
sh icons.sh                        # icons + splash from public/icon.svg (rsvg-convert + ImageMagick)
```

- `scripts/build-app.js` builds **only the game** (no service worker, no guide or feedback pages) into
  `mobile/www`, with the same production `define`. Copy in the icons and manifest.
- Plugins used: `app`, `browser`, `haptics`, `local-notifications`, `preferences`, `splash-screen` (+ core,
  ios, android, cli).
- `capacitor.config.json`:
  - `ios.contentInset: "never"`, `scrollEnabled: false`;
  - `SystemBars` with `insetsHandling: "css"`, `hidden: true`;
  - `SplashScreen` with `launchShowDuration: 0`;
  - `LocalNotifications` small icon and colour;
  - `backgroundColor` matching the page.
- Landscape lock: iOS `Info.plist`; Android `screenOrientation="sensorLandscape"`.
- **Reminders**: local notifications scheduled when the app goes to the background. Use `isExactNotification: false`
  (Google Play restricts exact alarms) and move ones due at night to the morning. On the web they are plain
  notifications that fire only while the tab is open in the background; a closed tab would need Web Push and a server.
  Keep them rare: at least 5 minutes away, at most 3 a day, none from 22:00 to 08:00, opt-in only.
- **Feedback form in the app**: reCAPTCHA only works on the website's domain, so the app opens the website's
  `/feedback/` page in the in-app browser.
- **Analytics in the app**: the WebView is served from localhost, so allow Umami explicitly when `isNative()`, tagged
  `app-ios`/`app-android`. Leave Cloudflare out.
- Store submission checklist:
  - Signing: Xcode "Automatically manage signing"; Android upload key in a git-ignored `keystore.properties`,
    `./gradlew bundleRelease`.
  - Bump the version and build numbers for every upload.
  - Privacy labels: "usage data, not linked, not tracking" and "app activity, not shared".
  - Privacy policy URL.
  - Age rating: we ticked mild alcohol references.
  - `ITSAppUsesNonExemptEncryption = false`.
  - Guideline 4.2 (minimum functionality) is met by a full offline game with notifications and haptics.
- Device testing: `./gradlew assembleDebug && adb install -r …`; debug builds can be inspected from desktop Chrome at
  `chrome://inspect`.
- Xcode 26 needs the matching iOS platform downloaded (Settings → Components) before it builds for a device or
  simulator.

---

## 11. Website deployment and services

### Hosting: GitHub Pages via Actions (`.github/workflows/pages.yml`)

- On push to `main`: checkout → `oven-sh/setup-bun@v2` (bun 1.3.x) → **`bun test`** → `bun run build` →
  `upload-pages-artifact` (`dist/`) → `deploy-pages`. **Failing tests block the deploy**, and that is on purpose.
- Use current action versions (we moved to checkout v7, upload-pages-artifact v5 and deploy-pages v5 when Node 20 was
  deprecated).
- **CI runners are slower than your Mac.** Bun's default test timeout is 5 s; heavy rendering tests passed locally and
  timed out in CI, so three deploys failed silently. Give heavy tests an explicit timeout, and **check the Actions
  tab after pushing**.
- **Use relative URLs** (`./sw.js`, `./manifest.webmanifest`) so the site also works under a subpath (the
  `user.github.io/repo/` preview) as well as on the custom domain.
- Pushing `main` deploys production. Work so that `main` is always shippable.

### The build

```js
// scripts/build.js
await Bun.build({ entrypoints: ['./src/index.html', /* other pages */], outdir: './dist',
  minify: true, sourcemap: 'linked', define: { __DEV__: 'false' } });
await cp('public', 'dist', { recursive: true });
```

- Every HTML page is an entrypoint (the game, `/feedback/`, …). Static pages that need no bundling (the player guide,
  the privacy policy) live in `public/`.
- **Bun's HTML bundler rewrites `<link href>` and `<script>` tags**, so the manifest and icon links, and third-party
  scripts (analytics, reCAPTCHA), are **injected at runtime** from `main.js`.
- `define: { __DEV__: 'false' }` plus `if (typeof __DEV__ === 'undefined' || __DEV__) import('./debug.js')` keeps
  cheat helpers out of production. A test builds the bundle and asserts that they are absent (§12).

### Service worker (`public/sw.js`)

- **Page navigations: network-first**, falling back to the cache only when offline. We learned this the hard way: a
  cache-first worker on `localhost:<port>` keeps serving this game to whatever app runs on that port next.
- Hashed assets: stale-while-revalidate. Skip large downloads.
- `skipWaiting()` + `clients.claim()`; delete old caches on activate; **bump `CACHE`** whenever caching behaviour
  changes.
- `notificationclick` focuses or reopens the game.
- Only the website registers it (`features.serviceWorker`); the app ships its files inside the package.

### Feedback form (optional)

- A DOM overlay (`src/engine/feedback.js`): real form fields, topics, optional email (required for sponsorship).
- **reCAPTCHA v3 is loaded lazily** when the form first opens: the only third-party script, and it never loads for
  players who don't use the form. Hide the floating badge and show Google's notice text instead.
- `api/feedback.js` (Vercel Function, `POST` + `OPTIONS`):
  - CORS allow-list of origins (production, the github.io URL, both localhost ports);
  - checks input lengths and the email format;
  - verifies the token (`success`, `action === 'feedback'`, `score ≥ 0.5`);
  - emails the message via the Resend API with `reply_to`.
- Secrets live in Vercel env vars (`RECAPTCHA_SECRET`, `RESEND_API_KEY`, `FEEDBACK_TO`, optional `FEEDBACK_FROM`,
  `ALLOWED_ORIGINS`). Public keys and the URL go in `src/config.js`.
- The Vercel project hosts **only the API**: `vercel.json` with `framework: null`, empty build, and `.vercelignore`
  excluding `src/`, `tests/`, `docs/` and the rest. It runs on a subdomain (`api.<domain>`).

---

## 12. Testing

- **`bun test`, no frameworks.** Every test in CI gates the deploy. `MG=inbox,quiz bun test tests/minigames.test.js`
  style env filters let you run a subset.
- **Pure core = plain tests.** Generators (every station reachable, the spread of games across floors), economy,
  state transitions, save migration, slot store (with a `Map`-backed storage), the RNG.
- **Headless rendering with a mock canvas** (`tests/mock-canvas.js`): a `Proxy` 2D context where every method is a
  no-op, except a few that behave like the real thing. `drawImage(undefined)` throws, which caught real bugs.
  `installMockDocument()` provides `document.createElement('canvas')`. `recordingCanvas()` records every `fillRect`
  with its colour and alpha, so art tests can assert "the ash darkens near the limit" or "the wreath has berries".
- **Smoke tests**: every mini-game, at four difficulties and several themes, gets 300 s of random keys and clicks.
  It must finish with a score in [0, 1] and never throw.
- **Perfect-player and idle-player tests**: games expose `peek()` (the answers), a scripted perfect player must reach
  ≥ 0.85 and a random one about 0.
- **Simulation tests for balance**: an "average 2-star player can always afford the next floor" test and a 40-floor
  career simulation for pacing. Re-run them after every tuning change.
- **Bundle tests**: build with the production `define` and assert the dev helpers are absent; build without it and
  assert they are present (so the test can't pass vacuously).
- **Content tests**: every string renders with the bitmap font; every furniture type has at least 20 quips; every
  registered game has a title.
- **Mutation-check important tests**: break the code on purpose and watch the test fail. A test that still passes
  against broken code proves nothing. The art-nit fixes were checked this way.
- For 3D: test the scene builder's output (`Object3D` trees) under `bun test`; keep WebGL out of unit tests.
- Fake the clock with `game.now = () => …` for anything date-based (the December party was tested in October that
  way).

---

## 13. Privacy, analytics, legal

- **No cookies, no accounts, no identifiers.** Saves never leave the device. Say so plainly in the README, on a
  privacy page (`public/privacy/index.html`, linked from the in-game settings and the store listings) and in the store
  privacy labels. **Update all three whenever something new leaves the device.**
- **Analytics** (`src/engine/analytics.js`):
  - Cloudflare Web Analytics counts visits; Umami counts visits plus named gameplay events
    (`track('task_played', { game, stars })`).
  - Both are cookieless, with no consent banner needed.
  - Loaded **only on the production hostnames** (and in the app), so dev servers, previews and tests send nothing.
  - Events sent before the script loads are queued (max 50).
  - `track()` never throws, and blocked scripts never affect the game.
  - Keep a list of event names and fields in CLAUDE.md. It becomes the analytics schema.
- Payments: SynergyTower's were **fake** and labelled DEMO, on the website only. Real in-app purchases would need
  StoreKit / Play Billing, and the stores ban outside payment links in apps.
- License: GPL-3.0-or-later (a `LICENSE` file, a README section, `"license"` in `package.json`).
- Third-party IP: no real brands in-game (fake ads with invented brands). For music covers, only use songs in the
  public domain, or covers you have the rights to.

---

## 14. SEO and sharing

- `src/index.html`:
  - title and description;
  - canonical URL, `apple-touch-icon`, `theme-color`;
  - Open Graph and Twitter cards;
  - JSON-LD (`VideoGame` with genre, platforms, `offers` price 0, author, `codeRepository`);
  - a `.sr-only` `<main>` with the game's description and links. The game is a canvas, so crawlers and screen
    readers need this text;
  - a `<noscript>` note.
- **OG image** (1200×630): a real screenshot. **Put a version in its URL** (`og-image.png?v=2026-10-17`) and bump it
  whenever the image changes. Slack, Discord, Facebook and LinkedIn cache images by URL.
- `public/robots.txt` that welcomes search engines and named AI crawlers; `sitemap.xml`; **`llms.txt`** describing what
  the canvas can't show (facts, controls, content list). Update it when content changes.
- A static, illustrated **player guide** (`public/how-to-play/`) with real screenshots:
  `canvas.toDataURL()` at native size, scaled 2× nearest-neighbour, captured from the dev server with headless Chrome.
  It was good for players, SEO and store screenshots alike. Re-take the screenshots when visuals change.
- `manifest.webmanifest`: `id`, relative `start_url`/`scope`, `display: fullscreen` with `display_override`,
  orientation, colours, SVG + 192/512 PNG + a **maskable** 512 icon.

---

## 15. Working with Claude Code

- **CLAUDE.md is the living architecture doc.** It covers the commands, layer rules, conventions, gotchas, every
  feature's key files and state keys, the debug helpers, and the analytics events. Update it in the same commit as
  the feature. SynergyTower's grew to about 40 KB and was the main reason later sessions stayed consistent.
- **Big features go through a spec, then a plan** (`docs/superpowers/specs/…-design.md` →
  `docs/superpowers/plans/…md`), then implementation with tests and a fresh-context review. Small changes are
  discussed in chat.
- **Approve visuals on mockups first** (a mockup page per style), then implement. Keep the approved mockups as the
  reference.
- **Dev-only console helpers for every feature** (`__mg('game', 0.7)`, `__trip()`, `__party('hall')`, …) in
  `src/debug.js`. They let you and the agent jump straight to any state for screenshots and testing.
- House rules that worked:
  - commit only when asked; pushing `main` deploys, so push only on "push";
  - never stash or switch branches in a shared working tree (parallel sessions share it);
  - don't kill processes you didn't start; tools get their own ports;
  - don't read `.env`;
  - commit messages describe the change for players and developers in full sentences, with the
    `Co-Authored-By` / `Claude-Session` trailers.
- Lessons from Martin's notes:
  - try wild prompts and different effort levels;
  - **throw away a bad result and start again** rather than patching something that is 80% there;
  - publishing (domain, offline support, feedback form, analytics, previews, SEO, mobile) is a project of its own,
    so budget for it;
  - **constraints helped**: no asset files kept the game small and portable.

---

## 16. Gotchas, collected

| Symptom | Cause / fix |
|---|---|
| `x is not a function` after an edit | `bun --hot` missed a shared module: restart the dev server |
| Save "gone" | Different port = different origin; or iOS Home Screen app vs Safari; or iOS cleared the WebView (mirror to Preferences) |
| Another localhost app shows the old game | A cache-first service worker on that port: network-first navigations, no SW on the dev port |
| Manifest or scripts missing from the build | Bun's HTML bundler rewrote the tag: inject at runtime |
| No sound on mobile | AudioContext needs a user gesture; iOS leaves it `interrupted` after calls: `resume()` on return |
| Music and rhythm game drift after a pause | Restart the song from the game's play time (`restart`, `from`) |
| Stuck keys after alt-tab | Clear key state on `blur` |
| Keypress handled by two scenes | Consume keys and clicks on scene push/pop |
| Typing a letter triggers a global hotkey | `capturesKeys` on the scene; `pressedExact` for letter hotkeys |
| Text input misplaced when the iOS keyboard opens | Re-fit on `visualViewport` resize; overlays follow `onFit` |
| Notch covers the game | `viewport-fit=cover` + safe-area padding; Capacitor's `SystemBars` CSS vars on Android |
| Deploy didn't happen | CI tests failed (slower runner, 5 s timeout): check Actions after every push |
| Old preview image in Slack/Discord | Version the OG image URL |
| Pause menu costs time | Push wall-clock deadlines back while paused |
| A new feature reshuffled generated levels | It drew from the generator's RNG: derive it from a hash instead |
| Weird glyphs or boxes | A character with no glyph in the bitmap font: the font test catches it |
| Store rejection risks | Outside payment links, fake checkouts, exact alarms, missing privacy policy |
| Background tab "frozen" during automation | rAF paused: drive it with `__step()` |
| A test passes but proves nothing | Mutation-check it; assert on recorded draw calls, not on "no exception" |

---

## 17. Day-one checklist for the new project

1. `bun init`, `"type": "module"`, scripts as in §2. `bun add three@<exact>`; commit `bun.lock`.
2. Copy and adapt from SynergyTower:
   - `server.js`, `scripts/build.js`, `scripts/buildConfig.js`, `scripts/preview.js`, `scripts/build-app.js`;
   - `src/core/rng.js`, `src/core/slots.js`, and the `serialize`/`deserialize` pattern from `state.js`;
   - from `src/engine/`: `input.js`, `audio.js` + `src/data/music.js`, `platform.js`, `analytics.js`, `install.js`,
     `reminders.js` + `src/core/reminders.js`, `feedback.js`, `font.js` (if a bitmap HUD font fits);
   - `public/sw.js` (new `CACHE` name), the `manifest.webmanifest` shape;
   - `api/feedback.js`, `vercel.json`, `.vercelignore`;
   - `.github/workflows/pages.yml`;
   - `tests/mock-canvas.js`, `tests/devOnly.test.js`;
   - `mobile/` (`capacitor.config.json`, `package.json`, `icons.sh`, README). Run `npx cap add ios` /
     `npx cap add android` fresh with the new app id rather than copying the native projects.
3. Pick the dev and preview ports; put them in CLAUDE.md and the CORS allow-list.
4. Decide the 3D art direction around code-built geometry (§5.2), and approve it on a mockup page before building
   systems.
5. Write CLAUDE.md on day one: the layer rules (pure core), the commands, the ports, the contract for pluggable
   parts, the "no asset files" rule, the platform rule ("never branch on build flags").
6. Set up the domain (GitHub Pages custom domain; `api.` subdomain on Vercel), Cloudflare Web Analytics and Umami
   site ids, the reCAPTCHA v3 keys and Resend. Create the privacy page before the first public release.
7. A first test suite: core determinism, a scene-builder test, the bundle-strips-dev-helpers test, a smoke test of the
   main loop with random input.
8. Push, and watch the first Pages deploy go green.
