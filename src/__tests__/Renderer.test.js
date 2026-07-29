// @ts-check

import { afterEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({ renderers: [] }));

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal();

  class WebGLRenderer {
    constructor() {
      this.shadowMap = {};
      this.setSize = vi.fn();
      this.setPixelRatio = vi.fn();
      this.getPixelRatio = vi.fn(() => 1);
      this.getSize = vi.fn((target) => target.set(800, 600));
      this.render = vi.fn();
      this.dispose = vi.fn();
      harness.renderers.push(this);
    }
  }

  return { ...actual, WebGLRenderer };
});

import { Renderer } from '../engine/Renderer.js';

afterEach(() => {
  delete globalThis.window;
  vi.restoreAllMocks();
});

describe('Renderer startup budget', () => {
  it('renders directly without allocating post-processing on startup', () => {
    globalThis.window = {
      innerWidth: 800,
      innerHeight: 600,
      devicePixelRatio: 1,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    const renderer = new Renderer({});

    expect(renderer.composer).toBeNull();
    renderer.render(0.016);
    expect(harness.renderers.at(-1).render).toHaveBeenCalledWith(renderer.scene, renderer.camera);

    renderer.dispose();
  });
});
