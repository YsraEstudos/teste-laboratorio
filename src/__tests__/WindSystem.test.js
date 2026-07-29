// @ts-check

import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { WindAudio } from '../wind/WindAudio.js';
import { WindSystem } from '../wind/WindSystem.js';
import { createWindImpulse } from '../wind/WindImpulse.js';

function createObject(type = 'folha_papel', position = new THREE.Vector3()) {
  return {
    type,
    position,
    mesh: { position },
    velocity: new THREE.Vector3(1, 0, 2),
  };
}

describe('WindSystem', () => {
  it('adds continuous wind response without replacing existing velocity', () => {
    const system = Object.create(WindSystem.prototype);
    system.field = {
      gustIntensity: 0,
      time: 0,
      sample: (_position, out) => out.set(2, 0, 3),
    };
    system._objectWind = new THREE.Vector3();
    const object = createObject();

    system.applyToObjects([object], 0.5);

    expect(object.velocity.x).toBeCloseTo(3.15);
    expect(object.velocity.y).toBeCloseTo(1.033331, 5);
    expect(object.velocity.z).toBeCloseTo(5.225);
  });

  it('applies a shared impulse using each object distance from its origin', () => {
    const system = Object.create(WindSystem.prototype);
    const center = createObject('generic', new THREE.Vector3(0, 0, 0));
    center.velocity.set(0, 0, 0);
    const edge = createObject('generic', new THREE.Vector3(6, 0, 0));
    edge.velocity.set(5, 5, 5);
    const impulse = createWindImpulse({
      origin: new THREE.Vector3(),
      direction: new THREE.Vector3(1, 0, 0),
      power: 4,
      radius: 6,
      falloff: 'linear',
      verticalLift: 1.5,
      duration: 0.2,
      source: 'blast',
    });

    const applied = system.applyImpulse(impulse, [center, edge]);

    expect(applied).toBe(1);
    expect(center.velocity.toArray()).toEqual([4, 1.5, 0]);
    expect(edge.velocity.toArray()).toEqual([5, 5, 5]);
  });

  it('delegates start, pause and resume to the ambient audio owner', () => {
    const system = Object.create(WindSystem.prototype);
    system.audio = {
      start: vi.fn(),
      suspend: vi.fn(),
      resume: vi.fn(),
    };

    system.startAudio();
    system.suspendAudio();
    system.resumeAudio();

    expect(system.audio.start).toHaveBeenCalledOnce();
    expect(system.audio.suspend).toHaveBeenCalledOnce();
    expect(system.audio.resume).toHaveBeenCalledOnce();
  });

  it('disposes visual and audio children only once', () => {
    const system = Object.create(WindSystem.prototype);
    system.dust = { dispose: vi.fn() };
    system.streaks = { dispose: vi.fn() };
    system.audio = { dispose: vi.fn() };
    system.disposed = false;

    system.dispose();
    system.dispose();

    expect(system.dust.dispose).toHaveBeenCalledOnce();
    expect(system.streaks.dispose).toHaveBeenCalledOnce();
    expect(system.audio.dispose).toHaveBeenCalledOnce();
  });
});

describe('WindAudio', () => {
  it('closes its AudioContext once during idempotent disposal', () => {
    const audio = new WindAudio();
    const close = vi.fn();
    audio.context = { close };
    audio.source = { stop: vi.fn(), disconnect: vi.fn() };
    audio.lowpass = { disconnect: vi.fn() };
    audio.whistle = { disconnect: vi.fn() };
    audio.whistleGain = { disconnect: vi.fn() };
    audio.master = { disconnect: vi.fn() };
    audio.started = true;

    audio.dispose();
    audio.dispose();

    expect(close).toHaveBeenCalledOnce();
    expect(audio.context).toBeNull();
    expect(audio.started).toBe(false);
  });
});
