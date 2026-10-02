import { loadGlbProject } from './urbanwave-contract.js';
import { annotations, meshBinding } from './annotations.js';

const categories = new Map([
  ['wall', 'Walls'], ['walls', 'Walls'], ['facade', 'Walls'],
  ['door', 'Doors'], ['doors', 'Doors'], ['window', 'Windows'], ['windows', 'Windows'],
]);
const semanticValue = type => typeof type === 'string' ? type.trim().toLowerCase() : '';
export function classifyType(type) {
  const category = categories.get(semanticValue(type));
  return { wall: category === 'Walls', sectioned: category !== undefined };
}

// Accepts current, already validated editor state. No fingerprint or byte reparse.
export function createAnnotations(json, project) {
  const nodes = json.nodes || [], parents = new Map(), names = new Map();
  nodes.forEach((node, index) => {
    if (node.name) {
      if (names.has(node.name) && project?.meta[node.name]) throw new Error(`Duplicate source node name: ${node.name}`);
      names.set(node.name, index);
    }
    for (const child of node.children || []) {
      if (!nodes[child] || parents.has(child)) throw new Error('Invalid source node hierarchy');
      parents.set(child, index);
    }
  });
  for (let index = 0; index < nodes.length; index++) {
    const seen = new Set();
    for (let i = index; i !== undefined; i = parents.get(i)) {
      if (seen.has(i)) throw new Error('Cyclic source node hierarchy');
      seen.add(i);
    }
  }
  const levels = new Map(Object.entries(project?.project.storeys || {}).map(([id, value]) => [id, value.level]));
  return {
    profile: project ? 'urbanwaveProject' : 'source', project, nodes, parents, levels,
    hasEditorState: !!project?.edits || !!project?.newWalls.length || !!project?.scenarios?.length,
    rooms: (project?.rooms.rooms || []).flatMap(room => {
      const floors = [...levels].filter(([, elevation]) => Math.abs(elevation - room.level) < .001);
      return floors.length === 1 ? [{ name: room.name, floor: floors[0][0], position: [room.centroid[0], room.level + .05, room.centroid[1]] }] : [];
    }),
    views: [], cutHeight: 1.15,
  };
}

export async function resolveAnnotations(bytes, json) {
  if (json.scenes?.[json.scene ?? 0]?.extras?.urbanwaveProject !== undefined) {
    const { project } = await loadGlbProject(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
    return createAnnotations(json, project);
  }
  const legacy = annotations(json);
  return legacy ? { ...legacy, profile: 'cad_scene', hasEditorState: false, nodes: json.nodes || [] } : null;
}

export function resolveSourceNode(data, nodeIndex) {
  const node = data?.nodes[nodeIndex];
  const empty = { nodeIndex: node ? nodeIndex : null, sourceName: node?.name ?? null, meta: {}, bindings: [], floors: [], wall: false, sectioned: false };
  if (!node) return empty;
  if (data.profile === 'cad_scene') {
    const ancestry = new Map();
    data.nodes.forEach((n, i) => (n.children || []).forEach(child => ancestry.set(child, i)));
    let object = null;
    const chain = [], seen = new Set();
    for (let i = nodeIndex; i !== undefined && !seen.has(i); i = ancestry.get(i)) { seen.add(i); chain.push(data.nodes[i]); }
    for (const source of chain.reverse()) object = { userData: source.extras, parent: object };
    const binding = meshBinding(object, data);
    return { ...empty, ...binding, meta: cadMeta(binding) };
  }
  const meta = {};
  for (let i = nodeIndex; i !== undefined; i = data.parents.get(i)) {
    const own = { ...data.nodes[i].extras, ...data.project?.meta[data.nodes[i].name] };
    for (const [key, value] of Object.entries(own || {})) if (meta[key] == null) meta[key] = value;
  }
  const floors = data.levels.has(meta.floor) ? [meta.floor] : [];
  const category = categories.get(semanticValue(meta.type)) || (typeof meta.type === 'string' ? meta.type.trim() : '');
  return { ...empty, meta, floors, bindings: category ? floors.map(floor => ({ floor, category })) : [], ...classifyType(meta.type) };
}

// Editor inference must not turn mixed or partially resolved CAD walls into
// wall-only metadata. Ordered bindings stay intact for presentation consumers.
function cadMeta(binding) {
  const meta = { type: '' };
  if (binding.floors.length === 1) meta.floor = binding.floors[0];
  const types = [...new Set(binding.bindings.map(item => item.category))];
  if (binding.wall) meta.type = 'wall';
  else if (types.length > 1 || types[0] === 'Walls') meta.type = 'mixed';
  else if (types.length === 1) {
    const type = { Doors: 'door', Windows: 'window' }[types[0]] || types[0].toLowerCase();
    meta.type = classifyType(type).wall ? 'mixed' : type;
  }
  return meta;
}

// Rendered CAD objects may carry mesh extras absent from source node extras.
// Use the actual runtime ancestry, rather than reproducing loader internals.
export function resolveObjectBinding(data, object, associations) {
  const nodeIndex = sourceNodeIndex(object, associations);
  if (data?.profile !== 'cad_scene') return resolveSourceNode(data, nodeIndex);
  const binding = meshBinding(object, data);
  return { nodeIndex, sourceName: data.nodes[nodeIndex]?.name ?? null, ...binding, meta: cadMeta(binding) };
}

// Structural adapter: no Three.js dependency. Primitive meshes inherit their
// owning source node through GLTFLoader's association on the parent Group.
export function sourceNodeIndex(object, associations) {
  for (let current = object; current; current = current.parent) {
    const index = associations.get(current)?.nodes;
    if (Number.isInteger(index)) return index;
  }
  return null;
}
