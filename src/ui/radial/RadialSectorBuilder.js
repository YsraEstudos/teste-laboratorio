import { RADIAL_MENU_TOKENS } from './RadialMenuConfig.js';

/**
 * Calculates SVG arc path data for a sector.
 * @param {number} startAngle Start angle in radians.
 * @param {number} endAngle End angle in radians.
 * @param {number} outerR Outer radius.
 * @param {number} innerR Inner radius.
 * @param {number} center Center coordinate.
 * @returns {string} SVG path string (M ... A ... L ... A ... Z).
 */
export function calculateArcPath(startAngle, endAngle, outerR, innerR, center) {
  const x1 = center + outerR * Math.cos(startAngle);
  const y1 = center + outerR * Math.sin(startAngle);
  const x2 = center + outerR * Math.cos(endAngle);
  const y2 = center + outerR * Math.sin(endAngle);

  const x3 = center + innerR * Math.cos(endAngle);
  const y3 = center + innerR * Math.sin(endAngle);
  const x4 = center + innerR * Math.cos(startAngle);
  const y4 = center + innerR * Math.sin(startAngle);

  const angleStep = endAngle - startAngle;
  const largeArc = angleStep > Math.PI ? 1 : 0;

  return [
    `M ${x1} ${y1}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4}`,
    'Z',
  ].join(' ');
}

/**
 * Creates individual sector SVG elements (<g>, <path>, <foreignObject>).
 * @param {Object} sector Sector definition.
 * @param {number} index Sector index.
 * @param {number} totalCount Total sector count.
 * @param {Object} tokens Visual tokens.
 * @param {Object} handlers Event callback handlers.
 * @returns {{ g: Element, path: Element, sector: Object }}
 */
export function createSectorNode(sector, index, totalCount, tokens = RADIAL_MENU_TOKENS, handlers = {}) {
  const size = tokens.size;
  const center = size / 2;
  const outerR = tokens.outerRadius;
  const innerR = tokens.innerRadius;

  const angleStep = (2 * Math.PI) / totalCount;
  const startAngle = index * angleStep - Math.PI / 2;
  const endAngle = (index + 1) * angleStep - Math.PI / 2;
  const midAngle = (startAngle + endAngle) / 2;

  const pathData = calculateArcPath(startAngle, endAngle, outerR, innerR, center);

  const g = document.createElementNS(tokens.svgNamespace, 'g');
  g.setAttribute('class', 'radial-sector-group');
  g.setAttribute('data-id', sector.id);
  g.setAttribute('data-index', String(index));
  g.setAttribute('role', 'menuitem');
  g.setAttribute('aria-label', sector.title);
  g.setAttribute('tabindex', '-1');

  const path = document.createElementNS(tokens.svgNamespace, 'path');
  path.setAttribute('d', pathData);
  path.setAttribute('class', 'radial-sector-path');

  const labelR = (innerR + outerR) / 2;
  const iconX = center + labelR * Math.cos(midAngle);
  const iconY = center + labelR * Math.sin(midAngle);

  const foreignObj = document.createElementNS(tokens.svgNamespace, 'foreignObject');
  foreignObj.setAttribute('x', String(iconX + tokens.labelOffsetX));
  foreignObj.setAttribute('y', String(iconY + tokens.labelOffsetY));
  foreignObj.setAttribute('width', String(tokens.labelWidth));
  foreignObj.setAttribute('height', String(tokens.labelHeight));
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

  if (handlers.onHover) {
    g.addEventListener('mouseenter', () => handlers.onHover(sector, g));
  }
  if (handlers.onLeave) {
    g.addEventListener('mouseleave', () => handlers.onLeave(g));
  }
  if (handlers.onFocus) {
    g.addEventListener('focus', () => {
      handlers.onFocus(index);
      if (handlers.onHover) handlers.onHover(sector, g);
    });
  }
  if (handlers.onLeave) {
    g.addEventListener('blur', () => handlers.onLeave(g));
  }
  if (handlers.onClick) {
    g.addEventListener('click', (e) => {
      e.stopPropagation();
      handlers.onClick(sector, index);
    });
  }

  return { g, path, sector };
}

/**
 * Builds the complete DOM tree for RadialMenu.
 * @param {Array<Object>} sectors Array of sector definitions.
 * @param {Object} menuInstance RadialMenu instance.
 * @param {Object} tokens Visual tokens.
 * @returns {Object} References to created DOM elements.
 */
export function buildRadialMenuDOM(sectors, menuInstance, tokens = RADIAL_MENU_TOKENS) {
  const container = document.createElement('div');
  container.id = 'radial-menu-container';
  container.className = 'radial-menu-overlay hidden';
  container.setAttribute('role', 'menu');
  container.setAttribute('aria-label', tokens.ariaLabel);
  container.setAttribute('aria-hidden', 'true');

  const menuWrapper = document.createElement('div');
  menuWrapper.className = 'radial-menu-wrapper';

  const svg = document.createElementNS(tokens.svgNamespace, 'svg');
  svg.setAttribute('viewBox', `0 0 ${tokens.size} ${tokens.size}`);
  svg.setAttribute('class', 'radial-svg');

  const sectorElements = [];

  sectors.forEach((sector, index) => {
    const node = createSectorNode(sector, index, sectors.length, tokens, {
      onHover: (sec, g) => menuInstance._onSectorHover(sec, g),
      onLeave: (g) => menuInstance._onSectorLeave(g),
      onFocus: (idx) => menuInstance._setActiveSector(idx, false),
      onClick: (sec, idx) => {
        menuInstance._setActiveSector(idx, false);
        menuInstance._onSectorClick(sec);
      },
    });
    svg.appendChild(node.g);
    sectorElements.push(node);
  });

  const centerCore = document.createElement('div');
  centerCore.className = 'radial-center-core';
  centerCore.innerHTML = `
    <div class="core-avatar">🌀</div>
    <div class="core-title">WIND CHILD</div>
    <div class="core-power-badge">PODER <span id="radial-power-val">5</span></div>
  `;

  const powerSelector = document.createElement('div');
  powerSelector.className = 'power-selector-ring hidden';
  let powerHtml = '<div class="power-title">NÍVEL DE PODER (1-10)</div><div class="power-buttons">';
  for (let i = tokens.powerLevelMin; i <= tokens.powerLevelMax; i++) {
    powerHtml += `<button class="power-btn" data-level="${i}">${i}</button>`;
  }
  powerHtml += '</div>';
  powerSelector.innerHTML = powerHtml;

  powerSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('.power-btn');
    if (btn) {
      const lvl = parseInt(btn.dataset.level, 10);
      menuInstance._setPowerLevel(lvl);
    }
  });

  const tooltipPanel = document.createElement('div');
  tooltipPanel.className = 'radial-tooltip-panel';
  tooltipPanel.innerHTML = `
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
        <div class="stat-bar"><div class="stat-fill happiness" id="tooltip-hap-bar" style="width: 80%"></div></div>
        <span class="stat-val" id="tooltip-hap-val">80%</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Energia:</span>
        <div class="stat-bar"><div class="stat-fill energy" id="tooltip-nrg-bar" style="width: 90%"></div></div>
        <span class="stat-val" id="tooltip-nrg-val">90%</span>
      </div>
    </div>
  `;

  menuWrapper.appendChild(svg);
  menuWrapper.appendChild(centerCore);
  menuWrapper.appendChild(powerSelector);
  menuWrapper.appendChild(tooltipPanel);

  container.appendChild(menuWrapper);
  document.body.appendChild(container);

  return {
    container,
    svg,
    sectorElements,
    powerSelector,
    tooltipPanel,
  };
}
