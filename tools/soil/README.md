# tools/soil: the sources of the soil story (`stories/soil.js`)

"Holding on to nitrogen", after the slides "Exploring the Effects of Biological Nitrification Inhibition on the
Rhizosphere Microbiome of a BNI-enabled Winter Wheat" by Marina Montserrat Díez, Tadashi Yoshihashi, Guntur Subbarao
Ventaka, Eleftheria Bachtsevani, Dimitrios Karpouzas, Christina Hazard, Melina Kerou and Christa Schleper (University of
Vienna; University of Thessaly; Université Lyon 1; JIRCAS), and their field trial's data, used with the authors'
permission (given through the project's owner, 29 October 2026). Made for the Global Peter Drucker Forum in Vienna.
Built like the tissue topology story (`tools/topo/`), with the tour's kit and set contract. British spelling, English
only. Never edit `stories/soil.js` by hand.

```sh
node tools/soil/test-data.mjs       # checks the data, its decoders and the story's key numbers (a second)
node tools/soil/build.mjs           # writes stories/soil.js
node tools/soil/build.mjs --check   # exits 1 if out of date
# the data, from the authors' three CSVs (kept out of the repository), in a Python with requirements.txt:
python -I tools/soil/data/reconcile.py <reader A readings.json> <reader B readings.json>   # data/figures.json
python -I tools/soil/data/gen_data.py <folder with Soil_ASVs.csv, ASV_Identifiers.csv, Field_Metadata.csv>   # sets/data.js
```

| Path | What it is |
| --- | --- |
| `data/gen_data.py` | the generator: reads the 16S read counts, their taxonomy and the field metadata from a folder given on the command line, builds the co-occurrence network, and writes `sets/data.js` (about 425 KB). Its header says what each field holds. About five minutes |
| `data/reconcile.py`, `data/figures.json` | the slides' charts (chlorophyll, ammonium and nitrate; the N2O incubations; the qPCR counts) read off by two readers and reconciled: their mean where they agree, flagged where they do not. The readers' own files are not kept |
| `data/requirements.txt` | numpy, pandas, scipy, networkx |
| `sets/data.js` | `SOIL_DATA`: the design, the field measures per plot and date, the phyla, the nitrifier guilds, 20,000 kinds for the cloud, the 3,384 common kinds, the co-occurrence network (1,564 kinds, 22,348 links, 17 modules, its layout, thresholds, the shuffled null, the splits by line, fertiliser and at random) and what the story uses of `figures.json`. Generated: never edit |
| `sets/sdata.js` | `SDATA`: decodes `SOIL_DATA` once and gives the lookups the sets and the engine share; no science |
| `sets/look.js` | `SLOOK`: the story's palette and colour rules (nitrogen's forms, the slides' line and regime colours, the guilds, soil and plant, leaf colour by chlorophyll, phyla, modules) |
| `sets/soil.js`, `sets/field.js`, `sets/net.js` | the 3D sets: the cut-away soil block with its flows, the relay, the halo and the chromosome; the field of 24 plots, its wheat, nitrate, jars and cores; the cloud of microbes and the network, drawn over the field. Each gets a manifest `sets/<name>.md`. The build adds the tissue topology story's look (`TLOOK`) and the tour's `web` set (its globe), both unchanged |
| `engine/e1_head.js` ... `e7_app.js` | the story engine, copied from the tissue topology story's (its shared lines kept identical: diff them against `tools/topo/engine/` when either changes). The story's own parts: the hop from Vienna to Japan (`e2_scene.js`); the eight chapters, their text from `SOIL_DATA` (`FACTS`), keys, cameras and the pace (`NARRATION_SYNC`, from `tools/pace.mjs`) in `e3_story.js`; explore's tabs Field, Nitrogen, Microbes, Network and Scenes, the shared state and picking in `e4_explore.js`; their headset twins in `e6_panels.js`; explore's start and the links (`#soil&explore&tab=network&mod=3&rho=0.7`, `&split=line`, `&kind=215`, `&plot=1`, `&shuffle`) in `e7_app.js` |
| `SPEC.md` | what the data, the sets and the engine must do (with the owner's decisions); read with `tools/lbi/SPEC.md` |
| `build.mjs` | the assembler |
| `harness.html`, `shot.mjs`, `sweep.mjs` | one set alone (`cam=` a view by name or six numbers; `&with=<set>` adds a second set; the data, its decoders, both looks and the globe always loaded), its screenshots, and screenshots of the whole story (`SHOTS=<dir>` and `PORT=<port>` for both tools) |

What is real, read off and illustrative: the field measures, the microbes and the network are the trial's data; the day-70
chlorophyll, the N2O incubation curves and the qPCR counts are read off the slides (approximate); the soil block, the
flows, the relay, the chromosome, the field's plot layout and the Nitrogen sketch are illustrative, and the story says
so. The co-occurrence network was built for this story with a standard method (CLR, Spearman, |rho| at least 0.6, q
under 0.05, Louvain): correlation, not interaction.

The data's verdict, for the story's message: in the slides' measurements the BNI wheat stays greener and leaks less
nitrate and N2O; the soil's microbes and their network follow the fertiliser and the field plots, not the wheat line (2
of 3,384 common kinds differ by line; the two lines' own networks, 38,653 and 30,276 links, differ less than some random
halves do, 158 to 27,758); rising together is not working together; strong indications, not yet proof. The metadata's
N2O and the slides' N2O disagree (fertilised soil over the season: 0.81 against 0.98, p = 0.58, against up to about
3-fold less in the slides' incubations): an open question, said so. The rest of the open questions are in
`SOIL_DATA.open` and `SPEC.md`.

No sequences, no ASV ids, no pictures from the slides, no e-mail addresses. The authors' files stay out of the
repository.
