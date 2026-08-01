/* global window */

const DEFAULT_FRAMES = 30;
const DEFAULT_BRUSHES = 96;

function optionValue(name, fallback) {
  const option = process.argv.find((argument) => argument.startsWith(`${name}=`));
  return option ? option.slice(name.length + 1) : fallback;
}

const FRAMES = Number(optionValue('--frames', String(DEFAULT_FRAMES)));
const BRUSHES = Number(optionValue('--brushes', String(DEFAULT_BRUSHES)));
const OUTPUT = optionValue('--output', 'docs/sand-backend-benchmark.json');

async function run() {
  const { chromium } = await import('@playwright/test');
  const { createServer } = await import('vite');
  const server = await createServer({
    mode: 'e2e',
    logLevel: 'error',
    server: { host: '127.0.0.1', port: 4173, strictPort: true },
  });
  let browser;

  try {
    await server.listen();
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'ENTRAR NO LABORATÓRIO' }).click();

    const result = await page.evaluate(
      async ({ frames, brushes }) => {
        const { SandDeformationField } = await import('/src/world/SandDeformationField.js');
        const debug = window.__LAB_DEBUG__;
        const renderer = debug.renderer.renderer;
        const scene = debug.game.renderer.scene;
        debug.game.pause();
        const runs = [];

        for (const experimentalGpu of [false, true]) {
          const field = new SandDeformationField({
            renderer,
            scene,
            resolution: 256,
            maxBrushesPerFrame: brushes,
            experimentalGpu,
          });
          const start = performance.now();
          for (let frame = 0; frame < frames; frame += 1) {
            for (let index = 0; index < brushes; index += 1) {
              const x = -11.5 + ((index * 37 + frame * 3) % 230) / 10;
              const z = -63.5 + ((index * 17 + frame * 5) % 165) / 10;
              field.brush(x, z, 0.18, 0.08, 0.02, 0.5);
            }
            field.flush(1 / 60);
            field.consumeDirty();
          }
          const elapsedMs = performance.now() - start;
          runs.push({
            requestedBackend: experimentalGpu ? 'gpuPingPong' : 'cpuR8',
            backend: field.backend,
            frames,
            brushes,
            totalMs: Number(elapsedMs.toFixed(2)),
            msPerFrame: Number((elapsedMs / frames).toFixed(3)),
            stats: field.getStats(),
          });
          field.dispose();
        }
        return {
          browser: navigator.userAgent,
          renderer: renderer.getContext().getParameter(renderer.getContext().RENDERER),
          webgl: renderer.getContext().getParameter(renderer.getContext().VERSION),
          runs,
        };
      },
      { frames: FRAMES, brushes: BRUSHES },
    );

    const output = {
      generatedAt: new Date().toISOString(),
      ...result,
    };
    const { writeFile } = await import('node:fs/promises');
    await writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
    console.log(`Wrote ${OUTPUT}`);
  } finally {
    await Promise.allSettled([browser?.close(), server.close()]);
  }
}

if (typeof process !== 'undefined' && process.argv[1]?.endsWith('sand-backend-benchmark.mjs')) {
  await run();
}
