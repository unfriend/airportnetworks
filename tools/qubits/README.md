# tools/qubits: the sources of the qubits story (`stories/qubits.js`)

"Three qubits: how a gene network fits on a tiny quantum computer", after Joel Hancock's brief for this visualization
(network compression onto qubits and the Pauli decomposition; 21 Oct 2026), his figures and his notes on the runs.
Built like the microanatomy story (`tools/micro/`), with the tour's kit and set contract. The networks shown are
examples, computed live (`QMATH`); the real run's numbers (`QUBITS_DATA`) appear only where the story says "in the real
network". American spelling in this story only. Never edit `stories/qubits.js` by hand.

```sh
node tools/qubits/test-qmath.mjs     # checks the maths (about a second)
node tools/qubits/build.mjs          # writes stories/qubits.js
node tools/qubits/build.mjs --check  # exits 1 if out of date
```

| Path | What it is |
| --- | --- |
| `sets/qmath.js` | `QMATH`: the example networks (a planted hypercube block model at three strengths of mixing, a random network), the cut (a stand-in for the authors' beam search), A_c = P A Pᵀ with Sinkhorn balancing, the Pauli decomposition (O(4^L L)), the algebras so(2L) and so(2L+1) by closure, the residual, the error of a partial sum, Trotter angles; also a Node module |
| `test-qmath.mjs` | the maths' checks |
| `sets/data.js` | `QUBITS_DATA`: the real run's numbers, typed in from the brief (its header says where each comes from) |
| `sets/look.js` | `QLOOK`: the story's lit, glowing instanced tubes, rings, balls, boxes and halos (solid or dashed) |
| `sets/pairs.js`, `sets/cube.js`, `sets/chart.js` | the 3D sets (the grid of pairs, the map with two walkers, the chip and the neighborhoods; the cuts, the coarse operator, the Pauli strings and the toolbox; the residual by depth and the circuit), each with a manifest `sets/<name>.md` |
| `engine/e1_head.js` ... `e7_app.js` | the story engine, adapted from the microanatomy story's (its shared lines kept identical): the chapters and their text (`e3_story.js`, with `FACTS` from `QMATH` and `QUBITS_DATA`, and labels whose text is a function), explore's Network, Bricks, Depth and Scenes tabs (`e4_explore.js`, canvas twins in `e6_panels.js`) |
| `SPEC.md` | what the sets, the maths and the engine must do; read with `tools/lbi/SPEC.md` |
| `build.mjs` | the assembler |
| `harness.html`, `shot.mjs`, `sweep.mjs` | one set alone (`cam=` a view by name or six numbers; the maths, data and look always loaded), its screenshots, and screenshots of the whole story (`SHOTS=<dir>` and `PORT=<port>` for both tools) |

The inputs (Joel Hancock's brief, figures and notes) are not in the repository; only the numbers in `sets/data.js` are
kept. No STRING data, no gene names, no patient data, and no data term D (out of scope, as Joel asked).
