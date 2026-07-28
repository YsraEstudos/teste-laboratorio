import { expect, test } from './fixtures/runtime-guard.js';

test('boots WebGL and completes the start, TacMap, pause and resume smoke flow', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page).toHaveTitle('LABORATÓRIO 3D');

  const gameCanvas = page.locator('#game-canvas');
  await expect(gameCanvas).toBeVisible();

  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }),
  );

  const webgl = await gameCanvas.evaluate((canvas) => {
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');

    if (!context) return null;

    return {
      contextLost: context.isContextLost(),
      drawingBufferWidth: context.drawingBufferWidth,
      drawingBufferHeight: context.drawingBufferHeight,
      version: context.getParameter(context.VERSION),
    };
  });

  expect(webgl).not.toBeNull();
  expect(webgl.contextLost).toBe(false);
  expect(webgl.drawingBufferWidth).toBeGreaterThan(0);
  expect(webgl.drawingBufferHeight).toBeGreaterThan(0);
  expect(webgl.version).toContain('WebGL');

  const startScreen = page.locator('#start-screen');
  await expect(startScreen.getByRole('heading', { name: 'LABORATÓRIO 3D' })).toBeVisible();
  await startScreen.getByRole('button', { name: 'ENTRAR NO LABORATÓRIO' }).click();
  await expect(startScreen).toHaveClass('overlay');

  const tacMap = page.locator('#tacmap-overlay');
  await page.keyboard.press('m');
  await expect(tacMap.getByRole('heading', { name: 'TAC-MAP // PLANTA TÁTICA DO LABORATÓRIO' })).toBeVisible();
  await expect(tacMap).toHaveClass(/active/);

  await page.keyboard.press('m');
  await expect(tacMap).toHaveClass(/hidden/);
  await expect(tacMap).not.toHaveClass(/active/);

  const pauseScreen = page.locator('#pause-screen');
  await page.keyboard.press('Escape');
  await expect(pauseScreen.getByRole('heading', { name: 'PAUSADO' })).toBeVisible();
  await expect(pauseScreen).toHaveClass(/active/);

  await pauseScreen.getByRole('button', { name: 'CONTINUAR' }).click();
  await expect(pauseScreen).toHaveClass('overlay');
});
