import { Box3, MathUtils, Mesh, Vector3 } from 'three';

export function previewMesh(original) {
  // Preserve single-material vs grouped-material semantics and the exact
  // affine world matrix (decomposing it can lose shear from nested transforms).
  const material = Array.isArray(original.material) ? original.material.map(m => m.clone()) : original.material.clone();
  for (const m of Array.isArray(material) ? material : [material]) {
    // Matte architectural illustration, retaining authored colours, textures
    // and glass transparency rather than replacing the model with grey clay.
    if (!m.transparent && m.isMeshStandardMaterial) {
      m.roughness = Math.max(m.roughness, .85);
      m.metalness = Math.min(m.metalness, .15);
    }
    m.clipShadows = true;
    m.polygonOffset = true;
    m.polygonOffsetFactor = 1;
    m.polygonOffsetUnits = 1;
  }
  const mesh = new Mesh(original.geometry, material);
  mesh.castShadow = (Array.isArray(material) ? material : [material]).some(m => !m.transparent);
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  mesh.matrix.copy(original.matrixWorld);
  return mesh;
}

// Bounds of the actual horizontal section, not a shortened whole-mesh AABB.
// Merged site/house meshes otherwise make an isolated floor tiny on screen.
export function sectionBounds(geometry, matrix, lower, upper) {
  const position = geometry.attributes.position, index = geometry.index;
  const box = new Box3();
  const clip = (points, height, keepAbove) => {
    const result = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      const insideA = keepAbove ? a.y >= height : a.y <= height;
      const insideB = keepAbove ? b.y >= height : b.y <= height;
      if (insideA) result.push(a);
      if (insideA !== insideB) result.push(a.clone().lerp(b, (height - a.y) / (b.y - a.y)));
    }
    return result;
  };
  for (let i = 0; i < (index?.count ?? position.count); i += 3) {
    let points = [0, 1, 2].map(j => new Vector3().fromBufferAttribute(position, index ? index.getX(i + j) : i + j).applyMatrix4(matrix));
    if (Number.isFinite(lower)) points = clip(points, lower, true);
    if (Number.isFinite(upper)) points = clip(points, upper, false);
    for (const p of points) box.expandByPoint(p);
  }
  return box;
}

// Pure camera fit shared by canvas hosts with different controls and UI.
export function frameBounds(box, { direction = new Vector3(1, .7, 1), target, aspect, fov = 38 }) {
  if (box.isEmpty()) return null;
  const center = target?.clone() ?? box.getCenter(new Vector3());
  const forward = direction.clone().normalize();
  const right = new Vector3().crossVectors(new Vector3(0, 1, 0), forward).normalize();
  const up = new Vector3().crossVectors(forward, right);
  const tanY = Math.tan(MathUtils.degToRad(fov / 2));
  let distance = .5;
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) {
        const point = new Vector3(x, y, z).sub(center);
        distance = Math.max(
          distance,
          point.dot(forward) +
            Math.max(Math.abs(point.dot(right)) / (tanY * aspect * .9), Math.abs(point.dot(up)) / (tanY * .85)),
        );
      }
  return {
    target: center,
    position: center.clone().addScaledVector(forward, distance),
    distance,
    near: Math.max(distance / 1000, .001),
    far: Math.max(distance * 100, 100),
  };
}
