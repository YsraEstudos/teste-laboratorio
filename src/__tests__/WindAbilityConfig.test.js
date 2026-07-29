// @ts-check

import { describe, expect, it } from 'vitest';
import { WindConfig } from '../config/WindConfig.js';
import { WindAbilityConfig } from '../abilities/WindAbilityConfig.js';

describe('WindConfig', () => {
  it('is the immutable source for wind ability timings, energy, range, and power thresholds', () => {
    expect(WindConfig).toMatchObject({
      chargeDuration: 0.7,
      cooldownDuration: 0.75,
      energyCost: 10,
      energyRecoveryRate: expect.any(Number),
      minimumEnergy: 10,
      blastRange: 18,
      powerThresholds: expect.any(Object),
    });
    expect(Object.isFrozen(WindConfig)).toBe(true);
    expect(Object.isFrozen(WindConfig.powerThresholds)).toBe(true);
    expect(WindAbilityConfig).toBe(WindConfig);
  });
});
