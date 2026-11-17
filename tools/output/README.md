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
  item's place, turn or speed, the distance between two of them), mapped from a range to 0 to 1 (inverted if asked,
  smoothed), sent as a MIDI controller and OSC (`ff`: the value 0 to 1, the value as measured).

The address tables (what each address carries, its types and arguments, and the addresses the page always takes) are in
`SPEC.md`, "Wire 4" (OSC) and "Wire 5" (MIDI).

## What it takes

- **OSC**, always while OSC is on: `/studio/press <id or name>`, `/studio/seq/start`, `stop`, `toggle`, `rewind`,
  `/studio/show`, `hide`, `flip`, `clear`, `/studio/beat <bpm>` (each message a beat: send one per beat to lock the phase),
  `/studio/beat/stop`.
- **Incoming mappings** (this computer's own): a MIDI note, a controller crossing a value, a program change, MIDI start,
  stop or continue, or an OSC message (an argument crossing a value) pressing an item, starting or stopping a sequence,
  showing or hiding an item or switching a cube; *held*: a note's release (or the value going back) does the opposite.
  *Learn* fills a row from the next message.
- **MIDI clock to the room's beat** (off by default): a DAW's MIDI clock sets the room's beat, which motions *On the beat*
  follow.

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

## Tested here, and not

`node tools/output/test-page.mjs` checks the page in headless Chromium with Web MIDI and the studio stubbed (and a plain
relay for the dialog's button and the presence); `node tools/collab.mjs --output` runs it end to end with the relay's UDP.
Untested until tried on real machines: Web MIDI with real virtual ports and Cardinal, a DAW's real MIDI clock, OSC to real
apps, UDP through Windows' firewall, the trackers' OSC rate on the PC, cubes and pointing from real headsets, and how in
time it all feels.
