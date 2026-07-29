import * as THREE from 'three';
import { WindField } from './WindField.js';
import { WindDustSystem } from './WindDustSystem.js';
import { WindStreakSystem } from './WindStreakSystem.js';
import { WindAudio } from './WindAudio.js';
import { applyWindImpulseToObject } from './WindImpulse.js';

/** Coordinates ambient airflow, visual effects, procedural audio, and forces. */
export class WindSystem {
  constructor(scene, camera, laboratory) {
    this.field = new WindField(laboratory.rooms);
    this.dust = new WindDustSystem(scene, laboratory.colliders, this.field);
    this.streaks = new WindStreakSystem(scene, this.field);
    this.audio = new WindAudio();
    this.camera = camera;
    this._playerWind = new THREE.Vector3();
    this._objectWind = new THREE.Vector3();
    this.disposed = false;
  }

  startAudio() {
    this.audio.start();
  }

  update(delta) {
    this.field.update(delta);
    this.dust.update(delta, this.camera);
    this.streaks.update(delta, this.camera);
    this.audio.update(delta, this.field.intensity, this.field.gustIntensity);
  }

  samplePlayerForce(position, out) {
    this.field.sample(position, this._playerWind);
    // The player feels only sustained gust pressure, never a disruptive constant push.
    const multiplier = 0.035 + this.field.gustIntensity * 0.18;
    out.set(this._playerWind.x * multiplier, 0, this._playerWind.z * multiplier);
    return out;
  }

  applyToObjects(objects, delta) {
    for (const obj of objects) {
      this.field.sample(obj.mesh.position, this._objectWind);
      const speed = this._objectWind.length();
      const gust = this.field.gustIntensity;

      if (obj.type === 'folha_papel' || obj.type === 'folha_arvore') {
        const response = obj.type === 'folha_arvore' ? 2.7 : 2.15;
        obj.velocity.x += this._objectWind.x * delta * response;
        obj.velocity.z += this._objectWind.z * delta * response;
        if (speed > 1.05) {
          obj.velocity.y += delta * (speed - 0.85) * (0.75 + gust * 1.25);
          obj.velocity.y += Math.sin(this.field.time * 9 + obj.mesh.position.x * 2.4) * delta * 0.55;
        }
      } else if (obj.type === 'papelao') {
        if (speed > 2.05) {
          obj.velocity.x += this._objectWind.x * delta * 0.48;
          obj.velocity.z += this._objectWind.z * delta * 0.48;
        }
      } else if (obj.type === 'pedra' && gust > 0.8) {
        // Heavy objects only answer to peak gusts, as a subtle physical vibration.
        obj.velocity.x += this._objectWind.x * delta * 0.025;
        obj.velocity.z += this._objectWind.z * delta * 0.025;
      }
    }
  }

  /**
   * @param {import('./WindImpulse.js').WindImpulse} impulse
   * @param {Array<Record<string, any>>} objects
   * @returns {number}
   */
  applyImpulse(impulse, objects) {
    let applied = 0;
    for (const object of objects) {
      if (applyWindImpulseToObject(object, impulse)) applied += 1;
    }
    return applied;
  }

  suspendAudio() {
    this.audio.suspend();
  }

  resumeAudio() {
    this.audio.resume();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.dust.dispose();
    this.streaks.dispose();
    this.audio.dispose();
  }
}
