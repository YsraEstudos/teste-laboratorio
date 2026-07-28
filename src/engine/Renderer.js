import * as THREE from 'three';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.disposed = false;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d151d);
    this.scene.fog = new THREE.FogExp2(0x0d151d, 0.004);

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
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this._setupLighting();

    this._onResize = this.onWindowResize.bind(this);
    window.addEventListener('resize', this._onResize);
  }

  _setupLighting() {
    const ambient = new THREE.AmbientLight(0x6b7d8f, 0.75);
    this.scene.add(ambient);

    const hemi = new THREE.HemisphereLight(0xd9ecff, 0x25323b, 1.45);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffeedd, 2.5);
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
    this.renderer.setSize(w, h);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
  }
}
