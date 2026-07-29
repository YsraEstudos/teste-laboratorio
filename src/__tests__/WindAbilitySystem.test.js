// @ts-check

import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { WindConfig } from '../config/WindConfig.js';
import { WindAbilityConfig } from '../abilities/WindAbilityConfig.js';
import { WindAbilitySystem } from '../abilities/WindAbilitySystem.js';

function createOwner(energy = 90, events = []) {
  return {
    energy,
    startCharging: vi.fn(() => events.push('start-charging')),
    stopCharging: vi.fn(() => events.push('stop-charging')),
    releaseWindBlast: vi.fn(() => events.push('release-visual')),
  };
}

function createSnapshot(overrides = {}) {
  return {
    targetObject: { id: 'paper-sheet' },
    origin: new THREE.Vector3(1, 2, 3),
    target: new THREE.Vector3(4, 5, 6),
    powerLevel: 5,
    happiness: 80,
    energy: 90,
    ...overrides,
  };
}

describe('WindAbilitySystem', () => {
  it('starts one charge only while ready and with enough energy', () => {
    const owner = createOwner();
    const system = new WindAbilitySystem({ owner });

    expect(system.state).toBe('ready');
    expect(system.start(createSnapshot())).toBe(true);
    expect(system.start(createSnapshot())).toBe(false);

    expect(system.state).toBe('charging');
    expect(owner.startCharging).toHaveBeenCalledOnce();
  });

  it('rejects a charge when the owner cannot pay the release cost', () => {
    const owner = createOwner(9);
    const onRelease = vi.fn();
    const system = new WindAbilitySystem({ owner, onRelease });

    expect(system.start(createSnapshot({ energy: 9 }))).toBe(false);
    system.update(1);

    expect(system.state).toBe('ready');
    expect(owner.startCharging).not.toHaveBeenCalled();
    expect(owner.energy).toBe(17);
    expect(onRelease).not.toHaveBeenCalled();
  });

  it('releases at 0.7 seconds, consumes 10 energy, and preserves visual event order', () => {
    const events = [];
    const owner = createOwner(90, events);
    const onRelease = vi.fn(() => events.push('release-event'));
    const system = new WindAbilitySystem({ owner, onRelease });

    system.start(createSnapshot());
    system.update(0.699);

    expect(system.state).toBe('charging');
    expect(owner.energy).toBe(90);
    expect(onRelease).not.toHaveBeenCalled();

    system.update(0.001);

    expect(system.state).toBe('cooldown');
    expect(owner.energy).toBe(80);
    expect(events).toEqual(['start-charging', 'stop-charging', 'release-visual', 'release-event']);
    expect(onRelease).toHaveBeenCalledOnce();
  });

  it('keeps selected identity, positions, and attributes frozen from charge start', () => {
    const owner = createOwner();
    const onRelease = vi.fn();
    const system = new WindAbilitySystem({ owner, onRelease });
    const targetObject = { id: 'selected-target' };
    const origin = new THREE.Vector3(1, 0, 2);
    const target = new THREE.Vector3(5, 0, 7);
    const requestedSnapshot = createSnapshot({
      targetObject,
      origin,
      target,
      powerLevel: 6,
      happiness: 75,
      energy: 90,
    });

    system.start(requestedSnapshot);
    origin.set(100, 100, 100);
    target.set(200, 200, 200);
    requestedSnapshot.targetObject = { id: 'replacement-target' };
    requestedSnapshot.powerLevel = 1;
    requestedSnapshot.happiness = 1;
    requestedSnapshot.energy = 1;
    system.update(0.7);

    const released = onRelease.mock.calls[0][0];
    expect(released.targetObject).toBe(targetObject);
    expect(released.origin.toArray()).toEqual([1, 0, 2]);
    expect(released.target.toArray()).toEqual([5, 0, 7]);
    expect({
      powerLevel: released.powerLevel,
      happiness: released.happiness,
      energy: released.energy,
    }).toEqual({ powerLevel: 6, happiness: 75, energy: 90 });
    expect(Object.isFrozen(released)).toBe(true);
    expect(Object.isFrozen(released.origin)).toBe(true);
    expect(Object.isFrozen(released.target)).toBe(true);
  });

  it('cancels a paused charge without consuming energy', () => {
    const owner = createOwner();
    const onRelease = vi.fn();
    const system = new WindAbilitySystem({ owner, onRelease });

    system.start(createSnapshot());
    system.update(0.4);
    system.pause();
    system.update(10);

    expect(system.state).toBe('ready');
    expect(owner.stopCharging).toHaveBeenCalledOnce();
    expect(owner.releaseWindBlast).not.toHaveBeenCalled();
    expect(owner.energy).toBe(90);
    expect(onRelease).not.toHaveBeenCalled();

    system.resume();
    expect(system.start(createSnapshot())).toBe(true);
  });

  it('freezes cooldown while paused and resumes from the remaining duration', () => {
    const owner = createOwner();
    const system = new WindAbilitySystem({ owner });

    system.start(createSnapshot());
    system.update(0.7);
    system.update(0.25);
    system.pause();
    system.update(10);
    system.resume();
    system.update(0.499);

    expect(system.state).toBe('cooldown');

    system.update(0.001);
    expect(system.state).toBe('ready');
  });

  it('uses an immutable default config and supports explicit timing and cost overrides', () => {
    const owner = createOwner(20);
    const onRelease = vi.fn();
    const system = new WindAbilitySystem({
      owner,
      onRelease,
      config: { chargeSeconds: 0.2, cooldownSeconds: 0.3, energyCost: 5 },
    });

    expect(Object.isFrozen(WindAbilityConfig)).toBe(true);
    system.start(createSnapshot({ energy: 20 }));
    system.update(0.2);

    expect(owner.energy).toBe(15);
    expect(system.state).toBe('cooldown');

    system.update(0.3);
    expect(system.state).toBe('ready');
  });

  it('ignores invalid delta values instead of advancing the charge', () => {
    const owner = createOwner();
    const onRelease = vi.fn();
    const system = new WindAbilitySystem({ owner, onRelease });

    system.start(createSnapshot());
    system.update(-1);
    system.update(Number.NaN);
    system.update(Number.POSITIVE_INFINITY);

    expect(system.state).toBe('charging');
    expect(onRelease).not.toHaveBeenCalled();
  });

  it('disposes idempotently, cancels a charge, and rejects later work', () => {
    const owner = createOwner();
    const onRelease = vi.fn();
    const system = new WindAbilitySystem({ owner, onRelease });

    system.start(createSnapshot());
    system.dispose();
    system.dispose();
    system.update(1);

    expect(system.disposed).toBe(true);
    expect(system.state).toBe('ready');
    expect(owner.stopCharging).toHaveBeenCalledOnce();
    expect(owner.releaseWindBlast).not.toHaveBeenCalled();
    expect(owner.energy).toBe(90);
    expect(onRelease).not.toHaveBeenCalled();
    expect(system.start(createSnapshot())).toBe(false);
  });

  it('releases its owner and callback when disposed without allowing a later release', () => {
    const owner = createOwner();
    const onRelease = vi.fn();
    const system = new WindAbilitySystem({ owner, onRelease });

    system.start(createSnapshot());
    system.dispose();
    system.update(1);

    expect(system.owner).toBeNull();
    expect(system.onRelease).toBeNull();
    expect(system.start(createSnapshot())).toBe(false);
    expect(owner.releaseWindBlast).not.toHaveBeenCalled();
    expect(onRelease).not.toHaveBeenCalled();
  });

  it('uses the centralized duration names while preserving legacy timing overrides', () => {
    const owner = createOwner(20);
    const system = new WindAbilitySystem({
      owner,
      config: { chargeDuration: 0.2, cooldownDuration: 0.3, energyCost: 5 },
    });

    expect(system.start(createSnapshot())).toBe(true);
    system.update(0.2);
    expect(system.state).toBe('cooldown');
    expect(owner.energy).toBe(15);

    system.update(0.3);
    expect(system.state).toBe('ready');
  });

  it.each([1 / 30, 1 / 60, 1 / 120])('recovers energy deterministically at %s second frames', (delta) => {
    const owner = createOwner(50);
    const system = new WindAbilitySystem({ owner, config: { energyRecoveryRate: 12 } });
    const frames = Math.round(1 / delta);

    for (let frame = 0; frame < frames; frame += 1) system.update(delta);

    expect(owner.energy).toBeCloseTo(62, 8);
  });

  it('recovers only while ready or cooling down and never above full energy', () => {
    const owner = createOwner(95);
    const system = new WindAbilitySystem({ owner, config: { energyRecoveryRate: 20 } });

    system.update(1);
    expect(owner.energy).toBe(100);

    system.start(createSnapshot());
    system.update(0.1);
    expect(owner.energy).toBe(100);

    system.pause();
    system.update(1);
    expect(owner.energy).toBe(100);
  });

  it('requires the configured minimum energy before charging', () => {
    const owner = createOwner(14);
    const system = new WindAbilitySystem({
      owner,
      config: { energyCost: 5, minimumEnergy: 15 },
    });

    expect(system.start(createSnapshot())).toBe(false);
    expect(owner.startCharging).not.toHaveBeenCalled();
  });

  it('reports an immutable UI state with cooldown remaining and release availability', () => {
    const owner = createOwner(90);
    const system = new WindAbilitySystem({ owner, config: { chargeDuration: 0.2, cooldownDuration: 0.5 } });

    expect(system.getState()).toEqual({
      state: 'ready',
      elapsed: 0,
      remaining: 0,
      energy: 90,
      canRelease: true,
    });

    system.start(createSnapshot());
    system.update(0.2);
    system.update(0.1);
    const state = system.getState();

    expect(state).toMatchObject({ state: 'cooldown', elapsed: 0.1, remaining: 0.4, energy: 80.8, canRelease: false });
    expect(Object.isFrozen(state)).toBe(true);
    expect(WindConfig.minimumEnergy).toBeGreaterThan(0);
  });
});
