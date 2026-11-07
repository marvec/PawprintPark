import { describe, expect, test } from 'bun:test';
import {
  DAYS_PER_MONTH, DAYS_PER_YEAR, MINUTES_PER_DAY, MINUTES_PER_HOUR, START_MINUTE,
  advanceClock, calendarOf, createClock, daylight, isNight, isZooOpen, phaseOf, setSpeed, skipNight,
} from '../src/core/time.js';

const at = (day, hour, minute = 0) => day * MINUTES_PER_DAY + hour * MINUTES_PER_HOUR + minute;

describe('calendar', () => {
  test('a new zoo starts on 1 March, year 1, at 7:00 in spring', () => {
    const c = calendarOf(START_MINUTE);
    expect([c.day, c.month, c.year, c.hour, c.minute]).toEqual([1, 3, 1, 7, 0]);
    expect(c.season).toBe('spring');
  });

  test('a month is 7 days and a year is 12 months', () => {
    expect(DAYS_PER_MONTH).toBe(7);
    expect(DAYS_PER_YEAR).toBe(84);
    expect(calendarOf(at(7, 0))).toMatchObject({ day: 1, month: 2, year: 1 });
    expect(calendarOf(at(83, 23, 59))).toMatchObject({ day: 7, month: 12, year: 1, hour: 23, minute: 59 });
    expect(calendarOf(at(84, 0))).toMatchObject({ day: 1, month: 1, year: 2, dayIndex: 84 });
  });

  test('seasons follow the months', () => {
    const season = (m) => calendarOf(at((m - 1) * 7, 12)).season;
    expect([1, 3, 6, 9, 12].map(season)).toEqual(['winter', 'spring', 'summer', 'autumn', 'winter']);
  });
});

describe('clock', () => {
  test('one in-game day takes 2 real minutes at 1×', () => {
    const c = createClock(0);
    const out = advanceClock(c, 120);
    expect(c.minute).toBe(MINUTES_PER_DAY);
    expect(out.days).toEqual([1]);
    expect(out.hours.length).toBe(24);
  });

  test('2× and 3× run two and three times as fast; pause stops time', () => {
    for (const speed of [2, 3]) {
      const c = setSpeed(createClock(0), speed);
      advanceClock(c, 40);
      expect(c.minute).toBe((MINUTES_PER_DAY / 3) * speed);
    }
    const paused = setSpeed(createClock(100), 0);
    expect(advanceClock(paused, 500).minutes).toBe(0);
    expect(paused.minute).toBe(100);
    expect(() => setSpeed(createClock(), 5)).toThrow();
  });

  test('every boundary is reported once, even across a long step', () => {
    const c = createClock(at(6, 23, 30));
    const out = advanceClock(c, 120 * DAYS_PER_YEAR);
    expect(out.days.length).toBe(DAYS_PER_YEAR);
    expect(out.days[0]).toBe(7);
    expect(out.months.length).toBe(12);
    expect(out.months[0]).toBe(1);
    expect(out.years).toEqual([2]);
    // Many small steps report the same boundaries as one big one.
    const d = createClock(at(6, 23, 30));
    const days = [];
    for (let i = 0; i < 120 * DAYS_PER_YEAR * 20; i++) days.push(...advanceClock(d, 0.05).days);
    expect(days).toEqual(out.days);
  });

  test('day, dusk, night and dawn; the zoo opens 8:00–18:00', () => {
    expect(phaseOf(at(0, 3))).toBe('night');
    expect(phaseOf(at(0, 5, 30))).toBe('dawn');
    expect(phaseOf(at(0, 12))).toBe('day');
    expect(phaseOf(at(0, 19, 30))).toBe('dusk');
    expect(phaseOf(at(0, 22))).toBe('night');
    expect(isZooOpen(at(0, 7, 59))).toBe(false);
    expect(isZooOpen(at(0, 8))).toBe(true);
    expect(isZooOpen(at(0, 18))).toBe(false);
    expect(daylight(at(0, 2))).toBe(0);
    expect(daylight(at(0, 13))).toBe(1);
    expect(daylight(at(0, 19))).toBeGreaterThan(0);
    expect(daylight(at(0, 19))).toBeLessThan(1);
  });

  test('night can be fast-forwarded, and the skip ends at sunrise', () => {
    const c = createClock(at(0, 12));
    expect(skipNight(c)).toBe(false);
    c.minute = at(0, 22);
    expect(skipNight(c)).toBe(true);
    let real = 0;
    while (c.skipNight) {
      advanceClock(c, 0.1);
      real += 0.1;
    }
    expect(c.minute).toBe(at(1, 6));
    // 8 in-game hours took far less than the 40 real seconds they take at 1×.
    expect(real).toBeLessThan(10);
    expect(isNight(c.minute)).toBe(false);
    // Changing speed by hand cancels a skip.
    c.minute = at(1, 23);
    skipNight(c);
    setSpeed(c, 2);
    expect(c.skipNight).toBe(false);
  });
});
