import * as THREE from 'three';

const SEGMENTS_PER_STREAK = 3;

/** Fine, fast air traces that become prominent while a gust crosses a room. */
export class WindStreakSystem {
  constructor(scene, windField, options = {}) {
    this.windField = windField;
    this.count = options.count ?? 150;
    this.streaks = [];
    this._wind = new THREE.Vector3();
    this._cursor = new THREE.Vector3();
    this._build(scene);
  }

  _build(scene) {
    const pointsPerStreak = SEGMENTS_PER_STREAK * 2;
    this.positions = new Float32Array(this.count * pointsPerStreak * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setDrawRange(0, this.count * pointsPerStreak);
    const material = new THREE.LineBasicMaterial({
      color: 0xd9f6ff,
      transparent: true,
      opacity: 0.44,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.lines = new THREE.LineSegments(geometry, material);
    this.lines.frustumCulled = false;
    this.lines.name = 'AmbientWindStreaks';
    scene.add(this.lines);

    for (let i = 0; i < this.count; i++) {
      this.streaks.push({
        position: new THREE.Vector3(),
        age: 0,
        maxAge: 0.35 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
        active: false
      });
    }
  }

  update(delta, camera) {
    const gust = this.windField.gustIntensity;
    this.lines.material.opacity = 0.035 + gust * 0.48;
    const cameraPosition = camera.position;

    for (let i = 0; i < this.count; i++) {
      const streak = this.streaks[i];
      if (!streak.active) this._reset(streak, cameraPosition);
      streak.age += delta;
      if (streak.age >= streak.maxAge || streak.position.distanceToSquared(cameraPosition) > 31 * 31) {
        this._reset(streak, cameraPosition);
      }

      this.windField.sample(streak.position, this._wind);
      const speed = this._wind.length();
      if (speed > 0.001) streak.position.addScaledVector(this._wind, delta * (1.2 + gust * 0.8));

      const length = (0.5 + gust * 1.8) * (0.75 + Math.sin(streak.phase + streak.age * 5) * 0.15);
      this._cursor.copy(streak.position);
      let base = i * SEGMENTS_PER_STREAK * 6;
      for (let segment = 0; segment < SEGMENTS_PER_STREAK; segment++) {
        this.windField.sample(this._cursor, this._wind);
        const localSpeed = Math.max(this._wind.length(), 0.1);
        this.positions[base++] = this._cursor.x;
        this.positions[base++] = this._cursor.y;
        this.positions[base++] = this._cursor.z;
        this._cursor.addScaledVector(this._wind, -length / SEGMENTS_PER_STREAK / localSpeed);
        this.positions[base++] = this._cursor.x;
        this.positions[base++] = this._cursor.y;
        this.positions[base++] = this._cursor.z;
      }
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
  }

  _reset(streak, center) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 3 + Math.sqrt(Math.random()) * 19;
    streak.position.set(
      center.x + Math.cos(angle) * radius,
      0.35 + Math.random() * 3.5,
      center.z + Math.sin(angle) * radius
    );
    streak.age = 0;
    streak.maxAge = 0.32 + Math.random() * 0.65;
    streak.phase = Math.random() * Math.PI * 2;
    streak.active = true;
  }

  dispose() {
    this.lines.parent?.remove(this.lines);
    this.lines.geometry.dispose();
    this.lines.material.dispose();
  }
}
