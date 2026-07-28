const fs = require('fs');
let content = fs.readFileSync('src/world/LaboratoryBuilder.js', 'utf8');

content = content.replace('constructor(scene) {', 'constructor(scene) {\n    this.unitBoxGeo = new THREE.BoxGeometry(1, 1, 1);');

content = content.replace(
    '  _addBox(width, height, depth, x, y, z, material, collider = true, rotationY = 0) {\n    const geometry = new THREE.BoxGeometry(width, height, depth);\n    const mesh = new THREE.Mesh(geometry, material);',
    '  /**\n   * @param {number} width\n   * @param {number} height\n   * @param {number} depth\n   * @param {number} x\n   * @param {number} y\n   * @param {number} z\n   * @param {THREE.Material} material\n   * @param {boolean} collider\n   * @param {number} rotationY\n   * @returns {THREE.Mesh}\n   */\n  _addBox(width, height, depth, x, y, z, material, collider = true, rotationY = 0) {\n    const mesh = new THREE.Mesh(this.unitBoxGeo, material);\n    mesh.scale.set(width, height, depth);'
);

content = content.replace(
    '  getRoomNameAt(x, z) {',
    '  /**\n   * @param {number} x\n   * @param {number} z\n   * @returns {string}\n   */\n  getRoomNameAt(x, z) {'
);

content = content.replace(
    '  getTestObjects() {',
    '  /**\n   * @returns {THREE.Mesh[]}\n   */\n  getTestObjects() {'
);

content = content.replace(
    '  update(delta, playerPosition) {',
    '  /**\n   * @param {number} delta\n   * @param {THREE.Vector3} playerPosition\n   */\n  update(delta, playerPosition) {'
);

content += `\n  dispose() {
    for (const child of [...this.scene.children]) {
      if (child.isMesh && (child.geometry === this.unitBoxGeo || this.colliders.some(c => c.containsPoint(child.position)))) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    }
    this.unitBoxGeo.dispose();
    this.testObjects = [];
  }
}
`;

content = content.replace(/}\n\n  dispose\(\)/, '\n  dispose()');

fs.writeFileSync('src/world/LaboratoryBuilder.js', content, 'utf8');
