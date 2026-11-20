# Licences and credits

Networks is made of the project's own code, the project's own words, sounds and pictures, data from other people's
work, and a few parts written by others. Each keeps its own terms, as below. The full record, story by story, is
[docs/data-and-permissions.md](docs/data-and-permissions.md).

## The project's code: MIT

Everything written for this project is under the MIT licence in [LICENSE](LICENSE) (Copyright (c) 2026 Martin
Chiettini): the app (`index.html`, the scripts beside it, `stories/`, `packages/`), its tools (`tools/`), the relay
(`relay/`) and the files built from them. Not covered: the data in those files (below) and the third-party parts
(below).

## Words, narrations, documentation and icons: CC BY 4.0

The stories' words (their narration scripts, captions and panels, in English and, for the pass story, German), the
synthetic narrations in `audio/` (`narration-<story>.mp3`), the documentation (`docs/`, the READMEs, `HANDOVER.md`) and
the app's icons (`icons/`) are under the Creative Commons Attribution 4.0 International licence
(https://creativecommons.org/licenses/by/4.0/). Credit them as "Networks, by Martin Chiettini".

Not covered: the airports story's recorded narration, `audio/narration.mp3`, a person's own voice: all rights stay with
its speaker until they agree to a licence.

## Data: its sources' own terms

The data in the stories is not relicensed by this project. Each keeps its source's terms:

| Data | Where | Terms |
| --- | --- | --- |
| OpenFlights airports and routes (2014) | `stories/airports.js`; reused in `stories/lbi.js` and `stories/pass.js` | Open Database License (ODbL): credit OpenFlights; the routes as used here are offered under the ODbL too |
| Natural Earth coastlines | `stories/airports.js`, `stories/pass.js` | public domain |
| Geist et al., Med 2025 (the PET story) | `tools/pet/`, `stories/pet.js` | CC BY 4.0: credit the authors |
| Buljan, Bago-Horvath, Rendeiro, bioRxiv 2025 (the microanatomy story) | `tools/micro/`, `stories/micro.js` | CC BY-NC: credit the authors; no commercial use |
| HistoPLUS cells on GTEx slides (the tissue topology story) | `tools/topo/`, `stories/topo.js` | CC BY 4.0: credit the authors |
| Protein locations and interactions (the proteins and cell map stories, the pass story's cell) | `stories/proteins.js`, `stories/spatial.js`, `stories/pass.js` | curated by hand from the literature, the Human Protein Atlas and UniProt; see their terms |
| The authors' own data, figures and posters (the muscle, endotype, PET, microanatomy, ovary, qubits, mutation, tissue topology and soil stories and the tour) | `tools/<story>/`, `stories/<story>.js` | no licence: shown with the authors' permission, not for reuse; ask the authors |

The authors' source files are not in the repository, only numbers derived from them.

## Parts written by others: their own licences

| Part | Where | Licence |
| --- | --- | --- |
| three.js r128 | `three.min.js` | MIT, [three.LICENSE.txt](three.LICENSE.txt) |
| three.js r128's loaders and exporter | `tools/studio/vendor/`, pasted into `stories/studio.js` | MIT, as three.js |
| PeerJS 1.5.5 | `peerjs.min.js` | MIT, [PEERJS-LICENSE.txt](PEERJS-LICENSE.txt) |
| meshoptimizer 1.3.0 (its simplifier) | `tools/studio/vendor/`, pasted into `stories/studio.js` | MIT |
| fflate | `tools/studio/vendor/`, pasted into `stories/studio.js` | MIT |
| Basis Universal (KTX2 encoder and transcoder) | `basis/` | Apache License 2.0, [basis/LICENSE.txt](basis/LICENSE.txt) |
| The B612 font | loaded from Google Fonts | SIL Open Font License |
| Kokoro-82M v1.0 (hexgrad), voice `af_heart` | made the English synthetic narrations (not shipped) | Apache License 2.0; the recordings it made are the project's (CC BY 4.0, above) |
| Piper's German voice Thorsten (`de_DE-thorsten-high`) | made the pass story's German narration (not shipped) | its data CC0 (Thorsten-Voice); fine-tuned from Piper's English lessac voice, whose data is under a research licence: see docs/data-and-permissions.md |
| EndotypY | used offline to make the endotype story's data (not shipped) | MIT |
| topocyte | run offline to make the tissue topology story's numbers (not shipped) | GPL-3.0 |
