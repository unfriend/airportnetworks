# tools/voice: a synthetic narration for a story

`narrate.mjs` reads a story's words from the running app, speaks them with a synthetic voice (Kokoro-82M through
kokoro-onnx) and fits the story to the recording: it writes the story's `NARRATION_SYNC` and `NARRATION_ENDS` and
`audio/narration-<key>.mp3`. The tour (*The future*, `#lbi`) was narrated this way with the American voice `af_heart`,
the owner's choice (29 October 2026, from samples of several voices). The other stories can follow with the same command.

Nothing here goes into the app except the MP3 and the two tables: the model, the Python environment and the spoken
lines (WAV files) stay outside the repository.

## Setup (once)

1. A Python 3.10 or newer with kokoro-onnx and soundfile, in a virtual environment outside the repository:

   ```sh
   python3 -m venv ~/kokoro/venv
   ~/kokoro/venv/bin/pip install kokoro-onnx soundfile
   ```

   kokoro-onnx brings onnxruntime, phonemizer and espeak-ng (as `espeakng-loader`), which turns the text into phonemes.

2. The model files, Kokoro-82M v1.0 as ONNX and its voices, into a folder outside the repository: `kokoro-v1.0.onnx`
   (325 MB) and `voices-v1.0.bin` (28 MB) from kokoro-onnx's release *model-files-v1.0*
   (<https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0>); the model itself is
   <https://huggingface.co/hexgrad/Kokoro-82M>.

   ```sh
   cd ~/kokoro
   curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
   curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
   ```

3. ffmpeg (with libmp3lame) and Playwright with Chromium, as for the smoke test.

Tell the tools where things are with environment variables:

```sh
export VOICE_PYTHON=~/kokoro/venv/bin/python   # the Python with kokoro-onnx (default: python3)
export KOKORO_DIR=~/kokoro                     # holds kokoro-v1.0.onnx and voices-v1.0.bin
export VOICE_CACHE=~/kokoro/cache              # the spoken lines (default: $KOKORO_DIR/cache)
```

(`KOKORO_MODEL` and `KOKORO_VOICES` name the two files directly, if they are called something else.)

## Narrating a story

Serve the folder (`python3 -m http.server 8123`), then:

```sh
node tools/voice/narrate.mjs lbi --lines        # what will be read, what is left out, and how it is said
node tools/voice/narrate.mjs lbi --phonemes     # the same with espeak-ng's phonemes: check every doubtful word
node tools/voice/narrate.mjs lbi --dry --out /tmp/try.mp3   # speak and lay out, write nothing into the app
node tools/voice/narrate.mjs lbi                # write audio/narration-lbi.mp3 and the tables, rebuild the story
```

Options: `--voice af_heart` (any Kokoro voice: `af_*` and `am_*` American, `bf_*` and `bm_*` British), `--speed 1`,
`--lang en-us`, `--skip .credits` (what is small print), a base address other than `http://127.0.0.1:8123/`.

Then, as after any change to a story's timing: `len` in `stories/list.js`, the chapter times in
`audio/PUT-narration.mp3-HERE.txt`, `VERSION` in `sw.js`, `node tools/smoke.mjs` and `node tools/audio.mjs`, and
`node tools/narration.mjs` (it rewrites `docs/narration.md` with the new times). The script prints the new length.

**After a story's text changes**, run it again: only the lines whose words changed are spoken again (each line is cached
by a hash of what is said, the voice, the speed and the language), the timeline is laid out afresh, and the tables and
the MP3 are replaced. `tools/pace.mjs` leaves a story with an MP3 alone, so this is how a narrated story is re-timed.
The airports story keeps its human recording: the script refuses to replace it (`--dry --out` still tries a voice on it).

## What is read

- Each chapter's lines, as `tools/narration.mjs` lists them: the text under each `data-at` cue, at its story time. The
  chapter's heading (its `h2`, or the title's `h1`) is read as a short announcement, with a longer pause after it.
- A line that carries on the one before (it starts in lower case, the one before has no full stop) is read with it:
  *A glimpse into the future* / *of network medicine* is one sentence.
- A figure and its caption (`<b>23</b><small>chromosomes</small>`) read as one phrase; a bold name and its text
  (`<b>Shape</b>A city's layout ...`) with a colon between. A line without an end gets a full stop, or a comma when it
  runs on into a figure or ends on a word like *to*.
- Left out: small print (`.credits`: the credits and citations under each chapter, and the closing *Thank you* with
  the web addresses) and buttons (*Explore the scenes*). `--lines` lists what is left out.

## How it is said: `say.json`

The panels keep their text (British spelling, as everywhere but the qubits and ovary stories); `say.json` only changes
what is spoken. `units` after a number (`511 keV` -> *511 kilo electron volts*: Kokoro said *kee vee*), `words` as whole
words (abbreviations that read badly: `ATP` -> `A-T-P`, since *A T P* came out as *uh T P*; `PET` -> *pet*; names
respelt: `Menche` -> *Mensha*), `symbols` anywhere (`%`, `×`, `≈`, `±`, `<`, `>`, `=`, Greek letters) and `patterns`
(regular expressions: `5–10` -> *5 to 10*, `In 2021` -> *In twenty 21*, so years read the American way). A story's own
entries (`stories.<key>`) come first. Kokoro reads numbers with thousands separators, `%` and most words well; check
every line with `--phonemes` for capitals, digits, symbols and units, since nobody may be able to listen where this
runs. espeak-ng's phonemes are IPA: `ˈeɪtˈiːpˈiː` is *A-T-P*, `ɐ` an unstressed *a* (the article).

## The timing

The story's animation stays in story time (`CH`, `data-at`, the tracks); `NARRATION_SYNC` maps the recording's clock to
it, and here it is built from the audio:

- the story is cut into stretches at every spoken line and at each chapter's start and end (cues without words, such as
  a figure appearing, are stretched with the line before them);
- a stretch lasts in the recording the longer of 1.1 times its story time (as `tools/pace.mjs`, so no animation is
  rushed) and 0.3 s + its line's audio + a pause (0.5 s; 1 s after a heading). Its line starts 0.3 s after its cue, as
  its text fades in, and a stretch slowed a lot runs its first 0.6 s at the light pace, so the text is there at once;
- a chapter's last line also leaves room for the slideshow: its words end at least 0.25 s before the chapter's stop
  (`narrT(b - 0.7)`), and the last 0.7 s of story time before the chapter's end run at the light pace. So a stop never
  cuts a line; `NARRATION_ENDS` (where each chapter's words end, to 0.05 s) lets the voice finish there anyway, as the
  airports' recording needs.

The recording is the lines placed on that timeline (24 kHz from Kokoro), levelled to -16 LUFS (ffmpeg's loudnorm, two
passes), as a mono 44.1 kHz MP3 at 64 kbps, padded with silence to the end of the story. The script checks the words'
ends against the recording itself (silencedetect) and that no line runs into the next.

## Licences

Kokoro-82M (hexgrad), the model and its voices, is Apache-2.0; kokoro-onnx, which runs it, is MIT. The recordings
it makes are ours to use; the story's credits say the narration is a synthetic voice (Kokoro). espeak-ng and
phonemizer (GPL-3) only run here, offline, to make the phonemes: nothing of them goes into the app, and neither do the
model or these tools. See `docs/data-and-permissions.md`.
