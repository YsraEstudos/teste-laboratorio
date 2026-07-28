/**
 * Heads-up Display (HUD) controller.
 */
export class HUD {
  /**
   * @param {Object} game The game instance.
   */
  constructor(game) {
    this.game = game;

    this.startScreen = document.getElementById('start-screen');
    this.pauseScreen = document.getElementById('pause-screen');
    this.btnStart = document.getElementById('btn-start');
    this.btnResume = document.getElementById('btn-resume');
    this.roomName = document.getElementById('room-name');
    this.controlsHint = document.getElementById('controls-hint');
    this.healthFill = document.getElementById('health-fill');
    this.healthVal = document.getElementById('health-val');

    this._hintTimer = 0;
    this._lastHealth = -1;
    this._lastEnergy = -1;
    this._lastHappiness = -1;
    this._lastRoom = '';
    this.destroyed = false;

    this._onStartClick = () => {
      if (!this.destroyed) this.game.start();
    };
    this._onResumeClick = () => {
      if (!this.destroyed) this.game.resume();
    };
    this._onInputLockChange = (locked) => {
      if (!this.destroyed) this.onLockChange(locked);
    };
    this._onInputEscape = () => {
      if (!this.destroyed) this.game.pause();
    };

    this.initEvents();
  }

  initEvents() {
    this.btnStart.addEventListener('click', this._onStartClick);
    this.btnResume.addEventListener('click', this._onResumeClick);
    this.game.input.onLockChange = this._onInputLockChange;
    this.game.input.onEscape = this._onInputEscape;
  }

  onLockChange(locked) {
    if (locked) {
      this.hideStart();
      this.hidePause();
    } else if (this.game.isPlaying) {
      this.showPause();
    }
  }

  showStart() {
    this.startScreen.classList.add('active');
  }

  hideStart() {
    this.startScreen.classList.remove('active');
  }

  showPause() {
    this.pauseScreen.classList.add('active');
  }

  hidePause() {
    this.pauseScreen.classList.remove('active');
  }

  /**
   * Updates HUD elements.
   */
  update() {
    const x = this.game.player.position.x;
    const z = this.game.player.position.z;
    const name = this.game.lab.getRoomNameAt(x, z) || '';
    if (this._lastRoom !== name) {
      this.roomName.textContent = name;
      this._lastRoom = name;
    }

    const health = this.game.player.health;
    if (this._lastHealth !== health) {
      this.healthFill.style.transform = `scaleX(${health / 100})`;
      this.healthVal.textContent = Math.round(health);
      this._lastHealth = health;
    }

    if (this.game.isPlaying) {
      this._hintTimer += 0.016;
      if (this._hintTimer > 6) {
        this.controlsHint.classList.add('hidden');
      }
    } else {
      this._hintTimer = 0;
      this.controlsHint.classList.remove('hidden');
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;

    this.btnStart?.removeEventListener('click', this._onStartClick);
    this.btnResume?.removeEventListener('click', this._onResumeClick);

    if (this.game?.input?.onLockChange === this._onInputLockChange) {
      this.game.input.onLockChange = null;
    }
    if (this.game?.input?.onEscape === this._onInputEscape) {
      this.game.input.onEscape = null;
    }
  }
}
