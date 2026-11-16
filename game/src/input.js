// Fixed-step input mapping. Keyboard + pointer lock mouse look.
export class Input {
  constructor(canvas) {
    this.keys = {};
    this.mouseDX = 0; this.mouseDY = 0;
    this.fire = false; this.firePressed = false;
    this.locked = false;
    document.addEventListener('keydown', (e) => {
      // keyboard always works; pointer lock only gates mouse look and firing
      if (e.repeat) return;
      this.keys[e.code] = true;
      if (e.code === 'KeyR') this.reloadQueued = true;
      if (e.code === 'KeyG') this.grenadeQueued = true;
      if (e.code === 'KeyE') this.useQueued = true;
      if (e.code.startsWith('Digit')) this.buyQueued = e.code.slice(5);
      if (['KeyW','KeyA','KeyS','KeyD','Space'].includes(e.code)) e.preventDefault();
    });
    document.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    document.addEventListener('mousemove', (e) => {
      // look with or without pointer lock (fallback for environments that refuse the lock)
      this.mouseDX += e.movementX || 0; this.mouseDY += e.movementY || 0;
    });
    document.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.fire = true; this.firePressed = true; }
    });
    document.addEventListener('mouseup', (e) => { if (e.button === 0) this.fire = false; });
    canvas.addEventListener('click', () => {
      if (!this.locked) canvas.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
  }
  consumeMouse() {
    const r = [this.mouseDX, this.mouseDY];
    this.mouseDX = 0; this.mouseDY = 0;
    return r;
  }
  consumeAction(name) {
    const v = this[name + 'Queued'];
    this[name + 'Queued'] = false;
    return v;
  }
  axis() {
    const k = this.keys;
    let x = 0, z = 0;
    if (k['KeyW']) z -= 1;
    if (k['KeyS']) z += 1;
    if (k['KeyA']) x -= 1;
    if (k['KeyD']) x += 1;
    return [x, z];
  }
}
