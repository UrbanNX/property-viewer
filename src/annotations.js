// cad_scene v1: metadata is metres/Z-up; glTF geometry is already Y-up.
// Never apply another axis/scale conversion to the loaded geometry.
const point = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const named = value => typeof value === 'string' && value.trim().length > 0;
export const worldPoint = ([x, y, z]) => [x, z, -y];

export function annotations(json) {
  const embedded = json?.extras?.cad_scene;
  const spec = embedded?.scene;
  if (embedded?.version !== 1 || spec?.units !== 'm' || spec?.up_axis !== 'Z' ||
      !Array.isArray(spec.components) || !spec.building) return null;
  for (const key of ['levels', 'windows', 'rooms', 'views']) {
    if (spec.building[key] != null && !Array.isArray(spec.building[key])) return null;
  }
  const components = new Map(spec.components.filter(c => c && named(c.id)).map(c => [c.id, c]));
  const levels = new Map();
  for (const level of spec.building.levels || []) {
    if (level && named(level.name) && Number.isFinite(level.elevation)) levels.set(level.name, level.elevation);
  }
  for (const c of components.values()) {
    if (!named(c.floor)) continue;
    if (!levels.has(c.floor)) {
      const bases = [...components.values()].filter(w => w.floor === c.floor &&
        w.category === 'Walls' && w.geometry?.type === 'extrusion').map(w => w.geometry.z?.[0]).filter(Number.isFinite);
      levels.set(c.floor, bases.length ? Math.min(...bases) : null);
    }
  }
  if (!levels.size) return null;
  const windows = new Map((spec.building.windows || []).filter(w => w && named(w.id)).map(w => [w.id, w]));
  const views = (spec.building.views || []).filter(v => v && named(v.id) && named(v.label) &&
    point(v.position) && point(v.target) && v.position.some((n, i) => n !== v.target[i]) &&
    ['floor', 'exterior', 'rear', 'exploded'].includes(v.mode || 'floor') &&
    ((v.mode || 'floor') !== 'floor' || levels.has(v.floor)));
  const rooms = (spec.building.rooms || []).filter(r => r && named(r.name) && point(r.position) && levels.has(r.floor));
  const height = spec.building.plan_view?.cut_height;
  return { components, windows, levels, views, rooms, cutHeight: Number.isFinite(height) && height > 0 ? height : 1.15 };
}

export function meshBinding(object, data) {
  let binding;
  for (let node = object; node; node = node.parent) {
    if (node.userData?.cad_scene) { binding = node.userData.cad_scene; break; }
  }
  let targets = binding?.targets;
  if (binding?.component_id) targets = [{ kind: 'component', id: binding.component_id }];
  const resolved = (Array.isArray(targets) ? targets : []).filter(Boolean).flatMap(t => {
    if (t.kind === 'component') return data.components.get(t.id) || [];
    if (t.kind === 'window') {
      const host = data.components.get(data.windows.get(t.id)?.wall);
      return host ? [{ floor: host.floor, category: 'Windows' }] : [];
    }
    return [];
  });
  const floors = [...new Set(resolved.map(c => c.floor).filter(f => data.levels.has(f)))];
  return { floors, sectioned: resolved.some(c => ['Walls', 'Doors', 'Windows'].includes(c.category)) };
}

// A source node can bind to several floors (e.g. a merged site/ground shell).
// Partition it at the declared datums in isolated/exploded previews, rather
// than duplicating the entire shared mesh on each floor. Source bytes stay intact.
export function floorBand(floor, floors, levels) {
  const sorted = floors.filter(f => Number.isFinite(levels.get(f))).sort((a, b) => levels.get(a) - levels.get(b));
  const index = sorted.indexOf(floor);
  if (index < 0) return [-Infinity, Infinity];
  return [index === 0 ? -Infinity : levels.get(floor), index === sorted.length - 1 ? Infinity : levels.get(sorted[index + 1])];
}

export function previewSection(entry, data, { mode, floor, cut }, spacing) {
  const isolated = mode === 'floor' || mode === 'exploded';
  const sorted = [...data.levels.keys()].sort((a, b) => (data.levels.get(a) ?? 0) - (data.levels.get(b) ?? 0));
  const offset = mode === 'exploded' ? Math.max(0, sorted.indexOf(entry.floor)) * spacing : 0;
  let [lower, upper] = isolated && entry.floors.length > 1 ? floorBand(entry.floor, entry.floors, data.levels) : [-Infinity, Infinity];
  const elevation = data.levels.get(floor);
  const cutY = mode === 'floor' && cut && Number.isFinite(elevation) ? elevation + data.cutHeight : Infinity;
  if (entry.sectioned) upper = Math.min(upper, cutY);
  const visible = (mode !== 'floor' || entry.floor === floor) && (isolated || entry.first) &&
    entry.box.min.y <= cutY + .001 && entry.box.max.y >= lower && entry.box.min.y <= upper;
  return { lower, upper, offset, visible };
}
