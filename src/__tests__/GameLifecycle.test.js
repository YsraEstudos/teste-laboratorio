// @ts-check

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  instances: {
    profiler: [],
    input: [],
    lab: [],
    wind: [],
    player: [],
    windFX: [],
    windChild: [],
    radialMenu: [],
    tacMap: [],
    hud: [],
    webglRenderer: [],
  },
  lifecycle: [],
}));

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal();

  class WebGLRenderer {
    constructor() {
      this.shadowMap = {};
      this.setSize = vi.fn();
      this.setPixelRatio = vi.fn();
      this.render = vi.fn();
      this.dispose = vi.fn(() => harness.lifecycle.push('renderer'));
      harness.instances.webglRenderer.push(this);
    }
  }

  return {
    ...actual,
    WebGLRenderer,
  };
});

vi.mock('../engine/InputManager.js', () => ({
  InputManager: class {
    constructor() {
      this.resetMouseDelta = vi.fn();
      this.dispose = vi.fn(() => harness.lifecycle.push('input'));
      harness.instances.input.push(this);
    }
  },
}));

vi.mock('../entities/PlayerController.js', () => ({
  PlayerController: class {
    constructor() {
      this.position = { x: 0, y: 0, z: 0 };
      this.setNavigation = vi.fn();
      this.setWindForce = vi.fn();
      this.update = vi.fn();
      this.handlePointerDown = vi.fn();
      harness.instances.player.push(this);
    }
  },
}));

vi.mock('../entities/WindChild.js', () => ({
  WindChild: class {
    constructor() {
      this.position = {
        x: 0,
        y: 0,
        z: 0,
        set(x, y, z) {
          this.x = x;
          this.y = y;
          this.z = z;
          return this;
        },
        clone() {
          return { x: this.x, y: this.y, z: this.z };
        },
        distanceTo(other) {
          return Math.hypot(this.x - other.x, this.y - other.y, this.z - other.z);
        },
      };
      this.model = {
        position: {
          copy: vi.fn(),
        },
      };
      this.powerLevel = 1;
      this.happiness = 100;
      this.energy = 100;
      this.setNavigation = vi.fn();
      this.startCharging = vi.fn();
      this.stopCharging = vi.fn();
      this.releaseWindBlast = vi.fn();
      this.update = vi.fn();
      this.dispose = vi.fn(() => harness.lifecycle.push('windChild'));
      harness.instances.windChild.push(this);
    }
  },
}));

vi.mock('../effects/WindParticleSystem.js', () => ({
  WindParticleSystem: class {
    constructor() {
      this.triggerWindBlast = vi.fn();
      this.update = vi.fn();
      this.dispose = vi.fn(() => harness.lifecycle.push('windFX'));
      harness.instances.windFX.push(this);
    }
  },
}));

vi.mock('../wind/WindSystem.js', () => ({
  WindSystem: class {
    constructor() {
      this.startAudio = vi.fn();
      this.resumeAudio = vi.fn();
      this.suspendAudio = vi.fn();
      this.update = vi.fn();
      this.samplePlayerForce = vi.fn();
      this.dispose = vi.fn(() => harness.lifecycle.push('wind'));
      harness.instances.wind.push(this);
    }
  },
}));

vi.mock('../ui/RadialMenu.js', () => ({
  RadialMenu: class {
    constructor() {
      this.show = vi.fn();
      this.destroy = vi.fn(() => harness.lifecycle.push('radialMenu'));
      harness.instances.radialMenu.push(this);
    }
  },
}));

vi.mock('../ui/TacMap.js', () => ({
  TacMap: class {
    constructor() {
      this.destroy = vi.fn(() => harness.lifecycle.push('tacMap'));
      harness.instances.tacMap.push(this);
    }
  },
}));

vi.mock('../ui/HUD.js', () => ({
  HUD: class {
    constructor() {
      this.hideStart = vi.fn();
      this.hidePause = vi.fn();
      this.showPause = vi.fn();
      this.update = vi.fn();
      this.destroy = vi.fn(() => harness.lifecycle.push('hud'));
      harness.instances.hud.push(this);
    }
  },
}));

vi.mock('../engine/PerformanceProfiler.js', () => ({
  PerformanceProfiler: class {
    constructor(game) {
      this.game = game;
      this.startFrame = vi.fn();
      this.startCPU = vi.fn();
      this.endCPU = vi.fn();
      this.startGPU = vi.fn();
      this.endGPU = vi.fn();
      this.endFrame = vi.fn();
      this.destroy = vi.fn(() => harness.lifecycle.push('profiler'));
      harness.instances.profiler.push(this);
    }
  },
}));

vi.mock('../world/LaboratoryBuilder.js', () => ({
  LaboratoryBuilder: class {
    constructor() {
      this.colliders = [];
      this.doors = [];
      this.testObjects = [];
      this.update = vi.fn();
      this.dispose = vi.fn(() => harness.lifecycle.push('lab'));
      harness.instances.lab.push(this);
    }
  },
}));

vi.mock('../world/NavigationGrid.js', () => ({
  NavigationGrid: class {},
}));

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
    dispatchEvent(event) {
      for (const listener of listeners.get(event.type) ?? []) {
        listener.call(this, event);
      }
    },
    listenerCount(type) {
      return listeners.get(type)?.size ?? 0;
    },
    clearListeners() {
      listeners.clear();
    },
  };
}

const canvas = createEventTarget();
const hudElements = {
  'start-screen': createEventTarget({ classList: { add: vi.fn(), remove: vi.fn() } }),
  'pause-screen': createEventTarget({ classList: { add: vi.fn(), remove: vi.fn() } }),
  'btn-start': createEventTarget(),
  'btn-resume': createEventTarget(),
  'room-name': createEventTarget({ textContent: '' }),
  'controls-hint': createEventTarget({ classList: { add: vi.fn(), remove: vi.fn() } }),
  'health-fill': createEventTarget({ style: {} }),
  'health-val': createEventTarget({ textContent: '' }),
};
const windowTarget = createEventTarget({
  innerWidth: 1280,
  innerHeight: 720,
  devicePixelRatio: 1,
});
let domReadyHandler;
const documentTarget = createEventTarget({
  readyState: 'loading',
  getElementById(id) {
    if (id === 'game-canvas') return canvas;
    return hudElements[id] ?? null;
  },
});

const originalDocumentAddEventListener = documentTarget.addEventListener;
documentTarget.addEventListener = (type, listener) => {
  originalDocumentAddEventListener.call(documentTarget, type, listener);
  if (type === 'DOMContentLoaded') domReadyHandler = listener;
};

let nextAnimationId = 1;
const animationFrames = new Map();
const requestAnimationFrame = vi.fn((callback) => {
  const id = nextAnimationId++;
  animationFrames.set(id, callback);
  return id;
});
const cancelAnimationFrame = vi.fn((id) => {
  animationFrames.delete(id);
});

let mainModule;
let ActualHUD;

function createGame() {
  domReadyHandler();
  return harness.instances.profiler.at(-1).game;
}

function runNextAnimationFrame() {
  const entry = animationFrames.entries().next().value;
  if (!entry) throw new Error('Expected a pending animation frame');

  const [id, callback] = entry;
  animationFrames.delete(id);
  callback(performance.now());
  return id;
}

function nearbyTestObject() {
  return {
    type: 'folha_papel',
    position: {
      x: 4,
      y: 0,
      z: 4.5,
      clone() {
        return { x: this.x, y: this.y, z: this.z };
      },
    },
    velocity: {
      y: 0,
      copy: vi.fn(function (vector) {
        this.x = vector.x;
        this.y = vector.y;
        this.z = vector.z;
        return this;
      }),
      multiplyScalar: vi.fn(function (scalar) {
        this.x *= scalar;
        this.y *= scalar;
        this.z *= scalar;
        return this;
      }),
    },
  };
}

beforeAll(async () => {
  vi.stubGlobal('window', windowTarget);
  vi.stubGlobal('document', documentTarget);
  vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
  vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame);
  vi.stubGlobal('alert', vi.fn());
  mainModule = await import('../main.js');
  ({ HUD: ActualHUD } = await vi.importActual('../ui/HUD.js'));
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();

  for (const instances of Object.values(harness.instances)) {
    instances.length = 0;
  }
  harness.lifecycle.length = 0;

  animationFrames.clear();
  nextAnimationId = 1;
  windowTarget.clearListeners();
  canvas.clearListeners();
  for (const element of Object.values(hudElements)) {
    element.clearListeners();
  }
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('Game lifecycle', () => {
  it('exports Game so lifecycle ownership can be controlled explicitly', () => {
    expect(mainModule.Game).toBeTypeOf('function');
  });

  it('cancels the latest scheduled animation frame on destroy', () => {
    const game = createGame();

    runNextAnimationFrame();
    const pendingFrameId = animationFrames.keys().next().value;

    game.destroy();

    expect(cancelAnimationFrame).toHaveBeenCalledWith(pendingFrameId);
    expect(animationFrames.size).toBe(0);
  });

  it('ignores start after destroy', () => {
    const game = createGame();

    game.destroy();
    game.start();

    expect(game.isPlaying).toBe(false);
    expect(game.wind.startAudio).not.toHaveBeenCalled();
    expect(game.hud.hideStart).not.toHaveBeenCalled();
  });

  it('ignores resume after destroy', () => {
    const game = createGame();

    game.destroy();
    game.resume();

    expect(game.isPlaying).toBe(false);
    expect(game.wind.resumeAudio).not.toHaveBeenCalled();
    expect(game.hud.hidePause).not.toHaveBeenCalled();
  });

  it('cancels a pending wind blast and resets charging when paused', () => {
    const game = createGame();
    game.isPlaying = true;
    game.lab.testObjects = [nearbyTestObject()];

    game.triggerWindBlastOnObjects();
    game.pause();
    vi.runAllTimers();

    expect(game.windChild.stopCharging).toHaveBeenCalledOnce();
    expect(game.windChild.releaseWindBlast).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels a pending wind blast and resets charging when destroyed', () => {
    const game = createGame();
    game.lab.testObjects = [nearbyTestObject()];

    game.triggerWindBlastOnObjects();
    game.destroy();
    vi.runAllTimers();

    expect(game.windChild.stopCharging).toHaveBeenCalledOnce();
    expect(game.windChild.releaseWindBlast).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('allows only one pending wind blast charge at a time', () => {
    const game = createGame();
    game.lab.testObjects = [nearbyTestObject()];

    game.triggerWindBlastOnObjects();
    game.triggerWindBlastOnObjects();

    expect(game.windChild.startCharging).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(1);
  });

  it('recreates the game with exactly one active resize listener', () => {
    const firstGame = createGame();
    firstGame.destroy();

    const secondGame = createGame();

    expect(windowTarget.listenerCount('resize')).toBe(1);

    secondGame.destroy();
    expect(windowTarget.listenerCount('resize')).toBe(0);
  });

  it.each([
    ['start', 'btn-start'],
    ['resume', 'btn-resume'],
  ])('routes %s clicks only to the recreated Game', (method, buttonId) => {
    const calls = [];
    const destroyedGame = {
      destroyed: true,
      input: {},
      start: () => calls.push('destroyed:start'),
      resume: () => calls.push('destroyed:resume'),
    };
    const liveGame = {
      destroyed: false,
      input: {},
      start: () => calls.push('live:start'),
      resume: () => calls.push('live:resume'),
    };

    const destroyedHud = new ActualHUD(destroyedGame);
    destroyedHud.destroy?.();
    destroyedHud.destroy?.();
    const liveHud = new ActualHUD(liveGame);

    hudElements[buttonId].dispatchEvent({ type: 'click' });

    expect(calls).toEqual([`live:${method}`]);

    liveHud.destroy?.();
    liveHud.destroy?.();
    hudElements[buttonId].dispatchEvent({ type: 'click' });
    expect(calls).toEqual([`live:${method}`]);
  });

  it('detaches its owned InputManager callbacks idempotently', () => {
    const game = {
      input: {},
      start: () => {},
      resume: () => {},
      pause: () => {},
    };
    const hud = new ActualHUD(game);

    hud.destroy();
    hud.destroy();

    expect(game.input.onLockChange).toBeNull();
    expect(game.input.onEscape).toBeNull();
  });

  it('destroys every owned subsystem once and in lifecycle order', () => {
    const game = createGame();

    game.destroy();
    game.destroy();

    expect(harness.lifecycle).toEqual([
      'tacMap',
      'radialMenu',
      'hud',
      'profiler',
      'input',
      'windFX',
      'wind',
      'windChild',
      'lab',
      'renderer',
    ]);
    expect(canvas.listenerCount('pointerdown')).toBe(0);
    expect(canvas.listenerCount('contextmenu')).toBe(0);
  });
});
