// The tutorial: a robot guide stands in your room and shows you how the app works in a headset (pointing, playing a
// story, explore mode, the menu, Recenter, shared rooms), then explore mode is practice: seven small tasks.
// Runs inside index.html, which owns the page, the renderer and the headset session.
// Built by packages/tutorial/src/build.mjs from the tour's kit and engine (adapted) and the script and set in packages/tutorial/src:
// edit those, not this file.
HOST.register('tutorial', function (HOST) {
'use strict';
//#use D2R $ fmt esc css K d_smooth_clamp
// ================================================================== SETS ==
// The guide's script (its timeline as data and its evaluator) and the one set: the guide, its props and the room,
// life size (1 unit is 1 m), the viewer standing at the origin. The story drives it through its clock.
const SETS = {};
//@@SETS@@
