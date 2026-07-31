import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  STORAGE_KEY,
  DEFAULT_SETTINGS,
  normalizeSettings,
  loadSettings,
  saveSettings,
} from '../config/GameSettings.js';
import { gameStore } from '../state/gameStore.js';

function installStorage() {
  const storage = {
    store: new Map(),
    getItem: vi.fn((key) => (storage.store.has(key) ? storage.store.get(key) : null)),
    setItem: vi.fn((key, value) => storage.store.set(key, String(value))),
    removeItem: vi.fn((key) => storage.store.delete(key)),
  };
  globalThis.localStorage = storage;
  return storage;
}

function uninstallStorage() {
  delete globalThis.localStorage;
}

describe('GameSettings', () => {
  beforeEach(() => {
    installStorage();
  });

  afterEach(() => {
    uninstallStorage();
  });

  it('uses defaults when nothing is persisted', () => {
    expect(loadSettings()).toEqual({ version: 1, quality: 'high', showFps: true });
  });

  it('round-trips valid settings', () => {
    expect(saveSettings({ version: 1, quality: 'low', showFps: false })).toBe(true);
    expect(loadSettings()).toEqual({ version: 1, quality: 'low', showFps: false });
  });

  it('falls back to defaults for corrupted JSON', () => {
    globalThis.localStorage.setItem(STORAGE_KEY, '{oops');
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS });
  });

  it('falls back to defaults for an unknown quality value', () => {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, quality: 'ultra', showFps: false }));
    expect(loadSettings().quality).toBe('high');
    expect(loadSettings().showFps).toBe(false);
  });

  it('does not coerce a string showFps into a boolean', () => {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, quality: 'low', showFps: 'false' }));
    expect(loadSettings().showFps).toBe(true);
  });

  it('falls back to defaults on version mismatch', () => {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 99, quality: 'low', showFps: false }));
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS });
  });

  it('falls back to defaults when localStorage.getItem throws', () => {
    globalThis.localStorage.getItem.mockImplementation(() => {
      throw new Error('denied');
    });
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS });
  });

  it('returns false from saveSettings when localStorage.setItem throws', () => {
    globalThis.localStorage.setItem.mockImplementation(() => {
      throw new Error('quota');
    });
    expect(saveSettings({ quality: 'low' })).toBe(false);
  });

  it('works when localStorage is unavailable', () => {
    uninstallStorage();
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS });
    expect(saveSettings({ quality: 'low' })).toBe(false);
  });

  it('persists only the normalized shape, stripping unknown keys', () => {
    saveSettings({ version: 1, quality: 'medium', showFps: true, evil: 'x', nested: { a: 1 } });
    const stored = JSON.parse(globalThis.localStorage.setItem.mock.calls[0][1]);
    expect(Object.keys(stored).sort()).toEqual(['quality', 'showFps', 'version']);
    expect(stored.quality).toBe('medium');
  });

  it('normalizes garbage inputs to defaults', () => {
    for (const garbage of [null, undefined, 123, 'string', [], true]) {
      expect(normalizeSettings(garbage)).toEqual({ version: 1, quality: 'high', showFps: true });
    }
  });

  it('normalizeSettings never mutates its input', () => {
    const raw = Object.freeze({ version: 1, quality: 'low', showFps: false, extra: 'x' });
    const result = normalizeSettings(raw);
    expect(result).toEqual({ version: 1, quality: 'low', showFps: false });
    expect(Object.keys(result)).toEqual(['version', 'quality', 'showFps']);
  });

  it('keeps quality from the whitelist only', () => {
    for (const level of ['low', 'medium', 'high']) {
      expect(normalizeSettings({ version: 1, quality: level, showFps: false }).quality).toBe(level);
    }
    expect(normalizeSettings({ version: 1, quality: 'HIGH', showFps: false }).quality).toBe('high');
    expect(normalizeSettings({ version: 1, quality: '', showFps: false }).quality).toBe('high');
  });
});

describe('gameStore settings bridge', () => {
  beforeEach(() => {
    installStorage();
    gameStore.setState({ settingsOpen: false, quality: 'high', showFps: true, settingsApplyMessage: '' });
  });

  afterEach(() => {
    uninstallStorage();
  });

  it('setQuality persists immediately and sets the apply-next-open message', () => {
    gameStore.setQuality('medium');
    expect(gameStore.state.quality).toBe('medium');
    expect(gameStore.state.settingsApplyMessage).toBe('Aplicado na próxima abertura');
    expect(globalThis.localStorage.setItem).toHaveBeenCalled();
    expect(JSON.parse(globalThis.localStorage.setItem.mock.calls.at(-1)[1]).quality).toBe('medium');
  });

  it('setShowFps persists immediately without a message', () => {
    gameStore.setShowFps(false);
    expect(gameStore.state.showFps).toBe(false);
    expect(gameStore.state.settingsApplyMessage).toBe('');
    expect(JSON.parse(globalThis.localStorage.setItem.mock.calls.at(-1)[1]).showFps).toBe(false);
  });

  it('setQuality with an invalid level is a no-op', () => {
    gameStore.setQuality('ultra');
    expect(gameStore.state.quality).toBe('high');
    expect(globalThis.localStorage.setItem).not.toHaveBeenCalled();
  });

  it('setShowFps with a non-boolean is a no-op', () => {
    gameStore.setShowFps('false');
    expect(gameStore.state.showFps).toBe(true);
    expect(globalThis.localStorage.setItem).not.toHaveBeenCalled();
  });

  it('openSettings/closeSettings manage state and clear the message', () => {
    gameStore.openSettings();
    expect(gameStore.state.settingsOpen).toBe(true);
    gameStore.setQuality('low');
    expect(gameStore.state.settingsApplyMessage).toBe('Aplicado na próxima abertura');
    gameStore.closeSettings();
    expect(gameStore.state.settingsOpen).toBe(false);
    expect(gameStore.state.settingsApplyMessage).toBe('');
  });

  it('notifies subscribers on settings changes', () => {
    const listener = vi.fn();
    gameStore.subscribe(listener);
    gameStore.setShowFps(false);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ showFps: false }));
  });
});
