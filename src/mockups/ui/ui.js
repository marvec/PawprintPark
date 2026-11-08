// Mockup of the HUD and every UI screen (PRD §4, §6, §9, §11, §12, §14, §15, §18, §19): DOM over a static world
// backdrop, with fake data from fixture.js and all text from the strings table. Dev-only page:
// http://localhost:5427/mockups/ui/
//
// URL parameters (all screens are reachable by URL and by keyboard):
//   screen=<id> variant=<id>   e.g. screen=shop&variant=food (see SCREENS in screens.js)
//   device=fit|phone|phone-land|tablet|desktop   a device-sized stage; fit (default) uses the whole window
//   long=1 (pseudo-Czech text, about a third longer)   cvd=protan|deutan|tritan|gray (colour-vision check)
//   touch=0|1 (default: on for phone and tablet layouts)   backdrop=0 (no 3D world)   quality=low|medium|high
//   ui=0 (no dev panel)
// Keys: ←/→ screen, ↑/↓ variant, Shift+D device, Shift+L long text, Shift+C colour vision, Shift+T touch,
//   Shift+B backdrop, Shift+H panel. The game's own hotkeys work as in the game: N alerts, B shop, I stats, Z Zoopedia,
//   T quick-travel, C photo mode, K staff, G goals, M overview badges, Esc or P menu (or close), 0–3 speed.
// No game systems run here: nothing is computed from the data; buttons only move between screens.

import { generateMap } from '../../core/map.js';
import { createStrings } from '../../core/strings.js';
import { QUALITY_NAMES } from '../../data/quality.js';
import { createBackdrop, createPortraits } from './backdrop.js';
import { FIXTURE, overviewBadges } from './fixture.js';
import { HOTKEYS, renderScreen, SCREEN_IDS, SCREENS } from './screens.js';
import { showcaseWorld } from '../world/layout.js';

const params = new URLSearchParams(location.search);
const DEVICES = { fit: null, phone: [390, 844], 'phone-land': [844, 390], tablet: [1180, 820], desktop: [1440, 900] };
const CVD = ['none', 'protan', 'deutan', 'tritan', 'gray'];
const pick = (v, list, fallback) => (list.includes(v) ? v : fallback);

const state = {
  screen: pick(params.get('screen'), SCREEN_IDS, 'hud'),
  variant: params.get('variant') ?? '',
  device: pick(params.get('device'), Object.keys(DEVICES), 'fit'),
  long: params.get('long') === '1',
  cvd: pick(params.get('cvd'), CVD, 'none'),
  /** 'auto' turns touch controls on for phone and tablet layouts. */
  touch: { 0: 'off', 1: 'on' }[params.get('touch')] ?? 'auto',
  backdrop: params.get('backdrop') !== '0',
  quality: pick(params.get('quality'), QUALITY_NAMES, 'medium'),
  panel: params.get('ui') !== '0',
  layout: 'desktop',
};

const stage = document.getElementById('stage');
const ui = document.getElementById('ui');
const panel = document.getElementById('panel');
const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('backdrop'));

const backdrop = state.backdrop ? createBackdrop(canvas, { quality: state.quality }) : null;
if (!backdrop) canvas.style.display = 'none';
const portraits = createPortraits();
const badges = overviewBadges((backdrop?.zoo ?? showcaseWorld()).placements);

// ---- Layout --------------------------------------------------------------------------------------------------------

/** Sizes the stage for the device, and picks the layout from the stage's size. */
function fitStage() {
  const dims = DEVICES[state.device];
  document.body.classList.toggle('framed', !!dims);
  if (dims) {
    const [w, h] = dims;
    const s = Math.min(1, (innerWidth - 40) / w, (innerHeight - 40) / h);
    Object.assign(stage.style, { width: `${w}px`, height: `${h}px`, transform: `translate(-50%, -50%) scale(${s})` });
  } else {
    Object.assign(stage.style, { width: '', height: '', transform: '' });
  }
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  state.layout = w < 600 ? 'phone' : h < 500 ? 'phone-land' : w < 1280 ? 'tablet' : 'desktop';
  stage.dataset.layout = state.layout;
  stage.dataset.touch = touchOn() ? '1' : '0';
  stage.className = state.cvd === 'none' ? '' : `cvd-${state.cvd}`;
}

const touchOn = () => (state.touch === 'auto' ? state.layout !== 'desktop' : state.touch === 'on');

// ---- Rendering -----------------------------------------------------------------------------------------------------

let current = null;

function render() {
  fitStage();
  const { t } = createStrings('en', undefined, { long: state.long });
  const ctx = { t, long: state.long, data: FIXTURE, variant: state.variant, layout: state.layout, touch: touchOn(), badges };
  const out = renderScreen(ctx, state.screen);
  current = out;
  state.variant = out.variant;
  document.documentElement.lang = state.long ? 'cs' : 'en';
  ui.innerHTML = out.html;
  if (backdrop) {
    backdrop.setView(out.screen.views?.[out.variant] ?? out.screen.view);
    backdrop.setScene(out.screen.scene === 'zones' ? 'zones' : out.screen.id === 'build' ? out.variant : '', FIXTURE.staff.zones);
    backdrop.draw();
  }
  // Re-rendering can leave the stage scrolled (focus moves); keep it still, and show the selected tab.
  for (const el of [stage, ui, ...ui.querySelectorAll('.sheet, .layer, .hud')]) el.scrollTop = el.scrollLeft = 0;
  for (const sel of ui.querySelectorAll('[role=tab][aria-selected=true]')) {
    const bar = sel.parentElement;
    bar.scrollLeft = Math.max(0, sel.offsetLeft - (bar.clientWidth - sel.offsetWidth) / 2);
  }
  placeAnchors();
  fillPortraits();
  fillThumbnails();
  syncPanel();
  const q = new URLSearchParams(location.search);
  q.set('screen', state.screen);
  if (out.variant) q.set('variant', out.variant);
  else q.delete('variant');
  history.replaceState(null, '', `?${q}`);
}

/** Puts world-anchored elements over what they point at. */
function placeAnchors() {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  ui.querySelectorAll('[data-anchor]').forEach((el, i) => {
    const name = el.dataset.anchor;
    let p = backdrop?.project(name);
    // Without the backdrop, spread the anchors over the middle of the screen.
    if (!p) p = { x: w * (0.3 + ((i * 0.37) % 0.4)), y: h * (0.35 + ((i * 0.23) % 0.3)), visible: true };
    el.style.left = `${Math.round(p.x)}px`;
    el.style.top = `${Math.round(p.y)}px`;
    el.classList.toggle('hidden-anchor', !p.visible);
  });
}

const PAW = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#b5a48c" d="M12 13c3 0 6 3.5 6 6 0 1.6-1.4 2.2-3 1.6-1.1-.4-2-.6-3-.6s-1.9.2-3 .6c-1.6.6-3 0-3-1.6 0-2.5 3-6 6-6zM5.5 8a2 2.4 0 1 1 0 4.8 2 2.4 0 0 1 0-4.8zM18.5 8a2 2.4 0 1 1 0 4.8 2 2.4 0 0 1 0-4.8zM9 3.2a2.1 2.6 0 1 1 0 5.2 2.1 2.6 0 0 1 0-5.2zM15 3.2a2.1 2.6 0 1 1 0 5.2 2.1 2.6 0 0 1 0-5.2z"/></svg>')}`;

/** Species portraits from the real models; a paw for body plans that aren't built yet. */
function fillPortraits() {
  for (const img of ui.querySelectorAll('img[data-portrait]')) {
    const size = Number(img.getAttribute('width')) > 96 ? 256 : 128;
    const url = portraits.portrait(img.dataset.portrait, { silhouette: img.dataset.silhouette === '1', size });
    img.src = url ?? PAW;
    img.classList.toggle('paw', !url);
  }
}

const mapCache = new Map();
/** Slot thumbnails: a small map of each zoo's seed (the game will save a real screenshot). */
function fillThumbnails() {
  for (const c of ui.querySelectorAll('canvas[data-thumb]')) {
    const seed = Number(c.dataset.thumb);
    if (!mapCache.has(seed)) mapCache.set(seed, generateMap(seed));
    const map = mapCache.get(seed);
    const g = c.getContext('2d');
    const img = g.createImageData(c.width, c.height);
    // The south half of the map, where every zoo starts.
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const tx = Math.floor((x / c.width) * map.size);
        const tz = Math.floor(map.size * 0.45 + (y / c.height) * map.size * 0.55);
        const i = (y * c.width + x) * 4;
        const water = map.water[tz * map.size + tx];
        const hgt = map.heights[tz * (map.size + 1) + tx];
        const inStart = tx >= map.start.x0 && tx < map.start.x1 && tz >= map.start.z0 && tz < map.start.z1;
        const [r, gg, b] = water ? [127, 196, 207] : inStart ? [222, 205, 160] : [150 + hgt * 6, 192 + hgt * 3, 104];
        img.data.set([r, gg, b, 255], i);
      }
    }
    g.putImageData(img, 0, 0);
    g.fillStyle = 'rgb(79 128 72 / 0.8)';
    for (const tr of map.trees) {
      const y = ((tr.z - map.size * 0.45) / (map.size * 0.55)) * c.height;
      if (y >= 0) g.fillRect((tr.x / map.size) * c.width, y, 1.4, 1.4);
    }
  }
}

// ---- Navigation and input ------------------------------------------------------------------------------------------

function show(screen, variant = '') {
  state.screen = pick(screen, SCREEN_IDS, 'hud');
  state.variant = variant;
  render();
  // Keyboard users land on the new screen's first control.
  ui.querySelector('.layer [role=dialog] button, .layer button')?.focus({ preventScroll: true });
}

function step(list, cur, d) {
  const i = list.indexOf(cur);
  return list[(i + d + list.length) % list.length];
}

ui.addEventListener('click', (e) => {
  const el = /** @type {HTMLElement} */ (e.target).closest('[data-go]');
  if (el) show(el.dataset.go, el.dataset.variant ?? '');
});

addEventListener('keydown', (e) => {
  const typing = /** @type {HTMLElement} */ (e.target).matches?.('input[type=text], input[type=search]');
  if (typing && e.key !== 'Escape') return;
  const k = e.key.toLowerCase();
  if (e.shiftKey && !e.metaKey && !e.ctrlKey) {
    if (k === 'd') state.device = step(Object.keys(DEVICES), state.device, 1);
    else if (k === 'l') state.long = !state.long;
    else if (k === 'c') state.cvd = step(CVD, state.cvd, 1);
    else if (k === 't') state.touch = step(['auto', 'on', 'off'], state.touch, 1);
    else if (k === 'b') return location.assign(`?${new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(location.search)), backdrop: state.backdrop ? '0' : '1' })}`);
    else if (k === 'h') {
      state.panel = !state.panel;
      return syncPanel();
    } else return;
    e.preventDefault();
    return render();
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    e.preventDefault();
    return show(step(SCREEN_IDS, state.screen, e.key === 'ArrowRight' ? 1 : -1));
  }
  const variants = current?.screen.variants;
  if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && variants) {
    e.preventDefault();
    return show(state.screen, step(variants, state.variant, e.key === 'ArrowDown' ? 1 : -1));
  }
  // Esc closes whatever is open; from the HUD it opens the menu.
  if (k === 'escape') return show(state.screen === 'hud' ? 'pause' : 'hud');
  if (state.screen === 'hud' || current?.screen.hud === 'full') {
    if (HOTKEYS[k]) return show(HOTKEYS[k]);
    if ('0123'.includes(k) && k.length === 1) {
      FIXTURE.zoo.speed = Number(k);
      return render();
    }
    if (k === 'e' || k === ' ') return show('chore');
  }
});

addEventListener('resize', render);

// ---- Dev panel -----------------------------------------------------------------------------------------------------

function syncPanel() {
  panel.classList.toggle('hidden', !state.panel);
  if (!state.panel) return;
  const b = (label, attrs, on) => `<button type="button" ${attrs} aria-pressed="${!!on}">${label}</button>`;
  const variants = current?.screen.variants ?? [];
  const info = backdrop?.info();
  panel.innerHTML = `<h1>HUD and UI mockup</h1><p class="sub">Milestone 3 · fake data · ${state.layout} layout</p>
    <div class="label">Screen (←/→)</div><div class="row">${SCREENS.map((s) => b(s.name, `data-screen="${s.id}"`, s.id === state.screen)).join('')}</div>
    ${variants.length ? `<div class="label">Variant (↑/↓)</div><div class="row">${variants.map((v) => b(v, `data-variant="${v}"`, v === state.variant)).join('')}</div>` : ''}
    <div class="label">Device (Shift+D)</div><div class="row">${Object.keys(DEVICES).map((d) => b(d, `data-device="${d}"`, d === state.device)).join('')}</div>
    <div class="label">Text and accessibility</div><div class="row">${b('Long text (Shift+L)', 'data-long', state.long)}${b(`Touch: ${state.touch} (Shift+T)`, 'data-touch', touchOn())}</div>
    <div class="label">Colour vision (Shift+C)</div><div class="row">${CVD.map((c) => b(c, `data-cvd="${c}"`, c === state.cvd)).join('')}</div>
    <div class="keys">Game keys: N alerts, B shop, I stats, Z Zoopedia, T travel, C photo, K staff, G goals, M badges, E chore, Esc menu, 0–3 speed. Shift+B backdrop, Shift+H panel.</div>
    ${info ? `<div class="stats">Backdrop (${state.quality}): ${info.calls} draws · ${(info.triangles / 1000).toFixed(0)}k tris</div>` : ''}`;
}

panel.addEventListener('click', (e) => {
  const el = /** @type {HTMLElement} */ (e.target).closest('button');
  if (!el) return;
  if (el.dataset.screen) return show(el.dataset.screen);
  if (el.dataset.variant) return show(state.screen, el.dataset.variant);
  if (el.dataset.device) state.device = el.dataset.device;
  if (el.hasAttribute('data-long')) state.long = !state.long;
  if (el.hasAttribute('data-touch')) state.touch = step(['auto', 'on', 'off'], state.touch, 1);
  if (el.dataset.cvd) state.cvd = el.dataset.cvd;
  render();
});

render();

// ---- Debug helper --------------------------------------------------------------------------------------------------

Object.assign(globalThis, {
  __ui: {
    state,
    screens: SCREEN_IDS,
    /** The variants a screen has. */
    variants: (id) => SCREENS.find((s) => s.id === id)?.variants ?? [],
    show,
    setDevice(d) {
      state.device = pick(d, Object.keys(DEVICES), 'fit');
      render();
    },
    setLong(on = true) {
      state.long = !!on;
      render();
    },
    setCvd(c) {
      state.cvd = pick(c, CVD, 'none');
      render();
    },
    setTouch(on) {
      state.touch = on === undefined ? 'auto' : on ? 'on' : 'off';
      render();
    },
    /** Where each world-anchored element sits, and whether it's on screen. */
    anchors: () => [...ui.querySelectorAll('[data-anchor]')].map((el) => ({ anchor: el.dataset.anchor, x: parseInt(el.style.left), y: parseInt(el.style.top), visible: !el.classList.contains('hidden-anchor') })),
    /** Elements that overflow the stage or their container: a quick check for long text. */
    overflow() {
      const box = stage.getBoundingClientRect();
      const out = [];
      for (const el of ui.querySelectorAll('.layer *, .hud *')) {
        const r = el.getBoundingClientRect();
        if (!r.width) continue;
        if (r.right > box.right + 1 || r.left < box.left - 1) out.push({ el: el.className || el.tagName, text: el.textContent.slice(0, 40), right: Math.round(r.right - box.right), left: Math.round(box.left - r.left) });
      }
      return out.filter((o) => !o.el.includes?.('hidden-anchor')).slice(0, 30);
    },
    backdrop: () => backdrop?.info() ?? null,
  },
});
