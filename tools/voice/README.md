# tools/voice: a synthetic narration for a story

`narrate.mjs` reads a story's words from the running app, speaks them with a synthetic voice (Kokoro-82M through
kokoro-onnx; German with Piper) and fits the story to the recording: it writes the story's `NARRATION_SYNC` and
`NARRATION_ENDS` and `audio/narration-<key>.mp3`. Every story but the airports (a human recording) is narrated this way
with the American voice `af_heart`, the owner's choice (29 October 2026, from samples of several voices): the tour
(*The future*, `#lbi`) first, the other fourteen in v108 (3 November 2026). A story in two languages (the pass story, *Pass it on* / *Weitersagen!*) gets one
recording per language on one timeline: English with Kokoro's `af_heart`, German with Piper's Thorsten voice
(`de_DE-thorsten-high`; the owner: "piper thorsten for the german part sounds great"), since Kokoro has no German.

Nothing here goes into the app except the MP3s and the two tables: the models, the Python environment and the spoken
lines (WAV files) stay outside the repository.

## Setup (once)

1. A Python 3.10 or newer with kokoro-onnx, piper-tts and soundfile, in a virtual environment outside the repository:

   ```sh
   python3 -m venv ~/kokoro/venv
   ~/kokoro/venv/bin/pip install kokoro-onnx piper-tts soundfile
   ```

   kokoro-onnx brings onnxruntime, phonemizer and espeak-ng (as `espeakng-loader`), which turns the text into phonemes.
   piper-tts (tried with 1.8.0) brings its own copy of espeak-ng for the same job. Only the stories in two languages
   need piper-tts.

2. The model files, Kokoro-82M v1.0 as ONNX and its voices, into a folder outside the repository: `kokoro-v1.0.onnx`
   (325 MB) and `voices-v1.0.bin` (28 MB) from kokoro-onnx's release *model-files-v1.0*
   (<https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0>); the model itself is
   <https://huggingface.co/hexgrad/Kokoro-82M>.

   ```sh
   cd ~/kokoro
   curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
   curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
   ```

3. For German, Piper's Thorsten voice (high quality, 114 MB) and its settings, from Piper's voices on Hugging Face
   (<https://huggingface.co/rhasspy/piper-voices/tree/main/de/de_DE/thorsten/high>), into a folder outside the
   repository (the same one is fine):

   ```sh
   cd ~/kokoro
   curl -LO https://huggingface.co/rhasspy/piper-voices/resolve/main/de/de_DE/thorsten/high/de_DE-thorsten-high.onnx
   curl -LO https://huggingface.co/rhasspy/piper-voices/resolve/main/de/de_DE/thorsten/high/de_DE-thorsten-high.onnx.json
   ```

4. ffmpeg (with libmp3lame) and Playwright with Chromium, as for the smoke test.

Tell the tools where things are with environment variables:

```sh
export VOICE_PYTHON=~/kokoro/venv/bin/python   # the Python with kokoro-onnx and piper-tts (default: python3)
export KOKORO_DIR=~/kokoro                     # holds kokoro-v1.0.onnx and voices-v1.0.bin
export PIPER_DIR=~/kokoro                      # holds de_DE-thorsten-high.onnx and its .onnx.json (default: KOKORO_DIR)
export VOICE_CACHE=~/kokoro/cache              # the spoken lines, both voices' (default: $KOKORO_DIR/cache)
```

(`KOKORO_MODEL` and `KOKORO_VOICES` name Kokoro's two files directly, and `PIPER_MODEL` Piper's `.onnx`, if they are
called something else or live elsewhere.)

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

`node tools/voice/check.mjs <key>` (about five minutes; `--quick` three slideshow stops instead of all) checks the
story in headless Chromium with the recording the page decodes: every line's words start 0.3 s after its cue and
nothing else is spoken, each chapter starts with its heading and its words end where `NARRATION_ENDS` says, before its
slideshow stop; the clock follows the sound; a jump to a line lands the sound there; the slideshow waits at every
chapter's end with the voice finished, and Next goes on in step. How it sounds can only be heard.

**After a story's text changes**, run it again: only the lines whose words changed are spoken again (each line is cached
by a hash of what is said, the engine's voice, the speed and the language), the timeline is laid out afresh, and the
tables and the MP3s are replaced. `tools/pace.mjs` leaves a story with an MP3 alone, so this is how a narrated story is
re-timed. The airports story keeps its human recording: the script refuses to replace it (`--dry --out` still tries a
voice on it).

## A story in two languages

A story that lists its languages (`LANGS`) and switches with `setLang(l, false)` (the pass story) is read in each, as
`tools/narration.mjs` reads it, spoken in each and laid out on **one** timeline, so the story's clock, its slideshow
stops and a shared room's station clock are the same in either language:

```sh
node tools/voice/narrate.mjs pass --phonemes             # both languages (--only de for one)
node tools/voice/narrate.mjs pass                        # audio/narration-pass.mp3, audio/narration-pass-de.mp3, the tables
node tools/voice/check.mjs pass --quick                  # English (the page's language in headless Chromium)
node tools/voice/check.mjs pass --quick --lang de        # German
```

- Each language has its voice: English Kokoro's `af_heart` (the first language takes `--voice`, `--speed` and
  `--lang` as above), German Piper's `de_DE-thorsten-high`. `--de-voice NAME` picks another Piper voice (a name looked
  up in `PIPER_DIR`, or a path to its `.onnx`), `--de-speed 1.1` speaks faster, and `--de-engine kokoro --de-voice ...
  --de-lang ...` would use Kokoro instead (`--en-voice` and so on work as well).
- The story is cut into stretches at every spoken line in either language. Each stretch lasts the longest of 1.1 times
  its story time, the English line plus its pause and the German line plus its pause. Where one language reads two
  cues as one line and the other as two (the English title runs on into the lower-case subtitle; the German title ends
  with an exclamation mark), that line spans both stretches and only needs the two together to be long enough.
- `NARRATION_ENDS` is where each chapter's words end in the later of the two, so a slideshow stop waits for either.
- Each language gets its own recording, levelled on its own, both as long as the later one needs: the first language's
  is `audio/narration-<key>.mp3`, another's `audio/narration-<key>-<lang>.mp3`. The story plays the one of the language
  on show and changes it in place when the language is switched (`audioLang` in `tools/pass/engine/e7_app.js`); a
  missing file leaves that language silent, as before.

## What is read

- Each chapter's lines, as `tools/narration.mjs` lists them: the text under each `data-at` cue, at its story time. The
  chapter's heading (its `h2`, or the title's `h1`) is read as a short announcement, with a longer pause after it.
- A line that carries on the one before (it starts in lower case, the one before has no full stop) is read with it:
  *A glimpse into the future* / *of network medicine* is one sentence.
- A figure and its caption (`<b>23</b><small>chromosomes</small>`) read as one phrase; a bold name and its text
  (`<b>Shape</b>A city's layout ...`) with a colon between. A line without an end gets a full stop, or a comma when it
  runs on into a figure or ends on a word like *to* (in German, *und*, *zu*, *der* and the like).
- Left out: small print (`.credits`: the credits and citations under each chapter, and the closing *Thank you* with
  the web addresses) and buttons (*Explore the scenes*). `--lines` lists what is left out.

## How it is said: `say.json`

The panels keep their text (British spelling, as everywhere but the qubits and ovary stories); `say.json` only changes
what is spoken. `units` after a number (`511 keV` -> *511 kilo electron volts*: Kokoro said *kee vee*), `words` as whole
words (abbreviations that read badly: `ATP` -> `A-T-P`, since *A T P* came out as *uh T P*; `PET` -> *pet*; names
respelt: `Menche` -> *Mensha*), `symbols` anywhere (`%`, `×`, `≈`, `±`, `<`, `>`, `=`, Greek letters) and `patterns`
(regular expressions: `5–10` -> *5 to 10*, `In 2021` -> *In twenty 21*, so years read the American way). A story's own
entries (`stories.<key>`) come first. Kokoro reads most numbers with thousands separators, `%` and most words well, but
not all (`3,214 airports,` came out as *three, two hundred fourteen*: the pass story's English entries drop the
separator); check every line with `--phonemes` for capitals, digits, symbols and units, since nobody may be able to
listen where this runs. espeak-ng's phonemes are IPA: `ˈeɪtˈiːpˈiː` is *A-T-P*, `ɐ` an unstressed *a* (the article).

The top of `say.json` (`global`, `stories`) is English. Another language's rules have a section of their own (`de`,
with its own `global` and `stories`), so English rules never touch German text and the other way round. espeak-ng's
German reads German numbers (`3.214`, `0,5`, years) well; the German entries respell what it gets wrong (`Nachbar` ->
`Nachbaar`, *Nachbar* with a short *a*; `Zellkern` -> `Zell-Kern`; units such as `MHz` -> `Mega-Hertz`), read
brackets as commas (a pause, as a reader would) and, where no spelling makes espeak-ng stress a word right, give
Piper its phonemes in `[[...]]` (espeak-ng's German IPA, as `--phonemes` prints it: `Mukoviszidose` ->
`[[mˌuːkoːvɪstsiːdˈoːzə]]`, `Human Protein Atlas` in English sounds). Only Piper reads `[[...]]`. For Piper,
`--phonemes` shows a word espeak-ng takes for another language with its switch (`(en)flˈaɪts(de)`: Piper says it with
those phonemes) and marks a phoneme the voice does not know with `?` (Piper leaves it out).

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

The recording is the lines placed on that timeline (24 kHz from Kokoro, 22.05 kHz from Piper), levelled to -16 LUFS
with peaks under -2.5 dB (ffmpeg's loudnorm, two passes), as a mono 44.1 kHz MP3 at 64 kbps, padded with silence to
1.1 s before the story ends (a longer file would stretch the story's timeline). The script checks the words' ends
against the recording itself (silencedetect) and that no line runs into the next.

Piper speaks a line sentence by sentence (`piper.py`): the sentences are joined with 0.25 s of quiet (about the pause
Kokoro leaves between two sentences of a line), and the quiet Piper leaves before a line (up to a quarter of a second)
is trimmed to 20 ms, as Kokoro's lines start, so the words start where the layout puts them. Piper's lines are cached
by a hash of `piper`, the voice, the speed, the language (the voice's espeak-ng language), that pause and the text.

## Licences

Kokoro-82M (hexgrad), the model and its voices, is Apache-2.0; kokoro-onnx, which runs it, is MIT. The recordings
it makes are ours to use; the story's credits say the narration is a synthetic voice (Kokoro). espeak-ng and
phonemizer (GPL-3) only run here, offline, to make the phonemes: nothing of them goes into the app, and neither do the
model or these tools.

Piper (piper-tts, GPL-3.0-or-later since its 1.3 release, with its own copy of espeak-ng) likewise only runs here,
offline: nothing of it goes into the app. The Thorsten voice's model card
(<https://huggingface.co/rhasspy/piper-voices/blob/main/de/de_DE/thorsten/high/MODEL_CARD>) says: dataset Thorsten-Voice
(<https://github.com/thorstenMueller/Thorsten-Voice>), licence CC0; training: finetuned from the U.S. English lessac
voice (high quality). Piper's voices repository is marked MIT. The lessac voice's own model card gives its dataset's
licence as the Blizzard 2013 Lessac data's
(<https://www.cstr.ed.ac.uk/projects/blizzard/2013/lessac_blizzard2013/license.html>), a research licence (research
purposes only, no commercial use). Whether that reaches a German voice finetuned from it is not settled; the app is
non-commercial outreach. The owner decides (`docs/data-and-permissions.md`). A story narrated with it should say in its
credits that the German narration is a synthetic voice (Piper, Thorsten). See `docs/data-and-permissions.md`.
