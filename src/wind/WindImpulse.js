const leafProfile = Object.freeze({
  speed: (effectivePower) => 4.5 + effectivePower * 1.2,
  lift: (effectivePower) => 3.5 + effectivePower * 0.8,
});

export const BlastProfile = Object.freeze({
  folha_papel: leafProfile,
  folha_arvore: leafProfile,
  papelao: Object.freeze({
    speed: (effectivePower) => (effectivePower >= 1.7 ? Math.min(12.5, 3.2 + (effectivePower - 1.5) * 1.2) : 0.35),
  }),
  pedra: Object.freeze({
    speed: (effectivePower) => (effectivePower >= 4.5 ? Math.min(6.5, (effectivePower - 4.0) * 0.95) : 0.35),
  }),
});

export function applyWindImpulse(targetObject, direction, effectivePower) {
  const profile = BlastProfile[targetObject.type];
  if (!profile) return false;

  targetObject.velocity.copy(direction).multiplyScalar(profile.speed(effectivePower));
  if (profile.lift) targetObject.velocity.y = profile.lift(effectivePower);
  return true;
}
