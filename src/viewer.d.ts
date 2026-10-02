export type ViewMode = 'exterior' | 'rear' | 'floor' | 'exploded';
export type ViewerCommand =
  | { action: 'view'; mode: 'floor'; floor: string }
  | { action: 'view'; mode: Exclude<ViewMode, 'floor'> }
  | { action: 'top' | 'reset' }
  | { action: 'cut' | 'labels'; value: boolean };
export type ViewerEvent =
  | { event: 'ready'; floors: string[]; hasRooms: boolean }
  | { event: 'state'; mode: ViewMode; floor: string | null; cut: boolean; labels: boolean; canCut: boolean }
  | { event: 'unsupported' }
  | { event: 'error'; message: string };
export interface PropertyViewer {
  /** Replaces the current model. False for unsupported, failed or superseded loads. */
  load(bytes: ArrayBuffer | Uint8Array): Promise<boolean>;
  command(command: ViewerCommand): void;
  /** Releases this instance. Create a new instance to mount again. */
  dispose(): void;
}
export function createPropertyViewer(options: {
  container: HTMLElement;
  labels: HTMLElement;
  onEvent?: (event: ViewerEvent) => void;
}): PropertyViewer;
