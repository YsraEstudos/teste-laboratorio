import { RADIAL_MENU_TOKENS } from './RadialMenuConfig.js';

/**
 * Calculates angle in radians [0, 2*Math.PI) from center to pointer position,
 * starting from top (-90 degrees / -Math.PI / 2).
 * @param {number} px Pointer X coordinate.
 * @param {number} py Pointer Y coordinate.
 * @param {number} cx Center X coordinate.
 * @param {number} cy Center Y coordinate.
 * @returns {number} Angle in radians [0, 2*Math.PI).
 */
export function getAngleFromPointer(px, py, cx, cy) {
  const dx = px - cx;
  const dy = py - cy;
  let angle = Math.atan2(dy, dx) + Math.PI / 2;
  if (angle < 0) {
    angle += 2 * Math.PI;
  }
  return angle;
}

/**
 * Maps an angle [0, 2*Math.PI) to a sector index.
 * @param {number} angle Angle in radians [0, 2*Math.PI).
 * @param {number} totalSectors Total number of sectors.
 * @returns {number} Sector index [0..totalSectors - 1].
 */
export function getSectorIndexFromAngle(angle, totalSectors) {
  if (totalSectors <= 0) return 0;
  const sectorAngle = (2 * Math.PI) / totalSectors;
  const index = Math.floor(angle / sectorAngle);
  return Math.min(Math.max(index, 0), totalSectors - 1);
}

/**
 * Maps pointer position to a sector index given menu parameters.
 * @param {number} px Pointer X coordinate.
 * @param {number} py Pointer Y coordinate.
 * @param {number} cx Center X coordinate.
 * @param {number} cy Center Y coordinate.
 * @param {number} totalSectors Total sector count.
 * @param {number} innerRadius Inner radius threshold.
 * @param {number} outerRadius Outer radius threshold.
 * @returns {number|null} Sector index or null if distance is outside radii.
 */
export function getSectorFromPointer(
  px,
  py,
  cx,
  cy,
  totalSectors,
  innerRadius = RADIAL_MENU_TOKENS.innerRadius,
  outerRadius = RADIAL_MENU_TOKENS.outerRadius,
) {
  const dx = px - cx;
  const dy = py - cy;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance < innerRadius || distance > outerRadius) {
    return null;
  }
  const angle = getAngleFromPointer(px, py, cx, cy);
  return getSectorIndexFromAngle(angle, totalSectors);
}

/**
 * RadialMenuInput manages event binding and input processing for RadialMenu.
 */
export class RadialMenuInput {
  /**
   * @param {Object} menu RadialMenu instance.
   */
  constructor(menu) {
    this.menu = menu;
    this.onPointerDown = null;
    this.onKeyDown = null;
  }

  /**
   * Binds window event listeners for pointer and keyboard events.
   */
  bindEvents() {
    this.onPointerDown = (e) => {
      if (this.menu.active && !this.menu.container.contains(e.target) && e.button !== 2) {
        this.menu.hide();
      }
    };

    this.onKeyDown = (e) => {
      if (!this.menu.active) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.menu.hide();
        return;
      }

      if (e.target?.closest?.('.power-btn')) return;

      let nextIndex = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        nextIndex = this.menu.activeSectorIndex + 1;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        nextIndex = this.menu.activeSectorIndex - 1;
      }

      if (nextIndex !== null) {
        e.preventDefault();
        e.stopPropagation();
        this.menu._setActiveSector(nextIndex);
        return;
      }

      if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        this.menu._onSectorClick(this.menu.sectors[this.menu.activeSectorIndex]);
      }
    };

    window.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('keydown', this.onKeyDown, true);
  }

  /**
   * Unbinds window event listeners.
   */
  unbindEvents() {
    if (this.onPointerDown) {
      window.removeEventListener('pointerdown', this.onPointerDown);
      this.onPointerDown = null;
    }
    if (this.onKeyDown) {
      window.removeEventListener('keydown', this.onKeyDown, true);
      this.onKeyDown = null;
    }
  }
}
