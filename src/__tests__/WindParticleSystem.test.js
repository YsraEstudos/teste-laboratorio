// @ts-check

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { WindParticleSystem } from '../effects/WindParticleSystem.js';

function pooledParticle() {
  return {
    active: false,
    directional: true,
    source: 'blast',
    life: 0,
    maxLife: 1,
    startScale: 1,
    endScale: 1,
    rotSpeed: 0,
    mesh: {
      position: new THREE.Vector3(),
      rotation: { z: 0 },
      visible: false,
    },
    velocity: new THREE.Vector3(),
  };
}

describe('WindParticleSystem pool reuse', () => {
  it('clears directional state when impact smoke and dust are reused by normal blast emissions', () => {
    const system = Object.create(WindParticleSystem.prototype);
    const smoke = pooledParticle();
    const dust = pooledParticle();
    system.maxVortexParticles = 0;
    system.vortexData = [];
    system.maxSmokePuffs = 1;
    system.smokePuffs = [smoke];
    system.maxRings = 0;
    system.rings = [];
    system.maxDustPuffs = 1;
    system.dustPuffs = [dust];
    system._perpA = new THREE.Vector3();
    system._perpB = new THREE.Vector3();

    system.triggerWindBlast(new THREE.Vector3(), new THREE.Vector3(1, 0, 0), 1, {
      source: 'blast',
    });

    expect(smoke.active).toBe(true);
    expect(smoke.directional).toBe(false);
    expect(dust.active).toBe(true);
    expect(dust.directional).toBe(false);
  });
});
