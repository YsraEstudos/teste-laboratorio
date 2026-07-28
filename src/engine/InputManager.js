export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.isLocked = false;
    this.sensitivity = 0.0022;

    this.keys = {
      forward: false,
      back: false,
      left: false,
      right: false,
      sprint: false,
      crouch: false,
      jump: false
    };

    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;

    this.onLockChange = null;
    this.onWheel = null;
    this.onEscape = null;

    this._target = new EventTarget();
    this._boundKeyDown = this._onKeyDown.bind(this);
    this._boundKeyUp = this._onKeyUp.bind(this);
    this._boundMouseMove = this._onMouseMove.bind(this);
    this._boundPointerLockChange = this._onPointerLockChange.bind(this);
    this._boundPointerLockError = this._onPointerLockError.bind(this);
    this._boundWheel = this._onWheel.bind(this);

    document.addEventListener('keydown', this._boundKeyDown);
    document.addEventListener('keyup', this._boundKeyUp);
    document.addEventListener('mousemove', this._boundMouseMove);
    document.addEventListener('pointerlockchange', this._boundPointerLockChange);
    document.addEventListener('pointerlockerror', this._boundPointerLockError);
    this.canvas.addEventListener('wheel', this._boundWheel, { passive: false });
  }

  lock() {
    this.canvas.requestPointerLock();
  }

  resetMouseDelta() {
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
  }

  _onKeyDown(e) {
    if (e.code === 'Escape') {
      if (this.onEscape) this.onEscape();
      return;
    }
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.back = true;
        break;
      case 'KeyA':
        this.keys.left = true;
        break;
      case 'KeyD':
        this.keys.right = true;
        break;
      case 'ShiftLeft':
        this.keys.sprint = true;
        break;
      case 'ControlLeft':
      case 'KeyC':
        this.keys.crouch = true;
        break;
      case 'Space':
        this.keys.jump = true;
        break;
    }
  }

  _onKeyUp(e) {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.back = false;
        break;
      case 'KeyA':
        this.keys.left = false;
        break;
      case 'KeyD':
        this.keys.right = false;
        break;
      case 'ShiftLeft':
        this.keys.sprint = false;
        break;
      case 'ControlLeft':
      case 'KeyC':
        this.keys.crouch = false;
        break;
      case 'Space':
        this.keys.jump = false;
        break;
    }
  }

  _onMouseMove(e) {
    if (document.pointerLockElement === this.canvas) {
      this.mouseDeltaX += e.movementX;
      this.mouseDeltaY += e.movementY;
    }
  }

  _onPointerLockChange() {
    this.isLocked = document.pointerLockElement === this.canvas;
    if (this.onLockChange) {
      this.onLockChange(this.isLocked);
    }
    this._target.dispatchEvent(new CustomEvent('lockchange', { detail: { locked: this.isLocked } }));
  }

  _onPointerLockError() {
  }

  _onWheel(e) {
    if (this.onWheel) {
      e.preventDefault();
      this.onWheel(e);
    }
  }

  dispose() {
    document.removeEventListener('keydown', this._boundKeyDown);
    document.removeEventListener('keyup', this._boundKeyUp);
    document.removeEventListener('mousemove', this._boundMouseMove);
    document.removeEventListener('pointerlockchange', this._boundPointerLockChange);
    document.removeEventListener('pointerlockerror', this._boundPointerLockError);
    this.canvas.removeEventListener('wheel', this._boundWheel);
  }
}
