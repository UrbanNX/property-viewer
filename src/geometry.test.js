import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Box3, BufferGeometry, Float32BufferAttribute, Matrix4, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { frameBounds, previewMesh, sectionBounds } from './geometry.js';

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

test('camera framing fits asymmetric bounds and responds to portrait aspect without mutating inputs', () => {
  const box = new Box3(new Vector3(-7, -1, -2), new Vector3(3, 8, 19));
  const direction = new Vector3(.4, .8, 1.7);
  const originalDirection = direction.clone();
  const landscape = frameBounds(box, { direction, aspect: 16 / 9, fov: 38 });
  const portrait = frameBounds(box, { direction, aspect: 9 / 16, fov: 38 });
  assert.deepEqual(direction.toArray(), originalDirection.toArray());
  assert.deepEqual(landscape.target.toArray(), [-2, 3.5, 8.5]);
  assert.ok(portrait.distance > landscape.distance);
  assert.ok(Math.abs(landscape.position.distanceTo(landscape.target) - landscape.distance) < 1e-12);
  assert.equal(landscape.near, landscape.distance / 1000);
  assert.equal(landscape.far, landscape.distance * 100);
  const authoredTarget = new Vector3(0, 2, 4);
  const authored = frameBounds(box, { direction, target: authoredTarget, aspect: 1 });
  assert.notEqual(authored.target, authoredTarget);
  assert.deepEqual(authored.target.toArray(), authoredTarget.toArray());
  assert.equal(frameBounds(new Box3(), { aspect: 1 }), null);
});
