# Vendored three.js add-ons (the studio only)

Copied unchanged from three.js r128 (`three@0.128.0`, `examples/js/`, MIT, the same licence as `three.min.js`:
`three.LICENSE.txt`), so they match the app's three.js exactly:

| File | From | Used for |
| --- | --- | --- |
| `GLTFLoader.js` | `examples/js/loaders/` | `.glb` and `.gltf` models (textures and animations inside) |
| `FBXLoader.js` | `examples/js/loaders/` | `.fbx` models (binary and ASCII, version 7.0 and up) |
| `TGALoader.js` | `examples/js/loaders/` | `.tga` textures an FBX file names |
| `OBJLoader.js`, `MTLLoader.js` | `examples/js/loaders/` | `.obj` models and their `.mtl` materials (the upload page, the studio) |
| `PLYLoader.js`, `STLLoader.js` | `examples/js/loaders/` | `.ply` scans (vertex colours) and `.stl` models (the upload page, the studio) |
| `NURBSCurve.js`, `NURBSUtils.js` | `examples/js/curves/` | NURBS curves in FBX files (the FBX loader asks for them) |
| `SkeletonUtils.js` | `examples/js/utils/` | cloning a rigged model (one file placed several times) |
| `TransformControls.js` | `examples/js/controls/` | the page's move, turn and size arrows |
| `GLTFExporter.js` | `examples/js/exporters/` | the converter (the studio's *Convert to GLB* and its Upload pane, and `convert.mjs`) and the test models |

and `fflate.min.js` (fflate 0.6.9 by Arjun Barrett, MIT, <https://github.com/101arrowz/fflate>; the copy three.js r128
ships in `examples/js/libs/`), which the FBX loader needs to unpack compressed binary FBX arrays.

And `meshopt_simplifier.js` (meshoptimizer 1.3.0 by Arseny Kapoulkine, MIT, <https://github.com/zeux/meshoptimizer>;
from `cdn.jsdelivr.net/npm/meshoptimizer@1.3.0/meshopt_simplifier.js`, one file with its WebAssembly inside, its licence
line at its top), the simplifier behind *Fewer triangles* (the converter's `reduce`: an object's card, the Upload pane's
share per model, `convert.mjs --keep`).

`tools/studio/build.mjs` pastes the app's ones into `stories/studio.js` with their licence lines (`GLTFExporter.js` last, inside
`exporterLoad()`, so it is defined only when the studio first converts a model; `meshopt_simplifier.js` inside
`meshoptLoad()`, its last line, the ES module's `export { MeshoptSimplifier };`, left out, so its WebAssembly is made only
when the studio first makes a model lighter); never edit them here. `convert.mjs` imports `meshopt_simplifier.js` as the
module it is.
