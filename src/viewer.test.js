import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPropertyViewer } from './viewer.js';
import { sampleGlb } from '../examples/browser/sample.js';
import { annotatedFixture, unpackJson, packGlb, fixtureProject } from './urbanwave-fixture.js';
import { embedProject } from './urbanwave-contract.js';

function jsonGlb(json) {
  const text = new TextEncoder().encode(JSON.stringify(json));
  const bytes = new Uint8Array(20 + Math.ceil(text.length / 4) * 4);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, bytes.length, true);
  view.setUint32(12, bytes.length - 20, true); view.setUint32(16, 0x4e4f534a, true);
  bytes.fill(32, 20); bytes.set(text, 20);
  return bytes;
}

test('public module imports without a DOM; unsupported differs from malformed and honors byte offsets', async () => {
  const events = [];
  const viewer = createPropertyViewer({ onEvent: event => events.push(event) });
  const glb = jsonGlb({ asset: { version: '2.0' } });
  const backing = new Uint8Array(glb.length + 16);
  backing.set(glb, 8);
  assert.equal(await viewer.load(backing.subarray(8, 8 + glb.length)), false);
  assert.deepEqual(events, [{ event: 'unsupported' }]);
  const invalid = glb.slice(); new DataView(invalid.buffer).setUint32(8, 4, true);
  assert.equal(await viewer.load(invalid), false);
  assert.deepEqual(events[1], { event: 'error', message: 'Invalid GLB header.' });
  viewer.dispose(); viewer.dispose();
  await assert.rejects(viewer.load(glb), /disposed/);
});

test('disposing during real GLTF parsing prevents a late mount or callback', async () => {
  const events = [];
  const viewer = createPropertyViewer({ onEvent: event => events.push(event) });
  const pending = viewer.load(sampleGlb());
  viewer.dispose();
  assert.equal(await pending, false);
  assert.deepEqual(events, []);
});

test('a newer load supersedes in-flight GLTF parsing without publishing a stale result', async () => {
  const events = [];
  const viewer = createPropertyViewer({ onEvent: event => events.push(event) });
  const pending = viewer.load(sampleGlb());
  await viewer.load(jsonGlb({ asset: { version: '2.0' } }));
  assert.equal(await pending, false);
  assert.deepEqual(events, [{ event: 'unsupported' }]);
  viewer.dispose();
});

test('external buffer references are rejected before fetching', async () => {
  const bytes = sampleGlb();
  const length = new DataView(bytes.buffer).getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + length)));
  json.buffers[0].uri = 'https://example.invalid/private.bin';
  const events = [];
  const viewer = createPropertyViewer({ onEvent: event => events.push(event) });
  assert.equal(await viewer.load(jsonGlb(json)), false);
  assert.deepEqual(events, [{ event: 'error', message: 'This GLB references external files. Export a self-contained GLB first.' }]);
  viewer.dispose();
});

test('malformed universal metadata rejects even when valid legacy metadata is present', async () => {
  const json = unpackJson(await annotatedFixture());
  json.extras = unpackJson(sampleGlb()).extras;
  json.scenes[1].extras.urbanwaveProject = { format: 'invalid' };
  const events = [];
  const viewer = createPropertyViewer({ onEvent: event => events.push(event) });
  assert.equal(await viewer.load(packGlb(json)), false);
  assert.equal(events.length, 1);
  assert.equal(events[0].event, 'error');
  viewer.dispose();
});

test('valid universal metadata without geometry reports an error, not legacy unsupported', async () => {
  const bytes = await embedProject(packGlb({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [] }], nodes: [] }), fixtureProject());
  const events = [];
  const viewer = createPropertyViewer({ onEvent: event => events.push(event) });
  assert.equal(await viewer.load(bytes), false);
  assert.deepEqual(events, [{ event: 'error', message: 'The model has no visible geometry.' }]);
  viewer.dispose();
});
