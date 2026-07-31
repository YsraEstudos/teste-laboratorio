// @ts-check

import { describe, expect, it } from 'vitest';
import { getSandQuality } from '../world/SandQualityProfile.js';

describe('getSandQuality', () => {
  it('exposes a monotonic geometry budget', () => {
    expect(getSandQuality('high').geometrySegments).toEqual({ x: 240, z: 180 });
    expect(getSandQuality('medium').geometrySegments).toEqual({ x: 160, z: 120 });
    expect(getSandQuality('low').geometrySegments).toEqual({ x: 96, z: 72 });
    expect(getSandQuality('high').deformationResolution).toEqual({ width: 512, height: 384 });
    expect(getSandQuality('medium').deformationResolution).toEqual({ width: 384, height: 288 });
    expect(getSandQuality('low').deformationResolution).toEqual({ width: 256, height: 192 });
  });

  it('gates detailed child footprints to the high profile only', () => {
    expect(getSandQuality('high').childFootprintEnabled).toBe(true);
    expect(getSandQuality('medium').childFootprintEnabled).toBe(false);
    expect(getSandQuality('low').childFootprintEnabled).toBe(false);
  });

  it('keeps the per-profile brush budget monotonic', () => {
    expect(getSandQuality('low').maxBrushesPerFrame).toBe(32);
    expect(getSandQuality('medium').maxBrushesPerFrame).toBe(64);
    expect(getSandQuality('high').maxBrushesPerFrame).toBe(96);
  });

  it('returns immutable profiles and falls back to high quality', () => {
    const high = getSandQuality('high');

    expect(Object.isFrozen(high)).toBe(true);
    expect(Object.isFrozen(high.geometrySegments)).toBe(true);
    expect(Object.isFrozen(high.deformationResolution)).toBe(true);
    expect(getSandQuality('unknown')).toBe(high);
  });
});
