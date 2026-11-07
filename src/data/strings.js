// The strings table (PRD §19): every piece of UI text, species name and Zoopedia fact, per language. Keys are
// dotted names; `{name}` placeholders are filled in by `t()`. A value can be an object of plural forms
// (`one`, `few`, `many`, `other`, as Intl.PluralRules names them) chosen by the `count` parameter.
//
// English is complete; Czech is filled in milestone 11 (a test will then check every key exists in both).

/** @typedef {string | Partial<Record<'zero' | 'one' | 'two' | 'few' | 'many' | 'other', string>>} StringValue */

/** @type {Record<string, Record<string, StringValue>>} */
export const STRINGS = {
  en: {
    'zoo.defaultName': 'Pawprint Park',

    'calendar.month.1': 'January',
    'calendar.month.2': 'February',
    'calendar.month.3': 'March',
    'calendar.month.4': 'April',
    'calendar.month.5': 'May',
    'calendar.month.6': 'June',
    'calendar.month.7': 'July',
    'calendar.month.8': 'August',
    'calendar.month.9': 'September',
    'calendar.month.10': 'October',
    'calendar.month.11': 'November',
    'calendar.month.12': 'December',
    'calendar.date': '{day} {month}, year {year}',
    'calendar.time': '{hour}:{minute}',
    'calendar.season.spring': 'Spring',
    'calendar.season.summer': 'Summer',
    'calendar.season.autumn': 'Autumn',
    'calendar.season.winter': 'Winter',
    'calendar.phase.night': 'Night',
    'calendar.phase.dawn': 'Dawn',
    'calendar.phase.day': 'Day',
    'calendar.phase.dusk': 'Dusk',
    'calendar.days': { one: '{count} day', other: '{count} days' },

    'biome.farmyard': 'Farmyard',
    'biome.african-savanna': 'African Savanna',
    'biome.asian-jungle': 'Asian Jungle',
    'biome.polar': 'Polar & Tundra',
    'biome.coast': 'Coast & Sea',
    'biome.wetland': 'Wetland & Rivers',
    'biome.reptile-house': 'Reptile & Amphibian House',
    'biome.aviary': 'Aviary',
    'biome.temperate-forest': 'Temperate Forest',
    'biome.desert': 'Desert & Dry Plains',
    'biome.tropical-rainforest': 'Tropical Rainforest',
    'biome.mountain': 'Mountain',
    'biome.outback': 'Australian Outback',
    'biome.aquarium': 'Aquarium',
    'biome.nocturnal-house': 'Nocturnal House',
    'biome.bug-house': 'Bug House',

    'size.S': 'Small',
    'size.M': 'Medium',
    'size.L': 'Large',
    'size.XL': 'Extra large',
    'size.tag': '{size} · {tiles}×{tiles}',
    'fence.new': 'New fence',
    'fence.worn': 'Worn fence',
    'fence.broken': 'Broken fence',
    'habitat.level': 'Habitat level {level}',
    'enclosure.dirty': 'Dirty enclosure',
    'enclosure.empty': 'Empty enclosure',
    'equipment.feeder': 'Feeder',
    'equipment.water': 'Water point',
    'equipment.shelter': 'Shelter',
    'equipment.heater': 'Heater',
    'equipment.cooler': 'Cooler',
    'equipment.pool': 'Pool',
    'equipment.climbing-frame': 'Climbing frame',
    'equipment.toy': 'Enrichment toy',
    'equipment.chute': 'Feeding chute',
    'building.entrance-gate': 'Entrance gate',
    'building.storehouse': 'Storehouse',
    'staff.keeper': 'Keeper',
    'vehicle.golf-cart': 'Golf cart',
    'weather.sun': 'Sunny',
    'weather.rain': 'Rain',
    'weather.snow': 'Snow',
    'weather.heat': 'Heat wave',

    'slots.empty': 'No saved zoos yet',
    'slots.storage': 'Storage used: {percent}%',
    'slots.nearlyFull': 'Storage is nearly full. Delete or export old zoos to make room.',
    'slots.saveFailed': 'The zoo could not be saved: storage is full or blocked.',
    'slots.importFormat': 'This file is not a Pawprint Park save.',
    'slots.importSave': 'This save could not be loaded.',
  },
  cs: {
    'zoo.defaultName': 'Pawprint Park',
  },
};

export const LANGUAGES = /** @type {const} */ (['en', 'cs']);
