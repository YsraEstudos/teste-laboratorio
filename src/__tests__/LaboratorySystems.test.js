// @ts-check

import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { DoorSystem } from '../world/DoorSystem.js';
import { TestObjectSystem } from '../world/TestObjectSystem.js';

describe('DoorSystem', () => {
  it('owns door animation state and opens panels near the player', () => {
    const indicatorMat = {
      color: { setHex: vi.fn() },
      emissive: { setHex: vi.fn() },
      emissiveIntensity: 0,
    };
    const leftPanel = new THREE.Object3D();
    const rightPanel = new THREE.Object3D();
    const door = {
      x: 0,
      z: 0,
      width: 6,
      leftPanel,
      rightPanel,
      indicatorMat,
      baseLeftX: -1.44,
      baseRightX: 1.44,
      openAmount: 0,
      isOpen: false,
    };
    const system = new DoorSystem([door]);

    system.update(1 / 60, new THREE.Vector3(0, 0, 1));

    expect(door.isOpen).toBe(true);
    expect(door.openAmount).toBeGreaterThan(0);
    expect(leftPanel.position.x).toBeLessThan(door.baseLeftX);
    expect(rightPanel.position.x).toBeGreaterThan(door.baseRightX);
    expect(indicatorMat.color.setHex).toHaveBeenCalled();
  });

  it('stops mutating doors after idempotent disposal', () => {
    const door = {
      x: 0,
      z: 0,
      width: 4,
      leftPanel: new THREE.Object3D(),
      rightPanel: new THREE.Object3D(),
      indicatorMat: { color: { setHex: vi.fn() }, emissive: { setHex: vi.fn() } },
      baseLeftX: -1,
      baseRightX: 1,
      openAmount: 0,
      isOpen: false,
    };
    const system = new DoorSystem([door]);
    system.dispose();
    system.dispose();
    system.update(1, new THREE.Vector3(0, 0, 0));

    expect(system.disposed).toBe(true);
    expect(system.doors).toHaveLength(0);
    expect(door.openAmount).toBe(0);
  });

  it('keeps stable dynamic colliders synchronized with the moving panels', () => {
    const panelGeometry = new THREE.BoxGeometry(1, 2, 0.1);
    const leftPanel = new THREE.Mesh(panelGeometry);
    const rightPanel = new THREE.Mesh(panelGeometry);
    const group = new THREE.Group();
    group.add(leftPanel, rightPanel);
    const door = {
      x: 0,
      z: 0,
      width: 4,
      group,
      leftPanel,
      rightPanel,
      indicatorMat: {
        color: { setHex: vi.fn() },
        emissive: { setHex: vi.fn() },
      },
      baseLeftX: -0.5,
      baseRightX: 0.5,
      openAmount: 0,
      isOpen: false,
    };
    leftPanel.position.x = door.baseLeftX;
    rightPanel.position.x = door.baseRightX;
    const system = new DoorSystem([door]);
    const colliders = system.getDynamicColliders();
    const initialLeftMinX = colliders[0].min.x;

    system.update(1, new THREE.Vector3(0, 0, 0));

    expect(system.getDynamicColliders()).toBe(colliders);
    expect(colliders).toHaveLength(2);
    expect(colliders[0].min.x).toBeLessThan(initialLeftMinX);
    expect(colliders[1].max.x).toBeGreaterThan(1);
  });
});

describe('TestObjectSystem', () => {
  it('delegates wind and integrates movement with room bounds', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    mesh.position.set(11.5, 0.04, -50);
    const object = {
      mesh,
      position: mesh.position,
      velocity: new THREE.Vector3(2, 0, 0),
      mass: 1,
      type: 'papelao',
    };
    const windSystem = { applyToObjects: vi.fn() };
    const system = new TestObjectSystem([object]);

    system.update(0.1, windSystem);

    expect(windSystem.applyToObjects).toHaveBeenCalledWith([object], 0.1);
    expect(mesh.position.x).toBeLessThanOrEqual(11.2);
    expect(object.velocity.x).toBeLessThan(0);
  });

  it('clears owned object references when disposed and ignores later updates', () => {
    const object = { mesh: new THREE.Object3D(), position: new THREE.Vector3(), velocity: new THREE.Vector3() };
    const system = new TestObjectSystem([object]);
    system.dispose();
    system.dispose();
    system.update(1, { applyToObjects: vi.fn() });

    expect(system.disposed).toBe(true);
    expect(system.objects).toHaveLength(0);
  });
});
