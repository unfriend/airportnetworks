// The aging ovary: what 255 ovaries show about aging. The ovary and its reserve of follicles, 255 GTEx donors aged 20 to
// 70, what an H&E section of an ovary shows (blood vessels, macrophages, corpora albicantia, follicles), two methods that
// find them (tile-level classification: UNI2 features and a random forest; semantic segmentation with SegFormer), the
// trends with age and whether the methods agree, and a spatial neighbor network as the next step. After the poster
// "Mapping the histological landscape of human ovarian aging" by Parijat Chakraborty, Samir Moustafa and André Rendeiro
// (LBI for Network Medicine; CeMM; Faculty of Computer Science, University of Vienna). American spelling in this story.
// Runs inside index.html, which owns the page, the renderer and the headset session.
// Built by tools/ovary/build.mjs from the tour's kit, the tour's PET body set, the microanatomy story's organ models and
// the data, shared look, sets and engine parts in tools/ovary: edit those, not this file.
// (ENGINE: copied from the microanatomy story as a starting point; its adaptation is part 2's work: see SPEC.md.)
HOST.register('ovary', function (HOST) {
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

// ================================================================== SETS ==
// Each set is one 3D scene of the story, centred on the origin. The story fades
// sets in and out and drives them through their params (see SETS.x.params).
// OVARY_DATA (the poster's numbers, the figures' readings and the illustrative cohort, tools/ovary/sets/data.js) comes
// first, then OVARY_TREND and OVARY_LOOK (tools/ovary/sets/look.js: the trend lines looked up, the story's look), the
// organs' small 3D models (ORGAN3D, tools/micro/sets/organs.js, unchanged; SETS.organs there is that harness's gallery,
// not part of the story) and the tour's PET body set (SETS.body, unchanged); then the story's sets organ, section and
// charts.
const SETS = {};
//@@SETS@@
