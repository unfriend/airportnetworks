// ========================================================== EXPLORE: WORLD ==
// Builder C's part of explore mode (src/SPEC.md, "Explore mode"): its scenes (SCENES_C), the tabs Diseases and
// Countries (renderDiseases, renderCountries here; drawDiseasesPane, drawCountriesPane in e6c_world.js, kept in step),
// what they pick (XC) and share (stateC, applyC), picking in its scenes (pickWithC ...) and its address (hashC).
// STUB (builder A): empty panes with the interface wired.
const SCENES_C = [
  ['cell', 'Cell', 'The model cell of Back into the cell, with a substance\'s threads to its proteins.'],
  ['ppi', 'Interactome', 'The interactome sorted by contacts: where a substance hits, and the diseases close by.'],
  ['globe', 'Europe', 'The countries with data, their elevated releases and their scores.'],
];
// what C's panes pick: a disease (XDATA.dis), a country (index into XDATA.countries), a search typed (never shared)
const XC = { dis: -1, country: -1, q: '' };
const stateC = () => ({ dis: XC.dis, country: XC.country });
function applyC(v) {
  if (!v || typeof v !== 'object') return;
  if (Number.isInteger(v.dis) && v.dis >= -1 && v.dis < 65535) XC.dis = v.dis;
  if (Number.isInteger(v.country) && v.country >= -1 && v.country < XDATA.countries.length) XC.country = v.country;
}
function renderDiseases() {
  const pane = $('#pane-diseases');
  if (!pane) return;
  pane.innerHTML = `<h3>Diseases</h3><p class="sub">Find a disease: its neighbourhood in the interactome and the substances close to it.</p>`;
}
function renderCountries() {
  const pane = $('#pane-countries');
  if (!pane) return;
  pane.innerHTML = `<h3>Countries</h3><p class="sub">A country's elevated releases and the diseases close to them.</p>`;
}
function pickWithC(rc) { return null; }
function pickPosC(p) { return null; }
function pickTextC(p) { return ['', '']; }
function chooseC(p) {}
function hashC(hp) {}
// a button in C's panes clicked (its data-act not the frame's: true when handled) and a search box typed in
function actC(el) { return false; }
function inputC(ev) { return false; }
