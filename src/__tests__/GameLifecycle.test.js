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
  raycastHits: [],
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

  class Raycaster {
    constructor() {
      this.setFromCamera = vi.fn();
      this.intersectObjects = vi.fn(() => harness.raycastHits);
    }
  }

  return {
    ...actual,
    WebGLRenderer,
    Raycaster,
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
      this.model = { name: 'Player', userData: { interactiveType: 'player', isPlayer: true }, parent: null };
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
          return { x: this.x, y: this.y, z: this.z, clone: this.clone };
        },
        distanceTo(other) {
          return Math.hypot(this.x - other.x, this.y - other.y, this.z - other.z);
        },
      };
      this.model = {
        name: 'WindChild',
        userData: { interactiveType: 'wind-child', isWindChild: true },
        parent: null,
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

vi.mock('../wind/WindSystem.js', async () => {
  const { applyWindImpulseToObject } = await import('../wind/WindImpulse.js');
  return {
    WindSystem: class {
      constructor() {
        this.startAudio = vi.fn();
        this.resumeAudio = vi.fn();
        this.suspendAudio = vi.fn();
        this.update = vi.fn();
        this.samplePlayerForce = vi.fn();
        this.applyImpulse = vi.fn((impulse, objects) => {
          let applied = 0;
          for (const object of objects) {
            if (applyWindImpulseToObject(object, impulse, 0)) applied += 1;
          }
          return applied;
        });
        this.dispose = vi.fn(() => harness.lifecycle.push('wind'));
        harness.instances.wind.push(this);
      }
    },
  };
});

vi.mock('../ui/RadialMenu.js', () => ({
  RadialMenu: class {
    constructor() {
      this.show = vi.fn();
      this.hide = vi.fn();
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

const canvas = createEventTarget({
  getBoundingClientRect: () => ({ left: 10, top: 20, width: 1000, height: 500 }),
  focus: vi.fn(),
});
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

function runAnimationFrames(game, count, delta = 0.05) {
  game.clock.getDelta = vi.fn(() => delta);
  for (let index = 0; index < count; index += 1) runNextAnimationFrame();
}

function nearbyTestObject() {
  return {
    type: 'folha_papel',
    position: {
      x: 4,
      y: 0,
      z: 4.5,
      clone() {
        return { x: this.x, y: this.y, z: this.z, clone: this.clone };
      },
    },
    velocity: {
      x: 0,
      y: 0,
      z: 0,
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
  harness.raycastHits.length = 0;

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

  it('opens the radial menu only when the closest raycast hit belongs to the real Wind Child model', () => {
    const game = createGame();
    game.isPlaying = true;
    const childMesh = { parent: game.windChild.model, userData: {} };

    harness.raycastHits.push({ object: childMesh });
    const event = {
      type: 'contextmenu',
      clientX: 510,
      clientY: 270,
      preventDefault: vi.fn(),
    };
    canvas.dispatchEvent(event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(game._pointer).toMatchObject({ x: 0, y: 0 });
    expect(game._raycaster.setFromCamera).toHaveBeenCalledWith(game._pointer, game.renderer.camera);
    expect(game.radialMenu.show).toHaveBeenCalledWith(510, 270);
  });

  it.each([
    ['ground', { name: 'Floor', userData: {}, parent: null }],
    ['Player', { name: 'PlayerMesh', userData: {}, parent: null }],
  ])('does not open the radial menu when the closest raycast hit is %s', (_label, object) => {
    const game = createGame();
    game.isPlaying = true;
    if (object.name === 'PlayerMesh') object.parent = game.player.model;
    harness.raycastHits.push({ object });

    canvas.dispatchEvent({
      type: 'contextmenu',
      clientX: 510,
      clientY: 270,
      preventDefault: vi.fn(),
    });

    expect(game.radialMenu.show).not.toHaveBeenCalled();
  });

  it('preserves the Player left-click handler while adding Wind Child picking', () => {
    const game = createGame();
    game.isPlaying = true;
    const event = { type: 'pointerdown', button: 0, clientX: 200, clientY: 300 };

    canvas.dispatchEvent(event);

    expect(game.player.handlePointerDown).toHaveBeenCalledOnce();
    expect(game.player.handlePointerDown).toHaveBeenCalledWith(event);
    expect(game.radialMenu.show).not.toHaveBeenCalled();
  });

  it('closes the radial menu before pausing the game', () => {
    const game = createGame();
    game.isPlaying = true;

    game.pause();

    expect(game.radialMenu.hide).toHaveBeenCalledOnce();
    expect(game.isPlaying).toBe(false);
  });

  it('cancels the latest scheduled animation frame on destroy', () => {
    const game = createGame();

    runNextAnimationFrame();
    const pendingFrameId = animationFrames.keys().next().value;

    game.destroy();

    expect(cancelAnimationFrame).toHaveBeenCalledWith(pendingFrameId);
    expect(animationFrames.size).toBe(0);
  });

  it('forwards the real frame delta to the HUD', () => {
    const game = createGame();
    game.isPlaying = true;
    game.clock.getDelta = vi.fn(() => 0.03);

    runNextAnimationFrame();

    expect(game.hud.update).toHaveBeenCalledWith(0.03);
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

  it('cancels a pending wind blast without energy cost when paused', () => {
    const game = createGame();
    game.isPlaying = true;
    game.lab.testObjects = [nearbyTestObject()];

    game.triggerWindBlastOnObjects();
    expect(game.windAbility.state).toBe('charging');

    game.pause();
    game.windAbility.update(1);

    expect(game.windAbility.state).toBe('ready');
    expect(game.windChild.energy).toBe(100);
    expect(game.windChild.stopCharging).toHaveBeenCalledOnce();
    expect(game.windChild.releaseWindBlast).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('disposes a pending wind blast without releasing it when destroyed', () => {
    const game = createGame();
    game.lab.testObjects = [nearbyTestObject()];

    game.triggerWindBlastOnObjects();
    game.destroy();

    expect(game.windAbility.disposed).toBe(true);
    expect(game.windChild.stopCharging).toHaveBeenCalledOnce();
    expect(game.windChild.releaseWindBlast).not.toHaveBeenCalled();
    expect(game.windChild.energy).toBe(100);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('allows only one frame-driven wind blast charge at a time', () => {
    const game = createGame();
    game.lab.testObjects = [nearbyTestObject()];

    game.triggerWindBlastOnObjects();
    game.triggerWindBlastOnObjects();

    expect(game.windAbility.state).toBe('charging');
    expect(game.windChild.startCharging).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('releases against the target, positions, and attributes selected at charge start', () => {
    const game = createGame();
    const selectedTarget = nearbyTestObject();
    game.lab.testObjects = [selectedTarget];
    game.isPlaying = true;

    game.triggerWindBlastOnObjects();
    game.windChild.position.set(100, 0, 100);
    selectedTarget.position.x = 200;
    selectedTarget.position.z = 200;
    game.windChild.powerLevel = 10;
    game.windChild.happiness = 0;
    game.windChild.energy = 50;

    runAnimationFrames(game, 14);

    expect(game.windFX.triggerWindBlast).toHaveBeenCalledOnce();
    const [releasedOrigin, releasedTarget, releasedPower, releasedImpulse] = game.windFX.triggerWindBlast.mock.calls[0];
    expect(releasedOrigin).toMatchObject({ x: 3.2, y: 0, z: 4.5 });
    expect(releasedTarget).toMatchObject({ x: 4, y: 0, z: 4.5 });
    expect(releasedPower).toBe(1);
    expect(Object.isFrozen(releasedOrigin)).toBe(true);
    expect(Object.isFrozen(releasedTarget)).toBe(true);
    expect(releasedImpulse.source).toBe('blast');
    expect(Object.isFrozen(releasedImpulse)).toBe(true);
    expect(selectedTarget.velocity.x).toBeCloseTo(5.7);
    expect(selectedTarget.velocity.y).toBeCloseTo(4.3);
    expect(game.windChild.energy).toBe(40);
  });

  it('keeps visual release and replacement blast velocity before additive ambient wind', () => {
    const game = createGame();
    const events = [];
    const selectedTarget = nearbyTestObject();
    selectedTarget.velocity.x = 50;
    selectedTarget.velocity.y = 50;
    selectedTarget.velocity.z = 50;
    selectedTarget.velocity.copy.mockImplementation(function (vector) {
      events.push('velocity-copy');
      this.x = vector.x;
      this.y = vector.y;
      this.z = vector.z;
      return this;
    });
    selectedTarget.velocity.multiplyScalar.mockImplementation(function (scalar) {
      events.push('velocity-scale');
      this.x *= scalar;
      this.y *= scalar;
      this.z *= scalar;
      return this;
    });
    game.windChild.stopCharging.mockImplementation(() => events.push('stop-charging'));
    game.windChild.releaseWindBlast.mockImplementation(() => events.push('release-visual'));
    game.windFX.triggerWindBlast.mockImplementation(() => events.push('blast-fx'));
    game.lab.update.mockImplementation(() => {
      if (game.windAbility.state !== 'cooldown') return;
      events.push('ambient-add');
      selectedTarget.velocity.x += 2;
    });
    game.lab.testObjects = [selectedTarget];
    game.isPlaying = true;

    game.triggerWindBlastOnObjects();
    runAnimationFrames(game, 13);
    events.length = 0;
    runAnimationFrames(game, 1);

    expect(events).toEqual([
      'stop-charging',
      'release-visual',
      'blast-fx',
      'velocity-copy',
      'velocity-scale',
      'ambient-add',
    ]);
    expect(selectedTarget.velocity.x).toBeCloseTo(7.7);
    expect(selectedTarget.velocity.y).toBeCloseTo(4.3);
  });

  it('freezes the wind blast cooldown while the Game is paused', () => {
    const game = createGame();
    game.lab.testObjects = [nearbyTestObject()];
    game.isPlaying = true;

    game.triggerWindBlastOnObjects();
    runAnimationFrames(game, 14);
    expect(game.windAbility.state).toBe('cooldown');

    game.pause();
    game.windAbility.update(10);
    expect(game.windAbility.state).toBe('cooldown');

    game.resume();
    runAnimationFrames(game, 14);
    expect(game.windAbility.state).toBe('cooldown');

    runAnimationFrames(game, 1);
    expect(game.windAbility.state).toBe('ready');
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
