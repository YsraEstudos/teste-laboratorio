// @ts-check

import * as THREE from 'three';

/**
 * Owns the interactive door state and presentation updates for the laboratory.
 * Geometry creation remains in LaboratoryBuilder; this system owns the moving
 * panel colliders and the runtime door lifecycle.
 */
export class DoorSystem {
  /**
   * @param {Array<Record<string, any>>} doors
   */
  constructor(doors = []) {
    this.doors = [];
    this.dynamicColliders = [];
    this.disposed = false;
    for (const door of doors) this.addDoor(door);
  }

  /**
   * @param {Record<string, any>} door
   */
  addDoor(door) {
    if (this.disposed) return door;
    this.doors.push(door);
    door.leftCollider ??= new THREE.Box3();
    door.rightCollider ??= new THREE.Box3();
    this.dynamicColliders.push(door.leftCollider, door.rightCollider);
    this._syncDoorColliders(door);
    return door;
  }

  /**
   * Returns the stable collection whose Box3 instances are updated in place.
   *
   * @returns {THREE.Box3[]}
   */
  getDynamicColliders() {
    return this.dynamicColliders;
  }

  _syncDoorColliders(door) {
    door.leftPanel?.updateWorldMatrix?.(true, false);
    door.rightPanel?.updateWorldMatrix?.(true, false);
    door.leftCollider?.setFromObject?.(door.leftPanel);
    door.rightCollider?.setFromObject?.(door.rightPanel);
    if (door.leftCollider) door.leftCollider.userData = { navigationPassable: true };
    if (door.rightCollider) door.rightCollider.userData = { navigationPassable: true };
  }

  /**
   * @param {number} delta
   * @param {{x: number, z: number}|null} playerPos
   * @param {{x: number, z: number}[]} [additionalPositions]
   */
  update(delta, playerPos, additionalPositions = []) {
    if (this.disposed || (!playerPos && additionalPositions.length === 0)) return;
    const positions = [playerPos, ...additionalPositions].filter(Boolean);

    for (const door of this.doors) {
      const dist = Math.min(
        ...positions.map((position) => {
          const dx = position.x - door.x;
          const dz = position.z - door.z;
          return Math.sqrt(dx * dx + dz * dz);
        }),
      );
      door.isOpen = dist < 3.4;

      const targetOpen = door.isOpen ? 1 : 0;
      const speed = door.isOpen ? 4.8 : 3.5;
      door.openAmount += (targetOpen - door.openAmount) * Math.min(1, delta * speed);

      const slideDistance = door.width * 0.44 * door.openAmount;
      door.leftPanel.position.x = door.baseLeftX - slideDistance;
      door.rightPanel.position.x = door.baseRightX + slideDistance;
      this._syncDoorColliders(door);

      if (door.openAmount > 0.25) {
        door.indicatorMat.color.setHex(0x54f08c);
        door.indicatorMat.emissive.setHex(0x32c462);
        door.indicatorMat.emissiveIntensity = 2.4;
      } else {
        door.indicatorMat.color.setHex(0x49d7e8);
        door.indicatorMat.emissive.setHex(0x24a7c0);
        door.indicatorMat.emissiveIntensity = 1.0;
      }
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.doors.length = 0;
    this.dynamicColliders.length = 0;
  }
}
