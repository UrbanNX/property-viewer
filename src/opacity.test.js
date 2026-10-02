import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Mesh, MeshStandardMaterial, BoxGeometry, LineBasicMaterial } from 'three';
import { previewMesh } from './geometry.js';
import { captureOpacity, applyWallOpacity } from './opacity.js';

test('wall multiplier restores authored grouped material alpha/depth flags without mutating source; outlines and shadows follow opacity', () => {
  const original = new Mesh(new BoxGeometry(), [new MeshStandardMaterial({ opacity: .8 }), new MeshStandardMaterial({ opacity: .3, transparent: true, depthWrite: false })]);
  original.updateMatrixWorld();
  const mesh = previewMesh(original);
  const entry = { mesh, wall: true, authoredOpacity: captureOpacity(mesh), edge: { material: new LineBasicMaterial({ opacity: .55 }), visible: true } };
  for (const multiplier of [.5, 0, .2, 1]) {
    applyWallOpacity(entry, multiplier);
    assert.deepEqual(mesh.material.map(m => m.opacity), [.8 * multiplier, .3 * multiplier]);
    assert.deepEqual(mesh.material.map(m => m.transparent), multiplier === 1 ? [false, true] : [true, true]);
    assert.deepEqual(mesh.material.map(m => m.depthWrite), multiplier === 1 ? [true, false] : [false, false]);
    assert.equal(mesh.castShadow, multiplier === 1);
    assert.equal(mesh.receiveShadow, multiplier === 1);
    assert.equal(entry.edge.material.opacity, .55 * multiplier);
    assert.equal(entry.edge.visible, multiplier > 0);
  }
  assert.deepEqual(original.material.map(m => [m.opacity, m.transparent, m.depthWrite]), [[.8, false, true], [.3, true, false]]);
  entry.wall = false;
  applyWallOpacity(entry, 0);
  assert.equal(mesh.material[0].opacity, .8);
  assert.equal(mesh.castShadow, true);
  original.geometry.dispose();
  [...original.material, ...mesh.material, entry.edge.material].forEach(m => m.dispose());
});
