import { getSandQuality } from './SandQualityProfile.js';
import * as NoiseUtils from './textures/NoiseUtils.js';
import * as TerrainTextures from './textures/TerrainTextures.js';
import * as SurfaceTextures from './textures/SurfaceTextures.js';
import { _texture, _sandTexture } from './textures/TextureUtils.js';

export class TextureGenerator {
  static _cache = new Map();
  static _sandTextureSets = new Map();

  static clearCache() {
    for (const texture of this._cache.values()) {
      if (typeof texture?.dispose === 'function') texture.dispose();
    }
    this._cache.clear();
  }

  static _texture(width, height, draw, colorSpace = true) {
    return _texture(width, height, draw, colorSpace);
  }

  static _sandTexture(width, height, draw, colorSpace = true) {
    return _sandTexture(width, height, draw, colorSpace);
  }

  static _noise(context, width, height, count, palette, alpha = 0.2) {
    return NoiseUtils._noise(context, width, height, count, palette, alpha);
  }

  static _seededRandom(seed) {
    return NoiseUtils._seededRandom(seed);
  }

  static _seededNoise(context, width, height, count, palette, alpha = 0.2, seed = 0x5a11d) {
    return NoiseUtils._seededNoise(context, width, height, count, palette, alpha, seed);
  }

  /**
   * @returns {import('three').CanvasTexture}
   */
  static createFloorTileTexture() {
    if (this._cache.has('createFloorTileTexture')) return this._cache.get('createFloorTileTexture');
    const texture = SurfaceTextures.createFloorTileTexture();
    this._cache.set('createFloorTileTexture', texture);
    return texture;
  }

  /**
   * @returns {import('three').CanvasTexture}
   */
  static createWallPanelTexture() {
    if (this._cache.has('createWallPanelTexture')) return this._cache.get('createWallPanelTexture');
    const texture = SurfaceTextures.createWallPanelTexture();
    this._cache.set('createWallPanelTexture', texture);
    return texture;
  }

  /**
   * @returns {import('three').CanvasTexture}
   */
  static createConcreteTexture() {
    if (this._cache.has('createConcreteTexture')) return this._cache.get('createConcreteTexture');
    const texture = TerrainTextures.createConcreteTexture();
    this._cache.set('createConcreteTexture', texture);
    return texture;
  }

  /**
   * @returns {import('three').CanvasTexture}
   */
  static createGrassTexture() {
    if (this._cache.has('createGrassTexture')) return this._cache.get('createGrassTexture');
    const texture = TerrainTextures.createGrassTexture();
    this._cache.set('createGrassTexture', texture);
    return texture;
  }

  /**
   * @returns {import('three').CanvasTexture}
   */
  static createBarkTexture() {
    if (this._cache.has('createBarkTexture')) return this._cache.get('createBarkTexture');
    const texture = TerrainTextures.createBarkTexture();
    this._cache.set('createBarkTexture', texture);
    return texture;
  }

  /**
   * @returns {import('three').CanvasTexture}
   */
  static createMetalTexture() {
    if (this._cache.has('createMetalTexture')) return this._cache.get('createMetalTexture');
    const texture = SurfaceTextures.createMetalTexture();
    this._cache.set('createMetalTexture', texture);
    return texture;
  }

  /**
   * @returns {import('three').CanvasTexture}
   */
  static createEmissivePanelTexture() {
    if (this._cache.has('createEmissivePanelTexture')) return this._cache.get('createEmissivePanelTexture');
    const texture = SurfaceTextures.createEmissivePanelTexture();
    this._cache.set('createEmissivePanelTexture', texture);
    return texture;
  }

  /**
   * @returns {import('three').CanvasTexture}
   */
  static createSignageTexture(text, options = {}) {
    const width = options.width || 768;
    const height = options.height || 192;
    const background = options.background || '#10222d';
    const foreground = options.foreground || '#a9f0ff';
    const border = options.border || '#4fd5e8';
    const cacheKey = JSON.stringify({ text, width, height, background, foreground, border });
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);
    const texture = SurfaceTextures.createSignageTexture(text, { width, height, background, foreground, border });
    this._cache.set(cacheKey, texture);
    return texture;
  }

  /**
   * @returns {import('three').CanvasTexture}
   */
  static createMonitorTexture() {
    if (this._cache.has('createMonitorTexture')) return this._cache.get('createMonitorTexture');
    const texture = SurfaceTextures.createMonitorTexture();
    this._cache.set('createMonitorTexture', texture);
    return texture;
  }

  /**
   * @returns {import('three').CanvasTexture}
   */
  static createWaterTexture() {
    if (this._cache.has('createWaterTexture')) return this._cache.get('createWaterTexture');
    const texture = SurfaceTextures.createWaterTexture();
    this._cache.set('createWaterTexture', texture);
    return texture;
  }

  /**
   * @returns {import('three').CanvasTexture}
   */
  static createCardboardBoxTexture() {
    if (this._cache.has('createCardboardBoxTexture')) return this._cache.get('createCardboardBoxTexture');
    const texture = SurfaceTextures.createCardboardBoxTexture();
    this._cache.set('createCardboardBoxTexture', texture);
    return texture;
  }

  /**
   * @returns {import('three').CanvasTexture}
   */
  static createRockTexture() {
    if (this._cache.has('createRockTexture')) return this._cache.get('createRockTexture');
    const texture = SurfaceTextures.createRockTexture();
    this._cache.set('createRockTexture', texture);
    return texture;
  }

  /**
   * @returns {import('three').CanvasTexture}
   */
  static createPaperSheetTexture() {
    if (this._cache.has('createPaperSheetTexture')) return this._cache.get('createPaperSheetTexture');
    const texture = SurfaceTextures.createPaperSheetTexture();
    this._cache.set('createPaperSheetTexture', texture);
    return texture;
  }

  /**
   * @returns {import('three').CanvasTexture}
   */
  static createTreeLeafTexture() {
    if (this._cache.has('createTreeLeafTexture')) return this._cache.get('createTreeLeafTexture');
    const texture = SurfaceTextures.createTreeLeafTexture();
    this._cache.set('createTreeLeafTexture', texture);
    return texture;
  }

  /**
   * @returns {import('three').CanvasTexture}
   */
  static createSandTexture() {
    if (this._cache.has('createSandTexture')) return this._cache.get('createSandTexture');
    const texture = TerrainTextures.createSandTexture();
    this._cache.set('createSandTexture', texture);
    return texture;
  }

  /**
   * @returns {{ key: string, albedo: import('three').CanvasTexture, normal: import('three').CanvasTexture, roughness: import('three').CanvasTexture, release: Function }}
   */
  static acquireSandTextureSet({ quality = 'high' } = {}) {
    const profile = getSandQuality(quality);
    const key = ['low', 'medium', 'high'].includes(quality) ? quality : 'high';
    const cached = this._sandTextureSets.get(key);
    if (cached) {
      cached.refs += 1;
      return this._sandTextureSetHandle(key, cached);
    }

    const { mapResolution, anisotropy } = profile;
    const albedo = TerrainTextures.createSandColorTexture(mapResolution);
    const normal = TerrainTextures.createSandNormalTexture(mapResolution);
    const roughness = TerrainTextures.createSandRoughnessTexture(mapResolution);

    for (const texture of [albedo, normal, roughness]) texture.anisotropy = anisotropy;
    const textureSet = { refs: 1, albedo, normal, roughness };
    this._sandTextureSets.set(key, textureSet);
    return this._sandTextureSetHandle(key, textureSet);
  }

  static _sandTextureSetHandle(key, textureSet) {
    let released = false;
    return {
      key,
      albedo: textureSet.albedo,
      normal: textureSet.normal,
      roughness: textureSet.roughness,
      release: () => {
        if (released) return;
        released = true;
        textureSet.refs -= 1;
        if (textureSet.refs > 0) return;
        textureSet.albedo.dispose();
        textureSet.normal.dispose();
        textureSet.roughness.dispose();
        this._sandTextureSets.delete(key);
      },
    };
  }
}
