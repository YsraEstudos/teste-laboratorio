import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { WindChild } from '../entities/WindChild.js';
import { NavigationGrid } from '../world/NavigationGrid.js';

function createChild(position = new THREE.Vector3(0.5, 0, 1.5)) {
  const child = Object.create(WindChild.prototype);
  child.position = position.clone();
  child.velocity = new THREE.Vector3();
  child.path = [];
  child.pathIndex = 0;
  child.navigation = null;
  child.navigationState = 'idle';
  child.navigationReason = null;
  child.navigationBlockedTime = 0;
  child.navigationBlockTimeout = 0.5;
  child.navigationRadius = 0.38;
  child.navigationMaxSubstep = 0.18;
  child.walkSpeed = 4.2;
  child.model = { position: position.clone(), rotation: { y: 0 } };
  child._navigationDirection = new THREE.Vector3();
  child._navigationStart = new THREE.Vector3();
  child._navigationAABB = new THREE.Box3();
  return child;
}

function createGrid() {
  return new NavigationGrid([], {
    minX: 0,
    maxX: 5,
    minZ: 0,
    maxZ: 3,
    cellSize: 1,
  });
}

describe('WindChild dynamic navigation lifecycle', () => {
  it('replans around the current collider when a door closes over the active segment', () => {
    const child = createChild();
    const closedDoor = new THREE.Box3(new THREE.Vector3(1, 0, 1), new THREE.Vector3(2, 2, 2));
    child.setNavigation(createGrid());
    child.moveTo(4.5, 1.5);

    WindChild.prototype._updateNavigation.call(child, 0.25, [closedDoor]);
    WindChild.prototype._updateNavigation.call(child, 0.25, [closedDoor]);

    expect(child.path.some((waypoint) => waypoint.z !== 1.5)).toBe(true);
    expect(child.navigationState).toBe('moving');
    expect(child.navigationReason).toBeNull();
    expect(child.navigationBlockedTime).toBe(0);
  });

  it('clears destination and exposes the structured reason when replanning fails', () => {
    const child = createChild();
    const closedDoor = new THREE.Box3(new THREE.Vector3(1, 0, 0), new THREE.Vector3(2, 2, 3));
    child.setNavigation(createGrid());
    child.moveTo(4.5, 1.5);

    WindChild.prototype._updateNavigation.call(child, 0.5, [closedDoor]);

    expect(child.path).toEqual([]);
    expect(child.pathIndex).toBe(0);
    expect(child.navigationDestination).toBeNull();
    expect(child.navigationState).toBe('cancelled');
    expect(child.navigationReason).toBe('target-unreachable');
  });
});
