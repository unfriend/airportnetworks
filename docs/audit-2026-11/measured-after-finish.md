# Measured 2 (v218, dev): tools/perf.mjs after it finished background builds (finish()) and added the Experiments set
Numbers only. WebGL is software (SwiftShader, 4 shared CPUs), so only relative numbers mean anything; 120 frames a point; draws and tris are both eyes.
All 21 stories run (design, studio and room scenes not run: not asked). Endo failed in its batch (240 s page timeout, 4 points) and was rerun alone: fine. No page errors.
heap KB/frame: "*" = a garbage collection fell inside the 120 frames, so that figure is unreliable (usually low); unmarked figures are clean.

## Per story, points 25% / 50% / 75% / explore
| story | js mean ms | js worst ms | heap KB/f | draws | tris k | links |
|---|---|---|---|---|---|---|
| ovary | 0.9 / 0.4 / 0.3 / 0.3 | 21.8 / 4.5 / 1.9 / 2.4 | 45* / 37* / 34* / 24 | 48 / 34 / 36 / 36 | 24 / 230 / 133 / 133 | 0 / 1 / 0 / 0 |
| nmd | 0.2 / 0.6 / 0.2 / 0.3 | 2.4 / 28.2 / 2.0 / 10.5 | 39 / 146* / 34* / 59 | 24 / 30 / 42 / 40 | 85 / 209 / 199 / 199 | 0 / 0 / 0 / 0 |
| endo | 1.1 / 0.4 / 0.4 / 0.4 | 10.4 / 2.1 / 5.2 / 4.3 | 438* / 33 / 40* / 34* | 52 / 36 / 60 / 60 | 689 / 49 / 66 / 66 | 0 / 0 / 0 / 0 |
| micro | 0.3 / 0.6 / 0.8 / 0.3 | 8.8 / 7.1 / 32.7 / 4.2 | 50* / 77* / 63* / 35 | 28 / 40 / 36 / 36 | 310 / 552 / 22 / 22 | 0 / 2 / 0 / 0 |
| ppicell | 0.9 / 0.4 / 0.7 / 0.7 | 11.8 / 3.9 / 18.5 / 4.3 | 68* / 39* / 40* / 34 | 108 / 50 / 48 / 46 | 547 / 217 / 217 / 217 | 0 / 0 / 0 / 0 |
| lbi | 0.4 / 0.5 / 0.3 / 0.2 | 2.8 / 8.5 / 2.4 / 1.1 | 72* / 35* / 43* / 43* | 66 / 32 / 58 / 60 | 84 / 92 / 142 / 142 | 0 / 1 / 1 / 0 |
| pass | 1.0 / 0.9 / 0.3 / 0.3 | 10.4 / 26.6 / 4.6 / 3.6 | 83* / 36 / 49* / 33 | 30 / 32 / 60 / 58 | 99 / 89 / 220 / 220 | 0 / 0 / 0 / 0 |
| tutorial | 1.2 / 0.5 / 0.7 / 0.3 | 39.8 / 4.9 / 31.9 / 0.6 | 65* / 81* / 84* / 52* | 26 / 44 / 46 / 48 | 9 / 10 / 10 / 10 | 0 / 0 / 0 / 0 |
| cdk5 | 0.5 / 0.7 / 0.5 / 0.3 | 14.2 / 15.0 / 4.8 / 2.5 | 84* / 42* / 59* / 50 | 32 / 36 / 42 / 80 | 6 / 25 / 23 / 25 | 0 / 0 / 1 / 0 |
| exposome | 3.9 / 0.3 / 0.6 / 0.3 | 73.4 / 2.8 / 16.4 / 2.3 | 1342* / 50 / 65 / 149 | 24 / 40 / 28 / 30 | 1 / 217 / 1 / 1 | 0 / 0 / 0 / 0 |
| soil | 0.6 / 0.8 / 0.9 / 0.3 | 7.6 / 14.5 / 33.5 / 2.6 | 111 / 46* / 158* / 44* | 36 / 42 / 46 / 46 | 163 / 94 / 98 / 98 | 0 / 0 / 0 / 0 |
| topo | 0.5 / 0.3 / 1.3 / 0.3 | 2.6 / 3.6 / 49.7 / 4.8 | 71* / 40* / 72* / 27* | 32 / 30 / 28 / 28 | 16 / 234 / 56 / 1 | 1 / 0 / 1 / 0 |
| pet | 0.5 / 0.4 / 0.6 / 0.3 | 11.0 / 5.0 / 19.1 / 1.3 | 52 / 28 / 38* / 32* | 42 / 30 / 44 / 26 | 424 / 141 / 209 / 168 | 1 / 0 / 1 / 0 |
| qubits | 0.9 / 0.6 / 0.7 / 0.6 | 27.8 / 12.2 / 6.1 / 6.5 | 65* / 50* / 96* / 85* | 54 / 40 / 46 / 46 | 51 / 18 / 143 / 154 | 0 / 0 / 0 / 0 |
| mutation | 0.4 / 0.5 / 0.5 / 0.4 | 2.1 / 4.0 / 11.4 / 5.2 | 42* / 55* / 44* / 31* | 34 / 44 / 24 / 32 | 14 / 47 / 13 / 143 | 1 / 0 / 1 / 0 |
| airports | 0.3 / 0.3 / 0.1 / 0.1 | 1.8 / 9.3 / 1.4 / 1.1 | 31* / 26* / 25 / 20* | 24 / 28 / 24 / 24 | 90 / 94 / 89 / 89 | 0 / 0 / 1 / 0 |
| spatial | 0.4 / 0.3 / 0.2 / 0.2 | 4.7 / 1.2 / 2.6 / 9.1 | 39* / 32* / 35* / 28* | 58 / 48 / 54 / 50 | 215 / 215 / 221 / 215 | 0 / 0 / 0 / 0 |
| proteins | 0.4 / 0.2 / 0.6 / 0.2 | 6.4 / 2.8 / 12.6 / 2.0 | 40* / 27* / 34* / 17 | 26 / 22 / 36 / 24 | 78 / 65 / 68 / 65 | 0 / 0 / 1 / 0 |
| flock | 0.6 / 0.5 / 0.5 / 0.4 | 18.4 / 14.6 / 10.3 / 5.9 | 47* / 37* / 86* / 87* | 22 / 24 / 26 / 28 | 19 / 19 / 19 / 19 | 0 / 0 / 0 / 1 |
| robots | 0.9 / 0.5 / 0.6 / 0.4 | 19.1 / 9.0 / 10.9 / 28.0 | 81* / 52* / 62* / 42* | 28 / 32 / 34 / 34 | 56 / 56 / 56 / 56 | 0 / 0 / 0 / 0 |
| cellstress | 0.4 / 0.3 / 0.5 / 0.5 | 11.9 / 6.3 / 37.0 / 2.1 | 27 / 23 / 26* / 24* | 40 / 40 / 42 / 40 | 196 / 196 / 196 / 196 | 0 / 0 / 0 / 0 |

Program links during measured frames (12 of 84 points): SpriteMaterial in labelSprite (placeLabelXR): ovary 50%, lbi 50%, micro 50%, topo 25%, pet 25%, mutation 25%, flock explore; MeshBasicMaterial at first render: lbi 75%, micro 50% (second link), cdk5 75%, pet 75%, mutation 75%, airports 75%, proteins 75%; ShaderMaterial: topo 75%. nmd 50% and 75%, qubits, pass, tutorial: none now.

## Compared with the earlier run (v216, before the finish() change)
| point | earlier | now |
|---|---|---|
| ovary 50% | 2,525 KB/f; js 3.5 ms mean; 28.5 worst; 1 link | 37 KB*; 0.4 mean; 4.5 worst; 1 link |
| ovary 25% | (not listed) | 45 KB*; 0.9 mean; 21.8 worst |
| ovary 75% | 1,461 KB/f | 34 KB* |
| nmd 25% | 735 KB/f; js 1.6 mean | 39 KB; 0.2 mean; 2.4 worst |
| nmd 50% | worst 30.6 ms | worst 28.2 ms; 146 KB* |
| endo 25% | 642 KB/f; js 1.7 mean; 15.3 worst | 438 KB*; 1.1 mean; 10.4 worst |
| micro 50% | 2.1 ms mean; 21.7 worst; 3 links | 0.6 mean; 7.1 worst; 2 links |
| pass 50% | worst 30.4 ms | worst 26.6 ms; 0.9 mean |
| tutorial 25% | worst 20.9 ms | worst 39.8 ms; 1.2 mean |
| ppicell 25% | 97 draws; 553k tris | 108 draws; 547k tris |
| qubits 25% | 57 draws | 54 draws; 0.9 mean; 27.8 worst |

## Measured for the first time (25% / 50% / 75% / explore)
- cdk5: js mean 0.5 / 0.7 / 0.5 / 0.3; worst 14.2 / 15.0 / 4.8 / 2.5; heap 84* / 42* / 59* / 50; draws 32 / 36 / 42 / 80; tris k 6 / 25 / 23 / 25
- exposome: js mean 3.9 / 0.3 / 0.6 / 0.3; worst 73.4 / 2.8 / 16.4 / 2.3; heap 1342* / 50 / 65 / 149; draws 24 / 40 / 28 / 30; tris k 1 / 217 / 1 / 1
- proteins: js mean 0.4 / 0.2 / 0.6 / 0.2; worst 6.4 / 2.8 / 12.6 / 2.0; heap 40* / 27* / 34* / 17; draws 26 / 22 / 36 / 24; tris k 78 / 65 / 68 / 65
- flock: js mean 0.6 / 0.5 / 0.5 / 0.4; worst 18.4 / 14.6 / 10.3 / 5.9; heap 47* / 37* / 86* / 87*; draws 22 / 24 / 26 / 28; tris k 19 / 19 / 19 / 19
- robots: js mean 0.9 / 0.5 / 0.6 / 0.4; worst 19.1 / 9.0 / 10.9 / 28.0; heap 81* / 52* / 62* / 42*; draws 28 / 32 / 34 / 34; tris k 56 / 56 / 56 / 56
- cellstress: js mean 0.4 / 0.3 / 0.5 / 0.5; worst 11.9 / 6.3 / 37.0 / 2.1; heap 27 / 23 / 26* / 24*; draws 40 / 40 / 42 / 40; tris k 196 / 196 / 196 / 196

## Five worst story points now
- heap KB/frame: exposome 25% 1342*; endo 25% 438*; soil 75% 158*; exposome explore 149; nmd 50% 146*
- js mean ms: exposome 25% 3.9; topo 75% 1.3; tutorial 25% 1.2; endo 25% 1.1; pass 25% 1.0
- js worst frame ms: exposome 25% 73.4; topo 75% 49.7; tutorial 25% 39.8; cellstress 75% 37.0; soil 75% 33.5
- draw calls: ppicell 25% 108; cdk5 explore 80; lbi 25% 66; lbi explore 60; pass 75% 60
- triangles: endo 25% 689k; micro 50% 552k; ppicell 25% 547k; pet 25% 424k; micro 25% 310k
