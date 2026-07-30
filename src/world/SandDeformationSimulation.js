import * as THREE from 'three';

/**
 * Small, allocation-free ping-pong target used by the WebGL2 sand path.
 * The CPU field remains authoritative for collision sampling; this pass is
 * deliberately isolated so the renderer can consume the same brush stream.
 */
export class SandDeformationSimulation {
    constructor({ renderer, scene = new THREE.Scene(), resolution = 256 } = {}) {
        this.renderer = renderer;
        this.scene = scene;
        this.resolution = resolution;
        this.writeIndex = 0;
        this.brushCount = 0;
        this.brushData = new Float32Array(96 * 2 * 4);
        this.brushTexture = new THREE.DataTexture(this.brushData, 96, 2, THREE.RGBAFormat, THREE.FloatType);
        this.brushTexture.minFilter = THREE.NearestFilter;
        this.brushTexture.magFilter = THREE.NearestFilter;
        this.brushTexture.generateMipmaps = false;
        this.brushTexture.needsUpdate = true;

        const targetOptions = {
            type: THREE.HalfFloatType,
            format: THREE.RGBAFormat,
            depthBuffer: false,
            stencilBuffer: false,
        };
        this.renderTargets = [
            new THREE.WebGLRenderTarget(resolution, resolution, targetOptions),
            new THREE.WebGLRenderTarget(resolution, resolution, targetOptions),
        ];
        for (const target of this.renderTargets) {
            target.texture.minFilter = THREE.LinearFilter;
            target.texture.magFilter = THREE.LinearFilter;
            target.texture.generateMipmaps = false;
        }

        this.geometry = new THREE.PlaneGeometry(2, 2);
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uPrevious: { value: this.renderTargets[0].texture },
                uBrushes: { value: this.brushTexture },
                uBrushCount: { value: 0 },
                uDecay: { value: 1 },
                uBounds: { value: new THREE.Vector4(-12, 12, -64, -46) },
                uMaxDepth: { value: 0.2 },
            },
            vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }',
            fragmentShader: `
                uniform sampler2D uPrevious;
                uniform sampler2D uBrushes;
                uniform int uBrushCount;
                uniform float uDecay;
                uniform vec4 uBounds;
                uniform float uMaxDepth;
                varying vec2 vUv;
                void main() {
                    vec3 state = texture2D(uPrevious, vUv).rgb * uDecay;
                    vec2 world = vec2(
                        mix(uBounds.x, uBounds.y, vUv.x),
                        mix(uBounds.z, uBounds.w, vUv.y)
                    );
                    for (int i = 0; i < 96; i++) {
                        if (i >= uBrushCount) break;
                        float u = (float(i) + 0.5) / 96.0;
                        vec4 shape = texture2D(uBrushes, vec2(u, 0.25));
                        vec4 material = texture2D(uBrushes, vec2(u, 0.75));
                        vec2 delta = world - shape.xy;
                        float c = cos(material.z);
                        float s = sin(material.z);
                        vec2 local = vec2(
                            delta.x * c + delta.y * s,
                            -delta.x * s + delta.y * c
                        );
                        local.x /= max(shape.z * material.w, 0.001);
                        local.y /= max(shape.z, 0.001);
                        float d = length(local);
                        if (d > 1.0) continue;
                        float t = clamp(d, 0.0, 1.0);
                        float falloff = 1.0 - t * t * (3.0 - 2.0 * t);
                        state.r = max(state.r, clamp(shape.w / uMaxDepth, 0.0, 1.0) * falloff);
                        state.g = max(state.g, clamp(material.x / uMaxDepth, 0.0, 1.0) * (0.2 + 0.8 * falloff));
                        state.b = max(state.b, clamp(material.y, 0.0, 1.0) * falloff);
                    }
                    gl_FragColor = vec4(state, 1.0);
                }
            `,
            depthWrite: false,
            depthTest: false,
        });
        this.passScene = new THREE.Scene();
        this.passScene.add(new THREE.Mesh(this.geometry, this.material));
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.publishedTarget = this.renderTargets[0];
        const previousTarget = this.renderer?.getRenderTarget?.() ?? null;
        for (const target of this.renderTargets) {
            this.renderer?.setRenderTarget?.(target);
            this.renderer?.clear?.(true, false, false);
        }
        this.renderer?.setRenderTarget?.(previousTarget);
        this.disposed = false;
    }

    queueBrush(x, z, radius, depth, berm = 0, compression = 0, yaw = 0, elongation = 1, edge = 0) {
        if (this.brushCount >= 96) return false;
        const offset = this.brushCount * 4;
        const materialOffset = (96 + this.brushCount) * 4;
        this.brushData[offset] = x;
        this.brushData[offset + 1] = z;
        this.brushData[offset + 2] = radius;
        this.brushData[offset + 3] = depth;
        this.brushData[materialOffset] = berm;
        this.brushData[materialOffset + 1] = compression;
        this.brushData[materialOffset + 2] = yaw;
        this.brushData[materialOffset + 3] = elongation;
        void edge;
        this.brushCount += 1;
        this.brushTexture.needsUpdate = true;
        return true;
    }

    update(delta = 1 / 15) {
        if (this.disposed || !this.renderer) return false;
        const readTarget = this.publishedTarget;
        const writeTarget = this.renderTargets[this.writeIndex === 0 ? 1 : 0];
        const previousTarget = this.renderer.getRenderTarget?.() ?? null;
        this.material.uniforms.uPrevious.value = readTarget.texture;
        this.material.uniforms.uBrushCount.value = this.brushCount;
        this.material.uniforms.uDecay.value = Math.max(0, 1 - 0.1 * delta);
        this.renderer.setRenderTarget(writeTarget);
        this.renderer.render(this.passScene, this.camera);
        this.renderer.setRenderTarget(previousTarget);
        this.publishedTarget = writeTarget;
        this.writeIndex = this.writeIndex === 0 ? 1 : 0;
        this.brushCount = 0;
        return true;
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        for (const target of this.renderTargets) target.dispose();
        this.brushTexture.dispose();
        this.material.dispose();
        this.geometry.dispose();
    }
}
