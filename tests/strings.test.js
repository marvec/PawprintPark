import { describe, expect, test } from 'bun:test';
import { createStrings, formatDate, formatTime } from '../src/core/strings.js';
import { calendarOf, START_MINUTE } from '../src/core/time.js';
import { BIOMES } from '../src/data/world.js';
import { STRINGS } from '../src/data/strings.js';

describe('strings table', () => {
  const { t } = createStrings('en');

  test('fills placeholders', () => {
    expect(t('slots.storage', { percent: 42 })).toBe('Storage used: 42%');
  });

  test('picks plural forms by count, per language rules', () => {
    expect(t('calendar.days', { count: 1 })).toBe('1 day');
    expect(t('calendar.days', { count: 3 })).toBe('3 days');
    const table = { en: {}, cs: { k: { one: '{count} den', few: '{count} dny', other: '{count} dní' } } };
    const cs = createStrings('cs', table).t;
    expect([1, 3, 5].map((count) => cs('k', { count }))).toEqual(['1 den', '3 dny', '5 dní']);
  });

  test('falls back to English, then to the key', () => {
    const cs = createStrings('cs');
    expect(cs.t('calendar.month.3')).toBe('March');
    expect(cs.has('calendar.month.3')).toBe(false);
    expect(cs.t('no.such.key')).toBe('no.such.key');
  });

  test('formats the date and time', () => {
    const cal = calendarOf(START_MINUTE + 65);
    expect(formatDate(cal, t)).toBe('1 March, year 1');
    expect(formatTime(cal, t)).toBe('8:05');
  });

  test('every biome and month has a name', () => {
    for (const b of BIOMES) expect(STRINGS.en[`biome.${b.id}`]).toBeString();
    for (let m = 1; m <= 12; m++) expect(STRINGS.en[`calendar.month.${m}`]).toBeString();
  });
});
