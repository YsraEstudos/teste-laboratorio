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

/**
 * @typedef {Object} WindImpulse
 * @property {import('three').Vector3} origin
 * @property {import('three').Vector3} direction
 * @property {number} power
 * @property {number} radius
 * @property {'linear'|'quadratic'|'none'} falloff
 * @property {number} verticalLift
 * @property {number} duration
 * @property {string} source
 */

/**
 * Creates an immutable snapshot shared by blast physics and effects.
 *
 * @param {Object} options
 * @param {import('three').Vector3} options.origin
 * @param {import('three').Vector3} options.direction
 * @param {number} options.power
 * @param {number} options.radius
 * @param {'linear'|'quadratic'|'none'} options.falloff
 * @param {number} options.verticalLift
 * @param {number} options.duration
 * @param {string} options.source
 * @returns {Readonly<WindImpulse>}
 */
export function createWindImpulse({ origin, direction, power, radius, falloff, verticalLift, duration, source }) {
  const normalized = direction.clone().setY(0);
  if (normalized.lengthSq() > 0) normalized.normalize();

  return Object.freeze({
    origin: Object.freeze(origin.clone()),
    direction: Object.freeze(normalized),
    power,
    radius,
    falloff,
    verticalLift,
    duration,
    source,
  });
}

/**
 * @param {Readonly<WindImpulse>} impulse
 * @param {number} distance
 * @returns {number}
 */
export function getWindImpulseStrength(impulse, distance) {
  if (distance < 0 || distance > impulse.radius || impulse.power <= 0 || impulse.radius <= 0) return 0;
  if (impulse.falloff === 'none') return impulse.power;

  const linear = Math.max(0, 1 - distance / impulse.radius);
  const attenuation = impulse.falloff === 'quadratic' ? linear * linear : linear;
  return impulse.power * attenuation;
}

/**
 * Applies one immutable impulse event. Existing laboratory object types keep
 * their validated response profile; generic objects receive the shared vector
 * directly.
 *
 * @param {Record<string, any>} targetObject
 * @param {Readonly<WindImpulse>} impulse
 * @param {number} [distance]
 * @returns {boolean}
 */
export function applyWindImpulseToObject(targetObject, impulse, distance) {
  const position = targetObject.position ?? targetObject.mesh?.position;
  const resolvedDistance = distance ?? position?.distanceTo?.(impulse.origin) ?? Infinity;
  const strength = getWindImpulseStrength(impulse, resolvedDistance);
  if (strength <= 0 || !targetObject.velocity) return false;

  const profiled = applyWindImpulse(targetObject, impulse.direction, strength);
  if (!profiled) targetObject.velocity.copy(impulse.direction).multiplyScalar(strength);

  const attenuation = impulse.power > 0 ? strength / impulse.power : 0;
  targetObject.velocity.y += impulse.verticalLift * attenuation;
  return true;
}

export function applyWindImpulse(targetObject, direction, effectivePower) {
  const profile = BlastProfile[targetObject.type];
  if (!profile) return false;

  targetObject.velocity.copy(direction).multiplyScalar(profile.speed(effectivePower));
  if (profile.lift) targetObject.velocity.y = profile.lift(effectivePower);
  return true;
}
