# Basis Universal for the studio's KTX2 textures

The studio (`stories/studio.js`, built from `tools/studio/`) writes a GLB's pictures as KTX2 (glTF's
`KHR_texture_basisu`: Basis Universal UASTC LDR 4x4, zstd) and reads them back: `tools/studio/engine/ktx2.js`. These
files are fetched from this folder, next to `index.html`, only when the studio first needs them (the relay serves the
folder: `APP_DIRS` in `relay/server.mjs`; the service worker keeps a copy as it keeps any app file it fetched; they are
not in its `SHELL`). Copied unchanged; never edit them here.

| File | Bytes | SHA-256 | From |
| --- | --- | --- | --- |
| `basis_encoder.js` | 105,350 | `9244d4b6b277ab4f2b4a411e6b19e9e6fdf15a1df0b0da171c4b4b542019d888` | Basis Universal (Binomial LLC), commit `073eb6a0a34a23d77e75e54f41dcd9653a52da83`, `webgl/encoder/build/basis_encoder.js` |
| `basis_encoder.wasm` | 3,360,473 | `360b23bb28f9fe08e7078dfaaed7a3eaef3966e659942bab7137d99fa5291cc5` | the same commit, `webgl/encoder/build/basis_encoder.wasm` |
| `basis_transcoder.js` | 62,337 | `48a0ef319a28bf0224ee88ded34f74eaf97c175bba9eb18b47fb9720510ad6c4` | three.js tag `r133`, `examples/js/libs/basis/basis_transcoder.js` (the same file in r133 and r143) |
| `basis_transcoder.wasm` | 499,935 | `79ae97d781e10a566659c689b7bb1de91726453f55f9f5e3bcc07a4e3904070f` | three.js tag `r133`, `examples/js/libs/basis/basis_transcoder.wasm` |
| `LICENSE.txt` | 11,347 | `065fcf48d6af21c0b75e23be5ed5753aee75c892e1c2cf178fa6736305614a5c` | Basis Universal's `LICENSE` at the same commit (Apache License 2.0), which covers the encoder and the transcoder (three.js ships Basis Universal's transcoder build) |

The addresses they were downloaded from:

- `https://raw.githubusercontent.com/BinomialLLC/basis_universal/073eb6a0a34a23d77e75e54f41dcd9653a52da83/webgl/encoder/build/basis_encoder.js` (and `.wasm`)
- `https://raw.githubusercontent.com/BinomialLLC/basis_universal/073eb6a0a34a23d77e75e54f41dcd9653a52da83/LICENSE`
- `https://raw.githubusercontent.com/mrdoob/three.js/r133/examples/js/libs/basis/basis_transcoder.js` (and `.wasm`)

Who uses which:

- The encoder runs only in the studio's own workers on a laptop or desktop page (made from a Blob that imports
  `basis_encoder.js`; its WebAssembly compiled once in the page and handed to each, since this build reads no
  `wasmBinary` but takes an `instantiateWasm`). A headset never encodes.
- The transcoder runs in three.js r133's `KTX2Loader` workers (`tools/studio/vendor/KTX2Loader.js`, its transcoder path
  this folder: the studio's scene, the textures kept compressed on the GPU) and in `ktx2.js`'s own reader worker (a KTX2
  picture read back to RGBA, for everything that re-exports a model or reads its pixels).
- The two each define a global `BASIS`, so they never share a scope: each runs in workers of its own.

Both builds also run in Node through `require` (CommonJS): `tools/studio/test-ktx2.mjs` encodes and transcodes with them.
