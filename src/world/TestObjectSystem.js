// @ts-check
import * as THREE from 'three';

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
    this.sandTime = 0;
    this.lastFootprints = new Map();
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
   * @param {any} sandSystem
   */
  update(delta, windSystem = null, sandSystem = null) {
    if (this.disposed) return;
    this.sandTime += delta;
    if (windSystem?.applyToObjects) windSystem.applyToObjects(this.objects, delta);

    // Physics Update for paper sheets, leaves, cardboard boxes and rocks.
    for (const obj of this.objects) {
      if (!obj || !obj.mesh || !obj.mesh.position) continue;
      if (!obj.velocity) obj.velocity = new THREE.Vector3();

      obj.mesh.position.x += (obj.velocity.x || 0) * delta;
      obj.mesh.position.z += (obj.velocity.z || 0) * delta;

      // Phase 6: Física de Drag & Depth Sinking
      let groundY = 0.04;
      let depthSink = 0.0;
      let isHeavy = false;

      if (sandSystem) {
        groundY = sandSystem.getElevationAt(obj.mesh.position.x, obj.mesh.position.z);
        groundY -= sandSystem.sampleWorld?.(obj.mesh.position.x, obj.mesh.position.z)?.depth ?? 0;

        if (obj.type === 'folha_papel' || obj.type === 'folha_arvore') {
          // Objetos leves ficam nivelados na elevação exata da duna + 0.01
          groundY += 0.01;
        } else if (obj.type === 'caixa' || obj.type === 'papelao') {
          // Caixas afundam em -0.06m
          depthSink = 0.06;
          groundY -= depthSink;
          isHeavy = true;
        } else if (obj.type === 'pedra') {
          // Pedras de 25kg afundam em -0.15m
          depthSink = 0.15;
          groundY -= depthSink;
          isHeavy = true;
        }
      }

      const horizontalSpeedSq = obj.velocity.x * obj.velocity.x + obj.velocity.z * obj.velocity.z;

      if (obj.mesh.position.y > groundY + 0.001) {
        obj.mesh.position.y += obj.velocity.y * delta;
        obj.velocity.y -= delta * 6.5;
        if (obj.mesh.position.y <= groundY) {
          obj.mesh.position.y = groundY;
          obj.velocity.y = 0;
          if (isHeavy && sandSystem && horizontalSpeedSq > 0.01) {
            this._stampHeavyObject(obj, sandSystem, depthSink);
          }
        }
      } else {
        obj.mesh.position.y = groundY;
        obj.velocity.y = 0;
        if (isHeavy && sandSystem && horizontalSpeedSq > 0.01) {
          this._stampHeavyObject(obj, sandSystem, depthSink);
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

      // Drag extra na areia para objetos pesados
      const friction = isHeavy ? 6.0 : 3.8;
      obj.velocity.multiplyScalar(Math.exp(-friction * delta));
      if (obj.velocity.lengthSq() < 0.01) {
        obj.velocity.set(0, 0, 0);
      }

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
      } else if (obj.mesh.position.z > this.bounds.maxZ) {
        obj.mesh.position.z = this.bounds.maxZ;
        obj.velocity.z *= -0.4;
      }
    }
  }

  /** @param {Record<string, any>} object */
  _applyWallLift(object) {
    if (object.type !== 'folha_papel' && object.type !== 'folha_arvore') return;
    if (!object.velocity.y) object.velocity.y = 0;
    if (object.velocity.y < 2.0) object.velocity.y += 1.5;
  }

  _stampHeavyObject(object, sandSystem, depthSink) {
    const previous = this.lastFootprints.get(object);
    const distance = previous
      ? Math.hypot(object.mesh.position.x - previous.x, object.mesh.position.z - previous.z)
      : 0;
    if (distance < 0.35 && this.sandTime - (previous?.time ?? 0) < 0.12) return;
    const brush = sandSystem.brush ?? sandSystem.addFootprint;
    brush?.call(sandSystem, object.mesh.position.x, object.mesh.position.z, 0.4, depthSink, depthSink * 0.25, 0.75);
    this.lastFootprints.set(object, {
      x: object.mesh.position.x,
      z: object.mesh.position.z,
      time: this.sandTime,
    });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.objects.length = 0;
  }
}
