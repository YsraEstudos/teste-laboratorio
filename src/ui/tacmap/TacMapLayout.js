import { ROOMS } from '../../world/RoomData.js';

/**
 * TacMapLayout manages tactical map layout data and coordinate transforms.
 */
export class TacMapLayout {
  constructor() {
    this.rooms = ROOMS;

    this.corridors = [
      { minX: -3, maxX: 3, minZ: -10, maxZ: -2 },
      { minX: -28, maxX: -10, minZ: -15, maxZ: -11 },
      { minX: 10, maxX: 28, minZ: -15, maxZ: -11 },
      { minX: -3, maxX: 3, minZ: -30, maxZ: -18 },
      { minX: -28, maxX: -3, minZ: -34, maxZ: -30 },
      { minX: 3, maxX: 28, minZ: -34, maxZ: -30 },
      { minX: -3, maxX: 3, minZ: -46, maxZ: -34 },
    ];

    this.minWorldX = -45;
    this.maxWorldX = 45;
    this.minWorldZ = -68;
    this.maxWorldZ = 12;
    this.padding = 40;

    // Reusable objects for zero-allocation calculations
    this._cachedBounds = { x: 0, y: 0, w: 0, h: 0 };
    this._cachedPoint = { cx: 0, cy: 0 };
  }

  /**
   * Converts world coordinates (x, z) to canvas coordinates (cx, cy).
   * @param {number} x
   * @param {number} z
   * @param {number} canvasWidth
   * @param {number} canvasHeight
   * @param {Object} [target] Optional target object to mutate.
   * @returns {{cx: number, cy: number}}
   */
  worldToCanvas(x, z, canvasWidth, canvasHeight, target = null) {
    const w = canvasWidth - this.padding * 2;
    const h = canvasHeight - this.padding * 2;
    const cx = this.padding + ((x - this.minWorldX) / (this.maxWorldX - this.minWorldX)) * w;
    const cy = this.padding + ((z - this.minWorldZ) / (this.maxWorldZ - this.minWorldZ)) * h;

    if (target) {
      target.cx = cx;
      target.cy = cy;
      return target;
    }
    return { cx, cy };
  }

  /**
   * Calculates the canvas bounding box for a room or corridor.
   * @param {Object} room
   * @param {number} canvasWidth
   * @param {number} canvasHeight
   * @param {Object} [target] Optional target object to mutate.
   * @returns {{x: number, y: number, w: number, h: number}}
   */
  getRoomCanvasBounds(room, canvasWidth, canvasHeight, target = null) {
    const w = canvasWidth - this.padding * 2;
    const h = canvasHeight - this.padding * 2;

    const x1 = this.padding + ((room.minX - this.minWorldX) / (this.maxWorldX - this.minWorldX)) * w;
    const x2 = this.padding + ((room.maxX - this.minWorldX) / (this.maxWorldX - this.minWorldX)) * w;
    const y1 = this.padding + ((room.minZ - this.minWorldZ) / (this.maxWorldZ - this.minWorldZ)) * h;
    const y2 = this.padding + ((room.maxZ - this.minWorldZ) / (this.maxWorldZ - this.minWorldZ)) * h;

    const rx = Math.min(x1, x2);
    const ry = Math.min(y1, y2);
    const rw = Math.abs(x2 - x1);
    const rh = Math.abs(y2 - y1);

    if (target) {
      target.x = rx;
      target.y = ry;
      target.w = rw;
      target.h = rh;
      return target;
    }
    return { x: rx, y: ry, w: rw, h: rh };
  }

  /**
   * Checks if an entity position (x, z) lies within room boundaries.
   * @param {{x: number, z: number}} pos
   * @param {Object} room
   * @returns {boolean}
   */
  isEntityInRoom(pos, room) {
    if (!pos || !room) return false;
    return pos.x >= room.minX && pos.x <= room.maxX && pos.z >= room.minZ && pos.z <= room.maxZ;
  }

  /**
   * Finds the room located at mouse canvas coordinates (mouseX, mouseY).
   * @param {number} mouseX
   * @param {number} mouseY
   * @param {number} canvasWidth
   * @param {number} canvasHeight
   * @returns {Object|null}
   */
  getRoomAtCanvasPos(mouseX, mouseY, canvasWidth, canvasHeight) {
    for (let i = 0; i < this.rooms.length; i++) {
      const room = this.rooms[i];
      const bounds = this.getRoomCanvasBounds(room, canvasWidth, canvasHeight, this._cachedBounds);
      if (mouseX >= bounds.x && mouseX <= bounds.x + bounds.w && mouseY >= bounds.y && mouseY <= bounds.y + bounds.h) {
        return room;
      }
    }
    return null;
  }
}
