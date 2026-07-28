// @ts-check

/**
 * Owns the runtime integration of objects in the Confirmed 42 test room.
 * Creation remains in LaboratoryBuilder until the scene is split into
 * dedicated construction systems. The public objects array preserves the
 * existing Game/WindSystem integration contract.
 */
export class TestObjectSystem {
  /**
   * @param {Array<Record<string, any>>} objects
   * @param {{minX?: number, maxX?: number, minZ?: number, maxZ?: number}} bounds
   */
  constructor(objects = [], bounds = {}) {
    this.objects = objects;
    this.bounds = {
      minX: bounds.minX ?? -11.2,
      maxX: bounds.maxX ?? 11.2,
      minZ: bounds.minZ ?? -63.2,
      maxZ: bounds.maxZ ?? -46.5,
    };
    this.disposed = false;
  }

  /**
   * @param {Record<string, any>} object
   */
  addObject(object) {
    if (this.disposed) return object;
    this.objects.push(object);
    return object;
  }

  /**
   * @param {number} delta
   * @param {{applyToObjects?: (objects: Array<Record<string, any>>, delta: number) => void}|null} windSystem
   */
  update(delta, windSystem = null) {
    if (this.disposed) return;
    if (windSystem?.applyToObjects) windSystem.applyToObjects(this.objects, delta);

    // Physics Update for paper sheets, leaves, cardboard boxes and rocks.
    for (const obj of this.objects) {
      if (obj.velocity.lengthSq() <= 0.001) continue;

      obj.mesh.position.x += obj.velocity.x * delta;
      obj.mesh.position.z += obj.velocity.z * delta;

      if (obj.velocity.y) {
        obj.mesh.position.y += obj.velocity.y * delta;
        obj.velocity.y -= delta * 6.5;
        if (obj.mesh.position.y < 0.04) {
          obj.mesh.position.y = 0.04;
          obj.velocity.y = 0;
        }
      }

      if (obj.type === 'pedra') {
        obj.mesh.rotation.x += obj.velocity.z * delta * 1.8;
        obj.mesh.rotation.z -= obj.velocity.x * delta * 1.8;
      } else if (obj.type === 'folha_papel' || obj.type === 'folha_arvore') {
        obj.mesh.rotation.z += (obj.velocity.x + obj.velocity.z) * delta * 4.0;
        obj.mesh.rotation.x += obj.velocity.z * delta * 3.0;
      } else {
        obj.mesh.rotation.y += (obj.velocity.x + obj.velocity.z) * delta * 2.5;
        obj.mesh.rotation.x += obj.velocity.z * delta * 1.2;
      }

      obj.velocity.multiplyScalar(Math.exp(-3.8 * delta));

      // Keep the existing boundary response, including the light-object wall lift.
      if (obj.mesh.position.x < this.bounds.minX) {
        obj.mesh.position.x = this.bounds.minX;
        obj.velocity.x *= -0.4;
        this._applyWallLift(obj);
      } else if (obj.mesh.position.x > this.bounds.maxX) {
        obj.mesh.position.x = this.bounds.maxX;
        obj.velocity.x *= -0.4;
        this._applyWallLift(obj);
      }
      if (obj.mesh.position.z < this.bounds.minZ) {
        obj.mesh.position.z = this.bounds.minZ;
        obj.velocity.z *= -0.4;
        this._applyWallLift(obj);
      } else if (obj.mesh.position.z > this.bounds.maxZ && Math.abs(obj.mesh.position.x) > 2.8) {
        obj.mesh.position.z = this.bounds.maxZ;
        obj.velocity.z *= -0.4;
      }
    }
  }

  /** @param {Record<string, any>} object */
  _applyWallLift(object) {
    if (object.type !== 'folha_papel' && object.type !== 'folha_arvore') return;
    if (!object.velocity.y) object.velocity.y = 0;
    object.velocity.y += 3.8;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.objects.length = 0;
  }
}
