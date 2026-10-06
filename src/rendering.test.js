import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadModel, disposeModels } from './model.js';
import { annotations, meshBinding } from './rendering.js';
import { sampleGlb } from '../examples/browser/sample.js';

test('public rendering API interprets the representative loaded GLTF result and node bindings', async () => {
  const gltf = await loadModel(sampleGlb());
  try {
    const data = annotations({ extras: gltf.userData });
    assert.deepEqual([...data.levels], [['Ground', 0], ['First', 3.2], ['Roof', 6.3]]);
    assert.deepEqual(data.rooms.map(({ name, floor }) => [name, floor]), [
      ['Living', 'Ground'], ['Kitchen', 'Ground'], ['Bedroom', 'First'],
    ]);
    const wall = gltf.scene.getObjectByName('First-back');
    assert.deepEqual(meshBinding(wall, data), {
      bindings: [{ floor: 'First', category: 'Walls' }], floors: ['First'], sectioned: true, wall: true,
    });
    assert.equal(annotations(gltf), null);
  } finally {
    disposeModels(gltf.scenes);
  }
});
