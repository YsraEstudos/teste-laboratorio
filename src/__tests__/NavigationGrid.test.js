import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { NavigationGrid } from '../world/NavigationGrid.js';

function createGrid(colliders = [], options = {}) {
  return new NavigationGrid(colliders, {
    minX: 0,
    maxX: 5,
    minZ: 0,
    maxZ: 3,
    cellSize: 1,
    ...options,
  });
}

describe('NavigationGrid structured path result', () => {
  it('returns a complete result with requested and resolved target metadata', () => {
    const grid = createGrid();

    const result = grid.findPath(0.5, 0.5, 4.5, 0.5);

    expect(Array.isArray(result)).toBe(false);
    expect(result).toMatchObject({
      status: 'complete',
      reason: null,
      adjustedStart: false,
      adjustedTarget: false,
    });
    expect(result.requestedTarget).toEqual(new THREE.Vector3(4.5, 0, 0.5));
    expect(result.resolvedTarget).toEqual(new THREE.Vector3(4.5, 0, 0.5));
    expect(result.waypoints).toEqual([new THREE.Vector3(4.5, 0, 0.5)]);
  });

  it('reports when a blocked target was adjusted to the nearest walkable cell', () => {
    const blockedTarget = new THREE.Box3(new THREE.Vector3(4, 0, 0), new THREE.Vector3(5, 2, 1));
    const grid = createGrid([blockedTarget]);

    const result = grid.findPath(0.5, 0.5, 4.5, 0.5);

    expect(result).toMatchObject({
      status: 'complete',
      reason: 'target-adjusted',
      adjustedStart: false,
      adjustedTarget: true,
    });
    expect(result.requestedTarget).toEqual(new THREE.Vector3(4.5, 0, 0.5));
    expect(result.resolvedTarget).toEqual(new THREE.Vector3(3.5, 0, 0.5));
    expect(result.waypoints.at(-1)).toEqual(result.resolvedTarget);
  });

  it('returns a partial result instead of presenting an unreachable target as complete', () => {
    const barrier = new THREE.Box3(new THREE.Vector3(2, 0, 0), new THREE.Vector3(3, 2, 3));
    const grid = createGrid([barrier]);

    const result = grid.findPath(0.5, 1.5, 4.5, 1.5);

    expect(result).toMatchObject({
      status: 'partial',
      reason: 'target-unreachable',
      adjustedStart: false,
      adjustedTarget: false,
    });
    expect(result.requestedTarget).toEqual(new THREE.Vector3(4.5, 0, 1.5));
    expect(result.resolvedTarget).toEqual(new THREE.Vector3(4.5, 0, 1.5));
    expect(result.waypoints.length).toBeGreaterThan(0);
    expect(result.waypoints.at(-1).x).toBeLessThan(2);
  });

  it('returns an invalid result with the full shape for non-finite commands', () => {
    const grid = createGrid();

    const result = grid.findPath(0.5, 0.5, Number.NaN, 1);

    expect(result).toEqual({
      status: 'invalid',
      reason: 'invalid-coordinates',
      waypoints: [],
      requestedTarget: null,
      resolvedTarget: null,
      adjustedStart: false,
      adjustedTarget: false,
    });
  });
});

describe('NavigationGrid dynamic obstacles', () => {
  it('routes around a dynamic door without crossing its collider', () => {
    const grid = createGrid();
    const closedDoor = new THREE.Box3(new THREE.Vector3(2, 0, 1), new THREE.Vector3(3, 2, 2));

    const result = grid.findPath(0.5, 1.5, 4.5, 1.5, {
      dynamicColliders: [closedDoor],
    });

    expect(result.status).toBe('complete');
    expect(result.waypoints.some((waypoint) => waypoint.z !== 1.5)).toBe(true);
    expect(
      result.waypoints.every(
        (waypoint) =>
          waypoint.x < closedDoor.min.x ||
          waypoint.x > closedDoor.max.x ||
          waypoint.z < closedDoor.min.z ||
          waypoint.z > closedDoor.max.z,
      ),
    ).toBe(true);
  });

  it('does not cut diagonally between dynamic colliders that block both adjacent cells', () => {
    const grid = createGrid([], { maxX: 2, maxZ: 2 });
    const eastBlocker = new THREE.Box3(new THREE.Vector3(1, 0, 0), new THREE.Vector3(2, 2, 1));
    const southBlocker = new THREE.Box3(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 2, 2));

    const result = grid.findPath(0.5, 0.5, 1.5, 1.5, {
      dynamicColliders: [eastBlocker, southBlocker],
    });

    expect(result.status).not.toBe('complete');
    expect(result.reason).toBe('target-unreachable');
  });

  it('smooths clear waypoints but keeps the turn that avoids a collider', () => {
    const grid = createGrid();
    const blocker = new THREE.Box3(new THREE.Vector3(2.2, 0, 1.2), new THREE.Vector3(2.8, 2, 1.8));
    const path = [
      new THREE.Vector3(0.5, 0, 1.5),
      new THREE.Vector3(0.5, 0, 0.5),
      new THREE.Vector3(1.5, 0, 0.5),
      new THREE.Vector3(3.5, 0, 0.5),
      new THREE.Vector3(4.5, 0, 1.5),
    ];

    const smoothed = grid.smoothPath(path, [blocker]);

    expect(smoothed).toEqual([
      new THREE.Vector3(0.5, 0, 1.5),
      new THREE.Vector3(1.5, 0, 0.5),
      new THREE.Vector3(3.5, 0, 0.5),
      new THREE.Vector3(4.5, 0, 1.5),
    ]);
  });
});
