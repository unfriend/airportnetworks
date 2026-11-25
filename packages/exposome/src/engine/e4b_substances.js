// ===================================================== EXPLORE: SUBSTANCES ==
// Builder B's part of explore mode (src/SPEC.md, "Explore mode"): its scenes (SCENES_B), the tabs Substances and Groups
// (renderSubstances, renderGroups here; drawSubstancesPane, drawGroupsPane in e6b_substances.js, kept in step), what
// they pick (XB) and share (stateB, applyB), picking in its scenes (pickWithB ...) and its address (hashB).
// STUB (builder A): empty panes with the interface wired.
const SCENES_B = [
  ['cloud', 'Substances', 'Every substance, by the genes it shares with others (the authors\' layout) or by chemistry.'],
];
// what B's panes pick: a substance, a community (by number: XDATA.comm), a search typed (typed text is never shared)
const XB = { sub: -1, comm: -1, q: '' };
// the shared part: plain outcomes only (SPEC.md, "Shared rooms")
const stateB = () => ({ sub: XB.sub, comm: XB.comm });
function applyB(v) {
  if (!v || typeof v !== 'object') return;
  if (Number.isInteger(v.sub) && v.sub >= -1 && v.sub < XDATA.N) XB.sub = v.sub;
  if (Number.isInteger(v.comm) && v.comm >= -1 && v.comm < XDATA.comm.n) XB.comm = v.comm;
}
function renderSubstances() {
  const pane = $('#pane-substances');
  if (!pane) return;
  pane.innerHTML = `<h3>Substances</h3><p class="sub">Find a substance and follow its threads: its genes, its group, the diseases close to it.</p>`;
}
function renderGroups() {
  const pane = $('#pane-groups');
  if (!pane) return;
  pane.innerHTML = `<h3>Groups</h3><p class="sub">The communities at three levels, each with what its genes do.</p>`;
}
// picking in B's scenes: null when nothing of B's is under the ray (or B's scene is not on show)
function pickWithB(rc) { return null; }
function pickPosB(p) { return null; }
function pickTextB(p) { return ['', '']; }
function chooseB(p) {}
// the address (#exposome&explore&...): B's own keys, read once at start
function hashB(hp) {}
// a button in B's panes clicked (its data-act not the frame's: true when handled) and a search box typed in
function actB(el) { return false; }
function inputB(ev) { return false; }
