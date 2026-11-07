// Looking up UI text (PRD §19). Pure: `createStrings(lang)` returns `t(key, params)`. Missing keys fall back to
// English, then to the key itself, so a gap shows up on screen instead of crashing.

import { STRINGS } from '../data/strings.js';

/**
 * @param {string} lang
 * @param {Record<string, Record<string, import('../data/strings.js').StringValue>>} [table]
 */
export function createStrings(lang, table = STRINGS) {
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
    return value.replace(/\{(\w+)\}/g, (m, name) => (name in params ? String(params[name]) : m));
  }

  /** Whether the language has its own text for a key (not the English fallback). */
  const has = (key) => key in own;

  return { lang, t, has };
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
