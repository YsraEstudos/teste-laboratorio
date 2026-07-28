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
    this.blocked = new Uint8Array(this.cols * this.rows);
    this._build(colliders);
  }

  _index(x, z) {
    return z * this.cols + x;
  }

  _inside(x, z) {
    return x >= 0 && x < this.cols && z >= 0 && z < this.rows;
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

  worldToCell(x, z) {
    return {
      x: THREE.MathUtils.clamp(Math.floor((x - this.minX) / this.cellSize), 0, this.cols - 1),
      z: THREE.MathUtils.clamp(Math.floor((z - this.minZ) / this.cellSize), 0, this.rows - 1)
    };
  }

  cellToWorld(x, z) {
    return new THREE.Vector3(
      this.minX + (x + 0.5) * this.cellSize,
      0,
      this.minZ + (z + 0.5) * this.cellSize
    );
  }

  isWalkable(x, z) {
    return this._inside(x, z) && this.blocked[this._index(x, z)] === 0;
  }

  _nearestWalkable(cell) {
    if (this.isWalkable(cell.x, cell.z)) return cell;
    let bestCell = null;
    let minCost = Infinity;
    for (let radius = 1; radius < 12; radius += 1) {
      for (let z = cell.z - radius; z <= cell.z + radius; z += 1) {
        for (let x = cell.x - radius; x <= cell.x + radius; x += 1) {
          if (Math.abs(x - cell.x) !== radius && Math.abs(z - cell.z) !== radius) continue;
          if (this.isWalkable(x, z)) {
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
    adjustedTarget = false
  }) {
    return {
      status,
      reason,
      waypoints,
      requestedTarget,
      resolvedTarget,
      adjustedStart,
      adjustedTarget
    };
  }

  findPath(startX, startZ, targetX, targetZ) {
    if (![startX, startZ, targetX, targetZ].every(Number.isFinite)) {
      return this._result({
        status: 'invalid',
        reason: 'invalid-coordinates'
      });
    }

    const requestedTarget = new THREE.Vector3(targetX, 0, targetZ);
    const requestedStartCell = this.worldToCell(startX, startZ);
    const requestedTargetCell = this.worldToCell(targetX, targetZ);
    const start = this._nearestWalkable(requestedStartCell);
    if (!start) {
      return this._result({
        status: 'invalid',
        reason: 'start-unwalkable',
        requestedTarget
      });
    }

    const target = this._nearestWalkable(requestedTargetCell);
    if (!target) {
      return this._result({
        status: 'invalid',
        reason: 'target-unwalkable',
        requestedTarget,
        adjustedStart: start.x !== requestedStartCell.x || start.z !== requestedStartCell.z
      });
    }

    const adjustedStart = (
      start.x !== requestedStartCell.x ||
      start.z !== requestedStartCell.z ||
      startX < this.minX ||
      startX >= this.maxX ||
      startZ < this.minZ ||
      startZ >= this.maxZ
    );
    const adjustedTarget = (
      target.x !== requestedTargetCell.x ||
      target.z !== requestedTargetCell.z ||
      targetX < this.minX ||
      targetX >= this.maxX ||
      targetZ < this.minZ ||
      targetZ >= this.maxZ
    );
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
        adjustedTarget
      });
    }

    const total = this.cols * this.rows;
    const costs = new Float32Array(total);
    costs.fill(Infinity);
    const previous = new Int32Array(total);
    previous.fill(-1);
    const closed = new Uint8Array(total);
    const heap = [];
    costs[startIndex] = 0;
    this._push(heap, { index: startIndex, x: start.x, z: start.z, score: this._heuristic(start.x, start.z, target.x, target.z) });

    const directions = [
      [-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1],
      [-1, -1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [1, 1, Math.SQRT2]
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
        if (!this.isWalkable(nx, nz)) continue;
        if (dx !== 0 && dz !== 0 && (!this.isWalkable(current.x + dx, current.z) || !this.isWalkable(current.x, current.z + dz))) continue;
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

    const waypoints = [];
    let lastDirection = null;
    for (let i = 1; i < cells.length; i += 1) {
      const direction = {
        x: Math.sign(cells[i].x - cells[i - 1].x),
        z: Math.sign(cells[i].z - cells[i - 1].z)
      };
      if (lastDirection && (direction.x !== lastDirection.x || direction.z !== lastDirection.z)) {
        waypoints.push(this.cellToWorld(cells[i - 1].x, cells[i - 1].z));
      }
      lastDirection = direction;
    }
    if (cells.length > 0) {
      const finalCell = cells[cells.length - 1];
      waypoints.push(this.cellToWorld(finalCell.x, finalCell.z));
    }

    return this._result({
      status: found ? 'complete' : 'partial',
      reason: found ? completeReason : 'target-unreachable',
      waypoints,
      requestedTarget,
      resolvedTarget,
      adjustedStart,
      adjustedTarget
    });
  }
}
