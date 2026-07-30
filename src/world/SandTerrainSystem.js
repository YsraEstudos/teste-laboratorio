import * as THREE from 'three';
import { TextureGenerator } from './TextureGenerator.js';
import { SandDeformationField } from './SandDeformationField.js';

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
    this.footprintCount = 0;
    this.lastUploadAt = null;
    
    // Phase 1: Base terrain mesh
    this.geometry = new THREE.PlaneGeometry(24, 18, 128, 128);
    this.geometry.rotateX(-Math.PI / 2);
    
    // Compact persistent field: no Canvas2D radial gradients or full canvas uploads.
    this.deformationField = new SandDeformationField({
      renderer,
      scene,
      minX: -12,
      maxX: 12,
      minZ: -64,
      maxZ: -46,
      maxDepth: 0.2,
      decayPerSecond: 0.1,
    });
    this.depthTexture = this.deformationField.texture;

    // Phase 4: Uniforms for Custom Shader GLSL
    this.customUniforms = {
      uTime: { value: 0 },
      uSparkleIntensity: { value: 1.2 },
      uSparkleScale: { value: 90.0 },
      uDeformationMap: { value: this.depthTexture },
      uDeformationScale: { value: this.deformationField.maxDepth },
      uTerrainBounds: { value: new THREE.Vector4(-12, 12, -64, -46) } // minX, maxX, minZ, maxZ
    };
    
    this.textureSet = textureSet || TextureGenerator.acquireSandTextureSet({ quality });
    const { albedo: albedoMap, normal: normalMap, roughness: roughnessMap } = this.textureSet;
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
      flatShading: false
    });

    // Injeção de GLSL (Fase 4 e Fase 5)
    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.customUniforms.uTime;
      shader.uniforms.uSparkleIntensity = this.customUniforms.uSparkleIntensity;
      shader.uniforms.uSparkleScale = this.customUniforms.uSparkleScale;
      shader.uniforms.uDeformationMap = this.customUniforms.uDeformationMap;
      shader.uniforms.uDeformationScale = this.customUniforms.uDeformationScale;
      shader.uniforms.uTerrainBounds = this.customUniforms.uTerrainBounds;

      shader.vertexShader = `
        uniform sampler2D uDeformationMap;
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
        transformed.y -= depth * uDeformationScale;
        `
      );

      shader.fragmentShader = `
        uniform float uTime;
        uniform float uSparkleIntensity;
        uniform float uSparkleScale;
        uniform sampler2D uDeformationMap;
        varying vec2 vWorldUv;
        varying vec3 vWorldPos;

        // Simple 3D noise for sparkles
        float hash31(vec3 p3) {
          p3  = fract(p3 * .1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }
      ` + shader.fragmentShader;

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `
        #include <dithering_fragment>
        
        // Phase 4: Micro-Brilhos (Sparkles) baseados no vetor de visão
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        
        // Brilho dependente do movimento da câmera (cintilação)
        float sparkleNoise = hash31(floor(vWorldPos * uSparkleScale) + floor(viewDir * 12.0));
        float isSparkle = step(0.992, sparkleNoise); // Apenas alguns grãos brilham
        
        // Reluzir elegantemente com base no ângulo de visão
        float viewFactor = dot(viewDir, vec3(0.0, 1.0, 0.0));
        float sparkleAmount = isSparkle * uSparkleIntensity * pow(max(0.0, viewFactor), 2.0);
        
        float printDepth = texture2D(uDeformationMap, vWorldUv).r;
        if (printDepth > 0.01) {
          gl_FragColor.rgb *= (1.0 - printDepth * 0.45);
          sparkleAmount *= 0.1; // Reduz os micro-brilhos no rastro
        }

        // Adição sutil e quente de brilho
        gl_FragColor.rgb += vec3(1.0, 0.9, 0.7) * sparkleAmount;
        `
      );
    };
    
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    // Positioned as requested
    this.mesh.position.set(0, 0, -55);
    
    // Phase 2: Procedural elevation algorithm
    this.applyProceduralElevation();
    
    this.scene.add(this.mesh);
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
      positions[i + 1] = this.getElevationAt(worldX, worldZ);
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
  getElevationAt(x, z) {
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

  brush(x, z, radius, depth, berm = 0, compression = 0, yaw = 0, elongation = 1, edge = 0) {
    const stamped = this.deformationField.brush(x, z, radius, depth, berm, compression, yaw, elongation, edge);
    if (stamped) {
      this.footprintCount += 1;
      this.lastUploadAt = typeof performance !== 'undefined' ? performance.now() : 0;
    }
    return stamped;
  }

  sampleWorld(x, z) {
    return this.deformationField.sampleWorld(x, z);
  }

  /**
   * Updates the shader uniforms and gradual recovery of the sand
   * @param {number} delta 
   * @param {number} time 
   */
  update(delta, time) {
    if (this.customUniforms) {
      this.customUniforms.uTime.value = time;
    }
    
    this.deformationField.advance(delta);
    if (this.deformationField.consumeDirty()) {
      this.lastUploadAt = typeof performance !== 'undefined' ? performance.now() : 0;
    }
  }

  getDebugStats() {
    return {
      quality: this.quality,
      vertices: this.geometry.attributes.position.count,
      triangles: this.geometry.index ? this.geometry.index.count / 3 : this.geometry.attributes.position.count / 3,
      textureResolution: this.deformationField.resolution,
      deformationBytes: this.deformationField.data.byteLength,
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
      this.material.dispose();
      this.deformationField?.dispose();
      this.textureSet?.release?.();
      this.textureSet = null;
      this.mesh = null;
    }
  }
}
