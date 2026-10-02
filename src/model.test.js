import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { loadModel, disposeModels } from './model.js';

function glb(json) {
  const text = JSON.stringify({ asset: { version: '2.0' }, ...json });
  const body = new TextEncoder().encode(text.padEnd(Math.ceil(text.length / 4) * 4));
  const bytes = new Uint8Array(20 + body.length);
  const header = new DataView(bytes.buffer);
  [0x46546c67, 2, bytes.length, body.length, 0x4e4f534a].forEach((v, i) => header.setUint32(i * 4, v, true));
  bytes.set(body, 20);
  return bytes;
}

test('preserves editable hierarchy and both metadata dialects in a byte-offset input', async () => {
  const project = { version: 1, name: 'Editable project' };
  const bytes = glb({
    scene: 0,
    scenes: [{ nodes: [0], extras: { urbanwaveProject: project } }],
    nodes: [
      { name: 'Ground', children: [1], translation: [2, 3, 4] },
      { name: 'Wall', extras: { cad_scene: { floor: 'Ground' }, type: 'wall' } },
    ],
  });
  const padded = new Uint8Array(bytes.length + 13);
  padded.set(bytes, 9);
  const model = await loadModel(padded.subarray(9, 9 + bytes.length));
  assert.deepEqual(model.scene.userData.urbanwaveProject, project);
  assert.equal(model.scene.children[0].children[0].name, 'Wall');
  assert.deepEqual(model.scene.children[0].position.toArray(), [2, 3, 4]);
  assert.deepEqual(model.scene.children[0].children[0].userData.cad_scene, { floor: 'Ground' });
  disposeModels(model.scenes);
});

test('rejects external buffers without fetching and rejects a malformed header', async () => {
  const original = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = () => {
    requests++;
    throw new Error('Unexpected network');
  };
  try {
    await assert.rejects(
      loadModel(
        glb({
          scene: 0,
          scenes: [{ nodes: [0] }],
          nodes: [{ mesh: 0 }],
          meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
          accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 1] }],
          bufferViews: [{ buffer: 0, byteLength: 36 }],
          buffers: [{ uri: 'https://example.test/private', byteLength: 36 }],
        }),
      ),
      /external files/,
    );
    assert.equal(requests, 0);
    const invalid = glb({});
    invalid[4] = 1;
    await assert.rejects(loadModel(invalid), /Invalid GLB/);
  } finally {
    globalThis.fetch = original;
  }
});

test('disposes shared geometry, materials, textures, skeletons and instances exactly once', () => {
  const geometry = new THREE.BoxGeometry();
  const texture = new THREE.Texture();
  const material = new THREE.MeshBasicMaterial({ map: texture });
  const skeleton = new THREE.Skeleton();
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.skeleton = skeleton;
  const instance = new THREE.InstancedMesh(geometry, material, 1);
  const root = new THREE.Group();
  root.add(mesh, instance, new THREE.Line(geometry, material));
  const counts = new Map();
  for (const resource of [geometry, texture, material, skeleton, instance]) {
    resource.dispose = () => counts.set(resource, (counts.get(resource) ?? 0) + 1);
  }
  disposeModels([root, root]);
  assert.equal(counts.size, 5);
  assert.ok([...counts.values()].every((count) => count === 1));
});
