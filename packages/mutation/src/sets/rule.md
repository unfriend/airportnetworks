# `rule`: the rule, the pyramid of mixes, the compiler and the machine (file `sets/rule.js`)

Chapters 4 (`rule`) and 5 (`machine`, its first part) of the mutation story. Four letter balls at the corners of a
pyramid (`MMATH.CORNERS`: A at the top, C front left, G at the back, T front right), as big as each letter's long-run
share (radius 0.34 √π), joined both ways by curved arrows as thick as the rate from one letter to the other
(`MMATH.Q`; the two directions bulge to opposite sides, a two-way street; light runs along them, faster where the rate
is higher). The pyramid forms (glass faces, glowing edges growing from the corners, a letter tile at each corner
facing you), the balls shrink into the corners, and the mix becomes a glowing point with a ring in four colours (its
shares) and a thread to each corner (as strong as its share). It starts at a corner and glides along its path
(`MMATH.path`): a bright green trail behind it, the rest of the path ahead faint and dashed, points 1 to 3
(`MMATH.POINTS`) as white rings that light up as it passes, the long-run mix a dashed cyan ring it settles towards.

Then the compiler: the pyramid shrinks onto a squat drum (a gear on its top, spinning faster as the rule goes in) and
the machine for one branch comes out of it, part by part:
- the parent's tile and its two qubits (left column: p1 above p0);
- the press: a head on a rail lifts the parent's letter and stamps it onto the child's tile; light runs along the two
  lines from the parent's qubits to the child's, and the child's arrows (up, `|00⟩`, before) take the parent's;
- the turn: the child's two qubits sit in two blue gears, driven by a green dial gear (all three meshing); the needle
  on the dial points at the branch length on its scale (ticks for 0, 0.25, 0.5, 1 and 2; the arc swept so far lit),
  the gears turn 1.6 times the turn's mean angle (`MMATH.turnAngle`), the child's arrows tilt as `MMATH.bloch` of the
  child's mix and its tile turns into `?` with its ring of shares;
- a small pyramid beside it: the child's mix moving along the same path from the parent's corner;
- a back frame (axles and rails) that holds it together as one machine.

Under it, the circuit in 3D: four wires (the parent's p1, p0, the child's c1, c0, top to bottom) with their inputs
(the parent's two bits as digit tiles in its letter's colour, the child's two zeros grey), the copy (two CNOTs: a dot
on the parent's wire, a ring with a cross on the child's), the turn (two blue blocks with a small gear turning on each:
c1's controlled by p1 and p0, c0's by p1, p0 and c1; control dots on the controlling wires), pulses running along the
wires that light each gate as they pass; and on request the blocks open into their simple steps (`MMATH.decompose`:
12 turns of one qubit, RY, shaded by how far each turns with a needle at its angle, and 12 links, CNOTs).

Every number is computed live by `MMATH` from the example models. Everything follows the params and `t`; only a switch
of model, start or parent letter eases in its own time (0.6 s; a seek or the first frame shows the new one at once).

## Params

| Param | Default | Meaning | Suggested keyframes |
| --- | --- | --- | --- |
| `rule_a` | 1 | fade | in at 96-98, out at 164-166 |
| `rule_balls` | 1 | the balls grow (0-0.5) and the arrows draw from tail to head (0.2-1) | 0 -> 1 at 97-102 |
| `rule_flow` | 1 | light running along the arrows | 1 |
| `rule_pyr` | 1 | the pyramid forms: edges from the corners (0-0.6), faces (0.3-1), corner tiles (0.5-1); the balls shrink into the corners (0.1-0.8), the arrows fade (0-0.5) | 0 at 96; -> 1 at 112-117 |
| `rule_path` | 1 | the mix point, its trail and the path ahead, points 1-3, the long-run ring, the threads | 0 at 96; -> 1 at 118-120 |
| `rule_time` | 1 | the branch length / time (swaps per letter, 0..3): where the point is on the path; in the machine the dial, the gears, the child's arrows and mix, the circuit's angles | 0 at 118, -> 1.6 at 120-131; -> 0 at 134-136; -> 1 at 147-154 |
| `rule_model` | 2 (`uneven`) | 0 even (JC69), 1 transitions (K80, κ 4), 2 uneven (the story's GTR example). **Step param** | 2 |
| `rule_start` | 0 | the path's start letter (A C G T). **Step param** | 0 (A) |
| `rule_compile` | 0 | the drum appears (0-0.3); the pyramid shrinks above it (0-0.4) and drops in (0.4-0.8); its gear spins up | 0 -> 1 at 134-138 |
| `rule_machine` | 0 | the machine comes out of the drum part by part (staggered, 0-0.8), the drum shrinks and goes (0.45-0.9) | 0 -> 1 at 138-142 |
| `rule_parent` | 0 | the parent's letter. **Step param** (its tile turns over, its arrows flip) | 2 (G: one arrow down) in the story |
| `rule_copy` | 1 | the copy: the head moves over the parent (0-0.12), lifts its letter (0.12-0.28), carries it (0.28-0.5), stamps it on the child (0.5-0.66), returns (0.66-0.85); the lines light (0.58-0.84) and the child's arrows take the parent's (0.66-0.82); the turn follows `rule_time` only once the copy is done (0.85-1) | 0 at 138; -> 1 at 142-147 |
| `rule_circuit` | 0 | the circuit under the machine: wires grow left to right (0-0.6), inputs, copy gates, turn blocks | 0 -> 1 at 154-157 |
| `rule_simple` | 0 | the turn blocks open into their simple steps | 0 in the story (explore) |
| `rule_run` | 1 | pulses run along the wires (by `t`) | 1 |

Step params for the engine's `STEP`: `rule_model`, `rule_start`, `rule_parent`.

The resting look (defaults): the pyramid with the mix one swap per letter along the path from A.

## Anchors

Rule: `pyramid` (its middle), `ballA` (right of A's ball), `fast` (the middle of the fastest arrow; a function),
`cA`, `cC`, `cG`, `cT` (beside each corner's tile; functions: they follow the pyramid into the compiler), `mix` (right of
the point), `p1`, `p2`, `p3` (by points 1-3), `longrun` (under the long-run ring), all functions. Compiler: `compiler`
(right of the drum). Machine: `machine` (its middle), `parent`, `child` (right of the two tiles), `press` (right of the
head; a function), `gears` (under the child's gears), `dial` (under the dial), `mini` (above the small pyramid).
Circuit: `circuit` (its middle), `wireParent`, `wireChild` (left of the inputs), `copyGates` (above the copy),
`turn1`, `turn2` (under the circuit, below each block), `steps` (above the circuit's right half).

## Labels

| Label | At | Shows while |
| --- | --- | --- |
| `Thicker arrow · swaps more readily` | `fast` | the arrows are drawn, before the pyramid forms |
| `Bigger ball · more common in the long run` | `ballA` | the balls are in, before the pyramid forms |
| `\|00⟩`, `\|01⟩`, `\|10⟩`, `\|11⟩` (minor) | `cA` ... `cT` | the pyramid has formed, until the path appears |
| `1`, `2`, `3` (green, minor) | `p1` ... `p3` | the point has passed each |
| `The mix · after 1.00 swaps per letter` (cyan; text a function) | `mix` | the path is shown |
| `Long-run mix` (cyan) | `longrun` | the path is shown and the point is under way (time 0.3-0.8) |
| `Compiler · a rule in, a circuit out` | `compiler` | the compiler runs, until the machine is half out |
| `Parent`, `Child` | `parent`, `child` | the machine is out, without the circuit |
| `Copy · the parent’s letter onto the child` (cyan) | `press` | the copy runs (0.03-0.95) |
| `Turn · as far as the branch is long` (cyan) | `gears` | the turn has begun, without the circuit |
| `Branch length · 0.45 swaps per letter` (green; text a function) | `dial` | the copy is done (not with the simple steps) |
| `The child’s mix · the same path` | `mini` | the turn has begun, without the circuit |
| `Parent · p1, p0`, `Child · c1, c0` (minor) | `wireParent`, `wireChild` | the circuit is in |
| `Copy · two CNOT gates` (cyan) | `copyGates` | the circuit, not the simple steps |
| `c1 turns 59°` (cyan; text a function: the parent's angle) | `turn1` | likewise |
| `c0 turns 29° or 58°, as c1 is 0 or 1` (cyan; text a function) | `turn2` | likewise |
| `Simple steps · 12 turns of one qubit, 12 links` (cyan; counted from `MMATH.decompose`) | `steps` | the simple steps |

At most six at once (the minor ones give way on narrow screens).

## Cam views

| View | `[az, el, dist, tx, ty, tz]` | Beat |
| --- | --- | --- |
| `default` | `[-26, 20, 4.0, 0, 0.3, 0]` | the pyramid and its path, from the front left |
| `rates` | `[16, 12, 4.0, 0, 0.32, 0]` | the balls and arrows (96-112) |
| `pyramid` | `[-22, 16, 3.9, 0, 0.3, 0]` | the pyramid forming (112-118) |
| `path` | `[-32, 22, 4.3, 0, 0.28, 0]` | the path (118-134): from the front left, so G's tile stays clear of the long-run ring |
| `compiler` | `[0, 20, 3.9, 0, -0.12, 0]` | the drum (134-139) |
| `machine` | `[0, 8, 3.3, -0.1, 0.52, 0]` | the whole machine (139-142) |
| `copy` | `[0, 8, 2.5, -0.6, 0.68, 0]` | the press, parent and child (142-147) |
| `turn` | `[12, 6, 2.9, 0.05, 0.42, 0]` | the gears, dial and small pyramid (147-154) |
| `circuit` | `[0, 6, 4.4, -0.15, 0.12, 0]` | the machine and the circuit under it (154-164) |
| `steps` | `[0, 4, 3.5, -0.05, -0.5, 0]` | the circuit's simple steps (explore) |

Sizes for framing: the rule and pyramid x ±0.93, y -0.5..1.2 (the top tile), z -1.0..0.55; the drum at y -0.6, radius
0.48, 0.3 tall; the machine x -1.15..1.05, y -0.05..1.15, z -0.22..0.18; the circuit x -1.2..1.12, y -0.88..-0.23
(its wire labels reach about x -1.7).

## Explore

Controls: View (Rule / Path / Machine / Circuit / Simple steps), Rule (the three models, `MMATH.MODELS` names), Start
(A C G T; Path only), Parent (A C G T; the machine's views), Branch length (0.15 / 0.45 / 1 / 1.6 / 2; not for Rule).
`explore(c)` reads `c.time` as any number from 0 to 2 (a slider).

`api()`:
- `models`: `[{ i, key, name, note }]`;
- `mix(mi, start, t)`: the mix after t from a letter; `longRun(mi)`; `rates(mi)` (Q, 16 numbers);
- `angles(mi, t, par)`: `{ c1, c0: [if c1 is 0, if 1] }` in radians, for the parent letter; `turn(mi, t)`
  (`MMATH.turnAngle`);
- `steps()`: `{ turns: 12, links: 12, copy: 2 }`; `shown()`: the model, start, parent and time shown.

## For the narrator

- The rates and shares are example numbers (`MMATH.MODELS`; the story's is GTR-like: transitions A↔G and C↔T swap
  several times as readily as the others, and A is the most common in the long run).
- From A the story's mix is about 17 %, 41 % and 65 % of the way to the long-run mix at points 1 to 3 (0.15, 0.45 and
  1 swaps per letter) and 78 % at 1.6: it approaches the long-run ring, it does not reach it.
- The gears turn by the turn's mean angle times 1.6 (a drawing choice); the dial's scale is not even: the turn slows
  as the mix nears the long-run mix. The angles shown are the circuit's own (at 0.45 for the parent A: c1 59°, c0 29°
  or 58°).
- The copy is two CNOT gates; the turn is a few rotations of single qubits and steps that link two qubits, so it
  depends on the parent's letter; the angles depend only on the branch length, the steps are the same on every branch
  (Enes). Decomposed: 12 RY and 12 CNOT.

## Performance

Build about 10-25 ms in the harness (software GL). Draw calls: 4 (rule), 6 (pyramid and path), up to 10 (machine and
circuit). Triangles: about 5k (rule), 8k (path), 18-22k (machine), 28-42k (with the circuit and its steps). Nothing is
allocated per frame (pools refilled; a few hundred `MMATH.path` rows a frame for the two paths).
