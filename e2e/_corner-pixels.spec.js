import { test } from './fixtures/runtime-guard.js';

test('corner pixel analysis', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'ENTRAR NO LABORATÓRIO' }).click();
  await page.waitForTimeout(400);

  const results = await page.evaluate(async () => {
    const sampleBlock = (buf, w, h, cx, cy, size) => {
      const half = Math.floor(size / 2);
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let dy = -half; dy <= half; dy += 2) {
        for (let dx = -half; dx <= half; dx += 2) {
          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || x >= w || y < 0 || y >= h) continue;
          const i = (y * w + x) * 4;
          r += buf[i];
          g += buf[i + 1];
          b += buf[i + 2];
          n += 1;
        }
      }
      return {
        r: Math.round(r / n),
        g: Math.round(g / n),
        b: Math.round(b / n),
        lum: Math.round((0.2126 * r + 0.7152 * g + 0.0722 * b) / n),
      };
    };

    const game = window.__LAB_DEBUG__?.game;
    if (!game) {
      throw new Error('window.__LAB_DEBUG__.game is missing');
    }
    const canvas = document.getElementById('game-canvas');
    const gl = game.renderer.renderer.getContext();
    const w = canvas.width;
    const h = canvas.height;
    const buf = new Uint8Array(w * h * 4);

    const snap = (camPos, lookAt) => {
      cancelAnimationFrame(game.animationId);
      game.isPlaying = false;
      game.renderer.camera.position.set(...camPos);
      game.renderer.camera.lookAt(...lookAt);
      game.renderer.camera.updateMatrixWorld();
      game.renderer.render(0.016);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      return buf.slice(0, w * h * 4);
    };

    const corner = snap([-10, 6, -60], [-11.5, -1, -61.5]);
    const center = snap([-1, 6, -55], [-0.5, -1, -55.5]);
    const rightCorner = snap([10, 6, -60], [11.5, -1, -61.5]);
    const nearLeft = snap([-10, 6, -48], [-11.5, -1, -48.5]);

    const block = (buff, cx, cy, size) => sampleBlock(buff, w, h, cx, cy, size);
    const cx = Math.floor(w / 2);
    const cy = Math.floor(h / 2);

    return {
      viewport: { w, h },
      cornerCenter: block(corner, cx, cy, 40),
      centerCenter: block(center, cx, cy, 40),
      rightCornerCenter: block(rightCorner, cx, cy, 40),
      nearLeftCenter: block(nearLeft, cx, cy, 40),
    };
  });

  console.log('CORNER-PIXELS ' + JSON.stringify(results));
});
