import { test } from 'node:test';
import assert from 'node:assert/strict';
import { annotations, meshBinding, floorBand, previewSection, worldPoint } from './annotations.js';

const fixture = () => ({ extras: { cad_scene: { version: 1, scene: {
  units: 'm', up_axis: 'Z',
  components: [
    { id: 'ground-wall', floor: 'Ground', category: 'Walls', geometry: { type: 'extrusion', z: [.15, 3] } },
    { id: 'first-wall', floor: 'First Floor', category: 'Walls', geometry: { type: 'extrusion', z: [3.15, 6] } },
    { id: 'site', floor: 'Site', category: 'Site' },
  ],
  building: {
    levels: [{ name: 'First Floor', elevation: 3.15 }, { name: 'Site', elevation: -1 }, { name: 'Ground', elevation: .15 }],
    plan_view: { cut_height: 1.15 }, windows: [{ id: 'w1', wall: 'first-wall' }],
    rooms: [{ name: 'Kitchen', floor: 'Ground', position: [2, 5, .21] }],
    views: [{ id: 'ground', label: 'Ground oblique', floor: 'Ground', position: [1, -7, 30], target: [3, 8, .15] }],
  },
} } } });
test('optional/versioned metadata and malformed collections fall back safely', () => {
  assert.equal(annotations({}), null);
  const json = fixture(); json.extras.cad_scene.version = 2;
  assert.equal(annotations(json), null);
  json.extras.cad_scene.version = 1;
  json.extras.cad_scene.scene.building.views = 'bad';
  assert.equal(annotations(json), null);
});
test('preserves supplied names, cut height, room labels and valid cameras; rejects invalid preset', () => {
  const json = fixture();
  json.extras.cad_scene.scene.building.views.push({ id: 'broken', label: 'Broken', floor: 'Missing', position: [1, 2, 3], target: [4, 5, 6] });
  const data = annotations(json);
  assert.deepEqual([...data.levels.keys()], ['First Floor', 'Site', 'Ground']);
  assert.equal(data.cutHeight, 1.15);
  assert.equal(data.rooms[0].name, 'Kitchen');
  assert.deepEqual(data.views.map(v => v.id), ['ground']);
  assert.deepEqual(worldPoint([2, 5, .21]), [2, .21, -5]);
});
test('requires the raw glTF JSON shape instead of guessing loader wrappers', () => {
  const json = fixture();
  assert.ok(annotations(json));
  assert.equal(annotations({ userData: json.extras }), null);
});
test('derives missing datums from minimum wall base, not first wall', () => {
  const json = fixture(), spec = json.extras.cad_scene.scene;
  spec.building.levels = [];
  spec.components.unshift({ id: 'high', floor: 'Ground', category: 'Walls', geometry: { type: 'extrusion', z: [.6, 3] } });
  assert.equal(annotations(json).levels.get('Ground'), .15);
  assert.equal(annotations(json).levels.get('Site'), null);
});
test('generated IDs, inherited external bindings, windows and mixed floor targets resolve', () => {
  const data = annotations(fixture());
  assert.deepEqual(meshBinding({ userData: { cad_scene: { component_id: 'first-wall' } } }, data), {
    bindings: [{ floor: 'First Floor', category: 'Walls' }], floors: ['First Floor'], sectioned: true,
  });
  const parent = { userData: { cad_scene: { targets: [{ kind: 'window', id: 'w1' }] } } };
  assert.deepEqual(meshBinding({ parent }, data), {
    bindings: [{ floor: 'First Floor', category: 'Windows' }], floors: ['First Floor'], sectioned: true,
  });
  const mixed = { userData: { cad_scene: { targets: [{ kind: 'component', id: 'ground-wall' }, { kind: 'component', id: 'site' }] } } };
  assert.deepEqual(meshBinding(mixed, data), {
    bindings: [{ floor: 'Ground', category: 'Walls' }, { floor: 'Site', category: 'Site' }],
    floors: ['Ground', 'Site'], sectioned: true,
  });
  assert.deepEqual(meshBinding({}, data), { bindings: [], floors: [], sectioned: false });
});
test('mixed-floor geometry partitions at declared datums regardless of target order', () => {
  const data = annotations(fixture());
  assert.deepEqual(floorBand('Site', ['Ground', 'Site'], data.levels), [-Infinity, .15]);
  assert.deepEqual(floorBand('Ground', ['Ground', 'Site'], data.levels), [.15, Infinity]);
});
test('floor clipping uses absolute level + cut height and exterior restores all geometry', () => {
  const data = annotations(fixture());
  const entry = { floor: 'First Floor', floors: ['First Floor'], first: true, sectioned: true, box: { min: { y: 3 }, max: { y: 6 } } };
  const selection = { mode: 'floor', floor: 'First Floor', cut: true };
  assert.deepEqual(previewSection(entry, data, selection, 4), { lower: -Infinity, upper: 4.3, offset: 0, visible: true });
  assert.equal(previewSection(entry, data, { ...selection, floor: 'Ground' }, 4).visible, false);
  assert.deepEqual(previewSection(entry, data, { mode: 'exterior', cut: true }, 4), { lower: -Infinity, upper: Infinity, offset: 0, visible: true });
  assert.equal(previewSection(entry, data, { ...selection, cut: false }, 4).upper, Infinity);
});
test('exploded clones move once in datum order, with no duplicate mesh in exterior', () => {
  const data = annotations(fixture());
  const entry = { floor: 'Ground', floors: ['Ground', 'Site'], first: false, sectioned: true, box: { min: { y: -.1 }, max: { y: 3 } } };
  assert.deepEqual(previewSection(entry, data, { mode: 'exploded' }, 4), { lower: .15, upper: Infinity, offset: 4, visible: true });
  assert.equal(previewSection(entry, data, { mode: 'rear' }, 4).visible, false);
});
test('above-cut non-wall objects are hidden without clipping objects below the plane', () => {
  const data = annotations(fixture());
  const entry = { floor: 'Ground', floors: ['Ground'], first: true, sectioned: false, box: { min: { y: 1.4 }, max: { y: 2 } } };
  const selection = { mode: 'floor', floor: 'Ground', cut: true };
  assert.equal(previewSection(entry, data, selection, 4).visible, false);
  entry.box.min.y = 1.2;
  assert.equal(previewSection(entry, data, selection, 4).visible, true);
  assert.equal(previewSection(entry, data, selection, 4).upper, Infinity);
});
