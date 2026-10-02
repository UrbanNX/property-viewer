import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { loadModel, disposeModels } from './model.js';
import { sourceNodeIndex } from './universal.js';
import { plainFixture, unpackJson, packGlb } from './urbanwave-fixture.js';

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

test('real multiscene loader preserves source associations for both default indices without loading unreachable resources', async () => {
  const original = plainFixture(), json = unpackJson(original);
  json.nodes = [{ name: 'SceneA', mesh: 0, extras: { note: 'authored' } }, { name: 'SceneB', mesh: 1 }, { mesh: 2 }];
  json.scenes = [{ nodes: [0] }, { nodes: [1] }];
  json.meshes[0].primitives.push({ ...json.meshes[0].primitives[0] });
  // This unreferenced mesh must stay unrequested; eager node preloading changes
  // the neutral API and would fail on its external buffer.
  json.buffers.push({ uri: 'https://example.invalid/unreachable.bin', byteLength: 36 });
  json.bufferViews.push({ buffer: 1, byteLength: 36 });
  json.accessors.push({ bufferView: 3, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 1] });
  json.meshes[2] = { primitives: [{ attributes: { POSITION: 3 } }] };
  for (const reversed of [false, true]) for (const scene of [0, 1]) {
    json.scenes = reversed ? [{ nodes: [1] }, { nodes: [0] }] : [{ nodes: [0] }, { nodes: [1] }];
    json.scene = scene;
    const model = await loadModel(packGlb(json, original.subarray(28 + new DataView(original.buffer).getUint32(12, true))));
    try {
      assert.equal(model.scene, model.scenes[scene]);
      const resolved = model.scenes.map(root => {
        const indices = [];
        root.traverse(object => { if (object.isMesh) indices.push(sourceNodeIndex(object, model.parser.associations)); });
        return indices;
      });
      assert.deepEqual(resolved, reversed ? [[1], [0, 0]] : [[0, 0], [1]]);
      assert.deepEqual(model.scenes[reversed ? 1 : 0].children[0].userData, { name: 'SceneA', note: 'authored' });
      assert.equal([...model.parser.associations.values()].some(value => value.nodes === 2), false);
    } finally { disposeModels(model.scenes); }
  }
});

test('scene-shared nodes retain identities on r186 clones without leaking temporary metadata', async () => {
  const original = plainFixture(), json = unpackJson(original);
  json.nodes = [{ name: 'Shared', mesh: 0, extras: { note: 'keep me' } }];
  json.scenes = [{ nodes: [0] }, { nodes: [0] }]; json.scene = 0;
  json.meshes[0].primitives.push({ ...json.meshes[0].primitives[0] });
  const model = await loadModel(packGlb(json, original.subarray(28 + new DataView(original.buffer).getUint32(12, true))));
  try {
    // r180 reparents shared roots; r186 clones them. Preserve the loader's scene
    // behavior rather than fabricating new geometry in the neutral model API.
    const roots = model.scenes.flatMap(scene => scene.children);
    assert.equal(roots.length, Number(THREE.REVISION) >= 186 ? 2 : 1);
    for (const root of roots) {
      assert.deepEqual(root.userData, { name: 'Shared', note: 'keep me' });
      root.traverse(object => {
        assert.equal(sourceNodeIndex(object, model.parser.associations), 0);
        assert.equal(Object.keys(object.userData).some(key => key.startsWith('__propertyViewerSource_')), false);
        if (object.isMesh) assert.equal(model.parser.associations.get(object).meshes, 0);
      });
    }
  } finally { disposeModels(model.scenes); }
});
