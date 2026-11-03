// The studio: your own scenes. A scene is a folder of files (models, their textures, sounds) and its layout.json:
// objects placed from the models (GLTF/GLB and FBX, textured, animated), see-through trigger cubes that show and hide
// them as you walk in and out, and sounds placed in the room. Not one of the stories: no narration and no chapters, it
// opens straight into the scene. Scenes come from a relay started with --scenes <folder> (which also saves layouts), or
// from a plain folder with an index.json (&scenes=<folder>).
// Runs inside index.html, which owns the page, the renderer and the headset session.
// Built by tools/studio/build.mjs from the tour's kit, three.js r128's own loaders (tools/studio/vendor/), the sets
// and the engine in tools/studio: edit those, not this file. The contract is tools/studio/SPEC.md.
HOST.register('studio', function (HOST) {
'use strict';
const D2R = Math.PI / 180;
const $ = s => document.querySelector(s);
const fmt = n => Math.round(n).toLocaleString('en-US');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// =================================================================== KIT ==
//@@KIT@@
const K = makeKit(THREE);
const { smooth, clamp } = K;

// ================================================================ VENDOR ==
//@@VENDOR@@

// ================================================================== SETS ==
// The stage (the floor, its grid and the sky, life size: 1 unit is 1 m, the floor at y = 0) and the looks of the
// items: a cube's see-through box, a sound's speaker, a model's grey box while it loads.
const SETS = {};
//@@SETS@@
