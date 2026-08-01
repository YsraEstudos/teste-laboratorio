// @ts-check

/**
 * Versioned, defensive persistent game settings (localStorage).
 *
 * Every value read from storage is treated as untrusted: normalization is the
 * only entry point and it never throws, so a corrupted store can never block
 * game initialization.
 */

export const SETTINGS_VERSION = 1;
export const STORAGE_KEY = 'laboratorio3d.settings.v1';
export const QUALITY_LEVELS = Object.freeze(['low', 'medium', 'high']);
export const DEFAULT_SETTINGS = Object.freeze({
  version: SETTINGS_VERSION,
  quality: 'high',
  showFps: true,
});

/**
 * @param {unknown} raw
 * @returns {{ version: number, quality: string, showFps: boolean }}
 */
export function normalizeSettings(raw) {
  const source = raw !== null && typeof raw === 'object' ? raw : {};
  const versionOk = source.version === SETTINGS_VERSION;
  if (!versionOk) return { ...DEFAULT_SETTINGS };
  const quality = QUALITY_LEVELS.includes(source.quality) ? source.quality : DEFAULT_SETTINGS.quality;
  const showFps = typeof source.showFps === 'boolean' ? source.showFps : DEFAULT_SETTINGS.showFps;
  return {
    version: SETTINGS_VERSION,
    quality,
    showFps,
  };
}

/**
 * Reads persisted settings. Falls back to defaults on any failure
 * (missing storage, invalid JSON, invalid values). Never throws.
 * @returns {{ version: number, quality: string, showFps: boolean }}
 */
export function loadSettings() {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (stored == null) return { ...DEFAULT_SETTINGS };
    return normalizeSettings(JSON.parse(stored));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Persists normalized settings immediately. Never throws.
 * @param {unknown} settings
 * @returns {boolean} true when the write succeeded
 */
export function saveSettings(settings) {
  const normalized = normalizeSettings(settings);
  if (typeof globalThis.localStorage?.setItem !== 'function') return false;
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}
