import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  applyWindImpulse,
  applyWindImpulseToObject,
  createWindImpulse,
  getWindImpulseStrength,
} from '../wind/WindImpulse.js';

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

describe('shared wind impulse', () => {
  function impulseTarget(position = new THREE.Vector3()) {
    return {
      type: 'generic',
      position,
      mesh: { position },
      velocity: new THREE.Vector3(),
    };
  }

  it('clones, normalizes and freezes its physical event metadata', () => {
    const origin = new THREE.Vector3(1, 2, 3);
    const direction = new THREE.Vector3(4, 7, 0);

    const impulse = createWindImpulse({
      origin,
      direction,
      power: 4,
      radius: 6,
      falloff: 'linear',
      verticalLift: 1.5,
      duration: 0.2,
      source: 'blast',
    });
    origin.set(9, 9, 9);
    direction.set(0, 0, 9);

    expect(impulse.origin.toArray()).toEqual([1, 2, 3]);
    expect(impulse.direction.toArray()).toEqual([1, 0, 0]);
    expect(impulse.direction.length()).toBeCloseTo(1);
    expect(impulse.source).toBe('blast');
    expect(Object.isFrozen(impulse)).toBe(true);
    expect(Object.isFrozen(impulse.origin)).toBe(true);
    expect(Object.isFrozen(impulse.direction)).toBe(true);
  });

  it.each([
    ['at its origin', 0, 4],
    ['halfway through its radius', 3, 2],
    ['at its radius', 6, 0],
    ['outside its radius', 7, 0],
  ])('uses linear falloff %s', (_label, distance, expected) => {
    const impulse = createWindImpulse({
      origin: new THREE.Vector3(),
      direction: new THREE.Vector3(1, 0, 0),
      power: 4,
      radius: 6,
      falloff: 'linear',
      verticalLift: 1.5,
      duration: 0.2,
      source: 'blast',
    });

    expect(getWindImpulseStrength(impulse, distance)).toBeCloseTo(expected);
  });

  it('applies horizontal power and proportional vertical lift at the center', () => {
    const object = impulseTarget();
    const impulse = createWindImpulse({
      origin: new THREE.Vector3(),
      direction: new THREE.Vector3(1, 0, 0),
      power: 4,
      radius: 6,
      falloff: 'linear',
      verticalLift: 1.5,
      duration: 0.2,
      source: 'blast',
    });

    expect(applyWindImpulseToObject(object, impulse, 0)).toBe(true);
    expect(object.velocity.toArray()).toEqual([4, 1.5, 0]);
  });

  it.each([6, 7])('does not mutate velocity at or beyond the radius (%s)', (distance) => {
    const object = impulseTarget();
    object.velocity.set(5, 6, 7);
    const impulse = createWindImpulse({
      origin: new THREE.Vector3(),
      direction: new THREE.Vector3(1, 0, 0),
      power: 4,
      radius: 6,
      falloff: 'linear',
      verticalLift: 1.5,
      duration: 0.2,
      source: 'blast',
    });

    expect(applyWindImpulseToObject(object, impulse, distance)).toBe(false);
    expect(object.velocity.toArray()).toEqual([5, 6, 7]);
  });
});
