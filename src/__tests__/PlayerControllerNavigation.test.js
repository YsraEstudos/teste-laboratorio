import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { PlayerController } from '../entities/PlayerController.js';

function createController(result) {
  return {
    navigation: { findPath: vi.fn(() => result) },
    position: new THREE.Vector3(),
    path: [new THREE.Vector3(9, 0, 9)],
    pathIndex: 0,
    destination: new THREE.Vector3(9, 0, 9),
    destinationMarker: {
      position: new THREE.Vector3(9, 0, 9),
      visible: true,
    },
  };
}

describe('PlayerController structured navigation result', () => {
  it('preserves click movement by applying waypoints from a complete result', () => {
    const waypoints = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(2, 0, 0)];
    const controller = createController({
      status: 'complete',
      reason: null,
      waypoints,
    });

    PlayerController.prototype.moveTo.call(controller, 2, 0);

    expect(controller.path).toEqual(waypoints);
    expect(controller.path).not.toBe(waypoints);
    expect(controller.pathIndex).toBe(0);
    expect(controller.destination).toEqual(new THREE.Vector3(2, 0, 0));
    expect(controller.destinationMarker.position).toEqual(new THREE.Vector3(2, 0, 0));
    expect(controller.destinationMarker.visible).toBe(true);
  });

  it('clears the previous click route when the newest result is not complete', () => {
    const controller = createController({
      status: 'partial',
      reason: 'target-unreachable',
      waypoints: [new THREE.Vector3(1, 0, 0)],
    });

    PlayerController.prototype.moveTo.call(controller, 4, 0);

    expect(controller.path).toEqual([]);
    expect(controller.pathIndex).toBe(0);
    expect(controller.destination).toBeNull();
    expect(controller.destinationMarker.visible).toBe(false);
  });
});
