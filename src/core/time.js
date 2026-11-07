// The game clock and calendar (PRD §2). Pure: the main loop feeds it real seconds, it returns what changed.
//
// Time is kept as whole in-game minutes since the start of year 1 plus a fraction, so a save stores one number.
// 1 in-game day = 2 real minutes at 1×, so one real second at 1× is 12 in-game minutes.

export const MINUTES_PER_HOUR = 60;
export const HOURS_PER_DAY = 24;
export const MINUTES_PER_DAY = MINUTES_PER_HOUR * HOURS_PER_DAY;
export const DAYS_PER_MONTH = 7;
export const MONTHS_PER_YEAR = 12;
export const DAYS_PER_YEAR = DAYS_PER_MONTH * MONTHS_PER_YEAR;
/** Real seconds per in-game day at 1×. */
export const REAL_SECONDS_PER_DAY = 120;
export const MINUTES_PER_REAL_SECOND = MINUTES_PER_DAY / REAL_SECONDS_PER_DAY;
/** Allowed speeds: 0 = paused. */
export const SPEEDS = /** @type {const} */ ([0, 1, 2, 3]);
/** How much faster time runs while the night is fast-forwarded. */
export const NIGHT_SKIP_SPEED = 12;

/** Opening hours and the light: hours of the day. */
export const HOURS = {
  dawn: 5,
  sunrise: 6,
  open: 8,
  close: 18,
  sunset: 19,
  dusk: 20,
};

/** Months (0-based) per season. The calendar uses real month names; the game starts in March. */
export const SEASONS = /** @type {const} */ (['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer',
  'summer', 'autumn', 'autumn', 'autumn', 'winter']);

/** A new zoo starts on 1 March, year 1, at 7:00, an hour before opening. */
export const START_MINUTE = (2 * DAYS_PER_MONTH) * MINUTES_PER_DAY + 7 * MINUTES_PER_HOUR;

/**
 * @typedef {{ minute: number, speed: 0 | 1 | 2 | 3, skipNight: boolean }} Clock
 * `minute` counts in-game minutes since 00:00 on day 1 of month 1, year 1.
 */

/** @returns {Clock} */
export function createClock(minute = START_MINUTE) {
  return { minute, speed: 1, skipNight: false };
}

/**
 * The calendar date of an in-game minute. Months, days and years are 1-based; `dayIndex` counts whole days since
 * the very start.
 */
export function calendarOf(minute) {
  const dayIndex = Math.floor(minute / MINUTES_PER_DAY);
  const inDay = minute - dayIndex * MINUTES_PER_DAY;
  const year = Math.floor(dayIndex / DAYS_PER_YEAR) + 1;
  const dayOfYear = dayIndex % DAYS_PER_YEAR;
  const month = Math.floor(dayOfYear / DAYS_PER_MONTH) + 1;
  const day = (dayOfYear % DAYS_PER_MONTH) + 1;
  const hour = Math.floor(inDay / MINUTES_PER_HOUR);
  return {
    dayIndex,
    year,
    month,
    day,
    dayOfYear,
    hour,
    minute: Math.floor(inDay - hour * MINUTES_PER_HOUR),
    season: SEASONS[month - 1],
  };
}

/** Hour of the day as a fraction, 0 ≤ h < 24. */
export const hourOf = (minute) => (minute % MINUTES_PER_DAY) / MINUTES_PER_HOUR;

/**
 * The light and activity phase: night, dawn, day or dusk. The zoo is open from `HOURS.open` to `HOURS.close`.
 * @returns {'night' | 'dawn' | 'day' | 'dusk'}
 */
export function phaseOf(minute) {
  const h = hourOf(minute);
  if (h < HOURS.dawn || h >= HOURS.dusk) return 'night';
  if (h < HOURS.sunrise) return 'dawn';
  if (h < HOURS.sunset) return 'day';
  return 'dusk';
}

export const isNight = (minute) => phaseOf(minute) === 'night';
export const isZooOpen = (minute) => {
  const h = hourOf(minute);
  return h >= HOURS.open && h < HOURS.close;
};

/**
 * Daylight from 0 (night) to 1 (full day), easing through dawn and dusk. The scene uses it for the sun.
 */
export function daylight(minute) {
  const h = hourOf(minute);
  const ramp = (a, b) => Math.min(1, Math.max(0, (h - a) / (b - a)));
  if (h < HOURS.sunrise + 1) return ramp(HOURS.dawn, HOURS.sunrise + 1);
  return 1 - ramp(HOURS.sunset - 1, HOURS.dusk);
}

/** Minutes until the next dawn ends the night. */
function minutesToMorning(minute) {
  const inDay = minute % MINUTES_PER_DAY;
  const target = HOURS.sunrise * MINUTES_PER_HOUR;
  return inDay < target ? target - inDay : MINUTES_PER_DAY - inDay + target;
}

/** Sets the speed (0 pauses). Changing speed by hand ends a night skip. */
export function setSpeed(clock, speed) {
  if (!SPEEDS.includes(speed)) throw new Error(`Unknown speed ${speed}`);
  clock.speed = speed;
  clock.skipNight = false;
  return clock;
}

/** Fast-forwards to the morning. Only allowed at night. */
export function skipNight(clock) {
  if (!isNight(clock.minute)) return false;
  clock.skipNight = true;
  return true;
}

/**
 * Advances the clock by `realSeconds` of real time (already clamped by the main loop). Returns the boundaries
 * crossed, in order, so systems can run hourly, daily and monthly work exactly once each:
 * `{ minutes, hours: number[], days: number[], months: number[], years: number[] }` where each list holds the
 * `dayIndex` (days), absolute hour index (hours), absolute month index (months) or year number (years) just begun.
 */
export function advanceClock(clock, realSeconds) {
  const out = { minutes: 0, hours: [], days: [], months: [], years: [] };
  if (realSeconds <= 0 || clock.speed === 0) return out;
  const speed = clock.skipNight ? NIGHT_SKIP_SPEED : clock.speed;
  let delta = realSeconds * MINUTES_PER_REAL_SECOND * speed;
  if (clock.skipNight) {
    const left = minutesToMorning(clock.minute);
    if (delta >= left) {
      delta = left;
      clock.skipNight = false;
    }
  }
  const from = clock.minute;
  const to = from + delta;
  for (let h = Math.floor(from / MINUTES_PER_HOUR) + 1; h * MINUTES_PER_HOUR <= to; h++) {
    out.hours.push(h);
    if (h % HOURS_PER_DAY !== 0) continue;
    const d = h / HOURS_PER_DAY;
    out.days.push(d);
    if (d % DAYS_PER_MONTH !== 0) continue;
    out.months.push(d / DAYS_PER_MONTH);
    if (d % DAYS_PER_YEAR === 0) out.years.push(d / DAYS_PER_YEAR + 1);
  }
  clock.minute = to;
  out.minutes = delta;
  return out;
}
