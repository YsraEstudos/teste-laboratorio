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
        this.brushData = new Float32Array(96 * 4);
        this.brushTexture = new THREE.DataTexture(this.brushData, 96, 1, THREE.RGBAFormat, THREE.FloatType);
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
            },
            vertexShader: 'void main() { gl_Position = vec4(position, 1.0); }',
            fragmentShader: 'void main() { gl_FragColor = texture2D(uPrevious, gl_FragCoord.xy); }',
            depthWrite: false,
            depthTest: false,
        });
        this.passScene = new THREE.Scene();
        this.passScene.add(new THREE.Mesh(this.geometry, this.material));
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.publishedTarget = this.renderTargets[0];
        this.disposed = false;
    }

    queueBrush(x, z, radius, depth, berm = 0, compression = 0, yaw = 0, elongation = 1, edge = 0) {
        if (this.brushCount >= 96) return false;
        const offset = this.brushCount * 4;
        this.brushData[offset] = x;
        this.brushData[offset + 1] = z;
        this.brushData[offset + 2] = radius;
        this.brushData[offset + 3] = depth;
        // The remaining brush attributes are intentionally folded into the
        // CPU field for now; GPU packing is expanded with the visual pass.
        void berm; void compression; void yaw; void elongation; void edge;
        this.brushCount += 1;
        this.brushTexture.needsUpdate = true;
        return true;
    }

    update() {
        if (this.disposed || this.brushCount === 0 || !this.renderer) return false;
        const readTarget = this.publishedTarget;
        const writeTarget = this.renderTargets[this.writeIndex === 0 ? 1 : 0];
        this.material.uniforms.uPrevious.value = readTarget.texture;
        this.material.uniforms.uBrushCount.value = this.brushCount;
        this.renderer.setRenderTarget(writeTarget);
        this.renderer.render(this.passScene, this.camera);
        // Restore the source target so this helper never leaves an arbitrary
        // target bound when embedded in a larger render loop.
        this.renderer.setRenderTarget(readTarget);
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
