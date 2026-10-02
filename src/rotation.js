// Keep passive motion separate from touch-driven OrbitControls inertia.
export class PassiveRotation {
  constructor(controls) {
    this.controls = controls;
    this.armed = false;
    this.previousTime = null;
    controls.autoRotateSpeed = 60 / 90; // OrbitControls speed 1 = one turn/minute.
  }

  select(mode) {
    this.armed = mode === 'exterior';
  }

  stop() {
    this.armed = false;
    this.controls.autoRotate = false;
  }

  update(time, reducedMotion, hidden) {
    if (reducedMotion) this.stop();
    const delta = this.previousTime === null ? 0 : Math.min((time - this.previousTime) / 1000, .1);
    this.previousTime = hidden ? null : time;
    this.controls.autoRotate = this.armed && !hidden;
    this.controls.update(hidden ? 0 : delta);
  }
}
