import { _texture } from './TextureUtils.js';
import { _noise, _seededRandom, _seededNoise } from './NoiseUtils.js';

export function createConcreteTexture() {
  return _texture(512, 512, (ctx, width, height) => {
    ctx.fillStyle = '#59636b';
    ctx.fillRect(0, 0, width, height);
    _noise(ctx, width, height, 1800, ['#a0abb0', '#222c32', '#727e84', '#d5dadd'], 0.18);
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
}

export function createGrassTexture() {
  return _texture(512, 512, (ctx, width, height) => {
    ctx.fillStyle = '#3f7b4b';
    ctx.fillRect(0, 0, width, height);
    _noise(ctx, width, height, 2100, ['#7dbb62', '#225b3a', '#55994d', '#a3ce70'], 0.23);
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
}

export function createBarkTexture() {
  return _texture(256, 512, (ctx, width, height) => {
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
    _noise(ctx, width, height, 240, ['#c28148', '#271811'], 0.18);
  });
}

export function createSandColorTexture(mapResolution) {
  return _texture(mapResolution, mapResolution, (ctx, width, height) => {
    // Base uniforme (o gradiente diagonal anterior não fechava na emenda do
    // tile e produzia uma grade visível de quadrados com repeat 8x6).
    ctx.fillStyle = '#dfb87e';
    ctx.fillRect(0, 0, width, height);

    // Sheen horizontal sutil e contínuo: periódico em Y e uniforme em X, então
    // fecha perfeitamente nas emendas (repeat 8x6 na arena).
    const cycles = 3;
    for (let y = 0; y < height; y += 2) {
      const wave = Math.sin((y / height) * Math.PI * 2 * cycles);
      if (wave >= 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${(wave * 0.045).toFixed(4)})`;
      } else {
        ctx.fillStyle = `rgba(90, 60, 25, ${(-wave * 0.045).toFixed(4)})`;
      }
      ctx.fillRect(0, y, width, 2);
    }

    _seededNoise(ctx, width, height, 2048, ['#ffffff', '#f4d6a6', '#9c733a', '#745121', '#e8cd9c'], 0.15, 0x5a11d);
  });
}

export function createSandNormalTexture(mapResolution) {
  return _texture(
    mapResolution,
    mapResolution,
    (ctx, width, height) => {
      ctx.fillStyle = '#8080ff';
      ctx.fillRect(0, 0, width, height);

      // Ondas senoidais com frequências múltiplas inteiras de 2π por tile:
      // o padrão fecha exatamente na emenda (repeat 8x6), sem costura visível.
      const freqX = (Math.PI * 2 * 4) / width;
      const freqY = (Math.PI * 2 * 4) / height;
      const stride = height / 16;

      ctx.strokeStyle = 'rgba(140, 150, 255, 0.12)';
      ctx.lineWidth = 6;
      for (let y = -stride; y < height; y += stride) {
        ctx.beginPath();
        for (let x = -20; x <= width + 20; x += 12) {
          const offset = Math.sin(x * freqX + y * freqY) * 8;
          if (x === -20) ctx.moveTo(x, y + offset);
          else ctx.lineTo(x, y + offset);
        }
        ctx.stroke();
      }

      const random = _seededRandom(0x5a11e);
      for (let i = 0; i < 2048; i++) {
        const x = random() * width;
        const y = random() * height;

        const u1 = Math.max(random(), Number.EPSILON);
        const u2 = random();
        const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

        const r = Math.max(0, Math.min(255, Math.floor(128 + z0 * 20)));
        const g = Math.max(0, Math.min(255, Math.floor(128 + z0 * 20)));
        const b = Math.max(128, Math.min(255, Math.floor(255 - Math.abs(z0 * 15))));

        ctx.fillStyle = `rgb(${r},${g},${b})`;
        const size = random() * 2.0 + 0.5;
        ctx.fillRect(x, y, size, size);
      }
    },
    false,
  );
}

export function createSandRoughnessTexture(mapResolution) {
  return _texture(
    mapResolution,
    mapResolution,
    (ctx, width, height) => {
      // Base uniforme: o gradiente anterior não fechava na emenda do tile.
      ctx.fillStyle = '#d6d6d6';
      ctx.fillRect(0, 0, width, height);

      _seededNoise(ctx, width, height, 1024, ['#ffffff', '#cccccc', '#e6e6e6', '#b3b3b3'], 0.15, 0x5a11f);
    },
    false,
  );
}

export function createSandTexture() {
  return _texture(512, 512, (ctx, width, height) => {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#e5c183');
    gradient.addColorStop(0.5, '#d9b270');
    gradient.addColorStop(1, '#ebd097');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

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

    _seededNoise(ctx, width, height, 2048, ['#ffffff', '#fff2d6', '#c49954', '#8a6224', '#f7e1b5'], 0.22, 0x51a9d);
  });
}
