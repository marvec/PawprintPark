// The HUD and UI mockup (milestone 3): every screen renders from the fixture with all text from the strings table,
// in English and in the long-text (pseudo-Czech) mode; the icons and the fixture hold together.

import { describe, expect, test } from 'bun:test';
import { createStrings, stretchText } from '../src/core/strings.js';
import { STRINGS } from '../src/data/strings.js';
import { SPECIES } from '../src/data/species.js';
import { FIXTURE, overviewBadges, TIER_LEVEL, xpToNext } from '../src/mockups/ui/fixture.js';
import { icon, ICON_NAMES, WARNING_KINDS, WARNINGS, warningIcon } from '../src/mockups/ui/icons.js';
import { HOTKEYS, renderScreen, SCREEN_IDS, SCREENS, speciesName } from '../src/mockups/ui/screens.js';
import { showcaseWorld } from '../src/mockups/world/layout.js';

const badges = overviewBadges(showcaseWorld().placements);
const SPECIES_IDS = new Set(SPECIES.map((s) => s.id));

/** A `t` that records keys and fails on any key missing from the English table (species names fall back by design). */
function strictT({ long = false } = {}) {
  const base = createStrings('en', undefined, { long });
  const used = new Set();
  const missing = new Set();
  const t = (key, params) => {
    used.add(key);
    if (!(key in STRINGS.en) && !key.startsWith('species.')) missing.add(key);
    return base.t(key, params);
  };
  return { t, used, missing };
}

/** Every screen × variant × touch, rendered. */
function renderAll({ long = false, layout = 'desktop' } = {}) {
  const s = strictT({ long });
  const out = [];
  for (const screen of SCREENS) {
    for (const variant of screen.variants ?? ['']) {
      for (const touch of [false, true]) {
        const r = renderScreen({ t: s.t, long, data: FIXTURE, variant, layout, touch, badges }, screen.id);
        out.push({ id: screen.id, variant, touch, html: r.html });
      }
    }
  }
  return { ...s, out };
}

describe('UI mockup screens', () => {
  test('the screen list covers everything milestone 3 asks for', () => {
    const wanted = ['hud', 'alerts', 'warnings', 'animal', 'chore', 'controls', 'travel', 'build', 'shop', 'stars', 'market', 'stats', 'staff', 'zones', 'goals', 'tip', 'name', 'levelup', 'badges', 'badge-list', 'zoopedia', 'species', 'photo', 'settings', 'slots', 'pause'];
    for (const id of wanted) expect(SCREEN_IDS).toContain(id);
    expect(new Set(SCREEN_IDS).size).toBe(SCREEN_IDS.length);
    // Build mode shows the ghost in both states, plus rotate, move and sell.
    expect(SCREENS.find((s) => s.id === 'build').variants).toEqual(['valid', 'invalid', 'selected', 'sell']);
    // The shop has every section of PRD §11.5.
    expect(SCREENS.find((s) => s.id === 'shop').variants).toEqual(FIXTURE.shop.sections);
  });

  test('every screen and variant renders, with every string key in the table', () => {
    const { missing, out } = renderAll();
    expect([...missing]).toEqual([]);
    for (const r of out) {
      expect(r.html.length).toBeGreaterThan(100);
      // No unfilled placeholders and no raw keys leaking through.
      expect(r.html).not.toMatch(/\{[a-z]+\}/i);
      expect(r.html).not.toContain('undefined');
      expect(r.html).not.toContain('NaN');
    }
  });

  test('long text stretches what the screens show, and still fills every placeholder', () => {
    const plain = renderAll();
    const long = renderAll({ long: true });
    expect([...long.missing]).toEqual([]);
    const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    let a = 0;
    let b = 0;
    for (let i = 0; i < plain.out.length; i++) {
      a += text(plain.out[i].html).length;
      b += text(long.out[i].html).length;
      expect(long.out[i].html).not.toMatch(/\{[a-z]+\}/i);
    }
    // About a third longer overall (numbers and names don't stretch).
    expect(b / a).toBeGreaterThan(1.2);
    expect(b / a).toBeLessThan(1.5);
  });

  test('a screen keeps the HUD it asks for, and touch adds the joystick and action button', () => {
    const { t } = strictT();
    const ctx = { t, long: false, data: FIXTURE, variant: '', layout: 'phone', badges };
    const hud = renderScreen({ ...ctx, touch: true }, 'hud').html;
    expect(hud).toContain('class="hud-top"');
    expect(hud).toContain('class="hud-dock"');
    expect(hud).toContain('class="joystick"');
    expect(hud).toContain('class="action"');
    expect(renderScreen({ ...ctx, touch: false }, 'hud').html).not.toContain('class="joystick"');
    // Full-screen menus hide the HUD; the chore ring sits on the action button.
    expect(renderScreen({ ...ctx, touch: true }, 'shop').html).not.toContain('hud-top');
    expect(renderScreen({ ...ctx, touch: true }, 'chore').html).toContain('class="ring"');
    // An unknown screen falls back to the HUD, an unknown variant to the first one.
    expect(renderScreen(ctx, 'nope').screen.id).toBe('hud');
    expect(renderScreen({ ...ctx, variant: 'nope' }, 'shop').variant).toBe('animals');
  });

  test('the shop shows every section, the stars packs and locked items', () => {
    const { t } = strictT();
    for (const section of FIXTURE.shop.sections) {
      const html = renderScreen({ t, long: false, data: FIXTURE, variant: section, layout: 'desktop', touch: false, badges }, 'shop').html;
      expect(html).toContain(`data-variant="${section}" aria-selected="true"`);
    }
    const stars = renderScreen({ t, long: false, data: FIXTURE, variant: '', layout: 'desktop', touch: false, badges }, 'stars').html;
    for (const n of FIXTURE.shop.starPacks) expect(stars).toContain(t('stars.pack', { count: n }));
    const food = renderScreen({ t, long: false, data: FIXTURE, variant: 'food', layout: 'desktop', touch: false, badges }, 'shop').html;
    expect(food).toContain(t('ui.unlocksAt', { level: 14 }));
  });

  test('overview badges list each inhabited enclosure with its species, count and warnings', () => {
    expect(badges.length).toBeGreaterThan(10);
    for (const b of badges) {
      expect(SPECIES_IDS.has(b.species)).toBe(true);
      expect(b.count).toBeGreaterThan(0);
    }
    expect(badges.some((b) => b.warnings.some((w) => w.level === 'critical'))).toBe(true);
    const { t } = strictT();
    const html = renderScreen({ t, long: false, data: FIXTURE, variant: '', layout: 'desktop', touch: false, badges }, 'badges').html;
    for (const b of badges) expect(html).toContain(`data-anchor="enc:${b.id}"`);
  });

  test('game hotkeys open real screens and avoid the movement and action keys', () => {
    for (const [key, screen] of Object.entries(HOTKEYS)) {
      expect(SCREEN_IDS).toContain(screen);
      expect(['w', 'a', 's', 'd', 'e', ' ', 'q', 'r']).not.toContain(key);
    }
  });

  test('species names come from the catalogue until the strings table has them', () => {
    const { t } = createStrings('en');
    expect(speciesName({ t, long: false }, 'plains-zebra')).toBe('Plains zebra');
    expect(speciesName({ t, long: true }, 'plains-zebra')).toBe(stretchText('Plains zebra'));
  });
});

describe('UI mockup icons', () => {
  test('warning kinds each have their own shape, and critical differs from warning by fill', () => {
    const shapes = WARNING_KINDS.map((k) => WARNINGS[k].shape);
    expect(new Set(shapes).size).toBe(shapes.length);
    for (const k of WARNING_KINDS) {
      const warn = warningIcon(k, 'warn');
      const crit = warningIcon(k, 'critical');
      expect(warn).not.toBe(crit);
      expect(crit).toContain('critical');
    }
  });

  test('UI icons render and unknown names fail loudly', () => {
    for (const name of ICON_NAMES) expect(icon(name)).toContain('<path d="');
    expect(() => icon('nope')).toThrow();
    expect(() => warningIcon('nope')).toThrow();
    expect(icon('bell', { label: 'Alerts' })).toContain('aria-label="Alerts"');
  });
});

describe('UI mockup fixture', () => {
  test('numbers follow the economy where it has them', () => {
    expect(FIXTURE.zoo.xpNext).toBe(xpToNext(FIXTURE.zoo.level));
    expect(xpToNext(1)).toBe(30);
    expect(xpToNext(10)).toBe(Math.round(30 * 10 ** 1.55));
    expect(FIXTURE.shop.starPacks).toEqual([25, 100, 500]);
    expect(FIXTURE.shop.exchangeRate).toBe(100);
    expect(FIXTURE.zoo.xp).toBeLessThan(FIXTURE.zoo.xpNext);
  });

  test('every species it names exists, and owned ones are unlocked at its level', () => {
    const ids = [
      FIXTURE.animal.species,
      ...Object.values(FIXTURE.animal.compatibility).flat(),
      ...FIXTURE.shop.market.map((m) => m.species),
      ...FIXTURE.shop.conservation.map((p) => p.species),
      FIXTURE.species.id,
      FIXTURE.photo.subject,
      FIXTURE.naming.baby.species,
    ];
    for (const id of ids) expect(SPECIES_IDS.has(id)).toBe(true);
    for (const e of FIXTURE.zoopedia) {
      if (e.status === 'owned') expect(e.unlockLevel).toBeLessThanOrEqual(FIXTURE.zoo.level);
      if (e.status === 'locked') expect(e.unlockLevel).toBeGreaterThan(FIXTURE.zoo.level);
    }
    expect(FIXTURE.zoopedia.length).toBe(SPECIES.length);
    expect(TIER_LEVEL[1]).toBe(1);
  });

  test('the alert feed and the market only show what the zoo has unlocked', () => {
    for (const m of FIXTURE.shop.market.filter((x) => !x.locked)) {
      const s = SPECIES.find((x) => x.id === m.species);
      expect(TIER_LEVEL[s.tier]).toBeLessThanOrEqual(FIXTURE.zoo.level);
    }
    for (const a of FIXTURE.alerts) expect(WARNING_KINDS).toContain(a.kind);
  });

  test('the fixture is deterministic', async () => {
    const again = await import(`../src/mockups/ui/fixture.js?again=${Date.now()}`);
    expect(JSON.stringify(again.FIXTURE)).toBe(JSON.stringify(FIXTURE));
  });
});

describe('long text (pseudo-Czech)', () => {
  test('stretches words by about a third, adds Czech accents and keeps placeholders', () => {
    const out = stretchText('Feeder is empty');
    expect(out.length).toBeGreaterThan('Feeder is empty'.length * 1.2);
    expect(out).toMatch(/[áčďéíňóřšťůýž]/);
    expect(stretchText('{name} will be hungry')).toStartWith('{name} ');
    expect(stretchText('Level {level}')).toEndWith('{level}');
    expect(stretchText('Feeder')).toBe(stretchText('Feeder'));
  });

  test('createStrings can stretch every string, plural forms included', () => {
    const { t } = createStrings('en', undefined, { long: true });
    expect(t('calendar.days', { count: 2 })).toBe(`2 ${stretchText('days')}`);
    expect(t('hud.shop')).toBe(stretchText('Shop'));
    expect(createStrings('en').t('hud.shop')).toBe('Shop');
  });
});
