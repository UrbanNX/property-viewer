# @urbannx/property-viewer

Shared Three.js `cad_scene` v1 viewer, published from the private
[UrbanNX/property-viewer](https://github.com/UrbanNX/property-viewer) repository.
The published `v0.2.0` tag includes the viewer and editable model APIs. The
unpublished `0.3.0` source also exposes shared rendering interpretation rules.
It does not import Urby, Flutter, React, or Rails.

## What is implemented

- An ESM npm package with TypeScript declarations and a Three.js peer dependency.
- Independent instances, container-based resizing, GLB byte loading, floor and
  exploded views, wall cuts, labels, camera controls, and explicit disposal.
- Urby's real consumer at `flutter_app/tool/property_viewer` imports this package
  and builds the existing offline WebView asset. No Dart or bridge API changes.
- A browser consumer in `examples/browser` with its own package.json, two
  independent instances, file input, and a synthetic model requiring no backend.

UrbanWave's `urbanwaveProject` annotations are supported alongside legacy `cad_scene`.
The editor, costing, walk mode, and exports remain host-owned.
Urbanwave consumes the annotation-neutral `./model` API for
every GLB load and disposal, preserving editing and exports. The high-level
`createPropertyViewer` API still emits `unsupported` for plain GLBs; Urby retains
its legacy viewer fallback.

## Install and run locally

From this directory:

```sh
npm ci
npm test
npm --prefix examples/browser ci
npm --prefix examples/browser run build
```

Serve `examples/browser/dist` with a static server. The browser example's dependency
is `"@urbannx/property-viewer": "file:../.."`. Install this package first because
npm local links do not install the linked package's own dependencies.

## Consume from a separate GitHub repository

Consumers can install the immutable `v0.2.0` commit directly from GitHub:

```json
{
  "dependencies": {
    "@urbannx/property-viewer": "github:UrbanNX/property-viewer#9966e1d452fe64e935b60f58925c1bcb7b7ba888",
    "three": "0.180.0"
  }
}
```

Use an immutable commit pin if release tags are not protected. Commit the consumer's
lockfile. Private repositories require GitHub read access on developer and CI machines.

This is a Git dependency; it does not require npm publishing or a package build
hook. The host's bundler compiles the shipped ESM source and includes Three.js.
Alternatively, publish versioned releases to npm or GitHub Packages and consume
`"@urbannx/property-viewer": "0.2.0"`; GitHub Packages additionally needs a scoped
registry and authentication configuration. Never commit tokens.

`npm pack --dry-run` lists the distribution files. `npm pack` produces an installable
tarball for an isolated consumer test. Tests and demo code are excluded. The package
is marked UNLICENSED (private/proprietary); Three.js retains its MIT notices.

## Public API

```js
import { createPropertyViewer } from '@urbannx/property-viewer';

const viewer = createPropertyViewer({
  container: canvasHost,
  labels: labelOverlay,
  onEvent(message) {
    // ready: floors, hasRooms
    // state: mode, floor, cut, labels, canCut
    // unsupported: use your fallback
    // error: message
  },
});

await viewer.load(await file.arrayBuffer());
viewer.command({ action: 'view', mode: 'floor', floor: 'Ground' });
viewer.command({ action: 'labels', value: true });
viewer.command({ action: 'wallOpacity', value: 0.5 }); // See Through
viewer.dispose(); // React effect cleanup or WebView pagehide
```

The host owns downloads, authentication, UI, and persistence. `load` accepts an
ArrayBuffer or Uint8Array, clears the previous model, and returns true on success.
Failures/unsupported/superseded loads return false; loading a disposed instance
rejects. New loads supersede pending loads; dispose is idempotent. Commands before
ready are ignored. Initial state precedes ready, so a ready handler can select a
floor without a later initialization step overriding it. Event handlers should
not throw. State is transient and never writes back into the input GLB.

Give the canvas container a nonzero width/height and place the label overlay over
the same rectangle. The host supplies `.room-label` styling; see the example HTML.
No global element IDs or CSS are required by the package. Create instances only
after DOM mount. React users should dispose in effect cleanup (including Strict
Mode remounts); the module itself is safe to import during server rendering.

GLBs must be self-contained. External buffer/image URLs are blocked. Metadata is
metres/Z-up; geometry keeps glTF world transforms. This is preview rendering, not
an authoritative CAD validator. Match Urby's server-side validation for uploads.

## Editable model API

```js
import { loadModel, disposeModels } from '@urbannx/property-viewer/model';
const gltf = await loadModel(bytes);
// Preserve and edit gltf.scene in the host renderer.
disposeModels(gltf.scenes);
```

This API preserves scene hierarchy, geometry and all extras without interpreting
`cad_scene` or `urbanwaveProject`. It rejects malformed headers and external
resources, supports Meshopt and returns caller-owned scenes. The caller handles
stale loads, geometry validation and atomic replacement of its current model.
Both APIs use this loading and disposal implementation. Three.js is a peer to
avoid duplicate constructors: Urby pins 0.180.0; Urbanwave retains ^0.186.1.
Hosts importing declarations also need their usual matching `@types/three`.

## Rendering interpretation API (unpublished 0.3.0)

```js
import {
  annotations, worldPoint, meshBinding, floorBand, previewSection,
  previewMesh, sectionBounds, frameBounds, PassiveRotation,
} from '@urbannx/property-viewer/rendering';
```

This non-UI API shares `cad_scene` v1 interpretation, coordinates, floor/cut
selection, architectural preview materials, clipped bounds, perspective framing,
and optional passive rotation. `annotations(json)` accepts a raw glTF JSON document
with `json.extras.cad_scene`; unsupported or malformed metadata returns `null`.
After `loadModel`, hosts can adapt explicitly with `annotations({ extras: gltf.userData })`.
`meshBinding` returns ordered `{ floor, category }` bindings without collapsing
multi-target categories, plus unique `floors` and the derived `sectioned` flag.
The primitives do not mutate source metadata, meshes, materials, bounds, or
direction/target vectors. Hosts continue to own controls, overlays, editing,
arbitrary section tools, persistence, and application UI.

## Universal annotation resolver

`@urbannx/property-viewer/annotations` is renderer-independent (no Three.js import):

```js
import {
  resolveAnnotations, createAnnotations, resolveSourceNode, resolveObjectBinding,
  sourceNodeIndex, classifyType,
} from '@urbannx/property-viewer/annotations';

const data = await resolveAnnotations(bytes, gltf.parser.json);
const binding = resolveObjectBinding(data, mesh, gltf.parser.associations);
// { nodeIndex, sourceName, meta, bindings, floors, wall, sectioned }

// Editors: current validated ProjectData, no byte parse/hash on metadata edits.
const editable = createAnnotations(gltf.parser.json, currentProject);
// Before an editor project exists, pass null to inherit original node.extras.
const source = createAnnotations(gltf.parser.json, null);
```

`resolveAnnotations` uses UrbanWave's authoritative `vibes/packages/glb-project`
parser and fingerprint validation, bundled at immutable revision
[`c33b638`](https://github.com/UrbanNX/urbanwave/commit/c33b63887010f0b0de6c64ed9e895fa2677c05b8).
`node build-contract.mjs` regenerates it with pinned esbuild and authenticated `gh`
read access. Runtime consumers need neither checkout nor network. The generated
file is not an independently maintained schema. The synthetic fixture originated
in [Urby PR #3264](https://github.com/UrbanNX/urby/pull/3264).

The selected glTF scene's universal annotations take precedence over `cad_scene`;
malformed universal data or mismatched fingerprints throw, never fall back. Plain
GLBs resolve to null and the high-level viewer emits `unsupported`. The synchronous
`createAnnotations(json, null)` is an explicit editor-only source profile; it does
not make the high-level viewer support plain GLBs.

Source identity is the glTF **node index**, not a runtime object name. The structural
`sourceNodeIndex` adapter walks GLTFLoader associations to the closest source node,
including multi-primitive parent groups. Loader-sanitized/generated names can collide
with original names; never use them to look up `project.meta`. Duplicate original
names with project annotations reject as ambiguous. Unannotated duplicate names
remain distinguishable by index. Invalid/cyclic source hierarchies reject.

Effective `meta` fields inherit independently from the nearest non-null value;
project metadata overrides baked `node.extras` on the same node. An explicit empty
string masks an ancestor value. Edits to `data.project.meta` are read on each resolve;
recreate the data for immutable project replacement or storey/room changes. Metadata
for generated/non-source objects is allowed, but cannot bind to absent source nodes.
Unknown storey names remain in `meta.floor` and produce `floors: []`. Null/unknown
indices return null identities, empty metadata/floors and false wall/sectioned flags.
The source-only profile has no declared floors. `SourceJson`, `AnnotationProject`,
`AnnotationData` and `SourceBinding` structural types are exported.

The two entrypoints share one CAD parser and target resolver: `resolveAnnotations`
delegates CAD parsing to `rendering.annotations`, and `resolveObjectBinding`
delegates rendered CAD objects directly to `rendering.meshBinding`. Its runtime
ancestry includes mesh extras that may not appear on source glTF nodes. For CAD,
`resolveSourceNode` promises **node-extras ancestry only**; it is not a substitute
for `resolveObjectBinding` on loaded meshes. No GLTFLoader hierarchy is simulated.
For universal/source profiles, `resolveObjectBinding` uses loader associations and
then `resolveSourceNode`, never runtime names.

`SourceBinding` extends the ordered `MeshBinding` representation. Universal types
map `wall`/`walls`/`facade` to category `Walls`, doors to `Doors`, windows to `Windows`;
other nonempty type strings retain their authored category text. Empty types have
no category binding. CAD bindings preserve source target order, including repeated
floors and categories. CAD effective `meta.floor` exists only for a single floor;
`meta.type` is `wall` only for safely wall-only targets, `mixed` for mixed or partially
resolved wall targets, `door`/`window` for those unambiguous categories, and empty
for unknown semantics. This supports editor project inference without duplicating
category interpretation. Retain CAD data for the original multi-target section
semantics when turning that inference into an editable project.

`previewSection` accepts any data with `levels` and `cutHeight`, including
`AnnotationData`; its runtime behaviour and the shared `frameBounds` are unchanged.
The additive `MeshBinding.wall` declaration is optional so pre-existing hosts can
still construct preview entries without supplying it; resolvers always emit it.

### Wall semantics and opacity

`classifyType` accepts **exact**, trimmed, case-insensitive values:

| Type | Fade wall | Section/cut |
| --- | --- | --- |
| `wall`, `walls`, `facade` | yes | yes |
| `door`, `doors`, `window`, `windows` | no | yes |
| `boundary_wall`, `boundary wall`, `mixed`, `wall/window`, unknown/empty | no | no |

No substring matching is used. Descendant openings/boundary/mixed metadata overrides
inherited wall classification. If one source node merges walls and openings, mark
it `mixed`; neither this resolver nor GLTFLoader can infer wall-only triangles from
an incorrectly labelled merged mesh. Legacy `cad_scene` fades only bindings whose
targets all resolve to `Walls`; window, mixed and unresolved targets stay opaque.

`ready` adds `profile`, `hasEditorState`, `canSetWallOpacity`; `state` adds
`wallOpacity`, `canSetWallOpacity`. Hosts needing an old `hasWalls` flag should map
the capability in their adapter. Editor edits/new walls/scenarios are reported via
`hasEditorState`, not rendered by the high-level viewer.

`{ action: 'wallOpacity', value }` clamps finite values to 0–1 (nonfinite values are
ignored). It is an authored-opacity multiplier: **1 restores** original opacity,
transparent and depthWrite flags; **0.5 is See Through**; **0 is fully transparent**.
Outlines fade proportionally and disappear at zero. Faded walls neither cast nor
receive opaque shadows; preview shadow flags restore at 1. Source materials are
never modified. Doors, windows, boundary/mixed and unknown geometry retain their
authored materials. Opacity survives view changes but resets to 1 on each load;
these transient presentation changes are never persisted into a GLB.
