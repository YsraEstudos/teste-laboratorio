const fs = require('fs');
let content = fs.readFileSync('src/world/TextureGenerator.js', 'utf8');

content = content.replace('export class TextureGenerator {', 'export class TextureGenerator {\n  static _cache = new Map();\n\n  static clearCache() {\n    this._cache.clear();\n  }\n');

content = content.replace('const texture = new THREE.CanvasTexture(canvas);', 'const texture = new THREE.CanvasTexture(canvas);\n    texture.generateMipmaps = true;\n    texture.minFilter = THREE.LinearMipmapLinearFilter;');

content = content.replace(/static (create[a-zA-Z0-9_]+Texture)\((.*?)\) \{\n([\s\S]*?)(^  \})/gm, (match, name, args, body, end) => {
    let newBody = body.replace(/return this\._texture/, 'const texture = this._texture');
    return `/**\n   * @returns {THREE.CanvasTexture}\n   */\n  static ${name}(${args}) {\n    if (this._cache.has('${name}')) return this._cache.get('${name}');\n${newBody}    this._cache.set('${name}', texture);\n    return texture;\n  }`;
});

fs.writeFileSync('src/world/TextureGenerator.js', content, 'utf8');
