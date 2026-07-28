export class PerformanceProfiler {
  constructor(game) {
    this.game = game;
    this.visible = true;

    // Telemetry Metrics
    this.fps = 60;
    this.avgFps = 60;
    this.minFps = 60;
    this.maxFps = 60;
    this.frameTimeMs = 16.67;
    this.cpuTimeMs = 0;
    this.gpuTimeMs = 0;
    this.drawCalls = 0;
    this.triangles = 0;
    this.texturesCount = 0;
    this.geometriesCount = 0;
    this.usedHeapMB = 0;
    this.totalHeapMB = 0;
    this.gpuHardwareName = 'AMD Radeon / Generic WebGL';
    this.cpuVendorName = 'AMD Processor (Optimized)';

    // Sliding History Buffer (60 frames)
    this.historyLength = 60;
    this.frameHistory = new Array(this.historyLength).fill(16.67);
    this.historyIndex = 0;

    // High Precision Timers
    this.lastFrameTime = performance.now();
    this.cpuStartTime = 0;
    this.gpuStartTime = 0;
    this.accumulatedCpuTime = 0;
    this.accumulatedGpuTime = 0;

    this._detectHardware();
    this._createDOM();
    this._bindEvents();
  }

  _detectHardware() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          const rendererStr = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          if (rendererStr) {
            this.gpuHardwareName = rendererStr.replace(/ANGLE \((.*)\)/, '$1');
          }
        }
      }
    } catch (e) {
      console.warn('Hardware detection fallback:', e);
    }
  }

  _createDOM() {
    this.container = document.createElement('div');
    this.container.id = 'perf-telemetry-hud';
    this.container.className = 'perf-telemetry-hud';

    this.container.innerHTML = `
      <div class="perf-header">
        <div class="perf-title-box">
          <span class="perf-badge">AMD / EDGE</span>
          <span class="perf-title">TELEMETRIA EM TEMPO REAL</span>
        </div>
        <button id="btn-toggle-telemetry" class="perf-toggle-btn" title="Alternar Visibilidade [F2]">F2 ✕</button>
      </div>

      <div class="perf-body">
        <div class="perf-gpu-badge" id="perf-gpu-name">${this.gpuHardwareName}</div>

        <div class="perf-primary-stats">
          <div class="stat-big">
            <span class="big-val" id="perf-fps-val">60</span>
            <span class="big-lbl">FPS (TAXA QUADROS)</span>
          </div>
          <div class="stat-big">
            <span class="big-val" id="perf-frametime-val">16.6ms</span>
            <span class="big-lbl">TEMPO TOTAL QUADRO</span>
          </div>
        </div>

        <div class="perf-breakdown-grid">
          <div class="breakdown-card cpu">
            <span class="card-title">PROCESSAMENTO CPU</span>
            <span class="card-val" id="perf-cpu-val">0.0 ms</span>
            <span class="card-sub">Lógica & Animação JS</span>
          </div>
          <div class="breakdown-card gpu">
            <span class="card-title">RENDERIZAÇÃO GPU</span>
            <span class="card-val" id="perf-gpu-val">0.0 ms</span>
            <span class="card-sub">Render & Shaders WebGL</span>
          </div>
        </div>

        <div class="perf-sparkline-box">
          <div class="sparkline-header">
            <span>GRÁFICO DE ESTABILIDADE (60 QUADROS)</span>
            <span id="perf-fps-minmax">MIN: 60 | MAX: 60</span>
          </div>
          <canvas id="perf-sparkline-canvas" width="280" height="42"></canvas>
        </div>

        <div class="perf-hardware-details">
          <div class="detail-row">
            <span>CHAMADAS DE DESENHO (DRAW CALLS):</span>
            <strong id="perf-draw-calls">0</strong>
          </div>
          <div class="detail-row">
            <span>POLÍGONOS (TRIÂNGULOS 3D):</span>
            <strong id="perf-triangles">0</strong>
          </div>
          <div class="detail-row">
            <span>MEMÓRIA VRAM (GEOMETRIAS / TEXTURAS):</span>
            <strong id="perf-vram-assets">0 / 0</strong>
          </div>
          <div class="detail-row">
            <span>MEMÓRIA HEAP JS (EDGE / CHROMIUM):</span>
            <strong id="perf-js-memory">0 MB</strong>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.container);

    this.sparklineCanvas = document.getElementById('perf-sparkline-canvas');
    this.sparkCtx = this.sparklineCanvas.getContext('2d');
    this.toggleBtn = document.getElementById('btn-toggle-telemetry');

    this.fpsValEl = document.getElementById('perf-fps-val');
    this.frameTimeValEl = document.getElementById('perf-frametime-val');
    this.cpuValEl = document.getElementById('perf-cpu-val');
    this.gpuValEl = document.getElementById('perf-gpu-val');
    this.fpsMinMaxEl = document.getElementById('perf-fps-minmax');
    this.drawCallsEl = document.getElementById('perf-draw-calls');
    this.trianglesEl = document.getElementById('perf-triangles');
    this.vramAssetsEl = document.getElementById('perf-vram-assets');
    this.jsMemoryEl = document.getElementById('perf-js-memory');
  }

  _bindEvents() {
    this._onKeyDown = (e) => {
      if (e.code === 'F2') {
        e.preventDefault();
        this.toggle();
      }
    };
    window.addEventListener('keydown', this._onKeyDown);

    if (this.toggleBtn) {
      this.toggleBtn.addEventListener('click', () => this.toggle());
    }
  }

  toggle() {
    this.visible = !this.visible;
    if (this.visible) {
      this.container.classList.remove('collapsed');
    } else {
      this.container.classList.add('collapsed');
    }
  }

  startFrame(now) {
    this.frameTimeMs = now - this.lastFrameTime;
    this.lastFrameTime = now;

    this.frameHistory[this.historyIndex] = this.frameTimeMs;
    this.historyIndex = (this.historyIndex + 1) % this.historyLength;
  }

  startCPU() {
    this.cpuStartTime = performance.now();
  }

  endCPU() {
    this.cpuTimeMs = performance.now() - this.cpuStartTime;
  }

  startGPU() {
    this.gpuStartTime = performance.now();
  }

  endGPU() {
    this.gpuTimeMs = performance.now() - this.gpuStartTime;
  }

  endFrame(threeRenderer) {
    if (!this.visible) return;

    // Calculate FPS stats
    const instantFps = this.frameTimeMs > 0 ? 1000 / this.frameTimeMs : 60;
    this.fps = Math.round(instantFps);

    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < this.historyLength; i++) {
      const ft = this.frameHistory[i];
      const f = 1000 / ft;
      sum += f;
      if (f < min) min = f;
      if (f > max) max = f;
    }
    this.avgFps = Math.round(sum / this.historyLength);
    this.minFps = Math.round(min);
    this.maxFps = Math.round(max);

    // Read Three.js WebGL telemetry
    if (threeRenderer && threeRenderer.info) {
      this.drawCalls = threeRenderer.info.render.calls;
      this.triangles = threeRenderer.info.render.triangles;
      this.geometriesCount = threeRenderer.info.memory.geometries;
      this.texturesCount = threeRenderer.info.memory.textures;
    }

    // Read JS Memory Heap in Edge / Chromium
    if (performance && performance.memory) {
      this.usedHeapMB = (performance.memory.usedJSHeapSize / 1048576).toFixed(1);
      this.totalHeapMB = (performance.memory.totalJSHeapSize / 1048576).toFixed(1);
    }

    this._updateUI();
    this._renderSparkline();
  }

  _updateUI() {
    if (this.fpsValEl) {
      this.fpsValEl.textContent = this.fps;
      if (this.fps >= 55) {
        this.fpsValEl.style.color = '#54f08c';
      } else if (this.fps >= 30) {
        this.fpsValEl.style.color = '#ffd36d';
      } else {
        this.fpsValEl.style.color = '#f07170';
      }
    }

    if (this.frameTimeValEl) this.frameTimeValEl.textContent = `${this.frameTimeMs.toFixed(1)} ms`;
    if (this.cpuValEl) this.cpuValEl.textContent = `${this.cpuTimeMs.toFixed(2)} ms`;
    if (this.gpuValEl) this.gpuValEl.textContent = `${this.gpuTimeMs.toFixed(2)} ms`;
    if (this.fpsMinMaxEl) this.fpsMinMaxEl.textContent = `MIN: ${this.minFps} | MAX: ${this.maxFps}`;

    if (this.drawCallsEl) this.drawCallsEl.textContent = this.drawCalls;
    if (this.trianglesEl) this.trianglesEl.textContent = this.triangles.toLocaleString();
    if (this.vramAssetsEl) this.vramAssetsEl.textContent = `${this.geometriesCount} GEO / ${this.texturesCount} TEX`;
    if (this.jsMemoryEl) {
      this.jsMemoryEl.textContent =
        this.usedHeapMB > 0 ? `${this.usedHeapMB} MB / ${this.totalHeapMB} MB` : 'N/A (Navegador)';
    }
  }

  _renderSparkline() {
    if (!this.sparkCtx) return;
    const ctx = this.sparkCtx;
    const w = this.sparklineCanvas.width;
    const h = this.sparklineCanvas.height;

    ctx.clearRect(0, 0, w, h);

    const barW = w / this.historyLength;
    const targetFt = 16.67; // 60 FPS target

    for (let i = 0; i < this.historyLength; i++) {
      const idx = (this.historyIndex + i) % this.historyLength;
      const ft = this.frameHistory[idx];

      const barHeight = Math.min(h, (ft / (targetFt * 2)) * h);
      const x = i * barW;
      const y = h - barHeight;

      if (ft <= 17.5) {
        ctx.fillStyle = '#54f08c';
      } else if (ft <= 33.3) {
        ctx.fillStyle = '#ffd36d';
      } else {
        ctx.fillStyle = '#f07170';
      }

      ctx.fillRect(x, y, barW - 1, barHeight);
    }
  }

  destroy() {
    if (this._onKeyDown) window.removeEventListener('keydown', this._onKeyDown);
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}
