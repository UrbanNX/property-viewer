const materials = mesh => Array.isArray(mesh.material) ? mesh.material : [mesh.material];
export function captureOpacity(mesh) {
  return { castShadow: mesh.castShadow, receiveShadow: mesh.receiveShadow,
    materials: materials(mesh).map(({ opacity, transparent, depthWrite }) => ({ opacity, transparent, depthWrite })) };
}

export function applyWallOpacity(entry, multiplier) {
  const value = entry.wall ? multiplier : 1;
  materials(entry.mesh).forEach((material, i) => {
    const authored = entry.authoredOpacity.materials[i];
    material.opacity = authored.opacity * value;
    material.transparent = value < 1 || authored.transparent;
    material.depthWrite = value < 1 ? false : authored.depthWrite;
    material.needsUpdate = true;
  });
  entry.mesh.castShadow = value === 1 && entry.authoredOpacity.castShadow;
  entry.mesh.receiveShadow = value === 1 && entry.authoredOpacity.receiveShadow;
  if (entry.edge) {
    entry.edge.material.opacity = .55 * value;
    entry.edge.visible = value > 0;
  }
}
