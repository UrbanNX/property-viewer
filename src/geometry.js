import { Box3, Mesh, Vector3 } from 'three';

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
