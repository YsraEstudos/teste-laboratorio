import { expect, test } from './fixtures/runtime-guard.js';

const FRAMES = 120;
const MAX_FRAME_TIME_P95 = 16.7;

async function collectAt(page, z) {
  return page.evaluate(async ({ targetZ, frames }) => {
    const game = window.__LAB_DEBUG__?.game;
    game.player.position.z = targetZ;
    if (game.player.model) game.player.model.position.z = targetZ;
    return game.collectSandSample({ frames });
  }, { targetZ: z, frames: FRAMES });
}

test('measures sand performance from the entrance through close inspection', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'ENTRAR NO LABORATÓRIO' }).click();

  const distant = await collectAt(page, 4.5);
  const approach = await collectAt(page, -40);
  const near = await collectAt(page, -55);

  for (const sample of [distant, approach, near]) {
    expect(sample.contextLost).toBe(false);
    expect(sample.frameTimeP95).toBeLessThanOrEqual(MAX_FRAME_TIME_P95);
  }
  expect(approach.textures).toBe(distant.textures);
  expect(near.textures).toBe(distant.textures);
});
