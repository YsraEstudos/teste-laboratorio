import * as THREE from 'three';

const CELL_SIZE = 5;

export class DustWindCollisionBehavior {
  constructor(windField, colliders, grid) {
    this.type = 'DustWindCollisionBehavior';
    this.windField = windField;
    this.colliders = colliders;
    this.grid = grid;
    this.time = 0;
    this._wind = new THREE.Vector3();
    this._normal = new THREE.Vector3();
    this._scatter = new THREE.Vector3();
  }

  initialize(particle) {
    particle.collisions = 0;
    particle.maxAge = 4.5 + Math.random() * 6;
  }

  update(particle, delta) {
    this.windField.sample(particle.position, this._wind);

    const response = 1 - Math.exp(-delta * (3.2 + this.windField.gustIntensity * 5));
    particle.velocity.x += (this._wind.x - particle.velocity.x) * response;
    particle.velocity.z += (this._wind.z - particle.velocity.z) * response;
    particle.velocity.y += (this._wind.y - particle.velocity.y) * response;
    particle.velocity.y -= delta * 0.17;
    particle.velocity.y += Math.sin(this.time * 3.7 + particle.age * 2) * delta * 0.12;

    this._resolveColliderCollision(particle);

    if (particle.position.y < 0.035) {
      particle.position.y = 0.035;
      if (this._wind.lengthSq() > 2.4) particle.velocity.y = 0.25 + Math.random() * 0.35;
      else particle.velocity.y *= -0.18;
      particle.velocity.x *= 0.74;
      particle.velocity.z *= 0.74;
    }
  }

  frameUpdate(delta) {
    this.time += delta;
  }

  clone() {
    return new DustWindCollisionBehavior(this.windField, this.colliders, this.grid);
  }

  reset() {}

  toJSON() {
    return { type: this.type };
  }

  _resolveColliderCollision(p) {
    const ix = Math.floor(p.position.x / CELL_SIZE);
    const iz = Math.floor(p.position.z / CELL_SIZE);

    for (let x = ix - 1; x <= ix + 1; x++) {
      for (let z = iz - 1; z <= iz + 1; z++) {
        const candidates = this.grid.get(this._gridKey(x, z));
        if (!candidates) continue;
        for (const box of candidates) {
          if (!box.containsPoint(p.position)) continue;
          this._scatterFromBox(p, box);
          return;
        }
      }
    }
  }

  _scatterFromBox(p, box) {
    const left = Math.abs(p.position.x - box.min.x);
    const right = Math.abs(box.max.x - p.position.x);
    const bottom = Math.abs(p.position.y - box.min.y);
    const top = Math.abs(box.max.y - p.position.y);
    const near = Math.abs(p.position.z - box.min.z);
    const far = Math.abs(box.max.z - p.position.z);
    let distance = left;
    this._normal.set(-1, 0, 0);

    if (right < distance) {
      distance = right;
      this._normal.set(1, 0, 0);
    }
    if (bottom < distance) {
      distance = bottom;
      this._normal.set(0, -1, 0);
    }
    if (top < distance) {
      distance = top;
      this._normal.set(0, 1, 0);
    }
    if (near < distance) {
      distance = near;
      this._normal.set(0, 0, -1);
    }
    if (far < distance) this._normal.set(0, 0, 1);

    p.position.addScaledVector(this._normal, 0.035);
    const normalSpeed = p.velocity.dot(this._normal);
    if (normalSpeed < 0) p.velocity.addScaledVector(this._normal, -normalSpeed * 1.55);

    this._scatter.set((Math.random() - 0.5) * 1.35, Math.random() * 0.85, (Math.random() - 0.5) * 1.35);
    this._scatter.addScaledVector(this._normal, 0.45 + Math.random() * 0.65);
    p.velocity.addScaledVector(this._scatter, 0.62).multiplyScalar(0.62);

    p.collisions = (p.collisions || 0) + 1;
    if (p.collisions > 3) p.life = Math.min(p.life, p.age + 0.65);
  }

  _gridKey(x, z) {
    return (x * 73856093) ^ (z * 19349663);
  }
}

/**
 * GPU-instanced dust motes. Particles are pulled by the local wind vector and
 * scatter when they strike the laboratory's static Box3 colliders.
 */
export class WindDustSystem {
  constructor(scene, colliders, windField, vfxManager) {
    this.windField = windField;
    this.colliders = colliders;
    this.vfxManager = vfxManager;
    this.grid = new Map();
    this.effect = null;

    this._buildColliderGrid();
    this._initEffect();
  }

  async _initEffect() {
    // AmbientDust preset loading is intentionally disabled.
    // Ground dust is handled by GroundDustSystem (InstancedMesh).
    // WindDustSystem is reserved for future three.quarks-editor integration.
  }

  update(delta, camera) {
    if (this.effect) {
      this.effect.position.copy(camera.position);
    }
  }

  _buildColliderGrid() {
    for (const box of this.colliders) {
      const minX = Math.floor(box.min.x / CELL_SIZE);
      const maxX = Math.floor(box.max.x / CELL_SIZE);
      const minZ = Math.floor(box.min.z / CELL_SIZE);
      const maxZ = Math.floor(box.max.z / CELL_SIZE);
      for (let x = minX; x <= maxX; x++) {
        for (let z = minZ; z <= maxZ; z++) {
          const key = this._gridKey(x, z);
          let cell = this.grid.get(key);
          if (!cell) {
            cell = [];
            this.grid.set(key, cell);
          }
          cell.push(box);
        }
      }
    }
  }

  _gridKey(x, z) {
    return (x * 73856093) ^ (z * 19349663);
  }

  dispose() {
    this.grid.clear();
    if (this.vfxManager && this.effect) {
      this.vfxManager.releaseEffect(this.effect);
      this.effect = null;
    }
  }
}
