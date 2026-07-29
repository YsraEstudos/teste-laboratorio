/**
 * Shared wind ability tuning. Keep gameplay values in seconds and energy points.
 */
export const WindConfig = Object.freeze({
  chargeDuration: 0.7,
  cooldownDuration: 0.75,
  energyCost: 10,
  energyRecoveryRate: 8,
  minimumEnergy: 10,
  blastRange: 18,
  powerThresholds: Object.freeze({
    low: 3,
    medium: 6,
    high: 9,
  }),
});
