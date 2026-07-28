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

function installRadialDocument() {
  const elements = new Map();

  function registerMarkup(markup) {
    const tagPattern = /<[\w-]+\b([^>]*\bid="([^"]+)"[^>]*)>([^<]*)/g;
    for (const match of markup.matchAll(tagPattern)) {
      const [, attributes, id, content] = match;
      const width = attributes.match(/style="[^"]*\bwidth:\s*([^;"\s]+%)/)?.[1];
      elements.set(id, {
        textContent: content.trim(),
        style: width ? { width } : {},
        classList: createClassList(),
      });
    }
  }

  function createElement() {
    const children = [];
    let innerHTML = '';
    const element = {
      children,
      classList: createClassList(),
      style: {},
      parentNode: null,
      appendChild(child) {
        child.parentNode = this;
        children.push(child);
        return child;
      },
      removeChild(child) {
        const index = children.indexOf(child);
        if (index >= 0) children.splice(index, 1);
        child.parentNode = null;
      },
      setAttribute(name, value) {
        this[name] = value;
      },
      addEventListener() {},
      removeEventListener() {},
      contains(target) {
        return target === this || children.some((child) => child.contains?.(target));
      },
      querySelectorAll() {
        return [];
      },
    };
    Object.defineProperty(element, 'innerHTML', {
      get: () => innerHTML,
      set(value) {
        innerHTML = value;
        registerMarkup(value);
      },
    });
    return element;
  }

  const body = createElement();
  vi.stubGlobal('document', {
    body,
    createElement,
    createElementNS: createElement,
    getElementById: (id) => elements.get(id) ?? null,
  });
  vi.stubGlobal('window', {
    addEventListener() {},
    removeEventListener() {},
  });
  return elements;
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

  it('uses player technical identity while preserving model click selection', () => {
    const player = createPlayer();
    player.deselect();
    player.camera.userData.canvas = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    };
    player._raycaster.setFromCamera = vi.fn();
    player._raycaster.intersectObject = vi.fn(() => [{ object: player.model }]);

    const handled = player.handlePointerDown({ button: 0, clientX: 400, clientY: 300 });

    expect(player.model.name).toBe('Player');
    expect(player.model.userData).toMatchObject({
      interactiveType: 'player',
      isPlayer: true,
    });
    expect(Object.hasOwn(player.model.userData, 'isWindChild')).toBe(false);
    expect(handled).toBe(true);
    expect(player.selected).toBe(true);
    expect(player.selectionRing.visible).toBe(true);
  });
});

describe('RadialMenu state source', () => {
  it('renders the Wind Child established defaults before the first telemetry refresh', () => {
    const elements = installRadialDocument();
    const menu = new RadialMenu({ windChild: null });

    expect(elements.get('radial-power-val').textContent).toBe('5');
    expect(elements.get('tooltip-hap-bar').style.width).toBe('80%');
    expect(elements.get('tooltip-hap-val').textContent).toBe('80%');
    expect(elements.get('tooltip-nrg-bar').style.width).toBe('90%');
    expect(elements.get('tooltip-nrg-val').textContent).toBe('90%');

    menu.destroy();
  });

  it('does not render a partial Wind Child telemetry object with missing attributes', () => {
    const elements = new Map([
      ['radial-power-val', { textContent: 'unchanged-power' }],
      ['tooltip-hap-bar', { style: { width: 'unchanged-happiness' } }],
      ['tooltip-hap-val', { textContent: 'unchanged-happiness' }],
      ['tooltip-nrg-bar', { style: { width: 'unchanged-energy' } }],
      ['tooltip-nrg-val', { textContent: 'unchanged-energy' }],
    ]);
    installDocument(elements);
    const menu = {
      game: {
        windChild: {
          powerLevel: 5,
          energy: 90,
        },
      },
      powerSelector: {
        querySelectorAll: () => [],
      },
    };

    RadialMenu.prototype._updateTelemetry.call(menu);

    expect(elements.get('radial-power-val').textContent).toBe('unchanged-power');
    expect(elements.get('tooltip-hap-bar').style.width).toBe('unchanged-happiness');
    expect(elements.get('tooltip-hap-val').textContent).toBe('unchanged-happiness');
    expect(elements.get('tooltip-nrg-bar').style.width).toBe('unchanged-energy');
    expect(elements.get('tooltip-nrg-val').textContent).toBe('unchanged-energy');
  });

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
