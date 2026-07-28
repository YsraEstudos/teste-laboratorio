import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { WindChild } from '../entities/WindChild.js';

function pathResult(overrides = {}) {
  return {
    status: 'complete',
    reason: null,
    waypoints: [new THREE.Vector3(2, 0, 0)],
    requestedTarget: new THREE.Vector3(2, 0, 0),
    resolvedTarget: new THREE.Vector3(2, 0, 0),
    adjustedStart: false,
    adjustedTarget: false,
    ...overrides,
  };
}

function createNavigationHarness(position = new THREE.Vector3()) {
  const child = Object.create(WindChild.prototype);
  child.time = 0;
  child._happiness = 80;
  child._energy = 90;
  child.isCharging = false;
  child.chargeWeight = 0;
  child.position = position.clone();
  child.velocity = new THREE.Vector3();
  child.path = [];
  child.pathIndex = 0;
  child.navigation = null;
  child.navigationState = 'idle';
  child.navigationReason = null;
  child.navigationBlockedTime = 0;
  child.navigationRadius = 0.38;
  child.walkSpeed = 4.2;
  child.model = {
    position: position.clone(),
    rotation: { y: 0 },
  };

  child._updateFloatingAndBreathing = vi.fn();
  child._updateLookingAround = vi.fn();
  child._updateChargePose = vi.fn();
  child._updateBlastGesture = vi.fn();
  child._updateAuraParticles = vi.fn();
  return child;
}

describe('WindChild navigation contract', () => {
  it('executes waypoints only when the path result is complete', () => {
    const child = createNavigationHarness();
    const result = pathResult();
    child.navigation = { findPath: vi.fn(() => result) };

    child.moveTo(2, 0);

    expect(child.path).toEqual(result.waypoints);
    expect(child.path).not.toBe(result.waypoints);
    expect(child.pathIndex).toBe(0);
    expect(child.navigationState).toBe('moving');
    expect(child.navigationReason).toBeNull();
  });

  it('clears the previous route when the newest command is not complete', () => {
    const child = createNavigationHarness();
    child.path = [new THREE.Vector3(8, 0, 0)];
    child.pathIndex = 0;
    child.navigationState = 'moving';
    child.navigation = {
      findPath: vi.fn(() =>
        pathResult({
          status: 'partial',
          reason: 'target-unreachable',
          waypoints: [new THREE.Vector3(1, 0, 0)],
        }),
      ),
    };

    child.moveTo(4, 0);

    expect(child.path).toEqual([]);
    expect(child.pathIndex).toBe(0);
    expect(child.navigationState).toBe('cancelled');
    expect(child.navigationReason).toBe('target-unreachable');
  });

  it('stops exactly on a waypoint instead of overshooting it with a large delta', () => {
    const child = createNavigationHarness();
    child.path = [new THREE.Vector3(0.1, 0, 0)];
    child.navigationState = 'moving';

    child.update(1, []);

    expect(child.position).toEqual(new THREE.Vector3(0.1, 0, 0));
    expect(child.path).toEqual([]);
    expect(child.navigationState).toBe('complete');
    expect(child.navigationReason).toBe('arrived');
  });

  it.each([
    {
      axis: 'X',
      target: new THREE.Vector3(3, 0, 0),
      collider: new THREE.Box3(new THREE.Vector3(1, 0, -1), new THREE.Vector3(1.05, 2, 1)),
      blockedCoordinate: 'x',
      freeCoordinate: 'z',
    },
    {
      axis: 'Z',
      target: new THREE.Vector3(0, 0, 3),
      collider: new THREE.Box3(new THREE.Vector3(-1, 0, 1), new THREE.Vector3(1, 2, 1.05)),
      blockedCoordinate: 'z',
      freeCoordinate: 'x',
    },
  ])(
    'uses substeps to prevent tunnelling through a thin $axis collider',
    ({ target, collider, blockedCoordinate, freeCoordinate }) => {
      const child = createNavigationHarness();
      child.path = [target];
      child.navigationState = 'moving';

      child.update(1, [collider]);

      expect(child.position[blockedCoordinate]).toBeLessThanOrEqual(0.621);
      expect(child.position[freeCoordinate]).toBe(0);
      expect(child.path.length).toBe(1);
      expect(child.navigationState).toBe('moving');
    },
  );

  it('cancels a route with an explicit reason after 0.5 seconds continuously blocked', () => {
    const child = createNavigationHarness(new THREE.Vector3(0.6, 0, 0));
    child.path = [new THREE.Vector3(3, 0, 0)];
    child.navigationState = 'moving';
    const wall = new THREE.Box3(new THREE.Vector3(1, 0, -1), new THREE.Vector3(1.1, 2, 1));

    child.update(0.25, [wall]);
    expect(child.navigationState).toBe('moving');

    child.update(0.25, [wall]);

    expect(child.path).toEqual([]);
    expect(child.navigationState).toBe('cancelled');
    expect(child.navigationReason).toBe('blocked');
    expect(child.navigationBlockedTime).toBe(0.5);
  });
});
