// Looking up UI text (PRD §19). Pure: `createStrings(lang)` returns `t(key, params)`. Missing keys fall back to
// English, then to the key itself, so a gap shows up on screen instead of crashing.

import { STRINGS } from '../data/strings.js';

/**
 * @param {string} lang
 * @param {Record<string, Record<string, import('../data/strings.js').StringValue>>} [table]
 * @param {{ long?: boolean }} [opts] `long` stretches every string to about Czech length (`stretchText`), for
 *   checking that layouts survive longer text before the translation exists
 */
export function createStrings(lang, table = STRINGS, { long = false } = {}) {
  const own = table[lang] ?? {};
  const fallback = table.en ?? {};
  const plurals = new Intl.PluralRules(lang);

  /**
   * @param {string} key
   * @param {Record<string, string | number>} [params] `count` picks a plural form
   */
  function t(key, params = {}) {
    let value = own[key] ?? fallback[key];
    if (value === undefined) return key;
    if (typeof value === 'object') {
      const form = typeof params.count === 'number' ? plurals.select(params.count) : 'other';
      value = value[form] ?? value.other ?? '';
    }
    if (long) value = stretchText(value);
    return value.replace(/\{(\w+)\}/g, (m, name) => (name in params ? String(params[name]) : m));
  }

  /** Whether the language has its own text for a key (not the English fallback). */
  const has = (key) => key in own;

  return { lang, t, has, long };
}

const ACCENTS = { a: 'á', c: 'č', d: 'ď', e: 'é', i: 'í', n: 'ň', o: 'ó', r: 'ř', s: 'š', t: 'ť', u: 'ů', y: 'ý', z: 'ž' };
const FILL = 'ěáíůéř';

/**
 * Pseudo-Czech: the same words with háčky and čárky and about a third more letters, which is roughly how much longer
 * Czech UI text runs than English. `{placeholders}` are left alone. Stretching is deterministic, so screenshots
 * don't change between runs.
 * @param {string} text
 * @param {number} [factor] extra length as a share of each word
 */
export function stretchText(text, factor = 0.35) {
  return text.replace(/\{\w+\}|[A-Za-z]+/g, (word) => {
    if (word.startsWith('{')) return word;
    let out = '';
    for (let i = 0; i < word.length; i++) {
      const ch = word[i];
      const lower = ch.toLowerCase();
      // Every other matching letter gets an accent, so words stay readable.
      const accented = i % 2 === 1 && ACCENTS[lower] ? ACCENTS[lower] : lower;
      out += ch === lower ? accented : accented.toUpperCase();
    }
    const extra = word.length >= 3 ? Math.round(word.length * factor) : 0;
    for (let i = 0; i < extra; i++) out += FILL[(word.length + i) % FILL.length];
    return out;
  });
}

/**
 * A calendar date in words, e.g. "1 March, year 1".
 * @param {{ day: number, month: number, year: number }} cal from `calendarOf`
 * @param {(key: string, params?: Record<string, string | number>) => string} t
 */
export function formatDate(cal, t) {
  return t('calendar.date', { day: cal.day, month: t(`calendar.month.${cal.month}`), year: cal.year });
}

/** The time of day, e.g. "7:05". */
export function formatTime(cal, t) {
  return t('calendar.time', { hour: cal.hour, minute: String(cal.minute).padStart(2, '0') });
}
