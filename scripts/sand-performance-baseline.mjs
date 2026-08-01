/* global window */
import { collectSandSample } from '../src/engine/PerformanceStats.js';

const DEFAULT_FRAMES = 120;

export { collectSandSample };

function optionValue(name, fallback) {
  const option = process.argv.find((argument) => argument.startsWith(`${name}=`));
  return option ? option.slice(name.length + 1) : fallback;
}

const FRAMES = Number(optionValue('--frames', String(DEFAULT_FRAMES)));
const DISABLE_SAND = process.argv.includes('--disable-sand');
const DISABLE_RENDER = process.argv.includes('--disable-render');
const PAUSE_GAME = process.argv.includes('--pause-game');
const HIDE_PROFILER = process.argv.includes('--hide-profiler');
const DISABLE_SHADOWS = process.argv.includes('--disable-shadows');
const RENDER_SCALE = Number(optionValue('--render-scale', '1'));
const CHEAP_MATERIALS = process.argv.includes('--cheap-materials');
const UNLIT_MATERIALS = process.argv.includes('--unlit-materials');

async function collectAt(page, z) {
  return page.evaluate(
    async ({ z: targetZ, frames }) => {
      const game = window.__LAB_DEBUG__?.game;
      if (!game) {
        throw new Error('window.__LAB_DEBUG__.game is missing');
      }
      game.player.position.z = targetZ;
      if (game.player.model) game.player.model.position.z = targetZ;
      return game.collectSandSample({ frames });
    },
    { z, frames: FRAMES },
  );
}

async function writeBaseline() {
  const duration = Number(optionValue('--duration', '10000'));
  if (!Number.isFinite(duration) || duration < 0) {
    throw new RangeError('--duration option must be a finite non-negative number');
  }
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
    if (DISABLE_SAND) {
      await page.evaluate(() => {
        const game = window.__LAB_DEBUG__?.game;
        game.lab?.sandTerrainSystem?.mesh && (game.lab.sandTerrainSystem.mesh.visible = false);
        game.sandVFX?.dispose?.();
        game.groundDust?.dispose?.();
      });
    }
    if (
      DISABLE_RENDER ||
      PAUSE_GAME ||
      HIDE_PROFILER ||
      DISABLE_SHADOWS ||
      RENDER_SCALE !== 1 ||
      CHEAP_MATERIALS ||
      UNLIT_MATERIALS
    ) {
      await page.evaluate(
        async ({
          disableRender,
          pauseGame,
          hideProfiler,
          disableShadows,
          renderScale,
          cheapMaterials,
          unlitMaterials,
        }) => {
          const game = window.__LAB_DEBUG__?.game;
          if (disableRender) game.renderer.render = () => {};
          if (pauseGame) game.pause();
          if (hideProfiler) game.profiler.visible = false;
          if (Number.isFinite(renderScale) && renderScale > 0 && renderScale < 1) {
            const renderer = game.renderer.renderer;
            renderer.setPixelRatio(1);
            renderer.setSize(
              Math.max(1, Math.round(window.innerWidth * renderScale)),
              Math.max(1, Math.round(window.innerHeight * renderScale)),
              false,
            );
          }
          if (cheapMaterials || unlitMaterials) {
            const { MeshBasicMaterial, MeshLambertMaterial } =
              await import('/node_modules/three/build/three.module.js');
            game.renderer.scene.traverse((object) => {
              if (!object.isMesh || !object.material) return;
              const materials = Array.isArray(object.material) ? object.material : [object.material];
              const replacements = materials.map((source) => {
                if (!source?.isMeshStandardMaterial) return source;
                const materialOptions = {
                  color: source.color,
                  map: source.map,
                  transparent: source.transparent,
                  opacity: source.opacity,
                  alphaTest: source.alphaTest,
                  side: source.side,
                  depthWrite: source.depthWrite,
                  vertexColors: source.vertexColors,
                };
                if (!unlitMaterials) {
                  materialOptions.emissive = source.emissive;
                  materialOptions.emissiveMap = source.emissiveMap;
                }
                const MaterialClass = unlitMaterials ? MeshBasicMaterial : MeshLambertMaterial;
                const replacement = new MaterialClass(materialOptions);
                if (source.userData?.sandDeformationAuthoritative) {
                  replacement.onBeforeCompile = source.onBeforeCompile;
                  replacement.customProgramCacheKey = source.customProgramCacheKey;
                  replacement.userData.sandDeformationAuthoritative = true;
                }
                source.dispose();
                return replacement;
              });
              object.material = Array.isArray(object.material) ? replacements : replacements[0];
            });
          }
          if (disableShadows) {
            game.renderer.renderer.shadowMap.enabled = false;
            game.renderer.scene.traverse((object) => {
              if (object.castShadow) object.castShadow = false;
              if (object.receiveShadow) object.receiveShadow = false;
            });
          }
        },
        {
          disableRender: DISABLE_RENDER,
          pauseGame: PAUSE_GAME,
          hideProfiler: HIDE_PROFILER,
          disableShadows: DISABLE_SHADOWS,
          renderScale: RENDER_SCALE,
          cheapMaterials: CHEAP_MATERIALS,
          unlitMaterials: UNLIT_MATERIALS,
        },
      );
    }
    await page.waitForTimeout(duration);
    const samples = {
      entrance: await collectAt(page, 4.5),
      approach: await collectAt(page, -40),
      near: await collectAt(page, -55),
    };
    const metadata = await page.evaluate(() => {
      const { game, renderer, sand } = window.__LAB_DEBUG__;
      const gl = renderer.renderer.getContext();
      const materialTypes = {};
      let meshCount = 0;
      let shadowCasterCount = 0;
      renderer.scene.traverse((object) => {
        if (!object.isMesh) return;
        meshCount += 1;
        if (object.castShadow) shadowCasterCount += 1;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          const type = material?.type || 'unknown';
          materialTypes[type] = (materialTypes[type] || 0) + 1;
        }
      });
      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        dpr: window.devicePixelRatio,
        renderer: gl.getParameter(gl.RENDERER),
        webgl: gl.getParameter(gl.VERSION),
        quality: sand.getDebugStats().quality,
        sand: sand.getDebugStats(),
        isPlaying: game.isPlaying,
        scene: { meshCount, shadowCasterCount, materialTypes },
      };
    });
    const baseline = {
      generatedAt: new Date().toISOString(),
      durationMs: duration,
      browser: `Chromium ${browser.version()}`,
      ...metadata,
      samples,
    };
    await import('node:fs/promises').then(({ writeFile }) =>
      writeFile(output, `${JSON.stringify(baseline, null, 2)}\n`),
    );
    console.log(`Wrote ${output}`);
  } finally {
    await Promise.allSettled([page?.close(), browser?.close(), server?.close()]);
  }
}

if (typeof process !== 'undefined' && process.argv[1]?.endsWith('sand-performance-baseline.mjs')) {
  await writeBaseline();
}
