import { describe, expect, test } from 'vitest';
import { minify } from 'terser';
import { resolveConfig } from 'vite';

async function emittedConsoleErrors(mode) {
  const config = await resolveConfig({ mode }, 'build', mode);
  const result = await minify('console.error("runtime-guard-signal")', config.build.terserOptions);
  const errors = [];

  Function(
    'console',
    result.code,
  )({
    error(message) {
      errors.push(message);
    },
  });

  return errors;
}

describe('Vite console policy', () => {
  test('production removes console errors', async () => {
    await expect(emittedConsoleErrors('production')).resolves.toEqual([]);
  });

  test('E2E preserves console errors for the runtime guard', async () => {
    await expect(emittedConsoleErrors('e2e')).resolves.toEqual(['runtime-guard-signal']);
  });
});
