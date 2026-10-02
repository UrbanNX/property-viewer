import type { Object3D } from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
/** Preserves hierarchy and metadata. Caller owns all returned scenes. */
export function loadModel(input: ArrayBuffer | Uint8Array): Promise<GLTF>;
export function disposeModels(roots: Object3D[]): void;
