import * as THREE from 'three';

export class PlayerController {
  constructor(camera, input, scene) {
    this.camera = camera;
    this.input = input;
    this.scene = scene;
    this.position = new THREE.Vector3(0, 0, 6);
    this.velocity = new THREE.Vector3();
    this.windForce = new THREE.Vector3();
    this.destination = null;
    this.path = [];
    this.pathIndex = 0;
    this.navigation = null;
    this.selected = false;
    this.health = 100;
    this.onGround = true;
    this.isCrouching = false;
    this.isSprinting = false;
    this.radius = 0.42;
    this.height = 1.8;
    this.walkSpeed = 4.8;
    this.sprintSpeed = 7.8;
    this.acceleration = 12;
    this.time = 0;
    this.cameraZoom = 1;

    // Wind Child Attributes & Stats
    this.name = 'Wind Child';
    this.powerLevel = 5;
    this.happiness = 85;
    this.energy = 100;
    this._activeEffects = [];

    // Animation state variables
    this.animPhase = 0;
    this.idleTime = 0;
    this.lookAroundTimer = 0;
    this.doorAnimWeight = 0;
    this.nearDoor = false;

    this._playerAABB = new THREE.Box3();
    this._tempPos = new THREE.Vector3();
    this._wishDir = new THREE.Vector3();
    this._desiredVelocity = new THREE.Vector3();
    this._cameraTarget = new THREE.Vector3(0, 0, 6);
    this._cameraDesired = new THREE.Vector3();
    this._clickPoint = new THREE.Vector3();
    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._pointer = new THREE.Vector2();
    this._raycaster = new THREE.Raycaster();
    this._cameraOffset = new THREE.Vector3(0, 27, 14);

    this._buildCharacter();
    this.select();
    this.input.onWheel = (event) => this._onWheel(event);
    this._setCameraImmediately();
  }

  _buildCharacter() {
    this.model = new THREE.Group();
    this.model.name = 'Wind Child';
    this.model.userData.interactiveType = 'wind-child';
    this.model.userData.isWindChild = true;

    // Soft Ground Shadow
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.85, 24),
      new THREE.MeshBasicMaterial({ color: 0x040b12, transparent: true, opacity: 0.38, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.015;

    // Character Materials
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xf7c49e, roughness: 0.65 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x3d2920, roughness: 0.85 });
    const coatMat = new THREE.MeshStandardMaterial({ color: 0x2b6b8a, roughness: 0.45, metalness: 0.2 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xdff5ff, roughness: 0.35 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x182836, roughness: 0.6, metalness: 0.1 });
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x0c141d, roughness: 0.4 });
    const soleMat = new THREE.MeshStandardMaterial({ color: 0x49d7e8, emissive: 0x49d7e8, emissiveIntensity: 1.5, roughness: 0.2 });
    const visorMat = new THREE.MeshStandardMaterial({ color: 0x57f0ff, emissive: 0x24a7c0, emissiveIntensity: 1.8, transparent: true, opacity: 0.82 });
    const badgeMat = new THREE.MeshStandardMaterial({ color: 0xffd36d, emissive: 0xd77a26, emissiveIntensity: 1.4, roughness: 0.3 });
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0x1f3442, roughness: 0.5, metalness: 0.3 });

    this.body = new THREE.Group();

    // Pelvis Root
    this.pelvis = new THREE.Group();
    this.pelvis.position.y = 0.9;
    const pelvisMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.2, 0.26), pantsMat);
    this.pelvis.add(pelvisMesh);

    // Torso (Jacket & Coat)
    this.torso = new THREE.Group();
    this.torso.position.y = 0.12;

    const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.72, 12), coatMat);
    coat.position.y = 0.36;

    const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.45, 0.24), coatMat);
    chestPlate.position.set(0, 0.42, 0.02);

    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.14, 12), trimMat);
    collar.position.y = 0.75;

    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.02), badgeMat);
    badge.position.set(0.12, 0.52, 0.15);

    this.torso.add(coat, chestPlate, collar, badge);

    // Neck & Head
    this.neck = new THREE.Group();
    this.neck.position.set(0, 0.78, 0);

    this.head = new THREE.Group();
    this.head.position.y = 0.14;

    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), skinMat);
    headMesh.scale.set(1, 1.08, 1);

    // Stylized Hair
    const hairTop = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
    hairTop.position.set(0, 0.04, -0.02);

    const hairBangs = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.12), hairMat);
    hairBangs.position.set(0, 0.14, 0.16);
    hairBangs.rotation.x = 0.2;

    // Glowing Sci-Fi AR Visor / Glasses
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.09, 0.12), visorMat);
    visor.position.set(0, 0.04, 0.16);

    const earpiece = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 8), trimMat);
    earpiece.rotation.z = Math.PI / 2;
    earpiece.position.set(0.25, 0.02, 0);

    this.head.add(headMesh, hairTop, hairBangs, visor, earpiece);
    this.neck.add(this.head);
    this.torso.add(this.neck);

    // Arms Setup (Shoulder -> Upper Arm -> Elbow -> Forearm -> Hand)
    // Left Arm
    this.leftShoulder = new THREE.Group();
    this.leftShoulder.position.set(-0.38, 0.62, 0);
    const leftUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.35, 10), coatMat);
    leftUpperArm.position.y = -0.175;

    this.leftElbow = new THREE.Group();
    this.leftElbow.position.y = -0.35;
    const leftForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.32, 10), trimMat);
    leftForearm.position.y = -0.16;
    const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), gloveMat);
    leftHand.position.y = -0.34;
    this.leftElbow.add(leftForearm, leftHand);

    this.leftShoulder.add(leftUpperArm, this.leftElbow);

    // Right Arm
    this.rightShoulder = new THREE.Group();
    this.rightShoulder.position.set(0.38, 0.62, 0);
    const rightUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.35, 10), coatMat);
    rightUpperArm.position.y = -0.175;

    this.rightElbow = new THREE.Group();
    this.rightElbow.position.y = -0.35;
    const rightForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.32, 10), trimMat);
    rightForearm.position.y = -0.16;
    const rightHand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), gloveMat);
    rightHand.position.y = -0.34;
    this.rightElbow.add(rightForearm, rightHand);

    this.rightShoulder.add(rightUpperArm, this.rightElbow);

    this.torso.add(this.leftShoulder, this.rightShoulder);
    this.pelvis.add(this.torso);

    // Legs Setup (Hip -> Thigh -> Knee -> Calf -> Boot)
    // Left Leg
    this.leftHip = new THREE.Group();
    this.leftHip.position.set(-0.16, -0.05, 0);
    const leftThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.42, 10), pantsMat);
    leftThigh.position.y = -0.21;

    this.leftKnee = new THREE.Group();
    this.leftKnee.position.y = -0.42;
    const leftCalf = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.38, 10), pantsMat);
    leftCalf.position.y = -0.19;

    const leftBoot = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.14, 0.28), bootMat);
    leftBoot.position.set(0, -0.38, 0.05);
    const leftSole = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 0.29), soleMat);
    leftSole.position.set(0, -0.44, 0.05);

    this.leftKnee.add(leftCalf, leftBoot, leftSole);
    this.leftHip.add(leftThigh, this.leftKnee);

    // Right Leg
    this.rightHip = new THREE.Group();
    this.rightHip.position.set(0.16, -0.05, 0);
    const rightThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.42, 10), pantsMat);
    rightThigh.position.y = -0.21;

    this.rightKnee = new THREE.Group();
    this.rightKnee.position.y = -0.42;
    const rightCalf = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.38, 10), pantsMat);
    rightCalf.position.y = -0.19;

    const rightBoot = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.14, 0.28), bootMat);
    rightBoot.position.set(0, -0.38, 0.05);
    const rightSole = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 0.29), soleMat);
    rightSole.position.set(0, -0.44, 0.05);

    this.rightKnee.add(rightCalf, rightBoot, rightSole);
    this.rightHip.add(rightThigh, this.rightKnee);

    this.pelvis.add(this.leftHip, this.rightHip);
    this.body.add(this.pelvis);

    this.body.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    // Selection Ring
    this.selectionRing = new THREE.Mesh(
      new THREE.RingGeometry(0.72, 0.88, 32),
      new THREE.MeshStandardMaterial({
        color: 0x7eeeff,
        emissive: 0x24a7c0,
        emissiveIntensity: 1.7,
        transparent: true,
        opacity: 0.95,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
        side: THREE.DoubleSide
      })
    );
    this.selectionRing.rotation.x = -Math.PI / 2;
    this.selectionRing.position.y = 0.04;
    this.selectionRing.visible = false;

    this.model.add(shadow, this.body, this.selectionRing);
    this.model.position.copy(this.position);
    this.scene.add(this.model);

    // Destination Marker
    this.destinationMarker = new THREE.Group();
    const markerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.46, 32),
      new THREE.MeshStandardMaterial({
        color: 0xffd36d,
        emissive: 0xd77a26,
        emissiveIntensity: 1.8,
        transparent: true,
        opacity: 0.9,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
        side: THREE.DoubleSide
      })
    );
    markerRing.rotation.x = -Math.PI / 2;
    markerRing.position.y = 0.035;

    const markerDot = new THREE.Mesh(
      new THREE.CircleGeometry(0.1, 16),
      new THREE.MeshBasicMaterial({
        color: 0xfff1ae,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2
      })
    );
    markerDot.rotation.x = -Math.PI / 2;
    markerDot.position.y = 0.04;

    this.destinationMarker.add(markerRing, markerDot);
    this.destinationMarker.visible = false;
    this.scene.add(this.destinationMarker);
  }

  setNavigation(navigation) {
    this.navigation = navigation;
  }

  select() {
    this.selected = true;
    this.selectionRing.visible = true;
  }

  deselect() {
    this.selected = false;
    this.selectionRing.visible = false;
  }

  handlePointerDown(event) {
    if (event.button !== 0) return false;
    const rect = this.camera.userData.canvas?.getBoundingClientRect?.() || this.input.canvas.getBoundingClientRect();
    this._pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this._pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this._raycaster.setFromCamera(this._pointer, this.camera);

    const characterHits = this._raycaster.intersectObject(this.model, true);
    if (characterHits.length > 0) {
      this.select();
      this.path.length = 0;
      this.destination = null;
      this.destinationMarker.visible = false;
      return true;
    }

    if (!this._raycaster.ray.intersectPlane(this._groundPlane, this._clickPoint)) return false;
    if (!this.selected) this.select();
    this.moveTo(this._clickPoint.x, this._clickPoint.z);
    return true;
  }

  moveTo(x, z) {
    let path = [];
    if (this.navigation) path = this.navigation.findPath(this.position.x, this.position.z, x, z);
    if (path.length > 0) {
      this.path = path;
      this.pathIndex = 0;
      this.destination = path[path.length - 1].clone();
      this.destinationMarker.position.copy(this.destination);
      this.destinationMarker.visible = true;
    }
  }

  _onWheel(event) {
    const nextZoom = this.camera.zoom * (event.deltaY > 0 ? 0.9 : 1.1);
    this.camera.zoom = THREE.MathUtils.clamp(nextZoom, 0.65, 2.5);
    this.camera.updateProjectionMatrix();
  }

  _setCameraImmediately() {
    this.camera.position.copy(this._cameraTarget).add(this._cameraOffset);
    this.camera.lookAt(this._cameraTarget);
    this.camera.updateMatrixWorld();
  }

  setWindForce(force) {
    this.windForce.copy(force);
  }

  update(delta, colliders, doors = []) {
    this.time += delta;
    const hasKeyboardInput = this.input.keys.forward || this.input.keys.back || this.input.keys.left || this.input.keys.right;
    if (hasKeyboardInput) {
      this.path.length = 0;
      this.destination = null;
      this.destinationMarker.visible = false;
    }

    this._wishDir.set(0, 0, 0);
    if (hasKeyboardInput) {
      if (this.input.keys.forward) this._wishDir.z -= 1;
      if (this.input.keys.back) this._wishDir.z += 1;
      if (this.input.keys.left) this._wishDir.x -= 1;
      if (this.input.keys.right) this._wishDir.x += 1;
    } else if (this.pathIndex < this.path.length) {
      const target = this.path[this.pathIndex];
      this._wishDir.set(target.x - this.position.x, 0, target.z - this.position.z);
      if (this._wishDir.lengthSq() < 0.18 * 0.18) {
        this.pathIndex += 1;
        if (this.pathIndex >= this.path.length) {
          this.path.length = 0;
          this.destination = null;
          this.destinationMarker.visible = false;
          this.velocity.set(0, 0, 0);
        }
      }
    }

    if (this._wishDir.lengthSq() > 0) this._wishDir.normalize();
    this.isSprinting = this.input.keys.sprint && hasKeyboardInput;
    const speed = this.isSprinting ? this.sprintSpeed : this.walkSpeed;
    this._desiredVelocity.copy(this._wishDir).multiplyScalar(speed);
    const blend = 1 - Math.exp(-this.acceleration * delta);
    this.velocity.x += (this._desiredVelocity.x - this.velocity.x) * blend;
    this.velocity.z += (this._desiredVelocity.z - this.velocity.z) * blend;
    if (this._wishDir.lengthSq() === 0) {
      const stop = Math.exp(-16 * delta);
      this.velocity.x *= stop;
      this.velocity.z *= stop;
    }

    // Wind is an acceleration rather than an override, so player input remains responsive.
    this.velocity.addScaledVector(this.windForce, delta);

    this._resolveCollision(delta, colliders);

    const currentSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);

    // Check Door Proximity for Door Opening Animation
    this.nearDoor = false;
    if (doors && doors.length > 0) {
      for (const door of doors) {
        const dx = this.position.x - door.x;
        const dz = this.position.z - door.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 2.1 && currentSpeed > 0.2) {
          this.nearDoor = true;
          break;
        }
      }
    }

    const targetDoorWeight = this.nearDoor ? 1 : 0;
    const doorBlendSpeed = this.nearDoor ? 4.5 : 3.0;
    this.doorAnimWeight += (targetDoorWeight - this.doorAnimWeight) * Math.min(1, delta * doorBlendSpeed);

    // Animate Character Procedural States
    this._animateCharacter(delta, currentSpeed);

    if (currentSpeed > 0.15) {
      const targetRotation = Math.atan2(this.velocity.x, this.velocity.z);
      let diff = targetRotation - this.model.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.model.rotation.y += diff * Math.min(1, delta * 14);
    }

    this.selectionRing.rotation.z = this.time * 0.2;
    if (this.destinationMarker.visible) {
      const pulse = 1 + Math.sin(this.time * 7) * 0.08;
      this.destinationMarker.scale.setScalar(pulse);
    }

    const followBlend = 1 - Math.exp(-8 * delta);
    this._cameraTarget.x += (this.position.x - this._cameraTarget.x) * followBlend;
    this._cameraTarget.z += (this.position.z - this._cameraTarget.z) * followBlend;
    this._cameraDesired.copy(this._cameraTarget).add(this._cameraOffset);
    this.camera.position.lerp(this._cameraDesired, followBlend);
    this.camera.lookAt(this._cameraTarget);
  }

  _animateCharacter(delta, speed) {
    if (speed > 0.15) {
      // WALKING / RUNNING ANIMATION
      this.idleTime = 0;
      this.lookAroundTimer = 0;

      const strideFreq = this.isSprinting ? 14 : 10;
      this.animPhase += delta * strideFreq;

      const stride = Math.sin(this.animPhase) * (this.isSprinting ? 0.75 : 0.58);
      const armStride = Math.sin(this.animPhase) * (this.isSprinting ? 0.7 : 0.52);

      // Leg Strides & Knee Bends
      this.leftHip.rotation.x = stride;
      this.rightHip.rotation.x = -stride;
      this.leftKnee.rotation.x = Math.max(0, -Math.sin(this.animPhase + 0.3) * 0.65);
      this.rightKnee.rotation.x = Math.max(0, Math.sin(this.animPhase + 0.3) * 0.65);

      // Arm Swings (Opposite to legs)
      this.leftShoulder.rotation.x = -armStride;
      this.rightShoulder.rotation.x = armStride;
      this.leftElbow.rotation.x = -0.2 - Math.abs(armStride) * 0.4;
      this.rightElbow.rotation.x = -0.2 - Math.abs(armStride) * 0.4;

      // Torso Bobbing & Swaying
      this.pelvis.position.y = 0.9 + Math.abs(Math.sin(this.animPhase)) * 0.045;
      this.torso.rotation.z = Math.sin(this.animPhase) * 0.04;
      this.torso.rotation.y = Math.sin(this.animPhase) * 0.05;

      // Reset Head Rotation
      this.head.rotation.y += (0 - this.head.rotation.y) * Math.min(1, delta * 8);
      this.head.rotation.x += (0 - this.head.rotation.x) * Math.min(1, delta * 8);
      this.neck.rotation.y += (0 - this.neck.rotation.y) * Math.min(1, delta * 8);
    } else {
      // IDLE & LOOKING AROUND ANIMATIONS
      this.animPhase = 0;
      this.idleTime += delta;

      // Lerp Legs back to neutral standing posture
      this.leftHip.rotation.x += (0 - this.leftHip.rotation.x) * Math.min(1, delta * 8);
      this.rightHip.rotation.x += (0 - this.rightHip.rotation.x) * Math.min(1, delta * 8);
      this.leftKnee.rotation.x += (0 - this.leftKnee.rotation.x) * Math.min(1, delta * 8);
      this.rightKnee.rotation.x += (0 - this.rightKnee.rotation.x) * Math.min(1, delta * 8);
      this.pelvis.position.y += (0.9 - this.pelvis.position.y) * Math.min(1, delta * 8);
      this.torso.rotation.z += (0 - this.torso.rotation.z) * Math.min(1, delta * 8);

      // Breathing Motion
      const breath = Math.sin(this.idleTime * 2.6);
      this.torso.position.y = 0.12 + breath * 0.015;
      this.leftShoulder.rotation.z = -0.08 + breath * 0.02;
      this.rightShoulder.rotation.z = 0.08 - breath * 0.02;
      this.leftShoulder.rotation.x += (-0.05 - this.leftShoulder.rotation.x) * Math.min(1, delta * 6);
      this.rightShoulder.rotation.x += (-0.05 - this.rightShoulder.rotation.x) * Math.min(1, delta * 6);
      this.leftElbow.rotation.x += (-0.18 - this.leftElbow.rotation.x) * Math.min(1, delta * 6);
      this.rightElbow.rotation.x += (-0.18 - this.rightElbow.rotation.x) * Math.min(1, delta * 6);

      // Looking Around Routine (Triggered after 2 seconds idle)
      if (this.idleTime > 2.0) {
        this.lookAroundTimer += delta;
        const cycle = (this.lookAroundTimer % 6.5);

        let targetHeadY = 0;
        let targetHeadX = 0;
        let targetNeckY = 0;

        if (cycle > 0.5 && cycle < 2.2) {
          // Look Left
          targetHeadY = 0.52;
          targetNeckY = 0.22;
          targetHeadX = 0.06;
        } else if (cycle > 3.0 && cycle < 4.8) {
          // Look Right
          targetHeadY = -0.52;
          targetNeckY = -0.22;
          targetHeadX = 0.04;
        }

        this.head.rotation.y += (targetHeadY - this.head.rotation.y) * Math.min(1, delta * 4.5);
        this.head.rotation.x += (targetHeadX - this.head.rotation.x) * Math.min(1, delta * 4.5);
        this.neck.rotation.y += (targetNeckY - this.neck.rotation.y) * Math.min(1, delta * 3.5);
      } else {
        this.head.rotation.y += (0 - this.head.rotation.y) * Math.min(1, delta * 6);
        this.head.rotation.x += (0 - this.head.rotation.x) * Math.min(1, delta * 6);
        this.neck.rotation.y += (0 - this.neck.rotation.y) * Math.min(1, delta * 6);
      }
    }

    // OPEN DOOR ANIMATION OVERLAY (Reaching out arm to keycard scanner / handle)
    if (this.doorAnimWeight > 0.01) {
      const w = this.doorAnimWeight;
      // Lift Right Arm & Extend Forearm Forward to scan keycard / open door
      this.rightShoulder.rotation.x = THREE.MathUtils.lerp(this.rightShoulder.rotation.x, -1.25, w);
      this.rightShoulder.rotation.y = THREE.MathUtils.lerp(this.rightShoulder.rotation.y, -0.35, w);
      this.rightShoulder.rotation.z = THREE.MathUtils.lerp(this.rightShoulder.rotation.z, 0.2, w);
      this.rightElbow.rotation.x = THREE.MathUtils.lerp(this.rightElbow.rotation.x, -0.4, w);

      // Turn Head towards door scanner
      this.head.rotation.y = THREE.MathUtils.lerp(this.head.rotation.y, 0.35, w);
      this.head.rotation.x = THREE.MathUtils.lerp(this.head.rotation.x, 0.08, w);
    }
  }

  _resolveCollision(delta, colliders) {
    const pos = this._tempPos.copy(this.position);

    // Resolve X movement
    const dx = this.velocity.x * delta;
    if (Math.abs(dx) > 0.0001) {
      pos.x += dx;
      this._setAABB(pos);
      for (const collider of colliders) {
        if (!this._playerAABB.intersectsBox(collider)) continue;
        if (dx > 0) pos.x = collider.min.x - this.radius - 0.001;
        else if (dx < 0) pos.x = collider.max.x + this.radius + 0.001;
        this.velocity.x = 0;
        this._setAABB(pos);
      }
    }

    // Resolve Z movement
    const dz = this.velocity.z * delta;
    if (Math.abs(dz) > 0.0001) {
      pos.z += dz;
      this._setAABB(pos);
      for (const collider of colliders) {
        if (!this._playerAABB.intersectsBox(collider)) continue;
        if (dz > 0) pos.z = collider.min.z - this.radius - 0.001;
        else if (dz < 0) pos.z = collider.max.z + this.radius + 0.001;
        this.velocity.z = 0;
        this._setAABB(pos);
      }
    }

    // Secondary depenetration guard for static overlaps (prevents snapping/teleportation across walls)
    this._setAABB(pos);
    for (const collider of colliders) {
      if (!this._playerAABB.intersectsBox(collider)) continue;

      const overlapX1 = this._playerAABB.max.x - collider.min.x;
      const overlapX2 = collider.max.x - this._playerAABB.min.x;
      const minOverlapX = Math.min(overlapX1, overlapX2);

      const overlapZ1 = this._playerAABB.max.z - collider.min.z;
      const overlapZ2 = collider.max.z - this._playerAABB.min.z;
      const minOverlapZ = Math.min(overlapZ1, overlapZ2);

      // Only resolve shallow penetration (< 0.35m) so character never teleports across large objects
      if (minOverlapX < minOverlapZ && minOverlapX < 0.35) {
        if (overlapX1 < overlapX2) pos.x -= overlapX1 + 0.001;
        else pos.x += overlapX2 + 0.001;
        this.velocity.x = 0;
      } else if (minOverlapZ < 0.35) {
        if (overlapZ1 < overlapZ2) pos.z -= overlapZ1 + 0.001;
        else pos.z += overlapZ2 + 0.001;
        this.velocity.z = 0;
      }
      this._setAABB(pos);
    }

    this.position.copy(pos);
    this.model.position.copy(this.position);
  }

  _setAABB(pos) {
    this._playerAABB.min.set(pos.x - this.radius, 0, pos.z - this.radius);
    this._playerAABB.max.set(pos.x + this.radius, this.height, pos.z + this.radius);
  }
}
