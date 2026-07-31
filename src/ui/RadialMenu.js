import { getRoomById } from '../world/RoomData.js';
import { RADIAL_MENU_TOKENS, createDefaultSectors } from './radial/RadialMenuConfig.js';
import { buildRadialMenuDOM } from './radial/RadialSectorBuilder.js';
import { RadialMenuInput } from './radial/RadialMenuInput.js';

/**
 * RadialMenu controls the 360-degree context menu for the Wind Child.
 * It uses a custom SVG-based sector system and manages pointer/keyboard events.
 */
export class RadialMenu {
  /**
   * @param {Object} game The game instance.
   */
  constructor(game) {
    this.game = game;
    this.active = false;
    this.destroyed = false;
    this.position = { x: 0, y: 0 };
    this.hoveredSector = null;
    this.activeSectorIndex = 0;

    this.sectors = createDefaultSectors(this);

    this._createDOM();
    this.inputHandler = new RadialMenuInput(this);
    this._bindEvents();
  }

  _createDOM() {
    const dom = buildRadialMenuDOM(this.sectors, this, RADIAL_MENU_TOKENS);
    this.container = dom.container;
    this.svg = dom.svg;
    this.sectorElements = dom.sectorElements;
    this.powerSelector = dom.powerSelector;
    this.tooltipPanel = dom.tooltipPanel;
    document.body.appendChild(this.container);
  }

  _bindEvents() {
    this.inputHandler.bindEvents();
    this._onPointerDown = this.inputHandler.onPointerDown;
    this._onKeyDown = this.inputHandler.onKeyDown;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.hide();

    if (this.inputHandler) {
      this.inputHandler.unbindEvents();
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }

  /**
   * Shows the radial menu at the specified coordinates.
   * @param {number} x The X coordinate.
   * @param {number} y The Y coordinate.
   */
  show(x, y) {
    if (this.destroyed || !this.game.windChild) {
      this.hide();
      return;
    }

    this.position = { x, y };
    this.active = true;

    const menuWidth = RADIAL_MENU_TOKENS.menuWidth;
    const menuHeight = RADIAL_MENU_TOKENS.menuHeight;
    const padding = RADIAL_MENU_TOKENS.viewportPadding;

    const clampedX = Math.max(menuWidth / 2 + padding, Math.min(window.innerWidth - menuWidth / 2 - padding, x));
    const clampedY = Math.max(menuHeight / 2 + padding, Math.min(window.innerHeight - menuHeight / 2 - padding, y));

    this.container.style.left = '0';
    this.container.style.top = '0';
    this.container.style.transform = `translate(${clampedX}px, ${clampedY}px)`;
    this.container.classList.remove('hidden');
    this.container.classList.add('active');
    this.container.setAttribute('aria-hidden', 'false');

    this.powerSelector.classList.add('hidden');
    this._updateTelemetry();
    this._setActiveSector(0);
  }

  /**
   * Hides the radial menu.
   */
  hide() {
    const wasActive = this.active;
    this.active = false;
    this.container.classList.remove('active');
    this.container.classList.add('hidden');
    this.container.setAttribute('aria-hidden', 'true');
    this.powerSelector.classList.add('hidden');

    if (wasActive) {
      document.getElementById('game-canvas')?.focus?.();
    }
  }

  _setActiveSector(index, focus = true) {
    const count = this.sectorElements.length;
    if (count === 0) return;

    this.activeSectorIndex = ((index % count) + count) % count;
    this.sectorElements.forEach(({ g }, sectorIndex) => {
      g.setAttribute('tabindex', sectorIndex === this.activeSectorIndex ? '0' : '-1');
    });

    if (focus) {
      this.sectorElements[this.activeSectorIndex].g.focus();
    }
  }

  _updateTelemetry() {
    const child = this.game.windChild;
    if (!child) return;

    const powerVal = document.getElementById('radial-power-val');
    const hapBar = document.getElementById('tooltip-hap-bar');
    const hapVal = document.getElementById('tooltip-hap-val');
    const nrgBar = document.getElementById('tooltip-nrg-bar');
    const nrgVal = document.getElementById('tooltip-nrg-val');

    const pLvl = child.powerLevel;
    const hap = child.happiness;
    const nrg = child.energy;
    if (![pLvl, hap, nrg].every(Number.isFinite)) return;

    if (powerVal) powerVal.textContent = pLvl;
    if (hapBar) hapBar.style.width = `${hap}%`;
    if (hapVal) hapVal.textContent = `${Math.round(hap)}%`;
    if (nrgBar) nrgBar.style.width = `${nrg}%`;
    if (nrgVal) nrgVal.textContent = `${Math.round(nrg)}%`;

    const powerBtns = this.powerSelector.querySelectorAll('.power-btn');
    powerBtns.forEach((btn) => {
      const lvl = parseInt(btn.dataset.level, 10);
      if (lvl === pLvl) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  _onSectorHover(sector, element) {
    this.hoveredSector = sector;
    element.classList.add('hovered');

    const iconEl = document.getElementById('tooltip-icon');
    const titleEl = document.getElementById('tooltip-title');
    const descEl = document.getElementById('tooltip-desc');

    if (iconEl) iconEl.textContent = sector.icon;
    if (titleEl) titleEl.textContent = sector.title;
    if (descEl) descEl.textContent = sector.description;
  }

  _onSectorLeave(element) {
    this.hoveredSector = null;
    element.classList.remove('hovered');
  }

  _onSectorClick(sector) {
    if (sector.id === 'power-level') {
      const isOpening = this.powerSelector.classList.contains('hidden');
      this.powerSelector.classList.toggle('hidden');
      if (isOpening) {
        const powerButtons = [...this.powerSelector.querySelectorAll('.power-btn')];
        const activeButton = powerButtons.find((button) => button.classList.contains('active')) ?? powerButtons[0];
        activeButton?.focus();
      }
      return;
    }

    if (sector.action) {
      sector.action();
    }

    if (sector.id !== 'power-level') {
      this.hide();
    }
  }

  _moveToTestingRoom() {
    const child = this.game.windChild;
    const target = getRoomById('testing_room')?.navigation;
    if (child && target) child.moveTo(target.x, target.z);
  }

  _callToPlayer() {
    const child = this.game.windChild;
    const player = this.game.player;
    if (child && player) {
      child.moveTo(player.position.x + 2.2, player.position.z + 0.5);
    }
  }

  _setPowerLevel(level) {
    const child = this.game.windChild;
    if (child) {
      child.setPowerLevel(level);
    }
    this._updateTelemetry();
  }

  _restoreStatus() {
    const child = this.game.windChild;
    if (child) {
      child.setHappiness(100);
      child.setEnergy(100);
    }
    this._updateTelemetry();
  }

  _triggerWindBlast() {
    if (this.game.enterWindBlastTargetingMode) {
      this.game.enterWindBlastTargetingMode();
    } else if (this.game.triggerWindBlastOnObjects) {
      this.game.triggerWindBlastOnObjects();
    }
  }

  _inspectDetails() {
    const child = this.game.windChild;
    if (!child) return;
    const room = this.game.lab ? this.game.lab.getRoomNameAt(child.position.x, child.position.z) : 'SALA DE TESTES';
    const msg = `${child.name} (CONFIRMED 42 SUBJECT):\n• Local: ${room || 'SALA DE TESTES'}\n• Nível de Poder: ${child.powerLevel}/10\n• Felicidade: ${child.happiness}%\n• Energia: ${child.energy}%`;
    alert(msg);
  }
}
