// @ts-check

import { QUALITY_LEVELS, saveSettings } from '../config/GameSettings.js';

/**
 * Lightweight EventBus / Reactive Store connecting the 60FPS Three.js engine
 * with React UI components (<HUD />, <RadialMenu />, <TacMap />).
 */
class GameStore {
  constructor() {
    /** @type {Record<string, any>} */
    this.state = {
      happiness: 80,
      energy: 90,
      powerLevel: 5,
      roomName: 'SALA DE TESTES',
      isPlaying: false,
      isPaused: false,
      radialMenuVisible: false,
      radialMenuPosition: { x: 0, y: 0 },
      isTargeting: false,
      fps: 60,
      inventoryOpen: false,
      isFlashlightEquipped: true,
      isFlashlightOn: false,
      settingsOpen: false,
      quality: 'high',
      showFps: true,
      settingsApplyMessage: '',
      items: [
        {
          id: 'flashlight',
          name: 'Lanterna Tática HD',
          type: 'Equipamento',
          icon: '🔦',
          description:
            'Lanterna de alta intensidade com iluminação de área, facho volumétrico e sombras PCFSoft em tempo real.',
          equipped: true,
        },
      ],
    };
    /** @type {Set<(state: Record<string, any>) => void>} */
    this.listeners = new Set();
  }

  getState() {
    return this.state;
  }

  /**
   * Updates store state and notifies all active React subscribers.
   * @param {Partial<Record<string, any>>} partialState
   */
  setState(partialState) {
    let changed = false;
    for (const [key, val] of Object.entries(partialState)) {
      const current = this.state[key];
      if (typeof val === 'object' && val !== null && typeof current === 'object' && current !== null) {
        if (JSON.stringify(current) !== JSON.stringify(val)) {
          this.state[key] = val;
          changed = true;
        }
      } else if (current !== val) {
        this.state[key] = val;
        changed = true;
      }
    }
    if (changed) {
      this.notify();
    }
  }

  /**
   * @param {(state: Record<string, any>) => void} listener
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  openSettings() {
    this.setState({ settingsOpen: true });
  }

  closeSettings() {
    this.setState({ settingsOpen: false, settingsApplyMessage: '' });
  }

  /**
   * Selects a quality level. The change is persisted immediately and only
   * takes effect on the next game boot; the running session is untouched.
   * @param {string} level
   */
  setQuality(level) {
    if (!QUALITY_LEVELS.includes(level)) return;
    saveSettings({ version: 1, quality: level, showFps: this.state.showFps });
    this.setState({ quality: level, settingsApplyMessage: 'Aplicado na próxima abertura' });
  }

  /**
   * Toggles the FPS profiler visibility preference. Persisted immediately and
   * applied immediately by the engine.
   * @param {unknown} value
   */
  setShowFps(value) {
    if (typeof value !== 'boolean') return;
    saveSettings({ version: 1, quality: this.state.quality, showFps: value });
    this.setState({ showFps: value });
  }
}

export const gameStore = new GameStore();
