// @ts-check

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { WindField } from '../wind/WindField.js';

describe('WindField', () => {
  it('samples a deterministic room profile into the caller-owned vector', () => {
    const field = new WindField([
      {
        minX: -2,
        maxX: 2,
        minZ: -2,
        maxZ: 2,
        windProfile: 'testing',
      },
    ]);
    field.time = 0;
    field.baseAngle = 0;
    field.baseStrength = 2;
    field.gustStrength = 0;
    field.gustIntensity = 0;
    const out = new THREE.Vector3(99, 99, 99);

    const result = field.sample(new THREE.Vector3(0, 2.8, 0), out);

    expect(result).toBe(out);
    expect(field.getStrengthAt(new THREE.Vector3(0, 0, 0))).toBeCloseTo(3.1);
    expect(out.toArray().every(Number.isFinite)).toBe(true);
    expect(out.x).toBeGreaterThan(0);
    expect(field.sample(new THREE.Vector3(0, 2.8, 0), new THREE.Vector3()).toArray()).toEqual(out.toArray());
  });

  it('uses the fallback zone profile outside configured rooms', () => {
    const field = new WindField([]);
    field.baseStrength = 2;
    field.gustStrength = 0;
    field.gustIntensity = 0;

    expect(field.getStrengthAt(new THREE.Vector3(100, 0, 100))).toBeCloseTo(1.36);
  });
});
