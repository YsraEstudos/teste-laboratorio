import { describe, expect, it } from 'vitest';
import { SandContactSystem } from '../world/SandContactSystem.js';

describe('SandContactSystem', () => {
  it('não gera contato parado, interpola movimento rápido e limita o frame', () => {
    const contacts = [];
    const system = new SandContactSystem({
      maxBrushesPerFrame: 3,
      maxInterpolatedSteps: 8,
      onContact: (...args) => {
        contacts.push(args);
        return true;
      },
    });

    system.beginFrame();
    system.updateActor('player', { x: 0, z: -55 }, 1 / 60);
    system.updateActor('player', { x: 2, z: -55 }, 0.2);
    expect(contacts.length).toBe(3);
    expect(contacts[0][0]).toBeGreaterThan(0);
    expect(system.getStats().droppedContacts).toBeGreaterThan(0);
  });

  it('ignora entradas fora da arena e teleporte não cria milhares de stamps', () => {
    const contacts = [];
    const system = new SandContactSystem({
      maxInterpolatedSteps: 4,
      onContact: (...args) => {
        contacts.push(args);
        return true;
      },
    });

    system.beginFrame();
    system.updateActor('player', { x: 1000, z: -55 }, 1);
    system.updateActor('player', { x: 0, z: -55 }, 1);
    system.updateActor('player', { x: 1000, z: -55 }, 1);
    expect(contacts.length).toBe(0);
  });

  it('aceita jogador e Wind Child simultaneamente e descarta após dispose', () => {
    let accepted = 0;
    const system = new SandContactSystem({
      onContact: () => {
        accepted += 1;
        return true;
      },
    });

    system.beginFrame();
    system.updateActor('player', { x: 0, z: -55 }, 1);
    system.updateActor('wind-child', { x: 1, z: -55 }, 1);
    system.dispose();
    system.updateActor('player', { x: 2, z: -55 }, 1);
    expect(accepted).toBe(0);
    expect(() => system.dispose()).not.toThrow();
  });

  it('usa o mesmo sampler para o wake do Wind Child', () => {
    const sources = [];
    const system = new SandContactSystem({
      onContact: (...args) => {
        sources.push(args[9]);
        return true;
      },
    });

    system.beginFrame();
    system.updateWake('wind-child', { x: 0, z: -55 }, 1 / 60);
    system.updateWake('wind-child', { x: 1, z: -55 }, 0.2);

    expect(sources).toContain('wake');
  });
});
