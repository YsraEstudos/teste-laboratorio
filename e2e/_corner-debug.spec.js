import { test } from './fixtures/runtime-guard.js';

/**
 * Resolves once the WebGL renderer has drawn a new frame after a camera or
 * scene change, using the debug API's render frame counter
 * (game.renderer.renderer.info.render.frame). Falls back to a double
 * requestAnimationFrame when the counter is unavailable.
 */
async function waitForNextFrame(page) {
  await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const game = window.__LAB_DEBUG__?.game;
        if (!game) {
          reject(new Error('window.__LAB_DEBUG__.game is missing'));
          return;
        }
        const renderer = game.renderer.renderer;
        const startFrame = renderer.info?.render?.frame;
        if (typeof startFrame !== 'number') {
          requestAnimationFrame(() => requestAnimationFrame(resolve));
          return;
        }
        const poll = () => {
          if (renderer.info.render.frame > startFrame) {
            resolve();
          } else {
            requestAnimationFrame(poll);
          }
        };
        requestAnimationFrame(poll);
      }),
  );
}

test('corner debug screenshots', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'ENTRAR NO LABORATÓRIO' }).click();
  await waitForNextFrame(page);

  // Freeze gameplay so the camera stays where we put it (renderer still renders).
  await page.evaluate(() => {
    const game = window.__LAB_DEBUG__?.game;
    if (!game) {
      throw new Error('window.__LAB_DEBUG__.game is missing');
    }
    game.isPlaying = false;
  });

  // Shot 1: default spawn view (what the user sees).
  await page.screenshot({ path: 'test-results/corner-spawn.png' });

  // Shot 2: from the door looking at the far-left corner.
  await page.evaluate(() => {
    const g = window.__LAB_DEBUG__.game;
    g.renderer.camera.position.set(-9, 1.6, -42);
    g.renderer.camera.lookAt(-12, 0, -64);
    g.renderer.camera.updateMatrixWorld();
  });
  await waitForNextFrame(page);
  await page.screenshot({ path: 'test-results/corner-view.png' });

  // Shot 3: elevated view over the far-left corner (x=-12, z=-64).
  await page.evaluate(() => {
    const g = window.__LAB_DEBUG__.game;
    g.renderer.camera.position.set(-10, 9, -60);
    g.renderer.camera.lookAt(-11.5, -2, -61.5);
    g.renderer.camera.updateMatrixWorld();
  });
  await waitForNextFrame(page);
  await page.screenshot({ path: 'test-results/corner-top.png' });

  // Shot 4: same elevated view over the arena center for comparison.
  await page.evaluate(() => {
    const g = window.__LAB_DEBUG__.game;
    g.renderer.camera.position.set(-1, 9, -55);
    g.renderer.camera.lookAt(-0.5, -2, -55.5);
    g.renderer.camera.updateMatrixWorld();
  });
  await waitForNextFrame(page);
  await page.screenshot({ path: 'test-results/center-top.png' });

  // Stamp footprints: center, x-fade-only band, and corner, then re-render.
  await page.evaluate(() => {
    const sand = window.__LAB_DEBUG__.sand;
    sand.applyFootprint(0, -55, 0);
    sand.applyFootprint(-2, -53, Math.PI / 2);
    sand.applyFootprint(-11, -56, Math.PI / 4);
    sand.applyFootprint(-11.2, -62.2, Math.PI / 4);
    sand.applyFootprint(-11.5, -61.5, 0);
    sand.applyFootprint(-10.8, -61.8, Math.PI / 3);
    sand.update(0.016);
  });
  await waitForNextFrame(page);

  // Shot 5: re-apply the elevated corner view (Shot 3) so the stamped corner
  // screenshot captures the corner, not the center camera left over from Shot 4.
  await page.evaluate(() => {
    const g = window.__LAB_DEBUG__.game;
    g.renderer.camera.position.set(-10, 9, -60);
    g.renderer.camera.lookAt(-11.5, -2, -61.5);
    g.renderer.camera.updateMatrixWorld();
  });
  await waitForNextFrame(page);
  await page.screenshot({ path: 'test-results/corner-top-stamped.png' });
  await page.evaluate(() => {
    const g = window.__LAB_DEBUG__.game;
    g.renderer.camera.position.set(-1, 9, -55);
    g.renderer.camera.lookAt(-0.5, -2, -55.5);
    g.renderer.camera.updateMatrixWorld();
  });
  await waitForNextFrame(page);
  await page.screenshot({ path: 'test-results/center-top-stamped.png' });
});
