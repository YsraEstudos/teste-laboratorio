import * as THREE from 'three';

export class NavigationGrid {
  constructor(colliders, options = {}) {
    this.minX = options.minX ?? -41;
    this.maxX = options.maxX ?? 41;
    this.minZ = options.minZ ?? -68;
    this.maxZ = options.maxZ ?? 10;
    this.cellSize = options.cellSize ?? 0.5;
    this.cols = Math.ceil((this.maxX - this.minX) / this.cellSize);
    this.rows = Math.ceil((this.maxZ - this.minZ) / this.cellSize);
    const total = this.cols * this.rows;
    this.blocked = new Uint8Array(total);
    this._dynamicBlocked = new Uint8Array(total);
    this._costs = new Float32Array(total);
    this._previous = new Int32Array(total);
    this._closed = new Uint8Array(total);
    this._heap = [];
    this._staticColliders = colliders.filter((collider) => this._isRelevantCollider(collider));
    this._build(colliders);
  }

  _index(x, z) {
    return z * this.cols + x;
  }

  _inside(x, z) {
    return x >= 0 && x < this.cols && z >= 0 && z < this.rows;
  }

  _isRelevantCollider(collider) {
    return Boolean(collider?.min && collider?.max && collider.max.y > 0.02 && collider.min.y <= 2.1);
  }

  _build(colliders) {
    const padding = 0.38;
    for (let z = 0; z < this.rows; z += 1) {
      for (let x = 0; x < this.cols; x += 1) {
        const worldX = this.minX + (x + 0.5) * this.cellSize;
        const worldZ = this.minZ + (z + 0.5) * this.cellSize;
        for (const collider of colliders) {
          if (collider.max.y <= 0.02 || collider.min.y > 2.1) continue;
          if (
            worldX >= collider.min.x - padding &&
            worldX <= collider.max.x + padding &&
            worldZ >= collider.min.z - padding &&
            worldZ <= collider.max.z + padding
          ) {
            this.blocked[this._index(x, z)] = 1;
            break;
          }
        }
      }
    }
  }

  _indexDynamicColliders(colliders) {
    this._dynamicBlocked.fill(0);
    const padding = 0.38;

    for (const collider of colliders) {
      if (!this._isRelevantCollider(collider)) continue;
      const minCell = this.worldToCell(collider.min.x - padding, collider.min.z - padding);
      const maxCell = this.worldToCell(collider.max.x + padding, collider.max.z + padding);

      for (let z = minCell.z; z <= maxCell.z; z += 1) {
        for (let x = minCell.x; x <= maxCell.x; x += 1) {
          const worldX = this.minX + (x + 0.5) * this.cellSize;
          const worldZ = this.minZ + (z + 0.5) * this.cellSize;
          if (
            worldX >= collider.min.x - padding &&
            worldX <= collider.max.x + padding &&
            worldZ >= collider.min.z - padding &&
            worldZ <= collider.max.z + padding
          ) {
            this._dynamicBlocked[this._index(x, z)] = 1;
          }
        }
      }
    }

    return this._dynamicBlocked;
  }

  worldToCell(x, z) {
    return {
      x: THREE.MathUtils.clamp(Math.floor((x - this.minX) / this.cellSize), 0, this.cols - 1),
      z: THREE.MathUtils.clamp(Math.floor((z - this.minZ) / this.cellSize), 0, this.rows - 1),
    };
  }

  cellToWorld(x, z) {
    return new THREE.Vector3(this.minX + (x + 0.5) * this.cellSize, 0, this.minZ + (z + 0.5) * this.cellSize);
  }

  isWalkable(x, z, dynamicBlocked = null) {
    if (!this._inside(x, z)) return false;
    const index = this._index(x, z);
    return this.blocked[index] === 0 && (!dynamicBlocked || dynamicBlocked[index] === 0);
  }

  _nearestWalkable(cell, dynamicBlocked = null) {
    if (this.isWalkable(cell.x, cell.z, dynamicBlocked)) return cell;
    let bestCell = null;
    let minCost = Infinity;
    for (let radius = 1; radius < 12; radius += 1) {
      for (let z = cell.z - radius; z <= cell.z + radius; z += 1) {
        for (let x = cell.x - radius; x <= cell.x + radius; x += 1) {
          if (Math.abs(x - cell.x) !== radius && Math.abs(z - cell.z) !== radius) continue;
          if (this.isWalkable(x, z, dynamicBlocked)) {
            const dist = (x - cell.x) * (x - cell.x) + (z - cell.z) * (z - cell.z);
            if (dist < minCost) {
              minCost = dist;
              bestCell = { x, z };
            }
          }
        }
      }
      if (bestCell) return bestCell;
    }
    return null;
  }

  _push(heap, item) {
    heap.push(item);
    let index = heap.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (heap[parent].score <= heap[index].score) break;
      [heap[parent], heap[index]] = [heap[index], heap[parent]];
      index = parent;
    }
  }

  _pop(heap) {
    if (heap.length === 1) return heap.pop();
    const first = heap[0];
    heap[0] = heap.pop();
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      if (left < heap.length && heap[left].score < heap[smallest].score) smallest = left;
      if (right < heap.length && heap[right].score < heap[smallest].score) smallest = right;
      if (smallest === index) break;
      [heap[index], heap[smallest]] = [heap[smallest], heap[index]];
      index = smallest;
    }
    return first;
  }

  _heuristic(x, z, targetX, targetZ) {
    const dx = Math.abs(targetX - x);
    const dz = Math.abs(targetZ - z);
    return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
  }

  _adjustmentReason(adjustedStart, adjustedTarget) {
    if (adjustedStart && adjustedTarget) return 'start-and-target-adjusted';
    if (adjustedStart) return 'start-adjusted';
    if (adjustedTarget) return 'target-adjusted';
    return null;
  }

  _result({
    status,
    reason,
    waypoints = [],
    requestedTarget = null,
    resolvedTarget = null,
    adjustedStart = false,
    adjustedTarget = false,
  }) {
    return {
      status,
      reason,
      waypoints,
      requestedTarget,
      resolvedTarget,
      adjustedStart,
      adjustedTarget,
    };
  }

  _segmentCoordinatesIntersectCollider(startX, startZ, endX, endZ, collider) {
    if (!this._isRelevantCollider(collider)) return false;
    const padding = 0.38;
    const minX = collider.min.x - padding;
    const maxX = collider.max.x + padding;
    const minZ = collider.min.z - padding;
    const maxZ = collider.max.z + padding;
    const deltaX = endX - startX;
    const deltaZ = endZ - startZ;
    let near = 0;
    let far = 1;

    for (const [origin, delta, min, max] of [
      [startX, deltaX, minX, maxX],
      [startZ, deltaZ, minZ, maxZ],
    ]) {
      if (Math.abs(delta) <= 0.000001) {
        if (origin < min || origin > max) return false;
        continue;
      }
      const first = (min - origin) / delta;
      const second = (max - origin) / delta;
      near = Math.max(near, Math.min(first, second));
      far = Math.min(far, Math.max(first, second));
      if (near > far) return false;
    }

    return true;
  }

  _segmentIntersectsCollider(start, end, collider) {
    return this._segmentCoordinatesIntersectCollider(start.x, start.z, end.x, end.z, collider);
  }

  _segmentIsClear(start, end, colliders) {
    return !colliders.some((collider) => this._segmentIntersectsCollider(start, end, collider));
  }

  _cellEdgeIsClear(startX, startZ, endX, endZ, colliders) {
    const worldStartX = this.minX + (startX + 0.5) * this.cellSize;
    const worldStartZ = this.minZ + (startZ + 0.5) * this.cellSize;
    const worldEndX = this.minX + (endX + 0.5) * this.cellSize;
    const worldEndZ = this.minZ + (endZ + 0.5) * this.cellSize;
    return !colliders.some((collider) =>
      this._segmentCoordinatesIntersectCollider(worldStartX, worldStartZ, worldEndX, worldEndZ, collider),
    );
  }

  /**
   * Removes redundant waypoints only when the replacement segment is clear
   * for the Wind Child navigation radius.
   *
   * @param {THREE.Vector3[]} waypoints
   * @param {THREE.Box3[]} colliders
   * @returns {THREE.Vector3[]}
   */
  smoothPath(waypoints, colliders = []) {
    if (waypoints.length <= 2) return waypoints.map((waypoint) => waypoint.clone());

    const smoothed = [waypoints[0].clone()];
    let anchor = 0;
    while (anchor < waypoints.length - 1) {
      let next = waypoints.length - 1;
      while (next > anchor + 1 && !this._segmentIsClear(waypoints[anchor], waypoints[next], colliders)) {
        next -= 1;
      }
      smoothed.push(waypoints[next].clone());
      anchor = next;
    }
    return smoothed;
  }

  /**
   * @param {number} startX
   * @param {number} startZ
   * @param {number} targetX
   * @param {number} targetZ
   * @param {{dynamicColliders?: THREE.Box3[]}} [options]
   */
  findPath(startX, startZ, targetX, targetZ, { dynamicColliders = [] } = {}) {
    if (![startX, startZ, targetX, targetZ].every(Number.isFinite)) {
      return this._result({
        status: 'invalid',
        reason: 'invalid-coordinates',
      });
    }

    const requestedTarget = new THREE.Vector3(targetX, 0, targetZ);
    const validDynamicColliders = Array.isArray(dynamicColliders) ? dynamicColliders : [];
    const dynamicBlocked = this._indexDynamicColliders(validDynamicColliders);
    const activeColliders = this._staticColliders.concat(validDynamicColliders);
    const requestedStartCell = this.worldToCell(startX, startZ);
    const requestedTargetCell = this.worldToCell(targetX, targetZ);
    const start = this._nearestWalkable(requestedStartCell, dynamicBlocked);
    if (!start) {
      return this._result({
        status: 'invalid',
        reason: 'start-unwalkable',
        requestedTarget,
      });
    }

    const target = this._nearestWalkable(requestedTargetCell, dynamicBlocked);
    if (!target) {
      return this._result({
        status: 'invalid',
        reason: 'target-unwalkable',
        requestedTarget,
        adjustedStart: start.x !== requestedStartCell.x || start.z !== requestedStartCell.z,
      });
    }

    const adjustedStart =
      start.x !== requestedStartCell.x ||
      start.z !== requestedStartCell.z ||
      startX < this.minX ||
      startX >= this.maxX ||
      startZ < this.minZ ||
      startZ >= this.maxZ;
    const adjustedTarget =
      target.x !== requestedTargetCell.x ||
      target.z !== requestedTargetCell.z ||
      targetX < this.minX ||
      targetX >= this.maxX ||
      targetZ < this.minZ ||
      targetZ >= this.maxZ;
    const resolvedTarget = this.cellToWorld(target.x, target.z);
    const completeReason = this._adjustmentReason(adjustedStart, adjustedTarget);

    const startIndex = this._index(start.x, start.z);
    const targetIndex = this._index(target.x, target.z);
    if (startIndex === targetIndex) {
      return this._result({
        status: 'complete',
        reason: completeReason,
        waypoints: [resolvedTarget.clone()],
        requestedTarget,
        resolvedTarget,
        adjustedStart,
        adjustedTarget,
      });
    }

    const costs = this._costs;
    costs.fill(Infinity);
    const previous = this._previous;
    previous.fill(-1);
    const closed = this._closed;
    closed.fill(0);
    const heap = this._heap;
    heap.length = 0;
    costs[startIndex] = 0;
    this._push(heap, {
      index: startIndex,
      x: start.x,
      z: start.z,
      score: this._heuristic(start.x, start.z, target.x, target.z),
    });

    const directions = [
      [-1, 0, 1],
      [1, 0, 1],
      [0, -1, 1],
      [0, 1, 1],
      [-1, -1, Math.SQRT2],
      [1, -1, Math.SQRT2],
      [-1, 1, Math.SQRT2],
      [1, 1, Math.SQRT2],
    ];
    let found = false;
    let closestIndex = startIndex;
    let closestDist = this._heuristic(start.x, start.z, target.x, target.z);
    let iterations = 0;

    while (heap.length > 0 && iterations < 16000) {
      iterations += 1;
      const current = this._pop(heap);
      if (closed[current.index]) continue;
      closed[current.index] = 1;

      const distToTarget = this._heuristic(current.x, current.z, target.x, target.z);
      if (distToTarget < closestDist) {
        closestDist = distToTarget;
        closestIndex = current.index;
      }

      if (current.index === targetIndex) {
        found = true;
        break;
      }

      for (const [dx, dz, moveCost] of directions) {
        const nx = current.x + dx;
        const nz = current.z + dz;
        if (!this.isWalkable(nx, nz, dynamicBlocked)) continue;
        if (
          dx !== 0 &&
          dz !== 0 &&
          (!this.isWalkable(current.x + dx, current.z, dynamicBlocked) ||
            !this.isWalkable(current.x, current.z + dz, dynamicBlocked))
        )
          continue;
        if (!this._cellEdgeIsClear(current.x, current.z, nx, nz, activeColliders)) continue;
        const neighborIndex = this._index(nx, nz);
        if (closed[neighborIndex]) continue;
        const nextCost = costs[current.index] + moveCost;
        if (nextCost >= costs[neighborIndex]) continue;
        costs[neighborIndex] = nextCost;
        previous[neighborIndex] = current.index;
        const score = nextCost + this._heuristic(nx, nz, target.x, target.z);
        this._push(heap, { index: neighborIndex, x: nx, z: nz, score });
      }
    }

    const finalTargetIndex = found ? targetIndex : closestIndex;
    const cells = [];
    if (finalTargetIndex !== startIndex) {
      let cursor = finalTargetIndex;
      while (cursor !== -1) {
        cells.push({ x: cursor % this.cols, z: Math.floor(cursor / this.cols) });
        if (cursor === startIndex) break;
        cursor = previous[cursor];
      }
      cells.reverse();
    }

    const cellWaypoints = cells.map((cell) => this.cellToWorld(cell.x, cell.z));
    const smoothed = this.smoothPath(cellWaypoints, activeColliders);
    const waypoints = smoothed.slice(1);

    return this._result({
      status: found ? 'complete' : 'partial',
      reason: found ? completeReason : 'target-unreachable',
      waypoints,
      requestedTarget,
      resolvedTarget,
      adjustedStart,
      adjustedTarget,
    });
  }
}
