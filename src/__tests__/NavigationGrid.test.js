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
