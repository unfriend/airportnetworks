// A flock: starlings at dusk, flying all around you, each following the seven nearest to it, so the flock is a
// network that changes from moment to moment. A short story, then the flock flies on for as long as you stay.
// Runs inside index.html, which owns the page, the renderer and the headset session.
// Built by tools/flock/build.mjs from the tour's kit and engine (adapted) and the set in tools/flock: edit those, not this file.
HOST.register('flock', function (HOST) {
'use strict';
//#use D2R $ fmt esc css K d_smooth_clamp
// ================================================================== SETS ==
// The one set: the flock, its sky and its land, life size (1 unit is 1 m), the
// viewer standing at the origin. The story drives it through its params.
const SETS = {};
//@@SETS@@
