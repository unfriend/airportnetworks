// The story's palette, shared by every set and pane: the four patterns of chapter centre, the hazard ramp, the threads,
// the highlights and the chemical families. The families' colours are ours (the shelves are our drawing): one clearly
// different colour each, in the order of XDATA.classes.names (largest first), the eight largest from the Okabe-Ito set
// that colour-blind readers can tell apart, lightened where the dark sky needs it; the four smallest families (under 400
// substances) reuse nearby hues. The communities keep the authors' own colours (XDATA.comm.col: their VR layout's).
const LOOK = {
  family: ['#56b4e9', '#e69f00', '#2fd18a', '#f0e442', '#ff7eb6', '#ff5a36', '#b28dff', '#d9d9d9', '#9aa84a', '#c08552', '#ffc9a3', '#4fb3a6'],
  pattern: ['#46d9ff', '#ffb43b', '#ff5ad9', '#9aa7b8'],          // central module, hubs, module at the edge, scattered
  hazard: [[0, '#5b6b80'], [0.3, '#ffb43b'], [1, '#ff4b3a']],       // 0 harmless .. 1 very harmful (K.ramp stops)
  thread: '#ffe08a', shared: '#ffffff', disease: '#ff6b5a', substance: '#46d9ff', protein: '#8fb3ff', none: '#8a8f99',
};
