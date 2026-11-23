// The switch that sticks: CDK5, a kinase of neurons, among 16,376 human proteins. The interactome on the Menche lab's
// map of processes (a sphere of proteins placed by the Gene Ontology biological processes they take part in), CDK5 and
// its cousins, its 205 partners and its two activators, p35 and p39, pulled into the map's centre; Reactome's
// Signalling by NTRK2 carrying a message through the centre; calpain, the cut that leaves CDK5 stuck on; the
// Alzheimer's pathway it then sets off; and the disease landscape, every protein placed by the Disease Ontology
// diseases it is linked to, where CDK5 lands among disorders of the developing brain. After the Menche lab's CDK5_data
// repository (github.com/menchelab/CDK5_data, Christiane Hütter): its CDK5_analytics VR project, six scenes made with
// cartoGRAPHs. Every layout, colour and link is the authors' (CDK5_DATA, decoded by CDATA); ours are the close-ups at
// the centre (the core set), the tags and the over-representation counts the generator computes.
// Runs inside index.html, which owns the page, the renderer and the headset session.
// Built by packages/cdk5/src/build.mjs from the tour's kit and the data, look, sets and engine parts in packages/cdk5/src: edit
// those, not this file.
HOST.register('cdk5', function (HOST) {
'use strict';
//#use D2R $ fmt esc css K d_smooth_clamp
// ================================================================== SETS ==
// Each set is one 3D scene of the story, centred on the origin. The story fades
// sets in and out and drives them through their params (see SETS.x.params).
// CDK5_DATA (the authors' layouts, colours, links and the generator's counts, generated), CDATA (its decoders and
// lookups: no science) and CLOOK (the story's palette) come first, then TLOOK (the tissue topology story's look,
// unchanged: tubes, rings, balls, halos), then the sets: net (the interactome in the authors' six arrangements) and core
// (the close-up at the map's centre).
const SETS = {};
//@@SETS@@
