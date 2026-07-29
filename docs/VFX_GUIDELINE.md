# VFX Technical Art Guideline

This document serves as the Technical Art handbook for the **three.quarks** particle system integration in our project. It details the pipeline for creating, exporting, and integrating visual effects (VFX).

## 1. Creating and Exporting Effects

We use the [three.quarks-editor](https://quarks.art/) for creating particle effects.

### Exporting from three.quarks-editor:
1. Create or edit your particle system within the online editor.
2. Ensure you have properly set up all components, emitters, and textures.
3. Click on the **Export** button in the editor.
4. Save the generated `.json` file (e.g., `MyEffect.json`).
5. Place this `.json` file into the `public/vfx/` directory of the project.

**Note**: All textures used by the particle system should be placed in an appropriate public directory (like `public/textures/`) so they can be loaded at runtime. Make sure the paths in your `.json` file correctly reference these textures.

## 2. Registering Presets

After exporting the effect to `public/vfx/`, you must register it so the game can preload and use it.

### `ParticlePresetRegistry`
The `ParticlePresetRegistry` is responsible for loading and pooling particle effects. To register and load an effect, use the `VFXManager` (which delegates to the registry):

```javascript
// Example: Preloading an effect during game initialization
await vfxManager.loadPreset('MyEffect', 'vfx/MyEffect.json');
```
This loads the effect configuration and sets up an object pool to avoid stuttering during gameplay.

## 3. Using VFXManager in the Game

The `VFXManager` is the central hub for playing and releasing particle effects. It handles interaction with the `ParticlePresetRegistry` and the global `BatchRenderer` from `three.quarks`.

### Playing an Effect
To spawn an effect at a specific position, call `playEffect`:

```javascript
// Play 'MyEffect' at the given origin (THREE.Vector3)
const myEffectInstance = vfxManager.playEffect('MyEffect', originPosition);
scene.add(myEffectInstance);
```
*Note*: `playEffect` pulls an instance from the object pool (or clones a new one if the pool is empty) and automatically adds its particle emitters to the `BatchRenderer`.

### Releasing an Effect
Once an effect is finished or when cleaning up (e.g., during teardown), you must release it back to the pool to prevent memory leaks and improve performance:

```javascript
// Release the effect back to the pool
vfxManager.releaseEffect(myEffectInstance);
```
This stops the particle emitters, removes them from the `BatchRenderer`, and pushes the object back to the `ParticlePresetRegistry` pool.

## 4. Performance and Polish

### Settings Applied by VFXManager
- **Quality Scaling**: Based on the `VFXManager.quality` setting (`'low'`, `'medium'`, `'high'`), the emission rates are automatically scaled.
- **Accessibility**: If `reducedMotion` is enabled, the VFXManager will cap speeds and limit flashing parameters.
- **Soft Particles**: During preset loading, the registry automatically applies soft particle settings (`softParticles = true`) to prevent hard edges when particles intersect geometry.
- **Lighting Reactivity**: Emitters are modified to react to scene lights (`material.lights = true`).

By following these guidelines, we ensure all visual effects are performant, accessible, and easily manageable across the game lifecycle.
