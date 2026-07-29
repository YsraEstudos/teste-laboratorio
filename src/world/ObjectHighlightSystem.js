// @ts-check
import * as THREE from 'three';

/**
 * Manages brief visual highlighting (emissive flash / scale pulse) for physical objects
 * when targeted by the player or Wind Child.
 */
export class ObjectHighlightSystem {
  constructor() {
    /** @type {Map<import('three').Object3D, { originalEmissive: THREE.Color, originalEmissiveIntensity: number, duration: number, mesh: THREE.Mesh }>} */
    this.activeHighlights = new Map();
    this.disposed = false;
  }

  /**
   * Highlights a target object (or mesh) for a specified duration in milliseconds.
   * 
   * @param {Record<string, any>} targetObject The object record containing `.mesh` or direct THREE.Mesh.
   * @param {number} [durationMs=300] Highlight duration in milliseconds.
   * @param {number} [colorHex=0x00f3ff] Highlight emissive color (default cyan).
   */
  highlight(targetObject, durationMs = 300, colorHex = 0x00f3ff) {
    if (this.disposed || !targetObject) return;

    const mesh = targetObject.mesh || (targetObject.isMesh ? targetObject : null);
    if (!mesh || !mesh.material) return;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    
    // If already highlighted, refresh timer
    if (this.activeHighlights.has(mesh)) {
      const entry = this.activeHighlights.get(mesh);
      if (entry) entry.duration = durationMs / 1000;
      return;
    }

    // Save original material state
    const firstMat = materials[0];
    const originalEmissive = firstMat.emissive ? firstMat.emissive.clone() : new THREE.Color(0x000000);
    const originalEmissiveIntensity = firstMat.emissiveIntensity !== undefined ? firstMat.emissiveIntensity : 0;

    // Apply flash emissive color
    for (const mat of materials) {
      if ('emissive' in mat) {
        mat.emissive.setHex(colorHex);
        mat.emissiveIntensity = 2.0;
      }
    }

    this.activeHighlights.set(mesh, {
      originalEmissive,
      originalEmissiveIntensity,
      duration: durationMs / 1000,
      mesh,
    });
  }

  /**
   * @param {number} delta Frame delta in seconds.
   */
  update(delta) {
    if (this.disposed || this.activeHighlights.size === 0) return;

    for (const [mesh, data] of this.activeHighlights.entries()) {
      data.duration -= delta;

      if (data.duration <= 0) {
        this._restoreMesh(mesh, data);
        this.activeHighlights.delete(mesh);
      }
    }
  }

  /**
   * @private
   */
  _restoreMesh(mesh, data) {
    if (!mesh || !mesh.material) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    for (const mat of materials) {
      if ('emissive' in mat) {
        mat.emissive.copy(data.originalEmissive);
        mat.emissiveIntensity = data.originalEmissiveIntensity;
      }
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;

    for (const [mesh, data] of this.activeHighlights.entries()) {
      this._restoreMesh(mesh, data);
    }
    this.activeHighlights.clear();
  }
}
