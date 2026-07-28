// @ts-check

/**
 * Owns the interactive door state and presentation updates for the laboratory.
 * Geometry and collider creation remain in LaboratoryBuilder for now; this
 * system only manages the runtime door lifecycle.
 */
export class DoorSystem {
  /**
   * @param {Array<Record<string, any>>} doors
   */
  constructor(doors = []) {
    this.doors = doors;
    this.disposed = false;
  }

  /**
   * @param {Record<string, any>} door
   */
  addDoor(door) {
    if (this.disposed) return door;
    this.doors.push(door);
    return door;
  }

  /**
   * @param {number} delta
   * @param {{x: number, z: number}|null} playerPos
   */
  update(delta, playerPos) {
    if (this.disposed || !playerPos) return;

    for (const door of this.doors) {
      const dx = playerPos.x - door.x;
      const dz = playerPos.z - door.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      door.isOpen = dist < 3.4;

      const targetOpen = door.isOpen ? 1 : 0;
      const speed = door.isOpen ? 4.8 : 3.5;
      door.openAmount += (targetOpen - door.openAmount) * Math.min(1, delta * speed);

      const slideDistance = door.width * 0.44 * door.openAmount;
      door.leftPanel.position.x = door.baseLeftX - slideDistance;
      door.rightPanel.position.x = door.baseRightX + slideDistance;

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
  }
}
