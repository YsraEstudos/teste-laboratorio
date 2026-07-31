import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { SandTerrainSystem } from '../world/SandTerrainSystem.js';
import { SAND_BOUNDS } from '../world/SandBounds.js';

const EPS = 1e-6;

function expectWallFlushWithBounds(wall, bounds) {
  const size = wall.geometry.parameters;
  const minX = wall.position.x - size.width / 2;
  const maxX = wall.position.x + size.width / 2;
  const minZ = wall.position.z - size.depth / 2;
  const maxZ = wall.position.z + size.depth / 2;

  // A wall is flush against one perimeter edge on its thin (thickness) axis,
  // while its long dimension spans the whole arena along the other axis.
  let edge = null;
  if (size.width < size.depth) {
    // Thin in X (oriented along Z): the long (depth) dimension must cover
    // the full arena in Z.
    expect(minZ).toBeCloseTo(bounds.minZ, 6);
    expect(maxZ).toBeCloseTo(bounds.maxZ, 6);
    if (Math.abs(minX - bounds.minX) < EPS) edge = 'minX';
    else if (Math.abs(maxX - bounds.maxX) < EPS) edge = 'maxX';
  } else {
    // Thin in Z (oriented along X): the long (width) dimension must cover
    // the full arena in X.
    expect(minX).toBeCloseTo(bounds.minX, 6);
    expect(maxX).toBeCloseTo(bounds.maxX, 6);
    if (Math.abs(minZ - bounds.minZ) < EPS) edge = 'minZ';
    else if (Math.abs(maxZ - bounds.maxZ) < EPS) edge = 'maxZ';
  }
  expect(edge).not.toBeNull();
  expect(wall.position.y + size.height / 2).toBeCloseTo(0, 6);
  expect(wall.position.y - size.height / 2).toBeLessThan(-0.74);
  return edge;
}

describe('SandTerrainSystem quality budget', () => {
  it('uses the per-profile non-uniform geometry budget without casting shadows', () => {
    const high = new SandTerrainSystem(new THREE.Scene(), { quality: 'high' });
    expect(high.getDebugStats().triangles).toBe(240 * 180 * 2);
    expect(high.getDebugStats().textureResolution).toEqual({ width: 512, height: 384 });
    expect(high.mesh.castShadow).toBe(false);
    high.dispose();

    const medium = new SandTerrainSystem(new THREE.Scene(), { quality: 'medium' });
    expect(medium.getDebugStats().triangles).toBe(160 * 120 * 2);
    medium.dispose();

    const low = new SandTerrainSystem(new THREE.Scene(), { quality: 'low' });
    expect(low.getDebugStats().triangles).toBe(96 * 72 * 2);
    low.dispose();
  });

  it('builds a fixed base 0.75 m below the top surface', () => {
    const terrain = new SandTerrainSystem(new THREE.Scene(), { quality: 'medium' });
    expect(terrain.baseMesh).toBeDefined();
    const params = terrain.baseMesh.geometry.parameters;
    expect(params.width).toBe(24);
    expect(params.depth).toBe(18);
    // Base top at y = -0.75 (center -0.76 with 0.02 height).
    expect(terrain.baseMesh.position.y + params.height / 2).toBeCloseTo(-0.75, 6);
    expect(terrain.baseMesh.castShadow).toBe(false);
    terrain.dispose();
  });

  it('builds exactly four 0.75 m perimeter walls flush with the sand bounds', () => {
    const terrain = new SandTerrainSystem(new THREE.Scene(), { quality: 'medium' });
    expect(terrain.wallMeshes).toHaveLength(4);
    const matchedEdges = terrain.wallMeshes.map((wall) => {
      const edge = expectWallFlushWithBounds(wall, SAND_BOUNDS);
      expect(wall.castShadow).toBe(false);
      return edge;
    });
    // Each perimeter edge (minX, maxX, minZ, maxZ) must be covered exactly once.
    expect(matchedEdges.sort()).toEqual(['maxX', 'maxZ', 'minX', 'minZ']);
    terrain.dispose();
  });

  it('releases PBR maps and structural geometry after disposal', () => {
    const terrain = new SandTerrainSystem(new THREE.Scene(), { quality: 'medium' });
    const materialDispose = vi.spyOn(terrain.material.map, 'dispose');
    const baseDispose = vi.spyOn(terrain.baseMesh.geometry, 'dispose');
    const wallDispose = vi.spyOn(terrain.wallMeshes[0].geometry, 'dispose');
    const structuralDispose = vi.spyOn(terrain.structuralMaterial, 'dispose');
    terrain.dispose();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(baseDispose).toHaveBeenCalledOnce();
    expect(wallDispose).toHaveBeenCalledOnce();
    expect(structuralDispose).toHaveBeenCalledOnce();
  });

  it('mantém o limite de brushes por frame até a publicação do campo', () => {
    const terrain = new SandTerrainSystem(new THREE.Scene(), { quality: 'high' });

    for (let index = 0; index < 96; index += 1) {
      expect(terrain.brush(-10 + index * 0.2, -55, 0.1, 0.05)).toBe(true);
    }
    expect(terrain.brush(0, -55, 0.1, 0.05)).toBe(false);
    expect(terrain.getDebugStats().droppedBrushes).toBe(1);

    terrain.update(1 / 60, 0);
    expect(terrain.brush(0, -55, 0.1, 0.05)).toBe(true);
    terrain.dispose();
  });
});

describe('SandTerrainSystem.applyFootprint', () => {
  it('accepts in-bounds footprints and rejects out-of-bounds or invalid ones', () => {
    const terrain = new SandTerrainSystem(new THREE.Scene(), { quality: 'high' });
    expect(terrain.applyFootprint(0, -55, 0, { width: 0.15, length: 0.29 })).toBe(true);
    expect(terrain.applyFootprint(-11.5, -46.5, Math.PI / 2)).toBe(true);
    expect(terrain.applyFootprint(100, 100, 0)).toBe(false);
    expect(terrain.applyFootprint(0, -55, 0, { width: 0, length: 0.29 })).toBe(false);
    expect(terrain.applyFootprint(0, -55, 0, { depth: -1 })).toBe(false);
    expect(terrain.getDebugStats().footprintCount).toBe(2);
    terrain.dispose();
  });

  it('respects the per-frame brush budget (two slots per footprint)', () => {
    const terrain = new SandTerrainSystem(new THREE.Scene(), { quality: 'low' }); // 32 slots
    let accepted = 0;
    for (let index = 0; index < 20; index += 1) {
      if (terrain.applyFootprint(-10 + index * 0.8, -55, 0)) accepted += 1;
    }
    expect(accepted).toBe(16);
    expect(terrain.getDebugStats().droppedBrushes).toBe(8);
    expect(terrain.getDebugStats().footprintCount).toBe(16);
    terrain.dispose();
  });

  it('recovers gradually: visible at ~60 s, almost recomposed at ~120 s', () => {
    const terrain = new SandTerrainSystem(new THREE.Scene(), { quality: 'medium' });
    expect(terrain.brush(0, -55, 0.15, 0.2)).toBe(true); // full max depth
    terrain.update(1 / 60);

    terrain.update(60);
    const after60 = terrain.sampleWorld(0, -55);
    expect(after60.depth).toBeGreaterThan((40 / 255) * 0.2); // still clearly visible

    terrain.update(60);
    const after120 = terrain.sampleWorld(0, -55);
    expect(after120.depth).toBeLessThan((25 / 255) * 0.2); // recomposed by ~2 min
    terrain.dispose();
  });
});
