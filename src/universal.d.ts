import type { MeshBinding } from './rendering.js';

/** Structural input types; UrbanWave remains the authoritative project validator. */
export interface SourceJson {
  nodes?: { name?: string; children?: number[]; extras?: Record<string, unknown> }[];
  scene?: number;
  scenes?: { extras?: Record<string, unknown> }[];
  extras?: Record<string, unknown>;
}
export interface NodeMeta { floor?: string; type?: string; [key: string]: unknown }
export interface AnnotationProject {
  project: { storeys: Record<string, { level: number }> };
  meta: Record<string, NodeMeta>;
  rooms: { rooms: { name: string; level: number; centroid: number[] }[] };
  newWalls: unknown[];
  edits?: unknown;
  scenarios?: unknown[];
}
export interface AnnotationData {
  profile: 'cad_scene' | 'urbanwaveProject' | 'source';
  project?: AnnotationProject | null;
  levels: Map<string, number | null>;
  hasEditorState: boolean;
  rooms: { name: string; floor: string; position: number[] }[];
  cutHeight: number;
}
export interface SourceBinding extends MeshBinding {
  nodeIndex: number | null;
  sourceName: string | null;
  meta: NodeMeta;
  wall: boolean;
}
/** Validates embedded project and content fingerprint; null for unsupported metadata. */
export function resolveAnnotations(bytes: Uint8Array | ArrayBuffer, json: SourceJson): Promise<AnnotationData | null>;
/** No byte parsing: caller supplies its current validated editor project. */
export function createAnnotations(json: SourceJson, project: AnnotationProject | null): AnnotationData;
/** CAD: node-extras ancestry only. Use resolveObjectBinding for rendered meshes. */
export function resolveSourceNode(data: AnnotationData | null, nodeIndex: number | null): SourceBinding;
export function classifyType(type: unknown): { wall: boolean; sectioned: boolean };
export interface SourceObject { parent: SourceObject | null; userData?: Record<string, unknown> }
export interface SourceAssociations { get(object: object): { nodes?: number } | undefined }
export function sourceNodeIndex<T extends SourceObject>(object: T, associations: SourceAssociations): number | null;
/** CAD delegates to meshBinding on actual runtime ancestry; universal uses source associations. */
export function resolveObjectBinding(data: AnnotationData | null, object: SourceObject, associations: SourceAssociations): SourceBinding;
