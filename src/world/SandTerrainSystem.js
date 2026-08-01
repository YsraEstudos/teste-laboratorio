import * as THREE from 'three';
import { TextureGenerator } from './TextureGenerator.js';
import { SandDeformationField } from './SandDeformationField.js';
import { getSandQuality } from './SandQualityProfile.js';
import { SAND_BOUNDS, containsSandPoint } from './SandBounds.js';

/**
 * Sand Terrain System
 * Handles procedural elevation, mathematical collision generation and memory management.
 */
export class SandTerrainSystem {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene, { quality = 'high', textureSet = null, renderer = null } = {}) {
    this.scene = scene;
    this.quality = quality;
    this.profile = getSandQuality(quality);
    this.footprintCount = 0;
    this.lastUploadAt = null;
    this.sampleOut = { depth: 0, berm: 0, compression: 0 };

    // Phase 1: Base terrain mesh — dense, non-uniform topology so a
    // ~0.15 x 0.29 m footprint never collapses into a single visible quad.
    this.geometry = new THREE.PlaneGeometry(24, 18, this.profile.geometrySegments.x, this.profile.geometrySegments.z);
    this.geometry.rotateX(-Math.PI / 2);

    // Compact persistent field: no Canvas2D radial gradients or full canvas uploads.
    this.deformationField = new SandDeformationField({
      renderer,
      scene,
      width: this.profile.deformationResolution.width,
      height: this.profile.deformationResolution.height,
      minX: SAND_BOUNDS.minX,
      maxX: SAND_BOUNDS.maxX,
      minZ: SAND_BOUNDS.minZ,
      maxZ: SAND_BOUNDS.maxZ,
      maxDepth: 0.2,
      // Gradual recomposition: the mark stays clearly visible at ~60 s and is
      // almost recomposed by ~120 s (0.99833^900 ~= 0.22, 0.99833^1800 ~= 0.05).
      decayPerSecond: 0.025,
      maxBrushesPerFrame: this.profile.maxBrushesPerFrame,
      experimentalGpu: false,
    });
    this.depthTexture = this.deformationField.texture;

    // Phase 4: Uniforms for Custom Shader GLSL
    this.customUniforms = {
      uDeformationMap: { value: this.depthTexture },
      uDeformationScale: { value: this.deformationField.maxDepth },
      uTerrainBounds: {
        value: new THREE.Vector4(SAND_BOUNDS.minX, SAND_BOUNDS.maxX, SAND_BOUNDS.minZ, SAND_BOUNDS.maxZ),
      },
      uDeformationBermMap: { value: this.deformationField.bermTexture },
      uDeformationCompressionMap: { value: this.deformationField.compressionTexture },
    };

    this.textureSet = textureSet || TextureGenerator.acquireSandTextureSet({ quality });
    const { albedo: rawAlbedo, normal: rawNormal, roughness: rawRoughness } = this.textureSet;
    const albedoMap = rawAlbedo.clone();
    const normalMap = rawNormal.clone();
    const roughnessMap = rawRoughness.clone();
    albedoMap.repeat.set(8, 6);
    normalMap.repeat.set(8, 6);
    roughnessMap.repeat.set(8, 6);

    this.material = new THREE.MeshStandardMaterial({
      map: albedoMap,
      normalMap: normalMap,
      normalScale: new THREE.Vector2(1.3, 1.3),
      roughnessMap: roughnessMap,
      color: 0xe0ba7d,
      roughness: 0.85,
      metalness: 0.04,
      flatShading: false,
    });
    this.material.userData.sandDeformationAuthoritative = true;

    // Injeção de GLSL (Fase 4 e Fase 5)
    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.uDeformationMap = this.customUniforms.uDeformationMap;
      shader.uniforms.uDeformationScale = this.customUniforms.uDeformationScale;
      shader.uniforms.uTerrainBounds = this.customUniforms.uTerrainBounds;
      shader.uniforms.uDeformationBermMap = this.customUniforms.uDeformationBermMap;
      shader.uniforms.uDeformationCompressionMap = this.customUniforms.uDeformationCompressionMap;

      shader.vertexShader =
        `
        uniform sampler2D uDeformationMap;
        uniform sampler2D uDeformationBermMap;
        uniform float uDeformationScale;
        uniform vec4 uTerrainBounds;
        varying vec2 vWorldUv;
        varying vec3 vWorldPos;
      ` + shader.vertexShader;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        vec3 transformed = vec3( position );
        
        // Calcular UV do mundo real para o mapa de deformação
        vec4 wPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = wPos.xyz;
        
        float u = (wPos.x - uTerrainBounds.x) / (uTerrainBounds.y - uTerrainBounds.x);
        float v = (wPos.z - uTerrainBounds.z) / (uTerrainBounds.w - uTerrainBounds.z);
        vWorldUv = vec2(u, v);
        
        // Phase 5: Aplicar deslocamento vertical Y da areia
        float depth = texture2D(uDeformationMap, vWorldUv).r;
        float berm = texture2D(uDeformationBermMap, vWorldUv).r;
        transformed.y += (berm - depth) * uDeformationScale;
        `,
      );

      shader.fragmentShader =
        `
        uniform sampler2D uDeformationMap;
        uniform sampler2D uDeformationBermMap;
        uniform sampler2D uDeformationCompressionMap;
        varying vec2 vWorldUv;
      ` + shader.fragmentShader;

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `
        float printDepth = texture2D(uDeformationMap, vWorldUv).r;
        float berm = texture2D(uDeformationBermMap, vWorldUv).r;
        float compression = texture2D(uDeformationCompressionMap, vWorldUv).r;
        gl_FragColor.rgb *= 1.0 - printDepth * 0.32 + berm * 0.08;
        gl_FragColor.rgb *= 1.0 - compression * 0.06;
        #include <dithering_fragment>
        `,
      );
    };
    this.material.customProgramCacheKey = () => `sand-${this.profile.shaderCost}`;

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = this.profile.receiveShadow;
    // Positioned as requested
    this.mesh.position.set(0, 0, -55);

    // Phase 2: Procedural elevation algorithm
    this.applyProceduralElevation();

    this.scene.add(this.mesh);
    this._createStructuralMeshes();
  }

  /**
   * Fixed base (top at y = -0.75) plus four vertical perimeter walls only.
   * No per-cell volume, no per-footprint walls: the top surface remains the
   * only deformed part of the sand.
   */
  _createStructuralMeshes() {
    const shared = { castShadow: false, receiveShadow: this.profile.receiveShadow };
    this.structuralMaterial = new THREE.MeshStandardMaterial({
      color: 0xc8a878,
      roughness: 0.9,
      metalness: 0.04,
    });
    this.structuralMaterial.userData.sandStructural = true;

    // Base: 24 x 18 with its top at y = -0.75 (0.75 m below the top surface).
    this.baseMesh = new THREE.Mesh(new THREE.BoxGeometry(24, 0.02, 18), this.structuralMaterial);
    this.baseMesh.position.set(0, -0.76, -55);
    Object.assign(this.baseMesh, shared);
    this.scene.add(this.baseMesh);

    // Perimeter walls: 0.75 m tall (from base top up to the surface), inner
    // faces flush with the sand bounds. Centers are inset by half thickness
    // so the inner face sits exactly on min/max of each bound.
    const WALL_THICKNESS = 0.1;
    const HALF = WALL_THICKNESS / 2;
    const wallSpecs = [
      { size: [24, 0.76, WALL_THICKNESS], position: [0, -0.38, SAND_BOUNDS.minZ + HALF] },
      { size: [24, 0.76, WALL_THICKNESS], position: [0, -0.38, SAND_BOUNDS.maxZ - HALF] },
      { size: [WALL_THICKNESS, 0.76, 18], position: [SAND_BOUNDS.minX + HALF, -0.38, -55] },
      { size: [WALL_THICKNESS, 0.76, 18], position: [SAND_BOUNDS.maxX - HALF, -0.38, -55] },
    ];
    this.wallMeshes = wallSpecs.map(({ size, position }) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(...size), this.structuralMaterial);
      wall.position.set(...position);
      Object.assign(wall, shared);
      this.scene.add(wall);
      return wall;
    });
  }

  /**
   * Applies the procedural elevation to the geometry vertices
   */
  applyProceduralElevation() {
    const positions = this.geometry.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const z = positions[i + 2];

      const worldX = x + this.mesh.position.x;
      const worldZ = z + this.mesh.position.z;

      // Update Y coordinate based on elevation
      positions[i + 1] = this.getBaseElevationAt(worldX, worldZ);
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.computeVertexNormals();
  }

  /**
   * Phase 2 & 8: Mathematical calculation of exact Y height at any (x, z) coordinate.
   * Combination of diagonal wind waves + high-frequency noise (sharp wind ripples).
   * @param {number} x - Absolute world X coordinate
   * @param {number} z - Absolute world Z coordinate
   * @returns {number} Y elevation at this coordinate
   */
  getBaseElevationAt(x, z) {
    // Macro dunes: ondulações suaves e realistas para arena interna
    const diagDune1 = (x * 0.7 + z * 0.7) * 0.15;
    const diagDune2 = (x * -0.6 + z * 0.8) * 0.08;

    let height = Math.sin(diagDune1) * 0.08;
    height += Math.cos(diagDune2) * 0.07;

    // Micro cristas delicadas de areia (delicate wind ripples)
    const rippleFreq = 2.5;
    const ripplePhase = Math.sin(x * 0.3 + z * 0.4) * 1.5;
    const ripples = (1.0 - Math.abs(Math.sin((x * 0.8 + z * 0.6) * rippleFreq + ripplePhase))) * 0.025;

    height += ripples;

    // Phase 8: Blend de Transição de Borda (Edge Blending)
    let edgeBlend = 1.0;

    // Transição suave em x = ±12
    const absX = Math.abs(x);
    if (absX > 10.0) {
      edgeBlend *= Math.max(0, 1.0 - (absX - 10.0) / 2.0);
    }

    // Transição suave em z = -46 (porta) e z = -64 (fundo)
    if (z > -48.0) {
      edgeBlend *= Math.max(0, 1.0 - (z + 48.0) / 2.0);
    } else if (z < -62.0) {
      edgeBlend *= Math.max(0, 1.0 - (-62.0 - z) / 2.0);
    }

    height *= edgeBlend;

    return height;
  }

  getElevationAt(x, z) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return 0;
    const deformation = this.deformationField.sampleWorld(x, z, this.sampleOut);
    return this.getBaseElevationAt(x, z) + deformation.berm - deformation.depth;
  }

  /**
   * Phase 5: Stamps a footprint / depression on the sand.
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   * @param {number} depth
   */
  addFootprint(x, z, radius, depth = 0.12) {
    return this.brush(x, z, radius, depth, depth * 0.25, 0.7);
  }

  /**
   * Stamps an elongated, soft footprint oriented by yaw with a slight
   * heel/toe variation. Distinct from `brush`: it represents a boot contact
   * (dimensions, heading, depression + berm) instead of a generic mark.
   *
   * Consumes up to two brush slots of the per-frame budget and never
   * allocates. Returns false when out of bounds, invalid, or the brush
   * budget is exhausted (callers count it as a dropped contact).
   * @param {number} x
   * @param {number} z
   * @param {number} yaw - heading, same convention as SandContactSystem (atan2(dx, dz))
   * @param {{ width?: number, length?: number, depth?: number, berm?: number, compression?: number }} [options]
   * @returns {boolean}
   */
  applyFootprint(x, z, yaw, options = {}) {
    if (!containsSandPoint(x, z, 0.05)) return false;
    const width = options.width ?? 0.15;
    const length = options.length ?? 0.29;
    const depth = options.depth ?? 0.12;
    const berm = options.berm ?? 0.03;
    const compression = options.compression ?? 0.7;
    if (!(width > 0) || !(length > 0) || !(depth >= 0)) return false;

    // Forward = (sin(yaw), cos(yaw)); heel sits behind the anchor, toe ahead.
    const sinYaw = Math.sin(yaw);
    const cosYaw = Math.cos(yaw);
    const heelBack = length * 0.23;
    const toeForward = length * 0.2;
    const radius = width * 0.5;

    const heelAccepted = this.deformationField.brush(
      x - sinYaw * heelBack,
      z - cosYaw * heelBack,
      radius,
      depth,
      berm,
      compression,
      yaw,
      1.4,
      0,
    );
    const toeAccepted = this.deformationField.brush(
      x + sinYaw * toeForward,
      z + cosYaw * toeForward,
      radius,
      depth * 0.75,
      berm * 0.8,
      compression * 0.8,
      yaw,
      1.4,
      0,
    );
    if (heelAccepted || toeAccepted) {
      this.footprintCount += 1;
    }
    return heelAccepted || toeAccepted;
  }

  brush(x, z, radius, depth, berm = 0, compression = 0, yaw = 0, elongation = 1, edge = 0) {
    const stamped = this.deformationField.brush(x, z, radius, depth, berm, compression, yaw, elongation, edge);
    if (stamped) {
      this.footprintCount += 1;
    }
    return stamped;
  }

  sampleWorld(x, z) {
    return this.deformationField.sampleWorld(x, z);
  }

  serializeDeformation() {
    return this.deformationField.serialize();
  }

  restoreDeformation(snapshot) {
    return this.deformationField.restore(snapshot);
  }

  /**
   * Updates the shader uniforms and gradual recovery of the sand
   * @param {number} delta
   * @param {number} time
   */
  update(delta) {
    this.deformationField.advance(delta);
    if (this.customUniforms?.uDeformationMap) {
      this.customUniforms.uDeformationMap.value = this.deformationField.getTexture();
    }
    if (this.deformationField.consumeDirty()) {
      this.lastUploadAt = typeof performance !== 'undefined' ? performance.now() : 0;
    }
  }

  getDebugStats() {
    return {
      quality: this.quality,
      vertices: this.geometry.attributes.position.count,
      triangles: this.geometry.index ? this.geometry.index.count / 3 : this.geometry.attributes.position.count / 3,
      textureResolution: { width: this.deformationField.width, height: this.deformationField.height },
      deformationBytes:
        this.deformationField.data.byteLength +
        this.deformationField.bermData.byteLength +
        this.deformationField.compressionData.byteLength,
      authoritativeBytes:
        this.deformationField.data.byteLength +
        this.deformationField.bermData.byteLength +
        this.deformationField.compressionData.byteLength,
      backend: this.deformationField.backend,
      ...this.deformationField.getStats(),
      shaderFeatures: ['deformation', 'pbr-normal', 'pbr-roughness'],
      footprintCount: this.footprintCount,
      lastUploadAt: this.lastUploadAt,
    };
  }

  /**
   * Phase 2: Dynamic calculation of mesh normals
   */
  computeVertexNormals() {
    this.geometry.computeVertexNormals();
  }

  /**
   * Phase 3: Complete release of WebGL memory
   */
  dispose() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.geometry.dispose();
      if (this.material.map) this.material.map.dispose();
      if (this.material.normalMap) this.material.normalMap.dispose();
      if (this.material.roughnessMap) this.material.roughnessMap.dispose();
      this.material.dispose();
      this.deformationField?.dispose();
      this.textureSet?.release?.();
      this.textureSet = null;
      this.mesh = null;
    }
    if (this.baseMesh) {
      this.scene.remove(this.baseMesh);
      this.baseMesh.geometry.dispose();
      this.baseMesh = null;
    }
    if (this.wallMeshes) {
      for (const wall of this.wallMeshes) {
        this.scene.remove(wall);
        wall.geometry.dispose();
      }
      this.wallMeshes = [];
    }
    if (this.structuralMaterial) {
      this.structuralMaterial.dispose();
      this.structuralMaterial = null;
    }
  }
}
