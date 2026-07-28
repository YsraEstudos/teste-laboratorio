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
  });
});
