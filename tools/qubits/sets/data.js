// QUBITS_DATA: the real run's numbers, typed in exactly as Joel Hancock's brief for this visualization gives them
// (21 Oct 2026, "Prompt: visualize network compression and the Pauli decomposition"; the brief's sections are named
// below). Everything else the story shows is computed live from example networks (QMATH, sets/qmath.js). The story
// says "in the real network" wherever it uses these numbers. American spelling in this story (the brief asks for it).
// Fields:
//   credit        who to credit: the method and the figures the story follows
//   network       the real network (brief, "1. The network"): STRING v12.5 physical protein interactions, combined
//                 score >= 500, mapped to HGNC gene symbols, largest connected component: genes
//   run           the full run (brief, "2. Bisections"): bits (8), cells (256), genes per cell (about 63); the picture
//                 uses 3 bits (8 cells)
//   cells3[]      the 3-bit cells of the main run { code, name (informal, read from gene families, not a GO
//                 enrichment), genes } (brief, "2. Bisections"); the owner chose example networks throughout, so the
//                 story need not show these
//   cubeShare     % of the coupling between cells on cube edges at 3 bits (brief, "3. The coarse operator")
//   weights3[]    the 3-bit A_c's largest Pauli weights, largest first [name, weight] (brief, "4. The Pauli
//                 decomposition"; the bottom row of the reference figure), and a tail not listed
//   outside3[]    the strings of weights3 outside so(7) (gray in the reference figure); I is the trace part
//   so7           at 3 bits: % of A_c's traceless weight on so(7)'s generators (gens) and in the whole algebra (whole)
//                 (brief, "5. Inside and outside the algebra")
//   residual      best residual by depth, main run, best algebra of the panel, ours and random partitions (bits 2..8;
//                 at 1 bit every partition has residual 0), and the best 8-bit variant (K = 256): 0.82
//   circuit       one Trotter step of e^(-iKt) at 3 bits in so(7) (brief, "Optional closing frame"): gates in time
//                 order { type, qubits, theta (rad) }, t, the convention
//   hamiltonian   the conventions (brief, "Conventions you must follow")
const QUBITS_DATA = {
  credit: 'Joel Hancock (the method and the figures it follows)',
  network: { source: 'STRING v12.5', kind: 'physical protein interactions', score: 500, mapping: 'HGNC gene symbols',
    component: 'largest connected component', genes: 16064 },
  run: { bits: 8, cells: 256, genesPerCell: 63, pictureBits: 3 },
  cells3: [
    { code: '000', name: 'Membrane signaling', genes: 2027 },
    { code: '001', name: 'RNA processing', genes: 2222 },
    { code: '010', name: 'Extracellular matrix', genes: 1954 },
    { code: '011', name: 'Folding and degradation', genes: 1987 },
    { code: '100', name: 'Olfaction and plasma', genes: 1953 },
    { code: '101', name: 'Cell cycle and ubiquitin', genes: 1928 },
    { code: '110', name: 'Respiratory chain', genes: 1987 },
    { code: '111', name: 'Gene expression', genes: 2006 },
  ],
  cubeShare: 61,
  weights3: [['I', 0.40], ['X1', 0.20], ['X2X1', 0.13], ['X2', 0.11], ['Z2Z1', 0.08], ['Y2Y1', 0.07], ['X0', 0.06],
    ['Z0', 0.05], ['X1X0', 0.04]],
  outside3: ['X2X1', 'Z0', 'X1X0'],
  so7: { gens: 66, whole: 73 },
  residual: {
    bits: [1, 2, 3, 4, 5, 6, 7, 8],
    ours: [0, 0.44, 0.52, 0.56, 0.68, 0.74, 0.81, 0.88],
    random: [0, 0.57, 0.75, 0.86, 0.92, 0.95, 0.97, 0.99],
    best8: 0.82, best8Variant: 'K = 256',
  },
  circuit: {
    bits: 3, algebra: 'so(7)', t: 1,
    gates: [
      { type: 'RX', qubits: [0], theta: -0.112 },
      { type: 'RX', qubits: [1], theta: -0.396 },
      { type: 'RX', qubits: [2], theta: -0.222 },
      { type: 'RZZ', qubits: [2, 1], theta: -0.163 },
      { type: 'RZZ', qubits: [1, 0], theta: 0.039 },
      { type: 'RZ', qubits: [2], theta: 0.029 },
    ],
    convention: 'theta = -2ct with c = tr(P A_c)/8 and R_P(theta) = exp(-i theta P/2); red for X-type gates, blue for Z-type, shaded by |theta|',
  },
  hamiltonian: { H: 'H = K + c V + rho R', K: 'K = I - A_c', V: 'V = -Diag(D)', R: 'R, the exchange operator between the two walkers (never written SWAP)' },
};
