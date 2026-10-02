import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAnnotations, resolveAnnotations, resolveSourceNode, resolveObjectBinding, sourceNodeIndex, classifyType } from './universal.js';
import { meshBinding } from './rendering.js';
import { loadModel, disposeModels } from './model.js';
import { fixtureProject, plainFixture, annotatedFixture, packGlb, unpackJson } from './urbanwave-fixture.js';
import { sampleGlb } from '../examples/browser/sample.js';

test('embedded universal annotations validate fingerprint, Y-up rooms and reject malformed metadata', async () => {
  const bytes = await annotatedFixture();
  const data = await resolveAnnotations(bytes, unpackJson(bytes));
  assert.equal(data.profile, 'urbanwaveProject');
  assert.deepEqual(data.rooms[0].position, [1.3, .25, -2.7]);
  assert.equal(resolveSourceNode(data, 2).wall, true);
  const json = unpackJson(bytes);
  json.nodes[2].translation[0]++;
  await assert.rejects(resolveAnnotations(packGlb(json), json), /different model/);
  json.scenes[1].extras.urbanwaveProject = { format: 'bad' };
  await assert.rejects(resolveAnnotations(packGlb(json), json));
  assert.equal(await resolveAnnotations(plainFixture(), unpackJson(plainFixture())), null);
});

test('independent nearest-field inheritance, mutable editor state, unknown binding and exact exclusions', () => {
  const project = fixtureProject();
  project.meta = { Parent: { floor: 'Lower', type: 'wall', material: 'brick' }, Child: { floor: 'Upper' }, Door: { type: 'door' } };
  const json = { nodes: [{ name: 'Parent', children: [1, 2] }, { name: 'Child' }, { name: 'Door' }] };
  const data = createAnnotations(json, project);
  assert.deepEqual(resolveSourceNode(data, 1), { nodeIndex: 1, sourceName: 'Child', meta: { floor: 'Upper', type: 'wall', material: 'brick' }, bindings: [{ floor: 'Upper', category: 'Walls' }], floors: ['Upper'], wall: true, sectioned: true });
  assert.equal(resolveSourceNode(data, 2).wall, false);
  assert.deepEqual(resolveSourceNode(data, 2).floors, ['Lower']);
  project.meta.Child.type = 'boundary wall';
  assert.equal(resolveSourceNode(data, 1).wall, false);
  project.meta.Child.type = '';
  assert.equal(resolveSourceNode(data, 1).wall, false, 'empty semantic value masks inherited wall');
  assert.deepEqual(resolveSourceNode(data, null), { nodeIndex: null, sourceName: null, meta: {}, bindings: [], floors: [], wall: false, sectioned: false });
  for (const type of ['boundary_wall', 'boundary wall', 'wall/window', 'walls_and_doors', 'facade mixed', 'mixed', 'door', 'window', 'curtainwall', undefined]) assert.equal(classifyType(type).wall, false, type);
  for (const type of ['wall', ' Walls ', 'FACADE']) assert.equal(classifyType(type).wall, true);
});

test('rejects ambiguous source identities and cycles; preserves valid unbound editor annotations', () => {
  const project = fixtureProject(); project.meta = { Same: { type: 'wall' } };
  assert.throws(() => createAnnotations({ nodes: [{ name: 'Same' }, { name: 'Same' }] }, project), /Duplicate/);
  assert.deepEqual(resolveSourceNode(createAnnotations({ nodes: [] }, project), 0).floors, []);
  project.meta.Same.floor = 'Showroom';
  project.project.storeys = {};
  project.meta.GeneratedWall = { type: 'wall' };
  const binding = resolveSourceNode(createAnnotations({ nodes: [{ name: 'Same' }] }, project), 0);
  assert.deepEqual(binding.meta, { type: 'wall', floor: 'Showroom' });
  assert.deepEqual(binding.floors, []);
  assert.throws(() => createAnnotations({ nodes: [{ children: [1] }, { children: [0] }] }, project), /Cyclic/);
});

test('source-only extras preserve duplicate and loader-unsafe names by index; project fields override extras', () => {
  const json = { nodes: [{ name: 'Floor [A]', extras: { type: 'wall', floor: 'Lower' }, children: [1, 2] }, { name: 'Repeated', extras: { type: 'window' } }, { name: 'Repeated', extras: { type: 'boundary_wall' } }] };
  const data = createAnnotations(json, null);
  assert.equal(data.profile, 'source');
  assert.deepEqual(resolveSourceNode(data, 1).meta, { type: 'window', floor: 'Lower' });
  assert.equal(resolveSourceNode(data, 2).wall, false);
  assert.equal(resolveSourceNode(data, 0).sourceName, 'Floor [A]');
  const project = fixtureProject(); project.meta = { 'Floor [A]': { type: 'mixed', floor: 'Upper' } };
  const edited = createAnnotations(json, project);
  assert.deepEqual(resolveSourceNode(edited, 0).meta, { type: 'mixed', floor: 'Upper' });
  assert.deepEqual(resolveSourceNode(edited, 1).floors, ['Upper']);
  assert.equal(resolveSourceNode(edited, 1).meta.type, 'window');
});

test('real GLTFLoader multi-primitive runtime names cannot steal another source node annotation', async () => {
  const bytes = plainFixture(), json = unpackJson(bytes);
  const binaryStart = 28 + new DataView(bytes.buffer).getUint32(12, true);
  json.nodes = [{ name: 'Parent', children: [1, 2, 3] }, { name: 'Shell', mesh: 0 }, { name: 'mesh_0', mesh: 1 }, { name: 'mesh_0_1' }];
  json.scenes = [{ nodes: [0] }]; json.scene = 0;
  json.meshes[0].primitives.push({ ...json.meshes[0].primitives[0] });
  const project = fixtureProject();
  project.meta = { Parent: { floor: 'Lower', type: 'wall' }, Shell: { type: 'window' }, mesh_0: { floor: 'Upper', type: 'facade' }, mesh_0_1: { type: 'wall' } };
  const data = createAnnotations(json, project);
  const gltf = await loadModel(packGlb(json, bytes.subarray(binaryStart)));
  try {
    const rows = [];
    gltf.scene.traverse(object => {
      if (object.isMesh) {
        const binding = resolveObjectBinding(data, object, gltf.parser.associations);
        assert.deepEqual(binding, resolveSourceNode(data, sourceNodeIndex(object, gltf.parser.associations)));
        rows.push({ runtimeName: object.name, ...binding });
      }
    });
    assert.equal(rows.length, 3);
    assert.equal(rows[0].runtimeName, 'mesh_0_1', 'actual generated primitive name collides with an original glTF node name');
    assert.deepEqual(rows.map(row => [row.nodeIndex, row.sourceName, row.wall, row.floors]), [[1, 'Shell', false, ['Lower']], [1, 'Shell', false, ['Lower']], [2, 'mesh_0', true, ['Upper']]]);
    gltf.scene.traverse(object => { object.name = 'deliberate runtime collision'; });
    const bindings = [];
    gltf.scene.traverse(object => { if (object.isMesh) bindings.push(resolveSourceNode(data, sourceNodeIndex(object, gltf.parser.associations)).wall); });
    assert.deepEqual(bindings, [false, false, true]);
  } finally { disposeModels(gltf.scenes); }
});

test('CAD rendered-object adapter preserves actual mesh extras and ordered targets instead of simulating loader ancestry', async () => {
  const plain = plainFixture(), json = unpackJson(plain);
  json.extras = unpackJson(sampleGlb()).extras;
  const components = json.extras.cad_scene.scene.components;
  const ground = components.find(c => c.category === 'Walls' && c.floor === 'Ground');
  const first = components.find(c => c.category === 'Walls' && c.floor === 'First');
  const door = { id: 'test-door', floor: 'First', category: 'Doors' };
  components.push(door);
  const targets = [{ kind: 'component', id: ground.id }, { kind: 'component', id: door.id }, { kind: 'component', id: ground.id }];
  json.nodes = [
    { name: 'Parent', children: [1, 2], extras: { cad_scene: { component_id: first.id } } },
    { name: 'Multi', mesh: 0, extras: { cad_scene: { component_id: door.id } } },
    { name: 'Single', mesh: 1, extras: { cad_scene: { component_id: door.id } } },
  ];
  json.scenes = [{ nodes: [0] }]; json.scene = 0;
  json.meshes[0].primitives.push({ ...json.meshes[0].primitives[0] });
  json.meshes[0].extras = { cad_scene: { targets } };
  json.meshes[1].extras = { cad_scene: { component_id: ground.id } };
  const bytes = packGlb(json, plain.subarray(28 + new DataView(plain.buffer).getUint32(12, true)));
  const data = await resolveAnnotations(bytes, json), gltf = await loadModel(bytes);
  try {
    const objects = []; gltf.scene.traverse(object => { if (object.isMesh) objects.push(object); });
    assert.equal(objects.length, 3);
    for (const object of objects) {
      const { nodeIndex, sourceName, meta, ...binding } = resolveObjectBinding(data, object, gltf.parser.associations);
      assert.deepEqual(binding, meshBinding(object, data));
    }
    const multi = resolveObjectBinding(data, objects[0], gltf.parser.associations);
    assert.deepEqual(multi.bindings, [{ floor: 'Ground', category: 'Walls' }, { floor: 'First', category: 'Doors' }, { floor: 'Ground', category: 'Walls' }]);
    assert.deepEqual(multi.meta, { type: 'mixed' });
    assert.equal(multi.wall, false);
    assert.deepEqual(resolveSourceNode(data, 1).meta, { floor: 'First', type: 'door' }, 'source-node API deliberately excludes mesh extras');
    assert.deepEqual(resolveObjectBinding(data, objects[2], gltf.parser.associations).meta, { floor: 'First', type: 'door' }, 'single-primitive node extras override mesh extras');

    const project = fixtureProject();
    project.project.storeys = { Ground: { level: 0 }, First: { level: 3.2 } };
    project.meta = { Multi: multi.meta, Single: { floor: 'First', type: 'door' } };
    const inferred = createAnnotations(json, project);
    assert.equal(resolveSourceNode(inferred, 1).wall, false, 'editor inference must not reclassify mixed CAD targets as walls');
    assert.equal(resolveSourceNode(inferred, 2).wall, false);

    objects[0].userData.cad_scene.targets = [{ kind: 'component', id: ground.id }, { kind: 'component', id: 'missing' }];
    assert.deepEqual(resolveObjectBinding(data, objects[0], gltf.parser.associations).meta, { floor: 'Ground', type: 'mixed' });
    objects[0].userData.cad_scene.targets = [{ kind: 'component', id: ground.id }];
    assert.deepEqual(resolveObjectBinding(data, objects[0], gltf.parser.associations).meta, { floor: 'Ground', type: 'wall' });
  } finally { disposeModels(gltf.scenes); }
});
