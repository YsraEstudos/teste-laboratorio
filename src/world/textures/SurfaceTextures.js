import { _texture } from './TextureUtils.js';
import { _noise } from './NoiseUtils.js';

export function createFloorTileTexture() {
  return _texture(512, 512, (ctx, width, height) => {
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
    _noise(ctx, width, height, 900, ['#ffffff', '#0c1720', '#80a4b0'], 0.07);
  });
}

export function createWallPanelTexture() {
  return _texture(512, 512, (ctx, width, height) => {
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
    _noise(ctx, width, height, 500, ['#ffffff', '#80929b', '#526873'], 0.08);
  });
}

export function createMetalTexture() {
  return _texture(512, 256, (ctx, width, height) => {
    ctx.fillStyle = '#27323b';
    ctx.fillRect(0, 0, width, height);
    for (let y = 0; y < height; y += 8) {
      ctx.fillStyle = y % 16 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
      ctx.fillRect(0, y, width, 3);
    }
    _noise(ctx, width, height, 480, ['#a1b2ba', '#0b1116', '#657983'], 0.12);
  });
}

export function createEmissivePanelTexture() {
  return _texture(256, 64, (ctx, width, height) => {
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, '#a6efff');
    gradient.addColorStop(0.5, '#ffffff');
    gradient.addColorStop(1, '#a6efff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(0, 14, width, 12);
  });
}

export function createSignageTexture(text, options = {}) {
  const width = options.width || 768;
  const height = options.height || 192;
  const background = options.background || '#10222d';
  const foreground = options.foreground || '#a9f0ff';
  const border = options.border || '#4fd5e8';
  return _texture(width, height, (ctx) => {
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
}

export function createMonitorTexture() {
  return _texture(256, 160, (ctx, width, height) => {
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
}

export function createWaterTexture() {
  return _texture(256, 256, (ctx, width, height) => {
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
}

export function createCardboardBoxTexture() {
  return _texture(512, 512, (ctx, width, height) => {
    ctx.fillStyle = '#b88a52';
    ctx.fillRect(0, 0, width, height);

    _noise(ctx, width, height, 1200, ['#a1743e', '#cb9e64', '#866034'], 0.12);

    ctx.fillStyle = '#9e733c';
    ctx.fillRect(0, height / 2 - 14, width, 28);
    ctx.strokeStyle = '#6e4b20';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, width - 8, height - 8);

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
}

export function createRockTexture() {
  return _texture(512, 512, (ctx, width, height) => {
    ctx.fillStyle = '#4a535a';
    ctx.fillRect(0, 0, width, height);

    _noise(ctx, width, height, 2400, ['#737e87', '#2a3137', '#5b656e', '#8e9aa5'], 0.25);

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
}

export function createPaperSheetTexture() {
  return _texture(256, 340, (ctx, width, height) => {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#f07170';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(35, 0);
    ctx.lineTo(35, height);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(73, 215, 232, 0.35)';
    ctx.lineWidth = 1;
    for (let y = 30; y < height; y += 18) {
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(width - 15, y);
      ctx.stroke();
    }

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

    _noise(ctx, width, height, 400, ['#cbd5e1', '#ffffff'], 0.08);
  });
}

export function createTreeLeafTexture() {
  return _texture(256, 256, (ctx, width, height) => {
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(width / 2, height / 2);

    ctx.fillStyle = '#54ce5b';
    ctx.beginPath();
    ctx.moveTo(0, -110);
    ctx.bezierCurveTo(75, -40, 70, 60, 0, 110);
    ctx.bezierCurveTo(-70, 60, -75, -40, 0, -110);
    ctx.fill();

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
}
