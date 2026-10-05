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

Urbanwave's `urbanwaveProject` annotations, editor, costing, walk mode, and exports
remain host-owned. Urbanwave consumes the annotation-neutral `./model` API for
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
