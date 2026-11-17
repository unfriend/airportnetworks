# Dub techno for the room (a Cardinal patch)

`dub-techno.vcv` is a patch for [Cardinal](https://cardinal.kx.studio/) (the free modular synth, VCV Rack's modules as
an app and as a plugin) that plays a mellow dub techno groove at 120 bpm by itself and lets the room play it through the
output page (`tools/output/README.md`): the faders, the turntable, the orb, the dance floor, the dub wand, the pads and
the drop zone send MIDI on channel 1, and the patch turns them into its filter, echo, reverb, hats and stabs.

It is generated: edit `make.mjs`, then run `node tools/output/cardinal/make.mjs` (and `--check` to see whether the file
is current; add `--src <a clone of github.com/DISTRHO/Cardinal>` to check every module, version and id against Cardinal's
own sources, below). Never edit the `.vcv` by hand.

## What it plays

- **Kick**: four to the floor (Befaco Kickall, about 49 Hz, short pitch drop).
- **Hats**: on the off-beats (white noise high-passed at about 7 kHz, 20 ms).
- **Chord stab**: C minor 9 without its fifth (C, E flat, B flat, D: the classic dub chord), four saws, a low-pass filter
  with a little resonance, on the "and" of beats 2 and 4, a short envelope.
- **Dub delay**: a dotted eighth (375 ms) with its filters in the feedback path set dark, fed by a quarter of the stab,
  the rim and the siren.
- **Reverb**: Valley's Plateau, long and dark, the kick kept out of its tail (its input low cut at about 250 Hz).
- **Extras on notes**: an extra stab, a rim (resonant noise) and a dub siren (a triangle swept by an LFO, rising an
  octave, mostly into the echo).

Everything at its default (every controller at 0, nothing pressed) is a pleasant setting: the controllers only open,
lengthen or add. The modules are all bundled with Cardinal: Fundamental (VCV), Befaco, Valley and Cardinal's own Host
modules.

## The map (MIDI channel 1)

| MIDI | Name | What it does in the patch | At 0 | At 127 | In the room |
| --- | --- | --- | --- | --- | --- |
| CC 20 | Filter | the stab's low-pass cutoff | about 350 Hz (dark) | about 4 kHz (open) | fader A: a slim box sliding along a 1 m rail (its x) |
| CC 21 | Echo feedback | the delay's feedback | 0.42 (three or four repeats) | 0.84 (long dub tails, never runaway) | fader B: a second rail |
| CC 22 | Space | Plateau's wet level and size | wet 0.18, size 0.55 | wet 0.43, size 0.85 | the turntable disc's yaw (-180 to 180) |
| CC 23 | Stab decay | the stab envelope's decay and release | 63 ms and 100 ms (a short stab) | 0.6 s and 1 s (a pad) | the orb's height (0.8 to 2.0 m) |
| CC 24 | Hats | the hats' level | a third | all of it | how many people stand on the dance floor cube (0 to 3) |
| CC 25 | Throw | how much stab goes into the echo | a quarter | all of it | the dub wand's speed while carried (0 to 2.5 m/s) |
| CC 26 | Wobble | how far a 2-bar sine moves the cutoff | none | about 1.1 octave each way | the beat-locked orbiting sphere's x (-0.6 to 0.6) |
| Note 48 | Stab | one extra chord stab | | | pad A |
| Note 38 | Rim | a rim hit | | | pad B |
| Note 51 | Siren | a dub siren, mostly into the echo | | | pad C, and the wand's threshold (speed past 0.7) |
| Note 36, held | Kick off | the kick is silent while the note is held (a breakdown) | | | the drop zone cube: walk in, the kick drops out; walk out, it is back |
| Start | | bar 1 starts now: the clock, the sequencer and the wobble restart on the same sample | | | the output page's Tempo Start (MIDI clock out on) |
| Stop | | no new notes (the echo and the reverb ring out); Start plays again | | | the output page's Stop |

Velocities are ignored (a pad or the wand at any velocity plays the same). Notes and CCs on other channels are ignored;
Start and Stop come on any channel.

**Starting positions in the room**: the demo scene's own (`examples/dub-techno`, `tools/studio/dub/README.md`) are
fine: Filter a little over half open, Echo moderate, Space in the middle, the orb at 1.2 m; the patch sounds right at
every CC value, and every CC at 0 is a quiet, dark setting. The patch keeps the last CC values it heard when saved, so a
saved copy starts where you left it; the generated one starts at 0.

**Stop and Start**: MIDI Stop advances an 8-step transport switch in the patch, so several Stops in a row can wrap round
and set it playing again; press Start (the output page's Tempo) to put it back to bar 1, playing.

### The tempo and the clock

**Cardinal does not follow MIDI clock ticks.** Its Host MIDI module (and Rack's Core MIDI modules, which Cardinal
replaces with its Host ones) gives no clock pulses in Cardinal; its own docs say to use Host Time, which follows a DAW's
transport, not incoming MIDI clock. It does give **Start** and **Stop** triggers from MIDI Start (0xFA) and Stop (0xFC).
So:

- The patch has its own clock at exactly 120 bpm (an LFO at 8 Hz, sixteenths) and plays from the moment it is loaded.
- The output page's **Start** (on the Tempo part, with *MIDI clock out* on, at 120 bpm, 4 beats a bar) resets that
  clock, the sequencer and the wobble LFO at the room's downbeat, so bar 1 of the patch is bar 1 of the room. Press
  Start again whenever they seem to have drifted (two clocks at 120 bpm drift by a few milliseconds a minute).
- **Stop** stops new notes; the tails ring out. Start again.
- Another tempo in the room: the patch stays at 120 bpm. To change the patch's tempo, set its two LFOs on the clock row
  (FREQ_PARAM is log2 of Hz: 3 is 8 Hz, sixteenths at 120 bpm) or edit `make.mjs`.
- No MIDI at all: it simply plays. If it seems to wait, it was stopped by a MIDI Stop: press the output page's Start, or
  the RESET button on the transport sequencer (the left SEQ-3 on the second row).

## Setting it up

1. **Cardinal**: install it from https://cardinal.kx.studio/ (Windows, macOS, Linux; free). Either:
   - **the standalone app** (*Cardinal*): File, Open, `dub-techno.vcv`. Pick the audio device in its Engine menu.
     MIDI: the standalone takes the system's MIDI through its own backend: on Windows and macOS its Engine menu's
     *Enable/Reconnect MIDI* (it opens every MIDI input there is at that moment, IAC and loopMIDI included, with no port
     to pick: click it again after a port appears; the item shows only with the system's own audio, not JACK); on Linux with JACK, connect the virtual port to Cardinal's MIDI
     input in your JACK patchbay (a2jmidid bridges ALSA ports into JACK).
   - **as a plugin** in a DAW or a host such as Carla or Reaper (*Cardinal* or *Cardinal Synth*, VST3, CLAP, LV2, AU):
     load it on an instrument track, open its window, File, Open, `dub-techno.vcv`, and route the virtual MIDI port into
     that track (record-armed or monitored). A DAW's transport starting from 0 also fires the patch's Start.
2. **A virtual MIDI port** between the output page and Cardinal (as for the output page):
   - Windows: **loopMIDI** (Tobias Erichsen): add a port, e.g. *loopMIDI Port*.
   - macOS: Audio MIDI Setup, Window, Show MIDI Studio, **IAC Driver**: tick *Device is online*.
   - Linux: **ALSA**: `sudo modprobe snd-virmidi` (virtual ports), or a2jmidid for JACK.
3. **The output page** (Chrome or Edge, on the same computer): *MIDI* on, its output port the virtual port; the room's
   items and pads mapped as in the table above (channel 1); on the Tempo part 120 bpm, 4 beats a bar, *MIDI clock out*
   on, then **Start**.
4. Check it: the output page's *Test note* sends a note: map it to 48 and a stab plays. Move fader A: the stab opens.

The patch's own note (the text panel on its first row) repeats the map.

## How the patch is built (for changing it)

Four rows (`make.mjs` comments each part):

1. MIDI in (Host MIDI for Start and Stop, Host MIDI CC with cells for CC 20 to 26, Host MIDI Gate with cells for notes
   48, 38, 51 and 36, all on channel 1 and CCs smoothed), a Dual Atenuverter (10 V less the note 36 gate for the kick's
   volume; the siren's envelope over 10 for its rise) and Audio 2 out.
2. The clock (an LFO's 8 Hz square through a VCA that the transport opens), the transport (a SEQ-3 whose step 1 means
   playing: Start resets it there, each Stop steps it on), the groove's SEQ-3 (8 sixteenths: kick on steps 1 and 5, hats
   on 3 and 7 from its CV row 1, the stab on step 7), the kick and the hats (a VC mixer whose CV is CC 24).
3. The chord: four VCOs, a VC mixer, the cutoff's CV (a VC mixer adding CC 20, the wobble LFO times CC 26 and the stab's
   own envelope), the VCF, the stab's envelope (an extra stab from note 48 summed in) and its VCA.
4. The rim, the siren, the echo send (a VC mixer: the stab with CC 25, the siren, the rim), the delay, the mix and the
   reverb (Plateau, CC 22 on its wet and size CV).

`make.mjs --check --src <Cardinal clone>` reads, for every module used, its plugin's `plugin.json` (slug, version, the
module's slug), `plugins/plugins.cpp` (that Cardinal adds it), its `createModel("...")` and its enums (every param, input
and output id in order, `ENUMS(...)` expanded), checks each param value against its `configParam` range (a few whose
range is a named constant are listed and were checked by hand), that every cable names an existing port, that no input
has two cables and that no modules overlap. The clone needs the submodules used here: `git submodule update --init
--depth 1 plugins/Fundamental plugins/Befaco plugins/ValleyAudio` (the Cardinal tree checked in v158: commit
`0a530b7`, Fundamental 2.1.0, Befaco 2.9.0, Valley 2.4.5).

## Tested, and not

- `make.mjs --check --src`: 39 modules, 63 cables, 130 param values, every id against Cardinal's sources at `0a530b7`.
- Cardinal's web build (cardinal.kx.studio/live, 26.02, in headless Chromium, the patch given as its `?patch=`
  parameter): every module was created with no warning or error in its log, and it played: about 0.35 peak and 0.05 RMS
  with every CC at 0, 0.72 peak and 0.15 RMS with every CC at 127 (the saved CC values set to 127), no clipping, its
  loudness repeating every half second (120 bpm). Nobody has listened to it.
- Untested: how it sounds; MIDI into Cardinal from a real virtual port (loopMIDI, IAC, ALSA) and the output page, the
  notes, the held kick mute, Start and Stop from the output page, the standalone app's MIDI on each system, the plugin in
  a DAW, the drift against the room's clock over a long set, and the starting positions in a real room.
