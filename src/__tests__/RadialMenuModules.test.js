import { describe, expect, it, vi } from 'vitest';
import { RADIAL_MENU_TOKENS, SECTOR_DEFINITIONS_DATA, createDefaultSectors } from '../ui/radial/RadialMenuConfig.js';
import { calculateArcPath } from '../ui/radial/RadialSectorBuilder.js';
import { getAngleFromPointer, getSectorIndexFromAngle, getSectorFromPointer } from '../ui/radial/RadialMenuInput.js';

describe('RadialMenu Modular System', () => {
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
    it('calculates SVG arc path correctly', () => {
      const path = calculateArcPath(0, Math.PI / 2, 100, 50, 150);
      expect(path).toContain('M 250 150');
      expect(path).toContain('A 100 100 0 0 1');
      expect(path).toContain('L 150 200');
      expect(path).toContain('Z');
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

    it('maps pointer position to sector or null if outside radius', () => {
      // Center 100, 100. Inner 50, Outer 100.
      // Point (100, 100) distance 0 -> null
      expect(getSectorFromPointer(100, 100, 100, 100, 6, 50, 100)).toBeNull();

      // Point (100, 20) distance 80 -> top sector index 0
      expect(getSectorFromPointer(100, 20, 100, 100, 6, 50, 100)).toBe(0);

      // Point (100, 0) distance 100 (outer boundary), point distance > 100 -> null
      expect(getSectorFromPointer(100, -10, 100, 100, 6, 50, 100)).toBeNull();
    });
  });
});
