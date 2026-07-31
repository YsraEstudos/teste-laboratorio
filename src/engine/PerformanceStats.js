/**
 * Returns the nearest-rank percentile without mutating the source sample.
 *
 * @param {number[]} values
 * @param {number} quantile A value between 0 and 1, inclusive.
 * @returns {number}
 */
export function percentile(values, quantile) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new TypeError('percentile requires at least one value');
  }
  if (!Number.isFinite(quantile) || quantile < 0 || quantile > 1) {
    throw new RangeError('percentile quantile must be between 0 and 1');
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * quantile) - 1);
  return sorted[Math.min(sorted.length - 1, index)];
}

function waitForAnimationFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

/**
 * Collects render timing and WebGL memory counters from a running Game.
 *
 * @param {{ game: { renderer?: { renderer?: import('three').WebGLRenderer } }, frames?: number }} options
 */
export async function collectSandSample({ game, frames = 120 }) {
  if (!game?.renderer?.renderer) {
    throw new TypeError('collectSandSample requires a running Game');
  }
  if (!Number.isInteger(frames) || frames < 2) {
    throw new RangeError('frames must be an integer of at least 2');
  }

  const renderer = game.renderer.renderer;
  const gl = renderer.getContext();
  const frameTimes = [];
  let previousFrameAt = performance.now();

  for (let index = 0; index < frames; index += 1) {
    await waitForAnimationFrame();
    const now = performance.now();
    frameTimes.push(now - previousFrameAt);
    previousFrameAt = now;
  }

  return {
    frameTimeP50: percentile(frameTimes, 0.5),
    frameTimeP95: percentile(frameTimes, 0.95),
    frameTimeP99: percentile(frameTimes, 0.99),
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    textures: renderer.info.memory.textures,
    geometries: renderer.info.memory.geometries,
    contextLost: gl.isContextLost(),
  };
}
