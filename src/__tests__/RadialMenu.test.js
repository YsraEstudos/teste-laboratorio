// @ts-check

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RadialMenu } from '../ui/RadialMenu.js';
import { getRoomById } from '../world/RoomData.js';

function createClassList(initial = '') {
  const classes = new Set(initial.split(/\s+/).filter(Boolean));
  return {
    add: (...names) => names.forEach((name) => classes.add(name)),
    remove: (...names) => names.forEach((name) => classes.delete(name)),
    contains: (name) => classes.has(name),
    toggle(name) {
      if (classes.has(name)) {
        classes.delete(name);
        return false;
      }
      classes.add(name);
      return true;
    },
  };
}

function createElement(documentTarget, tagName) {
  const listeners = new Map();
  const attributes = new Map();
  const element = {
    tagName,
    id: '',
    parentNode: null,
    children: [],
    style: {},
    classList: createClassList(),
    dataset: {},
    _innerHTML: '',
    set className(value) {
      this.classList = createClassList(value);
    },
    get className() {
      return '';
    },
    set innerHTML(value) {
      this._innerHTML = value;
    },
    get innerHTML() {
      return this._innerHTML;
    },
    setAttribute(name, value) {
      const stringValue = String(value);
      attributes.set(name, stringValue);
      if (name === 'id') this.id = stringValue;
      if (name === 'class') this.classList = createClassList(stringValue);
      if (name.startsWith('data-')) {
        const dataName = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        this.dataset[dataName] = stringValue;
      }
    },
    getAttribute(name) {
      return attributes.get(name) ?? null;
    },
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    },
    removeChild(child) {
      this.children = this.children.filter((candidate) => candidate !== child);
      child.parentNode = null;
      return child;
    },
    addEventListener(type, listener, options) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push({ listener, options });
    },
    removeEventListener(type, listener, options) {
      const entries = listeners.get(type) ?? [];
      listeners.set(
        type,
        entries.filter((entry) => entry.listener !== listener || entry.options !== options),
      );
    },
    dispatchEvent(event) {
      event.target ??= this;
      for (const { listener } of listeners.get(event.type) ?? []) listener.call(this, event);
    },
    contains(target) {
      if (target === this) return true;
      return this.children.some((child) => child.contains?.(target));
    },
    closest(selector) {
      if (selector === '.power-btn' && this.classList.contains('power-btn')) return this;
      return this.parentNode?.closest?.(selector) ?? null;
    },
    querySelectorAll(selector) {
      const matches = [];
      const visit = (node) => {
        if (selector === '.power-btn' && node.classList?.contains('power-btn')) matches.push(node);
        node.children?.forEach(visit);
      };
      visit(this);
      return matches;
    },
    focus: vi.fn(() => {
      documentTarget.activeElement = element;
    }),
    listener(type) {
      return listeners.get(type)?.[0] ?? null;
    },
  };
  return element;
}

function createWindowTarget() {
  const listeners = new Map();
  return {
    innerWidth: 1280,
    innerHeight: 720,
    addEventListener(type, listener, options) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push({ listener, options });
    },
    removeEventListener(type, listener, options) {
      const entries = listeners.get(type) ?? [];
      listeners.set(
        type,
        entries.filter((entry) => entry.listener !== listener || entry.options !== options),
      );
    },
    dispatchEvent(event) {
      for (const { listener } of listeners.get(event.type) ?? []) listener.call(this, event);
    },
    listener(type) {
      return listeners.get(type)?.[0] ?? null;
    },
    listenerCount(type) {
      return listeners.get(type)?.length ?? 0;
    },
  };
}

let canvas;
let documentTarget;
let windowTarget;
let game;

function createKeyboardEvent(key, target) {
  const event = {
    type: 'keydown',
    key,
    code: key === ' ' ? 'Space' : key,
    target,
    defaultPrevented: false,
    preventDefault: vi.fn(() => {
      event.defaultPrevented = true;
    }),
    stopPropagation: vi.fn(),
  };
  return event;
}

function appendPowerButtons(menu) {
  return Array.from({ length: 10 }, (_, index) => {
    const button = createElement(documentTarget, 'button');
    button.className = 'power-btn';
    button.dataset.level = String(index + 1);
    menu.powerSelector.appendChild(button);
    return button;
  });
}

beforeEach(() => {
  documentTarget = {
    activeElement: null,
    body: null,
    createElement(tagName) {
      return createElement(documentTarget, tagName);
    },
    createElementNS(_namespace, tagName) {
      return createElement(documentTarget, tagName);
    },
    getElementById(id) {
      if (id === 'game-canvas') return canvas;
      return null;
    },
  };
  documentTarget.body = createElement(documentTarget, 'body');
  canvas = createElement(documentTarget, 'canvas');
  canvas.id = 'game-canvas';
  windowTarget = createWindowTarget();
  game = {
    windChild: {
      name: 'Wind Child',
      position: { x: 0, z: 0 },
      powerLevel: 5,
      happiness: 80,
      energy: 90,
      moveTo: vi.fn(),
      setPowerLevel: vi.fn(),
      setHappiness: vi.fn(),
      setEnergy: vi.fn(),
    },
    player: { position: { x: 4, z: 6 } },
    lab: { getRoomNameAt: vi.fn(() => 'ENTRADA') },
    triggerWindBlastOnObjects: vi.fn(),
  };

  vi.stubGlobal('document', documentTarget);
  vi.stubGlobal('window', windowTarget);
  vi.stubGlobal('alert', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('RadialMenu keyboard and accessibility contract', () => {
  it('uses the official RoomData navigation target for the test room', () => {
    const menu = new RadialMenu(game);

    menu._moveToTestingRoom();

    const target = getRoomById('testing_room').navigation;
    expect(game.windChild.moveTo).toHaveBeenCalledWith(target.x, target.z);
  });

  it('exposes a labelled menu whose SVG sectors use roving menuitem focus', () => {
    const menu = new RadialMenu(game);

    menu.show(640, 360);

    expect(menu.container.getAttribute('role')).toBe('menu');
    expect(menu.container.getAttribute('aria-label')).toBe('Ações da Wind Child');
    expect(menu.container.getAttribute('aria-hidden')).toBe('false');
    expect(menu.sectorElements).toHaveLength(6);
    expect(menu.sectorElements.map(({ g }) => g.getAttribute('role'))).toEqual(Array(6).fill('menuitem'));
    expect(menu.sectorElements.map(({ g }) => g.getAttribute('aria-label'))).toEqual(
      menu.sectors.map(({ title }) => title),
    );
    expect(menu.sectorElements.map(({ g }) => g.getAttribute('tabindex'))).toEqual(['0', '-1', '-1', '-1', '-1', '-1']);
    expect(documentTarget.activeElement).toBe(menu.sectorElements[0].g);
  });

  it('moves focus circularly with arrow keys and activates sectors with Enter and Space', () => {
    const menu = new RadialMenu(game);
    menu.show(640, 360);

    const right = createKeyboardEvent('ArrowRight');
    windowTarget.dispatchEvent(right);
    expect(documentTarget.activeElement).toBe(menu.sectorElements[1].g);
    expect(menu.sectorElements.map(({ g }) => g.getAttribute('tabindex'))).toEqual(['-1', '0', '-1', '-1', '-1', '-1']);
    expect(right.preventDefault).toHaveBeenCalledOnce();

    const space = createKeyboardEvent(' ');
    windowTarget.dispatchEvent(space);
    expect(game.windChild.moveTo).toHaveBeenCalledWith(6.2, 6.5);
    expect(menu.active).toBe(false);
    expect(documentTarget.activeElement).toBe(canvas);

    menu.show(640, 360);
    const left = createKeyboardEvent('ArrowLeft');
    windowTarget.dispatchEvent(left);
    expect(documentTarget.activeElement).toBe(menu.sectorElements[5].g);

    const enter = createKeyboardEvent('Enter');
    windowTarget.dispatchEvent(enter);
    expect(alert).toHaveBeenCalledOnce();
    expect(menu.active).toBe(false);
  });

  it('opens the power submenu from its sector and focuses the active level button', () => {
    const menu = new RadialMenu(game);
    const powerButtons = appendPowerButtons(menu);
    menu.show(640, 360);

    windowTarget.dispatchEvent(createKeyboardEvent('ArrowRight'));
    windowTarget.dispatchEvent(createKeyboardEvent('ArrowRight'));
    windowTarget.dispatchEvent(createKeyboardEvent('Enter'));

    expect(menu.powerSelector.classList.contains('hidden')).toBe(false);
    expect(powerButtons[4].classList.contains('active')).toBe(true);
    expect(documentTarget.activeElement).toBe(powerButtons[4]);
  });

  it('lets the focused power button use native Enter activation', () => {
    const menu = new RadialMenu(game);
    const powerButtons = appendPowerButtons(menu);
    menu.show(640, 360);
    windowTarget.dispatchEvent(createKeyboardEvent('ArrowRight'));
    windowTarget.dispatchEvent(createKeyboardEvent('ArrowRight'));
    windowTarget.dispatchEvent(createKeyboardEvent('Enter'));
    const activePowerButton = powerButtons[4];

    const enter = createKeyboardEvent('Enter', activePowerButton);
    windowTarget.dispatchEvent(enter);
    if (!enter.defaultPrevented) {
      menu.powerSelector.dispatchEvent({ type: 'click', target: activePowerButton });
    }

    expect(enter.preventDefault).not.toHaveBeenCalled();
    expect(enter.stopPropagation).not.toHaveBeenCalled();
    expect(game.windChild.setPowerLevel).toHaveBeenCalledWith(5);
  });

  it('captures Escape, stops propagation, closes without pausing, and restores canvas focus', () => {
    const menu = new RadialMenu(game);
    menu.show(640, 360);
    const event = createKeyboardEvent('Escape');

    windowTarget.dispatchEvent(event);

    expect(windowTarget.listener('keydown')?.options).toBe(true);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopPropagation).toHaveBeenCalledOnce();
    expect(menu.active).toBe(false);
    expect(menu.container.getAttribute('aria-hidden')).toBe('true');
    expect(documentTarget.activeElement).toBe(canvas);
  });

  it('closes and removes listeners when destroyed while open', () => {
    const menu = new RadialMenu(game);
    menu.show(640, 360);

    menu.destroy();

    expect(menu.active).toBe(false);
    expect(windowTarget.listenerCount('keydown')).toBe(0);
    expect(windowTarget.listenerCount('pointerdown')).toBe(0);
    expect(menu.container.parentNode).toBeNull();
  });
});
