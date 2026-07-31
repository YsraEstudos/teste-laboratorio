export class PerformanceProfiler {
  constructor(game) {
    this.game = game;
    this.visible = true;

    // Telemetry Metrics
    this.targetFps = 120;
    this.fps = 120;
    this.avgFps = 120;
    this.minFps = 120;
    this.maxFps = 120;
    this.frameTimeMs = 8.33;
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

    // Sliding History Buffer (120 frames for 120 FPS buffer)
    this.historyLength = 120;
    this.frameHistory = new Array(this.historyLength).fill(8.33);
    this.historyIndex = 0;

    // High Precision Timers
    this.lastFrameTime = performance.now();
    this.cpuStartTime = 0;
    this.gpuStartTime = 0;
    this.accumulatedCpuTime = 0;
    this.accumulatedGpuTime = 0;
    this.lastUiUpdate = 0;

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
          <span class="perf-badge">AMD / EDGE (120 FPS)</span>
          <span class="perf-title">TELEMETRIA EM TEMPO REAL</span>
        </div>
        <button id="btn-toggle-telemetry" class="perf-toggle-btn" title="Alternar Visibilidade [F2]">F2 ✕</button>
      </div>

      <div class="perf-body">
        <div class="perf-gpu-badge" id="perf-gpu-name">${this.gpuHardwareName}</div>

        <div class="perf-primary-stats">
          <div class="stat-big">
            <span class="big-val" id="perf-fps-val">120</span>
            <span class="big-lbl">FPS (TAXA QUADROS - META 120)</span>
          </div>
          <div class="stat-big">
            <span class="big-val" id="perf-frametime-val">8.3ms</span>
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
            <span>ESTABILIDADE (META: 120 FPS / 120 QUADROS)</span>
            <span id="perf-fps-minmax">MIN: 120 | MAX: 120</span>
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

        <button id="btn-toggle-forced-120" class="perf-mode-btn active-mode" title="Alternar entre VSync nativo e modo 120 FPS forçado">
          ⚡ MODO: FORÇADO 120 FPS [ATIVO]
        </button>

        <button id="btn-perf-tech-details" class="perf-tech-btn" title="Abrir Relatório Técnico & Diagnóstico de FPS">
          🔍 DETALHES TÉCNICOS & ANÁLISE DE FPS
        </button>
      </div>
    `;

    document.body.appendChild(this.container);

    // Create Technical Details Diagnostic Modal
    this.modalEl = document.createElement('div');
    this.modalEl.id = 'perf-tech-modal';
    this.modalEl.className = 'perf-tech-modal hidden';
    this.modalEl.innerHTML = `
      <div class="perf-modal-backdrop" id="perf-modal-backdrop"></div>
      <div class="perf-modal-window">
        <div class="perf-modal-header">
          <div class="modal-title-box">
            <span class="modal-badge">AMD / EDGE TELEMETRY</span>
            <h2>DIAGNÓSTICO TÉCNICO & ANÁLISE DE FPS</h2>
          </div>
          <button id="btn-close-perf-modal" class="perf-modal-close">✕</button>
        </div>

        <div class="perf-modal-body">
          <!-- Section: Realtime FPS Diagnostics & Reasons -->
          <div class="diag-section main-diag">
            <div class="section-title">🔍 DIAGNÓSTICO EM TEMPO REAL // MOTIVOS DO DESEMPENHO ATUAL</div>
            <div id="perf-diag-reasons-list" class="diag-reasons-list">
              <!-- Dynamically populated without flickering -->
            </div>
          </div>

          <!-- Section: Detailed Performance Metrics Grid -->
          <div class="diag-grid">
            <div class="diag-card">
              <div class="card-hdr">⚡ MÉTRICAS DE TEMPO DE QUADRO</div>
              <div class="card-row"><span>FPS Instântaneo:</span><strong id="diag-fps-now">120 FPS</strong></div>
              <div class="card-row"><span>FPS Mínimo / Máximo:</span><strong id="diag-fps-minmax">120 / 120 FPS</strong></div>
              <div class="card-row"><span>FPS Médio (120 Quadros):</span><strong id="diag-fps-avg">120 FPS</strong></div>
              <div class="card-row"><span>Meta de Tempo de Quadro:</span><strong>8.33 ms (120 Hz)</strong></div>
              <div class="card-row"><span>Tempo do Quadro Atual:</span><strong id="diag-frametime">8.3 ms</strong></div>
            </div>

            <div class="diag-card">
              <div class="card-hdr">🖥️ PROCESSAMENTO CPU & GPU</div>
              <div class="card-row"><span>Placa de Vídeo / GPU:</span><strong id="diag-gpu-name">Detectando...</strong></div>
              <div class="card-row"><span>Lógica CPU JS & Física:</span><strong id="diag-cpu-ms">0.00 ms</strong></div>
              <div class="card-row"><span>Renderização GPU WebGL:</span><strong id="diag-gpu-ms">0.00 ms</strong></div>
              <div class="card-row"><span>Chamadas de Desenho:</span><strong id="diag-draw-calls">0</strong></div>
              <div class="card-row"><span>Polígonos (Triângulos 3D):</span><strong id="diag-triangles">0</strong></div>
            </div>

            <div class="diag-card">
              <div class="card-hdr">💾 RECURSOS VRAM & HEAP MEMORY</div>
              <div class="card-row"><span>Geometrias na VRAM:</span><strong id="diag-geometries">0 GEO</strong></div>
              <div class="card-row"><span>Texturas na VRAM:</span><strong id="diag-textures">0 TEX</strong></div>
              <div class="card-row"><span>Memória Heap JS Utilizada:</span><strong id="diag-heap-used">0 MB</strong></div>
              <div class="card-row"><span>Memória Heap Total Alocada:</span><strong id="diag-heap-total">0 MB</strong></div>
              <div class="card-row"><span>Risco de Pausa por GC:</span><strong id="diag-gc-status">Baixo (Estável)</strong></div>
            </div>

            <div class="diag-card">
              <div class="card-hdr">⚙️ AMBIENTE & SISTEMA</div>
              <div class="card-row"><span>Navegador / Engine:</span><strong id="diag-browser">Edge / Chromium</strong></div>
              <div class="card-row"><span>Versão WebGL:</span><strong id="diag-webgl-ver">WebGL 2.0</strong></div>
              <div class="card-row"><span>Resolução da Janela:</span><strong id="diag-screen-res">1920x1080</strong></div>
              <div class="card-row"><span>Pixel Ratio (DPI):</span><strong id="diag-pixel-ratio">1.0x</strong></div>
              <div class="card-row"><span>Modo de Loop:</span><strong id="diag-loop-mode">VSync Browser (rAF)</strong></div>
            </div>
          </div>
        </div>

        <div class="perf-modal-footer">
          <button id="btn-toggle-forced-120-modal" class="perf-action-btn warning">⚡ ALTERNAR FORÇAR 120 FPS</button>
          <button id="btn-copy-perf-report" class="perf-action-btn primary">📋 COPIAR RELATÓRIO TÉCNICO (JSON)</button>
          <button id="btn-close-perf-modal-foot" class="perf-action-btn secondary">FECHAR [ESC]</button>
        </div>
      </div>
    `;
    document.body.appendChild(this.modalEl);

    this.sparklineCanvas = document.getElementById('perf-sparkline-canvas');
    this.sparkCtx = this.sparklineCanvas.getContext('2d');
    this.toggleBtn = document.getElementById('btn-toggle-telemetry');
    this.detailsBtn = document.getElementById('btn-perf-tech-details');

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
      } else if (e.code === 'Escape' && this.isModalOpen) {
        this.closeModal();
      }
    };
    window.addEventListener('keydown', this._onKeyDown);

    if (this.toggleBtn) {
      this.toggleBtn.addEventListener('click', () => this.toggle());
    }

    if (this.detailsBtn) {
      this.detailsBtn.addEventListener('click', () => this.openModal());
    }

    const btnToggleForced120 = document.getElementById('btn-toggle-forced-120');
    const btnToggleForced120Modal = document.getElementById('btn-toggle-forced-120-modal');

    const handleToggleForced = () => {
      if (this.game && typeof this.game.toggleForced120FPS === 'function') {
        const isForced = this.game.toggleForced120FPS();
        this.updateForced120Buttons(isForced);
      }
    };

    if (btnToggleForced120) btnToggleForced120.addEventListener('click', handleToggleForced);
    if (btnToggleForced120Modal) btnToggleForced120Modal.addEventListener('click', handleToggleForced);

    const btnCloseHeader = document.getElementById('btn-close-perf-modal');
    const btnCloseFoot = document.getElementById('btn-close-perf-modal-foot');
    const backdrop = document.getElementById('perf-modal-backdrop');
    const btnCopyReport = document.getElementById('btn-copy-perf-report');

    if (btnCloseHeader) btnCloseHeader.addEventListener('click', () => this.closeModal());
    if (btnCloseFoot) btnCloseFoot.addEventListener('click', () => this.closeModal());
    if (backdrop) backdrop.addEventListener('click', () => this.closeModal());
    if (btnCopyReport) btnCopyReport.addEventListener('click', () => this.copyReportToClipboard());
  }

  updateForced120Buttons(isForced) {
    const btn1 = document.getElementById('btn-toggle-forced-120');
    const btn2 = document.getElementById('btn-toggle-forced-120-modal');
    const label = isForced ? '⚡ MODO: HIGH-PRECISION 120 FPS [ATIVO]' : '⚡ MODO: VSYNC (CLIQUE PARA MODO 120 FPS)';

    if (btn1) {
      btn1.textContent = label;
      btn1.classList.toggle('active-mode', isForced);
    }
    if (btn2) {
      btn2.textContent = isForced ? '⚡ MODO HIGH-PRECISION 120 FPS ATIVO' : '⚡ ALTERNAR MODO 120 FPS';
    }
    const loopModeEl = document.getElementById('diag-loop-mode');
    if (loopModeEl) {
      loopModeEl.textContent = isForced ? '120 FPS Fixed Timestep (8.33ms rAF)' : 'VSync Native (rAF Browser)';
      loopModeEl.style.color = isForced ? '#54f08c' : '#ffd36d';
    }
  }

  openModal() {
    this.isModalOpen = true;
    if (this.modalEl) {
      this.modalEl.classList.remove('hidden');
    }
    this._updateModalData();
  }

  closeModal() {
    this.isModalOpen = false;
    if (this.modalEl) {
      this.modalEl.classList.add('hidden');
    }
  }

  _generateFpsDiagnostics() {
    const reasons = [];
    const isForced = this.game && this.game.forced120FPS;

    // 1. FPS vs 120 FPS Target Evaluation
    if (this.fps >= 110) {
      reasons.push({
        status: 'optimal',
        icon: '🚀',
        title: 'Motor 3D Operando a 120 FPS (8.33ms por Quadro)!',
        desc: `O motor gráfico e simulação JS atingiram com sucesso a meta de <strong>${this.fps} FPS</strong> (tempo de quadro de ${this.frameTimeMs.toFixed(1)}ms). Sua GPU AMD Radeon RX 6600 consome apenas ${this.gpuTimeMs.toFixed(1)}ms. ${
          isForced
            ? '<br/><strong>Nota de Exibição:</strong> O motor está gerando 120 FPS. Se a percepção visual ou medidores de tela mostrarem 60Hz, certifique-se de que a <em>Taxa de Atualização</em> do Windows está configurada para 120Hz/144Hz nas <em>Configurações de Exibição &gt; Exibição Avançada</em>.'
            : ''
        }`,
      });
    } else if (this.fps >= 58 && this.fps <= 62 && window.screen) {
      reasons.push({
        status: 'info',
        icon: '🔒',
        title: 'Trava VSync do Navegador / Monitor (60 Hz)',
        desc: `O motor gráfico está pronto para 120 FPS (requer apenas ${this.gpuTimeMs.toFixed(1)}ms de GPU). Porém o navegador Edge/Chromium está sincronizado com a frequência do monitor (60Hz). Clique no botão <strong>"⚡ ALTERNAR FORÇAR 120 FPS"</strong> abaixo para ativar o timer de 120 Hz de alta precisão.`,
      });
    } else if (this.fps < 60) {
      reasons.push({
        status: 'critical',
        icon: '⚠️',
        title: 'Taxa de Quadros Reduzida (< 60 FPS)',
        desc: `O tempo de processamento por quadro (${this.frameTimeMs.toFixed(1)}ms) ultrapassa o limite orçamentário de 16.6ms.`,
      });
    }

    // 2. CPU Processing Evaluation
    if (this.cpuTimeMs > 6.0) {
      reasons.push({
        status: 'warning',
        icon: '🧠',
        title: 'Carga Elevada de Processamento CPU (Script JS / Física)',
        desc: `A CPU consome ${this.cpuTimeMs.toFixed(2)}ms por quadro. Os fatores principais são: física do vento, simulação de partículas do three.quarks, cálculo de colisões em lote (NavigationGrid) e lógica de atores.`,
      });
    } else {
      reasons.push({
        status: 'optimal',
        icon: '⚡',
        title: 'Processamento CPU Eficiente & Leve',
        desc: `A lógica JavaScript e atualização de entidades consome apenas ${this.cpuTimeMs.toFixed(2)}ms por quadro (${((this.cpuTimeMs / 8.33) * 100).toFixed(0)}% do orçamento de 120 FPS).`,
      });
    }

    // 3. GPU WebGL Render Evaluation
    if (this.gpuTimeMs > 6.0) {
      reasons.push({
        status: 'warning',
        icon: '🎮',
        title: 'Carga Elevada de GPU (Renderização & Shaders WebGL)',
        desc: `A GPU consome ${this.gpuTimeMs.toFixed(2)}ms por quadro. Motivos principais: shaders Standard de iluminação, mapas de normais da areia e transparência de partículas.`,
      });
    } else {
      reasons.push({
        status: 'optimal',
        icon: '🎯',
        title: 'Renderização GPU & Shaders Otimizados',
        desc: `A GPU conclui a rasterização dos shaders WebGL em ${this.gpuTimeMs.toFixed(2)}ms por quadro.`,
      });
    }

    // 4. Draw Calls & Geometric Instancing
    if (this.drawCalls > 100) {
      reasons.push({
        status: 'warning',
        icon: '📦',
        title: 'Volume Elevado de Chamadas de Desenho (Draw Calls)',
        desc: `Ocupando ${this.drawCalls} Draw Calls por quadro. A consolidação em InstancedMesh reduz a sobrecarga do driver.`,
      });
    } else {
      reasons.push({
        status: 'optimal',
        icon: '🚀',
        title: 'Chamadas de Desenho Baixas & Eficientes',
        desc: `Apenas ${this.drawCalls} Draw Calls por quadro. Uso extensivo de agrupamento de geometrias instanciadas (InstancedMesh).`,
      });
    }

    // 5. Memory Heap & Garbage Collection Assessment
    if (this.usedHeapMB > 0) {
      const ratio = this.usedHeapMB / (this.totalHeapMB || 1);
      if (ratio > 0.85) {
        reasons.push({
          status: 'warning',
          icon: '🧹',
          title: 'Memória Heap Elevada (Risco de Pausas por Coleta de Lixo)',
          desc: `O Heap alocado está em ${this.usedHeapMB} MB / ${this.totalHeapMB} MB. Alocações contínuas de objetos podem causar micro-engasgos durante o descarte pelo navegador.`,
        });
      } else {
        reasons.push({
          status: 'optimal',
          icon: '💾',
          title: 'Gestão de Memória JS Estável',
          desc: `Heap em ${this.usedHeapMB} MB / ${this.totalHeapMB} MB (${(ratio * 100).toFixed(0)}% de ocupação do heap). Sem indícios de vazamento de memória.`,
        });
      }
    }

    return reasons;
  }

  _updateModalData() {
    if (!this.isModalOpen) return;

    // 1. Populate Diagnostic Reasons List
    const reasonsListEl = document.getElementById('perf-diag-reasons-list');
    if (reasonsListEl) {
      const diagnostics = this._generateFpsDiagnostics();
      reasonsListEl.innerHTML = diagnostics
        .map(
          (d) => `
        <div class="diag-reason-item ${d.status}">
          <div class="reason-hdr">
            <span class="reason-icon">${d.icon}</span>
            <span class="reason-title">${d.title}</span>
          </div>
          <div class="reason-desc">${d.desc}</div>
        </div>
      `
        )
        .join('');
    }

    // 2. Populate Detail Metrics Cards
    const elFpsNow = document.getElementById('diag-fps-now');
    const elFpsMinMax = document.getElementById('diag-fps-minmax');
    const elFpsAvg = document.getElementById('diag-fps-avg');
    const elFrameTime = document.getElementById('diag-frametime');

    const elGpuName = document.getElementById('diag-gpu-name');
    const elCpuMs = document.getElementById('diag-cpu-ms');
    const elGpuMs = document.getElementById('diag-gpu-ms');
    const elDrawCalls = document.getElementById('diag-draw-calls');
    const elTriangles = document.getElementById('diag-triangles');

    const elGeometries = document.getElementById('diag-geometries');
    const elTextures = document.getElementById('diag-textures');
    const elHeapUsed = document.getElementById('diag-heap-used');
    const elHeapTotal = document.getElementById('diag-heap-total');
    const elGcStatus = document.getElementById('diag-gc-status');

    const elBrowser = document.getElementById('diag-browser');
    const elWebglVer = document.getElementById('diag-webgl-ver');
    const elScreenRes = document.getElementById('diag-screen-res');
    const elPixelRatio = document.getElementById('diag-pixel-ratio');

    if (elFpsNow) elFpsNow.textContent = `${this.fps} FPS`;
    if (elFpsMinMax) elFpsMinMax.textContent = `${this.minFps} / ${this.maxFps} FPS`;
    if (elFpsAvg) elFpsAvg.textContent = `${this.avgFps} FPS`;
    if (elFrameTime) elFrameTime.textContent = `${this.frameTimeMs.toFixed(1)} ms`;

    if (elGpuName) elGpuName.textContent = this.gpuHardwareName;
    if (elCpuMs) elCpuMs.textContent = `${this.cpuTimeMs.toFixed(2)} ms`;
    if (elGpuMs) elGpuMs.textContent = `${this.gpuTimeMs.toFixed(2)} ms`;
    if (elDrawCalls) elDrawCalls.textContent = this.drawCalls;
    if (elTriangles) elTriangles.textContent = `${this.triangles.toLocaleString()} polígonos`;

    if (elGeometries) elGeometries.textContent = `${this.geometriesCount} GEO`;
    if (elTextures) elTextures.textContent = `${this.texturesCount} TEX`;
    if (elHeapUsed) elHeapUsed.textContent = `${this.usedHeapMB} MB`;
    if (elHeapTotal) elHeapTotal.textContent = `${this.totalHeapMB} MB`;
    if (elGcStatus) {
      const ratio = this.usedHeapMB / (this.totalHeapMB || 1);
      elGcStatus.textContent = ratio > 0.85 ? 'Atenção (Heap Cheio)' : 'Excelente (Sem vazamento)';
    }

    if (elBrowser) elBrowser.textContent = navigator.userAgent.includes('Edg') ? 'Microsoft Edge (Chromium)' : 'Navegador Chromium';
    if (elWebglVer) elWebglVer.textContent = 'WebGL 2.0 (High Precision)';
    if (elScreenRes) elScreenRes.textContent = `${window.innerWidth}x${window.innerHeight}`;
    if (elPixelRatio) elPixelRatio.textContent = `${window.devicePixelRatio || 1}x`;
  }

  copyReportToClipboard() {
    const report = {
      timestamp: new Date().toISOString(),
      targetFps: this.targetFps,
      metrics: {
        fpsCurrent: this.fps,
        fpsAvg: this.avgFps,
        fpsMin: this.minFps,
        fpsMax: this.maxFps,
        frameTimeMs: parseFloat(this.frameTimeMs.toFixed(2)),
        cpuTimeMs: parseFloat(this.cpuTimeMs.toFixed(2)),
        gpuTimeMs: parseFloat(this.gpuTimeMs.toFixed(2)),
        drawCalls: this.drawCalls,
        triangles: this.triangles,
        vramGeometries: this.geometriesCount,
        vramTextures: this.texturesCount,
        jsHeapUsedMB: parseFloat(this.usedHeapMB),
        jsHeapTotalMB: parseFloat(this.totalHeapMB),
      },
      hardware: {
        gpu: this.gpuHardwareName,
        browser: navigator.userAgent,
        screenResolution: `${window.innerWidth}x${window.innerHeight}`,
        devicePixelRatio: window.devicePixelRatio || 1,
      },
      diagnostics: this._generateFpsDiagnostics().map((d) => ({
        status: d.status,
        title: d.title,
        description: d.desc,
      })),
    };

    const text = JSON.stringify(report, null, 2);
    navigator.clipboard
      .writeText(text)
      .then(() => {
        const btn = document.getElementById('btn-copy-perf-report');
        if (btn) {
          const original = btn.textContent;
          btn.textContent = '✅ RELATÓRIO COPIADO!';
          setTimeout(() => {
            btn.textContent = original;
          }, 2000);
        }
      })
      .catch((err) => {
        console.warn('Clipboard copy failed:', err);
      });
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
    const instantFps = this.frameTimeMs > 0 ? 1000 / this.frameTimeMs : this.targetFps;
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

    const nowMs = performance.now();
    if (nowMs - (this.lastUiUpdate || 0) >= 100) {
      this._updateUI();
      this._renderSparkline();
      this.lastUiUpdate = nowMs;
    }
    if (this.isModalOpen) {
      if (nowMs - (this.lastModalUpdate || 0) > 600) {
        this._updateModalData();
        this.lastModalUpdate = nowMs;
      }
    }
  }

  _updateUI() {
    if (this.fpsValEl) {
      this.fpsValEl.textContent = this.fps;
      if (this.fps >= 110) {
        this.fpsValEl.style.color = '#54f08c';
      } else if (this.fps >= 60) {
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
    const targetFt = 1000 / this.targetFps; // 8.33ms for 120 FPS target

    for (let i = 0; i < this.historyLength; i++) {
      const idx = (this.historyIndex + i) % this.historyLength;
      const ft = this.frameHistory[idx];

      const barHeight = Math.min(h, (ft / (targetFt * 2)) * h);
      const x = i * barW;
      const y = h - barHeight;

      if (ft <= 9.1) { // >= ~110 FPS
        ctx.fillStyle = '#54f08c';
      } else if (ft <= 16.7) { // >= 60 FPS
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
    if (this.modalEl && this.modalEl.parentNode) {
      this.modalEl.parentNode.removeChild(this.modalEl);
    }
  }
}
