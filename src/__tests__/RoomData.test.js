import { describe, expect, it } from 'vitest';
import { ROOMS, getRoomAt, getRoomById } from '../world/RoomData.js';

describe('RoomData', () => {
  it('finds the mannequin wing at its world coordinates', () => {
    expect(getRoomAt(-34, -14).name).toBe('ALA DE MANEQUINS');
  });

  it('finds the confirmed testing room at its world coordinates', () => {
    expect(getRoomAt(0, -56).name).toBe('SALA DE TESTES - CONFIRMED 42');
  });

  it('keeps every room identifier unique', () => {
    expect(new Set(ROOMS.map(({ id }) => id)).size).toBe(ROOMS.length);
  });

  it('provides immutable navigation and wind metadata for each room', () => {
    const testingRoom = getRoomById('testing_room');

    expect(testingRoom.navigation).toEqual({ x: 0, z: -56 });
    expect(testingRoom.windProfile).toBe('testing');
    expect(Object.isFrozen(testingRoom)).toBe(true);
    expect(Object.isFrozen(ROOMS)).toBe(true);
  });
});
