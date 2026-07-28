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

    this.initEvents();
  }

  initEvents() {
    this.btnStart.addEventListener('click', () => {
      this.game.start();
    });

    this.btnResume.addEventListener('click', () => {
      this.game.resume();
    });

    this.game.input.onLockChange = (locked) => {
      this.onLockChange(locked);
    };
    this.game.input.onEscape = () => {
      this.game.pause();
    };
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
}
