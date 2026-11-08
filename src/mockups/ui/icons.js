// Icons for the UI mockup, drawn as inline SVG in code (no asset files). Pure strings, so screens render under
// `bun test`.
//
// UI icons are round-capped strokes on a 24-unit grid, coloured by `currentColor`. Warning icons (PRD §6.2, §19)
// differ in **shape** as well as colour, so they read without colour: a circle for hunger, a drop for thirst, a cross
// for health, a heart for happiness, a hexagon for dirt, a triangle for fences, an octagon for escapes, a diamond for
// temperature and a rounded square for news. A warning is an outlined shape on a pale fill; a critical one is filled
// solid with a white glyph and a double ring, so severity also reads by lightness, not hue.

/** Stroke paths per UI icon (24×24). */
const PATHS = {
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0',
  shop: 'M5 8h14l-1 12H6zM9 8V6.5a3 3 0 0 1 6 0V8',
  stats: 'M4 20h16M7 17v-5M12 17V7M17 17v-8',
  book: 'M4 5.5C6.5 4.5 9.5 4.5 12 6v13c-2.5-1.5-5.5-1.5-8-.5zM20 5.5c-2.5-1-5.5-1-8 .5v13c2.5-1.5 5.5-1.5 8-.5z',
  menu: 'M5 7h14M5 12h14M5 17h14',
  pause: 'M9 6v12M15 6v12',
  play: 'M8 5.5v13l10-6.5z',
  close: 'M6 6l12 12M18 6L6 18',
  back: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  rotate: 'M19 12a7 7 0 1 1-2.05-4.95M19 4v4h-4',
  move: 'M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3',
  sell: 'M4 12l8-8h7v7l-8 8zM15.5 8.5h.01',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  camera: 'M4 8h3.5L9 5.5h6L16.5 8H20v11H4zM12 16.5a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1',
  save: 'M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6',
  trash: 'M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13',
  download: 'M12 4v11M7 10.5l5 5 5-5M5 20h14',
  upload: 'M12 16V5M7 9.5l5-5 5 5M5 20h14',
  share: 'M12 15V4M8 7.5l4-4 4 4M7 11H5v9h14v-9h-2',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5L20 20',
  heart: 'M12 19.5s-7.5-4.5-7.5-10A4 4 0 0 1 12 7a4 4 0 0 1 7.5 2.5c0 5.5-7.5 10-7.5 10z',
  edit: 'M5 19l1-4L16 5l3 3L9 18zM14 7l3 3',
  lock: 'M7 11h10v9H7zM9 11V8a3 3 0 0 1 6 0v3',
  dice: 'M5 5h14v14H5zM9 9h.01M15 9h.01M12 12h.01M9 15h.01M15 15h.01',
  pin: 'M12 21s-6-6.2-6-11a6 6 0 0 1 12 0c0 4.8-6 11-6 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  walk: 'M13 4.5h.01M10 21l2-6 3 3v3M12 15l-1-5 3-1 2 3h3M11 10l-3 2v3',
  people: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3.5 20a5.5 5.5 0 0 1 11 0M16 11a2.5 2.5 0 1 0 0-5M17 14a4.5 4.5 0 0 1 3.5 6',
  wrench: 'M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.5-7.5a4 4 0 0 1-2-2zM14.5 6.5L17 4',
  broom: 'M15 3l-4 9M7 12h8l2 8H5zM9 16v4M13 16v4',
  bucket: 'M5 8h14l-2 12H7zM5 8a7 3 0 0 1 14 0',
  pill: 'M5.5 18.5a3.5 3.5 0 0 1 0-5l8-8a3.5 3.5 0 0 1 5 5l-8 8a3.5 3.5 0 0 1-5 0zM9.5 9.5l5 5',
  food: 'M5 11h14a7 7 0 0 1-14 0zM9 4c0 2 2 2 2 4M13 4c0 2 2 2 2 4',
  water: 'M12 3.5s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
  rain: 'M7 15a4 4 0 0 1 .5-8 5 5 0 0 1 9.5 1.5A3.5 3.5 0 0 1 17 15zM8 18l-1 2.5M12 18l-1 2.5M16 18l-1 2.5',
  snow: 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M10 4.5l2 2 2-2M10 19.5l2-2 2 2',
  heat: 'M12 14V4.5a2 2 0 0 1 4 0V14a4 4 0 1 1-4 0zM14 10v7',
  moon: 'M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z',
  music: 'M9 18V6l10-2v12M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z',
  volume: 'M5 9.5h3l4-3.5v12l-4-3.5H5zM16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11',
  mute: 'M5 9.5h3l4-3.5v12l-4-3.5H5zM16 9.5l5 5M21 9.5l-5 5',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18',
  keyboard: 'M3 7h18v11H3zM7 10.5h.01M11 10.5h.01M15 10.5h.01M7 14.5h10',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  baby: 'M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM6 20c0-4 2.5-6 6-6s6 2 6 6M10 7.5h.01M14 7.5h.01',
  tree: 'M12 21v-5M6 16h12L12 3z',
  home: 'M4 11l8-7 8 7M6 9.5V20h12V9.5',
  flag: 'M6 21V4M6 4h11l-2 4 2 4H6',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5h.01',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  'eye-off': 'M4 4l16 16M10 6a9.6 9.6 0 0 1 2-.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.5 3.3M6.6 6.6C3.9 8.3 2.5 12 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4-1',
  tag: 'M4 12l8-8h7v7l-8 8zM15.5 8.5h.01',
  gift: 'M4 9h16v4H4zM5.5 13h13v7h-13zM12 9v11M12 9c-2-4-6-3-5-.5M12 9c2-4 6-3 5-.5',
  shield: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z',
  cross: 'M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z',
  fence: 'M5 20V6l2-2 2 2v14M15 20V6l2-2 2 2v14M3 10h18M3 15h18',
  ticket: 'M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4zM14 7v10',
  restart: 'M5 12a7 7 0 1 0 2.05-4.95M5 4v4h4',
  door: 'M6 20V4h9v16M15 20h3M12 12h.01M3 20h3',
  hand: 'M8 13V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6 7-2.5 0-4-1.5-5.5-4L4 13a1.5 1.5 0 0 1 2.5-1.5L8 13',
  cart: 'M3 15h13l3-5h2M5 15v2M16 15v2M7 19a2 2 0 1 0 0-4M17 19a2 2 0 1 0 0-4M7 10V6h7v4',
  map: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14',
  filter: 'M4 5h16l-6 8v6l-4-2v-4z',
  sort: 'M7 4v16M4 17l3 3 3-3M17 20V4M14 7l3-3 3 3',
  scale: 'M12 4v16M5 20h14M6 8h12M6 8l-3 6a3 3 0 0 0 6 0zM18 8l-3 6a3 3 0 0 0 6 0z',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z',
  zoomin: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5L20 20M10.5 8v5M8 10.5h5',
  sunrise: 'M4 18h16M7 18a5 5 0 0 1 10 0M12 4v4M5 10l1.5 1.5M19 10l-1.5 1.5',
  frame: 'M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4',
  hearts: 'M8 13s-4.5-2.5-4.5-6A2.4 2.4 0 0 1 8 5.5a2.4 2.4 0 0 1 4.5 1.5c0 3.5-4.5 6-4.5 6zM16 20s-4.5-2.5-4.5-6a2.4 2.4 0 0 1 4.5-1.5 2.4 2.4 0 0 1 4.5 1.5c0 3.5-4.5 6-4.5 6z',
  leaf: 'M5 19C5 10 10 5 20 4c-1 10-6 15-15 15zM5 19l7-7',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  storage: 'M4 6c0-1.5 3.6-2.5 8-2.5s8 1 8 2.5v12c0 1.5-3.6 2.5-8 2.5S4 19.5 4 18zM4 6c0 1.5 3.6 2.5 8 2.5S20 7.5 20 6M4 12c0 1.5 3.6 2.5 8 2.5s8-1 8-2.5',
};

/**
 * A UI icon.
 * @param {keyof typeof PATHS} name
 * @param {{ size?: number, cls?: string, label?: string }} [opts] `label` makes it announced; otherwise decorative
 */
export function icon(name, { size = 20, cls = '', label = '' } = {}) {
  const d = PATHS[name];
  if (!d) throw new Error(`No icon "${name}"`);
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return `<svg class="ic ${cls}" ${a11y} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
}

export const ICON_NAMES = Object.keys(PATHS);

/** ZooCoins: a gold coin with a Z struck through by two horizontal lines, like $ (PRD §11.1). */
export function coinIcon(size = 20) {
  return `<svg class="ic coin" aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#f2b33d" stroke="#c98a1c" stroke-width="1.6"/><circle cx="12" cy="12" r="7.4" fill="none" stroke="#fbd77a" stroke-width="1"/><path d="M8.3 7.6h7.4L8.3 16.4h7.4M7.2 10.6h9.6M7.2 13.4h9.6" fill="none" stroke="#8a5a0c" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/** Stars. */
export function starIcon(size = 20) {
  return `<svg class="ic star" aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24"><path d="M12 2.8l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.6l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" fill="#ffd34d" stroke="#d99a17" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
}

/** A paw print; `fill` 0–1 fills it from the left (reputation is shown as paws, PRD §11.3). */
export function pawIcon(size = 18, fill = 1, id = 'p') {
  const clip = fill < 1 ? `<clipPath id="paw-${id}"><rect x="0" y="0" width="${(24 * fill).toFixed(1)}" height="24"/></clipPath>` : '';
  const shape = 'M12 13c3 0 6 3.5 6 6 0 1.6-1.4 2.2-3 1.6-1.1-.4-2-.6-3-.6s-1.9.2-3 .6c-1.6.6-3-0-3-1.6 0-2.5 3-6 6-6zM5.5 8a2 2.4 0 1 1 0 4.8 2 2.4 0 0 1 0-4.8zM18.5 8a2 2.4 0 1 1 0 4.8 2 2.4 0 0 1 0-4.8zM9 3.2a2.1 2.6 0 1 1 0 5.2 2.1 2.6 0 0 1 0-5.2zM15 3.2a2.1 2.6 0 1 1 0 5.2 2.1 2.6 0 0 1 0-5.2z';
  return `<svg class="ic paw" aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24">${clip}<path d="${shape}" fill="#e4d6c0"/>${fill > 0 ? `<path d="${shape}" fill="#9a6a3e" ${fill < 1 ? `clip-path="url(#paw-${id})"` : ''}/>` : ''}</svg>`;
}

// ---- Warning icons -------------------------------------------------------------------------------------------------

/**
 * Each warning kind: its outline shape (on a 32 grid), its colour and the glyph drawn inside. Shapes are chosen to
 * stay distinct as silhouettes.
 */
export const WARNINGS = {
  hunger: { shape: 'circle', color: '#e07b28', glyph: 'M10 15h12a6 6 0 0 1-12 0zM14 9.5c0 1.5 1.3 1.5 1.3 3M18 9.5c0 1.5 1.3 1.5 1.3 3' },
  thirst: { shape: 'drop', color: '#2f7fd0', glyph: 'M12.5 19.5a4 4 0 0 0 3.5 3.5' },
  health: { shape: 'cross', color: '#d23f4a', glyph: '' },
  happiness: { shape: 'heart', color: '#b04fa8', glyph: 'M12.5 18.5c1-1.4 2.2-2 3.5-2s2.5.6 3.5 2M13.5 13.5h.01M18.5 13.5h.01' },
  dirt: { shape: 'hexagon', color: '#8a5a32', glyph: 'M12 21h8M13 18h6c0-1.5-1.3-2-3-2s-3 .5-3 2zM14.5 16c0-1.2.8-2 1.5-2.5' },
  fence: { shape: 'triangle', color: '#c98f12', glyph: 'M16 13v5M16 21.5h.01' },
  escape: { shape: 'octagon', color: '#c2321f', glyph: 'M11 16h10M17.5 12.5L21 16l-3.5 3.5' },
  temperature: { shape: 'diamond', color: '#1d9a8a', glyph: 'M16 18V11a1.6 1.6 0 0 1 3.2 0v7a3 3 0 1 1-3.2 0z' },
  info: { shape: 'square', color: '#4f7f3a', glyph: 'M16 15v6M16 11.5h.01' },
};

const SHAPES = {
  circle: 'M16 3.5a12.5 12.5 0 1 1 0 25 12.5 12.5 0 0 1 0-25z',
  drop: 'M16 2.5c4 5.5 10 10.5 10 16.5a10 10 0 0 1-20 0c0-6 6-11 10-16.5z',
  cross: 'M11.5 3.5h9v8h8v9h-8v8h-9v-8h-8v-9h8z',
  heart: 'M16 28.5S3 21 3 11.5A6.8 6.8 0 0 1 16 8a6.8 6.8 0 0 1 13 3.5C29 21 16 28.5 16 28.5z',
  hexagon: 'M16 2.5l11.7 6.75v13.5L16 29.5 4.3 22.75V9.25z',
  triangle: 'M16 3L30 28H2z',
  octagon: 'M10.6 3h10.8L29 10.6v10.8L21.4 29H10.6L3 21.4V10.6z',
  diamond: 'M16 2l14 14-14 14L2 16z',
  square: 'M8 3.5h16a4.5 4.5 0 0 1 4.5 4.5v16a4.5 4.5 0 0 1-4.5 4.5H8A4.5 4.5 0 0 1 3.5 24V8A4.5 4.5 0 0 1 8 3.5z',
};

export const WARNING_KINDS = Object.keys(WARNINGS);

/**
 * A warning icon.
 * @param {keyof typeof WARNINGS} kind
 * @param {'warn' | 'critical'} [level]
 * @param {{ size?: number, label?: string }} [opts]
 */
export function warningIcon(kind, level = 'warn', { size = 28, label = '' } = {}) {
  const w = WARNINGS[kind];
  if (!w) throw new Error(`No warning "${kind}"`);
  const critical = level === 'critical';
  const fill = critical ? w.color : '#fffaf0';
  const ink = critical ? '#ffffff' : w.color;
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  // The health cross is its own glyph: a white plus inside the cross outline when critical.
  const glyph = w.shape === 'cross' ? `<path d="M14.5 10.5h3v4h4v3h-4v4h-3v-4h-4v-3h4z" fill="${ink}"/>` : `<path d="${w.glyph}" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
  const ring = critical ? `<path d="${SHAPES[w.shape]}" fill="none" stroke="#fffaf0" stroke-width="1.4" transform="translate(16 16) scale(0.8) translate(-16 -16)"/>` : '';
  return `<svg class="warn warn-${kind} ${critical ? 'critical' : ''}" ${a11y} width="${size}" height="${size}" viewBox="0 0 32 32"><path d="${SHAPES[w.shape]}" fill="${fill}" stroke="${w.color}" stroke-width="${critical ? 2.4 : 2.6}" stroke-linejoin="round"/>${ring}${glyph}</svg>`;
}
