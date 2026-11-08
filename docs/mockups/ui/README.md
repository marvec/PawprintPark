# HUD and UI mockup (milestone 3)

Page: `/mockups/ui/` (`src/mockups/ui/`), on the dev server. It shows DOM over a static view of the approved world
scene. The data is fake (`fixture.js`), and every piece of text comes from the strings table. No game systems run:
buttons only move between screens.

Screenshots are taken by `bun scripts/ui-mockup-shots.js` with the dev server on :5428. File names are
`<screen>-<variant>-<device>.jpg`:

- **phone**: 390×844 at 2×. Every screen and variant.
- **desktop**: 1440×900. Every screen and variant.
- **phone-land** (844×390) and **tablet** (1180×820): the main screens, which are the HUD, alerts, animal, build,
  shop, stats, Zoopedia, photo, settings and pause.
- `long-*`: the long-text switch (pseudo-Czech, about a third longer), at phone and desktop.
- `cvd-*-warnings-desktop`: the warning icons through protanopia, deuteranopia, tritanopia and greyscale filters.

## Screens

| Screen (`screen=`) | Variants (`variant=`) | PRD | What to look at |
|---|---|---|---|
| `hud` | | §15.2 | Coins, stars, level and XP bar, date, time and weather, speed, reputation paws, the dock (alerts, shop, stats, Zoopedia, menu), goals. Phones get the joystick and action button, and the dock as a column on the right |
| `alerts` | | §15.2 | Alert feed: warnings before they become critical; tap one to quick-travel |
| `warnings` | | §6.2, §19 | Icons floating over the world, and the legend of 9 kinds × 2 levels |
| `animal` | overview, care, about | §6.3 | Stats and happiness breakdown, traits, breeding, family, illness history, compatibility, fact card, actions |
| `chore` | | §4 | Progress ring over the keeper and on the action button, with the XP it gives |
| `controls` | | §4 | Joystick and action button with labels; the key map where there's room |
| `travel` | list, moving | §4 | The "Go to" list, and a trip under way shown from the overview |
| `build` | valid, invalid, selected, sell | §4 | Green or red ghost with its reason; rotate, move, sell; sell confirmation |
| `shop` | animals, food, medicine, enclosures, equipment, facilities, decorations, conservation, stars | §11.5 | Every section, with locked items, seasonal decorations and landmarks |
| `stars` | | §11.6 | "Get stars" packs (free for now) and the one-way exchange to coins |
| `market` | | §11.5, §11.7 | One listing, with bloodline and a choice of enclosure (including a warning about an incompatible one) |
| `stats` | money, visitors, reputation, staff, food, welfare | §11.8 | Charts for the last 12 months and 28 days, complaints, workload against capacity with hiring hints, food days left |
| `staff` | hire, team | §9 | Candidates (quality, speed, wage) and the team, including an unpaid warning |
| `zones` | | §9 | Work zones outlined on the overview, with assignments |
| `goals` | tutorial, goals | §12.2, §15.1 | The neglected-sheep steps with a pointer in the world; the three active goals |
| `tip` | | §15.1 | A one-off tip (joining enclosures) |
| `name` | zoo, animal, baby | §3, §6.3, §6.6 | Naming dialogs, with a suggested random name |
| `levelup` | level, ribbon | §12.1 | Confetti, the unlock card, and the ribbon cutting for a new biome |
| `badges` | | §17.1 | Overview badges: species icon, count, warnings |
| `badge-list` | | §17.1 | A badge's animal list |
| `zoopedia` | all, owned | §14 | Every species: owned with marks, in the market, locked by level, or "Coming soon" |
| `species` | owned, locked | §14 | Species page with bronze, silver and gold marks; a locked silhouette |
| `photo` | frame, taken | §14 | Photo mode with the HUD hidden; the "saved" toast with download and share |
| `settings` | | §19 | Quality, volumes and mute, language, reduced motion, controls help |
| `slots` | normal, full | §18 | Slot picker with storage use, and the nearly-full warning |
| `pause` | | §18 | Pause menu |

Other URL parameters:

- `device=phone|phone-land|tablet|desktop` gives a device-sized stage inside any window; `fit`, the default, uses
  the whole window.
- `long=1` switches on long text.
- `cvd=protan|deutan|tritan|gray` applies a colour-vision filter.
- `touch=0|1` forces touch controls off or on.
- `backdrop=0` turns off the 3D world.
- `quality=` sets the quality tier.
- `ui=0` hides the dev panel.

Keys:

- ←/→ change screen and ↑/↓ change variant.
- Shift+D cycles the device, Shift+L toggles long text, Shift+C cycles the colour filter, Shift+T cycles touch,
  Shift+B toggles the backdrop and Shift+H the panel.
- The game's own hotkeys work as they will in the game: N alerts, B shop, I stats, Z Zoopedia, T quick-travel,
  C photo mode, K staff, G goals, M badges, E or Space the chore, Esc or P the menu, 0–3 speed.
