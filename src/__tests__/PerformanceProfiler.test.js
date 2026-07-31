import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PerformanceProfiler } from '../engine/PerformanceProfiler.js';

/**
 * Minimal DOM stub sufficient for PerformanceProfiler (node env, no jsdom).
 * The profiler only needs createElement, body.appendChild, getElementById,
 * classList, listeners and a 2d canvas context.
 */
function createClassList() {
  const set = new Set();
  return {
    add: (...cls) => cls.forEach((c) => set.add(c)),
    remove: (...cls) => cls.forEach((c) => set.delete(c)),
    contains: (cls) => set.has(cls),
    toggle: (cls, force) => {
      const has = set.has(cls);
      const want = force === undefined ? !has : force;
      if (want) set.add(cls);
      else set.delete(cls);
      return want;
    },
  };
}

function createElementStub() {
  return {
    id: '',
    parentNode: null,
    children: [],
    style: {},
    classList: createClassList(),
    innerHTML: '',
    textContent: '',
    width: 0,
    height: 0,
    listeners: {},
    addEventListener(type, fn) {
      (this.listeners[type] ||= []).push(fn);
    },
    removeEventListener(type, fn) {
      this.listeners[type] = (this.listeners[type] || []).filter((f) => f !== fn);
    },
    dispatch(type, event) {
      for (const fn of this.listeners[type] || []) fn(event);
    },
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
    },
    removeChild(child) {
      const index = this.children.indexOf(child);
      if (index >= 0) {
        this.children.splice(index, 1);
        child.parentNode = null;
      }
    },
    getContext() {
      return { clearRect() {}, fillRect() {} };
    },
  };
}

function installDom() {
  const elementsById = new Map();
  const body = createElementStub();
  const windowListeners = {};

  globalThis.document = {
    body,
    createElement(tag) {
      const el = createElementStub();
      if (tag === 'canvas') {
        el.width = 280;
        el.height = 42;
      }
      return el;
    },
    // The profiler builds HTML via innerHTML; elements it later queries by id
    // are auto-created deterministically (same id -> same element).
    getElementById(id) {
      if (!elementsById.has(id)) {
        const el = createElementStub();
        el.id = id;
        elementsById.set(id, el);
      }
      return elementsById.get(id);
    },
  };

  const windowStub = {
    addEventListener(type, fn) {
      (windowListeners[type] ||= []).push(fn);
    },
    removeEventListener(type, fn) {
      windowListeners[type] = (windowListeners[type] || []).filter((f) => f !== fn);
    },
    dispatchKey(type, event) {
      for (const fn of windowListeners[type] || []) fn(event);
    },
    screen: {},
    innerWidth: 1920,
    innerHeight: 1080,
    devicePixelRatio: 1,
  };
  globalThis.window = windowStub;

  return { body, window: windowStub, windowListeners };
}

function uninstallDom() {
  delete globalThis.document;
  delete globalThis.window;
}

function createFakeRenderer() {
  const info = { render: { calls: 17, triangles: 4096 }, memory: { geometries: 12, textures: 8 } };
  let infoReads = 0;
  const renderer = {
    info: new Proxy(info, {
      get(target, prop) {
        infoReads += 1;
        return target[prop];
      },
    }),
    get infoReads() {
      return infoReads;
    },
  };
  return renderer;
}

describe('PerformanceProfiler visibility', () => {
  beforeEach(() => {
    installDom();
  });

  afterEach(() => {
    uninstallDom();
  });

  it('starts visible with the DOM attached', () => {
    const profiler = new PerformanceProfiler({});
    expect(profiler.visible).toBe(true);
    expect(profiler.container.classList.contains('collapsed')).toBe(false);
    expect(profiler.destroy());
  });

  it('setVisible(false) collapses the container immediately', () => {
    const profiler = new PerformanceProfiler({});
    profiler.setVisible(false);
    expect(profiler.visible).toBe(false);
    expect(profiler.container.classList.contains('collapsed')).toBe(true);
    profiler.destroy();
  });

  it('setVisible(true) restores the container immediately', () => {
    const profiler = new PerformanceProfiler({});
    profiler.setVisible(false);
    profiler.setVisible(true);
    expect(profiler.visible).toBe(true);
    expect(profiler.container.classList.contains('collapsed')).toBe(false);
    profiler.destroy();
  });

  it('hiding closes the details modal', () => {
    const profiler = new PerformanceProfiler({});
    profiler.openModal();
    expect(profiler.isModalOpen).toBe(true);
    profiler.setVisible(false);
    expect(profiler.isModalOpen).toBe(false);
    expect(profiler.modalEl.classList.contains('hidden')).toBe(true);
    profiler.destroy();
  });

  it('toggle() stays consistent with setVisible', () => {
    const profiler = new PerformanceProfiler({});
    profiler.setVisible(false);
    profiler.toggle();
    expect(profiler.visible).toBe(true);
    profiler.toggle();
    expect(profiler.visible).toBe(false);
    profiler.destroy();
  });

  it('repeated setVisible(false) does not duplicate DOM nodes', () => {
    const { body } = installDom();
    const profiler = new PerformanceProfiler({});
    profiler.setVisible(false);
    profiler.setVisible(false);
    profiler.setVisible(false);
    expect(body.children.length).toBe(2); // container + modal
    profiler.destroy();
  });

  it('does not collect metrics, history, or renderer info while hidden', () => {
    const profiler = new PerformanceProfiler({});
    const renderer = createFakeRenderer();
    profiler.setVisible(false);

    const historyBefore = [...profiler.frameHistory];
    for (let i = 0; i < 10; i += 1) {
      profiler.startFrame(1000 + i * 16.7);
      profiler.startCPU();
      profiler.endCPU();
      profiler.startGPU();
      profiler.endGPU();
      profiler.endFrame(renderer);
    }

    expect(renderer.infoReads).toBe(0);
    expect(profiler.frameHistory).toEqual(historyBefore);
    expect(profiler.drawCalls).toBe(0);
    profiler.destroy();
  });

  it('does not touch the DOM while hidden', () => {
    const profiler = new PerformanceProfiler({});
    profiler.setVisible(false);
    profiler.fps = 12;
    profiler.endFrame(createFakeRenderer());
    expect(profiler.fpsValEl.textContent).not.toBe(12);
    profiler.destroy();
  });

  it('resumes collection immediately after re-show', () => {
    const profiler = new PerformanceProfiler({});
    const renderer = createFakeRenderer();
    profiler.setVisible(false);
    profiler.setVisible(true);

    profiler.startFrame(performance.now());
    profiler.startCPU();
    profiler.endCPU();
    profiler.startGPU();
    profiler.endGPU();
    profiler.endFrame(renderer);

    expect(renderer.infoReads).toBeGreaterThan(0);
    expect(profiler.drawCalls).toBe(17);
    expect(profiler.triangles).toBe(4096);
    profiler.destroy();
  });

  it('F2 key still toggles visibility', () => {
    const { window } = installDom();
    const profiler = new PerformanceProfiler({});
    profiler.setVisible(false);
    window.dispatchKey('keydown', { code: 'F2', preventDefault() {} });
    expect(profiler.visible).toBe(true);
    profiler.destroy();
  });

  it('destroy removes DOM and listeners without throwing', () => {
    const { body, windowListeners } = installDom();
    const profiler = new PerformanceProfiler({});
    profiler.destroy();
    expect(body.children.length).toBe(0);
    expect(windowListeners.keydown.length).toBe(0);
  });
});
