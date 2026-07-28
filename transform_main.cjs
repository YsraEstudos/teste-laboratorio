const fs = require('fs');
let content = fs.readFileSync('src/main.js', 'utf8');

content = content.replace('class Game {', `class Game {
  static CONSTANTS = {
    WIND_BLAST_RANGE_SQ: 18.0 ** 2,
    WIND_CHARGE_DELAY_MS: 700,
    PAPER_LEAF_MIN_POWER: 0.0,
    CARDBOARD_MIN_POWER: 1.7,
    ROCK_MIN_POWER: 4.5,
    CARDBOARD_MAX_SPEED: 12.5,
    ROCK_MAX_SPEED: 6.5,
  };`);

// Replace magic numbers
content = content.replace('minDist > 18', 'minDist > Math.sqrt(Game.CONSTANTS.WIND_BLAST_RANGE_SQ)');
content = content.replace('}, 700);', '}, Game.CONSTANTS.WIND_CHARGE_DELAY_MS);');
content = content.replace('effectivePower >= 1.7', 'effectivePower >= Game.CONSTANTS.CARDBOARD_MIN_POWER');
content = content.replace('Math.min(12.5,', 'Math.min(Game.CONSTANTS.CARDBOARD_MAX_SPEED,');
content = content.replace('effectivePower >= 4.5', 'effectivePower >= Game.CONSTANTS.ROCK_MIN_POWER');
content = content.replace('Math.min(6.5,', 'Math.min(Game.CONSTANTS.ROCK_MAX_SPEED,');

// JSDoc
content = content.replace('  triggerWindBlastOnObjects() {', '  /**\n   * Triggers wind blast\n   */\n  triggerWindBlastOnObjects() {');
content = content.replace('  _loop() {', '  /**\n   * Main loop\n   */\n  _loop() {');
content = content.replace('  start() {', '  /**\n   * Starts game\n   */\n  start() {'); // _init alternative

// requestAnimationFrame
content = content.replace('requestAnimationFrame(this._loop);', 'this.animationId = requestAnimationFrame(this._loop);');
content = content.replace('requestAnimationFrame(this._loop);', 'this.animationId = requestAnimationFrame(this._loop);');

// remove resize bind
content = content.replace('window.addEventListener(\'resize\', () => this.renderer.onWindowResize());', 'this._onResize = () => this.renderer.onWindowResize();\n    window.addEventListener(\'resize\', this._onResize);');
content = content.replace('this._onPointerDown = (event) => {', 'this._onPointerDown = (event) => {');

// We have: canvas.addEventListener('pointerdown', (event) => {
content = content.replace(
  "canvas.addEventListener('pointerdown', (event) => {", 
  "this._onPointerDown = (event) => {\n      if (this.isPlaying && event.button === 0) {\n        this.player.handlePointerDown(event);\n      }\n    };\n    canvas.addEventListener('pointerdown', this._onPointerDown);"
);

content = content.replace(
  "canvas.addEventListener('contextmenu', (event) => {",
  "this._onContextMenu = (event) => {\n      event.preventDefault();\n      if (!this.isPlaying) return;\n      this.radialMenu.show(event.clientX, event.clientY);\n    };\n    canvas.addEventListener('contextmenu', this._onContextMenu);"
);

// destroy
content = content.replace(/}\s*$/, `
  destroy() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    window.removeEventListener('resize', this._onResize);
    const canvas = document.getElementById('game-canvas');
    if (canvas) {
      if (this._onPointerDown) canvas.removeEventListener('pointerdown', this._onPointerDown);
      if (this._onContextMenu) canvas.removeEventListener('contextmenu', this._onContextMenu);
    }
  }
}
`);

fs.writeFileSync('src/main.js', content, 'utf8');
