// Save slots (PRD §18): unlimited slots, one zoo each, in any localStorage-like store. Pure: it only calls
// getItem/setItem/removeItem on the storage it's given, so tests pass a Map-backed one and the apps can mirror it.
//
// Each save sits under its own key, its thumbnail under another, and a small index holds the summaries, so the slot
// picker never parses a save (handbook §8). Every storage call is guarded: a full or blocked storage returns an
// error instead of throwing, and the game keeps running unsaved.

import { deserialize } from './state.js';

/** About what browsers give one origin. */
export const STORAGE_QUOTA = 5 * 1024 * 1024;
/** The picker warns from this share of the quota. */
export const NEARLY_FULL = 0.8;
const EXPORT_FORMAT = 'pawprint-park-save';

/**
 * @typedef {{ getItem(k: string): string | null, setItem(k: string, v: string): void, removeItem(k: string): void }} Storage
 * @typedef {{ id: number, name: string, savedAt: number, day: number, bytes: number, hasThumbnail: boolean }} SlotMeta
 *   `savedAt` is a wall-clock timestamp (ms) from the caller; `day` the in-game day index; `bytes` what the slot
 *   takes in storage.
 */

/** localStorage keeps UTF-16, so a character costs two bytes. */
const cost = (key, value) => (key.length + value.length) * 2;

/**
 * @param {Storage} storage
 * @param {{ prefix?: string, quota?: number }} [opts]
 */
export function createSlotStore(storage, { prefix = 'pawprint.', quota = STORAGE_QUOTA } = {}) {
  const indexKey = `${prefix}slots`;
  const saveKey = (id) => `${prefix}slot.${id}`;
  const thumbKey = (id) => `${prefix}thumb.${id}`;

  const read = (key) => {
    try {
      return storage.getItem(key);
    } catch {
      return null;
    }
  };
  const write = (key, value) => {
    try {
      storage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  };
  const drop = (key) => {
    try {
      storage.removeItem(key);
    } catch {
      // Nothing to do: the key stays.
    }
  };

  /** @returns {{ next: number, slots: SlotMeta[] }} */
  const readIndex = () => {
    try {
      const data = JSON.parse(read(indexKey) ?? 'null');
      if (data && Array.isArray(data.slots) && typeof data.next === 'number') return data;
    } catch {
      // A damaged index starts over; the saves themselves stay in storage.
    }
    return { next: 1, slots: [] };
  };
  const writeIndex = (index) => write(indexKey, JSON.stringify(index));

  const store = {
    /** Slot summaries, the most recently saved first. */
    list() {
      return [...readIndex().slots].sort((a, b) => b.savedAt - a.savedAt || b.id - a.id);
    },

    /**
     * Saves a zoo. Without `id` it makes a new slot.
     * @param {string} text the serialized world state
     * @param {{ id?: number, name: string, savedAt: number, day: number, thumbnail?: string | null }} meta
     * @returns {{ ok: true, id: number } | { ok: false, error: 'storage' }}
     */
    save(text, { id, name, savedAt, day, thumbnail = null }) {
      const index = readIndex();
      const slotId = id ?? index.next;
      if (!write(saveKey(slotId), text)) return { ok: false, error: 'storage' };
      let bytes = cost(saveKey(slotId), text);
      if (thumbnail) {
        if (write(thumbKey(slotId), thumbnail)) bytes += cost(thumbKey(slotId), thumbnail);
        else thumbnail = null;
      } else {
        drop(thumbKey(slotId));
      }
      /** @type {SlotMeta} */
      const meta = { id: slotId, name, savedAt, day, bytes, hasThumbnail: !!thumbnail };
      index.slots = index.slots.filter((s) => s.id !== slotId).concat(meta);
      index.next = Math.max(index.next, slotId + 1);
      if (!writeIndex(index)) return { ok: false, error: 'storage' };
      return { ok: true, id: slotId };
    },

    /** The save text of a slot, or null. */
    load(id) {
      return read(saveKey(id));
    },

    /** The thumbnail (a data URL) of a slot, or null. */
    thumbnail(id) {
      return read(thumbKey(id));
    },

    /** Deletes a slot. */
    remove(id) {
      const index = readIndex();
      if (!index.slots.some((s) => s.id === id)) return false;
      drop(saveKey(id));
      drop(thumbKey(id));
      index.slots = index.slots.filter((s) => s.id !== id);
      writeIndex(index);
      return true;
    },

    /** How much of the storage the slots take, and whether the picker should warn. */
    usage() {
      const index = readIndex();
      const bytes = index.slots.reduce((sum, s) => sum + s.bytes, 0) + cost(indexKey, JSON.stringify(index));
      const fraction = bytes / quota;
      return { bytes, quota, fraction, nearlyFull: fraction >= NEARLY_FULL };
    },

    /** A slot as a self-contained file, for exporting. Null when the slot doesn't exist. */
    exportSlot(id) {
      const meta = readIndex().slots.find((s) => s.id === id);
      const save = read(saveKey(id));
      if (!meta || save === null) return null;
      return JSON.stringify({ format: EXPORT_FORMAT, version: 1, name: meta.name, day: meta.day, thumbnail: read(thumbKey(id)), save });
    },

    /**
     * Imports an exported file into a new slot. The save must load.
     * @returns {{ ok: true, id: number } | { ok: false, error: 'format' | 'save' | 'storage', message?: string }}
     */
    importSlot(text, savedAt) {
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        return { ok: false, error: 'format' };
      }
      if (!data || data.format !== EXPORT_FORMAT || typeof data.save !== 'string') return { ok: false, error: 'format' };
      let state;
      try {
        state = deserialize(data.save);
      } catch (e) {
        return { ok: false, error: 'save', message: /** @type {Error} */ (e).message };
      }
      return store.save(data.save, {
        name: typeof data.name === 'string' ? data.name : state.name,
        savedAt,
        day: typeof data.day === 'number' ? data.day : 0,
        thumbnail: typeof data.thumbnail === 'string' ? data.thumbnail : null,
      });
    },
  };
  return store;
}
