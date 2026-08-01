import * as THREE from 'three';

/**
 * Sistema Avançado de Partículas de Areia GPGPU.
 * Utiliza texturas de ping-pong (FBOs) para simular física de areia na GPU.
 * Integração Verlet, Colisões Múltiplas por Esferas e Rendering via InstancedMesh ou Quads expandidos no vertex shader.
 */
export class GPUComputeSandSystem {
  /**
   * @param {THREE.WebGLRenderer} renderer - O renderizador WebGL.
   * @param {THREE.Scene} scene - A cena na qual o sistema será renderizado.
   */
  constructor(renderer, scene, { enabled = false, quality = 'high' } = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.disposed = false;
    const supportsFloatTargets = !renderer?.extensions || renderer.extensions.has?.('EXT_color_buffer_float');

    // This path is experimental. A renderer alone is never permission to
    // allocate hundreds of thousands of particles or render targets.
    if (!enabled || !this.renderer?.capabilities?.isWebGL2 || !supportsFloatTargets) {
      this.isHeadless = true;
      return;
    }

    this.isHeadless = false;
    this.WIDTH = quality === 'low' ? 64 : 128;
    this.PARTICLES = this.WIDTH * this.WIDTH;

    this._initGPGPU();
    this._initParticles();

    this.time = 0;
    this.spheres = [];
    this.sphereData = Array.from({ length: 16 }, () => new THREE.Vector4());
  }

  _initGPGPU() {
    // Configura os render targets para ping-pong (posTexture e oldPosTexture)
    const options = {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType, // Necessário FloatType para posições globais exatas
      depthBuffer: false,
      stencilBuffer: false,
    };

    this.rt1 = new THREE.WebGLRenderTarget(this.WIDTH, this.WIDTH, options);
    this.rt2 = new THREE.WebGLRenderTarget(this.WIDTH, this.WIDTH, options);

    // Preenche texturas iniciais
    this._fillInitialData(this.rt1);
    this._fillInitialData(this.rt2);

    // Câmera e cena ortográfica para computação FBO
    this.gpgpuCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.gpgpuScene = new THREE.Scene();

    // Shader de simulação (Verlet e colisões)
    this.simulationMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uCurrentPosTex: { value: this.rt1.texture },
        uOldPosTex: { value: this.rt2.texture },
        uDeltaTime: { value: 0.016 },
        uTime: { value: 0 },
        uSpheres: { value: [] }, // x,y,z = center, w = radius
        uSphereCount: { value: 0 },
        uSandBlastOrigin: { value: new THREE.Vector3(0, 0, 0) },
        uSandBlastPower: { value: 0.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uCurrentPosTex;
        uniform sampler2D uOldPosTex;
        uniform float uDeltaTime;
        uniform float uTime;
        
        // Colisões
        uniform vec4 uSpheres[16];
        uniform int uSphereCount;
        
        // Explosão de areia
        uniform vec3 uSandBlastOrigin;
        uniform float uSandBlastPower;
        
        varying vec2 vUv;
        
        // Hash / Noise simples
        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }
        
        void main() {
          vec4 currentData = texture2D(uCurrentPosTex, vUv);
          vec3 currentPos = currentData.xyz;
          float collisionTime = currentData.w;
          
          vec4 oldData = texture2D(uOldPosTex, vUv);
          vec3 oldPos = oldData.xyz;
          float mass = oldData.w; // Pode variar entre partículas
          
          float dt = uDeltaTime;
          
          // Integração Verlet
          // atrito/resistência do ar
          vec3 delta = (currentPos - oldPos) * 0.97;
          
          // gravidade
          vec3 next = currentPos + delta + vec3(0.0, -9.8 * dt * dt, 0.0);
          
          collisionTime += dt; // envelhecimento do impacto
          
          // Colisão com esferas dinâmicas
          for(int i = 0; i < 16; i++) {
            if(i >= uSphereCount) break;
            vec3 center = uSpheres[i].xyz;
            float radius = uSpheres[i].w;
            vec3 dir = next - center;
            float dist = length(dir);
            if(dist < radius) {
              next = center + normalize(dir) * radius;
              collisionTime = 0.0;
            }
          }
          
          // Sand Blast
          if (uSandBlastPower > 0.0) {
            vec3 blastDir = next - uSandBlastOrigin;
            float blastDist = length(blastDir);
            if(blastDist < 5.0) { // Raio da explosão
               float force = (5.0 - blastDist) / 5.0 * uSandBlastPower;
               next += normalize(blastDir) * force * dt;
               collisionTime = 0.0;
            }
          }
          
          // Chão / Dunas (Arena Restraint)
          // Relevo simplificado (Z = [-64, -46], X = [-12, 12])
          float groundY = 0.0; // Y base
          if (next.y < groundY) {
             next.y = groundY;
             // Pequeno bounce aleatório e atrito maior no chão
             next.x -= delta.x * 0.2;
             next.z -= delta.z * 0.2;
             
             // Se saiu muito da arena, reposiciona no céu ou área central
             if (next.x < -12.0 || next.x > 12.0 || next.z < -64.0 || next.z > -46.0) {
                float randX = mix(-12.0, 12.0, hash(vUv + uTime));
                float randZ = mix(-64.0, -46.0, hash(vUv * 2.0 + uTime));
                next = vec3(randX, mix(10.0, 15.0, hash(vUv * 3.0)), randZ);
                currentPos = next; // Zera a velocidade resetando a posição
             }
          }
          
          // Retorna na Textura 1 o novo pos e collisionTime
          // O FBO ping-pong inverte os buffers no JS, então oldData se tornará os próximos oldData.
          gl_FragColor = vec4(next, collisionTime);
        }
      `,
    });

    this.gpgpuMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.simulationMaterial);
    this.gpgpuScene.add(this.gpgpuMesh);

    // Variável para flip-flop do buffer de ping-pong
    this.pingPong = 0;
  }

  _fillInitialData(renderTarget) {
    const data = new Float32Array(this.PARTICLES * 4);
    for (let i = 0; i < this.PARTICLES; i++) {
      const i4 = i * 4;
      const x = (Math.random() - 0.5) * 24.0; // [-12, 12]
      const y = Math.random() * 15.0; // [0, 15]
      const z = -55.0 + (Math.random() - 0.5) * 18.0; // [-64, -46]

      data[i4 + 0] = x;
      data[i4 + 1] = y;
      data[i4 + 2] = z;
      data[i4 + 3] = 1.0; // W: collisionTime ou massa (ambos inicializados para não dar artefatos)
    }

    const texture = new THREE.DataTexture(data, this.WIDTH, this.WIDTH, THREE.RGBAFormat, THREE.FloatType);
    texture.needsUpdate = true;

    // Renderizamos a textura no RenderTarget usando um passo rápido
    const rtCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const rtScene = new THREE.Scene();
    const rtMaterial = new THREE.MeshBasicMaterial({ map: texture });
    rtScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), rtMaterial));

    this.renderer.setRenderTarget(renderTarget);
    this.renderer.render(rtScene, rtCamera);
    this.renderer.setRenderTarget(null);

    texture.dispose();
    rtMaterial.dispose();
    rtScene.children[0].geometry.dispose();
  }

  _initParticles() {
    // Geometria Instanciada
    const baseGeometry = new THREE.PlaneGeometry(0.04, 0.04);
    this.baseGeometry = baseGeometry;

    this.particleGeometry = new THREE.InstancedBufferGeometry();
    this.particleGeometry.index = baseGeometry.index;
    this.particleGeometry.attributes.position = baseGeometry.attributes.position;
    this.particleGeometry.attributes.uv = baseGeometry.attributes.uv;

    // IDs das partículas mapeadas para a textura GPGPU
    const uvsGPGPU = new Float32Array(this.PARTICLES * 2);
    let idx = 0;
    for (let j = 0; j < this.WIDTH; j++) {
      for (let i = 0; i < this.WIDTH; i++) {
        uvsGPGPU[idx++] = i / (this.WIDTH - 1);
        uvsGPGPU[idx++] = j / (this.WIDTH - 1);
      }
    }
    this.particleGeometry.setAttribute('aGPGPU_UV', new THREE.InstancedBufferAttribute(uvsGPGPU, 2));
    this.particleGeometry.instanceCount = this.PARTICLES;

    // Shader de renderização (Billboard Quads & Dynamic Color Transition)
    this.particleMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uPositionTex: { value: null },
        uTime: { value: 0 },
      },
      vertexShader: `
        uniform sampler2D uPositionTex;
        attribute vec2 aGPGPU_UV;
        
        varying float vCollisionTime;
        varying vec2 vUv;
        varying vec3 vWorldPosition;
        
        void main() {
          vUv = uv;
          vec4 texData = texture2D(uPositionTex, aGPGPU_UV);
          vec3 pos = texData.xyz;
          vCollisionTime = texData.w;
          
          vWorldPosition = pos;
          
          // Expansão de quads alinhados para a câmera (Billboard)
          // Matriz de visualização afeta apenas a rotação do quad
          vec3 cameraRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
          vec3 cameraUp    = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
          
          vec3 vertexPos = position.x * cameraRight + position.y * cameraUp;
          vec3 finalPos = pos + vertexPos;
          
          gl_Position = projectionMatrix * viewMatrix * vec4(finalPos, 1.0);
        }
      `,
      fragmentShader: `
        varying float vCollisionTime;
        varying vec2 vUv;
        varying vec3 vWorldPosition;
        uniform float uTime;
        
        // Pseudo random para micro-brilhos especulares (Sparkles)
        float rand(vec2 co){
            return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
        }
        
        void main() {
          // Circular particle
          float dist = length(vUv - vec2(0.5));
          if(dist > 0.5) discard;
          
          // Interpolação de cor
          // Areia dourada para âmbar aquecido
          vec3 colorBase = mix(vec3(1.0, 0.62, 0.20), vec3(0.91, 0.74, 0.44), clamp(vCollisionTime / 3.0, 0.0, 1.0));
          
          // Sparkles - brilhos especulares nos grãos expostos
          float sparkle = step(0.98, rand(vWorldPosition.xz * 100.0 + uTime * 0.1)) * clamp(1.0 - vCollisionTime, 0.0, 1.0);
          colorBase += vec3(sparkle * 0.5);
          
          // Sombreamento esférico falso nas bordas
          colorBase *= (1.0 - dist * 0.8);
          
          gl_FragColor = vec4(colorBase, 1.0);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    this.particleMesh = new THREE.Mesh(this.particleGeometry, this.particleMaterial);
    // Impede o culling, a bounding box não funciona porque as posições estão na GPU
    this.particleMesh.frustumCulled = false;
    this.scene.add(this.particleMesh);
  }

  /**
   * Atualiza a física de partículas a cada frame.
   * @param {number} delta - Tempo delta desde o último frame.
   * @param {number} time - Tempo total decorrido.
   * @param {THREE.Vector3} playerPos - Posição do jogador.
   * @param {THREE.Vector3} windChildPos - Posição do "wind child" ou outra entidade importante.
   * @param {Array<{position: THREE.Vector3, radius: number}>} spheres - Objetos esféricos dinâmicos para colisão.
   */
  update(delta, time, playerPos, windChildPos, spheres = null) {
    if (this.isHeadless) return;

    // Atualiza uniformes do shader de simulação
    this.time += delta;
    this.simulationMaterial.uniforms.uTime.value = this.time;
    this.simulationMaterial.uniforms.uDeltaTime.value = Math.min(delta, 0.05); // Cap delta time for stability

    // Atualiza esferas de colisão (limite 16)
    const sphereData = this.sphereData;
    let sphereCount = 0;
    // Jogador e filho do vento podem ser adicionados como esferas
    if (playerPos) sphereData[sphereCount++].set(playerPos.x, playerPos.y, playerPos.z, 0.5);
    if (windChildPos && sphereCount < 16)
      sphereData[sphereCount++].set(windChildPos.x, windChildPos.y, windChildPos.z, 0.4);

    for (let i = 0; spheres && i < spheres.length && sphereCount < 16; i++) {
      const s = spheres[i];
      sphereData[sphereCount++].set(s.position.x, s.position.y, s.position.z, s.radius);
    }

    this.simulationMaterial.uniforms.uSpheres.value = sphereData;
    this.simulationMaterial.uniforms.uSphereCount.value = sphereCount;

    // Decai gradualmente a força da rajada (Blast)
    if (this.simulationMaterial.uniforms.uSandBlastPower.value > 0) {
      this.simulationMaterial.uniforms.uSandBlastPower.value -= delta * 5.0; // Decay rate
      if (this.simulationMaterial.uniforms.uSandBlastPower.value < 0) {
        this.simulationMaterial.uniforms.uSandBlastPower.value = 0;
      }
    }

    // Executa a computação Ping-Pong
    const readRT = this.pingPong === 0 ? this.rt1 : this.rt2;
    const writeRT = this.pingPong === 0 ? this.rt2 : this.rt1;

    // No próximo passo da integração, a nova posição será baseada na atual e antiga.
    // oldPos (antiga) <- texture2D(uOldPosTex)
    // currentPos (atual) <- texture2D(uCurrentPosTex)
    this.simulationMaterial.uniforms.uCurrentPosTex.value = readRT.texture;

    // No primeiro frame rt1 e rt2 são iguais.
    // Aqui usamos rt2 como oldPos no início. Uma heurística melhor GPGPU Verlet:
    // Nós podemos manter RTs em fila, mas para ping-pong simplificado e eficiente, passamos
    // a render target anterior que não está sendo escrita.
    this.simulationMaterial.uniforms.uOldPosTex.value = writeRT.texture;

    // Renderiza cena GPGPU
    this.renderer.setRenderTarget(writeRT);
    this.renderer.render(this.gpgpuScene, this.gpgpuCamera);
    this.renderer.setRenderTarget(null);

    // Atualiza textura de renderização
    this.particleMaterial.uniforms.uPositionTex.value = writeRT.texture;
    this.particleMaterial.uniforms.uTime.value = this.time;

    // Flip buffer
    this.pingPong = 1 - this.pingPong;
  }

  triggerSandBlast(origin, power = 1.0) {
    if (this.isHeadless || !origin) return;
    if (this.simulationMaterial?.uniforms) {
      this.simulationMaterial.uniforms.uSandBlastOrigin.value.copy(origin);
      this.simulationMaterial.uniforms.uSandBlastPower.value = power;
    }
  }

  dispose() {
    if (this.disposed || this.isHeadless) return;
    this.disposed = true;
    if (this.particleMesh) {
      this.scene.remove(this.particleMesh);
      if (this.particleMesh.geometry) this.particleMesh.geometry.dispose();
      if (this.particleMesh.material) this.particleMesh.material.dispose();
    }
    this.baseGeometry?.dispose?.();
    if (this.rt1) this.rt1.dispose();
    if (this.rt2) this.rt2.dispose();
  }
}
