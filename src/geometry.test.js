import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BufferGeometry, Float32BufferAttribute, Matrix4, Mesh, MeshStandardMaterial } from 'three';
import { previewMesh, sectionBounds } from './geometry.js';

test('preview clones preserve single-material drawing and exact world transforms', () => {
  const original = new Mesh(new BufferGeometry(), new MeshStandardMaterial());
  original.matrixWorld.makeShear(.2, .3, .4, .5, .6, .7).setPosition(2, 3, -9);
  const preview = previewMesh(original);
  preview.updateMatrixWorld(true);
  assert.equal(Array.isArray(preview.material), false);
  assert.notEqual(preview.material, original.material);
  assert.equal(preview.geometry, original.geometry);
  assert.deepEqual(preview.matrixWorld.elements, original.matrixWorld.elements);
  original.material = [original.material, new MeshStandardMaterial()];
  assert.equal(previewMesh(original).material.length, 2);
});

test('section bounds discard distant site triangles and retain cut-plane intersections', () => {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([
    -100, -2, -100, -90, -2, -100, -90, -2, -90,
    0, 0, 0, 4, 4, 0, 0, 4, 6,
  ], 3));
  // Indexed geometry and a nonidentity transform catch local/world confusion.
  geometry.setIndex([0, 1, 2, 3, 4, 5]);
  const matrix = new Matrix4().makeTranslation(3, 10, -7);
  const bounds = sectionBounds(geometry, matrix, 11, 12);
  assert.deepEqual(bounds.min.toArray(), [3, 11, -7]);
  assert.deepEqual(bounds.max.toArray(), [5, 12, -4]);
  assert.equal(sectionBounds(geometry, matrix, 15, 16).isEmpty(), true);
});

test('illustration materials are matte without modifying source or glass', () => {
  const opaque = new MeshStandardMaterial({ color: 0xa37441, roughness: .2, metalness: .8 });
  const glass = new MeshStandardMaterial({ transparent: true, opacity: .25, roughness: .1, metalness: .4 });
  const source = new Mesh(new BufferGeometry(), [opaque, glass]);
  const preview = previewMesh(source);
  assert.equal(preview.material[0].roughness, .85);
  assert.equal(preview.material[0].metalness, .15);
  assert.equal(preview.material[0].color.getHex(), 0xa37441);
  assert.equal(opaque.roughness, .2);
  assert.equal(opaque.metalness, .8);
  assert.equal(preview.material[1].opacity, .25);
  assert.equal(preview.material[1].roughness, .1);
  assert.equal(preview.material[1].metalness, .4);
  assert.equal(preview.material[0].clipShadows, true);
  assert.equal(preview.castShadow, true);
  assert.equal(preview.receiveShadow, true);
  assert.equal(previewMesh(new Mesh(source.geometry, glass)).castShadow, false);
});
