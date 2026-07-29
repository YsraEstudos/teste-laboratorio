// @ts-check
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ObjectHighlightSystem } from '../world/ObjectHighlightSystem.js';

describe('ObjectHighlightSystem', () => {
  it('applies emissive highlight color and restores original material after duration', () => {
    const system = new ObjectHighlightSystem();
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x000000, emissiveIntensity: 0 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
    const targetObject = { mesh };

    // Highlight for 300ms
    system.highlight(targetObject, 300, 0x00f3ff);

    expect(material.emissive.getHex()).toBe(0x00f3ff);
    expect(material.emissiveIntensity).toBe(2.0);

    // Advance 0.2s (still active)
    system.update(0.2);
    expect(material.emissive.getHex()).toBe(0x00f3ff);

    // Advance another 0.2s (total 0.4s > 0.3s, should restore)
    system.update(0.2);
    expect(material.emissive.getHex()).toBe(0x000000);
    expect(material.emissiveIntensity).toBe(0);

    system.dispose();
  });

  it('disposes cleanly and restores active highlights', () => {
    const system = new ObjectHighlightSystem();
    const material = new THREE.MeshStandardMaterial({ emissive: 0x111111, emissiveIntensity: 0.5 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);

    system.highlight({ mesh }, 500, 0xff0000);
    expect(material.emissive.getHex()).toBe(0xff0000);

    system.dispose();
    expect(material.emissive.getHex()).toBe(0x111111);
    expect(material.emissiveIntensity).toBe(0.5);
  });
});
