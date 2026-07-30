import * as THREE from 'three';
import { getSandQuality } from './SandQualityProfile.js';

export class TextureGenerator {
  static _cache = new Map();
  static _sandTextureSets = new Map();

  static clearCache() {
    for (const texture of this._cache.values()) {
      if (typeof texture.dispose === 'function') texture.dispose();
    }
    this._cache.clear();
  }

  static _texture(width, height, draw, colorSpace = true) {
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
    texture.anisotropy = 4;
    if (colorSpace) texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  static _sandTexture(width, height, draw, colorSpace = true) {
    let canvas = null;
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      try {
        canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (context) draw(context, width, height);
      } catch {
        canvas = null;
      }
    }
    if (!canvas) canvas = { width, height };
    const texture = new THREE.CanvasTexture(canvas);
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    if (colorSpace) texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  static _noise(context, width, height, count, palette, alpha = 0.2) {
    context.save();
    context.globalAlpha = alpha;
    for (let i = 0; i < count; i += 1) {
      const color = palette[Math.floor(Math.random() * palette.length)];
      context.fillStyle = color;
      const size = Math.random() * 3 + 1;
      context.fillRect(Math.random() * width, Math.random() * height, size, size);
    }
    context.restore();
  }

  /**
   * @returns {THREE.CanvasTexture}
   */
  static createFloorTileTexture() {
    if (this._cache.has('createFloorTileTexture')) return this._cache.get('createFloorTileTexture');
    const texture = this._texture(512, 512, (ctx, width, height) => {
      ctx.fillStyle = '#293542';
      ctx.fillRect(0, 0, width, height);
      const tile = 64;
      for (let y = 0; y < height; y += tile) {
        for (let x = 0; x < width; x += tile) {
          ctx.fillStyle = (x / tile + y / tile) % 2 === 0 ? '#384856' : '#32414e';
          ctx.fillRect(x + 2, y + 2, tile - 4, tile - 4);
          ctx.strokeStyle = '#18232d';
          ctx.lineWidth = 3;
          ctx.strokeRect(x + 1.5, y + 1.5, tile - 3, tile - 3);
          ctx.strokeStyle = 'rgba(141, 193, 209, 0.13)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 7, y + 7, tile - 14, tile - 14);
        }
      }
      this._noise(ctx, width, height, 900, ['#ffffff', '#0c1720', '#80a4b0'], 0.07);
    });
    this._cache.set('createFloorTileTexture', texture);
    return texture;
  }

  /**
   * @returns {THREE.CanvasTexture}
   */
  static createWallPanelTexture() {
    if (this._cache.has('createWallPanelTexture')) return this._cache.get('createWallPanelTexture');
    const texture = this._texture(512, 512, (ctx, width, height) => {
      ctx.fillStyle = '#d5dde0';
      ctx.fillRect(0, 0, width, height);
      for (let y = 0; y < height; y += 128) {
        ctx.fillStyle = y % 256 === 0 ? '#e7edef' : '#c9d3d7';
        ctx.fillRect(4, y + 4, width - 8, 120);
        ctx.strokeStyle = '#9baeb5';
        ctx.lineWidth = 4;
        ctx.strokeRect(4, y + 4, width - 8, 120);
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 2;
        ctx.strokeRect(12, y + 12, width - 24, 104);
      }
      this._noise(ctx, width, height, 500, ['#ffffff', '#80929b', '#526873'], 0.08);
    });
    this._cache.set('createWallPanelTexture', texture);
    return texture;
  }

  /**
   * @returns {THREE.CanvasTexture}
   */
  static createConcreteTexture() {
    if (this._cache.has('createConcreteTexture')) return this._cache.get('createConcreteTexture');
    const texture = this._texture(512, 512, (ctx, width, height) => {
      ctx.fillStyle = '#59636b';
      ctx.fillRect(0, 0, width, height);
      this._noise(ctx, width, height, 1800, ['#a0abb0', '#222c32', '#727e84', '#d5dadd'], 0.18);
      ctx.strokeStyle = 'rgba(27, 36, 42, 0.45)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 14; i += 1) {
        const y = Math.random() * height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y + (Math.random() - 0.5) * 18);
        ctx.stroke();
      }
    });
    this._cache.set('createConcreteTexture', texture);
    return texture;
  }

  /**
   * @returns {THREE.CanvasTexture}
   */
  static createGrassTexture() {
    if (this._cache.has('createGrassTexture')) return this._cache.get('createGrassTexture');
    const texture = this._texture(512, 512, (ctx, width, height) => {
      ctx.fillStyle = '#3f7b4b';
      ctx.fillRect(0, 0, width, height);
      this._noise(ctx, width, height, 2100, ['#7dbb62', '#225b3a', '#55994d', '#a3ce70'], 0.23);
      ctx.strokeStyle = 'rgba(186, 225, 126, 0.18)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 220; i += 1) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        ctx.beginPath();
        ctx.moveTo(x, y + 5);
        ctx.lineTo(x + (Math.random() - 0.5) * 6, y - 5);
        ctx.stroke();
      }
    });
    this._cache.set('createGrassTexture', texture);
    return texture;
  }

  /**
   * @returns {THREE.CanvasTexture}
   */
  static createBarkTexture() {
    if (this._cache.has('createBarkTexture')) return this._cache.get('createBarkTexture');
    const texture = this._texture(256, 512, (ctx, width, height) => {
      ctx.fillStyle = '#6b4029';
      ctx.fillRect(0, 0, width, height);
      for (let x = 10; x < width; x += 22) {
        ctx.strokeStyle = x % 44 === 0 ? '#3f251b' : '#9a5e35';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x - 8, height * 0.3, x + 8, height * 0.65, x - 4, height);
        ctx.stroke();
      }
      this._noise(ctx, width, height, 240, ['#c28148', '#271811'], 0.18);
    });
    this._cache.set('createBarkTexture', texture);
    return texture;
  }

  /**
   * @returns {THREE.CanvasTexture}
   */
  static createMetalTexture() {
    if (this._cache.has('createMetalTexture')) return this._cache.get('createMetalTexture');
    const texture = this._texture(512, 256, (ctx, width, height) => {
      ctx.fillStyle = '#27323b';
      ctx.fillRect(0, 0, width, height);
      for (let y = 0; y < height; y += 8) {
        ctx.fillStyle = y % 16 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
        ctx.fillRect(0, y, width, 3);
      }
      this._noise(ctx, width, height, 480, ['#a1b2ba', '#0b1116', '#657983'], 0.12);
    });
    this._cache.set('createMetalTexture', texture);
    return texture;
  }

  /**
   * @returns {THREE.CanvasTexture}
   */
  static createEmissivePanelTexture() {
    if (this._cache.has('createEmissivePanelTexture')) return this._cache.get('createEmissivePanelTexture');
    const texture = this._texture(256, 64, (ctx, width, height) => {
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, '#a6efff');
      gradient.addColorStop(0.5, '#ffffff');
      gradient.addColorStop(1, '#a6efff');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(0, 14, width, 12);
    });
    this._cache.set('createEmissivePanelTexture', texture);
    return texture;
  }

  /**
   * @returns {THREE.CanvasTexture}
   */
  static createSignageTexture(text, options = {}) {
    const width = options.width || 768;
    const height = options.height || 192;
    const background = options.background || '#10222d';
    const foreground = options.foreground || '#a9f0ff';
    const border = options.border || '#4fd5e8';
    const cacheKey = JSON.stringify({ text, width, height, background, foreground, border });
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);
    const texture = this._texture(width, height, (ctx) => {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = border;
      ctx.lineWidth = 6;
      ctx.strokeRect(8, 8, width - 16, height - 16);
      ctx.fillStyle = 'rgba(92, 221, 238, 0.08)';
      ctx.fillRect(18, 18, width - 36, height - 36);
      ctx.font = `700 ${Math.floor(height * 0.34)}px Rajdhani, Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = foreground;
      ctx.shadowColor = foreground;
      ctx.shadowBlur = 16;
      ctx.fillText(text, width / 2, height / 2 + 3);
      ctx.shadowBlur = 0;
    });
    this._cache.set(cacheKey, texture);
    return texture;
  }

  /**
   * @returns {THREE.CanvasTexture}
   */
  static createMonitorTexture() {
    if (this._cache.has('createMonitorTexture')) return this._cache.get('createMonitorTexture');
    const texture = this._texture(256, 160, (ctx, width, height) => {
      ctx.fillStyle = '#07131a';
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = '#5de0ef';
      ctx.lineWidth = 3;
      ctx.strokeRect(8, 8, width - 16, height - 16);
      ctx.strokeStyle = 'rgba(93,224,239,0.36)';
      ctx.lineWidth = 1;
      for (let y = 34; y < height - 18; y += 24) {
        ctx.beginPath();
        ctx.moveTo(18, y);
        ctx.lineTo(width - 18, y);
        ctx.stroke();
      }
      ctx.fillStyle = '#91f7d0';
      ctx.font = '700 25px Rajdhani, Arial, sans-serif';
      ctx.fillText('ALVO // OK', 20, 31);
      ctx.strokeStyle = '#91f7d0';
      ctx.beginPath();
      ctx.arc(width * 0.72, height * 0.58, 26, 0, Math.PI * 2);
      ctx.moveTo(width * 0.72, height * 0.25);
      ctx.lineTo(width * 0.72, height * 0.91);
      ctx.moveTo(width * 0.4, height * 0.58);
      ctx.lineTo(width * 0.96, height * 0.58);
      ctx.stroke();
    });
    this._cache.set('createMonitorTexture', texture);
    return texture;
  }

  /**
   * @returns {THREE.CanvasTexture}
   */
  static createWaterTexture() {
    if (this._cache.has('createWaterTexture')) return this._cache.get('createWaterTexture');
    const texture = this._texture(256, 256, (ctx, width, height) => {
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#2b9eac');
      gradient.addColorStop(1, '#155579');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = 'rgba(194, 255, 244, 0.55)';
      ctx.lineWidth = 3;
      for (let y = 20; y < height; y += 38) {
        ctx.beginPath();
        for (let x = -20; x <= width + 20; x += 12) {
          const offset = Math.sin(x * 0.07 + y) * 4;
          if (x === -20) ctx.moveTo(x, y + offset);
          else ctx.lineTo(x, y + offset);
        }
        ctx.stroke();
      }
    });
    this._cache.set('createWaterTexture', texture);
    return texture;
  }

  /**
   * @returns {THREE.CanvasTexture}
   */
  static createCardboardBoxTexture() {
    if (this._cache.has('createCardboardBoxTexture')) return this._cache.get('createCardboardBoxTexture');
    const texture = this._texture(512, 512, (ctx, width, height) => {
      ctx.fillStyle = '#b88a52';
      ctx.fillRect(0, 0, width, height);

      // Cardboard texture noise
      this._noise(ctx, width, height, 1200, ['#a1743e', '#cb9e64', '#866034'], 0.12);

      // Cardboard Tape & Flaps
      ctx.fillStyle = '#9e733c';
      ctx.fillRect(0, height / 2 - 14, width, 28);
      ctx.strokeStyle = '#6e4b20';
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, width - 8, height - 8);

      // Stamp Logo "CONFIRMED 42"
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.rotate(-0.06);

      ctx.fillStyle = '#10222d';
      ctx.fillRect(-170, -55, 340, 110);
      ctx.strokeStyle = '#ffd36d';
      ctx.lineWidth = 5;
      ctx.strokeRect(-165, -50, 330, 100);

      ctx.fillStyle = '#ffd36d';
      ctx.font = '700 38px Rajdhani, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('CONFIRMED 42', 0, -10);

      ctx.fillStyle = '#a9f0ff';
      ctx.font = '600 18px Rajdhani, Arial, sans-serif';
      ctx.fillText('TESTING SUBJECT // LIGHT', 0, 24);

      ctx.restore();
    });
    this._cache.set('createCardboardBoxTexture', texture);
    return texture;
  }

  /**
   * @returns {THREE.CanvasTexture}
   */
  static createRockTexture() {
    if (this._cache.has('createRockTexture')) return this._cache.get('createRockTexture');
    const texture = this._texture(512, 512, (ctx, width, height) => {
      ctx.fillStyle = '#4a535a';
      ctx.fillRect(0, 0, width, height);

      this._noise(ctx, width, height, 2400, ['#737e87', '#2a3137', '#5b656e', '#8e9aa5'], 0.25);

      // Rock Cracks
      ctx.strokeStyle = '#1b2024';
      ctx.lineWidth = 3;
      for (let i = 0; i < 8; i += 1) {
        ctx.beginPath();
        const startX = Math.random() * width;
        const startY = Math.random() * height;
        ctx.moveTo(startX, startY);
        ctx.lineTo(startX + (Math.random() - 0.5) * 140, startY + (Math.random() - 0.5) * 140);
        ctx.stroke();
      }

      // Engraved Metallic Emblem "CONFIRMED 42"
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.fillStyle = 'rgba(16, 26, 34, 0.85)';
      ctx.beginPath();
      ctx.arc(0, 0, 120, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#49d7e8';
      ctx.lineWidth = 6;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 34px Rajdhani, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('CONFIRMED 42', 0, -12);

      ctx.fillStyle = '#49d7e8';
      ctx.font = '600 16px Rajdhani, Arial, sans-serif';
      ctx.fillText('HEAVY ROCK // 25KG', 0, 25);
      ctx.restore();
    });
    this._cache.set('createRockTexture', texture);
    return texture;
  }

  /**
   * @returns {THREE.CanvasTexture}
   */
  static createPaperSheetTexture() {
    if (this._cache.has('createPaperSheetTexture')) return this._cache.get('createPaperSheetTexture');
    const texture = this._texture(256, 340, (ctx, width, height) => {
      // White Paper Sheet with grid & text lines
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, width, height);

      // Red Margin Line
      ctx.strokeStyle = '#f07170';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(35, 0);
      ctx.lineTo(35, height);
      ctx.stroke();

      // Blue horizontal lines
      ctx.strokeStyle = 'rgba(73, 215, 232, 0.35)';
      ctx.lineWidth = 1;
      for (let y = 30; y < height; y += 18) {
        ctx.beginPath();
        ctx.moveTo(40, y);
        ctx.lineTo(width - 15, y);
        ctx.stroke();
      }

      // Stamp Logo
      ctx.save();
      ctx.translate(width / 2 + 10, 45);
      ctx.rotate(-0.15);
      ctx.fillStyle = 'rgba(36, 167, 192, 0.85)';
      ctx.font = '700 13px Rajdhani, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CONFIRMED 42 REPORT', 0, 0);
      ctx.strokeStyle = 'rgba(36, 167, 192, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-70, -12, 140, 20);
      ctx.restore();

      this._noise(ctx, width, height, 400, ['#cbd5e1', '#ffffff'], 0.08);
    });
    this._cache.set('createPaperSheetTexture', texture);
    return texture;
  }

  /**
   * @returns {THREE.CanvasTexture}
   */
  static createTreeLeafTexture() {
    if (this._cache.has('createTreeLeafTexture')) return this._cache.get('createTreeLeafTexture');
    const texture = this._texture(256, 256, (ctx, width, height) => {
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(width / 2, height / 2);

      // Leaf Shape
      ctx.fillStyle = '#54ce5b';
      ctx.beginPath();
      ctx.moveTo(0, -110);
      ctx.bezierCurveTo(75, -40, 70, 60, 0, 110);
      ctx.bezierCurveTo(-70, 60, -75, -40, 0, -110);
      ctx.fill();

      // Leaf Stem & Veins
      ctx.strokeStyle = '#2d8433';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, -105);
      ctx.lineTo(0, 105);
      ctx.stroke();

      ctx.lineWidth = 2;
      for (let i = -80; i < 80; i += 25) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(40, i - 20);
        ctx.moveTo(0, i);
        ctx.lineTo(-40, i - 20);
        ctx.stroke();
      }

      ctx.restore();
    });
    this._cache.set('createTreeLeafTexture', texture);
    return texture;
  }

  /**
   * @returns {THREE.CanvasTexture}
   */
  static createSandTexture() {
    if (this._cache.has('createSandTexture')) return this._cache.get('createSandTexture');
    const texture = this._texture(512, 512, (ctx, width, height) => {
      // Golden desert base
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#e5c183');
      gradient.addColorStop(0.5, '#d9b270');
      gradient.addColorStop(1, '#ebd097');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Sand Dune Wave Ripples
      ctx.strokeStyle = 'rgba(189, 147, 85, 0.45)';
      ctx.lineWidth = 6;
      for (let y = -20; y < height + 40; y += 32) {
        ctx.beginPath();
        for (let x = -20; x <= width + 20; x += 16) {
          const offset = Math.sin(x * 0.05 + y * 0.08) * 8 + Math.cos(x * 0.03) * 4;
          if (x === -20) ctx.moveTo(x, y + offset);
          else ctx.lineTo(x, y + offset);
        }
        ctx.stroke();
      }

      // Highlight on dune crests
      ctx.strokeStyle = 'rgba(255, 243, 215, 0.4)';
      ctx.lineWidth = 3;
      for (let y = -18; y < height + 40; y += 32) {
        ctx.beginPath();
        for (let x = -20; x <= width + 20; x += 16) {
          const offset = Math.sin(x * 0.05 + y * 0.08) * 8 + Math.cos(x * 0.03) * 4 - 3;
          if (x === -20) ctx.moveTo(x, y + offset);
          else ctx.lineTo(x, y + offset);
        }
        ctx.stroke();
      }

      // Fine sand grain noise
      this._noise(ctx, width, height, 3200, ['#ffffff', '#fff2d6', '#c49954', '#8a6224', '#f7e1b5'], 0.22);
    });
    this._cache.set('createSandTexture', texture);
    return texture;
  }
  /**
   * @returns {THREE.CanvasTexture}
   */
  static acquireSandTextureSet({ quality = 'high' } = {}) {
    const profile = getSandQuality(quality);
    const key = quality in { low: true, medium: true, high: true } ? quality : 'high';
    const cached = this._sandTextureSets.get(key);
    if (cached) {
      cached.refs += 1;
      return this._sandTextureSetHandle(key, cached);
    }

    const { mapResolution, anisotropy } = profile;
    const albedo = this._sandTexture(mapResolution, mapResolution, (ctx, width, height) => {
      // Gradiente tricolor PBR rico (areia dourada exposta, areia seca de crista e fundo de vale)
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#e0ba7d'); // exposed golden sand
      gradient.addColorStop(0.5, '#e8c48a'); // dry crest sand
      gradient.addColorStop(1, '#c69d60'); // valley bottom
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      
      // Fundo de vale com micro-grãos de contraste suave
      this._noise(ctx, width, height, 4000, ['#ffffff', '#f4d6a6', '#9c733a', '#745121', '#e8cd9c'], 0.15);
    });
    const normal = this._sandTexture(mapResolution, mapResolution, (ctx, width, height) => {
      // Base normal (flat pointing UP in tangent space: R=128, G=128, B=255)
      ctx.fillStyle = '#8080ff';
      ctx.fillRect(0, 0, width, height);
      
      // Ondas sutis de vento
      ctx.strokeStyle = 'rgba(140, 150, 255, 0.12)';
      ctx.lineWidth = 6;
      for (let y = -20; y < height + 40; y += 24) {
        ctx.beginPath();
        for (let x = -20; x <= width + 20; x += 12) {
          const offset = Math.sin(x * 0.05 + y * 0.08) * 8;
          if (x === -20) ctx.moveTo(x, y + offset);
          else ctx.lineTo(x, y + offset);
        }
        ctx.stroke();
      }

      // Gerador de Normal Map de alta frequência para microrrugosidade tridimensional com distribuição gaussiana
      for (let i = 0; i < 40000; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        
        // Box-Muller transform para distribuição Gaussiana de normais
        const u1 = Math.random();
        const u2 = Math.random();
        const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        
        const r = Math.max(0, Math.min(255, Math.floor(128 + z0 * 20)));
        const g = Math.max(0, Math.min(255, Math.floor(128 + z0 * 20)));
        const b = Math.max(128, Math.min(255, Math.floor(255 - Math.abs(z0 * 15))));
        
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        const size = Math.random() * 2.0 + 0.5;
        ctx.fillRect(x, y, size, size);
      }
    }, false);
    const roughness = this._sandTexture(mapResolution, mapResolution, (ctx, width, height) => {
      // Mapa de rugosidade com variação de especularidade e oclusão (0.70 a 0.95)
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#b2b2b2'); // Crests: ~0.70 roughness
      gradient.addColorStop(1, '#f2f2f2'); // Valleys: ~0.95 roughness
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      
      // Oclusão e variação fina de especularidade com poeira
      this._noise(ctx, width, height, 8000, ['#ffffff', '#cccccc', '#e6e6e6', '#b3b3b3'], 0.15);
    }, false);

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
