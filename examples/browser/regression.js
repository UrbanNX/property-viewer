import { createPropertyViewer } from '@urbannx/property-viewer';
import { fixtureProject, plainFixture, unpackJson, packGlb } from '../../src/urbanwave-fixture.js';
import { embedProject } from '../../src/urbanwave-contract.js';
import { sampleGlb } from './sample.js';

const check = (condition, message) => { if (!condition) throw new Error(message); };
const result = document.querySelector('#result');
let viewer;
document.querySelector('#run').onclick = async () => {
  viewer?.dispose();
  const events = [];
  viewer = createPropertyViewer({ container: document.querySelector('#canvas'), labels: document.querySelector('#labels'), onEvent: event => events.push(event) });
  result.textContent = 'Running…';
  try {
    const plain = plainFixture(), project = fixtureProject();
    project.project.storeys = {};
    for (const meta of Object.values(project.meta)) delete meta.floor;
    project.edits = { openings: {}, rooms: {}, wallHeights: {}, wallMarks: {}, addedOpenings: [], rates: {}, hidden: [], budget: 200000 };
    const unbound = await embedProject(plain, project);
    check(await viewer.load(unbound), 'unbound universal must load');
    const ready = events.find(event => event.event === 'ready');
    check(ready?.profile === 'urbanwaveProject' && ready.floors.length === 0 && ready.canSetWallOpacity && ready.hasEditorState, 'unbound ready must report profile, no floors, walls and editor-state notice');
    viewer.command({ action: 'wallOpacity', value: .5 });
    check(events.at(-1).wallOpacity === .5 && events.at(-1).canCut === false, 'unbound See Through must remain available without floor cut');
    viewer.command({ action: 'view', mode: 'exploded' });
    check(events.at(-1).mode === 'exploded' && events.at(-1).wallOpacity === .5, 'zero-storey exploded mode must preserve opacity');

    for (const scene of [0, 1]) {
      const json = unpackJson(plain);
      json.scenes = [{ nodes: [0] }, { nodes: [1] }]; json.scene = scene;
      const bytes = packGlb(json, plain.subarray(28 + new DataView(plain.buffer).getUint32(12, true)));
      events.length = 0;
      check(await viewer.load(await embedProject(bytes, fixtureProject())), `multiscene default ${scene} must load`);
      check(events.at(-1).event === 'ready' && events.at(-1).canSetWallOpacity, `multiscene default ${scene} must preserve wall capability`);
    }

    const legacy = sampleGlb(), json = unpackJson(legacy);
    for (const node of json.nodes) delete node.extras;
    events.length = 0;
    check(!await viewer.load(packGlb(json, legacy.subarray(28 + new DataView(legacy.buffer).getUint32(12, true)))), 'legacy without floor bindings remains unsupported');
    check(events.at(-1).event === 'unsupported', 'legacy guard must not become generic success');
    events.length = 0;
    const empty = packGlb({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [] }], nodes: [] });
    check(!await viewer.load(await embedProject(empty, fixtureProject())), 'empty universal must not succeed');
    check(events.at(-1).event === 'error' && events.at(-1).message === 'The model has no visible geometry.', 'empty model has a distinct error');
    await viewer.load(unbound);
    viewer.command({ action: 'wallOpacity', value: .5 });
    result.textContent = 'PASS: unbound ready/capabilities/editor-state, See Through, zero-storey exploded, both multiscene defaults, legacy guard, empty-geometry error.';
  } catch (error) { result.textContent = `FAIL: ${error.message}`; throw error; }
};
window.addEventListener('pagehide', () => viewer?.dispose(), { once: true });
