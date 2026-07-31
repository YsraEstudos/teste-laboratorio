export const SAND_BOUNDS = Object.freeze({
  minX: -12,
  maxX: 12,
  minZ: -64,
  maxZ: -46,
});

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function getSandBounds(margin = 0) {
  const safeMargin = finite(margin) && margin >= 0 ? margin : 0;
  return Object.freeze({
    minX: SAND_BOUNDS.minX - safeMargin,
    maxX: SAND_BOUNDS.maxX + safeMargin,
    minZ: SAND_BOUNDS.minZ - safeMargin,
    maxZ: SAND_BOUNDS.maxZ + safeMargin,
  });
}

export function containsSandPoint(x, z, margin = 0) {
  if (!finite(x) || !finite(z)) return false;
  const safeMargin = finite(margin) && margin >= 0 ? margin : 0;
  return (
    x >= SAND_BOUNDS.minX - safeMargin &&
    x <= SAND_BOUNDS.maxX + safeMargin &&
    z >= SAND_BOUNDS.minZ - safeMargin &&
    z <= SAND_BOUNDS.maxZ + safeMargin
  );
}

export function isFiniteSandBrush(x, z, radius, depth, berm = 0, compression = 0, yaw = 0, elongation = 1, edge = 0) {
  return (
    finite(x) &&
    finite(z) &&
    finite(radius) &&
    finite(depth) &&
    finite(berm) &&
    finite(compression) &&
    finite(yaw) &&
    finite(elongation) &&
    finite(edge)
  );
}
