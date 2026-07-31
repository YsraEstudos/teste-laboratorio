/* global process, window, console */
import { collectSandSample } from '../src/engine/PerformanceStats.js';

const DEFAULT_FRAMES = 120;

export { collectSandSample };

function optionValue(name, fallback) {
  const option = process.argv.find((argument) => argument.startsWith(`${name}=`));
  return option ? option.slice(name.length + 1) : fallback;
}

async function collectAt(page, z) {
  return page.evaluate(async ({ z: targetZ, frames }) => {
    const game = window.__LAB_DEBUG__?.game;
    game.player.position.z = targetZ;
    if (game.player.model) game.player.model.position.z = targetZ;
    return game.collectSandSample({ frames });
  }, { z, frames: DEFAULT_FRAMES });
}

async function writeBaseline() {
  const duration = Number(optionValue('--duration', '10000'));
  const output = optionValue('--output', 'docs/sand-performance-before.json');
  let server;
  let browser;
  let page;

  try {
    const { chromium } = await import('@playwright/test');
    const { createServer } = await import('vite');
    server = await createServer({
      mode: 'e2e',
      logLevel: 'error',
      server: { host: '127.0.0.1', port: 4173, strictPort: true },
    });
    await server.listen();
    browser = await chromium.launch();
    page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'ENTRAR NO LABORATÓRIO' }).click();
    await page.waitForTimeout(duration);
    const samples = {
      entrance: await collectAt(page, 4.5),
      approach: await collectAt(page, -40),
      near: await collectAt(page, -55),
    };
    const metadata = await page.evaluate(() => {
      const { game, renderer, sand } = window.__LAB_DEBUG__;
      const gl = renderer.renderer.getContext();
      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        dpr: window.devicePixelRatio,
        renderer: gl.getParameter(gl.RENDERER),
        webgl: gl.getParameter(gl.VERSION),
        quality: sand.getDebugStats().quality,
        sand: sand.getDebugStats(),
        isPlaying: game.isPlaying,
      };
    });
    const baseline = {
      generatedAt: new Date().toISOString(),
      durationMs: duration,
      browser: `Chromium ${browser.version()}`,
      ...metadata,
      samples,
    };
    await import('node:fs/promises').then(({ writeFile }) => writeFile(output, `${JSON.stringify(baseline, null, 2)}\n`));
    console.log(`Wrote ${output}`);
  } finally {
    await Promise.allSettled([
      page?.close(),
      browser?.close(),
      server?.close(),
    ]);
  }
}

if (typeof process !== 'undefined' && process.argv[1]?.endsWith('sand-performance-baseline.mjs')) {
  await writeBaseline();
}
