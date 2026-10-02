import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

/** Load an editable, self-contained GLB without interpreting application metadata.
 * The caller owns the returned scenes and must release them with disposeModels.
 */
export async function loadModel(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength < 20) throw new Error('Invalid GLB header.');
  const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    header.getUint32(0, true) !== 0x46546c67 ||
    header.getUint32(4, true) !== 2 ||
    header.getUint32(8, true) !== bytes.byteLength ||
    header.getUint32(16, true) !== 0x4e4f534a ||
    header.getUint32(12, true) > bytes.byteLength - 20
  )
    throw new Error('Invalid GLB header.');
  const manager = new THREE.LoadingManager();
  let blocked = false,
    failed = false;
  const externalError = 'This GLB references external files. Export a self-contained GLB first.';
  manager.onError = () => {
    failed = true;
  };
  manager.setURLModifier((url) => {
    if (url.startsWith('blob:') || url.startsWith('data:')) return url;
    blocked = true;
    throw new Error(externalError);
  });
  const loader = new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  if (blocked || failed) {
    disposeModels(gltf.scenes);
    throw new Error(
      blocked ? externalError : 'An embedded resource could not be loaded. Re-export the GLB with valid textures.',
    );
  }
  return gltf;
}

/** Release all model resources once, including resources shared between scenes. */
export function disposeModels(roots) {
  const textures = new Set(),
    materials = new Set(),
    geometries = new Set();
  const skeletons = new Set(),
    instances = new Set();
  roots.filter(Boolean).forEach((root) =>
    root.traverse((object) => {
      if (!(object.isMesh || object.isLine || object.isPoints)) return;
      if (object.isSkinnedMesh) skeletons.add(object.skeleton);
      if (object.isInstancedMesh) instances.add(object);
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      }
    }),
  );
  instances.forEach((object) => object.dispose());
  skeletons.forEach((skeleton) => skeleton.dispose());
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => {
    const image = texture.source.data;
    if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) image.close();
    texture.dispose();
  });
}
