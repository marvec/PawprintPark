import { describe, expect, test } from 'bun:test';
import { buildLights, buildMeadow, buildSky } from '../src/scene/backdrop.js';

describe('backdrop', () => {
  test('the meadow is deterministic and flat inside the clear area', () => {
    const a = buildMeadow({ seed: 5, clearRadius: 20 });
    const b = buildMeadow({ seed: 5, clearRadius: 20 });
    expect(a.group.children.length).toBe(b.group.children.length);
    a.group.children.forEach((c, i) => expect(c.position.equals(b.group.children[i].position)).toBe(true));
    expect(a.height(0, 0)).toBe(0);
    expect(a.height(19, 0)).toBe(0);
  });

  test('the sky has a vertex-colour gradient', () => {
    const sky = buildSky();
    expect(sky.geometry.getAttribute('color')).toBeDefined();
  });

  test('lights follow the quality tier', () => {
    expect(buildLights({ shadows: true, shadowMapSize: 1024 }).sun.castShadow).toBe(true);
    expect(buildLights({ shadows: false }).sun.castShadow).toBe(false);
  });
});
