const freezeRoom = (room) =>
  Object.freeze({
    ...room,
    navigation: Object.freeze(room.navigation),
  });

export const ROOMS = Object.freeze([
  freezeRoom({
    id: 'entrance',
    name: 'ENTRADA',
    color: '#ffd36d',
    minX: -9,
    maxX: 9,
    minZ: -2,
    maxZ: 9,
    description: 'Recepção principal do laboratório. Ponto de entrada para pesquisadores e visitantes.',
    navigation: { x: 0, z: 3.5 },
    windProfile: 'entrance',
  }),
  freezeRoom({
    id: 'central',
    name: 'CENTRAL',
    color: '#49d7e8',
    minX: -10,
    maxX: 10,
    minZ: -18,
    maxZ: -10,
    description: 'Hub central de inteligência e distribuição de energia para todas as alas.',
    navigation: { x: 0, z: -14 },
    windProfile: 'central',
  }),
  freezeRoom({
    id: 'mannequins',
    name: 'ALA DE MANEQUINS',
    color: '#57f0ff',
    minX: -40,
    maxX: -28,
    minZ: -22,
    maxZ: -6,
    description: 'Setor de testes biomecânicos e protótipos de robótica avançada.',
    navigation: { x: -34, z: -14 },
    windProfile: 'standard',
  }),
  freezeRoom({
    id: 'objects',
    name: 'ALA DE OBJETOS',
    color: '#ffb85c',
    minX: 28,
    maxX: 40,
    minZ: -22,
    maxZ: -6,
    description: 'Armazém de amostragem física, contêineres e equipamentos.',
    navigation: { x: 34, z: -14 },
    windProfile: 'standard',
  }),
  freezeRoom({
    id: 'serene_forest',
    name: 'SALA VERDE - FLORESTA SERENA',
    color: '#73ae63',
    minX: -40,
    maxX: -28,
    minZ: -44,
    maxZ: -30,
    description: 'Domo de simulação ambiental arbórea e botânica equilibrada.',
    navigation: { x: -34, z: -37 },
    windProfile: 'green',
  }),
  freezeRoom({
    id: 'gentle_meadow',
    name: 'SALA VERDE - PRADO GENTIL',
    color: '#98e66b',
    minX: 28,
    maxX: 40,
    minZ: -44,
    maxZ: -30,
    description: 'Domo de simulação biológica com espelho d’água e flora expansiva.',
    navigation: { x: 34, z: -37 },
    windProfile: 'green',
  }),
  freezeRoom({
    id: 'testing_room',
    name: 'SALA DE TESTES - CONFIRMED 42',
    color: '#f07170',
    minX: -14,
    maxX: 14,
    minZ: -66,
    maxZ: -46,
    description: 'Câmara isolada para testes elementais e forças psicocinéticas (Confirmed 42).',
    navigation: { x: 0, z: -56 },
    windProfile: 'testing',
  }),
]);

export const TACMAP_CORRIDORS = Object.freeze([
  Object.freeze({ minX: -3, maxX: 3, minZ: -10, maxZ: -2 }),
  Object.freeze({ minX: -28, maxX: -10, minZ: -15, maxZ: -11 }),
  Object.freeze({ minX: 10, maxX: 28, minZ: -15, maxZ: -11 }),
  Object.freeze({ minX: -3, maxX: 3, minZ: -30, maxZ: -18 }),
  Object.freeze({ minX: -28, maxX: -3, minZ: -34, maxZ: -30 }),
  Object.freeze({ minX: 3, maxX: 28, minZ: -34, maxZ: -30 }),
  Object.freeze({ minX: -3, maxX: 3, minZ: -46, maxZ: -34 }),
]);

export const TACMAP_WORLD_BOUNDS = Object.freeze({
  minX: -45,
  maxX: 45,
  minZ: -68,
  maxZ: 12,
});

export function getRoomAt(x, z) {
  return ROOMS.find((room) => x >= room.minX && x <= room.maxX && z >= room.minZ && z <= room.maxZ) ?? null;
}

export function getRoomById(id) {
  return ROOMS.find((room) => room.id === id) ?? null;
}
