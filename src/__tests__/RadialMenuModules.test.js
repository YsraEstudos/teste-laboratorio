import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RADIAL_MENU_TOKENS, SECTOR_DEFINITIONS_DATA, createDefaultSectors } from '../ui/radial/RadialMenuConfig.js';
import { calculateArcPath, createSectorNode, buildRadialMenuDOM } from '../ui/radial/RadialSectorBuilder.js';
import { getAngleFromPointer, getSectorIndexFromAngle, getSectorFromPointer } from '../ui/radial/RadialMenuInput.js';

function createMockElement(tagName) {
  const listeners = new Map();
  const children = [];
  const attributes = new Map();
  const classList = new Set();

  const element = {
    tagName,
    className: '',
    textContent: '',
    children,
    parentNode: null,
    classList,
    set innerHTML(val) {
      this._innerHTML = val;
      if (typeof val === 'string' && val.includes('power-title')) {
        const titleMatch = val.match(/<div class="power-title">(.*?)<\/div>/);
        if (titleMatch) {
          const titleEl = createMockElement('div');
          titleEl.className = 'power-title';
          titleEl.textContent = titleMatch[1];
          this.appendChild(titleEl);
        }
      }
    },
    get innerHTML() {
      return this._innerHTML || '';
    },
    setAttribute(key, val) {
      attributes.set(key, String(val));
      if (key === 'class') {
        classList.clear();
        String(val)
          .split(' ')
          .forEach((c) => c && classList.add(c));
      }
    },
    getAttribute(key) {
      return attributes.get(key) ?? null;
    },
    appendChild(child) {
      child.parentNode = element;
      children.push(child);
      return child;
    },
    removeChild(child) {
      const idx = children.indexOf(child);
      if (idx !== -1) children.splice(idx, 1);
      child.parentNode = null;
      return child;
    },
    remove() {
      if (this.parentNode) {
        this.parentNode.removeChild(this);
      }
    },
    addEventListener(type, cb) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(cb);
    },
    dispatchEvent(event) {
      const callbacks = listeners.get(event.type) || [];
      callbacks.forEach((cb) => cb.call(this, event));
    },
    querySelector(selector) {
      if (selector.startsWith('.')) {
        const cls = selector.slice(1);
        const find = (el) => {
          if (el.className?.includes(cls) || el.classList?.has?.(cls)) return el;
          for (const child of el.children) {
            const res = find(child);
            if (res) return res;
          }
          return null;
        };
        return find(element);
      }
      return null;
    },
    querySelectorAll(selector) {
      const matches = [];
      const tag = selector.toLowerCase();
      const find = (el) => {
        if (el.tagName?.toLowerCase() === tag) matches.push(el);
        for (const child of el.children) {
          find(child);
        }
      };
      find(element);
      return matches;
    },
  };
  return element;
}

function mockDocument() {
  const body = createMockElement('body');
  return {
    body,
    createElement: (tag) => createMockElement(tag),
    createElementNS: (_ns, tag) => createMockElement(tag),
  };
}

describe('RadialMenu Modular System', () => {
  beforeEach(() => {
    vi.stubGlobal('document', mockDocument());
    vi.stubGlobal(
      'Event',
      class Event {
        constructor(type) {
          this.type = type;
        }
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });
  describe('RadialMenuConfig', () => {
    it('provides correct default tokens and 6 sector definitions', () => {
      expect(RADIAL_MENU_TOKENS.size).toBe(340);
      expect(RADIAL_MENU_TOKENS.outerRadius).toBe(155);
      expect(RADIAL_MENU_TOKENS.innerRadius).toBe(62);
      expect(SECTOR_DEFINITIONS_DATA).toHaveLength(6);
    });

    it('creates default sectors delegating action to menu instance methods', () => {
      const mockMenu = {
        _moveToTestingRoom: vi.fn(),
        _callToPlayer: vi.fn(),
        _setPowerLevel: vi.fn(),
        _restoreStatus: vi.fn(),
        _triggerWindBlast: vi.fn(),
        _inspectDetails: vi.fn(),
      };

      const sectors = createDefaultSectors(mockMenu);
      expect(sectors).toHaveLength(6);
      sectors[0].action();
      expect(mockMenu._moveToTestingRoom).toHaveBeenCalledOnce();
      sectors[2].action(7);
      expect(mockMenu._setPowerLevel).toHaveBeenCalledWith(7);
    });
  });

  describe('RadialSectorBuilder', () => {
    let doc;

    beforeEach(() => {
      doc = mockDocument();
      vi.stubGlobal('document', doc);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('calculates SVG arc path correctly', () => {
      const path = calculateArcPath(0, Math.PI / 2, 100, 50, 150);
      expect(path).toContain('M 250 150');
      expect(path).toContain('A 100 100 0 0 1');
      expect(path).toContain('L 150 200');
      expect(path).toContain('Z');
    });

    it('constructs sector labels using span elements without innerHTML', () => {
      const sector = { id: 'test', title: 'Test Sector', icon: '⚡' };
      const node = createSectorNode(sector, 0, 4, RADIAL_MENU_TOKENS);
      const labelDiv = node.g.querySelector('.radial-label-content');
      expect(labelDiv).not.toBeNull();
      const spans = labelDiv.querySelectorAll('span');
      expect(spans).toHaveLength(2);
      expect(spans[0].className).toBe('sector-icon');
      expect(spans[0].textContent).toBe('⚡');
      expect(spans[1].className).toBe('sector-title');
      expect(spans[1].textContent).toBe('Test Sector');
    });

    it('invokes hover handler on focus and leave handler on blur', () => {
      const sector = { id: 'test', title: 'Test Sector', icon: '⚡' };
      const onHover = vi.fn();
      const onLeave = vi.fn();
      const onFocus = vi.fn();
      const node = createSectorNode(sector, 2, 4, RADIAL_MENU_TOKENS, { onHover, onLeave, onFocus });

      node.g.dispatchEvent({ type: 'focus' });
      expect(onHover).toHaveBeenCalledWith(sector, node.g);
      expect(onFocus).toHaveBeenCalledWith(2);

      node.g.dispatchEvent({ type: 'blur' });
      expect(onLeave).toHaveBeenCalledWith(node.g);
    });

    it('derives powerHtml title range dynamically from tokens', () => {
      const customTokens = { ...RADIAL_MENU_TOKENS, powerLevelMin: 1, powerLevelMax: 5 };
      const mockMenu = {
        _onSectorHover: vi.fn(),
        _onSectorLeave: vi.fn(),
        _setActiveSector: vi.fn(),
        _onSectorClick: vi.fn(),
      };
      const dom = buildRadialMenuDOM(SECTOR_DEFINITIONS_DATA, mockMenu, customTokens);
      const titleEl = dom.powerSelector.querySelector('.power-title');
      expect(titleEl.textContent).toBe('NÍVEL DE PODER (1-5)');
      dom.container.remove();
    });
  });

  describe('RadialMenuInput', () => {
    it('calculates top-relative angle from pointer coordinates', () => {
      // (100, 50) relative to center (100, 100) -> top direction -> angle should be 0
      const topAngle = getAngleFromPointer(100, 50, 100, 100);
      expect(topAngle).toBeCloseTo(0, 5);

      // (150, 100) relative to center (100, 100) -> right direction -> angle should be Math.PI/2
      const rightAngle = getAngleFromPointer(150, 100, 100, 100);
      expect(rightAngle).toBeCloseTo(Math.PI / 2, 5);
    });

    it('maps angle to sector index', () => {
      expect(getSectorIndexFromAngle(0.1, 6)).toBe(0);
      expect(getSectorIndexFromAngle(Math.PI / 3 + 0.1, 6)).toBe(1);
    });

    it('retorna 0 em getSectorIndexFromAngle quando totalSectors é <= 0', () => {
      expect(getSectorIndexFromAngle(Math.PI / 4, 0)).toBe(0);
      expect(getSectorIndexFromAngle(Math.PI / 4, -5)).toBe(0);
    });

    it('maps pointer position to sector or null if outside radius', () => {
      // Center 100, 100. Inner 50, Outer 100.
      // Point (100, 100) distance 0 (< innerRadius 50) -> null
      expect(getSectorFromPointer(100, 100, 100, 100, 6, 50, 100)).toBeNull();

      // Point (100, 50) distance 50 (exatamente no innerRadius 50) -> top sector index 0
      expect(getSectorFromPointer(100, 50, 100, 100, 6, 50, 100)).toBe(0);

      // Point (100, 20) distance 80 -> top sector index 0
      expect(getSectorFromPointer(100, 20, 100, 100, 6, 50, 100)).toBe(0);

      // Point (100, 0) distance 100 (exatamente no outerRadius 100) -> top sector index 0
      expect(getSectorFromPointer(100, 0, 100, 100, 6, 50, 100)).toBe(0);

      // Point (100, -10) distance 110 (> outerRadius 100) -> null
      expect(getSectorFromPointer(100, -10, 100, 100, 6, 50, 100)).toBeNull();
    });
  });
});
