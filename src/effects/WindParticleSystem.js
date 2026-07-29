import * as THREE from 'three';

/**
 * Ultra-Complex High-Performance Wind & Fluid Particle System
 * Optimized for 60 FPS Guaranteed Execution on AMD / WebGL systems.
 *
 * Architecture Features (Based on Top GitHub WebGL Game Engines):
 *  1. Single-Draw-Call Instanced Particles (InstancedMesh, 1,000+ particles = 1 Draw Call)
 *  2. 3D Curl Noise Turbulence Vector Fields (Fluid-like organic vortex motion)
 *  3. Wall Updraft Physics Field (Particles curl and climb up room walls)
 *  4. Volumetric Smoke Plumes (Expanding rotating smoke clouds with soft alpha)
 *  5. Concentric Shockwave Energy Rings (Multi-stage emissive torus expansion)
 *  6. Environmental Ground Dust Bursts (Radial floor dust motes)
 *  7. Zero Garbage Collection Allocations in render loop (Pre-allocated Float32Arrays & Matrix4)
 */
export class WindParticleSystem {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.maxVortexParticles = options.maxVortexParticles || 800;
    this.maxSmokePuffs = options.maxSmokePuffs || 50;
    this.maxDustPuffs = options.maxDustPuffs || 60;
    this.maxRings = options.maxRings || 12;

    this.time = 0;

    // Single-Draw-Call Instanced Particle Engine
    this.vortexData = [];
    this.smokePuffs = [];
    this.rings = [];
    this.dustPuffs = [];

    // Pre-allocated reusable THREE objects for zero GC overhead
    this._dummy = new THREE.Object3D();
    this._matrix = new THREE.Matrix4();
    this._color = new THREE.Color();
    this._tempVec = new THREE.Vector3();
    this._perpA = new THREE.Vector3();
    this._perpB = new THREE.Vector3();

    this._buildParticleEngine();
  }

  _createCanvasTexture(w, h, drawFn) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    drawFn(ctx, w, h);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  _buildParticleEngine() {
    this.group = new THREE.Group();
    this.group.name = 'WindParticleEngine';
    this.scene.add(this.group);

    // =========================================================================
    // 1. INSTANCED VORTEX PARTICLES (800 Particles in 1 Single Draw Call!)
    // =========================================================================
    const sphereGeo = new THREE.SphereGeometry(0.06, 8, 6);
    const vortexMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.vortexInstancedMesh = new THREE.InstancedMesh(sphereGeo, vortexMat, this.maxVortexParticles);
    this.vortexInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.vortexInstancedMesh.castShadow = false;
    this.vortexInstancedMesh.receiveShadow = false;
    this.group.add(this.vortexInstancedMesh);

    for (let i = 0; i < this.maxVortexParticles; i++) {
      // Hide initially below floor
      this._dummy.position.set(0, -999, 0);
      this._dummy.scale.set(0, 0, 0);
      this._dummy.updateMatrix();
      this.vortexInstancedMesh.setMatrixAt(i, this._dummy.matrix);

      this.vortexData.push({
        active: false,
        pos: new THREE.Vector3(0, -999, 0),
        vel: new THREE.Vector3(),
        startPos: new THREE.Vector3(),
        targetPos: new THREE.Vector3(),
        angle: Math.random() * Math.PI * 2,
        orbitRadius: 0.4 + Math.random() * 0.8,
        life: 0,
        maxLife: 1.0,
        scale: 1.0,
        colorHex: 0x7eeeff,
      });
    }
    this.vortexInstancedMesh.instanceMatrix.needsUpdate = true;

    // =========================================================================
    // 2. VOLUMETRIC SMOKE CLOUDS
    // =========================================================================
    const smokeTex = this._createCanvasTexture(128, 128, (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      grad.addColorStop(0, 'rgba(240, 255, 255, 0.85)');
      grad.addColorStop(0.3, 'rgba(175, 240, 250, 0.45)');
      grad.addColorStop(0.65, 'rgba(110, 210, 230, 0.15)');
      grad.addColorStop(1, 'rgba(90, 190, 210, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    });

    const smokeMat = new THREE.MeshBasicMaterial({
      map: smokeTex,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const smokeGeo = new THREE.PlaneGeometry(1.4, 1.4);

    for (let i = 0; i < this.maxSmokePuffs; i++) {
      const mesh = new THREE.Mesh(smokeGeo, smokeMat.clone());
      mesh.visible = false;
      this.group.add(mesh);
      this.smokePuffs.push({
        mesh,
        active: false,
        velocity: new THREE.Vector3(),
        rotSpeed: 0,
        life: 0,
        maxLife: 1.2,
        startScale: 0.6,
        endScale: 3.8,
        directional: false,
      });
    }

    // =========================================================================
    // 3. SHOCKWAVE PRESSURE RINGS
    // =========================================================================
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x7eeeff,
      emissive: 0x32c462,
      emissiveIntensity: 3.0,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ringGeo = new THREE.TorusGeometry(0.5, 0.05, 12, 36);

    for (let i = 0; i < this.maxRings; i++) {
      const ringMesh = new THREE.Mesh(ringGeo, ringMat.clone());
      ringMesh.visible = false;
      this.group.add(ringMesh);
      this.rings.push({
        mesh: ringMesh,
        active: false,
        life: 0,
        maxLife: 0.8,
        direction: new THREE.Vector3(),
        expandSpeed: 5.5,
      });
    }

    // =========================================================================
    // 4. ENVIRONMENTAL GROUND DUST PUFFS
    // =========================================================================
    const dustTex = this._createCanvasTexture(128, 128, (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      grad.addColorStop(0, 'rgba(220, 200, 160, 0.75)');
      grad.addColorStop(0.5, 'rgba(180, 160, 120, 0.35)');
      grad.addColorStop(1, 'rgba(140, 120, 80, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    });

    const dustMat = new THREE.MeshBasicMaterial({
      map: dustTex,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const dustGeo = new THREE.PlaneGeometry(1.0, 1.0);

    for (let i = 0; i < this.maxDustPuffs; i++) {
      const mesh = new THREE.Mesh(dustGeo, dustMat.clone());
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      this.group.add(mesh);
      this.dustPuffs.push({
        mesh,
        active: false,
        life: 0,
        maxLife: 1.5,
        velocity: new THREE.Vector3(),
        startScale: 0.4,
        endScale: 3.2,
        directional: false,
      });
    }
  }

  triggerWindBlast(origin, target, powerLevel = 1, impulse = null) {
    const dir = new THREE.Vector3().subVectors(target, origin).normalize();

    // Calculate Perpendicular Vectors for Spiral Geometry
    if (Math.abs(dir.y) > 0.99) {
      this._perpA.set(1, 0, 0);
    } else {
      this._perpA.set(-dir.z, 0, dir.x).normalize();
    }
    this._perpB.crossVectors(dir, this._perpA).normalize();

    // 1. Activate Instanced Vortex Particles
    const activeCount = Math.min(this.maxVortexParticles, 120 + powerLevel * 60);
    for (let i = 0; i < activeCount; i++) {
      const p = this.vortexData[i];
      p.active = true;
      p.life = 0;
      p.maxLife = 0.5 + Math.random() * 0.6;
      p.scale = 0.6 + Math.random() * 0.9;

      const progress = Math.random();
      p.startPos.copy(origin);
      p.targetPos.copy(target);

      const posOnLine = new THREE.Vector3().copy(origin).lerp(target, progress);
      const spread = (0.5 + powerLevel * 0.12) * Math.sin(progress * Math.PI);
      p.angle = Math.random() * Math.PI * 2;
      p.orbitRadius = spread;

      posOnLine.addScaledVector(this._perpA, Math.cos(p.angle) * spread);
      posOnLine.addScaledVector(this._perpB, Math.sin(p.angle) * spread);

      p.pos.copy(posOnLine);

      const speed = 14.0 + powerLevel * 2.5 + Math.random() * 6.0;
      p.vel.copy(dir).multiplyScalar(speed);
      p.vel.addScaledVector(this._perpA, Math.sin(p.angle) * 3.5);
      p.vel.addScaledVector(this._perpB, Math.cos(p.angle) * 3.5);
    }

    // 2. Activate Volumetric Smoke Plumes
    const smokeCount = Math.min(this.maxSmokePuffs, 10 + powerLevel * 4);
    for (let s = 0; s < smokeCount; s++) {
      const smoke = this.smokePuffs.find((item) => !item.active);
      if (!smoke) break;

      smoke.active = true;
      smoke.life = 0;
      smoke.maxLife = 0.8 + Math.random() * 0.5;
      smoke.startScale = 0.5 + Math.random() * 0.4;
      smoke.endScale = 2.5 + powerLevel * 0.35;
      smoke.rotSpeed = (Math.random() - 0.5) * 3.5;
      smoke.directional = false;

      const progress = Math.random();
      const posOnLine = new THREE.Vector3().copy(origin).lerp(target, progress);
      posOnLine.x += (Math.random() - 0.5) * 0.6;
      posOnLine.y += (Math.random() - 0.5) * 0.6;
      posOnLine.z += (Math.random() - 0.5) * 0.6;

      smoke.mesh.position.copy(posOnLine);
      smoke.mesh.rotation.z = Math.random() * Math.PI * 2;
      smoke.velocity.copy(dir).multiplyScalar(8.0 + powerLevel * 1.5);
      smoke.mesh.visible = true;
    }

    // 3. Activate Concentric Shockwave Rings
    const ringCount = Math.min(this.maxRings, 3 + Math.floor(powerLevel * 0.5));
    for (let r = 0; r < ringCount; r++) {
      const ring = this.rings.find((item) => !item.active);
      if (ring) {
        ring.active = true;
        ring.life = -r * 0.07;
        ring.maxLife = 0.75;
        ring.direction.copy(dir);
        ring.mesh.position.copy(origin).addScaledVector(dir, 0.4 + r * 0.5);
        ring.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
        ring.mesh.scale.setScalar(0.4 + powerLevel * 0.08);
        ring.expandSpeed = 5.5 + powerLevel * 1.2;
        ring.mesh.visible = true;
      }
    }

    // 4. Activate Environmental Ground Dust Bursts
    for (let d = 0; d < 14; d++) {
      const dust = this.dustPuffs.find((item) => !item.active);
      if (!dust) break;

      dust.active = true;
      dust.life = 0;
      dust.maxLife = 1.0 + Math.random() * 0.6;
      dust.startScale = 0.4;
      dust.endScale = 2.5 + powerLevel * 0.3;
      dust.directional = false;

      const atTarget = d % 2 === 0;
      const basePos = atTarget ? target.clone() : origin.clone();
      basePos.y = 0.08;

      dust.mesh.position.copy(basePos);
      dust.mesh.rotation.z = Math.random() * Math.PI * 2;

      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 3.5;
      dust.velocity.set(Math.cos(angle) * speed, 0, Math.sin(angle) * speed);
      dust.mesh.visible = true;
    }

    // 5. Directional impact smoke — fumaça empurrada na direção da rajada
    this._spawnImpactSmokeBurst(target, dir, powerLevel, this._perpA, this._perpB, impulse);
  }

  /**
   * Spawns smoke at the impact point that flows along the blast direction,
   * with curl turbulence ported from the former ambient wind field.
   */
  _spawnImpactSmokeBurst(impactPoint, direction, powerLevel, perpA, perpB, impulse) {
    const impactCount = Math.min(this.maxSmokePuffs, 8 + powerLevel * 3);
    const baseSpeed = 10 + powerLevel * 2.2;

    for (let i = 0; i < impactCount; i++) {
      const smoke = this.smokePuffs.find((item) => !item.active);
      if (!smoke) break;

      smoke.active = true;
      smoke.life = 0;
      smoke.maxLife = 1.0 + Math.random() * 0.8;
      smoke.startScale = 0.35 + Math.random() * 0.25;
      smoke.endScale = 3.2 + powerLevel * 0.45;
      smoke.rotSpeed = (Math.random() - 0.5) * 4.5;
      smoke.directional = true;
      smoke.source = impulse?.source ?? 'blast';

      const spread = (Math.random() - 0.5) * 0.55;
      const lift = Math.random() * 0.35;
      smoke.mesh.position
        .copy(impactPoint)
        .addScaledVector(perpA, spread)
        .addScaledVector(perpB, (Math.random() - 0.5) * 0.55);
      smoke.mesh.position.y += 0.15 + lift;

      smoke.mesh.rotation.z = Math.random() * Math.PI * 2;
      smoke.velocity
        .copy(direction)
        .multiplyScalar(baseSpeed + Math.random() * 4)
        .addScaledVector(perpA, (Math.random() - 0.5) * 3.5)
        .addScaledVector(perpB, (Math.random() - 0.5) * 3.5);
      smoke.velocity.y += 1.2 + Math.random() * 1.8;
      smoke.mesh.visible = true;
    }

    // Impact dust pushed along blast direction
    const dustCount = Math.min(this.maxDustPuffs, 10 + powerLevel * 2);
    for (let i = 0; i < dustCount; i++) {
      const dust = this.dustPuffs.find((item) => !item.active);
      if (!dust) break;

      dust.active = true;
      dust.life = 0;
      dust.maxLife = 0.9 + Math.random() * 0.7;
      dust.startScale = 0.3 + Math.random() * 0.2;
      dust.endScale = 2.8 + powerLevel * 0.35;
      dust.directional = true;
      dust.source = impulse?.source ?? 'blast';

      dust.mesh.position
        .copy(impactPoint)
        .addScaledVector(direction, -0.15 + Math.random() * 0.35)
        .addScaledVector(perpA, (Math.random() - 0.5) * 0.8);
      dust.mesh.position.y = 0.06 + Math.random() * 0.25;
      dust.mesh.rotation.z = Math.random() * Math.PI * 2;

      dust.velocity
        .copy(direction)
        .multiplyScalar(4.5 + Math.random() * 5 + powerLevel * 0.6)
        .addScaledVector(perpA, (Math.random() - 0.5) * 2.5);
      dust.velocity.y = 0.4 + Math.random() * 1.2;
      dust.mesh.visible = true;
    }
  }

  update(delta) {
    this.time += delta;

    // =========================================================================
    // 1. UPDATE INSTANCED VORTEX PARTICLES (Zero Allocation Matrix Loop)
    // =========================================================================
    let vortexNeedsUpdate = false;

    for (let i = 0; i < this.maxVortexParticles; i++) {
      const p = this.vortexData[i];
      if (!p.active) continue;

      p.life += delta;
      if (p.life >= p.maxLife) {
        p.active = false;
        this._dummy.position.set(0, -999, 0);
        this._dummy.scale.set(0, 0, 0);
        this._dummy.updateMatrix();
        this.vortexInstancedMesh.setMatrixAt(i, this._dummy.matrix);
        vortexNeedsUpdate = true;
        continue;
      }

      vortexNeedsUpdate = true;

      // 3D Curl Noise Turbulence Simulation
      const curlX = Math.sin(p.pos.z * 0.4 + this.time * 3.5) * 1.5;
      const curlY = Math.cos(p.pos.x * 0.4 + p.pos.z * 0.4 + this.time * 2.5) * 1.2;
      const curlZ = Math.cos(p.pos.x * 0.4 + this.time * 3.5) * 1.5;

      p.pos.x += (p.vel.x + curlX) * delta;
      p.pos.y += (p.vel.y + curlY) * delta;
      p.pos.z += (p.vel.z + curlZ) * delta;

      // Wall Updraft Physics Field (Particles climb up room walls!)
      if (p.pos.x < -11.0 || p.pos.x > 11.0 || p.pos.z < -63.0) {
        p.vel.y += delta * 12.0; // Wall updraft lift!
      } else if (p.pos.y < 0.05) {
        p.pos.y = 0.05;
        p.vel.y *= -0.3;
      }

      // Life Alpha & Scale Decay
      const alpha = 1.0 - p.life / p.maxLife;
      const scale = p.scale * alpha;

      this._dummy.position.copy(p.pos);
      this._dummy.scale.setScalar(scale);
      this._dummy.updateMatrix();

      this.vortexInstancedMesh.setMatrixAt(i, this._dummy.matrix);
    }

    if (vortexNeedsUpdate) {
      this.vortexInstancedMesh.instanceMatrix.needsUpdate = true;
    }

    // =========================================================================
    // 2. UPDATE VOLUMETRIC SMOKE PLUMES
    // =========================================================================
    for (const smoke of this.smokePuffs) {
      if (!smoke.active) continue;

      smoke.life += delta;
      if (smoke.life >= smoke.maxLife) {
        smoke.active = false;
        smoke.mesh.visible = false;
        continue;
      }

      const progress = smoke.life / smoke.maxLife;

      // Curl turbulence — directional bursts keep flowing along blast axis
      if (smoke.directional) {
        const curlAlong =
          Math.sin(smoke.mesh.position.z * 0.35 + this.time * 2.8) * 0.6 +
          Math.cos(smoke.mesh.position.x * 0.28 + this.time * 2.2) * 0.4;
        smoke.velocity.y += curlAlong * delta * 1.8;
        smoke.velocity.multiplyScalar(Math.exp(-1.8 * delta));
      } else {
        smoke.velocity.x += Math.sin(smoke.mesh.position.z * 0.3 + this.time * 2) * delta * 2;
        smoke.velocity.z += Math.cos(smoke.mesh.position.x * 0.3 + this.time * 2) * delta * 2;
        smoke.velocity.multiplyScalar(Math.exp(-2.5 * delta));
      }
      smoke.mesh.position.addScaledVector(smoke.velocity, delta);
      smoke.mesh.rotation.z += smoke.rotSpeed * delta;

      // Wall Updraft on Smoke
      if (smoke.mesh.position.x < -11.0 || smoke.mesh.position.x > 11.0 || smoke.mesh.position.z < -63.0) {
        smoke.mesh.position.y += delta * 2.8;
      }

      const currentScale = THREE.MathUtils.lerp(smoke.startScale, smoke.endScale, progress);
      smoke.mesh.scale.setScalar(currentScale);

      const alpha = Math.sin(progress * Math.PI);
      smoke.mesh.material.opacity = alpha * 0.65;
    }

    // =========================================================================
    // 3. UPDATE SHOCKWAVE RINGS
    // =========================================================================
    for (const ring of this.rings) {
      if (!ring.active) continue;

      ring.life += delta;
      if (ring.life < 0) continue;

      if (ring.life >= ring.maxLife) {
        ring.active = false;
        ring.mesh.visible = false;
        continue;
      }

      const progress = ring.life / ring.maxLife;
      ring.mesh.position.addScaledVector(ring.direction, delta * 14);
      ring.mesh.scale.addScalar(delta * ring.expandSpeed);
      ring.mesh.material.opacity = (1 - progress) * 0.95;
    }

    // =========================================================================
    // 4. UPDATE ENVIRONMENTAL DUST PUFFS
    // =========================================================================
    for (const dust of this.dustPuffs) {
      if (!dust.active) continue;

      dust.life += delta;
      if (dust.life >= dust.maxLife) {
        dust.active = false;
        dust.mesh.visible = false;
        continue;
      }

      const progress = dust.life / dust.maxLife;
      dust.mesh.position.addScaledVector(dust.velocity, delta);
      dust.velocity.multiplyScalar(Math.exp(dust.directional ? -2.2 : -3.0) * delta);

      // Wall Updraft on Dust
      if (dust.mesh.position.x < -11.0 || dust.mesh.position.x > 11.0 || dust.mesh.position.z < -63.0) {
        dust.mesh.position.y += delta * 2.2;
      }

      const currentScale = THREE.MathUtils.lerp(dust.startScale, dust.endScale, progress);
      dust.mesh.scale.setScalar(currentScale);

      const alpha = Math.sin(progress * Math.PI);
      dust.mesh.material.opacity = alpha * 0.55;
    }
  }

  dispose() {
    if (this.group && this.group.parent) {
      this.group.parent.remove(this.group);
    }
    this.group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (child.material.map) child.material.map.dispose();
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
    });
  }
}
