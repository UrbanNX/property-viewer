// Synthetic two-storey house, never customer data. Used by parser and UI checks.
import { BoxGeometry } from 'three';
import { embedProject } from './urbanwave-contract.js';

export function packGlb(json, binary = new Uint8Array()) {
  const text = new TextEncoder().encode(JSON.stringify(json));
  const size = Math.ceil(text.length / 4) * 4;
  const result = new Uint8Array(20 + size + (binary.length ? 8 + binary.length : 0));
  const view = new DataView(result.buffer);
  [0x46546c67, 2, result.length, size, 0x4e4f534a].forEach((value, i) => view.setUint32(i * 4, value, true));
  result.fill(32, 20, 20 + size); result.set(text, 20);
  if (binary.length) {
    view.setUint32(20 + size, binary.length, true); view.setUint32(24 + size, 0x004e4942, true);
    result.set(binary, 28 + size);
  }
  return result;
}

export function unpackJson(bytes) {
  return JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + new DataView(bytes.buffer, bytes.byteOffset).getUint32(12, true))));
}

export function fixtureProject() {
  return {
    format: 'urbanwave-editor-project/1',
    project: { id: 'test-house', name: 'Annotation test house', groups: [], storeys: { Lower: { level: .2 }, Upper: { level: 3.4 } } },
    meta: { Lower: { floor: 'Lower' }, Upper: { floor: 'Upper' }, Front: { type: 'wall' }, Back: { type: 'wall' }, Side: { type: 'wall' }, UpperWall: { type: 'wall' }, Sofa: { type: 'furniture' }, Slab: { type: 'slab' }, UpperSlab: { type: 'slab' } },
    rooms: { rooms: [{ id: 'living', name: 'Living room', level: .2, area: 24, perimeter_wall: 20, wall_height: 3, centroid: [1.3, -2.7], poly: [[0, 0], [6, 0], [6, -4], [0, -4]], openings: [] }], openings: {} },
    bq: { order: [], lines: [], rates: [] }, newWalls: [], estimate: [],
  };
}

export function plainFixture() {
  const geometry = new BoxGeometry(1, 1, 1);
  const positions = geometry.attributes.position.array, normals = geometry.attributes.normal.array;
  const indices = geometry.index.array;
  const binary = new Uint8Array(positions.byteLength + normals.byteLength + indices.byteLength);
  binary.set(new Uint8Array(positions.buffer));
  binary.set(new Uint8Array(normals.buffer), positions.byteLength);
  binary.set(new Uint8Array(indices.buffer), positions.byteLength + normals.byteLength);
  const node = (name, mesh, translation, scale) => ({ name, mesh, translation, scale });
  return packGlb({
    asset: { version: '2.0' }, scene: 1, scenes: [{ nodes: [] }, { nodes: [0, 1] }],
    nodes: [
      { name: 'Lower', children: [2, 3, 4, 5, 6] }, { name: 'Upper', children: [7, 8] },
      node('Front', 0, [3, 1.7, 0], [6, 3, .15]), node('Back', 0, [3, 1.7, -4], [6, 3, .15]),
      node('Side', 0, [0, 1.7, -2], [.15, 3, 4]), node('Slab', 1, [3, .1, -2], [6, .2, 4]),
      node('Sofa', 2, [2, .65, -2.5], [2, .9, 1]),
      node('UpperWall', 0, [0, 4.9, -2], [.15, 3, 4]), node('UpperSlab', 1, [3, 3.3, -2], [6, .2, 4]),
    ],
    meshes: [0, 1, 2].map(material => ({ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material }] })),
    materials: [[.82, .72, .55, 1], [.45, .5, .48, 1], [.1, .45, .32, 1]].map(baseColorFactor => ({ pbrMetallicRoughness: { baseColorFactor, metallicFactor: 0, roughnessFactor: 1 } })),
    buffers: [{ byteLength: binary.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: positions.byteLength }, { buffer: 0, byteOffset: positions.byteLength, byteLength: normals.byteLength }, { buffer: 0, byteOffset: positions.byteLength + normals.byteLength, byteLength: indices.byteLength }],
    accessors: [{ bufferView: 0, componentType: 5126, count: positions.length / 3, type: 'VEC3', min: [-.5, -.5, -.5], max: [.5, .5, .5] }, { bufferView: 1, componentType: 5126, count: normals.length / 3, type: 'VEC3' }, { bufferView: 2, componentType: 5123, count: indices.length, type: 'SCALAR' }],
  }, binary);
}

export const annotatedFixture = () => embedProject(plainFixture(), fixtureProject());
