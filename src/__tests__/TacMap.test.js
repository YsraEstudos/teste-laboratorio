// @ts-check

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TacMap } from '../ui/TacMap.js';

function createEventTarget(properties = {}) {
  const listeners = new Map();

  return {
    ...properties,
    _listeners: listeners,
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    listenerCount(type) {
      return listeners.get(type)?.size ?? 0;
    },
  };
}

function createClassList() {
  const classes = new Set();
  return {
    add: (...names) => names.forEach((name) => classes.add(name)),
    remove: (...names) => names.forEach((name) => classes.delete(name)),
    contains: (name) => classes.has(name),
  };
}

function createElement(properties = {}) {
  return createEventTarget({
    classList: createClassList(),
    style: {},
    textContent: '',
    parentNode: null,
    ...properties,
  });
}

const context = {
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  save: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  restore: vi.fn(),
  closePath: vi.fn(),
  fillText: vi.fn(),
};

let windowTarget;
let documentTarget;
let elements;
let animationFrames;
let nextAnimationId;
let requestAnimationFrame;
let cancelAnimationFrame;

beforeEach(() => {
  animationFrames = new Map();
  nextAnimationId = 1;
  requestAnimationFrame = vi.fn((callback) => {
    const id = nextAnimationId++;
    animationFrames.set(id, callback);
    return id;
  });
  cancelAnimationFrame = vi.fn((id) => {
    animationFrames.delete(id);
  });

  windowTarget = createEventTarget();
  elements = {
    'tacmap-canvas': createElement({
      width: 920,
      height: 680,
      getContext: () => context,
    }),
    'tacmap-close': createElement(),
    'btn-fast-travel': createElement(),
    'tacmap-hover-title': createElement(),
    'tacmap-hover-desc': createElement(),
    'tacmap-hover-entities': createElement(),
  };

  const body = createElement({
    appendChild(element) {
      element.parentNode = body;
    },
    removeChild(element) {
      element.parentNode = null;
    },
  });

  documentTarget = {
    body,
    createElement: () => createElement(),
    getElementById: (id) => elements[id] ?? null,
  };

  vi.stubGlobal('window', windowTarget);
  vi.stubGlobal('document', documentTarget);
  vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
  vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('TacMap lifecycle', () => {
  it('cancels its pending frame and never schedules again after destroy', () => {
    const tacMap = new TacMap({});

    tacMap.show();
    const pendingFrameId = animationFrames.keys().next().value;
    const staleCallback = animationFrames.get(pendingFrameId);

    tacMap.destroy();
    tacMap.destroy();

    expect(cancelAnimationFrame).toHaveBeenCalledOnce();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(pendingFrameId);
    expect(animationFrames.size).toBe(0);
    expect(windowTarget.listenerCount('keydown')).toBe(0);

    staleCallback();
    tacMap.show();

    expect(requestAnimationFrame).toHaveBeenCalledOnce();
    expect(animationFrames.size).toBe(0);
  });

  it('removes unused legacy methods _isEntityInRoom, _getRoomCanvasBounds, _worldToCanvas', () => {
    const tacMap = new TacMap({});
    expect(tacMap._isEntityInRoom).toBeUndefined();
    expect(tacMap._getRoomCanvasBounds).toBeUndefined();
    expect(tacMap._worldToCanvas).toBeUndefined();
    tacMap.destroy();
  });

  it('sets textBaseline explicitly in TacMapRenderer.drawEntities', () => {
    const tacMap = new TacMap({
      player: { position: { x: 0, z: 0 } },
      windChild: { position: { x: 5, z: 5 } },
    });

    tacMap.renderer.drawEntities(context, tacMap.layout, 920, 680, tacMap.game, 0);
    expect(context.textBaseline).toBe('middle');
    tacMap.destroy();
  });
});
