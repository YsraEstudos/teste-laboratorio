// @ts-check
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GroundDustSystem } from '../effects/GroundDustSystem.js';

describe('GroundDustSystem', () => {
  it('instantiates ground dust particles resting on floor and triggers blast impulse', () => {
    const scene = new THREE.Scene();
    const system = new GroundDustSystem(scene, /** @type {any} */ ({}));

    expect(system.dustMesh).toBeDefined();
    expect(scene.children).toContain(system.dustMesh);

    // Trigger blast near origin
    const origin = new THREE.Vector3(0, 0, -54);
    const direction = new THREE.Vector3(0, 0, -1);
    system.triggerDustBlast(origin, direction, 5);

    // Update system frame
    system.update(0.1);

    expect(system.disposed).toBe(false);
    system.dispose();
    expect(system.disposed).toBe(true);
  });
});
