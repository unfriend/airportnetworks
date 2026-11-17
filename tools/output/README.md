# The output page: MIDI and OSC from the room

A page of the app on a laptop or the room's PC that sends what happens in a shared room's studio scene as MIDI and OSC to
music and light software on that computer (Cardinal, a DAW, TouchDesigner, Max, Pd, a lighting desk), and takes MIDI and
OSC back in as the room's actions. The plan and the contracts between its parts are `SPEC.md` in this folder; the page is
`output.js`; the shell's part of it is "the output page" in `shared.js`; the relay's is "OSC and the output page" in
`relay/README.md`.

## What goes where

```
headsets in the room ──(the room, as ever)──> the relay ──> the output page (Chrome or Edge, this computer)
                                                               ├─ MIDI out/in: Web MIDI ── a virtual port ── Cardinal, a DAW
                                                               └─ OSC: its room socket ── the relay ── UDP ── your OSC apps
the PC's Vive trackers ── the relay ── OSC (UDP), sent by the relay itself at the trackers' own rate
```

- MIDI never leaves the computer the output page runs on: the browser talks to a MIDI port there.
- OSC goes from the page to the relay over the room's socket, and the relay sends UDP only to the targets on its own
  command line (`--osc-out`). OSC coming in arrives at the relay's UDP port (`--osc-in`) and is handed to the output
  pages. No OSC in a peer-to-peer room or a room on one device (MIDI still works there).

## Setting it up

1. **A relay on the same machine or network** (the room must run on it), started with OSC:

   ```
   node relay/server.mjs --lan --trackers --osc-out 127.0.0.1:9000 --osc-in 9001
   ```

   `--osc-out host:port` (repeatable, or comma separated, at most 8) is where the relay sends OSC; `--osc-in port` (or
   `addr:port`) is where it listens for OSC: on this machine only unless an address is given (`0.0.0.0:9001` for OSC
   from the LAN; UDP has no password). `--trackers` also sends the PC's Vive trackers as OSC once the output page
   asks (*Trackers as OSC*). With `--public`, these flags need the relay's password. See `relay/README.md`.
2. **A virtual MIDI port** for the software that should hear (or send) MIDI:
   - Windows: loopMIDI (Tobias Erichsen): add a port, e.g. *loopMIDI Port*.
   - macOS: Audio MIDI Setup, Window, Show MIDI Studio, the *IAC Driver*: tick *Device is online*.
   - Linux: `sudo modprobe snd-virmidi` (ALSA's virtual ports), or a2jmidid to bridge ALSA and JACK.
   - Cardinal: its *MIDI to CV* and *CV to MIDI* modules (Core) listen to and send on the port picked in its settings;
     a cube's held note gives a gate as long as someone stands in it. Cardinal has no OSC.
3. **The output page**: on that computer, in Chrome or Edge, open the room (the relay's address, or a link to the room)
   and press *Output page (MIDI and OSC)* in the Shared dialog, or open the room's link with `&output` added
   (`.../#s=ABC&output`). It follows the room's studio circle (pick another under *Follows*). Turn *MIDI* on (the browser
   asks once), pick the output and input ports, press *Test note*; turn *OSC* on.
4. **Keep its tab in front**, on its own screen or window: a hidden tab stops the scene's frames, so cubes for everyone,
   presses, sequences and items wait until it is shown again.

## What it sends

- **The scene's sends** (set on the studio's cards: a cube's *Sends to the output page*, an object's or shape's *Sends*
  under *When pressed* and *While pointed at*, a sequence's *Sends*). A cube sends nothing until it is opted in on its card.
  Each send entry gives one OSC message (its own address, or the default) and, with a note or a controller, one MIDI
  message. What a cube shows, hides or starts for a person is never sent: only that they walked in or out, with their name,
  colour and member id.
- **Every press and sequence on the default addresses** (a switch): presses and sequence starts and stops without send
  entries too, as OSC.
- **People as OSC**: each person in a headset's head and hands (slots 1 to 16), 15 a second at most.
- **Items as OSC**: each item's pose as it moves.
- **Streams** (this computer's own): a value measured all the time (a head's height, a hand's position, a tracker's or an
  item's place, turn (yaw, pitch, roll), speed, velocity along x, y or z, acceleration or turning speed, the distance
  between two of them), mapped from a range to 0 to 1 (inverted if asked, smoothed), sent as a MIDI controller (or a
  14-bit one: CC 0 to 31 carries the high 7 bits, CC + 32 the low ones), a note as the value crosses a threshold
  (velocity fixed or from the thing's speed; off as it falls 5 % below, or after 2 s), and OSC (`ff`: the value 0 to 1,
  the value as measured; a threshold also `i` 1 or 0 on the address + `/gate`).
- **Streams from the scene** (the scene's own, set on an item's card in the studio: *Streams*): read from the scene
  once a second, shown under *Streams from the scene* with their live values, measured here from where each item is
  drawn every frame (velocity, acceleration, roll and turning speed from its pose with the frame's own time) and from
  the studio's state values (size, shown, its clip's, path's or motion's phase, the nearest person, people inside a
  cube). Their OSC goes to `/studio/item/<id>/<value>` (cubes `/studio/cube/<id>/<value>`) unless they name their own.
  A card's *Try* sweeps one 0 to 1 to 0 over a second.

The address tables (what each address carries, its types and arguments, and the addresses the page always takes) are in
`SPEC.md`, "Wire 4" (OSC) and "Wire 5" (MIDI).

## What it takes

- **OSC**, always while OSC is on: `/studio/press <id or name>`, `/studio/seq/start`, `stop`, `toggle`, `rewind`,
  `/studio/show`, `hide`, `flip`, `clear`, `/studio/beat <bpm> [<beats a bar>]` (each message a beat: send one per beat
  to lock the phase; the bar's phase is kept), `/studio/bar <bpm> [<beats a bar>]` (each message a downbeat: send one per
  bar), `/studio/beat/stop`.
- **Incoming mappings** (this computer's own): a MIDI note, a controller crossing a value, a program change, MIDI start,
  stop or continue, or an OSC message (an argument crossing a value) pressing an item, starting or stopping a sequence,
  showing or hiding an item or switching a cube; *held*: a note's release (or the value going back) does the opposite.
  *Learn* fills a row from the next message.
- **MIDI clock to the room's beat** (off by default): a DAW's MIDI clock sets the room's beat (below).

## The room's beat, both ways

The room has one beat (`bt`: a tempo, beats a bar and the moment of a downbeat), which the studio's motions and loops *On
the beat* follow. One of three things leads it from the output page:

- **MIDI clock in** (*MIDI clock to the room's beat*): 24 clock bytes a beat from the input port set the tempo (the median
  of the last 48 intervals). *Start* marks a downbeat (the next tick is the bar's first), a *Song Position Pointer* sets
  where in the song the next tick is (so the bar's phase follows the DAW's), *Continue* goes on from there, *Stop* takes the
  room's beat away (ticks after Stop change nothing until Start or Continue). *Beats a bar* (1 to 16, 4 by default) says
  how many beats a bar has. Without Start the first tick heard counts as a downbeat.
- **The Tempo part** (the room as master): a tempo, *Beats a bar*, *Tap* (4 taps or more), *Start* (a downbeat at the next
  10 ms) and *Stop*. It is greyed while MIDI clock is coming in and *MIDI clock to the room's beat* is on.
- **OSC**: `/studio/beat` or `/studio/bar` (above).

**MIDI clock out** (off by default) sends the room's beat on the output port, whoever leads it: 24 clock bytes a beat, each
with Web MIDI's timestamp (scheduled 100 ms ahead, so the browser's timers do not jitter them), Song Position (the bar's
start) and Start at a downbeat when the beat appears or another writer moves its downbeat, on at the new rate after a
tempo change, Stop when it goes. The log says *clock out 120.00 bpm* once a second rather than every tick. It needs a
studio circle followed (the room's beat lives in the studio's state). With clock in and clock out both on, use two
different cables: the page warns when the two ports have the same name.

- **With a DAW** (Ableton Live, Bitwig, Reaper, Logic): to lead the room, enable *Sync* / *Clock* output to the virtual
  port the output page reads (e.g. loopMIDI's), send Song Position too, and turn *MIDI clock to the room's beat* on;
  starting the DAW's transport starts the room's beat on a downbeat. To follow the room, enable the DAW's clock *input*
  (*External sync*) from the port the page writes, turn *MIDI clock out* on, and start the beat from the Tempo part.
- **With Cardinal**: to lead the room, its Core *CV to MIDI* module sends clock when a 24 PPQN clock (e.g. from a clock
  module) goes into its *CLK* input, and Start and Stop from its *START* and *STOP* inputs. To follow the room, *MIDI to
  CV* gives the clock on its *CLK* output (set its clock division to 24 PPQN or to the beat you want) with *START*,
  *STOP* and *CONT* as triggers: patch them into a sequencer's clock and reset.

Untested here: all of it with real ports, a real DAW and Cardinal (only a stubbed Web MIDI in headless Chromium, which
checked 24 ticks a beat within 2 ms of their timestamps and Start at a downbeat), how much a DAW's clock jitters over a
virtual port, how far apart the room's beat and a DAW drift over minutes, and whether a DAW honours Song Position from the
page.

## The mapping

Streams, incoming mappings and the page's switches are kept in this browser (localStorage `outMap`). *Export* downloads
them as `output-mapping.json`; *Import* reads one back (a file, or pasted), checks every row and says what it dropped. The
scene's sends belong to the scene (its `layout.json`), not to the mapping.

## Known limits

- A hidden tab stops the scene's frames (keep it in front).
- A person's own cubes switched by their own cubes or presses: the output page sees only the switches everyone shares.
- Presses that are each person's own, and sequences each person plays alone, never reach the output page.
- OSC goes to every target alike; no OSC in peer-to-peer rooms or a room on one device.
- Only one room's trackers go as OSC per relay (the latest output page that asked).
- A note held for a person who leaves ends when they are gone (2 s).
- MIDI clock out and the room's beat need a studio circle followed by the output page.
- A stream's threshold note sounds at most 2 s, even while the value stays above the threshold.

## Tested here, and not

`node tools/output/test-page.mjs` checks the page in headless Chromium with Web MIDI and the studio stubbed (and a plain
relay for the dialog's button and the presence); `node tools/collab.mjs --output` runs it end to end with the relay's UDP.
Untested until tried on real machines: Web MIDI with real virtual ports and Cardinal, a DAW's real MIDI clock, OSC to real
apps, UDP through Windows' firewall, the trackers' OSC rate on the PC, cubes and pointing from real headsets, and how in
time it all feels.
