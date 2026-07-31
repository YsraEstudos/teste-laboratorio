import { describe, expect, it, vi } from 'vitest';
import { SandFootstepSystem } from '../world/SandFootstepSystem.js';

function createSystem() {
  const stamps = [];
  const system = new SandFootstepSystem({
    onFootprint: (x, z, yaw, options) => {
      stamps.push({ x, z, yaw, options });
      return true;
    },
  });
  return { system, stamps };
}

describe('SandFootstepSystem registration', () => {
  it('registers actors and reports them in stats', () => {
    const { system } = createSystem();
    expect(system.registerActor('player', { footprintProfile: 'player', minStepDistance: 0.2 })).toBe(true);
    expect(system.registerActor('wind-child', { footprintProfile: 'child' })).toBe(true);
    expect(system.getStats().registered).toBe(2);
    expect(system.hasDetailedFootprints('player')).toBe(true);
    expect(system.hasDetailedFootprints('wind-child')).toBe(true);
    expect(system.hasDetailedFootprints('actor-1')).toBe(false);
    system.dispose();
  });

  it('rejects empty ids after disposal', () => {
    const { system } = createSystem();
    expect(system.registerActor('', {})).toBe(false);
    system.dispose();
    expect(system.registerActor('player', {})).toBe(false);
    expect(system.updateActor('player', { x: 0, z: -55 }, 0, 1 / 60)).toBe(false);
  });
});

describe('SandFootstepSystem player stepping', () => {
  it('steps once on a 0.5 gait-cycle crossing once the distance gate is met, starting left', () => {
    const { system, stamps } = createSystem();
    system.registerActor('player', { footprintProfile: 'player', minStepDistance: 0.2 });

    // First update initializes without stamping.
    expect(system.updateActor('player', { x: 0, z: -55 }, 0, 1 / 60, 0)).toBe(false);
    expect(stamps).toHaveLength(0);

    // Movement without a phase crossing: no step.
    expect(system.updateActor('player', { x: 0.3, z: -55 }, 0, 1 / 60, 0.49)).toBe(false);
    expect(stamps).toHaveLength(0);

    // Phase crosses 0.5 while distance >= 0.2: one step, left foot first.
    expect(system.updateActor('player', { x: 0.6, z: -55 }, 0, 1 / 60, 0.51)).toBe(true);
    expect(stamps).toHaveLength(1);
    expect(system.getStats().stepsLeft).toBe(1);
    expect(system.getStats().stepsRight).toBe(0);

    // Distance gate not yet met after the step: crossing without movement.
    expect(system.updateActor('player', { x: 0.6, z: -55 }, 0, 1 / 60, 1.01)).toBe(false);

    // Next crossing with distance: right foot.
    expect(system.updateActor('player', { x: 0.9, z: -55 }, 0, 1 / 60, 1.51)).toBe(true);
    expect(stamps).toHaveLength(2);
    expect(system.getStats().stepsLeft).toBe(1);
    expect(system.getStats().stepsRight).toBe(1);
    system.dispose();
  });

  it('stamps at the animated foot anchor when offsets are functions', () => {
    const { system, stamps } = createSystem();
    const anchors = { left: { x: -0.2, z: 0.3 }, right: { x: 0.2, z: 0.3 } };
    system.registerActor('player', {
      footprintProfile: 'player',
      minStepDistance: 0.2,
      leftOffset: (out) => {
        out.x = anchors.left.x;
        out.z = anchors.left.z;
      },
      rightOffset: (out) => {
        out.x = anchors.right.x;
        out.z = anchors.right.z;
      },
    });

    system.updateActor('player', { x: 0, z: -55 }, 0, 1 / 60, 0); // init
    system.updateActor('player', { x: 0.3, z: -55 }, 0, 1 / 60, 0.51); // left step
    expect(stamps[0].x).toBeCloseTo(anchors.left.x, 5);
    expect(stamps[0].z).toBeCloseTo(anchors.left.z, 5);

    system.updateActor('player', { x: 0.6, z: -55 }, 0, 1 / 60, 1.51); // right step
    expect(stamps[1].x).toBeCloseTo(anchors.right.x, 5);
    system.dispose();
  });
});

describe('SandFootstepSystem distance-only actors', () => {
  it('steps every minStepDistance and alternates sides', () => {
    const { system, stamps } = createSystem();
    system.registerActor('wind-child', {
      footprintProfile: 'child',
      width: 0.1,
      length: 0.16,
      minStepDistance: 0.5,
      leftOffset: { x: -0.05, z: 0 },
      rightOffset: { x: 0.05, z: 0 },
    });

    system.updateActor('wind-child', { x: 0, z: -55 }, 0, 1 / 60); // init
    system.updateActor('wind-child', { x: 0.4, z: -55 }, 0, 1 / 60); // below gate
    expect(stamps).toHaveLength(0);
    system.updateActor('wind-child', { x: 0.55, z: -55 }, 0, 1 / 60); // 0.55 >= 0.5
    expect(stamps).toHaveLength(1);
    system.updateActor('wind-child', { x: 1.0, z: -55 }, 0, 1 / 60); // 0.45 < 0.5
    expect(stamps).toHaveLength(1);
    system.updateActor('wind-child', { x: 1.6, z: -55 }, 0, 1 / 60); // 0.6 >= 0.5
    expect(stamps).toHaveLength(2);
    expect(system.getStats().stepsLeft).toBe(1);
    expect(system.getStats().stepsRight).toBe(1);
    system.dispose();
  });

  it('rotates static offsets by the actor yaw', () => {
    const { system, stamps } = createSystem();
    system.registerActor('wind-child', {
      footprintProfile: 'child',
      minStepDistance: 0.5,
      leftOffset: { x: -0.05, z: 0 },
      rightOffset: { x: 0.05, z: 0 },
    });

    system.updateActor('wind-child', { x: 0, z: -55 }, 0, 1 / 60); // init
    // Heading PI/2: forward is +X, so the left foot (local -X) lands at +Z.
    system.updateActor('wind-child', { x: 0.6, z: -55 }, Math.PI / 2, 1 / 60);
    expect(stamps[0].x).toBeCloseTo(0.6, 5);
    expect(stamps[0].z).toBeCloseTo(-55 + 0.05, 5);
    system.dispose();
  });

  it('emits at most one step per call even for large jumps', () => {
    const { system, stamps } = createSystem();
    system.registerActor('wind-child', { footprintProfile: 'child', minStepDistance: 0.5 });
    system.updateActor('wind-child', { x: 0, z: -55 }, 0, 1 / 60); // init
    system.updateActor('wind-child', { x: 3, z: -55 }, 0, 1 / 60); // 3 m in one call
    expect(stamps).toHaveLength(1);
    system.dispose();
  });

  it('resets on teleport beyond 4 m without stamping', () => {
    const { system, stamps } = createSystem();
    system.registerActor('wind-child', { footprintProfile: 'child', minStepDistance: 0.5 });
    system.updateActor('wind-child', { x: 0, z: -55 }, 0, 1 / 60); // init
    system.updateActor('wind-child', { x: 0.6, z: -55 }, 0, 1 / 60); // step
    expect(stamps).toHaveLength(1);
    system.updateActor('wind-child', { x: 10, z: -55 }, 0, 1 / 60); // teleport
    expect(stamps).toHaveLength(1);
    // 0.6 m from the teleport landing spot would have stepped before; now it
    // behaves as a fresh actor (initialized again, no immediate step).
    system.updateActor('wind-child', { x: 10.6, z: -55 }, 0, 1 / 60);
    expect(stamps).toHaveLength(1);
    system.dispose();
  });

  it('discards out-of-bounds updates and counts them', () => {
    const { system, stamps } = createSystem();
    system.registerActor('wind-child', { footprintProfile: 'child', minStepDistance: 0.5 });
    system.updateActor('wind-child', { x: 0, z: -55 }, 0, 1 / 60); // init
    system.updateActor('wind-child', { x: 100, z: 100 }, 0, 1 / 60); // out of bounds
    expect(system.getStats().discardedOutOfBounds).toBe(1);
    expect(stamps).toHaveLength(0);
    system.dispose();
  });
});

describe('SandFootstepSystem stamp outcome and VFX', () => {
  it('counts rejected stamps as dropped and skips VFX', () => {
    const vfx = { triggerSandFootstepAt: vi.fn() };
    let accepted = true;
    const system = new SandFootstepSystem({
      onFootprint: () => accepted,
    });
    system.setSandVFX(vfx);
    system.registerActor('wind-child', { footprintProfile: 'child', minStepDistance: 0.5 });
    system.updateActor('wind-child', { x: 0, z: -55 }, 0, 1 / 60); // init
    system.updateActor('wind-child', { x: 0.6, z: -55 }, 0, 1 / 60); // accepted
    expect(system.getStats().acceptedFootprints).toBe(1);
    expect(vfx.triggerSandFootstepAt).toHaveBeenCalledOnce();

    accepted = false;
    system.updateActor('wind-child', { x: 1.2, z: -55 }, 0, 1 / 60); // rejected
    expect(system.getStats().droppedFootprints).toBe(1);
    expect(vfx.triggerSandFootstepAt).toHaveBeenCalledOnce();
    system.dispose();
  });

  it('passes width and length through to the stamp callback', () => {
    const { system, stamps } = createSystem();
    system.registerActor('player', {
      footprintProfile: 'player',
      width: 0.15,
      length: 0.29,
      minStepDistance: 0.2,
    });
    system.updateActor('player', { x: 0, z: -55 }, 0, 1 / 60, 0); // init
    system.updateActor('player', { x: 0.3, z: -55 }, 0.5, 1 / 60, 0.51);
    expect(stamps[0].options.width).toBeCloseTo(0.15, 5);
    expect(stamps[0].options.length).toBeCloseTo(0.29, 5);
    expect(stamps[0].yaw).toBeCloseTo(0.5, 5);
    system.dispose();
  });
});
