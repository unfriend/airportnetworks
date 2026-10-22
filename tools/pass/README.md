# tools/pass: the sources of "Pass it on" (`stories/pass.js`)

An outreach story of the Ludwig Boltzmann Institute for Network Medicine (LBI-NetMed) for a general audience (about 12
and up): how warnings, viruses and signals spread through networks, at three scales: a school of fish, the airports'
globe with an outbreak on its routes, and the cell map's cell. English and German. The globe and the cell are the
airports story's and the cell map story's own, taken unchanged from `stories/airports.js` and `stories/spatial.js` when
the story is built; the fish are new, after the flock. Never edit `stories/pass.js` by hand.

```sh
node tools/pass/build.mjs          # writes stories/pass.js (and tools/pass/gen/, for the harness)
node tools/pass/build.mjs --check  # exits 1 if stories/pass.js is out of date (also after airports.js or spatial.js changed)
node tools/pass/test-sets.mjs      # the sets without a browser: the outbreak, the school, the cell (about 30 s)
```

| Path | What it is |
| --- | --- |
| `build.mjs` | the assembler; `ORIGINALS` says which sections and declarations of the two hand-written stories are taken (whole, unchanged) and what they hand the sets |
| `gen/` | the cut-out originals (`airports.js`: `PASS_AIRPORTS`, `spatial.js`: `PASS_SPATIAL`), written by the build for the harness; not committed |
| `sets/fish.js` | the school of fish in deep water: a live simulation after the flock's (neighbours watched 1-12, links, a shark, the warning flashing from fish to fish) |
| `sets/globe.js` | the airports' globe behind the set contract, and a seeded S/E/I/R outbreak on its route network |
| `sets/cell.js` | the cell map's cell behind the set contract: its organelles, proteins, links, moves, signals and wrong places as params, its explore tools as an API |
| `sets/<name>.md` | each set's manifest: params, suggested keys, API, anchors, labels, views, controls, what may be said |
| `engine/e1_head.js` ... `e7_app.js` | the story engine: copied from the qubits story's as a start (the pass story's own engine is part 2 of the build) |
| `SPEC.md` | the contract between the sets and the engine: how the originals are taken, the language, placement, the chapter plan, explore mode, shared rooms |
| `harness.html`, `shot.mjs`, `sweep.mjs` | one set alone (`harness.html?set=globe&p=globe_out:1,globe_day:20&cam=start&lang=de&call=set.api.start('LHR')`; `fov`, `follow`, `warm`, `steer` for the fish), its screenshots, and screenshots of the whole story (`SHOTS=<dir>`, `PORT=<port>`) |
| `test-sets.mjs` | the sets' checks in Node (three.js builds without a page; nothing is drawn) |

Serve the repository root (`npx http-server -p 8123 -c-1 .`), run `node tools/pass/build.mjs` once, then the tools from
this folder (`node shot.mjs fish "cam=afar&fov=60&follow=1&warm=20&p=fish_links:1" fish`). Shots go to `shots/`.

Sources: the airports story's data (OpenFlights.org routes, 2014 snapshot, Open Database License; Natural Earth
coastlines) and the cell map story's lists (Human Protein Atlas and UniProt places; ideas from Thul et al. 2017, Go et al.
2021, Cho et al. 2022, Qin et al. 2021, Lundberg & Borner 2019), as those stories credit them; the fish are after the
flock (Ballerini et al. 2008 for starlings) and studies of schooling fish (Rosenthal et al. 2015, Handegard et al. 2012).
