// Synthetic, public-safe GLB fixture. No production property data or network requests.
export function sampleGlb() {
  const corners = [[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
  const faces = [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]];
  const positions = new Float32Array(faces.flatMap(([a,b,c,d]) => [a,b,c,a,c,d].flatMap(i => corners[i])));
  const nodes = [], components = [];
  const box = (id, floor, category, position, scale, mesh = 0) => {
    nodes.push({ name: id, mesh, translation: position, scale, extras: { cad_scene: { component_id: id } } });
    components.push({ id, floor, category });
  };
  for (const [floor, y] of [['Ground', 0], ['First', 3.2]]) {
    box(`${floor}-slab`, floor, 'Slabs', [0,y,0], [7,.2,5]);
    box(`${floor}-back`, floor, 'Walls', [0,y+.2,0], [7,2.8,.2]);
    box(`${floor}-left`, floor, 'Walls', [0,y+.2,0], [.2,2.8,5]);
    box(`${floor}-right`, floor, 'Walls', [6.8,y+.2,0], [.2,2.8,5]);
    box(`${floor}-partition`, floor, 'Walls', [4,y+.2,0], [.15,2.8,3]);
    box(`${floor}-front-left`, floor, 'Walls', [0,y+.2,4.8], [2,2.8,.2]);
    box(`${floor}-front-right`, floor, 'Walls', [4,y+.2,4.8], [3,2.8,.2]);
    box(`${floor}-lintel`, floor, 'Walls', [2,y+2.4,4.8], [2,.6,.2]);
    box(`${floor}-table`, floor, 'Furniture', [1.3,y+.2,1.6], [1.5,.7,1.1], 1);
  }
  box('roof', 'Roof', 'Roof', [-.2,6.3,-.2], [7.4,.18,5.4], 1);
  const json = {
    asset: { version: '2.0', generator: 'property-viewer synthetic example' }, scene: 0,
    scenes: [{ nodes: nodes.map((_, i) => i) }], nodes,
    meshes: [0,1].map(material => ({ primitives: [{ attributes: { POSITION: 0 }, material }] })),
    materials: [
      { pbrMetallicRoughness: { baseColorFactor: [.82,.79,.7,1], metallicFactor: 0, roughnessFactor: 1 }, doubleSided: true },
      { pbrMetallicRoughness: { baseColorFactor: [.25,.38,.32,1], metallicFactor: 0, roughnessFactor: 1 } },
    ],
    buffers: [{ byteLength: positions.byteLength }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: positions.byteLength }],
    accessors: [{ bufferView: 0, componentType: 5126, count: positions.length / 3, type: 'VEC3', min: [0,0,0], max: [1,1,1] }],
    extras: { cad_scene: { version: 1, scene: { units: 'm', up_axis: 'Z', components, building: {
      levels: [{ name: 'Ground', elevation: 0 }, { name: 'First', elevation: 3.2 }, { name: 'Roof', elevation: 6.3 }],
      rooms: [
        { name: 'Living', floor: 'Ground', position: [2,-2.5,.25] },
        { name: 'Kitchen', floor: 'Ground', position: [5.4,-1.5,.25] },
        { name: 'Bedroom', floor: 'First', position: [2,-2.5,3.45] },
      ],
    } } } },
  };
  const text = new TextEncoder().encode(JSON.stringify(json));
  const length = Math.ceil(text.length / 4) * 4;
  const bytes = new Uint8Array(28 + length + positions.byteLength);
  const header = new DataView(bytes.buffer);
  header.setUint32(0, 0x46546c67, true); header.setUint32(4, 2, true); header.setUint32(8, bytes.length, true);
  header.setUint32(12, length, true); header.setUint32(16, 0x4e4f534a, true);
  bytes.fill(32, 20, 20 + length); bytes.set(text, 20);
  header.setUint32(20 + length, positions.byteLength, true); header.setUint32(24 + length, 0x004e4942, true);
  bytes.set(new Uint8Array(positions.buffer), 28 + length);
  return bytes;
}
