const PROFILES = Object.create(null);
PROFILES.low = Object.freeze({ segments: 32, mapResolution: 128, deformationResolution: 128, anisotropy: 1, sparkles: false, receiveShadow: false, footstepVfx: false, gpuParticles: false, maxContactEmitters: 0 });
PROFILES.medium = Object.freeze({ segments: 48, mapResolution: 256, deformationResolution: 192, anisotropy: 2, sparkles: false, receiveShadow: false, footstepVfx: true, gpuParticles: false, maxContactEmitters: 2 });
PROFILES.high = Object.freeze({ segments: 64, mapResolution: 256, deformationResolution: 256, anisotropy: 2, sparkles: true, receiveShadow: true, footstepVfx: true, gpuParticles: false, maxContactEmitters: 4 });

export function getSandQuality(name = 'high') {
  return PROFILES[name] || PROFILES.high;
}
