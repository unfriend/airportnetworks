// Holding on to nitrogen: why half of a farm's fertiliser is lost through the soil's microbes, and a wheat that slows
// them down. A cut-away block of soil with a wheat plant: fertiliser dissolving into ammonium, the microbes' relay that
// turns it into nitrate, which washes away, and nitrous oxide, which escapes; a halo round the roots of a wheat that
// carries a piece of a wild grass's chromosome. A hop on the globe from Vienna to Japan, a field of 24 plots under
// netting growing over five dates, nitrate seeping under each plot and jars of soil breathing out N2O; a cloud of the
// soil's microbes, the network of those that rise and fall together, its modules lighting the plots where they thrive,
// and the two wheat lines' networks side by side. After the slides "Exploring the Effects of Biological Nitrification
// Inhibition on the Rhizosphere Microbiome of a BNI-enabled Winter Wheat" by Marina Montserrat Díez and colleagues
// (Christa Schleper's group, University of Vienna, with JIRCAS, the University of Thessaly and Université Lyon 1), and
// their field trial's data, used with the authors' permission (SOIL_DATA, decoded by SDATA). The soil block, the flows,
// the relay, the chromosome and the field's layout are illustrative; every number is the data's or read off the slides.
// Runs inside index.html, which owns the page, the renderer and the headset session.
// Built by tools/soil/build.mjs from the tour's kit and the data, look, sets and engine parts in tools/soil: edit
// those, not this file.
HOST.register('soil', function (HOST) {
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
// SOIL_DATA (the trial's numbers, generated), SDATA (its decoders and lookups: no science) and SLOOK (the story's
// palette and shared shapes) come first, then TLOOK (the tissue topology story's look, unchanged: tubes, rings, balls,
// glass, halos), then the tour's web set (unchanged: only its globe is used), then the sets: soil, field, net.
const SETS = {};
//@@SETS@@
