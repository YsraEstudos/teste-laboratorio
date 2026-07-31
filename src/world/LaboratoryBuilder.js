import * as THREE from 'three';
import { getRoomAt, ROOMS } from './RoomData.js';
import { TextureGenerator } from './TextureGenerator.js';
import { DoorSystem } from './DoorSystem.js';
import { TestObjectSystem } from './TestObjectSystem.js';
import { SandTerrainSystem } from './SandTerrainSystem.js';
import { GPUComputeSandSystem } from './GPUComputeSandSystem.js';
import { SandContactSystem } from './SandContactSystem.js';
import { SandFootstepSystem } from './SandFootstepSystem.js';

const MAX_REAL_AREA_LIGHTS = 8;
const EMPTY_POSITIONS = [];

export class LaboratoryBuilder {
  constructor(scene, renderer = null, options = {}) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.ownedGeometries = new Set();
    this.ownedMaterials = new Set();
    this.ownedTextures = new Set();
    this.disposed = false;
    this.scene.add(this.root);
    this.unitBoxGeo = this._ownGeometry(new THREE.BoxGeometry(1, 1, 1));
    this.colliders = [];
    this.waterMeshes = [];
    this.lightMeshes = [];
    this.realAreaLightCount = 0;
    this.roofMeshes = [];
    this.doorSystem = new DoorSystem();
    this.doors = this.doorSystem.doors;
    this.testObjectSystem = new TestObjectSystem();
    this.testObjects = this.testObjectSystem.objects;
    this.time = 0;
    this.sandTerrainSystem = new SandTerrainSystem(this.root, {
      renderer,
      quality: options?.quality ?? 'high',
    });
    this.gpuSandSystem = new GPUComputeSandSystem(renderer, this.scene, {
      enabled: this.sandTerrainSystem.profile.gpuParticles,
      quality: this.sandTerrainSystem.quality,
    });

    this._boxBuffers = new Map();

    this._createMaterials();
    this._buildArchitecture();
    this._buildEntrance();
    this._buildMannequinWing();
    this._buildObjectsWing();
    this._buildGreenWings();
    this._buildTestingRoom();
    this._buildAtmosphere();
    this._flushBoxBuffers();

    this.dynamicColliders = this.doorSystem.getDynamicColliders();
    this.navigationColliders = [...this.colliders, ...this.dynamicColliders];
    this.rooms = ROOMS;

    this.sandVFX = null;
    this.contactActorIds = ['player', 'wind-child', 'actor-1', 'actor-2', 'actor-3'];
    this.sandContactSystem = new SandContactSystem({
      maxActors: 24,
      maxBrushesPerFrame: this.sandTerrainSystem.profile.maxBrushesPerFrame,
      onContact: (x, z, radius, depth, berm, compression, yaw, elongation, edge, source) => {
        const accepted = this.sandTerrainSystem.brush(x, z, radius, depth, berm, compression, yaw, elongation, edge);
        if (accepted) this.sandVFX?.triggerSandFootstepAt?.(x, z);
        void source;
        return accepted;
      },
    });
    this.testObjectSystem.setContactSystem(this.sandContactSystem);

    // Individual alternating footprints for the player and the Wind Child.
    this.sandFootstepSystem = new SandFootstepSystem({
      maxActors: 24,
      onFootprint: (x, z, yaw, footprintOptions) => {
        return this.sandTerrainSystem.applyFootprint(x, z, yaw, footprintOptions);
      },
    });
    this._actors = null;
    this.sandFootstepSystem.registerActor('player', {
      footprintProfile: 'player',
      width: 0.15,
      length: 0.29,
      minStepDistance: 0.2,
      leftOffset: (out) => {
        const anchor = this._actors?.player?.leftFootAnchor;
        out.x = anchor?.x ?? 0;
        out.z = anchor?.z ?? 0;
      },
      rightOffset: (out) => {
        const anchor = this._actors?.player?.rightFootAnchor;
        out.x = anchor?.x ?? 0;
        out.z = anchor?.z ?? 0;
      },
    });
    this.sandFootstepSystem.registerActor('wind-child', {
      footprintProfile: 'child',
      width: 0.1,
      length: 0.16,
      minStepDistance: 0.5,
      leftOffset: { x: -0.05, z: 0 },
      rightOffset: { x: 0.05, z: 0 },
    });
  }

  _ownGeometry(geometry) {
    this.ownedGeometries.add(geometry);
    return geometry;
  }

  _ownMaterial(material) {
    this.ownedMaterials.add(material);
    return material;
  }

  _ownTexture(texture) {
    this.ownedTextures.add(texture);
    return texture;
  }

  _addOwnedObject(object) {
    object.traverse((child) => {
      if (child.geometry) this._ownGeometry(child.geometry);
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => this._ownMaterial(material));
      } else if (child.material) {
        this._ownMaterial(child.material);
      }
    });
    this.root.add(object);
    return object;
  }

  _cloneTexture(texture, repeatX = 1, repeatY = 1) {
    const clone = this._ownTexture(texture.clone());
    clone.repeat.set(repeatX, repeatY);
    clone.needsUpdate = true;
    return clone;
  }

  _createMaterials() {
    const floorTexture = TextureGenerator.createFloorTileTexture();
    const wallTexture = TextureGenerator.createWallPanelTexture();
    const concreteTexture = TextureGenerator.createConcreteTexture();
    const grassTexture = TextureGenerator.createGrassTexture();
    const barkTexture = TextureGenerator.createBarkTexture();
    const metalTexture = TextureGenerator.createMetalTexture();
    const panelTexture = TextureGenerator.createEmissivePanelTexture();
    const waterTexture = TextureGenerator.createWaterTexture();
    this.materials = {
      floor: new THREE.MeshStandardMaterial({
        map: this._cloneTexture(floorTexture, 7, 5),
        color: 0xb4c6cc,
        roughness: 0.3,
        metalness: 0.25,
        polygonOffset: true,
        polygonOffsetFactor: 2,
        polygonOffsetUnits: 2,
      }),
      corridorFloor: new THREE.MeshStandardMaterial({
        map: this._cloneTexture(floorTexture, 8, 2),
        color: 0x708d99,
        roughness: 0.38,
        metalness: 0.32,
        polygonOffset: true,
        polygonOffsetFactor: 2,
        polygonOffsetUnits: 2,
      }),
      concrete: new THREE.MeshStandardMaterial({
        map: this._cloneTexture(concreteTexture, 12, 10),
        color: 0x707c82,
        roughness: 0.9,
        metalness: 0.02,
        polygonOffset: true,
        polygonOffsetFactor: 2,
        polygonOffsetUnits: 2,
      }),
      wall: new THREE.MeshStandardMaterial({
        map: this._cloneTexture(wallTexture, 1.5, 1),
        color: 0xe5edef,
        roughness: 0.67,
        metalness: 0.04,
      }),
      wallAccent: new THREE.MeshStandardMaterial({
        color: 0x243947,
        roughness: 0.42,
        metalness: 0.65,
        map: this._cloneTexture(metalTexture, 2, 1),
      }),
      ceiling: new THREE.MeshStandardMaterial({
        color: 0x23313b,
        roughness: 0.7,
        metalness: 0.2,
      }),
      metal: new THREE.MeshStandardMaterial({
        color: 0x354854,
        roughness: 0.3,
        metalness: 0.82,
        map: this._cloneTexture(metalTexture, 2, 1),
      }),
      darkMetal: new THREE.MeshStandardMaterial({
        color: 0x101a22,
        roughness: 0.28,
        metalness: 0.9,
        map: this._cloneTexture(metalTexture, 1, 1),
      }),
      doorGlass: new THREE.MeshStandardMaterial({
        color: 0x1f3b4d,
        roughness: 0.15,
        metalness: 0.75,
        transparent: true,
        opacity: 0.85,
      }),
      wood: new THREE.MeshStandardMaterial({
        color: 0x98633e,
        roughness: 0.72,
        metalness: 0.04,
      }),
      bark: new THREE.MeshStandardMaterial({
        map: this._cloneTexture(barkTexture, 1, 1),
        color: 0x865033,
        roughness: 0.9,
      }),
      grass: new THREE.MeshStandardMaterial({
        map: this._cloneTexture(grassTexture, 5, 5),
        color: 0x73ae63,
        roughness: 0.96,
        metalness: 0,
        polygonOffset: true,
        polygonOffsetFactor: 2,
        polygonOffsetUnits: 2,
      }),
      grassBlade: new THREE.MeshStandardMaterial({
        color: 0x78bd64,
        roughness: 0.95,
        side: THREE.DoubleSide,
      }),
      foliage: new THREE.MeshStandardMaterial({
        color: 0x4e9a58,
        roughness: 0.96,
      }),
      foliageLight: new THREE.MeshStandardMaterial({
        color: 0x84c96a,
        roughness: 0.94,
      }),
      foliageDark: new THREE.MeshStandardMaterial({
        color: 0x2c6f4b,
        roughness: 0.98,
      }),
      water: new THREE.MeshStandardMaterial({
        map: this._cloneTexture(waterTexture, 2, 2),
        color: 0x54c4d4,
        roughness: 0.18,
        metalness: 0.22,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      }),
      white: new THREE.MeshStandardMaterial({
        color: 0xf2f6f4,
        roughness: 0.48,
        metalness: 0.04,
      }),
      mannequin: new THREE.MeshStandardMaterial({
        color: 0xc4d4d7,
        roughness: 0.32,
        metalness: 0.16,
      }),
      mannequinAccent: new THREE.MeshStandardMaterial({
        color: 0x53c8d7,
        roughness: 0.28,
        metalness: 0.55,
        emissive: 0x0d6673,
        emissiveIntensity: 0.7,
      }),
      panel: new THREE.MeshStandardMaterial({
        map: panelTexture,
        emissiveMap: panelTexture,
        emissive: 0xffefd0,
        emissiveIntensity: 1.5,
        color: 0xffffff,
        roughness: 0.25,
      }),
      cyan: new THREE.MeshStandardMaterial({
        color: 0x49d7e8,
        emissive: 0x49d7e8,
        emissiveIntensity: 2.2,
        roughness: 0.3,
        metalness: 0.22,
      }),
      amber: new THREE.MeshStandardMaterial({
        color: 0xffb85c,
        emissive: 0xff8b2e,
        emissiveIntensity: 1.7,
        roughness: 0.35,
        metalness: 0.18,
      }),
      red: new THREE.MeshStandardMaterial({
        color: 0xf07170,
        emissive: 0x7e1e2c,
        emissiveIntensity: 0.75,
        roughness: 0.4,
      }),
      black: new THREE.MeshStandardMaterial({
        color: 0x080e12,
        roughness: 0.42,
        metalness: 0.78,
      }),
    };
    Object.values(this.materials).forEach((material) => this._ownMaterial(material));

    this.textures = {
      labSign: TextureGenerator.createSignageTexture('LABORATORIO', { foreground: '#a9f0ff' }),
      entranceSign: TextureGenerator.createSignageTexture('ENTRADA', { foreground: '#ffd47a', border: '#f0a94b' }),
      mannequinsSign: TextureGenerator.createSignageTexture('ALA DE MANEQUINS', { foreground: '#a9f0ff' }),
      objectsSign: TextureGenerator.createSignageTexture('ALA DE OBJETOS', {
        foreground: '#ffd47a',
        border: '#f0a94b',
      }),
      forestSign: TextureGenerator.createSignageTexture('FLORESTA SERENA', {
        foreground: '#b5f49d',
        border: '#6ebc76',
      }),
      meadowSign: TextureGenerator.createSignageTexture('PRADO GENTIL', { foreground: '#d9ff9d', border: '#8dcc64' }),
      monitor: TextureGenerator.createMonitorTexture(),
    };
  }

  /**
   * @param {number} width
   * @param {number} height
   * @param {number} depth
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {THREE.Material} material
   * @param {boolean} collider
   * @param {number} rotationY
   * @returns {THREE.Mesh}
   */
  _addBox(width, height, depth, x, y, z, material, collider = true, rotationY = 0) {
    if (!this._boxBuffers) this._boxBuffers = new Map();
    if (!this._boxBuffers.has(material)) this._boxBuffers.set(material, []);
    this._boxBuffers.get(material).push({
      width,
      height,
      depth,
      x,
      y,
      z,
      rotationY,
      collider,
    });

    if (collider) {
      if (Math.abs(rotationY) > 0.001) {
        const dummy = new THREE.Object3D();
        dummy.position.set(x, y, z);
        dummy.scale.set(width, height, depth);
        dummy.rotation.y = rotationY;
        dummy.updateMatrix();
        const bbox = new THREE.Box3(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5));
        bbox.applyMatrix4(dummy.matrix);
        this.colliders.push(bbox);
      } else {
        const minX = x - width / 2;
        const maxX = x + width / 2;
        const minY = y - height / 2;
        const maxY = y + height / 2;
        const minZ = z - depth / 2;
        const maxZ = z + depth / 2;
        this.colliders.push(new THREE.Box3(new THREE.Vector3(minX, minY, minZ), new THREE.Vector3(maxX, maxY, maxZ)));
      }
    }
    return null;
  }

  _flushBoxBuffers() {
    if (!this._boxBuffers) return;
    const helper = new THREE.Object3D();
    for (const [material, boxes] of this._boxBuffers.entries()) {
      if (boxes.length === 0) continue;
      const instancedMesh = new THREE.InstancedMesh(this.unitBoxGeo, material, boxes.length);
      instancedMesh.castShadow = true;
      instancedMesh.receiveShadow = true;
      boxes.forEach((box, i) => {
        helper.position.set(box.x, box.y, box.z);
        helper.rotation.set(0, box.rotationY, 0);
        helper.scale.set(box.width, box.height, box.depth);
        helper.updateMatrix();
        instancedMesh.setMatrixAt(i, helper.matrix);
      });
      instancedMesh.instanceMatrix.needsUpdate = true;
      instancedMesh.computeBoundingSphere();
      instancedMesh.matrixAutoUpdate = false;
      instancedMesh.updateMatrix();
      this._addOwnedObject(instancedMesh);
    }
    this._boxBuffers.clear();
  }

  _addFloor(width, depth, x, z, material, y = 0) {
    const geometry = new THREE.PlaneGeometry(width, depth);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    this._addOwnedObject(mesh);
    return mesh;
  }

  _addWallX(x, minZ, maxZ, gaps = []) {
    const sorted = gaps.slice().sort((a, b) => a[0] - b[0]);
    let cursor = minZ;
    for (const [gapMin, gapMax] of sorted) {
      if (gapMin > cursor) this._addBox(0.24, 4, gapMin - cursor, x, 2, (cursor + gapMin) / 2, this.materials.wall);
      cursor = Math.max(cursor, gapMax);
    }
    if (cursor < maxZ) this._addBox(0.24, 4, maxZ - cursor, x, 2, (cursor + maxZ) / 2, this.materials.wall);
  }

  _addWallZ(z, minX, maxX, gaps = []) {
    const sorted = gaps.slice().sort((a, b) => a[0] - b[0]);
    let cursor = minX;
    for (const [gapMin, gapMax] of sorted) {
      if (gapMin > cursor) this._addBox(gapMin - cursor, 4, 0.24, (cursor + gapMin) / 2, 2, z, this.materials.wall);
      cursor = Math.max(cursor, gapMax);
    }
    if (cursor < maxX) this._addBox(maxX - cursor, 4, 0.24, (cursor + maxX) / 2, 2, z, this.materials.wall);
  }

  _addLightPanel(x, z, width = 2.1, depth = 0.48, color = 0xffefd0, intensity = 4.5) {
    const panel = this._addBox(width, 0.06, depth, x, 4.02, z, this.materials.panel, false);

    // Mantém apenas um conjunto pequeno de luzes reais; os painéis continuam emissivos.
    if (this.realAreaLightCount < MAX_REAL_AREA_LIGHTS) {
      const rectLight = new THREE.RectAreaLight(color, intensity, width, depth);
      rectLight.position.set(x, 3.95, z);
      rectLight.rotation.x = -Math.PI / 2;
      this._addOwnedObject(rectLight);
      this.realAreaLightCount += 1;
    }

    this.lightMeshes.push(panel);
    return panel;
  }

  _addLightRow(x, z, width, depth, count, horizontal = true) {
    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      if (horizontal) this._addLightPanel(x - width / 2 + width * t, z, 1.7, depth);
      else this._addLightPanel(x, z - depth / 2 + depth * t, 1.7, 0.48);
    }
  }

  _addSign(text, texture, x, y, z, rotationY, width = 4.2, height = 1.05) {
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      emissiveMap: texture,
      emissive: 0x2c9eb0,
      emissiveIntensity: 0.55,
      roughness: 0.28,
      metalness: 0.15,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotationY;
    mesh.castShadow = false;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    mesh.userData.label = text;
    this._addOwnedObject(mesh);
    return mesh;
  }

  _addPointLight(x, y, z, color, intensity, distance) {
    const light = new THREE.PointLight(color, intensity, distance, 2);
    light.position.set(x, y, z);
    this._addOwnedObject(light);
    return light;
  }

  _addDoorFrame(x, y, z, width, rotationY = 0) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotationY;

    const postMaterial = this.materials.wallAccent;
    const side = 0.14;
    const depth = 0.34;

    const leftPost = new THREE.Mesh(new THREE.BoxGeometry(side, 3.5, depth), postMaterial);
    leftPost.position.set(-width / 2, 0, 0);
    const rightPost = new THREE.Mesh(new THREE.BoxGeometry(side, 3.5, depth), postMaterial);
    rightPost.position.set(width / 2, 0, 0);
    const topBeam = new THREE.Mesh(new THREE.BoxGeometry(width + side * 2, side, depth), postMaterial);
    topBeam.position.set(0, 1.75, 0);

    const scanner = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.36, 0.14), this.materials.darkMetal);
    scanner.position.set(width / 2 + 0.12, 0.2, 0.18);
    const indicatorMat = new THREE.MeshStandardMaterial({
      color: 0x49d7e8,
      emissive: 0x24a7c0,
      emissiveIntensity: 1.2,
      roughness: 0.2,
    });
    const indicator = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.04), indicatorMat);
    indicator.position.set(width / 2 + 0.12, 0.2, 0.24);

    const panelWidth = width * 0.48;
    const leftPanel = new THREE.Mesh(new THREE.BoxGeometry(panelWidth, 3.4, 0.08), this.materials.doorGlass);
    leftPanel.position.set(-panelWidth / 2, 0, 0);
    const rightPanel = new THREE.Mesh(new THREE.BoxGeometry(panelWidth, 3.4, 0.08), this.materials.doorGlass);
    rightPanel.position.set(panelWidth / 2, 0, 0);

    const leftTrim = new THREE.Mesh(new THREE.BoxGeometry(0.06, 3.3, 0.1), this.materials.cyan);
    leftTrim.position.set(panelWidth / 2 - 0.04, 0, 0);
    leftPanel.add(leftTrim);

    const rightTrim = new THREE.Mesh(new THREE.BoxGeometry(0.06, 3.3, 0.1), this.materials.cyan);
    rightTrim.position.set(-panelWidth / 2 + 0.04, 0, 0);
    rightPanel.add(rightTrim);

    group.add(leftPost, rightPost, topBeam, scanner, indicator, leftPanel, rightPanel);
    this._addOwnedObject(group);

    const boxA = new THREE.Box3().setFromObject(leftPost);
    const boxB = new THREE.Box3().setFromObject(rightPost);
    this.colliders.push(boxA, boxB);

    this.doorSystem.addDoor({
      x,
      y,
      z,
      width,
      rotationY,
      group,
      leftPanel,
      rightPanel,
      indicatorMat,
      baseLeftX: -panelWidth / 2,
      baseRightX: panelWidth / 2,
      openAmount: 0,
      isOpen: false,
    });
  }

  _buildArchitecture() {
    this._addFloor(110, 92, 0, -18, this.materials.concrete, -0.08);

    this._addFloor(18, 11, 0, 3.5, this.materials.floor);
    this._addWallX(-9, -2, 9);
    this._addWallX(9, -2, 9);
    this._addWallZ(9, -9, 9);
    this._addWallZ(-2, -9, 9, [[-3, 3]]);

    this._addFloor(6, 8, 0, -6, this.materials.corridorFloor);
    this._addWallX(-3, -10, -2);
    this._addWallX(3, -10, -2);

    this._addFloor(20, 8, 0, -14, this.materials.floor);
    this._addWallX(-10, -18, -10, [[-15, -11]]);
    this._addWallX(10, -18, -10, [[-15, -11]]);
    this._addWallZ(-10, -10, 10, [[-3, 3]]);
    this._addWallZ(-18, -10, 10, [[-3, 3]]);

    this._addFloor(18, 4, -19, -13, this.materials.corridorFloor);
    this._addWallZ(-15, -28, -10);
    this._addWallZ(-11, -28, -10);

    this._addFloor(18, 4, 19, -13, this.materials.corridorFloor);
    this._addWallZ(-15, 10, 28);
    this._addWallZ(-11, 10, 28);

    this._addFloor(6, 12, 0, -24, this.materials.corridorFloor);
    this._addFloor(6, 4, 0, -32, this.materials.corridorFloor);
    this._addWallX(-3, -30, -18);
    this._addWallX(3, -30, -18);

    this._addFloor(25, 4, -15.5, -32, this.materials.corridorFloor);
    this._addWallZ(-34, -28, -3);
    this._addWallZ(-30, -28, -3);

    this._addFloor(25, 4, 15.5, -32, this.materials.corridorFloor);
    this._addWallZ(-34, 3, 28);
    this._addWallZ(-30, 3, 28);

    this._addFloor(12, 16, -34, -14, this.materials.floor);
    this._addWallX(-40, -22, -6);
    this._addWallX(-28, -22, -6, [[-15, -11]]);
    this._addWallZ(-22, -40, -28);
    this._addWallZ(-6, -40, -28);

    this._addFloor(12, 16, 34, -14, this.materials.floor);
    this._addWallX(40, -22, -6);
    this._addWallX(28, -22, -6, [[-15, -11]]);
    this._addWallZ(-22, 28, 40);
    this._addWallZ(-6, 28, 40);

    this._addFloor(12, 14, -34, -37, this.materials.grass);
    this._addWallX(-40, -44, -30);
    this._addWallX(-28, -44, -30, [[-34, -30]]);
    this._addWallZ(-44, -40, -28);
    this._addWallZ(-30, -40, -28);

    this._addFloor(12, 14, 34, -37, this.materials.grass);
    this._addWallX(40, -44, -30);
    this._addWallX(28, -44, -30, [[-34, -30]]);
    this._addWallZ(-44, 28, 40);
    this._addWallZ(-30, 28, 40);

    this._addWallX(-42, -47, 11);
    this._addWallX(42, -47, 11);
    this._addWallZ(11, -42, 42);
    this._addWallZ(-47, -42, 42, [[-3, 3]]);

    this._addDoorFrame(0, 2, -2.16, 6, 0);
    this._addDoorFrame(-10.16, 2, -13, 4, Math.PI / 2);
    this._addDoorFrame(10.16, 2, -13, 4, Math.PI / 2);
    this._addDoorFrame(0, 2, -18.16, 6, 0);
    this._addDoorFrame(-28.16, 2, -13, 4, Math.PI / 2);
    this._addDoorFrame(28.16, 2, -13, 4, Math.PI / 2);
    this._addDoorFrame(-28.16, 2, -32, 4, Math.PI / 2);
    this._addDoorFrame(28.16, 2, -32, 4, Math.PI / 2);
    this._addDoorFrame(0, 2, -46, 6, 0);

    this._addLightRow(0, 3.2, 12, 1, 5, true);
    this._addLightRow(0, -6, 1, 7, 4, false);
    this._addLightRow(0, -14, 16, 1, 5, true);
    this._addLightRow(-19, -13, 14, 1, 4, true);
    this._addLightRow(19, -13, 14, 1, 4, true);
    this._addLightRow(0, -24, 1, 10, 5, false);
    this._addLightRow(-15, -32, 20, 1, 6, true);
    this._addLightRow(15, -32, 20, 1, 6, true);
    this._addLightRow(-34, -14, 8, 1, 3, true);
    this._addLightRow(34, -14, 8, 1, 3, true);
    this._addLightRow(-34, -37, 8, 1, 3, true);
    this._addLightRow(34, -37, 8, 1, 3, true);

    this._addPointLight(0, 3.1, 3, 0xffe8bd, 8, 15);
    this._addPointLight(0, 3.1, -14, 0xc8efff, 8, 15);
    this._addPointLight(-34, 3, -14, 0xc7e9ff, 8, 14);
    this._addPointLight(34, 3, -14, 0xffddb1, 8, 14);
    this._addPointLight(-34, 3, -37, 0xb8f6a2, 7, 14);
    this._addPointLight(34, 3, -37, 0xd8f7a7, 7, 14);
  }

  _buildEntrance() {
    this._addSign('LABORATORIO', this.textures.labSign, 0, 3.05, -2.2, 0, 5.8, 1.25);
    this._addSign('ENTRADA', this.textures.entranceSign, 0, 2.65, 8.82, Math.PI, 3.4, 0.78);

    this._addBox(5.2, 0.9, 1.25, -4.7, 0.65, 4.4, this.materials.wood);
    this._addBox(1.05, 1.5, 1.1, -6.75, 0.75, 4.4, this.materials.wood);
    this._addBox(1.05, 1.5, 1.1, -2.65, 0.75, 4.4, this.materials.wood);
    this._addBox(3.4, 0.08, 0.9, -4.7, 1.14, 4.1, this.materials.cyan, false);
    this._addBox(1.8, 0.65, 0.1, -4.7, 1.35, 3.79, this.materials.darkMetal, true);
    this._addBox(1.45, 0.42, 0.04, -4.7, 1.36, 3.72, this.materials.cyan, false);

    this._addBench(5.5, 0.65, 5.7, 0);
    this._addBench(6.8, 0.65, -0.5, Math.PI / 2);
    this._addPlant(-7.2, 0, 6.7, 1.1);
    this._addPlant(7.1, 0, 6.6, 0.92);

    for (let i = 0; i < 5; i += 1) {
      this._addBox(
        0.72,
        0.035,
        0.22,
        0,
        0.025,
        0.9 - i * 0.7,
        i % 2 === 0 ? this.materials.amber : this.materials.cyan,
        false,
      );
    }
    this._addBox(0.06, 0.02, 7.5, -7.8, 0.02, 0.4, this.materials.cyan, false);
    this._addBox(0.06, 0.02, 7.5, 7.8, 0.02, 0.4, this.materials.cyan, false);
  }

  _addBench(x, y, z, rotationY) {
    const group = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.18, 0.55), this.materials.wood);
    seat.position.y = 1.1;
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.8, 0.14), this.materials.wood);
    back.position.set(0, 1.5, -0.2);
    group.add(seat, back);
    for (const legX of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.05, 0.35), this.materials.metal);
      leg.position.set(legX, 0.53, 0);
      group.add(leg);
    }
    group.position.set(x, y, z);
    group.rotation.y = rotationY;
    group.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    this._addOwnedObject(group);
    const box = new THREE.Box3().setFromObject(group);
    this.colliders.push(box);
  }

  _addPlant(x, y, z, scale = 1) {
    const group = new THREE.Group();
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.43, 0.55, 14),
      this.materials.ceramic || this.materials.white,
    );
    pot.position.y = 0.28;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.07, 1.35, 8), this.materials.bark);
    stem.position.y = 1.1;
    const leafA = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 7), this.materials.foliage);
    leafA.position.set(-0.25, 1.7, 0);
    const leafB = new THREE.Mesh(new THREE.SphereGeometry(0.44, 10, 7), this.materials.foliageLight);
    leafB.position.set(0.28, 1.9, 0.05);
    const leafC = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 7), this.materials.foliageDark);
    leafC.position.set(0, 2.15, -0.12);
    group.add(pot, stem, leafA, leafB, leafC);
    group.position.set(x, y, z);
    group.scale.setScalar(scale);
    group.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    this._addOwnedObject(group);
  }

  _buildMannequinWing() {
    this._addSign('ALA DE MANEQUINS', this.textures.mannequinsSign, -39.84, 3.05, -13, Math.PI / 2, 4.7, 0.92);
    const positions = [
      [-37.2, -18.5, 0],
      [-34, -18.5, 1],
      [-30.8, -18.5, 2],
      [-37.2, -13.9, 1],
      [-34, -13.9, 0],
      [-30.8, -13.9, 3],
      [-37.2, -9.2, 2],
      [-33.5, -9.2, 1],
    ];
    positions.forEach(([x, z, variant], index) => {
      this._addMannequin(x, z, variant, index % 3 === 0);
    });

    const monitorMaterial = new THREE.MeshStandardMaterial({
      map: this.textures.monitor,
      emissiveMap: this.textures.monitor,
      emissive: 0x23626d,
      emissiveIntensity: 1.1,
      roughness: 0.25,
      metalness: 0.1,
    });
    for (const z of [-19.7, -8.1]) {
      this._addBox(0.08, 1.3, 2.2, -39.72, 2.15, z, monitorMaterial, false);
      this._addBox(0.12, 0.14, 0.18, -39.55, 1.3, z, this.materials.metal, false);
    }
    this._addBox(7.4, 0.025, 0.055, -34, 0.03, -18.5, this.materials.cyan, false);
    this._addBox(7.4, 0.025, 0.055, -34, 0.03, -13.9, this.materials.cyan, false);
    this._addBox(7.4, 0.025, 0.055, -34, 0.03, -9.2, this.materials.cyan, false);
  }

  _addMannequin(x, z, variant, ring) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.43, 1.12, 12), this.materials.mannequin);
    body.position.y = 1.28;
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 8), this.materials.mannequin);
    chest.scale.set(1, 0.85, 0.75);
    chest.position.y = 1.58;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.31, 16, 10), this.materials.mannequin);
    head.position.y = 2.35;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.2, 10), this.materials.mannequinAccent);
    neck.position.y = 2.02;
    const legLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.9, 10), this.materials.mannequinAccent);
    const legRight = legLeft.clone();
    legLeft.position.set(-0.19, 0.5, 0);
    legRight.position.set(0.19, 0.5, 0);
    const armLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.9, 10), this.materials.mannequin);
    const armRight = armLeft.clone();
    armLeft.position.set(-0.53, 1.38, 0);
    armRight.position.set(0.53, 1.38, 0);
    armLeft.rotation.z = variant % 2 === 0 ? -0.25 : -1.05;
    armRight.rotation.z = variant % 2 === 0 ? 0.25 : 1.05;
    if (variant === 2) {
      armLeft.rotation.z = -1.45;
      armRight.rotation.z = 1.45;
    }
    if (variant === 3) {
      legLeft.rotation.z = -0.12;
      legRight.rotation.z = 0.12;
    }
    group.add(body, chest, head, neck, legLeft, legRight, armLeft, armRight);
    group.position.set(x, 0.22, z);
    group.rotation.y = variant * 0.25;
    group.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    this._addOwnedObject(group);

    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 0.22, 20), this.materials.darkMetal);
    pedestal.position.set(x, 0.11, z);
    pedestal.castShadow = true;
    pedestal.receiveShadow = true;
    pedestal.matrixAutoUpdate = false;
    pedestal.updateMatrix();
    this._addOwnedObject(pedestal);
    this.colliders.push(
      new THREE.Box3(new THREE.Vector3(x - 0.9, 0, z - 0.9), new THREE.Vector3(x + 0.9, 0.22, z + 0.9)),
    );
    this.colliders.push(
      new THREE.Box3(new THREE.Vector3(x - 0.62, 0.22, z - 0.5), new THREE.Vector3(x + 0.62, 2.7, z + 0.5)),
    );

    if (ring) {
      const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.035, 8, 32), this.materials.cyan);
      ringMesh.rotation.x = Math.PI / 2;
      ringMesh.position.set(x, 0.26, z);
      ringMesh.matrixAutoUpdate = false;
      ringMesh.updateMatrix();
      this._addOwnedObject(ringMesh);
    }
  }

  _buildObjectsWing() {
    this._addSign('ALA DE OBJETOS', this.textures.objectsSign, 39.84, 3.05, -13, -Math.PI / 2, 4.4, 0.92);

    const crates = [
      [30.4, 0.45, -19],
      [31.8, 0.45, -19],
      [31.1, 1.35, -19],
      [36.2, 0.45, -18.3],
      [37.5, 0.45, -18.3],
      [36.85, 1.35, -18.3],
      [30.8, 0.45, -8.6],
      [32.1, 0.45, -8.6],
      [36.8, 0.45, -8.8],
    ];
    this._addInstanced(
      new THREE.BoxGeometry(1.2, 0.82, 1.2),
      this.materials.wood,
      crates.map(([x, y, z], index) => ({ x, y, z, r: index % 2 ? 0.12 : -0.08 })),
      true,
    );

    const barrels = [
      [35, 0.58, -13.2],
      [36.1, 0.58, -13.3],
      [37.2, 0.58, -13.4],
      [35.5, 1.75, -13.3],
      [30.4, 0.58, -10.1],
    ];
    this._addInstanced(
      new THREE.CylinderGeometry(0.43, 0.43, 1.1, 16),
      this.materials.darkMetal,
      barrels.map(([x, y, z]) => ({ x, y, z })),
      true,
    );

    this._addTable(32.7, -13.1, 0);
    this._addTable(37.1, -9.4, Math.PI / 2);
    this._addBox(0.55, 0.4, 0.42, 32.5, 1.25, -13.15, this.materials.cyan, true);
    this._addBox(0.35, 0.65, 0.35, 33.15, 1.38, -13.05, this.materials.amber, true);
    this._addBox(0.6, 0.08, 0.6, 37.1, 1.3, -9.4, this.materials.red, true);

    this._addShelf(39.15, -18.6, Math.PI / 2);
    this._addShelf(39.15, -8.1, Math.PI / 2);
    this._addServerRack(28.9, -18.1);
    this._addServerRack(28.9, -8.7);

    const cones = [
      [33.7, 0.36, -18.2],
      [34.8, 0.36, -17],
      [35.9, 0.36, -15.8],
      [33.7, 0.36, -7.5],
      [34.8, 0.36, -8.7],
      [35.9, 0.36, -9.9],
    ];
    this._addInstanced(
      new THREE.ConeGeometry(0.28, 0.72, 12),
      this.materials.amber,
      cones.map(([x, y, z]) => ({ x, y, z })),
      true,
    );

    const monitorMaterial = new THREE.MeshStandardMaterial({
      map: this.textures.monitor,
      emissiveMap: this.textures.monitor,
      emissive: 0x356873,
      emissiveIntensity: 1.15,
      roughness: 0.25,
      metalness: 0.1,
    });
    for (let i = 0; i < 4; i += 1) {
      this._addBox(0.06, 1.25, 1.8, 39.72, 2.15, -19.2 + i * 3.6, monitorMaterial, false);
    }
  }

  _addInstanced(geometry, material, entries, collider = false) {
    geometry.computeBoundingBox();
    const mesh = new THREE.InstancedMesh(geometry, material, entries.length);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const helper = new THREE.Object3D();
    entries.forEach((entry, index) => {
      helper.position.set(entry.x, entry.y, entry.z);
      helper.rotation.set(entry.rx || 0, entry.r || 0, entry.rz || 0);
      helper.scale.set(entry.sx || 1, entry.sy || 1, entry.sz || 1);
      helper.updateMatrix();
      mesh.setMatrixAt(index, helper.matrix);
      if (collider) this.colliders.push(geometry.boundingBox.clone().applyMatrix4(helper.matrix));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    this._addOwnedObject(mesh);
    return mesh;
  }

  _addTable(x, z, rotationY) {
    const group = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.16, 1.25), this.materials.metal);
    top.position.y = 1.05;
    group.add(top);
    for (const px of [-1.05, 1.05]) {
      for (const pz of [-0.42, 0.42]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.05, 10), this.materials.darkMetal);
        leg.position.set(px, 0.52, pz);
        group.add(leg);
      }
    }
    group.position.set(x, 0, z);
    group.rotation.y = rotationY;
    group.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    this._addOwnedObject(group);
    this.colliders.push(new THREE.Box3().setFromObject(group));
  }

  _addShelf(x, z, rotationY) {
    const group = new THREE.Group();
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.3, 2.7), this.materials.darkMetal);
    back.position.y = 1.65;
    group.add(back);
    for (let y = 0.35; y < 3.4; y += 0.75) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 2.9), this.materials.metal);
      shelf.position.set(0, y, 0);
      group.add(shelf);
      const item = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.34, 0.45),
        y % 1.5 < 0.3 ? this.materials.amber : this.materials.cyan,
      );
      item.position.set(-0.15, y + 0.23, (y % 1.2) - 0.5);
      group.add(item);
    }
    group.position.set(x, 0, z);
    group.rotation.y = rotationY;
    group.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    this._addOwnedObject(group);
    this.colliders.push(new THREE.Box3().setFromObject(group));
  }

  _addServerRack(x, z) {
    this._addBox(1.05, 3.2, 1.25, x, 1.6, z, this.materials.darkMetal);
    for (let i = 0; i < 4; i += 1) {
      this._addBox(
        0.04,
        0.1,
        0.16,
        x - 0.54,
        0.65 + i * 0.62,
        z - 0.08,
        i % 2 ? this.materials.amber : this.materials.cyan,
        false,
      );
    }
  }

  _buildGreenWings() {
    this._addSign('FLORESTA SERENA', this.textures.forestSign, -39.84, 3.05, -37, Math.PI / 2, 4.6, 0.92);
    this._addSign('PRADO GENTIL', this.textures.meadowSign, 39.84, 3.05, -37, -Math.PI / 2, 4.2, 0.92);

    const forestTrees = [
      [-37.1, -41.2, 1.1],
      [-32.5, -41.1, 0.82],
      [-36.2, -35.6, 0.92],
      [-31.4, -34.3, 1.08],
    ];
    forestTrees.forEach(([x, z, scale]) => this._addTree(x, z, scale));
    const meadowTrees = [
      [31.2, -41.2, 0.95],
      [36.8, -41.4, 1.08],
      [32.2, -35, 0.82],
      [37, -34.2, 0.92],
    ];
    meadowTrees.forEach(([x, z, scale]) => this._addTree(x, z, scale));

    this._addGrass(-34, -37, 62, 1);
    this._addGrass(34, -37, 62, 2);
    this._addFlowers(-34, -37, 16, 3);
    this._addFlowers(34, -37, 18, 4);
    this._addBench(-31.2, 0.65, -38.1, Math.PI / 2);
    this._addBench(37.3, 0.65, -37.2, Math.PI / 2);

    const pond = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.05, 0.045, 36), this.materials.water);
    pond.position.set(35.2, 0.035, -40.1);
    pond.receiveShadow = true;
    pond.matrixAutoUpdate = false;
    pond.updateMatrix();
    this._addOwnedObject(pond);
    this.waterMeshes.push(pond);
    this._addBox(4.8, 0.05, 0.14, 35.2, 0.04, -37.7, this.materials.wood, false);
  }

  _addTree(x, z, scale = 1) {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.5, 2.5, 10), this.materials.bark);
    trunk.position.y = 1.25;
    const low = new THREE.Mesh(new THREE.ConeGeometry(1.45, 1.75, 10), this.materials.foliageDark);
    low.position.y = 2.1;
    const middle = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.65, 10), this.materials.foliage);
    middle.position.y = 3.1;
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.82, 1.5, 10), this.materials.foliageLight);
    top.position.y = 4.05;
    group.add(trunk, low, middle, top);
    group.position.set(x, 0, z);
    group.scale.setScalar(scale);
    group.rotation.y = (x * 0.8 + z) % 1.5;
    group.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    this._addOwnedObject(group);
    const r = 0.6 * scale;
    this.colliders.push(
      new THREE.Box3(new THREE.Vector3(x - r, 0, z - r), new THREE.Vector3(x + r, 2.8 * scale, z + r)),
    );
  }

  _addGrass(centerX, centerZ, count, seed) {
    const entries = [];
    const offsets = [];
    for (let i = 0; i < count; i += 1) {
      const angle = i * 2.399 + seed;
      const radius = 1.2 + (i % 9) * 0.48;
      const x = centerX + Math.cos(angle) * radius * 1.8;
      const z = centerZ + Math.sin(angle) * radius * 1.3;
      if (x < centerX - 5 || x > centerX + 5 || z < centerZ - 5.5 || z > centerZ + 5.5) continue;
      entries.push({ x, y: 0.36, z, r: (i * 0.71) % Math.PI, sx: 0.8 + (i % 4) * 0.12, sy: 0.8 + (i % 5) * 0.1 });
      offsets.push({
        x,
        y: 0.36,
        z,
        r: ((i * 0.71) % Math.PI) + Math.PI / 2,
        sx: 0.8 + (i % 4) * 0.12,
        sy: 0.8 + (i % 5) * 0.1,
      });
    }
    const geometry = new THREE.PlaneGeometry(0.24, 0.72);
    this._addInstanced(geometry, this.materials.grassBlade, entries, false);
    this._addInstanced(geometry, this.materials.grassBlade, offsets, false);
  }

  _addFlowers(centerX, centerZ, count, seed) {
    const stems = [];
    const heads = [];
    const colors = [this.materials.amber, this.materials.cyan, this.materials.red, this.materials.foliageLight];
    for (let i = 0; i < count; i += 1) {
      const angle = i * 2.17 + seed;
      const radius = 1.1 + (i % 5) * 0.74;
      const x = centerX + Math.cos(angle) * radius * 1.5;
      const z = centerZ + Math.sin(angle) * radius * 1.25;
      if (x < centerX - 4.8 || x > centerX + 4.8 || z < centerZ - 5 || z > centerZ + 5) continue;
      stems.push({ x, y: 0.28, z, sy: 0.7 + (i % 3) * 0.14 });
      heads.push({ x, y: 0.72 + (i % 3) * 0.14, z, sx: 0.7, sy: 0.7, sz: 0.7 });
    }
    this._addInstanced(new THREE.CylinderGeometry(0.025, 0.035, 0.7, 6), this.materials.foliage, stems, false);
    const headGeometry = new THREE.SphereGeometry(0.12, 8, 6);
    for (let i = 0; i < heads.length; i += 1) {
      this._addInstanced(headGeometry, colors[i % colors.length], [heads[i]], false);
    }
  }

  _buildTestingRoom() {
    this._addFloor(6, 12, 0, -40, this.materials.corridorFloor);
    this._addWallX(-3, -46, -34);
    this._addWallX(3, -46, -34);

    this._addWallX(-12, -64, -46);
    this._addWallX(12, -64, -46);
    this._addWallZ(-64, -12, 12);
    this._addWallZ(-46, -12, 12, [[-3, 3]]);

    this._addDoorFrame(0, 2, -46, 6, 0);

    const testSign = TextureGenerator.createSignageTexture('ARENA DE AREIA // CONFIRMED 42', {
      foreground: '#ffd36d',
      border: '#d77a26',
    });
    this._addSign('ARENA DE AREIA // CONFIRMED 42', testSign, 0, 3.1, -46.2, 0, 6.2, 1.1);

    // Clean Testing Room Floor Markings
    this._addBox(12.2, 0.02, 0.08, 0, 0.02, -51, this.materials.amber, false);
    this._addBox(12.2, 0.02, 0.08, 0, 0.02, -59, this.materials.amber, false);

    const boxTex = TextureGenerator.createCardboardBoxTexture();
    const boxMat = new THREE.MeshStandardMaterial({ map: boxTex, roughness: 0.8 });
    const rockTex = TextureGenerator.createRockTexture();
    const rockMat = new THREE.MeshStandardMaterial({ map: rockTex, roughness: 0.9, metalness: 0.1 });

    const paperTex = TextureGenerator.createPaperSheetTexture();
    const paperMat = this._ownMaterial(
      new THREE.MeshStandardMaterial({ map: paperTex, side: THREE.DoubleSide, roughness: 0.65 }),
    );
    const leafTex = TextureGenerator.createTreeLeafTexture();
    const leafMat = this._ownMaterial(
      new THREE.MeshStandardMaterial({ map: leafTex, side: THREE.DoubleSide, alphaTest: 0.15, roughness: 0.5 }),
    );

    // 1. Loose Paper Sheets (Ultra Light - Level 1 Target) - Positioned cleanly on floor (Y = 0.04)
    const paperPositions = [
      [-1.2, 0.04, -51],
      [0.8, 0.04, -52],
      [-2.5, 0.04, -54],
      [1.5, 0.04, -55],
      [-0.5, 0.04, -56],
    ];
    for (const [x, y, z] of paperPositions) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.72), paperMat.clone());
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = Math.random() * Math.PI * 2;
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = true;
      this._addOwnedObject(mesh);

      this.testObjectSystem.addObject({
        mesh,
        position: mesh.position,
        velocity: new THREE.Vector3(),
        mass: 0.15,
        type: 'folha_papel',
        name: 'Folha de Papel (Confirmed 42)',
      });
    }

    // 2. Tree Leaves (Ultra Light Organic - Level 1 Target) - Positioned cleanly on floor (Y = 0.04)
    const treeLeafPositions = [
      [-2.1, 0.04, -50],
      [2.2, 0.04, -51.5],
      [-1.8, 0.04, -55],
      [0.4, 0.04, -53],
      [2.7, 0.04, -56],
    ];
    for (const [x, y, z] of treeLeafPositions) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.58), leafMat.clone());
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = Math.random() * Math.PI * 2;
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = true;
      this._addOwnedObject(mesh);

      this.testObjectSystem.addObject({
        mesh,
        position: mesh.position,
        velocity: new THREE.Vector3(),
        mass: 0.08,
        type: 'folha_arvore',
        name: 'Folha de Árvore',
      });
    }

    // 3. Cardboard Boxes (Level 2+ Target)
    const cardboardPositions = [
      [-4.5, 0.45, -56],
      [-3.0, 0.45, -53],
      [-5.5, 0.45, -52],
    ];
    for (const [x, y, z] of cardboardPositions) {
      const geometry = new THREE.BoxGeometry(0.9, 0.9, 0.9);
      const mesh = new THREE.Mesh(geometry, boxMat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = true;
      this._addOwnedObject(mesh);

      this.testObjectSystem.addObject({
        mesh,
        position: mesh.position,
        velocity: new THREE.Vector3(),
        mass: 1.5,
        type: 'papelao',
        name: 'Papelão Leve (Confirmed 42)',
      });
    }

    // 4. Heavy Rocks (Level 5+ Target)
    const rockPositions = [
      [4.5, 0.65, -56],
      [3.2, 0.65, -53],
      [5.8, 0.65, -52],
    ];
    for (const [x, y, z] of rockPositions) {
      const geometry = new THREE.DodecahedronGeometry(0.65, 1);
      const mesh = new THREE.Mesh(geometry, rockMat);
      mesh.position.set(x, y, z);
      mesh.rotation.set(0.2, 0.5, 0);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = true;
      this._addOwnedObject(mesh);

      this.testObjectSystem.addObject({
        mesh,
        position: mesh.position,
        velocity: new THREE.Vector3(),
        mass: 25.0,
        type: 'pedra',
        name: 'Pedra Massiva (Confirmed 42)',
      });
    }

    this._addLightRow(0, -55, 16, 1, 6, true);
    this._addPointLight(0, 3.8, -55, 0xffb74d, 12, 22);
  }

  _buildAtmosphere() {
    const emblem = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.06, 8, 48), this.materials.cyan);
    emblem.rotation.x = Math.PI / 2;
    emblem.position.set(0, 0.035, -14);
    emblem.matrixAutoUpdate = false;
    emblem.updateMatrix();
    this._addOwnedObject(emblem);
    const core = new THREE.Mesh(new THREE.CircleGeometry(1.65, 32), this.materials.darkMetal);
    core.rotation.x = -Math.PI / 2;
    core.position.set(0, 0.025, -14);
    core.matrixAutoUpdate = false;
    core.updateMatrix();
    this._addOwnedObject(core);

    const hubLines = [
      [0, -10.7, 0.04, 6.5, this.materials.amber],
      [-7.2, -14, 5.2, 0.04, this.materials.cyan],
      [7.2, -14, 5.2, 0.04, this.materials.cyan],
      [0, -17.3, 0.04, 4.5, this.materials.amber],
    ];
    for (const [x, z, width, depth, mat] of hubLines) this._addBox(width, 0.025, depth, x, 0.03, z, mat, false);

    const vents = [-6, 6];
    for (const x of vents) {
      this._addBox(2.2, 0.05, 0.5, x, 3.98, -5.8, this.materials.darkMetal, false);
      this._addBox(0.08, 0.4, 0.08, x - 0.7, 3.68, -5.8, this.materials.cyan, false);
      this._addBox(0.08, 0.4, 0.08, x, 3.68, -5.8, this.materials.cyan, false);
      this._addBox(0.08, 0.4, 0.08, x + 0.7, 3.68, -5.8, this.materials.cyan, false);
    }
  }

  setSandVFX(sandVFX) {
    this.sandVFX = sandVFX;
    this.sandFootstepSystem?.setSandVFX?.(sandVFX);
  }

  triggerSandBlast(origin, power = 1) {
    if (this.disposed || !origin || !Number.isFinite(power)) return false;
    const safePower = Math.max(0, power);
    const radius = Math.min(3, 0.8 + safePower * 0.15);
    const depth = Math.min(0.2, 0.04 + safePower * 0.015);
    const accepted = this.sandTerrainSystem.brush(origin.x, origin.z, radius, depth, depth * 0.4, 0.35);
    if (accepted) this.sandVFX?.triggerSandBlastAt?.(origin.x, origin.z, safePower);
    return accepted;
  }

  /**
   * @param {number} delta
   * @param {{x: number, z: number}|null} playerPos
   * @param {{x: number, z: number}[]} [additionalPositions]
   * @param {object|null} [windSystem]
   * @param {{player?: object, windChild?: object}|null} [actors] - optional
   *   actor controllers exposing model.rotation.y, animPhase and foot anchors
   *   for detailed footprint placement
   */
  update(delta, playerPos = null, additionalPositions = EMPTY_POSITIONS, windSystem = null, actors = null) {
    this.time += delta;
    for (const mesh of this.waterMeshes) {
      if (mesh.material.map) {
        mesh.material.map.offset.x = (this.time * 0.025) % 1;
        mesh.material.map.offset.y = (this.time * 0.018) % 1;
      }
    }

    this._actors = actors ?? null;

    // Detailed alternating footprints (player + Wind Child) replace the
    // generic contact brushing for those actors; everything else stays on
    // the contact system (de-dup guaranteed by the dispatch below).
    this.sandContactSystem.beginFrame();
    this.sandFootstepSystem.beginFrame();
    if (playerPos) {
      if (this.sandFootstepSystem.hasDetailedFootprints('player')) {
        const player = this._actors?.player;
        const yaw = player?.model?.rotation?.y ?? 0;
        const phase = player ? player.animPhase / (2 * Math.PI) : null;
        this.sandFootstepSystem.updateActor('player', playerPos, yaw, delta, phase);
      } else {
        this.sandContactSystem.updateActor('player', playerPos, delta);
      }
    }
    for (let i = 0; i < additionalPositions.length && i < this.contactActorIds.length; i += 1) {
      if (i === 0) {
        if (this.sandFootstepSystem.hasDetailedFootprints('wind-child')) {
          const child = this._actors?.windChild;
          const yaw = child?.model?.rotation?.y ?? 0;
          this.sandFootstepSystem.updateActor('wind-child', additionalPositions[i], yaw, delta, null);
        } else {
          this.sandContactSystem.updateWake('wind-child', additionalPositions[i], delta);
        }
      } else {
        this.sandContactSystem.updateActor(this.contactActorIds[i], additionalPositions[i], delta);
      }
    }

    this.sandTerrainSystem.update(delta, this.time, playerPos, additionalPositions);

    const windChildPos = additionalPositions.length > 0 ? additionalPositions[0] : null;
    this.gpuSandSystem.update(delta, this.time, playerPos, windChildPos);

    this.testObjectSystem.update(delta, windSystem, this.sandTerrainSystem);

    if (playerPos) {
      this.doorSystem.update(delta, playerPos, additionalPositions);
    }
  }

  /**
   * @param {number} x
   * @param {number} z
   * @returns {string}
   */
  getRoomNameAt(x, z) {
    return getRoomAt(x, z)?.name ?? null;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.doorSystem.dispose();
    this.testObjectSystem.dispose();
    this.sandContactSystem?.dispose?.();
    this.sandFootstepSystem?.dispose?.();
    this.sandTerrainSystem?.dispose?.();
    this.gpuSandSystem?.dispose?.();
    this.root.removeFromParent();
    this.ownedGeometries.forEach((geometry) => geometry.dispose());
    this.ownedMaterials.forEach((material) => material.dispose());
    this.ownedTextures.forEach((texture) => texture.dispose());
    this.ownedGeometries.clear();
    this.ownedMaterials.clear();
    this.ownedTextures.clear();
  }
}
