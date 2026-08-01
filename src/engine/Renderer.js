import * as THREE from 'three';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.disposed = false;
    this.composer = null;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a1017);
    this.scene.fog = new THREE.FogExp2(0x0a1017, 0.005);

    this.viewSize = 24;
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.OrthographicCamera(
      (-this.viewSize * aspect) / 2,
      (this.viewSize * aspect) / 2,
      this.viewSize / 2,
      -this.viewSize / 2,
      0.1,
      300,
    );
    this.camera.position.set(0, 24, 6);
    this.camera.userData.canvas = canvas;
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.softwareRenderer = this._detectSoftwareRenderer();
    this.renderScale = this.softwareRenderer ? 0.25 : 1;
    this._softwareFallbackApplied = false;
    this._softwareMaterials = new Set();
    this.renderer.setSize(...this._getRenderSize(window.innerWidth, window.innerHeight));
    this.renderer.setPixelRatio(this.softwareRenderer ? 1 : Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this._setupLighting();
    this._onResize = this.onWindowResize.bind(this);
    window.addEventListener('resize', this._onResize);
  }

  _detectSoftwareRenderer() {
    try {
      const gl = this.renderer.getContext?.();
      const debugInfo = gl?.getExtension?.('WEBGL_debug_renderer_info');
      const rendererName = debugInfo
        ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
        : gl?.getParameter?.(gl.RENDERER);
      return /swiftshader|llvmpipe|software(?: rasterizer)?/i.test(rendererName || '');
    } catch {
      return false;
    }
  }

  _getRenderSize(width, height) {
    return [
      Math.max(1, Math.round(width * this.renderScale)),
      Math.max(1, Math.round(height * this.renderScale)),
      this.renderScale >= 1,
    ];
  }

  _createSoftwareMaterial(source) {
    if (!source?.isMeshStandardMaterial) return source;

    const replacement = new THREE.MeshBasicMaterial({
      color: source.color,
      map: source.map,
      transparent: source.transparent,
      opacity: source.opacity,
      alphaTest: source.alphaTest,
      side: source.side,
      depthWrite: source.depthWrite,
      vertexColors: source.vertexColors,
      flatShading: source.flatShading,
    });

    if (source.userData?.sandDeformationAuthoritative) {
      replacement.onBeforeCompile = source.onBeforeCompile;
      replacement.customProgramCacheKey = source.customProgramCacheKey;
      replacement.userData.sandDeformationAuthoritative = true;
    }

    this._softwareMaterials.add(replacement);
    return replacement;
  }

  applySoftwareFallback() {
    if (!this.softwareRenderer || this._softwareFallbackApplied) return false;

    this.renderer.shadowMap.enabled = false;
    const materialCache = new Map();
    this.scene.traverse((object) => {
      if (object.castShadow) object.castShadow = false;
      if (object.receiveShadow) object.receiveShadow = false;
      if (!object.isMesh || !object.material) return;

      const materials = Array.isArray(object.material) ? object.material : [object.material];
      const replacements = materials.map((source) => {
        if (!source?.isMeshStandardMaterial) return source;
        if (!materialCache.has(source)) materialCache.set(source, this._createSoftwareMaterial(source));
        return materialCache.get(source);
      });
      object.material = Array.isArray(object.material) ? replacements : replacements[0];
    });

    this._softwareFallbackApplied = true;
    return true;
  }

  _setupLighting() {
    const ambient = new THREE.AmbientLight(0x405566, 0.45);
    this.scene.add(ambient);

    const hemi = new THREE.HemisphereLight(0x90b5d0, 0x15222e, 0.85);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffeedd, 1.6);
    sun.position.set(35, 80, 55);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.left = -50;
    sun.shadow.camera.right = 50;
    sun.shadow.camera.top = 50;
    sun.shadow.camera.bottom = -50;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 150;
    sun.shadow.bias = -0.0002;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);
    this.scene.add(sun.target);
  }

  render() {
    if (this.disposed) return;
    this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    if (this.disposed) return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / h;
    this.camera.left = (-this.viewSize * aspect) / 2;
    this.camera.right = (this.viewSize * aspect) / 2;
    this.camera.top = this.viewSize / 2;
    this.camera.bottom = -this.viewSize / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(...this._getRenderSize(w, h));
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener('resize', this._onResize);
    for (const material of this._softwareMaterials) material.dispose();
    this._softwareMaterials.clear();
    this.renderer.dispose();
  }
}
