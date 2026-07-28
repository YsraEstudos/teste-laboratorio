import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlayerController } from '../entities/PlayerController.js';
import { WindChild } from '../entities/WindChild.js';
import { HUD } from '../ui/HUD.js';
import { RadialMenu } from '../ui/RadialMenu.js';

function installDocument(elements = new Map()) {
  const canvasContext = {
    beginPath() {},
    arc() {},
    fill() {},
    stroke() {},
    fillText() {},
  };

  vi.stubGlobal('document', {
    createElement(tagName) {
      if (tagName !== 'canvas') throw new Error(`Unexpected element: ${tagName}`);
      return {
        width: 0,
        height: 0,
        getContext: () => canvasContext,
      };
    },
    getElementById: (id) => elements.get(id) ?? null,
  });
}

function createClassList(initial = []) {
  const classes = new Set(initial);
  return {
    add: (...names) => names.forEach((name) => classes.add(name)),
    remove: (...names) => names.forEach((name) => classes.delete(name)),
    contains: (name) => classes.has(name),
  };
}

function createPlayer() {
  const camera = new THREE.PerspectiveCamera();
  const input = {
    keys: {
      forward: false,
      back: false,
      left: false,
      right: false,
      sprint: false,
    },
  };
  const scene = new THREE.Scene();
  return new PlayerController(camera, input, scene);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Wind Child state ownership', () => {
  it('exposes its domain name separately from the scene node and owns the established default telemetry', () => {
    installDocument();
    const child = new WindChild(new THREE.Scene());

    expect({
      name: child.name,
      sceneNodeName: child.model.name,
      powerLevel: child.powerLevel,
      happiness: child.happiness,
      energy: child.energy,
    }).toEqual({
      name: 'Wind Child',
      sceneNodeName: 'WindChild',
      powerLevel: 5,
      happiness: 80,
      energy: 90,
    });

    child.dispose();
  });

  it('keeps player health and click movement without exposing child identity or telemetry', () => {
    const player = createPlayer();
    const waypoints = [new THREE.Vector3(1, 0, 6), new THREE.Vector3(2, 0, 6)];
    player.setNavigation({
      findPath: () => ({
        status: 'complete',
        reason: null,
        waypoints,
      }),
    });

    player.moveTo(2, 6);

    expect(player.health).toBe(100);
    expect(player.path).toEqual(waypoints);
    expect(player.destination).toEqual(new THREE.Vector3(2, 0, 6));
    expect(Object.hasOwn(player, 'name')).toBe(false);
    expect(Object.hasOwn(player, 'powerLevel')).toBe(false);
    expect(Object.hasOwn(player, 'happiness')).toBe(false);
    expect(Object.hasOwn(player, 'energy')).toBe(false);
  });
});

describe('RadialMenu state source', () => {
  it('does not display player telemetry when the Wind Child is unavailable', () => {
    const elements = new Map([
      ['radial-power-val', { textContent: 'unchanged-power' }],
      ['tooltip-hap-bar', { style: { width: 'unchanged-happiness' } }],
      ['tooltip-hap-val', { textContent: 'unchanged-happiness' }],
      ['tooltip-nrg-bar', { style: { width: 'unchanged-energy' } }],
      ['tooltip-nrg-val', { textContent: 'unchanged-energy' }],
    ]);
    installDocument(elements);
    const powerButton = {
      dataset: { level: '9' },
      classList: createClassList(),
    };
    const menu = {
      game: {
        windChild: null,
        player: {
          powerLevel: 9,
          happiness: 15,
          energy: 25,
        },
      },
      powerSelector: {
        querySelectorAll: () => [powerButton],
      },
    };

    RadialMenu.prototype._updateTelemetry.call(menu);

    expect(elements.get('radial-power-val').textContent).toBe('unchanged-power');
    expect(elements.get('tooltip-hap-val').textContent).toBe('unchanged-happiness');
    expect(elements.get('tooltip-nrg-val').textContent).toBe('unchanged-energy');
    expect(powerButton.classList.contains('active')).toBe(false);
  });

  it('closes safely instead of opening when the Wind Child is unavailable', () => {
    const containerClasses = createClassList(['active']);
    const powerClasses = createClassList();
    const menu = {
      game: { windChild: null, player: { powerLevel: 9, happiness: 15, energy: 25 } },
      active: true,
      container: {
        classList: containerClasses,
        style: {},
      },
      powerSelector: {
        classList: powerClasses,
        querySelectorAll: () => [],
      },
      _updateTelemetry: () => RadialMenu.prototype._updateTelemetry.call(menu),
      hide: () => RadialMenu.prototype.hide.call(menu),
    };
    vi.stubGlobal('window', { innerWidth: 1280, innerHeight: 720 });
    installDocument();

    RadialMenu.prototype.show.call(menu, 400, 300);

    expect(menu.active).toBe(false);
    expect(containerClasses.contains('active')).toBe(false);
    expect(containerClasses.contains('hidden')).toBe(true);
  });

  it('identifies the inspected subject with the Wind Child domain name', () => {
    const alertSpy = vi.fn();
    vi.stubGlobal('alert', alertSpy);
    const child = {
      name: 'Wind Child',
      position: { x: 3, z: -54 },
      powerLevel: 5,
      happiness: 80,
      energy: 90,
    };
    const menu = {
      game: {
        windChild: child,
        lab: { getRoomNameAt: () => 'SALA DE TESTES - CONFIRMED 42' },
      },
    };

    RadialMenu.prototype._inspectDetails.call(menu);

    expect(alertSpy).toHaveBeenCalledWith(
      'Wind Child (CONFIRMED 42 SUBJECT):\n' +
        '• Local: SALA DE TESTES - CONFIRMED 42\n' +
        '• Nível de Poder: 5/10\n' +
        '• Felicidade: 80%\n' +
        '• Energia: 90%',
    );
  });
});

describe('game HUD regression', () => {
  it('continues deriving the current room and health from the player', () => {
    const getRoomNameAt = vi.fn(() => 'CENTRAL');
    const hud = {
      game: {
        player: {
          position: { x: 4, z: 7 },
          health: 73,
        },
        windChild: new Proxy(
          {},
          {
            get() {
              throw new Error('HUD must not read Wind Child state');
            },
          },
        ),
        lab: { getRoomNameAt },
        isPlaying: false,
      },
      roomName: { textContent: '' },
      healthFill: { style: {} },
      healthVal: { textContent: '' },
      controlsHint: { classList: createClassList(['hidden']) },
      _hintTimer: 0,
      _lastHealth: -1,
      _lastRoom: '',
    };

    HUD.prototype.update.call(hud);

    expect(getRoomNameAt).toHaveBeenCalledWith(4, 7);
    expect(hud.roomName.textContent).toBe('CENTRAL');
    expect(hud.healthFill.style.transform).toBe('scaleX(0.73)');
    expect(hud.healthVal.textContent).toBe(73);
  });
});
