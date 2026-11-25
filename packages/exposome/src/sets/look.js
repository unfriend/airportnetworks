// The story's palette, shared by every set and pane (builder A's; changed only at integration): the four patterns of
// chapter centre, the hazard ramp, the threads and the highlights. The chemical families and the communities take the
// authors' own colours (XDATA.classes.col: Source Data Fig1A; XDATA.comm.col: their VR layout's colours).
const LOOK = {
  pattern: ['#46d9ff', '#ffb43b', '#ff5ad9', '#9aa7b8'],          // central module, hubs, module at the edge, scattered
  hazard: [[0, '#5b6b80'], [0.3, '#ffb43b'], [1, '#ff4b3a']],       // 0 harmless .. 1 very harmful (K.ramp stops)
  thread: '#ffe08a', shared: '#ffffff', disease: '#ff6b5a', substance: '#46d9ff', protein: '#8fb3ff', none: '#8a8f99',
};
