// @ts-check

import { describe, expect, it } from 'vitest';
import { getSandQuality } from '../world/SandQualityProfile.js';

describe('getSandQuality', () => {
  it('exposes a monotonic geometry budget', () => {
    expect(getSandQuality('high').segments).toBe(64);
    expect(getSandQuality('medium').segments).toBe(48);
    expect(getSandQuality('low').segments).toBe(32);
    expect(getSandQuality('high').deformationResolution).toBe(256);
  });

  it('returns immutable profiles and falls back to high quality', () => {
    const high = getSandQuality('high');

    expect(Object.isFrozen(high)).toBe(true);
    expect(getSandQuality('unknown')).toBe(high);
  });
});
