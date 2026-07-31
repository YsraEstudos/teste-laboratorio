import * as THREE from 'three';

export function _texture(width, height, draw, colorSpace = true, anisotropy = 4) {
  let canvas = null;
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    try {
      canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (context) {
        draw(context, width, height);
      }
    } catch {
      canvas = null;
    }
  }
  if (!canvas) {
    canvas = { width, height };
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  if (anisotropy) texture.anisotropy = anisotropy;
  if (colorSpace) texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
