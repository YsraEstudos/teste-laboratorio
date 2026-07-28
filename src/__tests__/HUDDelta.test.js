import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HUD } from '../ui/HUD.js';

function createClassList() {
  const values = new Set();
  return {
    add(value) {
      values.add(value);
    },
    remove(value) {
      values.delete(value);
    },
    contains(value) {
      return values.has(value);
    },
  };
}

function createElement({ classList = createClassList(), textContent = '', style = {} } = {}) {
  const listeners = new Map();
  return {
    classList,
    textContent,
    style,
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
  };
}

function createGame(isPlaying = true) {
  return {
    isPlaying,
    input: {},
    start: vi.fn(),
    resume: vi.fn(),
    pause: vi.fn(),
    player: {
      position: { x: 0, z: 0 },
      health: 100,
    },
    lab: {
      getRoomNameAt: vi.fn(() => ''),
    },
  };
}

function installDocument() {
  const elements = {
    'start-screen': createElement(),
    'pause-screen': createElement(),
    'btn-start': createElement(),
    'btn-resume': createElement(),
    'room-name': createElement(),
    'controls-hint': createElement(),
    'health-fill': createElement(),
    'health-val': createElement(),
  };

  vi.stubGlobal('document', {
    getElementById(id) {
      return elements[id] ?? null;
    },
  });

  return elements;
}

describe('HUD timing', () => {
  beforeEach(() => {
    installDocument();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('advances the controls hint using the supplied delta', () => {
    const hud = new HUD(createGame());

    hud.update(0.5);
    hud.update(1.25);

    expect(hud._hintTimer).toBeCloseTo(1.75);
  });

  it('hides the controls hint after the same elapsed time at 30 and 60 FPS', () => {
    const thirtyFpsElements = installDocument();
    const thirtyFpsHud = new HUD(createGame());
    for (let frame = 0; frame < 183; frame += 1) thirtyFpsHud.update(1 / 30);

    const sixtyFpsElements = installDocument();
    const sixtyFpsHud = new HUD(createGame());
    for (let frame = 0; frame < 366; frame += 1) sixtyFpsHud.update(1 / 60);

    expect(thirtyFpsHud._hintTimer).toBeCloseTo(6.1);
    expect(sixtyFpsHud._hintTimer).toBeCloseTo(6.1);
    expect(thirtyFpsElements['controls-hint'].classList.contains('hidden')).toBe(true);
    expect(sixtyFpsElements['controls-hint'].classList.contains('hidden')).toBe(true);
  });
});
