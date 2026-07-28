import { ROOMS } from '../world/RoomData.js';

/**
 * TacMap manages the tactical map overlay UI.
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

    this.rooms = ROOMS;

    this.corridors = [
      { minX: -3, maxX: 3, minZ: -10, maxZ: -2 },
      { minX: -28, maxX: -10, minZ: -15, maxZ: -11 },
      { minX: 10, maxX: 28, minZ: -15, maxZ: -11 },
      { minX: -3, maxX: 3, minZ: -30, maxZ: -18 },
      { minX: -28, maxX: -3, minZ: -34, maxZ: -30 },
      { minX: 3, maxX: 28, minZ: -34, maxZ: -30 },
      { minX: -3, maxX: 3, minZ: -46, maxZ: -34 }
    ];

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
            <canvas id="tacmap-canvas" width="920" height="680"></canvas>
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
    this.ctx = this.canvas.getContext('2d');
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
        this.hide();
      }
    };
    window.addEventListener('keydown', this._onKeyDown);

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.hide());
    }

    if (this.fastTravelBtn) {
      this.fastTravelBtn.addEventListener('click', () => {
        if (this.hoveredRoom && this.game.player) {
          const room = this.hoveredRoom;
          this.game.player.moveTo(room.navigation.x, room.navigation.z);
          this.hide();
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
          this.hide();
        }
      });
    }
  }

  /**
   * Toggles the tactical map visibility.
   */
  toggle() {
    if (this.active) this.hide();
    else this.show();
  }

  /**
   * Shows the tactical map.
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
   * Hides the tactical map.
   */
  hide() {
    this.active = false;
    this.container.classList.remove('active');
    this.container.classList.add('hidden');
  }

  _onCanvasMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    // Check hover over rooms
    let foundRoom = null;
    for (const room of this.rooms) {
      const bounds = this._getRoomCanvasBounds(room);
      if (
        mouseX >= bounds.x &&
        mouseX <= bounds.x + bounds.w &&
        mouseY >= bounds.y &&
        mouseY <= bounds.y + bounds.h
      ) {
        foundRoom = room;
        break;
      }
    }

    if (this.hoveredRoom !== foundRoom) {
      this.hoveredRoom = foundRoom;
      this._updateSidebarInfo();
      this._dirty = true;
    }
  }

  _updateSidebarInfo() {
    if (this.hoveredRoom) {
      this.hoverTitle.textContent = this.hoveredRoom.name;
      this.hoverTitle.classList.add('amplified');
      this.hoverDesc.textContent = this.hoveredRoom.description;

      const entitiesInRoom = [];
      if (this.game.player && this._isEntityInRoom(this.game.player.position, this.hoveredRoom)) {
        entitiesInRoom.push('VOCÊ (Jogador)');
      }
      if (this.game.windChild && this._isEntityInRoom(this.game.windChild.position, this.hoveredRoom)) {
        entitiesInRoom.push('WIND CHILD (Cobaia 42)');
      }

      this.hoverEntities.textContent = entitiesInRoom.length > 0 ? entitiesInRoom.join(' & ') : 'NENHUMA ENTIDADE NO MOMENTO';
      this.fastTravelBtn.style.display = 'block';
    } else {
      this.hoverTitle.textContent = 'PASSE O MOUSE NA SALA';
      this.hoverTitle.classList.remove('amplified');
      this.hoverDesc.textContent = 'Mova o cursor sobre qualquer ala da planta tática para ampliar o nome e visualizar os detalhes operacionais.';
      this.hoverEntities.textContent = 'SELECIONE UMA SALA';
      this.fastTravelBtn.style.display = 'none';
    }
  }

  _isEntityInRoom(pos, room) {
    return pos.x >= room.minX && pos.x <= room.maxX && pos.z >= room.minZ && pos.z <= room.maxZ;
  }

  _getRoomCanvasBounds(room) {
    const minWorldX = -45;
    const maxWorldX = 45;
    const minWorldZ = -68;
    const maxWorldZ = 12;

    const pad = 40;
    const w = this.canvas.width - pad * 2;
    const h = this.canvas.height - pad * 2;

    const x1 = pad + ((room.minX - minWorldX) / (maxWorldX - minWorldX)) * w;
    const x2 = pad + ((room.maxX - minWorldX) / (maxWorldX - minWorldX)) * w;
    const y1 = pad + ((room.minZ - minWorldZ) / (maxWorldZ - minWorldZ)) * h;
    const y2 = pad + ((room.maxZ - minWorldZ) / (maxWorldZ - minWorldZ)) * h;

    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      w: Math.abs(x2 - x1),
      h: Math.abs(y2 - y1)
    };
  }

  _worldToCanvas(x, z) {
    const minWorldX = -45;
    const maxWorldX = 45;
    const minWorldZ = -68;
    const maxWorldZ = 12;

    const pad = 40;
    const w = this.canvas.width - pad * 2;
    const h = this.canvas.height - pad * 2;

    return {
      cx: pad + ((x - minWorldX) / (maxWorldX - minWorldX)) * w,
      cy: pad + ((z - minWorldZ) / (maxWorldZ - minWorldZ)) * h
    };
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

    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Clear Canvas & Background Grid
    ctx.fillStyle = '#0a1017';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(73, 215, 232, 0.07)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y); ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw Corridors
    ctx.fillStyle = 'rgba(30, 50, 65, 0.7)';
    ctx.strokeStyle = 'rgba(73, 215, 232, 0.3)';
    ctx.lineWidth = 2;
    for (const corr of this.corridors) {
      const b = this._getRoomCanvasBounds(corr);
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeRect(b.x, b.y, b.w, b.h);
    }

    // Draw Rooms
    for (const room of this.rooms) {
      const b = this._getRoomCanvasBounds(room);
      const isHovered = this.hoveredRoom === room;

      // Fill
      ctx.fillStyle = isHovered ? 'rgba(73, 215, 232, 0.28)' : 'rgba(16, 28, 38, 0.85)';
      ctx.fillRect(b.x, b.y, b.w, b.h);

      // Border
      ctx.strokeStyle = isHovered ? '#ffffff' : (room.color || '#49d7e8');
      ctx.lineWidth = isHovered ? 4 : 2;
      ctx.strokeRect(b.x, b.y, b.w, b.h);

      if (isHovered) {
        ctx.shadowColor = '#49d7e8';
        ctx.shadowBlur = 15;
        ctx.strokeRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
        ctx.shadowBlur = 0;
      }

      // Room Title Font (Enlarged / Ampliado on Hover)
      const fontSize = isHovered ? 20 : 13;
      ctx.font = `${isHovered ? '700' : '600'} ${fontSize}px Rajdhani, Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isHovered ? '#ffffff' : (room.color || '#a9f0ff');

      // Wrap or truncate long title
      const roomName = room.name;
      ctx.fillText(roomName, b.x + b.w / 2, b.y + b.h / 2);
    }

    this._dirty = false;
    this._entitiesMoved = false;

    // Render Real-time Entities Markers
    // 1. Wind Child Marker (Emerald/Gold Swirl)
    if (this.game.windChild) {
      const childPos = this.game.windChild.position;
      const c = this._worldToCanvas(childPos.x, childPos.z);

      const pulse = 1 + Math.sin(this.time * 6) * 0.15;

      ctx.save();
      ctx.translate(c.cx, c.cy);

      // Rotating Aura Ring
      ctx.strokeStyle = '#54f08c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 16 * pulse, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#54f08c';
      ctx.shadowColor = '#54f08c';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Label
      ctx.font = '700 12px Rajdhani, Arial, sans-serif';
      ctx.fillStyle = '#54f08c';
      ctx.textAlign = 'center';
      ctx.fillText('WIND CHILD', 0, 26);

      ctx.restore();
    }

    // 2. Player Marker (Cyan Pulsing Dot + Direction Cone)
    if (this.game.player) {
      const playerPos = this.game.player.position;
      const p = this._worldToCanvas(playerPos.x, playerPos.z);
      const rotY = this.game.player.model ? this.game.player.model.rotation.y : 0;

      ctx.save();
      ctx.translate(p.cx, p.cy);

      // Directional Cone
      const coneLength = 22;
      const dirX = Math.sin(rotY) * coneLength;
      const dirY = Math.cos(rotY) * coneLength;

      ctx.fillStyle = 'rgba(73, 215, 232, 0.35)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 24, rotY - Math.PI / 2 - 0.4, rotY - Math.PI / 2 + 0.4);
      ctx.closePath();
      ctx.fill();

      // Core Marker
      ctx.fillStyle = '#49d7e8';
      ctx.shadowColor = '#49d7e8';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Label
      ctx.font = '700 13px Rajdhani, Arial, sans-serif';
      ctx.fillStyle = '#49d7e8';
      ctx.textAlign = 'center';
      ctx.fillText('VOCÊ (JOGADOR)', 0, -18);

      ctx.restore();
    }

    this._scheduleFrame();
  }

  _scheduleFrame() {
    if (this.destroyed || !this.active || this.animationId !== null) return;

    this.animationId = requestAnimationFrame(() => {
      this.animationId = null;
      this._renderMap();
    });
  }

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
