// Shared parts of the built stories' engine file e1_head.js: see tools/engine/parts.mjs. Edit a part here, then
// rebuild every story that uses it (node tools/engine/all.mjs); node tools/engine/parts.mjs lists who uses what.
//#part D2R
const D2R = Math.PI / 180;
//#part $
const $ = s => document.querySelector(s);
//#part fmt
const fmt = n => Math.round(n).toLocaleString('en-US');
//#part esc
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
//#part css
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

//#part K
// =================================================================== KIT ==
//@@KIT@@
const K = makeKit(THREE);
//#part d_smooth_clamp
const { smooth, clamp } = K;

