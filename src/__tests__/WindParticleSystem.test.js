// @ts-check

import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { WindParticleSystem } from '../effects/WindParticleSystem.js';

describe('WindParticleSystem with VFXManager', () => {
  it('triggers all dynamic abilities via three.quarks presets', async () => {
    const vfxManager = {
      loadPreset: vi.fn().mockResolvedValue(undefined),
      playEffect: vi.fn(() => new THREE.Object3D()),
    };
    
    const system = new WindParticleSystem(new THREE.Scene(), vfxManager);
    system._playBlastSound = vi.fn(); // mock audio to avoid AudioContext errors in test

    const origin = new THREE.Vector3(0, 0, 0);
    const target = new THREE.Vector3(10, 0, 0);
    system.triggerWindBlast(origin, target, 2);

    expect(vfxManager.loadPreset).toHaveBeenCalledWith('VortexBlast', 'vfx/VortexBlast.json');
    expect(vfxManager.loadPreset).toHaveBeenCalledWith('GroundDustBurst', 'vfx/GroundDustBurst.json');
    expect(vfxManager.loadPreset).toHaveBeenCalledWith('ShockwaveRing', 'vfx/ShockwaveRing.json');
    expect(vfxManager.loadPreset).toHaveBeenCalledWith('ImpactPlume', 'vfx/ImpactPlume.json');
    
    await new Promise(resolve => setTimeout(resolve, 0));
    
    expect(vfxManager.playEffect).toHaveBeenCalledWith('VortexBlast', origin);
    expect(vfxManager.playEffect).toHaveBeenCalledWith('GroundDustBurst', origin);
    expect(vfxManager.playEffect).toHaveBeenCalledWith('ShockwaveRing', origin);
    expect(vfxManager.playEffect).toHaveBeenCalledWith('ImpactPlume', target);
    
    expect(system._playBlastSound).toHaveBeenCalledWith(2);
  });

});
