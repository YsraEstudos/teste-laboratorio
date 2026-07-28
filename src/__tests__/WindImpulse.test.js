import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { applyWindImpulse } from '../wind/WindImpulse.js';

function target(type, velocity = new THREE.Vector3(20, 30, 40)) {
  return { type, velocity };
}

const direction = new THREE.Vector3(1, 0, 0);

describe('applyWindImpulse', () => {
  it.each(['folha_papel', 'folha_arvore'])('replaces %s velocity and applies the current upward lift', (type) => {
    const object = target(type);

    applyWindImpulse(object, direction, 4);

    expect(object.velocity.toArray()).toEqual([9.3, 6.7, 0]);
  });

  it.each([
    ['just below', 1.69, 0.35],
    ['at', 1.7, 3.44],
    ['above the speed cap', 20, 12.5],
  ])('keeps the cardboard policy %s its power limit', (_boundary, effectivePower, expectedSpeed) => {
    const object = target('papelao');

    applyWindImpulse(object, direction, effectivePower);

    expect(object.velocity.toArray()).toEqual([expectedSpeed, 0, 0]);
  });

  it.each([
    ['just below', 4.49, 0.35],
    ['at', 4.5, 0.475],
    ['above the speed cap', 20, 6.5],
  ])('keeps the rock policy %s its power limit', (_boundary, effectivePower, expectedSpeed) => {
    const object = target('pedra');

    applyWindImpulse(object, direction, effectivePower);

    expect(object.velocity.toArray()).toEqual([expectedSpeed, 0, 0]);
  });
});
