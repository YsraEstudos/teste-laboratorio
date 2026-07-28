import * as THREE from 'three';

const CELL_SIZE = 5;

/**
 * GPU-instanced dust motes. Particles are pulled by the local wind vector and
 * scatter when they strike the laboratory's static Box3 colliders.
 */
export class WindDustSystem {
  constructor(scene, colliders, windField, options = {}) {
    this.windField = windField;
    this.count = options.count ?? 680;
    this.colliders = colliders;
    this.particles = [];
    this.grid = new Map();
    this.time = 0;
    this._dummy = new THREE.Object3D();
    this._wind = new THREE.Vector3();
    this._normal = new THREE.Vector3();
    this._scatter = new THREE.Vector3();
    this._billboardQuaternion = new THREE.Quaternion();
    this._hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

    this._buildColliderGrid();
    this._buildMesh(scene);
  }

  _buildMesh(scene) {
    const texture = this._createDustTexture();
    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
      vertexColors: true
    });

    this.mesh = new THREE.InstancedMesh(geometry, material, this.count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.name = 'AmbientWindDust';
    scene.add(this.mesh);

    const sand = new THREE.Color(0xcbb88e);
    const ash = new THREE.Color(0x8f9aa0);
    for (let i = 0; i < this.count; i++) {
      const particle = {
        position: new THREE.Vector3(),
        previous: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        age: Math.random() * 8,
        maxAge: 5 + Math.random() * 6,
        size: 0.05 + Math.random() * 0.13,
        phase: Math.random() * Math.PI * 2,
        collisions: 0,
        active: false
      };
      this.particles.push(particle);
      this.mesh.setMatrixAt(i, this._hiddenMatrix);
      this.mesh.setColorAt(i, sand.clone().lerp(ash, Math.random() * 0.4));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(delta, camera) {
    this.time += delta;
    const cameraPosition = camera.position;
    this._billboardQuaternion.copy(camera.quaternion);
    let needsUpdate = false;

    for (let i = 0; i < this.count; i++) {
      const p = this.particles[i];
      if (!p.active) this._resetParticle(p, cameraPosition, i < 160);

      p.age += delta;
      if (p.age >= p.maxAge || p.position.distanceToSquared(cameraPosition) > 34 * 34) {
        this._resetParticle(p, cameraPosition, this.windField.gustIntensity > 0.22);
      }

      p.previous.copy(p.position);
      this.windField.sample(p.position, this._wind);

      // Fine dust responds quickly, but retains enough inertia to visibly arc.
      const response = 1 - Math.exp(-delta * (3.2 + this.windField.gustIntensity * 5));
      p.velocity.x += (this._wind.x - p.velocity.x) * response;
      p.velocity.z += (this._wind.z - p.velocity.z) * response;
      p.velocity.y += (this._wind.y - p.velocity.y) * response;
      p.velocity.y -= delta * 0.17;
      p.velocity.y += Math.sin(this.time * 3.7 + p.phase) * delta * 0.12;

      p.position.addScaledVector(p.velocity, delta);
      this._resolveColliderCollision(p);

      if (p.position.y < 0.035) {
        p.position.y = 0.035;
        if (this._wind.lengthSq() > 2.4) p.velocity.y = 0.25 + Math.random() * 0.35;
        else p.velocity.y *= -0.18;
        p.velocity.x *= 0.74;
        p.velocity.z *= 0.74;
      }

      const life = p.age / p.maxAge;
      const fade = Math.min(life * 7, (1 - life) * 5, 1);
      const scale = p.size * fade * (0.75 + this.windField.gustIntensity * 0.55);
      this._dummy.position.copy(p.position);
      this._dummy.quaternion.copy(this._billboardQuaternion);
      this._dummy.scale.setScalar(scale);
      this._dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this._dummy.matrix);
      needsUpdate = true;
    }

    if (needsUpdate) this.mesh.instanceMatrix.needsUpdate = true;
  }

  _resetParticle(p, center, lifted) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 2 + Math.sqrt(Math.random()) * 18;
    p.position.set(
      center.x + Math.cos(angle) * radius,
      lifted ? 0.04 + Math.random() * 1.8 : 0.04 + Math.random() * 0.42,
      center.z + Math.sin(angle) * radius
    );
    p.previous.copy(p.position);
    p.velocity.set((Math.random() - 0.5) * 0.25, Math.random() * 0.1, (Math.random() - 0.5) * 0.25);
    p.age = 0;
    p.maxAge = 4.5 + Math.random() * 6;
    p.collisions = 0;
    p.active = true;
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

    if (right < distance) { distance = right; this._normal.set(1, 0, 0); }
    if (bottom < distance) { distance = bottom; this._normal.set(0, -1, 0); }
    if (top < distance) { distance = top; this._normal.set(0, 1, 0); }
    if (near < distance) { distance = near; this._normal.set(0, 0, -1); }
    if (far < distance) this._normal.set(0, 0, 1);

    p.position.copy(p.previous).addScaledVector(this._normal, 0.035);
    const normalSpeed = p.velocity.dot(this._normal);
    if (normalSpeed < 0) p.velocity.addScaledVector(this._normal, -normalSpeed * 1.55);
    this._scatter.set((Math.random() - 0.5) * 1.35, Math.random() * 0.85, (Math.random() - 0.5) * 1.35);
    this._scatter.addScaledVector(this._normal, 0.45 + Math.random() * 0.65);
    p.velocity.addScaledVector(this._scatter, 0.62).multiplyScalar(0.62);
    p.collisions += 1;
    if (p.collisions > 3) p.maxAge = Math.min(p.maxAge, p.age + 0.65);
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
    return x * 73856093 ^ z * 19349663;
  }

  _createDustTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 244, 214, 0.92)');
    gradient.addColorStop(0.38, 'rgba(224, 200, 152, 0.55)');
    gradient.addColorStop(1, 'rgba(156, 138, 104, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  dispose() {
    this.mesh.parent?.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.map.dispose();
    this.mesh.material.dispose();
    this.grid.clear();
  }
}
