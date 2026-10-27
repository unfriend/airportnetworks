# tools/mutation: the sources of the mutation story (`stories/mutation.js`)

"The mutation machine: DNA's changes as a quantum circuit", after the poster "Converting Mutation into a Machinery: DNA
Substitution Models as Quantum Circuits" by Enes Berk Sakalli (Ludwig Boltzmann Institute for Network Medicine at the
University of Vienna) and Arndt von Haeseler (Center for Integrative Bioinformatics Vienna (CIBIV), Max Perutz Labs,
University of Vienna and Medical University of Vienna), a draft of 26 Oct 2026, and Enes's answers to our questions.
Built like the qubits story (`tools/qubits/`), with the tour's kit and set contract. The numbers drawn are examples,
computed live (`MMATH`), as in the authors' own test; the poster's numbers (`MUT_DATA`) appear only where the story says
"in the authors' test". British spelling, English only. Never edit `stories/mutation.js` by hand.

```sh
node tools/mutation/test-mmath.mjs     # checks the maths (under a second)
node tools/mutation/build.mjs          # writes stories/mutation.js
node tools/mutation/build.mjs --check  # exits 1 if out of date
```

| Path | What it is |
| --- | --- |
| `sets/mmath.js` | `MMATH`: the substitution models (GTR and two simpler ones; the rate matrix Q scaled to one swap per letter per unit, P(t) = e^(Qt) by a symmetric eigen-decomposition), the path through the pyramid of mixes, a letter's two qubits (Bloch vectors, seeded read-outs), the circuit for one branch (the copy, the turn's angles, its decomposition into RY turns and CNOTs, a state-vector check), the family tree in 3D with every mutation simulated, the poster's species tree, the pair models (letter by letter, the exact pair model, our stand-in for the coupled circuit) and the ancestor rebuilt by Felsenstein's pruning; also a Node module. Its header says which example values were chosen and why |
| `test-mmath.mjs` | the maths' checks |
| `sets/data.js` | `MUT_DATA`: the poster's numbers, typed in (Figure 1's sequences, Figure 5's stems, the shares of the authors' test, the references) |
| `sets/look.js` | `MLOOK`: the story's lit, glowing instanced tubes, rings, balls, boxes and halos (from the qubits story's), plus letter tiles, arrowheads, qubit spheres and gears |
| `sets/letters.js`, `sets/tree.js`, `sets/rule.js`, `sets/stem.js` | the 3D sets (the helix, the ancestor's copies and a letter's two qubits with their read-outs; the family tree in 3D, its machines and the species tree; the rule, the pyramid and its path, the compiler, the machine for one branch and its circuit; the RNA stem, the coupling, the count, and the fields of rebuilt ancestors), each with a manifest `sets/<name>.md`. `stem` is drawn in `tree`'s frame |
| `engine/e1_head.js` ... `e7_app.js` | the story engine, adapted from the qubits story's (its shared lines kept identical): the chapters and their text (`e3_story.js`, with `FACTS` from `MMATH` and `MUT_DATA`), explore's Letters, Rule, Tree, Stem and Scenes tabs (`e4_explore.js`, canvas twins in `e6_panels.js`) |
| `SPEC.md` | what the sets, the maths and the engine must do (with the author's answers and the owner's rules); read with `tools/lbi/SPEC.md` |
| `build.mjs` | the assembler |
| `harness.html`, `shot.mjs`, `sweep.mjs` | one set alone (`cam=` a view by name or six numbers; `&with=<set>` adds a second set; the maths, data and look always loaded), its screenshots, and screenshots of the whole story (`SHOTS=<dir>` and `PORT=<port>` for both tools) |

Explore hashes: `#mutation&t=100`, `#mutation&explore&tab=letters&mix=G` (or `mix=rule&time=0.45&reads=100`),
`#mutation&explore&tab=rule&model=even&start=C&time=0.8`, `#mutation&explore&tab=rule&view=steps&parent=T`,
`#mutation&explore&tab=tree&seed=3&speed=2&branch=5`, `#mutation&explore&tab=tree&view=machines&run=on`,
`#mutation&explore&tab=stem&src=live&w=20` (`&rebuild=2` rebuilds again), `#mutation&explore&scene=stem&view=compare`,
`#mutation&explore&scene=tree&view=up` (a camera of the tree's own: `up`, `stand`, `crown`), `&now=1` skips the glide.

What a shared room shares (`collab.state()`): the tab, the scene, every scene's controls (the letter or mix; the rule,
its start and parent letters and view; the tree, how fast its letters change and whether its machines run; the source
and the method), the branch length (`time`, to the hundredth), the read-outs and their seed (`reads`, `rseed`), the
branch picked (`branch`), the pair favour (`w`) and the rebuild's seed (`sseed`). Never the camera, how far the
read-outs have played, or anything per device.

The poster (a draft, not in the repository) and its pictures are never shown: its figures are redrawn in 3D, its
numbers kept in `sets/data.js`. The test is synthetic: no patient data.
