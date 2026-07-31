/**
 * RadialMenuConfig contains sector definitions, titles, icons, descriptions,
 * and visual theme tokens for the RadialMenu.
 */

export const RADIAL_MENU_TOKENS = {
  size: 340,
  outerRadius: 155,
  innerRadius: 62,
  menuWidth: 360,
  menuHeight: 480,
  viewportPadding: 10,
  labelWidth: 96,
  labelHeight: 48,
  labelOffsetX: -48,
  labelOffsetY: -24,
  svgNamespace: 'http://www.w3.org/2000/svg',
  powerLevelMin: 1,
  powerLevelMax: 10,
  ariaLabel: 'Ações da Wind Child',
};

export const SECTOR_DEFINITIONS_DATA = [
  {
    id: 'move-testing',
    title: 'SALA DE TESTES',
    icon: '🧭',
    description: 'Navegar o Wind Child até a Sala de Testes (Z = -54).',
    actionKey: '_moveToTestingRoom',
  },
  {
    id: 'call-child',
    title: 'CHARMAR CRIANÇA',
    icon: '🚶',
    description: 'Trazer o Wind Child para perto da posição do jogador.',
    actionKey: '_callToPlayer',
  },
  {
    id: 'power-level',
    title: 'NÍVEL DE PODER',
    icon: '⚡',
    description: 'Ajustar o nível de poder elemental do Wind Child (1 a 10).',
    hasSubmenu: true,
    actionKey: '_setPowerLevel',
  },
  {
    id: 'restore-status',
    title: 'RESTAURAR STATUS',
    icon: '💚',
    description: 'Restaurar a Felicidade (100%) e Energia (100%) do Wind Child.',
    actionKey: '_restoreStatus',
  },
  {
    id: 'wind-blast',
    title: 'RÁFAGA DE VENTO',
    icon: '🌀',
    description: 'Disparar uma potente ráfaga aerodinâmica com efeitos visuais.',
    actionKey: '_triggerWindBlast',
  },
  {
    id: 'inspect-details',
    title: 'INSPECIONAR',
    icon: '📊',
    description: 'Exibir telemetria completa e diagnóstico do Wind Child.',
    actionKey: '_inspectDetails',
  },
];

/**
 * Creates sectors array bound to a RadialMenu instance.
 * @param {Object} menuInstance The RadialMenu instance.
 * @returns {Array<Object>} List of sectors with action callbacks.
 */
export function createDefaultSectors(menuInstance) {
  return SECTOR_DEFINITIONS_DATA.map((def) => {
    const sector = {
      id: def.id,
      title: def.title,
      icon: def.icon,
      description: def.description,
    };
    if (def.hasSubmenu) {
      sector.hasSubmenu = true;
    }
    sector.action = (...args) => {
      if (typeof menuInstance[def.actionKey] === 'function') {
        return menuInstance[def.actionKey](...args);
      }
    };
    return sector;
  });
}
