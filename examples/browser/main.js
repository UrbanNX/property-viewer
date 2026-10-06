import { createPropertyViewer } from '@urbannx/property-viewer';
import { sampleGlb } from './sample.js';
import { annotatedFixture } from '../../src/urbanwave-fixture.js';

for (const [id, title, description] of [
  ['web', 'Web-sized consumer', 'Host-owned controls; package-owned rendering.'],
  ['compact', 'Compact consumer', 'A separate instance of exactly the same package.'],
]) {
  const article = document.createElement('article');
  article.id = id;
  article.innerHTML = `<header><h2>${title}</h2><p>${description}</p></header>
    <div class="stage"><div class="canvas"></div><div class="labels"></div></div>
    <div class="controls"><button class="primary" data-load>Load sample</button>
      <button data-universal>Load UrbanWave</button>
      <label>Open GLB <input type="file" accept=".glb" aria-label="${title} GLB"></label></div>
    <div class="controls" data-tools>
      <select aria-label="${title} view"><option value="exterior">Exterior</option><option value="exploded">Exploded</option></select>
      <button data-action="top">Top</button><button data-action="reset">Reset</button>
      <label><input type="checkbox" data-cut> Cut walls</label>
      <label><input type="checkbox" data-labels> Labels</label>
      <label>Wall opacity <input type="range" min="0" max="1" step="0.5" value="1" data-opacity aria-label="${title} wall opacity"></label>
      <button data-dispose>Dispose</button>
    </div><p class="status" role="status">Choose a sample or a cad_scene GLB.</p>`;
  document.querySelector('#viewers').append(article);
  const find = selector => article.querySelector(selector);
  const tools = [...article.querySelectorAll('[data-tools] button, [data-tools] input, [data-tools] select')];
  const enable = value => tools.forEach(element => { element.disabled = !value; });
  enable(false);
  let viewer;
  const mount = () => createPropertyViewer({
    container: find('.canvas'), labels: find('.labels'),
    onEvent(message) {
      if (message.event === 'ready') {
        enable(true);
        find('select').replaceChildren(...[
          ['exterior', 'Exterior'], ['exploded', 'Exploded'],
          ...message.floors.filter(floor => !['roof', 'site'].includes(floor.toLowerCase())).map(floor => [`floor:${floor}`, floor]),
        ].map(([value, text]) => new Option(text, value)));
        find('[data-cut]').disabled = true;
        find('[data-labels]').disabled = !message.hasRooms;
        find('[data-opacity]').disabled = !message.canSetWallOpacity;
        find('.status').textContent = `Ready · ${message.profile} · ${message.floors.length} levels · exterior`;
      } else if (message.event === 'state') {
        find('select').value = message.mode === 'floor' ? `floor:${message.floor}` : message.mode;
        find('[data-cut]').checked = message.cut;
        find('[data-cut]').disabled = !message.canCut;
        find('[data-labels]').checked = message.labels;
        find('[data-opacity]').value = message.wallOpacity;
        find('[data-opacity]').disabled = !message.canSetWallOpacity;
        find('.status').textContent = `${message.mode}${message.floor ? ` · ${message.floor}` : ''} · cut ${message.cut ? 'on' : 'off'} · wall opacity ${message.wallOpacity}`;
      } else {
        enable(false);
        find('.status').textContent = message.event === 'error' ? message.message : 'Unsupported: use an annotated GLB.';
      }
    },
  });
  async function load(bytes) {
    enable(false);
    find('.status').textContent = 'Loading…';
    viewer ??= mount();
    await viewer.load(bytes);
  }
  find('[data-load]').onclick = () => load(sampleGlb());
  find('[data-universal]').onclick = async () => load(await annotatedFixture());
  find('input[type=file]').onchange = async event => {
    const file = event.target.files[0];
    if (file) await load(await file.arrayBuffer());
    event.target.value = '';
  };
  find('select').onchange = event => {
    const value = event.target.value;
    viewer.command(value.startsWith('floor:')
      ? { action: 'view', mode: 'floor', floor: value.slice(6) }
      : { action: 'view', mode: value });
  };
  article.querySelectorAll('[data-action]').forEach(button => {
    button.onclick = () => viewer.command({ action: button.dataset.action });
  });
  find('[data-cut]').onchange = event => viewer.command({ action: 'cut', value: event.target.checked });
  find('[data-labels]').onchange = event => viewer.command({ action: 'labels', value: event.target.checked });
  find('[data-opacity]').oninput = event => viewer.command({ action: 'wallOpacity', value: Number(event.target.value) });
  find('[data-dispose]').onclick = () => {
    viewer.dispose(); viewer = null; enable(false);
    find('.status').textContent = 'Disposed · canvas and resources released. Load to remount.';
  };
  window.addEventListener('pagehide', () => viewer?.dispose(), { once: true });
}
