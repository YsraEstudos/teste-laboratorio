import { VFXManager } from '../effects/VFXManager.js';
import * as THREE from 'three';
import { test, expect } from 'vitest';

test('VFXManager handles instantiation without WebGL', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();

  // We mock renderer because WebGLRenderer throws in Node if there is no canvas or WebGL context.
  // Let's test if VFXManager itself works.
  const renderer = {
    capabilities: { isWebGL2: false },
  };

  const manager = new VFXManager(scene, camera, renderer);
  expect(manager).toBeDefined();
});
