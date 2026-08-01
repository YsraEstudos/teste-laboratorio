// @ts-check

import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LaboratoryBuilder } from '../world/LaboratoryBuilder.js';
import { TextureGenerator } from '../world/TextureGenerator.js';

afterEach(() => {
  TextureGenerator._cache.clear();
  vi.restoreAllMocks();
});

describe('LaboratoryBuilder.dispose', () => {
  it('removes only its root and disposes only owned resources once', () => {
    const sharedTexture = new THREE.Texture();
    const sharedTextureDispose = vi.spyOn(sharedTexture, 'dispose');
    vi.spyOn(TextureGenerator, '_texture').mockReturnValue(sharedTexture);

    const scene = new THREE.Scene();
    const externalGeometry = new THREE.BoxGeometry();
    const externalMaterial = new THREE.MeshBasicMaterial();
    const externalMesh = new THREE.Mesh(externalGeometry, externalMaterial);
    scene.add(externalMesh);

    const builder = new LaboratoryBuilder(scene);
    const ownGeometryDispose = vi.spyOn(builder.unitBoxGeo, 'dispose');
    const ownMaterialDispose = vi.spyOn(builder.materials.floor, 'dispose');
    const ownedTexture = builder.materials.floor.map;
    expect(ownedTexture).not.toBe(sharedTexture);
    const ownTextureDispose = vi.spyOn(ownedTexture, 'dispose');
    const externalGeometryDispose = vi.spyOn(externalGeometry, 'dispose');
    const externalMaterialDispose = vi.spyOn(externalMaterial, 'dispose');

    expect(builder.root).toBeInstanceOf(THREE.Group);
    expect(builder.root.parent).toBe(scene);
    expect(externalMesh.parent).toBe(scene);
    expect(builder.doorSystem.doors).toBe(builder.doors);
    expect(builder.testObjectSystem.objects).toBe(builder.testObjects);

    builder.dispose();
    builder.dispose();

    expect(builder.root.parent).toBeNull();
    expect(externalMesh.parent).toBe(scene);
    expect(ownGeometryDispose).toHaveBeenCalledOnce();
    expect(ownMaterialDispose).toHaveBeenCalledOnce();
    expect(ownTextureDispose).toHaveBeenCalledOnce();
    expect(sharedTextureDispose).not.toHaveBeenCalled();
    expect(externalGeometryDispose).not.toHaveBeenCalled();
    expect(externalMaterialDispose).not.toHaveBeenCalled();
    expect(builder.doorSystem.disposed).toBe(true);
    expect(builder.testObjectSystem.disposed).toBe(true);
    expect(builder.testObjects).toHaveLength(0);
    expect(builder.sandFootstepSystem.disposed).toBe(true);
    expect(builder.sandFootstepSystem.getStats().registered).toBe(0);
  });

  it('creates a footstep system with player and wind-child actors registered', () => {
    const scene = new THREE.Scene();
    const builder = new LaboratoryBuilder(scene);
    const stats = builder.sandFootstepSystem.getStats();
    expect(stats.registered).toBe(2);
    expect(builder.sandFootstepSystem.hasDetailedFootprints('player')).toBe(true);
    expect(builder.sandFootstepSystem.hasDetailedFootprints('wind-child')).toBe(true);
    builder.dispose();
  });

  it('enables detailed wind-child footprints only on the high quality profile', () => {
    const high = new LaboratoryBuilder(new THREE.Scene());
    expect(high.sandFootstepSystem.hasDetailedFootprints('wind-child')).toBe(true);
    high.dispose();

    const medium = new LaboratoryBuilder(new THREE.Scene(), null, { quality: 'medium' });
    expect(medium.sandFootstepSystem.hasDetailedFootprints('wind-child')).toBe(false);
    medium.dispose();

    const low = new LaboratoryBuilder(new THREE.Scene(), null, { quality: 'low' });
    expect(low.sandFootstepSystem.hasDetailedFootprints('wind-child')).toBe(false);
    low.dispose();
  });

  it('keeps real area lights within the startup render budget', () => {
    vi.spyOn(TextureGenerator, '_texture').mockImplementation(() => new THREE.Texture());

    const scene = new THREE.Scene();
    const builder = new LaboratoryBuilder(scene);
    const areaLights = [];

    builder.root.traverse((object) => {
      if (object.isRectAreaLight) areaLights.push(object);
    });

    expect(areaLights.length).toBeLessThanOrEqual(8);
    builder.dispose();
  });
});
