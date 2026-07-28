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
    this.position = { x: 0, y: 0 };
    this.hoveredSector = null;

    this.sectors = [
      {
        id: 'move-testing',
        title: 'SALA DE TESTES',
        icon: '🧭',
        description: 'Navegar o Wind Child até a Sala de Testes (Z = -54).',
        action: () => this._moveToTestingRoom(),
      },
      {
        id: 'call-child',
        title: 'CHARMAR CRIANÇA',
        icon: '🚶',
        description: 'Trazer o Wind Child para perto da posição do jogador.',
        action: () => this._callToPlayer(),
      },
      {
        id: 'power-level',
        title: 'NÍVEL DE PODER',
        icon: '⚡',
        description: 'Ajustar o nível de poder elemental do Wind Child (1 a 10).',
        hasSubmenu: true,
        action: (level) => this._setPowerLevel(level),
      },
      {
        id: 'restore-status',
        title: 'RESTAURAR STATUS',
        icon: '💚',
        description: 'Restaurar a Felicidade (100%) e Energia (100%) do Wind Child.',
        action: () => this._restoreStatus(),
      },
      {
        id: 'wind-blast',
        title: 'RÁFAGA DE VENTO',
        icon: '🌀',
        description: 'Disparar uma potente ráfaga aerodinâmica com efeitos visuais.',
        action: () => this._triggerWindBlast(),
      },
      {
        id: 'inspect-details',
        title: 'INSPECIONAR',
        icon: '📊',
        description: 'Exibir telemetria completa e diagnóstico do Wind Child.',
        action: () => this._inspectDetails(),
      },
    ];

    this._createDOM();
    this._bindEvents();
  }

  _createDOM() {
    this.container = document.createElement('div');
    this.container.id = 'radial-menu-container';
    this.container.className = 'radial-menu-overlay hidden';
    this.container.setAttribute('role', 'menu');

    const menuWrapper = document.createElement('div');
    menuWrapper.className = 'radial-menu-wrapper';

    const size = 340;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.setAttribute('class', 'radial-svg');
    this.svg = svg;

    const center = size / 2;
    const outerR = 155;
    const innerR = 62;
    const count = this.sectors.length;
    const angleStep = (2 * Math.PI) / count;

    this.sectorElements = [];

    this.sectors.forEach((sector, index) => {
      const startAngle = index * angleStep - Math.PI / 2;
      const endAngle = (index + 1) * angleStep - Math.PI / 2;
      const midAngle = (startAngle + endAngle) / 2;

      const x1 = center + outerR * Math.cos(startAngle);
      const y1 = center + outerR * Math.sin(startAngle);
      const x2 = center + outerR * Math.cos(endAngle);
      const y2 = center + outerR * Math.sin(endAngle);

      const x3 = center + innerR * Math.cos(endAngle);
      const y3 = center + innerR * Math.sin(endAngle);
      const x4 = center + innerR * Math.cos(startAngle);
      const y4 = center + innerR * Math.sin(startAngle);

      const largeArc = angleStep > Math.PI ? 1 : 0;

      const pathData = [
        `M ${x1} ${y1}`,
        `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2}`,
        `L ${x3} ${y3}`,
        `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4}`,
        'Z',
      ].join(' ');

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'radial-sector-group');
      g.setAttribute('data-id', sector.id);
      g.setAttribute('data-index', index);

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathData);
      path.setAttribute('class', 'radial-sector-path');

      const labelR = (innerR + outerR) / 2;
      const iconX = center + labelR * Math.cos(midAngle);
      const iconY = center + labelR * Math.sin(midAngle);

      const foreignObj = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
      foreignObj.setAttribute('x', iconX - 48);
      foreignObj.setAttribute('y', iconY - 24);
      foreignObj.setAttribute('width', 96);
      foreignObj.setAttribute('height', 48);
      foreignObj.setAttribute('class', 'radial-label-container');

      const labelDiv = document.createElement('div');
      labelDiv.className = 'radial-label-content';
      labelDiv.innerHTML = `
        <span class="sector-icon">${sector.icon}</span>
        <span class="sector-title">${sector.title}</span>
      `;
      foreignObj.appendChild(labelDiv);

      g.appendChild(path);
      g.appendChild(foreignObj);

      g.addEventListener('mouseenter', () => this._onSectorHover(sector, g));
      g.addEventListener('mouseleave', () => this._onSectorLeave(g));
      g.addEventListener('click', (e) => {
        e.stopPropagation();
        this._onSectorClick(sector);
      });

      svg.appendChild(g);
      this.sectorElements.push({ g, path, sector });
    });

    const centerCore = document.createElement('div');
    centerCore.className = 'radial-center-core';
    centerCore.innerHTML = `
      <div class="core-avatar">🌀</div>
      <div class="core-title">WIND CHILD</div>
      <div class="core-power-badge">PODER <span id="radial-power-val">5</span></div>
    `;

    this.powerSelector = document.createElement('div');
    this.powerSelector.className = 'power-selector-ring hidden';
    let powerHtml = '<div class="power-title">NÍVEL DE PODER (1-10)</div><div class="power-buttons">';
    for (let i = 1; i <= 10; i++) {
      powerHtml += `<button class="power-btn" data-level="${i}">${i}</button>`;
    }
    powerHtml += '</div>';
    this.powerSelector.innerHTML = powerHtml;

    this.powerSelector.addEventListener('click', (e) => {
      const btn = e.target.closest('.power-btn');
      if (btn) {
        const lvl = parseInt(btn.dataset.level, 10);
        this._setPowerLevel(lvl);
      }
    });

    this.tooltipPanel = document.createElement('div');
    this.tooltipPanel.className = 'radial-tooltip-panel';
    this.tooltipPanel.innerHTML = `
      <div class="tooltip-header">
        <span id="tooltip-icon">🌀</span>
        <span id="tooltip-title">WIND CHILD CONTEXT MENU</span>
      </div>
      <div class="tooltip-body" id="tooltip-desc">
        Passe o mouse sobre os setores para ver as ações disponíveis.
      </div>
      <div class="tooltip-stats">
        <div class="stat-item">
          <span class="stat-label">Felicidade:</span>
          <div class="stat-bar"><div class="stat-fill happiness" id="tooltip-hap-bar" style="width: 85%"></div></div>
          <span class="stat-val" id="tooltip-hap-val">85%</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Energia:</span>
          <div class="stat-bar"><div class="stat-fill energy" id="tooltip-nrg-bar" style="width: 100%"></div></div>
          <span class="stat-val" id="tooltip-nrg-val">100%</span>
        </div>
      </div>
    `;

    menuWrapper.appendChild(svg);
    menuWrapper.appendChild(centerCore);
    menuWrapper.appendChild(this.powerSelector);
    menuWrapper.appendChild(this.tooltipPanel);

    this.container.appendChild(menuWrapper);
    document.body.appendChild(this.container);
  }

  _bindEvents() {
    this._onPointerDown = (e) => {
      if (this.active && !this.container.contains(e.target) && e.button !== 2) {
        this.hide();
      }
    };
    this._onKeyDown = (e) => {
      if (this.active && e.key === 'Escape') {
        this.hide();
      }
    };
    window.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('keydown', this._onKeyDown);
  }

  destroy() {
    if (this._onPointerDown) window.removeEventListener('pointerdown', this._onPointerDown);
    if (this._onKeyDown) window.removeEventListener('keydown', this._onKeyDown);
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
    this.position = { x, y };
    this.active = true;

    const menuWidth = 360;
    const menuHeight = 480;
    const clampedX = Math.max(menuWidth / 2 + 10, Math.min(window.innerWidth - menuWidth / 2 - 10, x));
    const clampedY = Math.max(menuHeight / 2 + 10, Math.min(window.innerHeight - menuHeight / 2 - 10, y));

    this.container.style.left = '0';
    this.container.style.top = '0';
    this.container.style.transform = `translate(${clampedX}px, ${clampedY}px)`;
    this.container.classList.remove('hidden');
    this.container.classList.add('active');

    this.powerSelector.classList.add('hidden');
    this._updateTelemetry();
  }

  /**
   * Hides the radial menu.
   */
  hide() {
    this.active = false;
    this.container.classList.remove('active');
    this.container.classList.add('hidden');
    this.powerSelector.classList.add('hidden');
  }

  _updateTelemetry() {
    const child = this.game.windChild || this.game.player;
    if (!child) return;

    const powerVal = document.getElementById('radial-power-val');
    const hapBar = document.getElementById('tooltip-hap-bar');
    const hapVal = document.getElementById('tooltip-hap-val');
    const nrgBar = document.getElementById('tooltip-nrg-bar');
    const nrgVal = document.getElementById('tooltip-nrg-val');

    const pLvl = child.powerLevel !== undefined ? child.powerLevel : 1;
    const hap = child.happiness !== undefined ? child.happiness : 85;
    const nrg = child.energy !== undefined ? child.energy : 100;

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
      this.powerSelector.classList.toggle('hidden');
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
    if (child) {
      child.moveTo(0, -54);
    }
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
    if (this.game.triggerWindBlastOnObjects) {
      this.game.triggerWindBlastOnObjects();
    }
  }

  _inspectDetails() {
    const child = this.game.windChild;
    if (!child) return;
    const room = this.game.lab ? this.game.lab.getRoomNameAt(child.position.x, child.position.z) : 'SALA DE TESTES';
    const msg = `WIND CHILD (CONFIRMED 42 SUBJECT):\n• Local: ${room || 'SALA DE TESTES'}\n• Nível de Poder: ${child.powerLevel}/10\n• Felicidade: ${child.happiness}%\n• Energia: ${child.energy}%`;
    alert(msg);
  }
}
