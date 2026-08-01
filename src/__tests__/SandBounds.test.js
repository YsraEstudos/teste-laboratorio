import { describe, expect, it } from 'vitest';
import { SAND_BOUNDS, containsSandPoint, getSandBounds } from '../world/SandBounds.js';

describe('SandBounds', () => {
  it('aceita exatamente as bordas da arena fixa', () => {
    expect(containsSandPoint(SAND_BOUNDS.minX, SAND_BOUNDS.minZ)).toBe(true);
    expect(containsSandPoint(SAND_BOUNDS.maxX, SAND_BOUNDS.maxZ)).toBe(true);
  });

  it('rejeita pontos inválidos e fora da arena sem exceção', () => {
    expect(containsSandPoint(Number.NaN, -55)).toBe(false);
    expect(containsSandPoint(Number.POSITIVE_INFINITY, -55)).toBe(false);
    expect(containsSandPoint('0', -55)).toBe(false);
    expect(containsSandPoint(1000, -55)).toBe(false);
  });

  it('retorna limites imutáveis com margem opcional', () => {
    const bounds = getSandBounds(0.5);
    expect(bounds.minX).toBe(-12.5);
    expect(bounds.maxX).toBe(12.5);
    expect(bounds.minZ).toBe(-64.5);
    expect(bounds.maxZ).toBe(-45.5);
    expect(() => {
      bounds.minX = 0;
    }).toThrow();
  });
});
