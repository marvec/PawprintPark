// The screens of the UI mockup (PRD §4, §6.3, §9, §11, §12, §14, §15, §18, §19) as pure HTML builders: each takes a
// context (the strings table's `t`, the fixture, the variant) and returns markup, so every screen renders under
// `bun test`. The page (ui.js) puts the markup over the world backdrop, places world-anchored bits (`data-anchor`)
// and wires `data-go` buttons. Every piece of text comes from the strings table; names of animals, staff and zoos
// are data.

import { stretchText } from '../../core/strings.js';
import { calendarOf } from '../../core/time.js';
import { SPECIES } from '../../data/species.js';
import { ENCLOSURE_SIZES } from '../../data/world.js';
import { coinIcon, icon, pawIcon, starIcon, warningIcon, WARNING_KINDS } from './icons.js';

/**
 * @typedef {{ t: (key: string, params?: Record<string, string | number>) => string, long: boolean, data: any,
 *   variant: string, layout: 'phone' | 'phone-land' | 'tablet' | 'desktop', touch: boolean,
 *   badges?: ReturnType<typeof import('./fixture.js').overviewBadges> }} Ctx
 */

const SPECIES_BY_ID = Object.fromEntries(SPECIES.map((s) => [s.id, s]));

/**
 * Game hotkeys shown on the HUD (desktop) and handled by the page. The keeper's movement keys (WASD, arrows),
 * E/Space for the action and Q/R for turning the camera are taken.
 */
export const HOTKEYS = { n: 'alerts', b: 'shop', i: 'stats', z: 'zoopedia', escape: 'pause', p: 'pause', t: 'travel', c: 'photo', k: 'staff', g: 'goals', m: 'badges' };
const keyOf = (screen) => Object.keys(HOTKEYS).find((k) => HOTKEYS[k] === screen && k !== 'escape');

// ---- Helpers -------------------------------------------------------------------------------------------------------

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Numbers in the UI language's style (Czech groups thousands with a space). */
const num = (ctx, n) => new Intl.NumberFormat(ctx.long ? 'cs' : 'en').format(n);

/** A species' name: from the strings table once it has one (milestone 11), from the catalogue until then. */
export function speciesName(ctx, id) {
  const key = `species.${id}`;
  const v = ctx.t(key);
  if (v !== key) return v;
  const name = SPECIES_BY_ID[id]?.name ?? id;
  return ctx.long ? stretchText(name) : name;
}

/** An enclosure's default name, e.g. "Savanna 2". */
const placeName = (ctx, p) => (p ? (p.building ? ctx.t(`building.${p.building}`) : ctx.t('place.enclosure', { biome: ctx.t(`biome.short.${p.biome}`), n: p.n })) : ctx.t('place.wholeZoo'));

const coins = (ctx, n) => `<span class="money">${coinIcon(16)}${num(ctx, n)}</span>`;
const stars = (ctx, n) => `<span class="money">${starIcon(16)}${num(ctx, n)}</span>`;

/** A key hint, shown only with a keyboard (the page hides them on touch layouts). */
const kbd = (k) => (k ? `<kbd>${k === 'escape' ? 'Esc' : k.toUpperCase()}</kbd>` : '');

/**
 * A button. `go` opens a screen (and `variant`), so the mockup can be clicked through.
 * @param {string} label
 * @param {{ icon?: string, cls?: string, go?: string, variant?: string, key?: string, title?: string, pressed?: boolean, disabled?: boolean, iconOnly?: boolean }} [o]
 */
function btn(label, o = {}) {
  const attrs = [
    o.go ? `data-go="${o.go}"` : '',
    o.variant ? `data-variant="${o.variant}"` : '',
    o.pressed !== undefined ? `aria-pressed="${o.pressed}"` : '',
    o.disabled ? 'disabled' : '',
    o.iconOnly ? `aria-label="${esc(label)}" title="${esc(label)}"` : '',
  ].join(' ');
  const body = o.iconOnly ? icon(o.icon) : `${o.icon ? icon(o.icon) : ''}<span>${label}</span>`;
  return `<button type="button" class="btn ${o.cls ?? ''}" ${attrs}>${body}${kbd(o.key)}</button>`;
}

/** A dialog or sheet with a title bar and a close button. */
function sheet(ctx, { title, body, cls = '', icon: ic = '', back = '', footer = '' }) {
  return `<section class="sheet ${cls}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <header class="sheet-head">
      ${back ? btn(ctx.t('ui.back'), { icon: 'back', go: back, iconOnly: true, cls: 'ghost round' }) : ''}
      ${ic ? `<span class="sheet-icon">${ic}</span>` : ''}
      <h2>${title}</h2>
      ${btn(ctx.t('ui.close'), { icon: 'close', go: 'hud', iconOnly: true, cls: 'ghost round', key: '' })}
    </header>
    <div class="sheet-body">${body}</div>
    ${footer ? `<footer class="sheet-foot">${footer}</footer>` : ''}
  </section>`;
}

/** Tabs that switch the screen's variant. */
function tabs(ctx, screen, list, current, labelKey) {
  return `<nav class="tabs" role="tablist">${list
    .map((id) => `<button type="button" role="tab" class="tab" data-go="${screen}" data-variant="${id}" aria-selected="${id === current}">${ctx.t(`${labelKey}.${id}`)}</button>`)
    .join('')}</nav>`;
}

/** A stat bar: 0–100, coloured by how good it is, with its value in text. */
function statBar(ctx, label, value, ic = '') {
  const tone = value < 25 ? 'bad' : value < 50 ? 'low' : 'good';
  return `<div class="stat ${tone}"><span class="stat-label">${ic}${label}</span><span class="stat-track"><span class="stat-fill" style="width:${value}%"></span></span><span class="stat-value">${ctx.t('ui.percent', { value })}</span></div>`;
}

/** A species portrait; the page renders it from the real model (or its silhouette). */
const portrait = (id, { size = 56, silhouette = false } = {}) =>
  `<img class="portrait ${silhouette ? 'silhouette' : ''}" data-portrait="${id}" ${silhouette ? 'data-silhouette="1"' : ''} width="${size}" height="${size}" alt="">`;

/** Quality as 1–5 pips. */
const pips = (n, max = 5) => `<span class="pips" aria-label="${n}/${max}">${Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;

const ago = (ctx, minutes) => (minutes < 60 ? ctx.t('time.minutesAgo', { count: minutes }) : minutes < 60 * 24 ? ctx.t('time.hoursAgo', { count: Math.round(minutes / 60) }) : ctx.t('time.daysAgo', { count: Math.round(minutes / 1440) }));

const sexMark = (ctx, sex) => `<span class="sex ${sex}" title="${ctx.t(`sex.${sex}`)}">${sex === 'male' ? '♂' : '♀'}</span>`;

// ---- HUD (PRD §15.2) -----------------------------------------------------------------------------------------------

/** The HUD: resources top left, date and speed top right, the button dock, goals, and touch controls. */
export function renderHud(ctx, { parts = 'full', active = '' } = {}) {
  const { zoo, alerts, goals } = ctx.data;
  const cal = calendarOf(zoo.minute);
  const xpShare = Math.round((zoo.xp / zoo.xpNext) * 100);
  const rep = zoo.reputation / 20;
  const paws = Array.from({ length: 5 }, (_, i) => pawIcon(17, Math.max(0, Math.min(1, rep - i)), `r${i}`)).join('');
  const date = ctx.t('calendar.dateShort', { day: cal.day, month: ctx.t(`calendar.monthShort.${cal.month}`) });
  const time = ctx.t('calendar.time', { hour: cal.hour, minute: String(cal.minute).padStart(2, '0') });
  const speeds = [0, 1, 2, 3]
    .map((s) => `<button type="button" class="speed" aria-pressed="${s === zoo.speed}" aria-label="${ctx.t(`hud.speed.${s}`)}" title="${ctx.t(`hud.speed.${s}`)}">${s === 0 ? icon('pause', { size: 16 }) : `<span class="chev">${'›'.repeat(s)}</span>`}${kbd(String(s))}</button>`)
    .join('');
  const top = `<header class="hud-top">
    <div class="hud-res">
      <button type="button" class="level" data-go="levelup" aria-label="${ctx.t('hud.levelAria', { level: zoo.level, xp: num(ctx, zoo.xp), next: num(ctx, zoo.xpNext) })}">
        <span class="level-num">${zoo.level}</span>
        <span class="xp"><span class="xp-fill" style="width:${xpShare}%"></span></span>
        <span class="xp-text">${ctx.t('hud.xp', { xp: num(ctx, zoo.xp), next: num(ctx, zoo.xpNext) })}</span>
      </button>
      <span class="chip" title="${ctx.t('hud.coins')}">${coinIcon(18)}<b>${num(ctx, zoo.coins)}</b></span>
      <button type="button" class="chip" data-go="stars" title="${ctx.t('hud.stars')}">${starIcon(18)}<b>${num(ctx, zoo.stars)}</b><span class="plus">${icon('plus', { size: 14 })}</span></button>
      <span class="chip rep" title="${ctx.t('hud.reputation', { value: zoo.reputation })}"><span class="paws">${paws}</span><span class="rep-one">${pawIcon(17, 1, 'one')}<b>${zoo.reputation}</b></span></span>
    </div>
    <div class="hud-time">
      <span class="chip clock">${icon(zoo.weather, { size: 18 })}<span>${ctx.t('hud.temperature', { degrees: zoo.temperature })}</span><b>${date}</b><b class="time">${time}</b></span>
      <span class="speeds" role="group" aria-label="${ctx.t('hud.speed')}">${speeds}</span>
    </div>
  </header>`;
  if (parts === 'top') return top;
  const warn = alerts.filter((a) => a.level === 'critical').length;
  const dock = `<nav class="hud-dock" aria-label="${ctx.t('hud.menu')}">
    ${[
      ['alerts', 'bell', `<span class="count ${warn ? 'hot' : ''}">${alerts.length}</span>`],
      ['shop', 'shop', ''],
      ['stats', 'stats', ''],
      ['zoopedia', 'book', ''],
      ['pause', 'menu', ''],
    ]
      .map(([go, ic, extra]) => `<button type="button" class="dock-btn" data-go="${go}" aria-pressed="${active === go}" aria-label="${ctx.t(`hud.${go === 'pause' ? 'menu' : go}`)}">${icon(ic, { size: 24 })}${extra}<span class="dock-label">${ctx.t(`hud.${go === 'pause' ? 'menu' : go}`)}</span>${kbd(keyOf(go) ?? (go === 'pause' ? 'escape' : ''))}</button>`)
      .join('')}
  </nav>`;
  const g = goals.active;
  const goalList = `<aside class="hud-goals" aria-label="${ctx.t('goals.title')}">
    <button type="button" class="goals-head" data-go="goals">${icon('flag', { size: 16 })}<span>${ctx.t('goals.title')}</span>${kbd('g')}</button>
    ${g.map((x) => goalRow(ctx, x, true)).join('')}
  </aside>`;
  return `${top}${parts === 'full' ? goalList : ''}${dock}${ctx.touch && (parts === 'full' || parts === 'dock') ? touchControls(ctx) : ''}`;
}

function goalRow(ctx, g, compact = false) {
  const [a, b] = g.progress ?? [0, 1];
  const params = { ...g.params };
  if (params.species) params.species = speciesName(ctx, params.species);
  if (params.biome) params.biome = ctx.t(`biome.${params.biome}`);
  if (params.count !== undefined) params.count = num(ctx, params.count);
  return `<div class="goal ${g.done ? 'done' : ''} ${compact ? 'compact' : ''}">
    <span class="goal-check">${g.done ? icon('check', { size: 14 }) : ''}</span>
    <span class="goal-text">${ctx.t(g.key, params)}</span>
    ${b > 1 && !g.done ? `<span class="goal-prog"><span style="width:${Math.round((a / b) * 100)}%"></span></span><span class="goal-num">${num(ctx, a)}/${num(ctx, b)}</span>` : ''}
    ${g.stars && !compact ? `<span class="goal-reward">${stars(ctx, g.stars)}<span class="xp-chip">${ctx.t('ui.xp', { xp: g.xp })}</span></span>` : ''}
  </div>`;
}

/** The on-screen joystick and action button (PRD §4); `ring` 0–1 draws the chore progress ring on the button. */
function touchControls(ctx, { ring = -1, label = '' } = {}) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const ringSvg = ring >= 0 ? `<svg class="ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="${r}" class="ring-track"/><circle cx="50" cy="50" r="${r}" class="ring-fill" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - ring)).toFixed(1)}"/></svg>` : '';
  return `<div class="joystick" role="img" aria-label="${ctx.t('controls.joystick')}"><span class="stick"></span></div>
  <button type="button" class="action" aria-label="${ctx.t('controls.action')}">${ringSvg}<span class="action-face">${icon(label || 'hand', { size: 30 })}</span></button>`;
}

// ---- Screens -------------------------------------------------------------------------------------------------------

function hudScreen() {
  return '';
}

/** The alert feed: warnings before things become critical; tapping one quick-travels there. */
function alertsScreen(ctx) {
  const rows = ctx.data.alerts
    .map((a) => {
      const params = { ...a.params };
      if (params.species) params.species = speciesName(ctx, params.species);
      if (params.illness) params.illness = ctx.t(`illness.${params.illness}`);
      if (params.severity) params.severity = ctx.t(`severity.${params.severity}`);
      if (params.role) params.role = ctx.t(`role.${params.role}.plural`);
      if (params.days !== undefined) params.count = params.days;
      return `<li><button type="button" class="alert ${a.level}" data-go="travel" data-variant="moving">
        ${warningIcon(a.kind, a.level, { size: 30, label: ctx.t(`warning.${a.kind}`) })}
        <span class="alert-text"><b>${ctx.t(a.key, params)}</b><small>${placeName(ctx, a.place)} · ${ago(ctx, a.ago)}</small></span>
        <span class="alert-go">${icon('walk', { size: 18 })}</span>
      </button></li>`;
    })
    .join('');
  return sheet(ctx, {
    title: ctx.t('alerts.title'),
    cls: 'side alerts-sheet',
    icon: icon('bell'),
    body: `<p class="hint">${ctx.t('alerts.hint')}</p><ul class="alert-list">${rows}</ul>`,
  });
}

/** Warning icons floating over animals, and the legend of every kind at both levels (PRD §6.2, §19). */
function warningsScreen(ctx) {
  const floating = [
    ['animal:0', 'health', 'critical'],
    ['sheep-feeder', 'hunger', 'warn'],
    ['keeper-pen', 'dirt', 'warn'],
    ['travel-target', 'fence', 'warn'],
  ]
    .map(([a, k, l]) => `<div class="float-warn" data-anchor="${a}">${warningIcon(k, l, { size: 34, label: ctx.t(`warning.${k}`) })}</div>`)
    .join('');
  const legend = WARNING_KINDS.map(
    (k) => `<li>${warningIcon(k, 'warn', { size: 30 })}${warningIcon(k, 'critical', { size: 30 })}<span><b>${ctx.t(`warning.${k}`)}</b><small>${ctx.t(`warning.${k}.shape`)}</small></span></li>`,
  ).join('');
  return `${floating}${sheet(ctx, {
    title: ctx.t('warnings.title'),
    cls: 'side small',
    body: `<p class="hint">${ctx.t('warnings.hint')}</p><ul class="legend">${legend}</ul>`,
  })}`;
}

/** The animal details panel (PRD §6.3) in three tabs. */
function animalScreen(ctx) {
  const a = ctx.data.animal;
  const tab = ['overview', 'care', 'about'].includes(ctx.variant) ? ctx.variant : 'overview';
  const head = `<div class="animal-head">
    ${portrait(a.species, { size: 72 })}
    <div class="animal-id">
      <div class="name-row"><h3>${esc(a.name)}</h3>${btn(ctx.t('animal.rename'), { icon: 'edit', go: 'name', variant: 'animal', iconOnly: true, cls: 'ghost round small' })}</div>
      <div class="sub">${speciesName(ctx, a.species)} ${sexMark(ctx, a.sex)} · ${ctx.t('animal.age', { count: a.ageYears })} · ${ctx.t(`stage.${a.stage}`)}</div>
      <div class="sub">${icon('pin', { size: 14 })}${placeName(ctx, a.enclosure)}</div>
    </div>
  </div>`;
  let body = '';
  if (tab === 'overview') {
    const s = a.stats;
    const drivers = a.drivers
      .map((d) => {
        const params = { ...d.params };
        if (params.item) params.item = ctx.t(`equipment.${params.item}`);
        return `<li class="${d.score < 50 ? 'low' : d.score < 70 ? 'mid' : ''}"><span>${ctx.t(`driver.${d.id}`)}</span><span class="mini"><span style="width:${d.score}%"></span></span><b>${ctx.t('ui.percent', { value: d.score })}</b>${d.note ? `<small>${ctx.t(d.note, params)}</small>` : ''}</li>`;
      })
      .join('');
    body = `<div class="stat-bars">
      ${statBar(ctx, ctx.t('stat.happiness'), s.happiness, icon('heart', { size: 16 }))}
      ${statBar(ctx, ctx.t('stat.health'), s.health, icon('cross', { size: 16 }))}
      ${statBar(ctx, ctx.t('stat.hunger'), s.food, icon('food', { size: 16 }))}
      ${statBar(ctx, ctx.t('stat.thirst'), s.water, icon('water', { size: 16 }))}
    </div>
    <h4>${ctx.t('animal.happinessWhy')}</h4><ul class="drivers">${drivers}</ul>
    <h4>${ctx.t('animal.traits')}</h4><div class="chips">${a.traits.map((t) => `<span class="trait">${ctx.t(`trait.${t}`)}<small>${ctx.t(`trait.${t}.effect`)}</small></span>`).join('')}</div>`;
  } else if (tab === 'care') {
    const b = a.breeding;
    const hist = a.history
      .map((h) => `<li><span class="sev ${h.severity}">${ctx.t(`severity.${h.severity}`)}</span><span>${ctx.t(`illness.${h.illness}`)}</span><small>${ctx.t('time.daysAgo', { count: h.params.count })} · ${ctx.t(`outcome.${h.outcome}`)}</small></li>`)
      .join('');
    body = `<h4>${ctx.t('animal.breeding')}</h4>
    <label class="toggle"><input type="checkbox" ${b.allowed ? 'checked' : ''}><span class="switch"></span><span>${ctx.t('animal.breedingAllowed')}</span></label>
    ${b.pregnant ? `<div class="callout good">${icon('baby')}<span>${ctx.t('animal.pregnant', { count: b.dueDays, litter: b.litter })}</span></div>` : ''}
    <h4>${ctx.t('animal.family')}</h4>
    <div class="tree">
      <div class="tree-row">${[a.parents.mother, a.parents.father].map((p, i) => `<span class="person">${sexMark(ctx, i ? 'male' : 'female')}<b>${esc(p.name)}</b><small>${ctx.t(p.origin)}</small></span>`).join('')}</div>
      <div class="tree-row"><span class="person me">${sexMark(ctx, a.sex)}<b>${esc(a.name)}</b></span><span class="person">${ctx.t('animal.mate')}<b>${esc(a.family.mate)}</b></span><span class="person">${ctx.t('animal.siblings')}<b>${a.family.siblings.map(esc).join(', ')}</b></span></div>
    </div>
    <div class="callout warn">${warningIcon('info', 'warn', { size: 22 })}<span>${ctx.t('animal.inbreeding')}</span></div>
    <h4>${ctx.t('animal.history')}</h4><ul class="history">${hist}</ul>`;
  } else {
    const c = a.compatibility;
    const group = (kind) => `<div class="compat ${kind}"><b>${ctx.t(`compat.${kind}`)}</b>${c[kind].map((id) => `<span class="chip-sp">${portrait(id, { size: 28 })}${speciesName(ctx, id)}</span>`).join('')}</div>`;
    body = `<h4>${ctx.t('animal.compatibility')}</h4>${group('good')}${group('neutral')}${group('never')}
    <div class="fact">${icon('sparkle')}<p>${ctx.t(a.fact)}</p></div>
    ${btn(ctx.t('animal.zoopedia'), { icon: 'book', go: 'species', variant: 'owned', cls: 'link' })}`;
  }
  const actions = `<div class="actions">
    ${btn(ctx.t('animal.move'), { icon: 'move' })}
    ${btn(ctx.t('animal.sell'), { icon: 'sell' })}
    ${btn(ctx.t('animal.transfer'), { icon: 'heart', cls: 'good' })}
  </div>`;
  return sheet(ctx, {
    title: ctx.t('animal.title'),
    cls: 'side animal',
    body: `${head}${tabs(ctx, 'animal', ['overview', 'care', 'about'], tab, 'animal.tab')}<div class="tab-body">${body}</div>`,
    footer: actions,
  });
}

/** A chore under way: the ring over the keeper and on the action button (PRD §4). */
function choreScreen(ctx) {
  const c = ctx.data.chore;
  const r = 26;
  const len = 2 * Math.PI * r;
  return `<div class="chore" data-anchor="keeper-head">
    <svg class="chore-ring" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="${r}" class="ring-track"/><circle cx="32" cy="32" r="${r}" class="ring-fill" stroke-dasharray="${len.toFixed(1)}" stroke-dashoffset="${(len * (1 - c.progress)).toFixed(1)}"/></svg>
    <span class="chore-icon">${icon('food', { size: 22 })}</span>
  </div>
  <div class="toast chore-toast" role="status">${icon('food')}<span>${ctx.t(c.key, { name: c.target })}</span><span class="xp-chip">${ctx.t('ui.xpGain', { xp: c.xp })}</span></div>
  ${ctx.touch ? '' : `<div class="key-prompt">${ctx.t('controls.hold', { key: 'E' })}</div>`}`;
}

/** The touch controls on their own, labelled, and the keyboard map for desktop. */
function controlsScreen(ctx) {
  const keys = [
    ['WASD · ↑←↓→', 'controls.move'],
    ['E · Space', 'controls.actionKey'],
    ['Q · R', 'controls.rotate'],
    ['+ · −', 'controls.zoom'],
    ['T', 'controls.travel'],
    ['B', 'hud.shop'],
    ['Esc', 'hud.menu'],
  ];
  const labels = `<div class="callout-label" data-place="joystick">${ctx.t('controls.joystickHint')}</div>
  <div class="callout-label" data-place="action">${ctx.t('controls.actionHint')}</div>`;
  // Phones show the touch controls with their labels; the key map is for screens with room (and keyboards).
  if (ctx.layout === 'phone' || ctx.layout === 'phone-land') return `${labels}<div class="toast" role="status">${icon('hand')}<span>${ctx.t('controls.hint')}</span></div>`;
  return `${labels}
  ${sheet(ctx, {
    title: ctx.t('controls.title'),
    cls: 'side small',
    icon: icon('keyboard'),
    body: `<p class="hint">${ctx.t('controls.hint')}</p><table class="keys">${keys.map(([k, l]) => `<tr><td><kbd>${k}</kbd></td><td>${ctx.t(l)}</td></tr>`).join('')}</table>`,
  })}`;
}

/** Quick-travel: the list of places, and the trip under way (PRD §4). */
function travelScreen(ctx) {
  const tr = ctx.data.travel;
  if (ctx.variant === 'moving') {
    return `<div class="banner" role="status">${icon('walk')}<span>${ctx.t('travel.going', { place: placeName(ctx, tr.to), count: tr.seconds })}</span>${btn(ctx.t('travel.stop'), { go: 'hud', cls: 'small' })}</div>
    <div class="travel-target" data-anchor="travel-target">${icon('pin', { size: 30 })}</div>`;
  }
  const rows = tr.places
    .map((p) => `<li><button type="button" class="place" data-go="travel" data-variant="moving">${p.warn ? warningIcon(p.warn, 'warn', { size: 26 }) : `<span class="place-dot">${icon(p.building ? 'home' : 'pin', { size: 16 })}</span>`}<span>${placeName(ctx, p)}</span><small>${ctx.t('travel.distance', { metres: p.distance * 2 })}</small></button></li>`)
    .join('');
  return sheet(ctx, {
    title: ctx.t('travel.title'),
    cls: 'side small',
    icon: icon('map'),
    body: `<label class="search">${icon('search', { size: 18 })}<input type="search" placeholder="${ctx.t('travel.search')}"></label><ul class="places">${rows}</ul>`,
  });
}

/** Build mode (PRD §4): the ghost (valid or not), rotate, move, sell. */
function buildScreen(ctx) {
  const b = ctx.data.build;
  const v = ['valid', 'invalid', 'selected', 'sell'].includes(ctx.variant) ? ctx.variant : 'valid';
  const item = `${ctx.t(`biome.${b.biome}`)} · ${ctx.t(`size.${b.size}`)}`;
  const banner = `<div class="build-mode">${icon('grid', { size: 18 })}${ctx.t('build.mode')}</div>`;
  if (v === 'selected' || v === 'sell') {
    const bar = `<div class="build-bar" role="toolbar">
      <div class="build-item"><b>${placeName(ctx, { biome: 'farmyard', n: 2 })}</b><small>${ctx.t('build.selected')}</small></div>
      ${btn(ctx.t('build.rotate'), { icon: 'rotate', key: 'r' })}
      ${btn(ctx.t('build.move'), { icon: 'move', key: 'm' })}
      ${btn(ctx.t('build.sell'), { icon: 'sell', key: 'x', go: 'build', variant: 'sell', cls: 'bad' })}
      ${btn(ctx.t('build.done'), { icon: 'check', go: 'hud', cls: 'primary', key: 'enter' })}
    </div>`;
    const confirm =
      v === 'sell'
        ? `<div class="modal-back"></div><section class="dialog" role="alertdialog" aria-label="${ctx.t('build.sellTitle')}"><h2>${ctx.t('build.sellTitle')}</h2><p>${ctx.t('build.sellBody', { place: placeName(ctx, { biome: 'farmyard', n: 2 }) })}</p><p class="refund">${ctx.t('build.refund')} ${coins(ctx, b.refund)}</p><div class="dialog-actions">${btn(ctx.t('ui.cancel'), { go: 'build', variant: 'selected' })}${btn(ctx.t('build.sellConfirm'), { cls: 'bad', go: 'hud' })}</div></section>`
        : '';
    return `${banner}<div class="ghost-tag ok" data-anchor="selected">${icon('move', { size: 16 })}${ctx.t('build.dragToMove')}</div>${bar}${confirm}`;
  }
  const ok = v === 'valid';
  const tag = ok
    ? `<div class="ghost-tag ok" data-anchor="ghost">${icon('check', { size: 16 })}${ctx.t('build.valid')}</div>`
    : `<div class="ghost-tag bad" data-anchor="ghost">${icon('close', { size: 16 })}${ctx.t(`build.reason.${b.reason}`)}</div>`;
  const bar = `<div class="build-bar" role="toolbar">
    <div class="build-item"><b>${item}</b><small>${stars(ctx, b.stars)} ${coins(ctx, b.coins)}</small></div>
    ${btn(ctx.t('build.rotate'), { icon: 'rotate', key: 'r' })}
    ${btn(ctx.t('ui.cancel'), { icon: 'close', go: 'shop', variant: 'enclosures', key: 'escape' })}
    ${btn(ctx.t('build.place'), { icon: 'check', cls: 'primary', disabled: !ok, key: 'enter' })}
  </div>`;
  return `${banner}${tag}${bar}`;
}

/** The shop with every section in PRD §11.5. */
function shopScreen(ctx) {
  const shop = ctx.data.shop;
  const sec = shop.sections.includes(ctx.variant) ? ctx.variant : 'animals';
  const lockTag = (lvl) => `<span class="lock">${icon('lock', { size: 14 })}${ctx.t('ui.unlocksAt', { level: lvl })}</span>`;
  const item = ({ title, sub = '', art, price, locked, extra = '', cls = '', go = '', variant = '' }) =>
    `<li class="item ${locked ? 'locked' : ''} ${cls}"><button type="button" class="item-btn" ${go ? `data-go="${go}"` : ''} ${variant ? `data-variant="${variant}"` : ''} ${locked ? 'aria-disabled="true"' : ''}>
      <span class="item-art">${art}</span><span class="item-text"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}${extra}</span>
      <span class="item-price">${locked ? lockTag(locked) : price}</span></button></li>`;
  const art = (name, tone = '') => `<span class="art ${tone}">${icon(name, { size: 26 })}</span>`;
  let body = '';
  if (sec === 'animals') {
    body = `<p class="hint">${icon('clock', { size: 14 })}${ctx.t('shop.market.refresh', { count: ctx.data.staff.refreshDays })}</p><ul class="items grid">${shop.market
      .map((m) =>
        m.locked
          ? item({ title: speciesName(ctx, m.species), sub: ctx.t('shop.market.locked'), art: portrait(m.species, { size: 56, silhouette: true }), locked: m.unlockLevel })
          : item({
              title: `${esc(m.name)} ${sexMark(ctx, m.sex)}`,
              sub: `${speciesName(ctx, m.species)} · ${ctx.t(`stage.${m.age}`)}`,
              art: portrait(m.species, { size: 56 }),
              price: coins(ctx, m.price),
              extra: `<small class="from">${m.bred ? ctx.t('shop.market.bredHere') : ctx.t('shop.market.from', { zoo: ctx.t(m.from) })}</small>`,
              go: 'market',
            }),
      )
      .join('')}</ul>`;
  } else if (sec === 'food') {
    body = `<p class="hint">${ctx.t('shop.food.storehouse', { used: 378, capacity: 600 })}</p><ul class="items">${shop.food
      .map((f) =>
        item({
          title: ctx.t(`food.${f.id}`),
          sub: f.locked ? '' : ctx.t('shop.food.stock', { count: f.stock, days: f.perDay ? Math.floor(f.stock / f.perDay) : '—' }),
          art: art('food', f.stock < f.perDay * 2 && !f.locked ? 'bad' : ''),
          price: `<span class="per">${coins(ctx, f.price)}<small>${ctx.t('shop.food.perPortion')}</small></span><span class="bulk">${shop.bulk.map((n) => `<span class="btn tiny">+${n}</span>`).join('')}</span>`,
          locked: f.locked ? f.unlockLevel : 0,
        }),
      )
      .join('')}</ul>`;
  } else if (sec === 'medicine') {
    body = `<p class="hint">${ctx.t('shop.medicine.hint')}</p><ul class="items">${shop.medicine
      .map((m) => item({ title: ctx.t(`medicine.${m.id}`), sub: ctx.t('shop.inStock', { count: m.stock }), art: art('pill'), price: coins(ctx, m.price) }))
      .join('')}</ul><div class="callout">${icon('info')}<span>${ctx.t('shop.medicine.vet')}</span></div>`;
  } else if (sec === 'enclosures') {
    const biome = shop.biomes
      .map((id) => `<button type="button" class="biome-chip" aria-pressed="${id === 'african-savanna'}" ${shop.biomeLocks[id] ? 'aria-disabled="true"' : ''}><span class="swatch b-${id}"></span>${ctx.t(`biome.${id}`)}${shop.biomeLocks[id] ? lockTag(shop.biomeLocks[id]) : ''}</button>`)
      .join('');
    body = `<h4>${ctx.t('shop.enclosures.biome')}</h4><div class="biomes">${biome}</div>
    <h4>${ctx.t('shop.enclosures.size')}</h4><ul class="items grid sizes">${shop.enclosures
      .map((e) =>
        item({
          title: ctx.t(`size.${e.size}`),
          sub: ctx.t('size.tag', { size: e.size, tiles: ENCLOSURE_SIZES[e.size] }),
          art: `<span class="size-art" style="--k:${ENCLOSURE_SIZES[e.size] / 20}"></span>`,
          price: `${stars(ctx, e.stars)}${coins(ctx, e.coins)}`,
          locked: e.locked ? e.unlockLevel : 0,
          go: 'build',
          variant: 'valid',
        }),
      )
      .join('')}</ul>
    <p class="hint">${icon('grid', { size: 14 })}${ctx.t('shop.enclosures.joining')}</p>
    <h4>${ctx.t('shop.land')}</h4><ul class="items">${item({ title: ctx.t('shop.land.plot'), sub: ctx.t('shop.land.buyable', { count: shop.plot.buyable }), art: art('map'), price: stars(ctx, shop.plot.stars) })}</ul>`;
  } else if (sec === 'equipment') {
    const eqIcon = { feeder: 'food', water: 'water', shelter: 'home', heater: 'heat', cooler: 'snow', pool: 'water', 'climbing-frame': 'tree', toy: 'sparkle', chute: 'shield', 'feeder-auto': 'clock' };
    body = `<p class="hint">${ctx.t('shop.equipment.hint', { place: placeName(ctx, { biome: 'african-savanna', n: 2 }) })}</p><ul class="items grid">${shop.equipment
      .map((e) => item({ title: ctx.t(`equipment.${e.id}`), sub: ctx.t(`equipment.${e.id}.what`), art: art(eqIcon[e.id]), price: coins(ctx, e.price), locked: e.locked ? e.unlockLevel : 0, go: 'build', variant: 'valid' }))
      .join('')}</ul>`;
  } else if (sec === 'facilities') {
    const fIcon = { bin: 'trash', bench: 'home', toilet: 'door', drinks: 'water', coffee: 'food', 'ice-cream': 'snow', hotdog: 'food', playground: 'sparkle', souvenir: 'gift', storehouse: 'storage', quarters: 'moon', restaurant: 'food', 'show-arena': 'ticket' };
    body = `<ul class="items grid">${shop.facilities
      .map((f) => item({ title: ctx.t(`facility.${f.id}`), sub: ctx.t(`facility.${f.id}.what`), art: art(fIcon[f.id]), price: coins(ctx, f.price), locked: f.locked ? f.unlockLevel : 0, go: 'build', variant: 'valid' }))
      .join('')}</ul>`;
  } else if (sec === 'decorations') {
    const dIcon = { flowers: 'leaf', bush: 'leaf', rock: 'compass', tree: 'tree', fountain: 'water', statue: 'trophy', pumpkins: 'gift', lantern: 'sparkle' };
    const seasonal = shop.decorations.filter((d) => d.seasonal);
    body = `<ul class="items grid">${shop.decorations
      .filter((d) => !d.seasonal)
      .map((d) => item({ title: ctx.t(`decoration.${d.id}`), art: art(dIcon[d.id]), price: coins(ctx, d.price) }))
      .join('')}</ul>
    <h4>${icon('gift', { size: 16 })}${ctx.t('shop.seasonal', { holiday: ctx.t('holiday.halloween') })}</h4>
    <p class="hint">${ctx.t('shop.seasonal.hint')}</p>
    <ul class="items grid">${seasonal.map((d) => item({ title: ctx.t(`decoration.${d.id}`), art: art(dIcon[d.id], 'seasonal'), price: coins(ctx, d.price), cls: 'seasonal' })).join('')}</ul>
    <h4>${icon('trophy', { size: 16 })}${ctx.t('shop.landmarks')}</h4>
    <p class="hint">${ctx.t('shop.landmarks.hint')}</p>
    <ul class="items grid">${shop.landmarks
      .map((l) => item({ title: ctx.t(`landmark.${l.id}`), art: art('trophy', 'gold'), price: l.owned ? `<span class="owned">${icon('check', { size: 14 })}${ctx.t('shop.owned')}</span>` : coins(ctx, l.price), locked: l.locked ? l.unlockLevel : 0 }))
      .join('')}</ul>`;
  } else if (sec === 'conservation') {
    const cost = 1000 * ctx.data.zoo.level;
    body = `<p class="hint">${ctx.t('shop.conservation.hint', { count: shop.funded })}</p><ul class="projects">${shop.conservation
      .map(
        (p) => `<li class="project">${portrait(p.species, { size: 64, silhouette: true })}<div><b>${ctx.t(`project.${p.id}`)}</b><p>${ctx.t(`project.${p.id}.fact`)}</p>
        <small>${p.funded ? ctx.t('shop.conservation.funded', { count: p.funded }) : ctx.t('shop.conservation.new')} · ${ctx.t('shop.conservation.reward')}</small></div>
        ${btn(ctx.t('shop.conservation.fund', { price: num(ctx, cost) }), { cls: 'primary' })}</li>`,
      )
      .join('')}</ul>`;
  } else {
    body = starsBody(ctx);
  }
  const sideTabs = `<nav class="shop-tabs" role="tablist">${shop.sections
    .map((id) => `<button type="button" role="tab" class="tab" data-go="shop" data-variant="${id}" aria-selected="${id === sec}">${icon({ animals: 'heart', food: 'food', medicine: 'pill', enclosures: 'grid', equipment: 'wrench', facilities: 'home', decorations: 'leaf', conservation: 'shield', stars: 'sparkle' }[id], { size: 18 })}<span>${ctx.t(`shop.section.${id}`)}</span></button>`)
    .join('')}</nav>`;
  return sheet(ctx, {
    title: ctx.t('hud.shop'),
    cls: 'full shop',
    icon: icon('shop'),
    body: `${sideTabs}<div class="shop-body"><div class="balance">${coins(ctx, ctx.data.zoo.coins)} ${stars(ctx, ctx.data.zoo.stars)}</div>${body}</div>`,
  });
}

/** The "Get stars" dialog (PRD §11.6): free packs for now, and the one-way exchange to coins. */
function starsBody(ctx) {
  const shop = ctx.data.shop;
  return `<div class="callout">${icon('info')}<span>${ctx.t('stars.free')}</span></div>
  <ul class="packs">${shop.starPacks
    .map((n, i) => `<li><button type="button" class="pack p${i}" data-go="hud"><span class="pack-stars">${starIcon(i === 2 ? 48 : i ? 40 : 32)}</span><b>${ctx.t('stars.pack', { count: num(ctx, n) })}</b><span class="pack-name">${ctx.t(`stars.pack.${i}`)}</span><span class="btn primary">${ctx.t('stars.free.button')}</span></button></li>`)
    .join('')}</ul>
  <h4>${ctx.t('stars.exchange')}</h4>
  <div class="exchange"><span>${stars(ctx, 1)} = ${coins(ctx, shop.exchangeRate)}</span><span class="stepper">${btn(ctx.t('ui.less'), { icon: 'minus', iconOnly: true, cls: 'round small' })}<b>${stars(ctx, 5)}</b>${btn(ctx.t('ui.more'), { icon: 'plus', iconOnly: true, cls: 'round small' })}</span>${btn(ctx.t('stars.exchange.button', { coins: num(ctx, 5 * shop.exchangeRate) }), { cls: 'primary' })}</div>
  <p class="hint">${ctx.t('stars.exchange.oneWay')}</p>`;
}

function starsScreen(ctx) {
  return `<div class="modal-back"></div>${sheet(ctx, { title: ctx.t('stars.title'), cls: 'center stars-dialog', icon: starIcon(24), body: starsBody(ctx) })}`;
}

/** One market listing, opened from the shop (PRD §11.5, §11.7). */
function marketScreen(ctx) {
  const m = ctx.data.shop.market[0];
  const body = `<div class="listing">
    <div class="listing-art">${portrait(m.species, { size: 160 })}</div>
    <div class="listing-info">
      <h3>${esc(m.name)} ${sexMark(ctx, m.sex)}</h3>
      <div class="sub">${speciesName(ctx, m.species)} · ${ctx.t(`stage.${m.age}`)}</div>
      ${statBar(ctx, ctx.t('stat.health'), m.health, icon('cross', { size: 16 }))}
      <div class="chips">${m.traits.map((t) => `<span class="trait">${ctx.t(`trait.${t}`)}</span>`).join('')}</div>
      <dl class="facts">
        <dt>${ctx.t('market.from')}</dt><dd>${ctx.t(m.from)}</dd>
        <dt>${ctx.t('market.bloodline')}</dt><dd class="good">${ctx.t('market.newBloodline')}</dd>
        <dt>${ctx.t('market.needs')}</dt><dd>${ctx.t('biome.african-savanna')} · ${ctx.t('market.group', { min: 3, max: 8 })}</dd>
        <dt>${ctx.t('market.space')}</dt><dd>${ctx.t('market.tiles', { count: 60 })}</dd>
      </dl>
    </div>
  </div>
  <h4>${ctx.t('market.where')}</h4>
  <ul class="places">
    <li><button type="button" class="place" aria-pressed="true">${portrait('reticulated-giraffe', { size: 32 })}<span>${placeName(ctx, { biome: 'african-savanna', n: 1 })}</span><small class="good">${ctx.t('market.fit.good')}</small></button></li>
    <li><button type="button" class="place">${portrait('lion', { size: 32 })}<span>${placeName(ctx, { biome: 'african-savanna', n: 2 })}</span><small class="bad">${warningIcon('escape', 'critical', { size: 18 })}${ctx.t('market.fit.never', { species: speciesName(ctx, 'lion') })}</small></button></li>
  </ul>`;
  return `<div class="modal-back"></div>${sheet(ctx, {
    title: ctx.t('market.title'),
    cls: 'center market',
    back: 'shop',
    body,
    footer: `<span class="price-big">${coins(ctx, m.price)}</span>${btn(ctx.t('market.buy'), { cls: 'primary', icon: 'check', go: 'hud' })}`,
  })}`;
}

// ---- Charts (statistics, PRD §11.8) --------------------------------------------------------------------------------

/** Chart size in viewBox units: narrower on phones, so text stays readable when the chart is scaled to fit. */
const chartBox = (ctx) => (ctx.layout === 'phone' ? { w: 340, h: 190, l: 40, r: 8, t: 10, b: 24 } : { w: 560, h: 200, l: 44, r: 12, t: 12, b: 26 });
/** Categorical slots: blue, orange, aqua (validated on the panel colour; series are always labelled too). */
const SERIES = ['#2a78d6', '#eb6834', '#1baf7a'];

function axisY(ctx, max, steps = 4) {
  const { w, h, l, r, t, b } = chartBox(ctx);
  let out = '';
  for (let i = 0; i <= steps; i++) {
    const v = (max / steps) * i;
    const y = h - b - ((h - t - b) * i) / steps;
    out += `<line x1="${l}" x2="${w - r}" y1="${y}" y2="${y}" class="grid"/><text x="${l - 6}" y="${y + 4}" class="tick" text-anchor="end">${num(ctx, Math.round(v))}</text>`;
  }
  return out;
}

const niceMax = (v) => {
  const p = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / p) * p;
};

/** A line chart, one or more series, with labels at the line ends and hover titles per point. */
export function lineChart(ctx, series, { labels = [], names = [], max } = {}) {
  const { w, h, l, r, t, b } = chartBox(ctx);
  const top = max ?? niceMax(Math.max(...series.flat()));
  const n = series[0].length;
  const x = (i) => l + ((w - l - r) * i) / (n - 1);
  const y = (v) => h - b - ((h - t - b) * v) / top;
  let svg = axisY(ctx, top);
  series.forEach((s, k) => {
    const pts = s.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    svg += `<polyline points="${pts}" fill="none" stroke="${SERIES[k]}" stroke-width="2" stroke-linejoin="round"/>`;
    svg += s.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="7" class="hit"><title>${labels[i] ?? ''} ${names[k] ?? ''}: ${num(ctx, v)}</title></circle>`).join('');
    svg += `<circle cx="${x(n - 1)}" cy="${y(s[n - 1])}" r="4" fill="${SERIES[k]}" stroke="#fffaf0" stroke-width="2"/>`;
  });
  const every = Math.ceil(n / (ctx.layout === 'phone' ? 4 : 6));
  labels.forEach((lab, i) => {
    if (i % every === 0 || i === n - 1) svg += `<text x="${x(i)}" y="${h - 8}" class="tick" text-anchor="middle">${lab}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img">${svg}</svg>`;
}

/** Grouped bars: income and expenses per month. */
export function barChart(ctx, groups, { labels = [], names = [] } = {}) {
  const { w, h, l, r, t, b } = chartBox(ctx);
  const every = (w - l - r) / groups.length < 34 ? 2 : 1;
  const top = niceMax(Math.max(...groups.flat()));
  const slot = (w - l - r) / groups.length;
  const bw = Math.min(14, (slot - 6) / groups[0].length - 2);
  let svg = axisY(ctx, top);
  groups.forEach((g, i) => {
    g.forEach((v, k) => {
      const bh = ((h - t - b) * v) / top;
      const x = l + slot * i + (slot - (bw + 2) * g.length) / 2 + k * (bw + 2);
      svg += `<path d="M${x},${h - b} v${-(bh - 4).toFixed(1)} q0,-4 4,-4 h${bw - 8} q4,0 4,4 v${(bh - 4).toFixed(1)} z" fill="${SERIES[k]}"><title>${labels[i]} ${names[k]}: ${num(ctx, v)}</title></path>`;
    });
    if (i % every === (groups.length - 1) % every) svg += `<text x="${l + slot * i + slot / 2}" y="${h - 8}" class="tick" text-anchor="middle">${labels[i]}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img">${svg}</svg>`;
}

const legend = (names) => `<div class="chart-legend">${names.map((n, k) => `<span><i style="background:${SERIES[k]}"></i>${n}</span>`).join('')}</div>`;

/** Horizontal bars with the value in text: shares, drivers, workloads. */
function hBars(rows) {
  return `<ul class="hbars">${rows
    .map((r) => `<li class="${r.tone ?? ''}"><span class="hb-label">${r.label}</span><span class="hb-track"><span class="hb-fill" style="width:${Math.min(100, r.value)}%"></span>${r.over ? `<span class="hb-over" style="left:${100 / r.over}%"></span>` : ''}</span><b>${r.text}</b>${r.note ? `<small>${r.note}</small>` : ''}</li>`)
    .join('')}</ul>`;
}

function statsScreen(ctx) {
  const st = ctx.data.stats;
  const tab = ['visitors', 'money', 'reputation', 'staff', 'food', 'welfare'].includes(ctx.variant) ? ctx.variant : 'money';
  const cal = calendarOf(ctx.data.zoo.minute);
  const monthLabels = st.months.map((_, i) => ctx.t(`calendar.monthShort.${((cal.month - 12 + i + 12) % 12) + 1}`));
  let body = '';
  if (tab === 'visitors') {
    const vis = st.days.map((d) => d.visitors);
    const avg = Math.round(vis.slice(-7).reduce((a, b) => a + b, 0) / 7);
    body = `<div class="tiles">${tile(ctx.t('stats.visitorsWeek'), num(ctx, avg))}${tile(ctx.t('stats.visitorHappiness'), ctx.t('ui.percent', { value: st.days.at(-1).happiness }))}</div>
    <h4>${ctx.t('stats.visitorsPerDay')}</h4>${lineChart(ctx, [vis], { labels: st.days.map((_, i) => ctx.t('stats.dayN', { n: i + 1 })), names: [ctx.t('stats.visitors')] })}
    <h4>${ctx.t('stats.complaints')}</h4>${hBars(st.complaints.map((c) => ({ label: ctx.t(`complaint.${c.id}`), value: c.share * 100 * 2.5, text: ctx.t('ui.percent', { value: Math.round(c.share * 100) }) })))}`;
  } else if (tab === 'money') {
    const inc = st.months.map((m) => Object.values(m.income).reduce((a, b) => a + b, 0));
    const exp = st.months.map((m) => Object.values(m.expenses).reduce((a, b) => a + b, 0));
    const last = st.months.at(-1);
    const profit = inc.at(-1) - exp.at(-1);
    const names = [ctx.t('stats.income'), ctx.t('stats.expenses')];
    const cats = (o, kind) =>
      hBars(Object.entries(o).filter(([, v]) => v > 0).map(([k, v]) => ({ label: ctx.t(`money.${kind}.${k}`), value: (v / Math.max(...Object.values(o))) * 100, text: num(ctx, v) })));
    body = `<div class="tiles">${tile(names[0], coins(ctx, inc.at(-1)))}${tile(names[1], coins(ctx, exp.at(-1)))}${tile(ctx.t('stats.profit'), `<span class="${profit < 0 ? 'bad' : 'good'}">${profit > 0 ? '+' : ''}${num(ctx, profit)}</span>`)}</div>
    <h4>${ctx.t('stats.last12')}</h4>${legend(names)}${barChart(ctx, inc.map((v, i) => [v, exp[i]]), { labels: monthLabels, names })}
    <div class="two"><div><h4>${ctx.t('stats.incomeBy')}</h4>${cats(last.income, 'income')}</div><div><h4>${ctx.t('stats.expensesBy')}</h4>${cats(last.expenses, 'expense')}</div></div>
    <div class="callout">${icon('info')}<span>${ctx.t('stats.loan', { amount: num(ctx, 0), limit: num(ctx, 12400) })}</span>${btn(ctx.t('stats.borrow'), { cls: 'small' })}</div>`;
  } else if (tab === 'reputation') {
    body = `<div class="tiles">${tile(ctx.t('hud.reputationShort'), `${ctx.data.zoo.reputation}<small>/100</small>`)}</div>
    <h4>${ctx.t('stats.last12')}</h4>${lineChart(ctx, [st.reputation], { labels: monthLabels, names: [ctx.t('hud.reputationShort')], max: 100 })}
    <h4>${ctx.t('stats.repDrivers')}</h4>${hBars(st.reputationDrivers.map((d) => ({ label: ctx.t(`repDriver.${d.id}`), value: d.value, text: ctx.t('ui.percent', { value: d.value }), tone: d.value < 60 ? 'low' : '' })))}`;
  } else if (tab === 'staff') {
    body = `<p class="hint">${ctx.t('stats.workloadHint')}</p>${hBars(
      st.workload.map((w) => {
        const pct = w.capacity ? Math.round((w.work / w.capacity) * 100) : 0;
        return {
          label: `${ctx.t(`role.${w.role}.plural`)} <small>${ctx.t('stats.staffCount', { count: w.staff })}</small>`,
          value: w.capacity ? Math.min(100, (pct / 150) * 100) : 100,
          over: w.capacity ? 1.5 : 0,
          text: w.capacity ? ctx.t('stats.workload', { percent: pct }) : ctx.t('stats.noStaff'),
          tone: !w.capacity || pct > 100 ? 'bad' : pct > 85 ? 'low' : 'good',
          note: w.hire ? `${warningIcon('info', 'warn', { size: 16 })}${ctx.t('stats.hireHint', { count: w.hire, role: ctx.t(`role.${w.role}.${w.hire > 1 ? 'plural' : 'one'}`) })}` : ctx.t('stats.coping'),
        };
      }),
    )}${btn(ctx.t('staff.hire'), { icon: 'people', go: 'staff', cls: 'primary' })}`;
  } else if (tab === 'food') {
    body = `<p class="hint">${ctx.t('stats.foodHint')}</p>${hBars(
      ctx.data.shop.food
        .filter((f) => !f.locked)
        .map((f) => {
          const days = Math.floor(f.stock / f.perDay);
          return { label: ctx.t(`food.${f.id}`), value: Math.min(100, (days / 10) * 100), text: ctx.t('stats.daysLeft', { count: days }), tone: days < 2 ? 'bad' : days < 4 ? 'low' : 'good' };
        }),
    )}${btn(ctx.t('stats.buyFood'), { icon: 'shop', go: 'shop', variant: 'food' })}`;
  } else {
    const w = st.welfare;
    const total = w.happy + w.ok + w.unhappy;
    body = `<div class="tiles">${tile(ctx.t('stats.animals'), num(ctx, total))}${tile(ctx.t('welfare.sick'), num(ctx, w.sick))}${tile(ctx.t('welfare.pregnant'), num(ctx, w.pregnant))}</div>
    <h4>${ctx.t('stats.happinessSpread')}</h4>
    <div class="stack" role="img">${['happy', 'ok', 'unhappy'].map((k, i) => `<span class="seg s${i}" style="flex:${w[k]}" title="${ctx.t(`welfare.${k}`)}: ${w[k]}"></span>`).join('')}</div>
    <div class="chart-legend">${['happy', 'ok', 'unhappy'].map((k, i) => `<span><i class="s${i}"></i>${ctx.t(`welfare.${k}`)} <b>${w[k]}</b></span>`).join('')}</div>
    <div class="callout good">${starIcon(18)}<span>${ctx.t('stats.happyStar')}</span></div>`;
  }
  return sheet(ctx, {
    title: ctx.t('hud.stats'),
    cls: 'full stats',
    icon: icon('stats'),
    body: `${tabs(ctx, 'stats', ['money', 'visitors', 'reputation', 'staff', 'food', 'welfare'], tab, 'stats.tab')}<div class="tab-body">${body}</div>`,
  });
}

const tile = (label, value) => `<div class="tile"><small>${label}</small><b>${value}</b></div>`;

// ---- Staff ---------------------------------------------------------------------------------------------------------

function staffScreen(ctx) {
  const s = ctx.data.staff;
  const tab = ctx.variant === 'team' ? 'team' : 'hire';
  const roleIcon = { caretaker: 'bucket', janitor: 'broom', guard: 'shield', vet: 'cross' };
  const person = (p, hire) => `<li class="person-card">
    <span class="avatar r-${p.role}">${icon(roleIcon[p.role], { size: 22 })}</span>
    <div class="pc-main"><b>${esc(p.name)}</b><small>${ctx.t(`role.${p.role}.one`)}${p.zone ? ` · ${ctx.t(`zone.${p.zone}`)}` : ''}</small>
      <div class="pc-stats"><span>${ctx.t('staff.quality')} ${pips(p.quality)}</span><span>${ctx.t('staff.speed')} ${pips(p.speed)}</span></div>
      ${p.morale === 'unpaid' ? `<div class="callout warn small">${warningIcon('info', 'critical', { size: 18 })}<span>${ctx.t('staff.unpaid')}</span></div>` : ''}
    </div>
    <div class="pc-side"><span>${coins(ctx, p.wage)}<small>${ctx.t('staff.perMonth')}</small></span>${hire ? btn(ctx.t('staff.hireOne'), { cls: 'primary small' }) : btn(ctx.t('staff.zone'), { cls: 'small', icon: 'map', go: 'zones' })}</div>
  </li>`;
  const body =
    tab === 'hire'
      ? `<p class="hint">${icon('clock', { size: 14 })}${ctx.t('staff.refresh', { count: s.refreshDays })}</p>
         <div class="callout warn">${warningIcon('info', 'warn', { size: 20 })}<span>${ctx.t('alert.workload', { role: ctx.t('role.caretaker.plural'), percent: 140 })} ${ctx.t('stats.hireHint', { count: 1, role: ctx.t('role.caretaker.one') })}</span></div>
         <ul class="people">${s.candidates.map((p) => person(p, true)).join('')}</ul>`
      : `<p class="hint">${ctx.t('staff.wages', { amount: num(ctx, s.team.reduce((a, p) => a + p.wage, 0)) })}</p><ul class="people">${s.team.map((p) => person(p, false)).join('')}</ul>`;
  return sheet(ctx, { title: ctx.t('staff.title'), cls: 'full staff', icon: icon('people'), body: `${tabs(ctx, 'staff', ['hire', 'team'], tab, 'staff.tab')}<div class="tab-body">${body}</div>` });
}

/** Work zones on the overview: the zone being edited is outlined in the world (the page draws it). */
function zonesScreen(ctx) {
  const s = ctx.data.staff;
  const zoneRows = s.zones
    .map((z) => `<li><button type="button" class="zone" aria-pressed="${z.id === 'farm'}"><i style="background:${z.color}"></i><span><b>${ctx.t(`zone.${z.id}`)}</b><small>${ctx.t('zone.staff', { count: s.team.filter((p) => p.zone === z.id).length })}</small></span></button></li>`)
    .join('');
  return `<div class="build-mode">${icon('map', { size: 18 })}${ctx.t('zone.mode')}</div>
  ${sheet(ctx, {
    title: ctx.t('zone.title'),
    cls: 'side small zones',
    icon: icon('map'),
    back: 'staff',
    body: `<p class="hint">${ctx.t('zone.hint')}</p><ul class="zone-list">${zoneRows}</ul>
    <h4>${ctx.t('zone.assigned', { zone: ctx.t('zone.farm') })}</h4>
    <ul class="checks">${['Marta']
      .map((n) => `<li><label class="toggle"><input type="checkbox" checked><span class="switch"></span><span>${n} · ${ctx.t('role.caretaker.one')}</span></label></li>`)
      .join('')}<li><label class="toggle"><input type="checkbox"><span class="switch"></span><span>Ola · ${ctx.t('role.janitor.one')}</span></label></li></ul>`,
    footer: `${btn(ctx.t('zone.new'), { icon: 'plus' })}${btn(ctx.t('build.done'), { icon: 'check', cls: 'primary', go: 'staff', variant: 'team' })}`,
  })}`;
}

// ---- Goals, tips, naming, level-up -----------------------------------------------------------------------------------

function goalsScreen(ctx) {
  const g = ctx.data.goals;
  if (ctx.variant === 'goals') {
    return sheet(ctx, {
      title: ctx.t('goals.title'),
      cls: 'side small goals',
      icon: icon('flag'),
      body: `<p class="hint">${ctx.t('goals.hint')}</p><div class="goal-cards">${g.active.map((x) => `<div class="goal-card">${goalRow(ctx, x)}</div>`).join('')}</div>`,
    });
  }
  const current = g.tutorial.findIndex((x) => !x.done);
  return `<section class="tutorial" aria-label="${ctx.t('tutorial.title')}">
    <header><span class="tut-step">${ctx.t('tutorial.step', { n: current + 1, total: g.tutorial.length })}</span><h2>${ctx.t('tutorial.title')}</h2>${btn(ctx.t('tutorial.skip'), { cls: 'ghost small', go: 'goals', variant: 'goals' })}</header>
    <ol class="tut-list">${g.tutorial.map((x, i) => `<li class="${x.done ? 'done' : i === current ? 'now' : ''}">${goalRow(ctx, x)}</li>`).join('')}</ol>
    <footer>${ctx.t('tutorial.reward')} ${coins(ctx, g.tutorialReward)}</footer>
  </section>
  <div class="pointer" data-anchor="sheep-feeder"><span class="pointer-ring"></span><span class="pointer-label">${ctx.t('tutorial.here')}</span></div>`;
}

function tipScreen(ctx) {
  const tip = ctx.data.goals.tip;
  return `<section class="tip" role="dialog" aria-label="${ctx.t('tip.title')}">
    <span class="tip-icon">${icon(tip.icon, { size: 28 })}</span>
    <div><small>${ctx.t('tip.title')}</small><h3>${ctx.t(`${tip.key}.title`)}</h3><p>${ctx.t(tip.key)}</p></div>
    <div class="tip-actions">${btn(ctx.t('tip.gotIt'), { cls: 'primary', go: 'hud' })}</div>
  </section>`;
}

function nameScreen(ctx) {
  const n = ctx.data.naming;
  const v = ['zoo', 'animal', 'baby'].includes(ctx.variant) ? ctx.variant : 'zoo';
  const value = v === 'zoo' ? n.zoo : v === 'animal' ? n.animal : n.baby.suggestion;
  const art = v === 'zoo' ? `<span class="art big">${icon('flag', { size: 40 })}</span>` : portrait(v === 'baby' ? n.baby.species : ctx.data.animal.species, { size: 96 });
  const sub = v === 'baby' ? ctx.t('name.baby.sub', { species: speciesName(ctx, n.baby.species), mother: 'Waddles' }) : v === 'animal' ? speciesName(ctx, ctx.data.animal.species) : ctx.t('name.zoo.sub');
  return `<div class="modal-back"></div><section class="dialog naming" role="dialog" aria-label="${ctx.t(`name.${v}.title`)}">
    ${v === 'baby' ? `<div class="hearts" aria-hidden="true">${icon('hearts', { size: 28 })}</div>` : ''}
    ${art}
    <h2>${ctx.t(`name.${v}.title`)}</h2><p class="sub">${sub}</p>
    <div class="name-field"><input type="text" value="${esc(value)}" maxlength="${n.max}" aria-label="${ctx.t('name.label')}">${btn(ctx.t('name.random'), { icon: 'dice', iconOnly: true, cls: 'ghost round' })}</div>
    <small class="count">${ctx.t('name.count', { n: value.length, max: n.max })}</small>
    <div class="dialog-actions">${v === 'zoo' ? '' : btn(ctx.t('ui.cancel'), { go: 'hud' })}${btn(ctx.t(v === 'zoo' ? 'name.zoo.start' : 'name.save'), { cls: 'primary', go: 'hud', icon: 'check' })}</div>
  </section>`;
}

function levelUpScreen(ctx) {
  const lu = ctx.data.levelUp;
  const ribbon = ctx.variant === 'ribbon';
  const confetti = Array.from({ length: 36 }, (_, i) => `<i style="--x:${(i * 37) % 100};--d:${(i * 13) % 10};--c:${i % 5}"></i>`).join('');
  const unlock = (u) => {
    const art = u.kind === 'species' ? portrait(u.id, { size: 48 }) : u.kind === 'biome' ? `<span class="swatch big b-${u.id}"></span>` : `<span class="art">${icon('home', { size: 24 })}</span>`;
    const name = u.kind === 'species' ? speciesName(ctx, u.id) : ctx.t(`${u.kind}.${u.id}`);
    return `<li>${art}<span><small>${ctx.t(`levelup.kind.${u.kind}`)}</small><b>${name}</b></span></li>`;
  };
  if (ribbon) {
    return `<div class="confetti" aria-hidden="true">${confetti}</div><div class="modal-back light"></div>
    <section class="dialog ribbon-card" role="dialog" aria-label="${ctx.t('levelup.ribbon.title', { biome: ctx.t('biome.wetland') })}">
      <div class="ribbon" aria-hidden="true"><span class="ribbon-l"></span><span class="scissors">✂</span><span class="ribbon-r"></span></div>
      <small>${ctx.t('levelup.ribbon.kicker')}</small>
      <h2>${ctx.t('levelup.ribbon.title', { biome: ctx.t('biome.wetland') })}</h2>
      <p>${ctx.t('levelup.ribbon.body')}</p>
      <div class="dialog-actions">${btn(ctx.t('levelup.ribbon.cut'), { cls: 'primary', go: 'shop', variant: 'enclosures', icon: 'sparkle' })}</div>
    </section>`;
  }
  return `<div class="confetti" aria-hidden="true">${confetti}</div><div class="modal-back light"></div>
  <section class="dialog levelup" role="dialog" aria-label="${ctx.t('levelup.title', { level: lu.level })}">
    <div class="burst"><span>${lu.level}</span></div>
    <h2>${ctx.t('levelup.title', { level: lu.level })}</h2>
    <p class="reward">${ctx.t('levelup.reward')} ${stars(ctx, lu.stars)}</p>
    <h4>${ctx.t('levelup.unlocked')}</h4><ul class="unlocks">${lu.unlocks.map(unlock).join('')}</ul>
    <div class="dialog-actions">${btn(ctx.t('levelup.continue'), { cls: 'primary', go: 'levelup', variant: 'ribbon' })}</div>
  </section>`;
}

// ---- Overview badges (PRD §17.1) -------------------------------------------------------------------------------------

function badgesScreen(ctx) {
  const list = (ctx.badges ?? [])
    .map((b) => `<button type="button" class="badge" data-anchor="enc:${b.id}" data-go="badge-list" aria-label="${speciesName(ctx, b.species)} ×${b.count}">
      ${portrait(b.species, { size: 30 })}<b>${b.count}</b>${b.warnings.map((w) => warningIcon(w.kind, w.level, { size: 20, label: ctx.t(`warning.${w.kind}`) })).join('')}
    </button>`)
    .join('');
  return `<div class="badges">${list}</div>`;
}

function badgeListScreen(ctx) {
  const badge = (ctx.badges ?? []).find((b) => b.id === ctx.data.badgeFocus) ?? ctx.badges?.[0];
  const animals = [
    ['Leo', 'male', 'adult', 34, 'hunger'],
    ['Nala', 'female', 'adult', 71, 'info'],
    ['Kiara', 'female', 'juvenile', 88, null],
  ];
  const rows = animals
    .map(([name, sex, stage, food, warn]) => `<li><button type="button" class="animal-row" data-go="animal">${portrait('lion', { size: 40 })}<span><b>${name} ${sexMark(ctx, sex)}</b><small>${ctx.t(`stage.${stage}`)}</small></span>
      <span class="mini-stats"><span class="mini" title="${ctx.t('stat.hunger')}"><span style="width:${food}%"></span></span></span>${warn ? warningIcon(warn, 'warn', { size: 22, label: ctx.t(`warning.${warn}`) }) : ''}${icon('next', { size: 18 })}</button></li>`)
    .join('');
  return `${badgesScreen(ctx)}<div class="popover" data-anchor="${badge ? `enc:${badge.id}` : ''}" role="dialog" aria-label="${placeName(ctx, { biome: 'african-savanna', n: 2 })}">
    <header><b>${placeName(ctx, { biome: 'african-savanna', n: 2 })}</b><small>${ctx.t('badge.count', { count: 3, species: speciesName(ctx, 'lion') })}</small>${btn(ctx.t('ui.close'), { icon: 'close', iconOnly: true, go: 'badges', cls: 'ghost round small' })}</header>
    <ul class="animal-rows">${rows}</ul>
    <footer>${btn(ctx.t('badge.goThere'), { icon: 'walk', go: 'travel', variant: 'moving', cls: 'small' })}${btn(ctx.t('badge.enclosure'), { icon: 'info', cls: 'small' })}</footer>
  </div>`;
}

// ---- Zoopedia (PRD §14) ---------------------------------------------------------------------------------------------

const marks = (ctx, m) => `<span class="marks">${['bronze', 'silver', 'gold'].map((k) => `<i class="mark ${k} ${m[k] ? 'on' : ''}" title="${ctx.t(`mark.${k}`)}"></i>`).join('')}</span>`;

function zoopediaScreen(ctx) {
  const entries = ctx.data.zoopedia;
  const owned = entries.filter((e) => e.status === 'owned').length;
  const v1 = entries.filter((e) => e.status !== 'soon');
  const show = ctx.variant === 'owned' ? entries.filter((e) => e.status === 'owned') : [...v1, ...entries.filter((e) => e.status === 'soon').slice(0, 6)];
  const biomes = ['all', 'farmyard', 'african-savanna', 'asian-jungle', 'polar', 'coast', 'wetland', 'reptile-house', 'aviary'];
  const cards = show
    .map((e) => {
      const known = e.status === 'owned' || e.status === 'available';
      const sub = e.status === 'owned' ? ctx.t('zoopedia.owned', { count: e.count }) : e.status === 'available' ? ctx.t('zoopedia.available') : e.status === 'soon' ? ctx.t('zoopedia.soon') : ctx.t('ui.unlocksAt', { level: e.unlockLevel });
      return `<li><button type="button" class="sp-card ${e.status}" data-go="species" data-variant="${e.status === 'owned' ? 'owned' : 'locked'}">${portrait(e.id, { size: 64, silhouette: !known })}<b>${speciesName(ctx, e.id)}</b><small>${e.status === 'soon' || e.status === 'locked' ? icon('lock', { size: 12 }) : ''}${sub}</small>${e.status === 'owned' ? marks(ctx, e.marks) : ''}</button></li>`;
    })
    .join('');
  return sheet(ctx, {
    title: ctx.t('hud.zoopedia'),
    cls: 'full zoopedia',
    icon: icon('book'),
    body: `<div class="zp-top"><label class="search">${icon('search', { size: 18 })}<input type="search" placeholder="${ctx.t('zoopedia.search')}"></label><span class="progress-text">${ctx.t('zoopedia.progress', { owned, total: entries.length })}</span></div>
    ${tabs(ctx, 'zoopedia', ['all', 'owned'], ctx.variant === 'owned' ? 'owned' : 'all', 'zoopedia.tab')}
    <div class="biome-filter">${biomes.map((b, i) => `<button type="button" class="biome-chip small" aria-pressed="${i === 0}">${b === 'all' ? ctx.t('zoopedia.allBiomes') : `<span class="swatch b-${b}"></span>${ctx.t(`biome.short.${b}`)}`}</button>`).join('')}</div>
    <ul class="sp-grid">${cards}</ul>`,
  });
}

function speciesScreen(ctx) {
  const locked = ctx.variant === 'locked';
  const sp = locked ? { id: 'bengal-tiger' } : ctx.data.species;
  const entry = ctx.data.zoopedia.find((e) => e.id === sp.id);
  const meta = SPECIES_BY_ID[sp.id];
  const markRow = ['bronze', 'silver', 'gold']
    .map((k) => `<li class="mark-row ${entry.marks[k] ? 'on' : ''}"><i class="mark ${k} ${entry.marks[k] ? 'on' : ''}"></i><span><b>${ctx.t(`mark.${k}`)}</b><small>${ctx.t(`mark.${k}.how`)}</small></span>${entry.marks[k] ? icon('check', { size: 18 }) : ''}</li>`)
    .join('');
  const body = locked
    ? `<div class="sp-hero locked">${portrait(sp.id, { size: 200, silhouette: true })}</div>
       <h3>${speciesName(ctx, sp.id)}</h3><p class="sub"><i>${meta.scientific}</i></p>
       <div class="callout">${icon('lock')}<span>${ctx.t('zoopedia.lockedHow', { level: entry.unlockLevel, biome: ctx.t(`biome.${meta.biome}`) })}</span></div>
       <ul class="mark-list">${markRow}</ul>`
    : `<div class="sp-hero">${portrait(sp.id, { size: 200 })}${btn(ctx.t('zoopedia.listen'), { icon: 'volume', cls: 'round listen', iconOnly: true })}</div>
       <h3>${speciesName(ctx, sp.id)}</h3><p class="sub"><i>${meta.scientific}</i> · ${ctx.t(`biome.${meta.biome}`)}</p>
       <ul class="mark-list">${markRow}</ul>
       <dl class="facts">
         <dt>${ctx.t('zoopedia.status')}</dt><dd><span class="iucn i-${sp.status}">${sp.status}</span> ${ctx.t(`iucn.${sp.status}`)}</dd>
         <dt>${ctx.t('zoopedia.range')}</dt><dd>${ctx.t(sp.range)}</dd>
         <dt>${ctx.t('zoopedia.diet')}</dt><dd>${ctx.t(`diet.${sp.diet}`)} · ${ctx.t('zoopedia.portions', { count: sp.portions })}</dd>
         <dt>${ctx.t('zoopedia.lifespan')}</dt><dd>${ctx.t('zoopedia.years', { count: sp.lifespan })}</dd>
         <dt>${ctx.t('zoopedia.gestation')}</dt><dd>${ctx.t('zoopedia.days', { count: sp.gestationDays })}</dd>
       </dl>
       <h4>${ctx.t('zoopedia.facts')}</h4><ul class="fact-list">${sp.facts.map((f) => `<li>${icon('sparkle', { size: 16 })}${ctx.t(f)}</li>`).join('')}</ul>
       <h4>${ctx.t('zoopedia.photos')}</h4><div class="photos">${[0, 1, 2].map((i) => `<span class="photo-thumb p${i}">${portrait(sp.id, { size: 72 })}</span>`).join('')}</div>`;
  return sheet(ctx, { title: ctx.t('hud.zoopedia'), cls: 'full species', icon: icon('book'), back: 'zoopedia', body: `<div class="sp-page">${body}</div>` });
}

// ---- Photo mode (PRD §14) --------------------------------------------------------------------------------------------

function photoScreen(ctx) {
  const ph = ctx.data.photo;
  const taken = ctx.variant === 'taken';
  return `<div class="photo-frame" aria-hidden="true"><i class="third v1"></i><i class="third v2"></i><i class="third h1"></i><i class="third h2"></i><span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span></div>
  <div class="photo-top">${btn(ctx.t('photo.exit'), { icon: 'close', go: 'hud', cls: 'glass', key: 'escape' })}<span class="photo-hint glass">${icon('sparkle', { size: 16 })}${ctx.t('photo.goal', { species: speciesName(ctx, ph.goldNeeds) })}</span></div>
  <div class="photo-tools glass" role="toolbar">
    ${btn(ctx.t('photo.rotate'), { icon: 'rotate', iconOnly: true, cls: 'round' })}
    ${btn(ctx.t('photo.time'), { icon: 'sunrise', iconOnly: true, cls: 'round' })}
    ${btn(ctx.t('photo.grid'), { icon: 'frame', iconOnly: true, cls: 'round', pressed: true })}
    <label class="zoom">${icon('zoomin', { size: 18 })}<input type="range" min="0" max="100" value="55" aria-label="${ctx.t('photo.zoom')}"></label>
  </div>
  <div class="photo-shoot">
    <button type="button" class="gallery" aria-label="${ctx.t('photo.gallery')}">${portrait(ph.subject, { size: 44 })}<span class="count">${ph.taken}</span></button>
    <button type="button" class="shutter" data-go="photo" data-variant="taken" aria-label="${ctx.t('photo.take')}"><span></span></button>
    <span class="photo-spacer"></span>
  </div>
  ${
    taken
      ? `<section class="toast photo-saved" role="status"><span class="flash"></span>${portrait(ph.subject, { size: 56 })}<div><b>${ctx.t('photo.saved', { species: speciesName(ctx, ph.subject) })}</b><small><i class="mark gold on"></i>${ctx.t('photo.gold')}</small></div><div class="toast-actions">${btn(ctx.t('photo.download'), { icon: 'download', cls: 'small' })}${btn(ctx.t('photo.share'), { icon: 'share', cls: 'small' })}</div></section>`
      : ''
  }`;
}

// ---- Settings, slots, pause (PRD §18, §19) ---------------------------------------------------------------------------

function settingsScreen(ctx) {
  const s = ctx.data.settings;
  const seg = (name, list, cur, labelKey) => `<div class="seg" role="radiogroup" aria-label="${name}">${list.map((id) => `<button type="button" role="radio" aria-checked="${id === cur}">${ctx.t(`${labelKey}.${id}`)}</button>`).join('')}</div>`;
  const slider = (label, value, ic) => `<label class="slider">${icon(ic, { size: 18 })}<span>${label}</span><input type="range" min="0" max="100" value="${value}"><b>${ctx.t('ui.percent', { value })}</b></label>`;
  return `<div class="modal-back"></div>${sheet(ctx, {
    title: ctx.t('settings.title'),
    cls: 'center settings',
    icon: icon('gear'),
    back: 'pause',
    body: `<section class="set-group"><h4>${icon('sparkle', { size: 16 })}${ctx.t('settings.graphics')}</h4>${seg(ctx.t('settings.graphics'), ['low', 'medium', 'high'], s.quality, 'quality')}<p class="hint">${ctx.t('settings.auto', { quality: ctx.t(`quality.${s.auto}`) })}</p></section>
    <section class="set-group"><h4>${icon('volume', { size: 16 })}${ctx.t('settings.audio')}</h4>${slider(ctx.t('settings.music'), s.music, 'music')}${slider(ctx.t('settings.sound'), s.sound, 'volume')}<label class="toggle"><input type="checkbox" ${s.muted ? 'checked' : ''}><span class="switch"></span><span>${ctx.t('settings.mute')}</span></label></section>
    <section class="set-group"><h4>${icon('globe', { size: 16 })}${ctx.t('settings.language')}</h4>${seg(ctx.t('settings.language'), ['en', 'cs'], s.language, 'language')}</section>
    <section class="set-group"><h4>${icon('eye', { size: 16 })}${ctx.t('settings.accessibility')}</h4><label class="toggle"><input type="checkbox" ${s.reducedMotion ? 'checked' : ''}><span class="switch"></span><span>${ctx.t('settings.reducedMotion')}</span></label><p class="hint">${ctx.t('settings.warningShapes')}</p><div class="shape-row">${WARNING_KINDS.slice(0, 6).map((k) => warningIcon(k, 'warn', { size: 24 })).join('')}</div></section>
    <section class="set-group">${btn(ctx.t('settings.controls'), { icon: 'keyboard', go: 'controls' })}${btn(ctx.t('settings.tutorial'), { icon: 'restart' })}</section>
    <p class="version">${ctx.t('settings.version', { version: '0.3.0' })}</p>`,
  })}`;
}

function slotsScreen(ctx) {
  const full = ctx.variant === 'full';
  const storage = full ? ctx.data.storageFull : ctx.data.storage;
  const pct = Math.round((storage.used / storage.quota) * 100);
  const nearly = storage.used / storage.quota >= 0.8;
  const rows = ctx.data.slots
    .map(
      (s) => `<li class="slot ${s.current ? 'current' : ''}"><canvas class="thumb" data-thumb="${s.seed}" width="96" height="72" aria-hidden="true"></canvas>
      <div class="slot-main"><b>${esc(s.name)}</b><small>${ctx.t('slots.meta', { day: s.day, level: s.level })}</small><small>${ctx.t('slots.saved', { when: ago(ctx, s.savedAgo) })} · ${ctx.t('slots.size', { kb: num(ctx, Math.round(s.bytes / 1024)) })}</small></div>
      <div class="slot-actions">${btn(ctx.t(s.current ? 'slots.playing' : 'slots.load'), { cls: s.current ? 'small' : 'primary small', disabled: s.current, go: 'hud' })}${btn(ctx.t('slots.export'), { icon: 'download', iconOnly: true, cls: 'ghost round small' })}${btn(ctx.t('slots.delete'), { icon: 'trash', iconOnly: true, cls: 'ghost round small bad' })}</div></li>`,
    )
    .join('');
  return `<div class="modal-back"></div>${sheet(ctx, {
    title: ctx.t('slots.title'),
    cls: 'center slots',
    icon: icon('save'),
    back: 'pause',
    body: `<div class="storage ${nearly ? 'nearly' : ''}"><span class="storage-label">${icon('storage', { size: 16 })}${ctx.t('slots.storage', { percent: pct })}</span><span class="storage-bar"><span style="width:${pct}%"></span><i style="left:80%"></i></span><small>${ctx.t('slots.storageOf', { used: (storage.used / 1048576).toFixed(1), total: (storage.quota / 1048576).toFixed(0) })}</small></div>
    ${nearly ? `<div class="callout warn">${warningIcon('info', 'critical', { size: 20 })}<span>${ctx.t('slots.nearlyFull')}</span></div>` : ''}
    <ul class="slot-list">${rows}</ul>`,
    footer: `${btn(ctx.t('slots.new'), { icon: 'plus', cls: 'primary', go: 'name', variant: 'zoo' })}${btn(ctx.t('slots.import'), { icon: 'upload' })}`,
  })}`;
}

function pauseScreen(ctx) {
  const items = [
    ['resume', 'play', 'hud', 'primary'],
    ['save', 'save', 'hud', ''],
    ['slots', 'storage', 'slots', ''],
    ['settings', 'gear', 'settings', ''],
    ['controls', 'keyboard', 'controls', ''],
    ['quit', 'door', 'hud', 'ghost'],
  ];
  return `<div class="modal-back dark"></div><section class="pause" role="dialog" aria-label="${ctx.t('pause.title')}">
    <span class="paused-tag">${icon('pause', { size: 16 })}${ctx.t('pause.paused')}</span>
    <h2>${esc(ctx.data.zoo.name)}</h2>
    <p class="sub">${ctx.t('pause.autosaved', { when: ago(ctx, ctx.data.autosavedAgo) })}</p>
    <div class="pause-list">${items.map(([id, ic, go, cls]) => btn(ctx.t(`pause.${id}`), { icon: ic, go, cls: `wide ${cls}`, key: id === 'resume' ? 'escape' : '' })).join('')}</div>
  </section>`;
}

// ---- The screen list -----------------------------------------------------------------------------------------------

/**
 * Every screen: id (URL `screen=`), dev name, what the backdrop shows (`view`: near, far or photo; `scene` extras),
 * how much HUD stays visible, its variants (URL `variant=`), and its builder. `views` overrides the view per variant.
 * @type {{ id: string, name: string, view: 'near' | 'far' | 'photo', views?: Record<string, string>, hud: 'full' | 'dock' | 'top' | 'none', touch?: boolean,
 *   scene?: string, variants?: string[], render: (ctx: Ctx) => string }[]}
 */
export const SCREENS = [
  { id: 'hud', name: 'HUD', view: 'near', hud: 'full', render: hudScreen },
  { id: 'alerts', name: 'Alert feed', view: 'near', hud: 'top', render: alertsScreen },
  { id: 'warnings', name: 'Warning icons', view: 'near', hud: 'top', scene: 'warnings', render: warningsScreen },
  { id: 'animal', name: 'Animal details', view: 'near', hud: 'top', variants: ['overview', 'care', 'about'], render: animalScreen },
  { id: 'chore', name: 'Chore ring', view: 'near', hud: 'dock', render: choreScreen },
  { id: 'controls', name: 'Joystick & action', view: 'near', hud: 'dock', touch: true, render: controlsScreen },
  { id: 'travel', name: 'Quick-travel', view: 'near', views: { moving: 'far' }, hud: 'top', variants: ['list', 'moving'], render: travelScreen },
  { id: 'build', name: 'Build mode', view: 'far', hud: 'top', variants: ['valid', 'invalid', 'selected', 'sell'], render: buildScreen },
  { id: 'shop', name: 'Shop', view: 'near', hud: 'none', variants: ['animals', 'food', 'medicine', 'enclosures', 'equipment', 'facilities', 'decorations', 'conservation', 'stars'], render: shopScreen },
  { id: 'stars', name: 'Get stars', view: 'near', hud: 'top', render: starsScreen },
  { id: 'market', name: 'Market listing', view: 'near', hud: 'none', render: marketScreen },
  { id: 'stats', name: 'Statistics', view: 'near', hud: 'none', variants: ['money', 'visitors', 'reputation', 'staff', 'food', 'welfare'], render: statsScreen },
  { id: 'staff', name: 'Staff hiring', view: 'near', hud: 'none', variants: ['hire', 'team'], render: staffScreen },
  { id: 'zones', name: 'Work zones', view: 'far', hud: 'top', scene: 'zones', render: zonesScreen },
  { id: 'goals', name: 'Tutorial & goals', view: 'near', hud: 'top', variants: ['tutorial', 'goals'], render: goalsScreen },
  { id: 'tip', name: 'One-off tip', view: 'far', hud: 'dock', render: tipScreen },
  { id: 'name', name: 'Naming', view: 'near', hud: 'none', variants: ['zoo', 'animal', 'baby'], render: nameScreen },
  { id: 'levelup', name: 'Level-up', view: 'near', hud: 'top', variants: ['level', 'ribbon'], render: levelUpScreen },
  { id: 'badges', name: 'Overview badges', view: 'far', hud: 'dock', render: badgesScreen },
  { id: 'badge-list', name: 'Badge animal list', view: 'far', hud: 'top', render: badgeListScreen },
  { id: 'zoopedia', name: 'Zoopedia', view: 'near', hud: 'none', variants: ['all', 'owned'], render: zoopediaScreen },
  { id: 'species', name: 'Species page', view: 'near', hud: 'none', variants: ['owned', 'locked'], render: speciesScreen },
  { id: 'photo', name: 'Photo mode', view: 'photo', hud: 'none', variants: ['frame', 'taken'], render: photoScreen },
  { id: 'settings', name: 'Settings', view: 'near', hud: 'none', render: settingsScreen },
  { id: 'slots', name: 'Save slots', view: 'near', hud: 'none', variants: ['normal', 'full'], render: slotsScreen },
  { id: 'pause', name: 'Pause menu', view: 'near', hud: 'none', render: pauseScreen },
];

export const SCREEN_IDS = SCREENS.map((s) => s.id);

/**
 * Renders one screen with the HUD it keeps.
 * @param {Ctx} ctx
 * @param {string} id
 */
export function renderScreen(ctx, id) {
  const screen = SCREENS.find((s) => s.id === id) ?? SCREENS[0];
  const variant = screen.variants?.includes(ctx.variant) ? ctx.variant : (screen.variants?.[0] ?? '');
  const c = { ...ctx, variant, touch: ctx.touch || !!screen.touch };
  let hud = '';
  if (screen.id === 'chore' && c.touch) hud = renderHud({ ...c, touch: false }, { parts: 'dock' }) + touchControls(c, { ring: ctx.data.chore.progress, label: 'food' });
  else if (screen.hud === 'full' || screen.hud === 'dock') hud = renderHud(c, { parts: screen.hud });
  else if (screen.hud === 'top') hud = renderHud(c, { parts: 'top' });
  return { screen, variant, html: `<div class="hud ${screen.hud}">${hud}</div><div class="layer screen-${screen.id}">${screen.render(c)}</div>` };
}
