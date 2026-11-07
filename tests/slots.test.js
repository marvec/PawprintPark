import { describe, expect, test } from 'bun:test';
import { createSlotStore } from '../src/core/slots.js';
import { createWorld, deserialize, serialize } from '../src/core/state.js';

/** A Map-backed localStorage stand-in, optionally with a size limit. */
function memoryStorage(limit = Infinity) {
  const m = new Map();
  return {
    map: m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem(k, v) {
      let used = 0;
      for (const [key, val] of m) if (key !== k) used += key.length + val.length;
      if (used + k.length + v.length > limit) throw new Error('QuotaExceededError');
      m.set(k, String(v));
    },
    removeItem: (k) => m.delete(k),
  };
}

const zoo = (seed, name) => serialize(createWorld({ seed, name }));

describe('slot store', () => {
  test('saves any number of zoos and lists them newest first', () => {
    const store = createSlotStore(memoryStorage());
    for (let i = 0; i < 120; i++) {
      const r = store.save(zoo(i, `Zoo ${i}`), { name: `Zoo ${i}`, savedAt: 1000 + i, day: i });
      expect(r).toEqual({ ok: true, id: i + 1 });
    }
    const list = store.list();
    expect(list.length).toBe(120);
    expect(list[0].name).toBe('Zoo 119');
    expect(deserialize(store.load(list[0].id)).name).toBe('Zoo 119');
  });

  test('saving into a slot overwrites it; thumbnails are kept apart from the index', () => {
    const storage = memoryStorage();
    const store = createSlotStore(storage);
    const { id } = /** @type {{ id: number }} */ (store.save(zoo(1, 'A'), { name: 'A', savedAt: 1, day: 0, thumbnail: 'data:image/png;base64,AAAA' }));
    store.save(zoo(1, 'A'), { id, name: 'A', savedAt: 2, day: 9 });
    expect(store.list()).toEqual([expect.objectContaining({ id, savedAt: 2, day: 9, hasThumbnail: false })]);
    expect(store.thumbnail(id)).toBeNull();
    store.save(zoo(1, 'A'), { id, name: 'A', savedAt: 3, day: 10, thumbnail: 'data:image/png;base64,BBBB' });
    expect(store.thumbnail(id)).toBe('data:image/png;base64,BBBB');
    expect(storage.getItem('pawprint.slots')).not.toContain('BBBB');
  });

  test('deleting a slot removes its save and thumbnail', () => {
    const storage = memoryStorage();
    const store = createSlotStore(storage);
    store.save(zoo(1, 'A'), { name: 'A', savedAt: 1, day: 0, thumbnail: 'data:x' });
    store.save(zoo(2, 'B'), { name: 'B', savedAt: 2, day: 0 });
    expect(store.remove(1)).toBe(true);
    expect(store.remove(1)).toBe(false);
    expect(store.load(1)).toBeNull();
    expect(storage.map.has('pawprint.thumb.1')).toBe(false);
    expect(store.list().map((s) => s.id)).toEqual([2]);
    // Ids are never reused.
    expect(store.save(zoo(3, 'C'), { name: 'C', savedAt: 3, day: 0 })).toEqual({ ok: true, id: 3 });
  });

  test('reports storage use and warns when nearly full', () => {
    const store = createSlotStore(memoryStorage(), { quota: 40000 });
    const empty = store.usage();
    expect(empty.nearlyFull).toBe(false);
    let i = 0;
    while (!store.usage().nearlyFull) store.save(zoo(i, 'Z'), { name: 'Z', savedAt: i, day: 0 }), i++;
    const u = store.usage();
    expect(u.fraction).toBeGreaterThanOrEqual(0.8);
    expect(u.bytes).toBeGreaterThan(empty.bytes);
    expect(i).toBeGreaterThan(3);
  });

  test('a full or blocked storage returns an error instead of throwing', () => {
    const store = createSlotStore(memoryStorage(500));
    expect(store.save(zoo(1, 'A'), { name: 'A', savedAt: 1, day: 0 })).toEqual({ ok: false, error: 'storage' });
    const blocked = createSlotStore({
      getItem() { throw new Error('SecurityError'); },
      setItem() { throw new Error('SecurityError'); },
      removeItem() { throw new Error('SecurityError'); },
    });
    expect(blocked.list()).toEqual([]);
    expect(blocked.save('x', { name: 'A', savedAt: 1, day: 0 })).toEqual({ ok: false, error: 'storage' });
    expect(blocked.load(1)).toBeNull();
  });

  test('exports a slot as a file and imports it into a new slot', () => {
    const a = createSlotStore(memoryStorage());
    a.save(zoo(77, 'Export Zoo'), { name: 'Export Zoo', savedAt: 5, day: 12, thumbnail: 'data:t' });
    const file = a.exportSlot(1);
    expect(a.exportSlot(99)).toBeNull();
    const b = createSlotStore(memoryStorage());
    b.save(zoo(1, 'Other'), { name: 'Other', savedAt: 1, day: 0 });
    expect(b.importSlot(file, 50)).toEqual({ ok: true, id: 2 });
    expect(b.list()[0]).toMatchObject({ id: 2, name: 'Export Zoo', day: 12, savedAt: 50, hasThumbnail: true });
    expect(deserialize(b.load(2))).toEqual(deserialize(zoo(77, 'Export Zoo')));
  });

  test('refuses imports that are not saves', () => {
    const store = createSlotStore(memoryStorage());
    expect(store.importSlot('not json', 1)).toEqual({ ok: false, error: 'format' });
    expect(store.importSlot('{"format":"something-else"}', 1)).toEqual({ ok: false, error: 'format' });
    expect(store.importSlot(JSON.stringify({ format: 'pawprint-park-save', save: '{"x":1}' }), 1)).toMatchObject({ ok: false, error: 'save' });
    expect(store.list()).toEqual([]);
  });
});
