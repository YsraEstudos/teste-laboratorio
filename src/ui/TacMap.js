import { TacMapLayout } from './tacmap/TacMapLayout.js';
import { TacMapRenderer } from './tacmap/TacMapRenderer.js';

const DEFAULT_DIMENSIONS = { width: 920, height: 680 };

/**
 * TacMap manages the tactical map overlay UI, keyboard input, and lifecycle.
 * Delegates layout calculations to TacMapLayout and rendering to TacMapRenderer.
 */
export class TacMap {
  /**
   * @param {Object} game The game instance.
   */
  constructor(game) {
    this.game = game;
    this.active = false;
    this.hoveredRoom = null;
    this.time = 0;
    this._dirty = true;
    this._entitiesMoved = false;
    this._lastPlayerPos = { x: null, z: null };
    this._lastChildPos = { x: null, z: null };
    this.destroyed = false;
    this.animationId = null;

    this.layout = new TacMapLayout();
    this.renderer = new TacMapRenderer();

    this.rooms = this.layout.rooms;
    this.corridors = this.layout.corridors;

    this._createDOM();
    this._bindEvents();
  }

  _createDOM() {
    this.container = document.createElement('div');
    this.container.id = 'tacmap-overlay';
    this.container.className = 'tacmap-overlay hidden';

    this.container.innerHTML = `
      <div class="tacmap-backdrop"></div>
      <div class="tacmap-window">
        <div class="tacmap-header">
          <div class="tacmap-title">
            <span class="title-badge">CONFIRMED 42</span>
            <h2>TAC-MAP // PLANTA TÁTICA DO LABORATÓRIO</h2>
          </div>
          <div class="tacmap-controls">
            <span class="key-hint">PRESSIONE [M] PARA FECHAR</span>
            <button class="tacmap-close-btn" id="tacmap-close">✕</button>
          </div>
        </div>

        <div class="tacmap-body">
          <div class="tacmap-canvas-wrapper">
            <canvas id="tacmap-canvas" width="${DEFAULT_DIMENSIONS.width}" height="${DEFAULT_DIMENSIONS.height}"></canvas>
          </div>

          <div class="tacmap-sidebar">
            <div class="sidebar-header">
              <span class="sidebar-label">DIAGNÓSTICO DA SALA</span>
              <h3 id="tacmap-hover-title">PASSE O MOUSE NA SALA</h3>
            </div>

            <div class="sidebar-content">
              <p id="tacmap-hover-desc">
                Mova o cursor sobre qualquer ala da planta tática para ampliar o nome e visualizar os detalhes operacionais.
              </p>

              <div class="sidebar-stats">
                <div class="stat-row">
                  <span class="stat-lbl">SETORES EM MÁQUINA:</span>
                  <span class="stat-val">7 SALAS OPERACIONAIS</span>
                </div>
                <div class="stat-row">
                  <span class="stat-lbl">PRESENÇA NO SETOR:</span>
                  <span class="stat-val" id="tacmap-hover-entities">NENHUM SELECIONADO</span>
                </div>
              </div>

              <div class="sidebar-legend">
                <div class="legend-title">LEGENDA DO MAPA TÁTICO</div>
                <div class="legend-item"><span class="marker-dot player"></span> <strong>VOCÊ</strong> (Pesquisador / Jogador)</div>
                <div class="legend-item"><span class="marker-dot child"></span> <strong>WIND CHILD</strong> (Cobaia 42)</div>
                <div class="legend-item"><span class="marker-dot test"></span> <strong>CONFIRMED 42</strong> (Ala de Testes)</div>
              </div>
            </div>

            <div class="sidebar-footer">
              <button id="btn-fast-travel" class="tacmap-action-btn">NAVEGAR PARA ESTA SALA</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.container);

    this.canvas = document.getElementById('tacmap-canvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.closeBtn = document.getElementById('tacmap-close');
    this.fastTravelBtn = document.getElementById('btn-fast-travel');
    this.hoverTitle = document.getElementById('tacmap-hover-title');
    this.hoverDesc = document.getElementById('tacmap-hover-desc');
    this.hoverEntities = document.getElementById('tacmap-hover-entities');
  }

  _bindEvents() {
    this._onKeyDown = (e) => {
      if (e.code === 'KeyM') {
        e.preventDefault();
        this.toggle();
      } else if (e.code === 'Escape' && this.active) {
        this.close();
      }
    };
    window.addEventListener('keydown', this._onKeyDown);

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }

    if (this.fastTravelBtn) {
      this.fastTravelBtn.addEventListener('click', () => {
        if (this.hoveredRoom && this.game.player) {
          const room = this.hoveredRoom;
          this.game.player.moveTo(room.navigation.x, room.navigation.z);
          this.close();
        }
      });
    }

    if (this.canvas) {
      this.canvas.addEventListener('mousemove', (e) => this._onCanvasMouseMove(e));
      this.canvas.addEventListener('mouseleave', () => {
        this.hoveredRoom = null;
        this._updateSidebarInfo();
      });
      this.canvas.addEventListener('click', () => {
        if (this.hoveredRoom && this.game.player) {
          const room = this.hoveredRoom;
          this.game.player.moveTo(room.navigation.x, room.navigation.z);
          this.close();
        }
      });
    }
  }

  /**
   * Toggles tactical map visibility.
   */
  toggle() {
    if (this.active) this.close();
    else this.open();
  }

  /**
   * Opens / shows tactical map.
   */
  open() {
    this.show();
  }

  /**
   * Shows tactical map.
   */
  show() {
    if (this.destroyed) return;

    this.active = true;
    this.container.classList.remove('hidden');
    this.container.classList.add('active');
    this._updateSidebarInfo();
    this._dirty = true;
    this._renderMap();
  }

  /**
   * Closes / hides tactical map.
   */
  close() {
    this.hide();
  }

  /**
   * Hides tactical map.
   */
  hide() {
    this.active = false;
    this.container.classList.remove('active');
    this.container.classList.add('hidden');
  }

  _onCanvasMouseMove(e) {
    if (!this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    const foundRoom = this.layout.getRoomAtCanvasPos(mouseX, mouseY, this.canvas.width, this.canvas.height);

    if (this.hoveredRoom !== foundRoom) {
      this.hoveredRoom = foundRoom;
      this._updateSidebarInfo();
      this._dirty = true;
    }
  }

  _updateSidebarInfo() {
    if (!this.hoverTitle || !this.hoverDesc || !this.hoverEntities || !this.fastTravelBtn) return;

    if (this.hoveredRoom) {
      this.hoverTitle.textContent = this.hoveredRoom.name;
      this.hoverTitle.classList.add('amplified');
      this.hoverDesc.textContent = this.hoveredRoom.description;

      const entitiesInRoom = [];
      if (this.game.player && this.layout.isEntityInRoom(this.game.player.position, this.hoveredRoom)) {
        entitiesInRoom.push('VOCÊ (Jogador)');
      }
      if (this.game.windChild && this.layout.isEntityInRoom(this.game.windChild.position, this.hoveredRoom)) {
        entitiesInRoom.push('WIND CHILD (Cobaia 42)');
      }

      this.hoverEntities.textContent =
        entitiesInRoom.length > 0 ? entitiesInRoom.join(' & ') : 'NENHUMA ENTIDADE NO MOMENTO';
      this.fastTravelBtn.style.display = 'block';
    } else {
      this.hoverTitle.textContent = 'PASSE O MOUSE NA SALA';
      this.hoverTitle.classList.remove('amplified');
      this.hoverDesc.textContent =
        'Mova o cursor sobre qualquer ala da planta tática para ampliar o nome e visualizar os detalhes operacionais.';
      this.hoverEntities.textContent = 'SELECIONE UMA SALA';
      this.fastTravelBtn.style.display = 'none';
    }
  }

  /**
   * Main rendering loop for the tactical map.
   */
  _renderMap() {
    if (this.destroyed || !this.active) return;

    this.time += 0.016;

    if (this.game.player) {
      const p = this.game.player.position;
      if (p.x !== this._lastPlayerPos.x || p.z !== this._lastPlayerPos.z) {
        this._entitiesMoved = true;
        this._lastPlayerPos.x = p.x;
        this._lastPlayerPos.z = p.z;
      }
    }

    if (this.game.windChild) {
      const c = this.game.windChild.position;
      if (c.x !== this._lastChildPos.x || c.z !== this._lastChildPos.z) {
        this._entitiesMoved = true;
        this._lastChildPos.x = c.x;
        this._lastChildPos.z = c.z;
      }
    }

    if (!this._dirty && !this._entitiesMoved) {
      this._scheduleFrame();
      return;
    }

    if (this.ctx && this.canvas) {
      this.renderer.render(this.ctx, this.canvas, this.layout, this.game, this.hoveredRoom, this.time);
    }

    this._dirty = false;
    this._entitiesMoved = false;

    this._scheduleFrame();
  }

  _scheduleFrame() {
    if (this.destroyed || !this.active || this.animationId !== null) return;

    this.animationId = requestAnimationFrame(() => {
      this.animationId = null;
      this._renderMap();
    });
  }

  /**
   * Destroys the tactical map overlay instance.
   */
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.active = false;

    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    if (this._onKeyDown) window.removeEventListener('keydown', this._onKeyDown);
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}
