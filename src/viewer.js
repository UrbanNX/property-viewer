/*!
 * Three.js (bundled in property_viewer.js)
 *
 * The MIT License
 *
 * Copyright © 2010-2025 three.js authors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
import * as THREE from 'three';
import { loadModel, disposeModels as release } from './model.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { annotations, meshBinding, previewSection, worldPoint } from './annotations.js';
import { previewMesh, sectionBounds } from './geometry.js';
import { PassiveRotation } from './rotation.js';

// Each host owns its containers and controls; no Flutter or React globals.
export function createPropertyViewer({ container, labels: labelContainer, onEvent = () => {} }) {
  const send = (event, data = {}) => onEvent({ event, ...data });
  let renderer,
    scene,
    camera,
    controls,
    rotation,
    sun,
    data,
    entries = [],
    labels = [],
    fullBounds,
    mode = 'exterior',
    floor = null;
  let cut = false,
    showLabels = false;
  let observer,
    environment,
    loadedScenes = [],
    generation = 0,
    disposed = false,
    ready = false;
  const vector = (p) => new THREE.Vector3(...worldPoint(p));
  const materials = (mesh) => (Array.isArray(mesh.material) ? mesh.material : [mesh.material]);
  const visibleBounds = () => {
    const result = new THREE.Box3();
    for (const entry of entries) {
      if (!entry.mesh.visible) continue;
      const box = entry.sectionBox.clone();
      if (!box.isEmpty()) {
        box.translate(new THREE.Vector3(0, entry.offset, 0));
        result.union(box);
      }
    }
    return result;
  };

  function frame(direction = new THREE.Vector3(1, 0.7, 1), target) {
    const box = visibleBounds();
    if (box.isEmpty()) return;
    const center = target || box.getCenter(new THREE.Vector3());
    direction.normalize();
    const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize();
    const up = new THREE.Vector3().crossVectors(direction, right);
    const tanY = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    let distance = 0.5;
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) {
          const p = new THREE.Vector3(x, y, z).sub(center);
          distance = Math.max(
            distance,
            p.dot(direction) +
              Math.max(Math.abs(p.dot(right)) / (tanY * camera.aspect * 0.9), Math.abs(p.dot(up)) / (tanY * 0.85)),
          );
        }
    controls.target.copy(center);
    camera.position.copy(center).addScaledVector(direction, distance);
    camera.near = Math.max(distance / 1000, 0.001);
    camera.far = Math.max(distance * 100, 100);
    camera.updateProjectionMatrix();
    controls.update();
  }

  function applyVisibility() {
    const spacing = Math.max(2, (fullBounds.getSize(new THREE.Vector3()).y / data.levels.size) * 1.4);
    for (const entry of entries) {
      const section = previewSection(entry, data, { mode, floor, cut }, spacing);
      if (section.lower !== entry.lower || section.upper !== entry.upper || !entry.sectionBox) {
        entry.sectionBox =
          Number.isFinite(section.lower) || Number.isFinite(section.upper)
            ? sectionBounds(entry.mesh.geometry, entry.matrix, section.lower, section.upper)
            : entry.box;
      }
      Object.assign(entry, section);
      entry.mesh.visible = section.visible;
      entry.mesh.matrix.copy(entry.matrix);
      entry.mesh.matrix.elements[13] += entry.offset;
      entry.mesh.matrixWorldNeedsUpdate = true;
      const planes = [];
      if (Number.isFinite(entry.upper))
        planes.push(new THREE.Plane(new THREE.Vector3(0, -1, 0), entry.upper + entry.offset));
      if (Number.isFinite(entry.lower))
        planes.push(new THREE.Plane(new THREE.Vector3(0, 1, 0), -entry.lower - entry.offset));
      materials(entry.mesh).forEach((m, i) => {
        m.clippingPlanes = planes;
        m.side = planes.length ? THREE.DoubleSide : entry.sides[i];
      });
      if (!entry.edge) {
        entry.edge = new THREE.LineSegments(
          new THREE.EdgesGeometry(entry.mesh.geometry, 35),
          new THREE.LineBasicMaterial({ color: 0x343b36, transparent: true, opacity: 0.55, depthWrite: false }),
        );
        entry.mesh.add(entry.edge);
      }
      entry.edge.material.clippingPlanes = planes;
    }
    scene.updateMatrixWorld(true);
    // Fit shadows to the visible section, including exploded offsets. Rebuild
    // only on view/cut changes, not every frame while the user orbits the model.
    const bounds = visibleBounds();
    if (!bounds.isEmpty()) {
      const center = bounds.getCenter(new THREE.Vector3());
      const radius = Math.max(bounds.getSize(new THREE.Vector3()).length() / 2, 0.5);
      sun.target.position.copy(center);
      sun.position.copy(center).addScaledVector(new THREE.Vector3(-1, 2, 1).normalize(), radius * 3);
      Object.assign(sun.shadow.camera, {
        left: -radius,
        right: radius,
        top: radius,
        bottom: -radius,
        near: radius,
        far: radius * 5,
      });
      sun.shadow.camera.updateProjectionMatrix();
      sun.shadow.normalBias = radius * 0.001;
      renderer.shadowMap.needsUpdate = true;
    }
  }

  function selectView(nextMode, nextFloor) {
    mode = nextMode;
    floor = mode === 'floor' ? nextFloor : null;
    cut = mode === 'floor' && Number.isFinite(data.levels.get(floor));
    const selectedPreset = data.views.find(
      (v) => (v.mode || 'floor') === mode && (mode !== 'floor' || v.floor === floor),
    );
    applyVisibility();
    if (selectedPreset) {
      // Keep the authored look direction/target, but fit it to a phone viewport.
      // Desktop camera distances often crop the model on portrait screens.
      const target = vector(selectedPreset.target);
      frame(vector(selectedPreset.position).sub(target), target);
    } else
      frame(
        mode === 'rear'
          ? new THREE.Vector3(-1, 0.7, -1)
          : mode === 'floor'
            ? new THREE.Vector3(0.6, 1.6, 1)
            : undefined,
      );
    publish();
  }

  function publish() {
    send('state', {
      mode,
      floor,
      cut,
      labels: showLabels,
      canCut: mode === 'floor' && Number.isFinite(data.levels.get(floor)),
    });
  }

  const command = (command) => {
    if (!ready || disposed) return;
    if (
      command.action === 'view' &&
      (!['exterior', 'rear', 'floor', 'exploded'].includes(command.mode) ||
        (command.mode === 'floor' && !data.levels.has(command.floor)))
    )
      return;
    rotation?.stop();
    switch (command.action) {
      case 'view':
        selectView(command.mode, command.floor);
        rotation.select(command.mode);
        break;
      case 'top':
        frame(new THREE.Vector3(0, 1, 0.0001));
        publish();
        break;
      case 'reset':
        selectView(mode, floor);
        break;
      case 'cut':
        cut = !!command.value;
        applyVisibility();
        frame(camera.position.clone().sub(controls.target));
        publish();
        break;
      case 'labels':
        showLabels = !!command.value;
        publish();
        break;
    }
  };

  const load = async (input) => {
    if (disposed) throw new Error('This viewer has been disposed.');
    const current = ++generation;
    clear();
    try {
      const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
      if (bytes.byteLength < 20) throw new Error('Invalid GLB header.');
      const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const jsonLength = header.getUint32(12, true);
      if (
        header.getUint32(0, true) !== 0x46546c67 ||
        header.getUint32(4, true) !== 2 ||
        header.getUint32(8, true) !== bytes.byteLength ||
        header.getUint32(16, true) !== 0x4e4f534a ||
        jsonLength > bytes.byteLength - 20
      )
        throw new Error('Invalid GLB header.');
      const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)));
      data = annotations(json);
      if (!data) {
        send('unsupported');
        return false;
      }
      const gltf = await loadModel(bytes);
      if (disposed || current !== generation) {
        release(gltf.scenes);
        return false;
      }
      loadedScenes = gltf.scenes;
      gltf.scene.updateMatrixWorld(true);
      const source = [];
      gltf.scene.traverse((object) => {
        if (object.isMesh) source.push(object);
      });
      if (!source.some((mesh) => meshBinding(mesh, data).floors.length)) {
        clear();
        send('unsupported');
        return false;
      }
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      // Keep one-pixel edges sharp: a DPR cap upscales and softens them on dense screens.
      renderer.setPixelRatio(devicePixelRatio);
      renderer.localClippingEnabled = true;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.shadowMap.autoUpdate = false;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1;
      container.append(renderer.domElement);
      scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      const room = new RoomEnvironment();
      environment = pmrem.fromScene(room);
      scene.environment = environment.texture;
      scene.environmentIntensity = 0.3;
      room.dispose();
      pmrem.dispose();
      scene.add(new THREE.HemisphereLight(0xffffff, 0xaaa89e, 0.9));
      sun = new THREE.DirectionalLight(0xfff8ee, 2.5);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.bias = -0.0001;
      scene.add(sun, sun.target);
      camera = new THREE.PerspectiveCamera(38, 1, 0.01, 10000);
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.maxPolarAngle = Math.PI * 0.95;
      rotation = new PassiveRotation(controls);
      // A tap (even without dragging), pinch, pan or mouse wheel stops motion.
      renderer.domElement.addEventListener('pointerdown', () => rotation.stop(), { capture: true });
      controls.addEventListener('start', () => rotation.stop());
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
      fullBounds = new THREE.Box3();
      for (const original of source) {
        const binding = meshBinding(original, data);
        const box = new THREE.Box3().setFromObject(original);
        fullBounds.union(box);
        for (const [index, name] of (binding.floors.length ? binding.floors : [null]).entries()) {
          // Flatten baked world transforms so exploded offsets are in world Y,
          // even with nested rotations, negative scales and millimetre parents.
          const mesh = previewMesh(original);
          scene.add(mesh);
          entries.push({
            mesh,
            box,
            matrix: original.matrixWorld.clone(),
            ...binding,
            floor: name,
            first: index === 0,
            sides: materials(mesh).map((m) => m.side),
            offset: 0,
          });
        }
      }
      for (const room of data.rooms) {
        const element = document.createElement('span');
        element.className = 'room-label';
        element.textContent = room.name;
        labelContainer.append(element);
        labels.push({ element, position: vector(room.position), floor: room.floor });
      }
      const resize = () => {
        const width = Math.max(1, container.clientWidth),
          height = Math.max(1, container.clientHeight);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
        if (camera.position.distanceTo(controls.target) > 0.001) frame(camera.position.clone().sub(controls.target));
      };
      observer = new ResizeObserver(resize);
      observer.observe(container);
      resize();
      renderer.setAnimationLoop((time) => {
        rotation.update(time, reducedMotion.matches, document.hidden);
        const placed = [];
        for (const label of labels) {
          const p = label.position.clone().project(camera);
          label.element.hidden = !(
            showLabels &&
            cut &&
            mode === 'floor' &&
            label.floor === floor &&
            p.z >= -1 &&
            p.z <= 1 &&
            Math.abs(p.x) <= 1 &&
            Math.abs(p.y) <= 1
          );
          if (!label.element.hidden) {
            const x = ((p.x + 1) * container.clientWidth) / 2,
              y = ((1 - p.y) * container.clientHeight) / 2;
            label.element.style.left = `${x}px`;
            label.element.style.top = `${y}px`;
            const w = label.element.offsetWidth / 2 + 2,
              h = label.element.offsetHeight / 2 + 2;
            const rect = { left: x - w, right: x + w, top: y - h, bottom: y + h };
            label.element.hidden = placed.some(
              (r) => rect.left < r.right && rect.right > r.left && rect.top < r.bottom && rect.bottom > r.top,
            );
            if (!label.element.hidden) placed.push(rect);
          }
        }
        renderer.render(scene, camera);
      });
      ready = true;
      selectView('exterior');
      rotation.select('exterior');
      send('ready', { floors: [...data.levels.keys()], hasRooms: data.rooms.length > 0 });
      return true;
    } catch (error) {
      if (disposed || current !== generation) return false;
      clear();
      send('error', { message: error.message || 'Unable to render model' });
      return false;
    }
  };

  function clear() {
    ready = false;
    observer?.disconnect();
    renderer?.setAnimationLoop(null);
    controls?.dispose();
    release([scene, ...loadedScenes]);
    sun?.shadow.dispose();
    environment?.dispose();
    renderer?.dispose();
    renderer?.domElement.remove();
    labels.forEach((label) => label.element.remove());
    renderer = scene = camera = controls = rotation = sun = data = observer = environment = undefined;
    entries = [];
    labels = [];
    loadedScenes = [];
    mode = 'exterior';
    floor = null;
    cut = showLabels = false;
  }

  return {
    load,
    command,
    dispose() {
      if (!disposed) {
        disposed = true;
        generation++;
        clear();
      }
    },
  };
}
