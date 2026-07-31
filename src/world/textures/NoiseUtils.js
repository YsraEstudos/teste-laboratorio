export function _noise(context, width, height, count, palette, alpha = 0.2) {
  context.save();
  context.globalAlpha = alpha;
  for (let i = 0; i < count; i += 1) {
    const color = palette[Math.floor(Math.random() * palette.length)];
    context.fillStyle = color;
    const size = Math.random() * 3 + 1;
    context.fillRect(Math.random() * width, Math.random() * height, size, size);
  }
  context.restore();
}

export function _seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function _seededNoise(context, width, height, count, palette, alpha = 0.2, seed = 0x5a11d) {
  const random = _seededRandom(seed);
  context.save();
  context.globalAlpha = alpha;
  for (let i = 0; i < count; i += 1) {
    const color = palette[Math.floor(random() * palette.length)];
    context.fillStyle = color;
    const size = random() * 3 + 1;
    context.fillRect(random() * width, random() * height, size, size);
  }
  context.restore();
}
