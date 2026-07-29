// @ts-check
import * as THREE from 'three';

/**
 * GroundDustSystem - Manages realistic ground dust sitting on the floor of the test room,
 * and lifting dynamically with wall/object collision physics when wind blasts are fired.
 */
export class GroundDustSystem {
  /**
   * @param {THREE.Scene} scene
   * @param {import('./VFXManager.js').VFXManager} vfxManager
   */
  constructor(scene, vfxManager) {
    this.scene = scene;
    this.vfxManager = vfxManager;
    this.disposed = false;

    // Ground Dust Layer Motes
    const count = 120;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const opacities = new Float32Array(count);

    // Spread dust across testing room floor (x: -8 to 8, z: -62 to -48)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 16.0;
      positions[i * 3 + 1] = 0.04 + Math.random() * 0.05; // Resting on floor
      positions[i * 3 + 2] = -55.0 + (Math.random() - 0.5) * 14.0;

      velocities[i * 3] = 0;
      velocities[i * 3 + 1] = 0;
      velocities[i * 3 + 2] = 0;

      opacities[i] = 0.3 + Math.random() * 0.4;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xcccccc,
      size: 0.15,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });

    this.dustMesh = new THREE.Points(geometry, material);
    this.velocities = velocities;
    this.initialPositions = new Float32Array(positions);

    if (this.scene) {
      this.scene.add(this.dustMesh);
    }
  }

  /**
   * Called when a Wind Blast is released to lift ground dust into a 3D swirling cloud.
   * 
   * @param {THREE.Vector3} origin Blast origin
   * @param {THREE.Vector3} direction Blast direction
   * @param {number} power Blast power
   */
  triggerDustBlast(origin, direction, power) {
    if (this.disposed || !this.dustMesh) return;

    const positions = this.dustMesh.geometry.attributes.position.array;
    const v = this.velocities;

    for (let i = 0; i < positions.length / 3; i++) {
      const px = positions[i * 3];
      const pz = positions[i * 3 + 2];

      const distSq = (px - origin.x) ** 2 + (pz - origin.z) ** 2;

      // If dust is within wind blast range (~12m)
      if (distSq < 144) {
        const dist = Math.sqrt(distSq);
        const impulseStrength = Math.max(0, 1 - dist / 12) * (3.5 + power * 0.8);

        // Lift upward and push in blast direction
        v[i * 3] += direction.x * impulseStrength + (Math.random() - 0.5) * 1.5;
        v[i * 3 + 1] += impulseStrength * 0.75 + Math.random() * 1.2; // Lift from floor!
        v[i * 3 + 2] += direction.z * impulseStrength + (Math.random() - 0.5) * 1.5;
      }
    }
  }

  /**
   * Physics update for dust particle movement and wall/floor collision.
   * @param {number} delta
   */
  update(delta) {
    if (this.disposed || !this.dustMesh) return;

    const positions = this.dustMesh.geometry.attributes.position.array;
    const v = this.velocities;
    let needsUpdate = false;

    for (let i = 0; i < positions.length / 3; i++) {
      if (Math.abs(v[i * 3]) > 0.001 || Math.abs(v[i * 3 + 1]) > 0.001 || Math.abs(v[i * 3 + 2]) > 0.001) {
        needsUpdate = true;

        // Apply velocity
        positions[i * 3] += v[i * 3] * delta;
        positions[i * 3 + 1] += v[i * 3 + 1] * delta;
        positions[i * 3 + 2] += v[i * 3 + 2] * delta;

        // Gravity pull back to floor
        v[i * 3 + 1] -= delta * 4.5;

        // Wall collision bounds (Room bounds x: -11.2 to 11.2, z: -63.2 to -46.5)
        if (positions[i * 3] < -11.0) {
          positions[i * 3] = -11.0;
          v[i * 3] *= -0.5; // Bounce off left wall
        } else if (positions[i * 3] > 11.0) {
          positions[i * 3] = 11.0;
          v[i * 3] *= -0.5; // Bounce off right wall
        }

        if (positions[i * 3 + 2] < -63.0) {
          positions[i * 3 + 2] = -63.0;
          v[i * 3 + 2] *= -0.5; // Bounce off back wall
        } else if (positions[i * 3 + 2] > -46.8) {
          positions[i * 3 + 2] = -46.8;
          v[i * 3 + 2] *= -0.5; // Bounce off front wall
        }

        // Floor collision (rest at Y = 0.04)
        if (positions[i * 3 + 1] < 0.04) {
          positions[i * 3 + 1] = 0.04;
          v[i * 3 + 1] = 0;
          v[i * 3] *= 0.85; // Floor friction
          v[i * 3 + 2] *= 0.85;
        }

        // Air drag
        v[i * 3] *= Math.exp(-2.5 * delta);
        v[i * 3 + 2] *= Math.exp(-2.5 * delta);
      }
    }

    if (needsUpdate) {
      this.dustMesh.geometry.attributes.position.needsUpdate = true;
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;

    if (this.dustMesh) {
      if (this.dustMesh.parent) this.dustMesh.parent.remove(this.dustMesh);
      this.dustMesh.geometry.dispose();
      if (Array.isArray(this.dustMesh.material)) {
        this.dustMesh.material.forEach((m) => m.dispose());
      } else {
        this.dustMesh.material.dispose();
      }
    }
  }
}
