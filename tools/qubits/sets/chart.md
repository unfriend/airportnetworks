# `chart`: the residual by depth, the circuit (file `sets/chart.js`)

Chapters 7 and 8 of the qubits story. The real run's best residual by depth, our cuts against random ones (from
`QUBITS_DATA.residual`, typed in from the brief), with the example network's own residuals at 1 to 3 bits computed live
(`QMATH`), and one Trotter step at 3 bits in so(7) as a circuit of six gates (the real run's angles from
`QUBITS_DATA.circuit`, or the example network's from `QMATH`). The chart and the circuit share the origin; show one at a
time.

## Params

| Param | Default | Meaning | Suggested keyframes |
| --- | --- | --- | --- |
| `chart_a` | 1 | fade | in at 238-241 |
| `chart_plot` | 1 | the chart (back panel with lines at 0, 0.25 .. 1, bits 1 to 8 across) | 1 until 262, -> 0 at 262-264 |
| `chart_grow` | 1 | the two series draw left to right (bit by bit) | 0 -> 1 at 242-252 |
| `chart_rand` | 1 | the random-cut series (gray, behind) | 1 |
| `chart_best` | 1 | the best 8-bit run (0.82, K = 256) as a dashed ring at 8 bits | 1 |
| `chart_ex` | 0 | the example network's residuals at 1, 2, 3 bits (amber rings, dashed line) | 0 -> 1 at 253-255 |
| `chart_circuit` | 0 | the circuit: wires q2, q1, q0 (left to right), time running down, pulses down the wires | 0 -> 1 at 262-265 |
| `chart_gates` | 6 | 0..6: the gates appear in time order (RX q0, RX q1, RX q2, RZZ q2 q1, RZZ q1 q0, RZ q2) | 0 -> 6 at 265-275 |
| `chart_run` | 1 | pulses run down the wires and light each gate as they pass (by `t`) | 1 |
| `chart_src` | 0 | 0 the real run's angles, 1 the example network's. Step param | 0 |

Gates: red for X-type, blue for Z-type, shaded by |θ| (relative to the largest of the six); an RZZ spans its two wires.

## Anchors

Chart: `chart` (center), `ours` and `rand` (where the series' labels sit), `best8`, `ex3` (the example's 3-bit point),
`ours3` (the real run's 3-bit point), `axis` (top of the y axis), `bits` (right of the x axis). Circuit: `circuit`,
`top` (the heading), `time`, `q2`, `q1`, `q0` (the wires' tops).

## Labels

Chart: `Our cuts · real network`, `Random cuts`, `Best 8-bit run · 0.82` (minor), `Example network · computed here`,
`Residual · 0 nothing lost, 1 all lost`, `Bits · qubits per walker`, ticks 1 to 8 (minor). Circuit: `One Trotter step ·
real network, so(7)` (or `example network`; text is a function), `q2`, `q1`, `q0`, `Time` (minor), and per gate
`RX θ −0.112` (text is a function of `chart_src`).

## Cam views

`default`/`chart` (face on, a little above), `circuit` (a little from the left).

## Explore

Controls: View (Chart / Circuit), Example network (Off / On; chart only), Angles (Real network / Example network;
circuit only). `api()`: `{ residual (QUBITS_DATA.residual), example ([1, 2, 3 bits]), gates ([real, example]) }`.

## For the narrator

- The residual is the share of the coarse operator dropped (0 nothing lost, 1 everything lost). At 1 bit every
  partition has residual 0. Good at 2 to 4 bits (0.44, 0.52, 0.56 against 0.57, 0.75, 0.86 for random cuts),
  worse with every bit; at 8 bits 0.88 (the best 8-bit variant 0.82) against 0.99: most of the operator falls outside
  the algebra. Do not present it as a success at 8 bits.
- At 3 bits in so(7) the generators carry 66 % of the traceless weight and the whole algebra 73 % (the real run).
- The circuit: θ = −2ct with c = tr(P A_c)/8 and R_P(θ) = exp(−iθP/2); on the generator part it equals e^(+iA_c t) up
  to a global phase (t = 1). The gates are RX on each qubit, RZZ on neighbors, RZ on q2.
