import * as THREE from 'three';

/**
 * WindChild - 3D Character and Procedural Animation System
 *
 * Features:
 * - Child-proportioned stylized 3D model (large head ratio, compact limbs)
 * - "Confirmed 42" custom canvas-textured badge
 * - Floating procedural wind aura with light, dynamic ribbons, and particle motes
 * - Procedural Animations:
 *   - Idle breathing and floating posture affected by happiness and energy
 *   - Autonomous looking around with smooth head tracking
 *   - Hand-trembling wind charge gesture (hands forward with high-frequency tremor)
 *   - Wind blast release gesture with explosive shockwave particles
 * - Dynamic Properties:
 *   - powerLevel (1 - 10)
 *   - happiness (0 - 100%)
 *   - energy (0 - 100%)
 */
export class WindChild {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.name = 'Wind Child';

    // Core attributes with boundary safety
    this._powerLevel = Math.max(1, Math.min(10, options.powerLevel ?? 5));
    this._happiness = Math.max(0, Math.min(100, options.happiness ?? 80));
    this._energy = Math.max(0, Math.min(100, options.energy ?? 90));

    // Internal animation state
    this.time = 0;
    this.isCharging = false;
    this.isBlasting = false;
    this.blastTimer = 0;
    this.blastDuration = 0.75;
    this.chargeWeight = 0; // Smooth transition weight (0 to 1)

    // Head looking around logic
    this.headLookTarget = new THREE.Euler(0, 0, 0);
    this.headCurrentRotation = new THREE.Euler(0, 0, 0);
    this.lookAroundTimer = 0;
    this.nextLookTime = 2.0 + Math.random() * 3.0;

    // Tremble offsets for charging gesture
    this.leftHandTremble = new THREE.Vector3();
    this.rightHandTremble = new THREE.Vector3();

    // Position & Movement Pathfinding
    this.position = new THREE.Vector3(0, 0, -54);
    this.velocity = new THREE.Vector3();
    this.path = [];
    this.pathIndex = 0;
    this.navigation = null;
    this.navigationDynamicColliders = [];
    this.navigationDestination = null;
    this.walkSpeed = 4.2;
    this.navigationRadius = 0.38;
    this.navigationState = 'idle';
    this.navigationReason = null;
    this.navigationBlockedTime = 0;
    this.navigationBlockTimeout = 0.5;
    this.navigationMaxSubstep = 0.18;
    this._navigationDirection = new THREE.Vector3();
    this._navigationStart = new THREE.Vector3();
    this._navigationAABB = new THREE.Box3();

    // Scene Graph Root
    this.model = new THREE.Group();
    this.model.name = 'WindChild';
    this.model.userData.interactiveType = 'wind-child';
    this.model.userData.isWindChild = true;
    this.model.position.copy(this.position);

    // Build sub-components
    this._buildCharacterModel();
    this._buildBadge();
    this._buildWindAura();
    this._buildBlastEffects();

    if (this.scene) {
      this.scene.add(this.model);
    }
  }

  /**
   * @param {import('../world/NavigationGrid.js').NavigationGrid} navigation
   * @param {THREE.Box3[]} [dynamicColliders]
   */
  setNavigation(navigation, dynamicColliders = []) {
    this.navigation = navigation;
    this.navigationDynamicColliders = dynamicColliders;
  }

  moveTo(x, z) {
    this.path.length = 0;
    this.pathIndex = 0;
    this.navigationBlockedTime = 0;
    this.navigationDestination = null;

    if (!this.navigation) {
      this.navigationState = 'cancelled';
      this.navigationReason = 'navigation-unavailable';
      return;
    }

    const result = this.navigation.findPath(this.position.x, this.position.z, x, z, {
      dynamicColliders: this.navigationDynamicColliders ?? [],
    });
    if (result.status !== 'complete' || result.waypoints.length === 0) {
      this.navigationState = 'cancelled';
      this.navigationReason = result.reason || 'invalid-path';
      return;
    }

    this.path = result.waypoints.map((waypoint) => waypoint.clone());
    this.navigationDestination = new THREE.Vector3(x, 0, z);
    this.navigationState = 'moving';
    this.navigationReason = null;
  }

  // ==========================================
  // GETTERS AND SETTERS
  // ==========================================
  get powerLevel() {
    return this._powerLevel;
  }

  set powerLevel(val) {
    this._powerLevel = Math.max(1, Math.min(10, val));
    this._updateAuraParameters();
  }

  get happiness() {
    return this._happiness;
  }

  set happiness(val) {
    this._happiness = Math.max(0, Math.min(100, val));
  }

  get energy() {
    return this._energy;
  }

  set energy(val) {
    this._energy = Math.max(0, Math.min(100, val));
  }

  // Convenience methods
  setPowerLevel(level) {
    this.powerLevel = level;
    return this;
  }
  setHappiness(val) {
    this.happiness = val;
    return this;
  }
  setEnergy(val) {
    this.energy = val;
    return this;
  }

  // ==========================================
  // MODEL CONSTRUCTION (Child Proportions)
  // ==========================================
  _buildCharacterModel() {
    // Child Proportions: ~1.15m height, larger head to body ratio (~1:3.8)
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xffdfc4,
      roughness: 0.55,
      metalness: 0.05,
    });

    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x2cd5eb, // Wind-blessed cyan tinted hair
      emissive: 0x0f5566,
      emissiveIntensity: 0.4,
      roughness: 0.4,
    });

    const tunicMat = new THREE.MeshStandardMaterial({
      color: 0x1b3b5a,
      roughness: 0.5,
      metalness: 0.15,
    });

    const scarfMat = new THREE.MeshStandardMaterial({
      color: 0x76f5ff,
      emissive: 0x2bbcd1,
      emissiveIntensity: 0.6,
      roughness: 0.3,
      side: THREE.DoubleSide,
    });

    const pantsMat = new THREE.MeshStandardMaterial({
      color: 0x122033,
      roughness: 0.7,
    });

    const bootMat = new THREE.MeshStandardMaterial({
      color: 0x0a1420,
      roughness: 0.4,
    });

    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x0b253a,
      roughness: 0.1,
    });

    const irisMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00a8ff,
      emissiveIntensity: 1.2,
    });

    // Root offset container (for floating effect)
    this.floatContainer = new THREE.Group();
    this.model.add(this.floatContainer);

    // Ground Shadow
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 24),
      new THREE.MeshBasicMaterial({ color: 0x020810, transparent: true, opacity: 0.4, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.01;
    this.model.add(this.shadow);

    // Pelvis / Hips
    this.pelvis = new THREE.Group();
    this.pelvis.position.y = 0.52;
    this.floatContainer.add(this.pelvis);

    const hipMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.14, 12), tunicMat);
    this.pelvis.add(hipMesh);

    // Torso / Chest
    this.torso = new THREE.Group();
    this.torso.position.y = 0.1;
    this.pelvis.add(this.torso);

    const chestMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.35, 12), tunicMat);
    chestMesh.position.y = 0.175;
    this.torso.add(chestMesh);

    // Wind Scarf / Collar
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.05, 8, 16), scarfMat);
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 0.35;
    this.torso.add(scarf);

    // Dynamic scarf tail flowing behind
    this.scarfTail = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.45, 4, 8), scarfMat);
    this.scarfTail.position.set(0, 0.28, -0.2);
    this.scarfTail.rotation.x = 0.3;
    this.torso.add(this.scarfTail);

    // Head Pivot & Mesh (Child ratio: stylized large head)
    this.headPivot = new THREE.Group();
    this.headPivot.position.y = 0.42;
    this.torso.add(this.headPivot);

    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 20), skinMat);
    this.head.scale.set(1.0, 1.05, 0.98);
    this.head.position.y = 0.22;
    this.headPivot.add(this.head);

    // Cute Eyes
    const createEye = (xSign) => {
      const eyeGroup = new THREE.Group();
      const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), eyeMat);
      sclera.scale.set(0.6, 1.1, 0.5);
      eyeGroup.add(sclera);

      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 12), irisMat);
      iris.position.z = 0.02;
      iris.scale.set(0.7, 0.9, 0.5);
      eyeGroup.add(iris);

      eyeGroup.position.set(xSign * 0.09, 0.03, 0.21);
      return eyeGroup;
    };
    this.head.add(createEye(-1));
    this.head.add(createEye(1));

    // Windswept Hair Spikes
    const hairGroup = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 1.4 - Math.PI * 0.7;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.25, 5), hairMat);
      spike.position.set(Math.sin(angle) * 0.2, 0.18 + Math.cos(angle) * 0.05, Math.cos(angle) * 0.15);
      spike.rotation.z = -angle * 0.6;
      spike.rotation.x = -0.4;
      hairGroup.add(spike);
    }
    // Top tuft
    const topTuft = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 6), hairMat);
    topTuft.position.set(0, 0.28, 0.04);
    topTuft.rotation.x = -0.2;
    hairGroup.add(topTuft);
    this.head.add(hairGroup);

    // Arms (Left & Right)
    this._buildArms(skinMat, tunicMat);

    // Legs (Left & Right)
    this._buildLegs(pantsMat, bootMat);
  }

  _buildArms(skinMat, tunicMat) {
    const gloveMat = new THREE.MeshStandardMaterial({
      color: 0x16364d,
      roughness: 0.4,
    });

    // Left Arm
    this.leftArmPivot = new THREE.Group();
    this.leftArmPivot.position.set(-0.24, 0.32, 0);
    this.torso.add(this.leftArmPivot);

    const leftSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.2, 8), tunicMat);
    leftSleeve.position.y = -0.1;
    this.leftArmPivot.add(leftSleeve);

    this.leftForearmPivot = new THREE.Group();
    this.leftForearmPivot.position.y = -0.2;
    this.leftArmPivot.add(this.leftForearmPivot);

    const leftHandMesh = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), gloveMat);
    leftHandMesh.scale.set(0.8, 1.1, 0.9);
    leftHandMesh.position.y = -0.08;
    this.leftForearmPivot.add(leftHandMesh);
    this.leftHand = leftHandMesh;

    // Right Arm
    this.rightArmPivot = new THREE.Group();
    this.rightArmPivot.position.set(0.24, 0.32, 0);
    this.torso.add(this.rightArmPivot);

    const rightSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.2, 8), tunicMat);
    rightSleeve.position.y = -0.1;
    this.rightArmPivot.add(rightSleeve);

    this.rightForearmPivot = new THREE.Group();
    this.rightForearmPivot.position.y = -0.2;
    this.rightArmPivot.add(this.rightForearmPivot);

    const rightHandMesh = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), gloveMat);
    rightHandMesh.scale.set(0.8, 1.1, 0.9);
    rightHandMesh.position.y = -0.08;
    this.rightForearmPivot.add(rightHandMesh);
    this.rightHand = rightHandMesh;
  }

  _buildLegs(pantsMat, bootMat) {
    // Left Leg
    this.leftLegPivot = new THREE.Group();
    this.leftLegPivot.position.set(-0.1, -0.05, 0);
    this.pelvis.add(this.leftLegPivot);

    const leftLegMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.26, 8), pantsMat);
    leftLegMesh.position.y = -0.13;
    this.leftLegPivot.add(leftLegMesh);

    const leftBoot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.16), bootMat);
    leftBoot.position.set(0, -0.26, 0.02);
    this.leftLegPivot.add(leftBoot);

    // Right Leg
    this.rightLegPivot = new THREE.Group();
    this.rightLegPivot.position.set(0.1, -0.05, 0);
    this.pelvis.add(this.rightLegPivot);

    const rightLegMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.26, 8), pantsMat);
    rightLegMesh.position.y = -0.13;
    this.rightLegPivot.add(rightLegMesh);

    const rightBoot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.16), bootMat);
    rightBoot.position.set(0, -0.26, 0.02);
    this.rightLegPivot.add(rightBoot);
  }

  // ==========================================
  // BADGE CONSTRUCTION ("Confirmed 42")
  // ==========================================
  _buildBadge() {
    // Render dynamic text onto a 2D HTML Canvas for crisp, high-quality badge texture
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Background Shield / Badge shape
    ctx.fillStyle = '#0f2b3e';
    ctx.beginPath();
    ctx.arc(128, 128, 110, 0, Math.PI * 2);
    ctx.fill();

    // Metallic Gold Border
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#ffd700';
    ctx.stroke();

    // Inner Glow Ring
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#00f0ff';
    ctx.stroke();

    // Text: "CONFIRMED"
    ctx.fillStyle = '#76f5ff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CONFIRMED', 128, 80);

    // Big Bold Text: "42"
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 96px sans-serif';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;
    ctx.fillText('42', 128, 155);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const badgeMat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.3,
      metalness: 0.4,
      transparent: true,
    });

    const badgeMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.15), badgeMat);
    badgeMesh.position.set(-0.09, 0.24, 0.19);
    badgeMesh.rotation.y = -0.2;
    this.torso.add(badgeMesh);
    this.badgeMesh = badgeMesh;
  }

  // ==========================================
  // FLOATING WIND AURA SYSTEM
  // ==========================================
  _buildWindAura() {
    this.auraGroup = new THREE.Group();
    this.floatContainer.add(this.auraGroup);

    // 1. Swirling Wind Ribbon Rings
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x55f3ff,
      transparent: true,
      opacity: 0.5,
      wireframe: true,
      side: THREE.DoubleSide,
    });

    this.windRing1 = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.02, 8, 32), ringMat);
    this.windRing1.rotation.x = Math.PI / 2.3;
    this.windRing1.position.y = 0.45;
    this.auraGroup.add(this.windRing1);

    this.windRing2 = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.015, 8, 32), ringMat);
    this.windRing2.rotation.x = Math.PI / 1.8;
    this.windRing2.rotation.y = 0.4;
    this.windRing2.position.y = 0.6;
    this.auraGroup.add(this.windRing2);

    // 2. Dynamic Point Light attached to wind power
    this.windLight = new THREE.PointLight(0x42f5e3, 1.8, 4.0);
    this.windLight.position.set(0, 0.6, 0);
    this.auraGroup.add(this.windLight);

    // 3. Orbiting Wind Particle Swarm
    const particleCount = 45;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const scales = new Float32Array(particleCount);

    this.particleData = [];

    for (let i = 0; i < particleCount; i++) {
      const radius = 0.35 + Math.random() * 0.45;
      const angle = Math.random() * Math.PI * 2;
      const height = Math.random() * 1.1;
      const speed = 1.0 + Math.random() * 2.0;

      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = height;
      positions[i * 3 + 2] = Math.sin(angle) * radius;

      scales[i] = 0.04 + Math.random() * 0.05;

      this.particleData.push({ radius, angle, height, speed });
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Particle Material
    const particleMat = new THREE.PointsMaterial({
      color: 0xa1fcff,
      size: 0.08,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.particles = new THREE.Points(geometry, particleMat);
    this.auraGroup.add(this.particles);

    this._updateAuraParameters();
  }

  _updateAuraParameters() {
    const pFactor = this._powerLevel / 10;
    if (this.windLight) {
      this.windLight.intensity = 1.0 + pFactor * 2.5;
      this.windLight.distance = 3.0 + pFactor * 3.0;
    }
    if (this.windRing1 && this.windRing2) {
      const s = 1.0 + pFactor * 0.3;
      this.windRing1.scale.set(s, s, s);
      this.windRing2.scale.set(s, s, s);
    }
  }

  // ==========================================
  // WIND BLAST SHOCKWAVE SYSTEM
  // ==========================================
  _buildBlastEffects() {
    this.blastGroup = new THREE.Group();
    this.model.add(this.blastGroup);

    // Shockwave Ring Mesh
    const blastMat = new THREE.MeshBasicMaterial({
      color: 0x88ffff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.blastRing = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.3, 32), blastMat);
    this.blastRing.rotation.x = -Math.PI / 2;
    this.blastRing.position.y = 0.5;
    this.blastGroup.add(this.blastRing);

    // Sphere Burst Mesh
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0xddffff,
      transparent: true,
      opacity: 0,
      wireframe: true,
      depthWrite: false,
    });
    this.blastSphere = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), sphereMat);
    this.blastSphere.position.y = 0.5;
    this.blastGroup.add(this.blastSphere);
  }

  // ==========================================
  // ACTION TRIGGER METHODS
  // ==========================================
  startCharging() {
    this.isCharging = true;
  }

  stopCharging() {
    this.isCharging = false;
  }

  releaseWindBlast() {
    this.isCharging = false;
    this.isBlasting = true;
    this.blastTimer = 0;

    // Reset blast ring & sphere
    this.blastRing.scale.set(1, 1, 1);
    this.blastRing.material.opacity = 0.9;

    this.blastSphere.scale.set(1, 1, 1);
    this.blastSphere.material.opacity = 0.8;
  }

  // ==========================================
  // PROCEDURAL ANIMATION UPDATE LOOP
  // ==========================================
  update(delta, colliders = [], dynamicColliders = this.navigationDynamicColliders ?? []) {
    this.time += delta;

    this._updateNavigation(delta, colliders, dynamicColliders);

    this.model.position.copy(this.position);

    const happinessMult = this._happiness / 100;
    const energyMult = this._energy / 100;
    const animSpeed = 0.6 + energyMult * 0.8;

    // Smoothly update charge weight (transition between idle and charge pose)
    const targetChargeWeight = this.isCharging ? 1.0 : 0.0;
    this.chargeWeight += (targetChargeWeight - this.chargeWeight) * Math.min(1.0, delta * 8.0);

    // 1. Idle Floating & Breathing
    this._updateFloatingAndBreathing(animSpeed, happinessMult, energyMult);

    // 2. Autonomous Looking Around
    this._updateLookingAround(delta);

    // 3. Hand-Trembling Wind Charge Pose ('colocar a mão para frente e tremer')
    this._updateChargePose(animSpeed);

    // 4. Wind Blast Gesture & Shockwave
    this._updateBlastGesture(delta);

    // 5. Update Wind Aura & Particles
    this._updateAuraParticles(delta, animSpeed);
  }

  _ensureNavigationScratch() {
    this.navigationRadius ??= 0.38;
    this.navigationBlockTimeout ??= 0.5;
    this.navigationMaxSubstep ??= 0.18;
    this.navigationBlockedTime ??= 0;
    this._navigationDirection ??= new THREE.Vector3();
    this._navigationStart ??= new THREE.Vector3();
    this._navigationAABB ??= new THREE.Box3();
  }

  _updateNavigation(delta, colliders, dynamicColliders = this.navigationDynamicColliders ?? []) {
    if (!this.path || this.pathIndex >= this.path.length || delta <= 0) return;
    this._ensureNavigationScratch();
    this.navigationDynamicColliders = dynamicColliders;

    let movementBudget = this.walkSpeed * delta;
    let requestedMovement = false;
    let madeProgress = false;

    while (movementBudget > 0.0001 && this.pathIndex < this.path.length) {
      const target = this.path[this.pathIndex];
      const direction = this._navigationDirection.subVectors(target, this.position);
      direction.y = 0;
      const distance = direction.length();

      if (distance <= 0.0001) {
        this.position.x = target.x;
        this.position.z = target.z;
        this.pathIndex += 1;
        continue;
      }

      requestedMovement = true;
      direction.multiplyScalar(1 / distance);
      const moveDistance = Math.min(distance, movementBudget);
      this._navigationStart.copy(this.position);
      this._moveWithCollisions(direction.x * moveDistance, direction.z * moveDistance, colliders);
      const movedDistance = this.position.distanceTo(this._navigationStart);
      madeProgress ||= movedDistance > 0.00001;
      movementBudget -= moveDistance;

      const targetRot = Math.atan2(direction.x, direction.z);
      let diff = targetRot - this.model.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.model.rotation.y += diff * Math.min(1, delta * 12);

      const remainingX = target.x - this.position.x;
      const remainingZ = target.z - this.position.z;
      if (remainingX * remainingX + remainingZ * remainingZ <= 0.0001 * 0.0001) {
        this.position.x = target.x;
        this.position.z = target.z;
        this.pathIndex += 1;
      } else if (movedDistance <= 0.00001) {
        break;
      }
    }

    if (this.pathIndex >= this.path.length) {
      this.path.length = 0;
      this.pathIndex = 0;
      this.navigationBlockedTime = 0;
      this.navigationDestination = null;
      this.navigationState = 'complete';
      this.navigationReason = 'arrived';
      return;
    }

    if (requestedMovement && !madeProgress) {
      this.navigationBlockedTime = Math.min(this.navigationBlockTimeout, this.navigationBlockedTime + delta);
      if (this.navigationBlockedTime >= this.navigationBlockTimeout) {
        this._replanNavigation(dynamicColliders);
      }
    } else if (madeProgress) {
      this.navigationBlockedTime = 0;
    }
  }

  /**
   * @param {THREE.Box3[]} dynamicColliders
   */
  _replanNavigation(dynamicColliders) {
    const destination = this.navigationDestination;
    if (!this.navigation || !destination) {
      this.path.length = 0;
      this.pathIndex = 0;
      this.navigationDestination = null;
      this.navigationState = 'cancelled';
      this.navigationReason = 'blocked';
      return;
    }

    const result = this.navigation.findPath(this.position.x, this.position.z, destination.x, destination.z, {
      dynamicColliders,
    });
    if (result.status !== 'complete' || result.waypoints.length === 0) {
      this.path.length = 0;
      this.pathIndex = 0;
      this.navigationDestination = null;
      this.navigationState = 'cancelled';
      this.navigationReason = result.reason || 'blocked';
      return;
    }

    this.path = result.waypoints.map((waypoint) => waypoint.clone());
    this.pathIndex = 0;
    this.navigationBlockedTime = 0;
    this.navigationState = 'moving';
    this.navigationReason = null;
  }

  _moveWithCollisions(deltaX, deltaZ, colliders) {
    const distance = Math.hypot(deltaX, deltaZ);
    const substeps = Math.max(1, Math.ceil(distance / this.navigationMaxSubstep));
    const stepX = deltaX / substeps;
    const stepZ = deltaZ / substeps;

    for (let step = 0; step < substeps; step += 1) {
      this._moveNavigationAxis('x', stepX, colliders);
      this._moveNavigationAxis('z', stepZ, colliders);
    }
  }

  _moveNavigationAxis(axis, amount, colliders) {
    if (Math.abs(amount) <= 0.000001) return;

    const previous = this.position[axis];
    this.position[axis] += amount;
    this._navigationAABB.min.set(
      this.position.x - this.navigationRadius,
      this.position.y + 0.02,
      this.position.z - this.navigationRadius,
    );
    this._navigationAABB.max.set(
      this.position.x + this.navigationRadius,
      this.position.y + 1.8,
      this.position.z + this.navigationRadius,
    );

    for (const collider of colliders) {
      if (!collider?.min || !collider?.max) continue;
      if (collider.max.y <= this._navigationAABB.min.y || collider.min.y >= this._navigationAABB.max.y) continue;
      if (!this._navigationAABB.intersectsBox(collider)) continue;
      this.position[axis] = previous;
      return;
    }
  }

  _updateFloatingAndBreathing(animSpeed, happinessMult, energyMult) {
    // Vertical Floating (higher happiness = more buoyant bounce)
    const floatFreq = 2.2 * animSpeed;
    const floatAmp = 0.03 + happinessMult * 0.04;
    const floatY = Math.sin(this.time * floatFreq) * floatAmp + 0.05 * happinessMult;
    this.floatContainer.position.y = floatY;

    // Soft Breathing expansion in torso
    const breathFreq = 1.8 * animSpeed;
    const breathScaleY = 1.0 + Math.sin(this.time * breathFreq) * 0.025;
    const breathScaleXZ = 1.0 + Math.cos(this.time * breathFreq) * 0.015;
    this.torso.scale.set(breathScaleXZ, breathScaleY, breathScaleXZ);

    // Scarf tail wave
    if (this.scarfTail) {
      this.scarfTail.rotation.x = 0.25 + Math.sin(this.time * 4.0 * animSpeed) * 0.15 * (1 + this.chargeWeight * 1.5);
      this.scarfTail.rotation.z = Math.cos(this.time * 3.0 * animSpeed) * 0.1;
    }

    // Ground Shadow scale follows float height
    if (this.shadow) {
      const sFactor = 1.0 - floatY * 1.2;
      this.shadow.scale.set(sFactor, sFactor, sFactor);
      this.shadow.material.opacity = 0.4 * sFactor;
    }
  }

  _updateLookingAround(delta) {
    this.lookAroundTimer += delta;

    if (this.lookAroundTimer >= this.nextLookTime) {
      this.lookAroundTimer = 0;
      this.nextLookTime = 2.0 + Math.random() * 4.0;

      // Random target angles (yaw: -40 to +40 deg, pitch: -15 to +15 deg)
      if (Math.random() > 0.3) {
        this.headLookTarget.y = (Math.random() - 0.5) * 1.2;
        this.headLookTarget.x = (Math.random() - 0.5) * 0.4;
      } else {
        // Return to looking forward
        this.headLookTarget.y = 0;
        this.headLookTarget.x = 0;
      }
    }

    // Smooth lerp to target head rotation
    const lerpSpeed = delta * 4.0;
    this.headCurrentRotation.x += (this.headLookTarget.x - this.headCurrentRotation.x) * lerpSpeed;
    this.headCurrentRotation.y += (this.headLookTarget.y - this.headCurrentRotation.y) * lerpSpeed;

    this.headPivot.rotation.x = this.headCurrentRotation.x;
    this.headPivot.rotation.y = this.headCurrentRotation.y;
  }

  _updateChargePose(animSpeed) {
    // Tremble parameters scaling with powerLevel (1 to 10)
    const trembleFreq = 28.0 + this._powerLevel * 6.0;
    const trembleAmp = (0.008 + this._powerLevel * 0.0035) * this.chargeWeight;

    // High frequency tremor noise calculation
    const t = this.time * trembleFreq;
    this.leftHandTremble.set(
      Math.sin(t * 1.1) * trembleAmp,
      Math.cos(t * 1.3) * trembleAmp,
      Math.sin(t * 0.9) * trembleAmp,
    );
    this.rightHandTremble.set(
      Math.cos(t * 1.2) * trembleAmp,
      Math.sin(t * 1.4) * trembleAmp,
      Math.cos(t * 0.85) * trembleAmp,
    );

    // Base Idle Arm Rotations
    const idleLeftRotX = Math.sin(this.time * 2.0) * 0.05;
    const idleRightRotX = -Math.sin(this.time * 2.0) * 0.05;
    const idleLeftRotZ = 0.15;
    const idleRightRotZ = -0.15;

    // Charge Pose Target: Arms extended forward, hands facing out
    const chargeArmRotX = -Math.PI * 0.45; // Extend arms forward
    const chargeLeftArmRotY = 0.25;
    const chargeRightArmRotY = -0.25;

    // Blend between Idle and Charge Arm Rotations
    const w = this.chargeWeight;

    this.leftArmPivot.rotation.x = THREE.MathUtils.lerp(idleLeftRotX, chargeArmRotX, w) + this.leftHandTremble.x * 2.0;
    this.leftArmPivot.rotation.y = THREE.MathUtils.lerp(0, chargeLeftArmRotY, w);
    this.leftArmPivot.rotation.z = THREE.MathUtils.lerp(idleLeftRotZ, 0.1, w);

    this.rightArmPivot.rotation.x =
      THREE.MathUtils.lerp(idleRightRotX, chargeArmRotX, w) + this.rightHandTremble.x * 2.0;
    this.rightArmPivot.rotation.y = THREE.MathUtils.lerp(0, chargeRightArmRotY, w);
    this.rightArmPivot.rotation.z = THREE.MathUtils.lerp(idleRightRotZ, -0.1, w);

    // Forearm / Hand facing angles & tremor displacement
    this.leftForearmPivot.rotation.x = THREE.MathUtils.lerp(0, -Math.PI * 0.15, w);
    this.leftHand.position.x = this.leftHandTremble.x;
    this.leftHand.position.y = -0.08 + this.leftHandTremble.y;
    this.leftHand.position.z = this.leftHandTremble.z;

    this.rightForearmPivot.rotation.x = THREE.MathUtils.lerp(0, -Math.PI * 0.15, w);
    this.rightHand.position.x = this.rightHandTremble.x;
    this.rightHand.position.y = -0.08 + this.rightHandTremble.y;
    this.rightHand.position.z = this.rightHandTremble.z;

    // Lean torso forward slightly while charging
    this.torso.rotation.x = THREE.MathUtils.lerp(0, 0.12, w);
  }

  _updateBlastGesture(delta) {
    if (!this.isBlasting) return;

    this.blastTimer += delta;
    const progress = Math.min(1.0, this.blastTimer / this.blastDuration);

    // Arm push gesture curve (fast explosive forward thrust, then ease back)
    let blastArmX = -Math.PI * 0.45;
    if (progress < 0.3) {
      // Explosive push
      const pushFactor = progress / 0.3;
      blastArmX = THREE.MathUtils.lerp(-Math.PI * 0.45, -Math.PI * 0.65, pushFactor);
      this.torso.position.z = -pushFactor * 0.08; // Recoil backward
    } else {
      // Recovery
      const recoverFactor = (progress - 0.3) / 0.7;
      blastArmX = THREE.MathUtils.lerp(-Math.PI * 0.65, -Math.PI * 0.45, recoverFactor);
      this.torso.position.z = THREE.MathUtils.lerp(-0.08, 0, recoverFactor);
    }

    this.leftArmPivot.rotation.x = blastArmX;
    this.rightArmPivot.rotation.x = blastArmX;

    // Expand Blast Shockwave Ring & Sphere
    const pFactor = this._powerLevel / 10;
    const maxRadius = (2.5 + pFactor * 2.0) * progress;

    if (this.blastRing) {
      this.blastRing.scale.set(maxRadius, maxRadius, maxRadius);
      this.blastRing.material.opacity = (1.0 - progress) * 0.9;
    }

    if (this.blastSphere) {
      this.blastSphere.scale.set(maxRadius * 0.8, maxRadius * 0.8, maxRadius * 0.8);
      this.blastSphere.material.opacity = (1.0 - progress) * 0.7;
    }

    // Finish blast gesture state
    if (progress >= 1.0) {
      this.isBlasting = false;
      this.blastRing.material.opacity = 0;
      this.blastSphere.material.opacity = 0;
    }
  }

  _updateAuraParticles(delta, animSpeed) {
    const pFactor = this._powerLevel / 10;
    const isChargingBoost = 1.0 + this.chargeWeight * 1.8;
    const rotSpeed = (0.8 + pFactor * 1.5) * animSpeed * isChargingBoost;

    // Rotate Aura Rings
    if (this.windRing1) this.windRing1.rotation.z += delta * rotSpeed * 1.2;
    if (this.windRing2) this.windRing2.rotation.z -= delta * rotSpeed * 1.5;

    // Update orbit particles
    if (this.particles) {
      const positions = this.particles.geometry.attributes.position.array;

      for (let i = 0; i < this.particleData.length; i++) {
        const p = this.particleData[i];

        p.angle += delta * p.speed * rotSpeed;
        p.height += delta * 0.4 * animSpeed;

        if (p.height > 1.2) {
          p.height = 0.1;
        }

        // Tighten radius when charging
        const currentRadius = p.radius * (1.0 - this.chargeWeight * 0.35);

        positions[i * 3] = Math.cos(p.angle) * currentRadius;
        positions[i * 3 + 1] = p.height;
        positions[i * 3 + 2] = Math.sin(p.angle) * currentRadius;
      }

      this.particles.geometry.attributes.position.needsUpdate = true;
    }
  }

  // ==========================================
  // DISPOSAL & CLEANUP
  // ==========================================
  dispose() {
    if (this.model && this.model.parent) {
      this.model.parent.remove(this.model);
    }
    this.model.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
}
