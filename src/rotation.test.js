import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PassiveRotation } from './rotation.js';

test('passive rotation stops until Exterior is explicitly selected again', () => {
  const controls = { update() {} };
  const rotation = new PassiveRotation(controls);
  rotation.select('exterior');
  rotation.update(0, false, false);
  assert.equal(controls.autoRotate, true);
  rotation.stop();
  rotation.update(1000, false, false);
  assert.equal(controls.autoRotate, false);
  for (const mode of ['floor', 'exploded']) {
    rotation.select(mode);
    rotation.update(2000, false, false);
    assert.equal(controls.autoRotate, false);
  }
  rotation.select('exterior');
  rotation.update(3000, false, false);
  assert.equal(controls.autoRotate, true);
  rotation.update(4000, true, false);
  assert.equal(controls.autoRotate, false);
  rotation.update(5000, false, false);
  assert.equal(controls.autoRotate, false);
});

test('rotation is time-based: a quarter turn takes 22.5 seconds at 30 or 120 fps', () => {
  for (const fps of [30, 120]) {
    const camera = new PerspectiveCamera();
    camera.position.set(0, 2, 10);
    const controls = new OrbitControls(camera);
    const rotation = new PassiveRotation(controls);
    rotation.select('exterior');
    for (let frame = 0; frame <= 22.5 * fps; frame++) rotation.update(frame * 1000 / fps, false, false);
    assert.ok(Math.abs(controls.getAzimuthalAngle() + Math.PI / 2) < 1e-6);
  }
});

test('backgrounding pauses motion without a catch-up jump on resume', () => {
  const deltas = [];
  const controls = { update(delta) { deltas.push(delta); } };
  const rotation = new PassiveRotation(controls);
  rotation.select('exterior');
  rotation.update(0, false, false);
  rotation.update(16, false, false);
  rotation.update(32, false, true);
  assert.equal(controls.autoRotate, false);
  rotation.update(120000, false, false);
  assert.deepEqual(deltas, [0, .016, 0, 0]);
  assert.equal(controls.autoRotate, true);
});
