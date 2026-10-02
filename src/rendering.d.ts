import type { Box3, BufferGeometry, Matrix4, Mesh, Object3D, Vector3 } from 'three';

export type ViewMode = 'exterior' | 'rear' | 'floor' | 'exploded';
export interface CadSceneData {
  components: Map<string, Record<string, unknown>>;
  windows: Map<string, Record<string, unknown>>;
  levels: Map<string, number | null>;
  views: Array<Record<string, unknown>>;
  rooms: Array<Record<string, unknown>>;
  cutHeight: number;
}
export interface MeshBinding {
  /** Resolved targets in source target order; categories are not collapsed. */
  bindings: Array<{ floor: string; category: string }>;
  floors: string[];
  sectioned: boolean;
  /** True only when every declared target resolves to Walls. */
  wall?: boolean;
}
export interface PreviewEntry extends MeshBinding {
  floor: string | null;
  first: boolean;
  box: Box3;
}
export interface PreviewSection {
  lower: number;
  upper: number;
  offset: number;
  visible: boolean;
}
export interface FrameResult {
  target: Vector3;
  position: Vector3;
  distance: number;
  near: number;
  far: number;
}

/** Convert a cad_scene metres/Z-up point to Three.js Y-up coordinates. */
export function worldPoint(point: [number, number, number]): [number, number, number];
/** Interpret cad_scene v1 from a raw glTF JSON document. */
export function annotations(json: { extras?: { cad_scene?: unknown } }): CadSceneData | null;
export function meshBinding(object: Object3D, data: CadSceneData): MeshBinding;
export function floorBand(floor: string, floors: string[], levels: Map<string, number | null>): [number, number];
export function previewSection(
  entry: PreviewEntry,
  data: Pick<CadSceneData, 'levels' | 'cutHeight'>,
  selection: { mode: ViewMode; floor?: string | null; cut?: boolean },
  spacing: number,
): PreviewSection;
/** Clone preview materials while retaining source geometry and its exact world transform. */
export function previewMesh(original: Mesh): Mesh;
export function sectionBounds(geometry: BufferGeometry, matrix: Matrix4, lower: number, upper: number): Box3;
/** Calculate a perspective-camera fit without mutating the box or supplied vectors. */
export function frameBounds(
  box: Box3,
  options: { direction?: Vector3; target?: Vector3; aspect: number; fov?: number },
): FrameResult | null;

export interface RotationControls {
  autoRotate: boolean;
  autoRotateSpeed: number;
  update(delta?: number): void;
}
export class PassiveRotation {
  constructor(controls: RotationControls);
  select(mode: ViewMode): void;
  stop(): void;
  update(time: number, reducedMotion: boolean, hidden: boolean): void;
}
