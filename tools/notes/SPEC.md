# The developer notebook (v142)

The owner, 13 November 2026: "a developer notebook function where i can directly record some spoken audio in ar or vr
and then it gets transcribed somehow ... and i can also attach a screenshot if needed with things highlighted and then i
can use the output to tell you about bugs etc, the more direct the better"; then "holding y or b to record, primarly i
will use it from within ar or vr but sometimes i might record a quick note from my phone or laptop so make sure this
works too. also give me the notes page where i can listen through and delete if i want."

A note is a voice recording with what the app knew at that moment: two pictures (as it began and as it ended), pins
(where the person pressed while talking, and what was there), and a context block. Notes go to the relay. A Claude Code
session reads them from the relay, transcribes them there (`tools/notes/notes.mjs`, faster-whisper) and writes the
transcript back. Nothing of a note is ever in the repository, a room's keys or `collab.state()` (no `FORMAT` change).

Three parts, each its own lane:

- **The relay** (`relay/notes.mjs`, routes in `relay/server.mjs`): stores notes, a folder or R2.
- **The shell** (`notes.js`, a new shell file loaded by `index.html` after `ships.js`, before `shared.js`; hooks in
  `index.html` and `shared.js`): records, captures, uploads, keeps an outbox.
- **The notes page and the tool** (`notes/index.html`, served as an app folder; `tools/notes/notes.mjs`,
  `tools/notes/transcribe.py`): listen, read, delete; pull and transcribe.

## Who may record

Developer mode only (`HOST.dev.on()`, "Developer mode" in `AGENTS.md`). Off, nothing of the notebook shows and holding B
or Y does nothing (a hall of visitors at an event must never upload their voices).

## Recording in a headset (VR or AR)

- **Hold B or Y** (`buttons[5]` of either controller with a gamepad; never a tracked hand) for 0.45 s: recording starts.
  Released: it stops and the note goes. A press shorter than 0.45 s is an ordinary press (it still counts towards the
  double press that shows the frame rate, `BY` in `shared.js`'s `sticks`); a press that becomes a hold never counts
  towards a double press. A hold while a note is being sent starts a new one.
- At most 5 minutes (`NOTE.max`): then it stops by itself and goes.
- **The microphone**: `getUserMedia({ audio: { echoCancellation, noiseSuppression, autoGainControl } })`, asked as B or
  Y goes down (so speech is not clipped while it opens), kept open for 60 s after the last note (the next note starts at
  once) and closed then, when developer mode goes off and when the session ends. `MediaRecorder` with the first of
  `audio/webm;codecs=opus`, `audio/webm`, `audio/ogg;codecs=opus`, `audio/mp4` the browser supports (a chunk a second).
  No `AudioContext` of its own (the shell's sound rule): the level meter, if drawn, is an analyser on
  `HOST.audio.fx()`'s context connected to nothing else, or none. The microphone refused or not answering in 4 s: a
  notice *The microphone is not allowed here* with *Record a note once on the 2D page first (the round button at the
  bottom right) and allow it there.* The note is still made without audio (pictures, pins, context) and goes.
- **While recording**: a small read-out fixed to the head, as the frame-rate read-out is (`drawFps`, `OV.fps` in
  `shared.js`; its own sheet, `OV.note`, 0.36 m wide, 1 m away, 14 degrees under the gaze and centred, `renderOrder` 52):
  a red dot, *Recording a note 0:07*, *2 pins*, *Let go of B to send it* (the button held), and a level bar. A soft
  `toggleOn` as it starts and `toggleOff` as it stops (`HOST.sfx.play`), a short buzz on the holding controller as it
  starts (0.3, 40 ms).
- **Pins**: every `selectstart` of either controller (or a tracked hand's pinch) while recording is a pin. The press
  still does what it does (so "I press this and nothing happens" is recorded as it happens). A pin is
  `{ n, t, hand, p, room, hit }`: `n` 1, 2, 3...; `t` seconds since the recording began (to the ms); `p` where the ray
  hit in the renderer's reference space (three.js's world), else 2 m along the ray; `room` that point in room coordinates
  when the headset is in a shared room and lined up (`HOST.room.matrix()` inverted), else absent; `hit` what was there:
  - `{ kind: 'shell', what, id }` when the shell's own thing was nearest (the menu and its button id, a station's ring,
    card or icon and its station id and story, the question's buttons): from `shared.js`'s hover for that controller;
  - `{ kind: 'panel', panel: 'main' | 'foot' }` when the story's own panel was (the `near` the story passed to
    `HOST.collab.ray`);
  - `{ kind: 'scene', path: ['name' or type, ...], ud: {...} }` otherwise: the first visible mesh hit by a raycast of
    `HOST.cur.collab.scene()` (visible objects only, `Mesh` and `SkinnedMesh`, not `Points` or `Line`), with the names
    of it and its parents up to the scene (at most 6, a nameless one by its type) and the first parent's `userData`
    fields among `id`, `kind`, `key`, `name`, `item`, `set` that are strings or numbers;
  - `{ kind: 'none' }` when nothing.
  Each pin is drawn where it is (a small bright ball with its number on a sign over it, over everything, in the
  renderer's space, as the check by eye's letters are) while recording and for 10 s after, so the end picture shows them.
- **Pictures**: one as the recording starts (the frame after the hold is taken) and one as it stops (pins drawn). Read
  back right after the story's frame in the same `requestAnimationFrame` callback (a hook in `HOST.loading.wrap`,
  outermost after `inputsGuard`, `HOST.notes.frame(t, f)`): in a session the layer's framebuffer
  (`session.renderState.baseLayer.framebuffer`), the left eye's viewport (three.js r128's `renderer.xr.getCamera()
  .cameras[0].viewport`, else the left half), `gl.readPixels` RGBA, flipped, the previous framebuffer binding put back;
  on a page the default framebuffer, the whole drawing buffer. Made at most 1280 px wide into a canvas, encoded off the
  frame (`toBlob` `image/jpeg` 0.82, 3 s, else `toDataURL`). Where the read fails (throws, or gives all zeros) the note
  says so (`shots[i].err`) and goes without it. In AR the passthrough is not in it (black): the note's context says
  `xr: 'ar'`.

## Recording on a phone or a laptop (a page, no headset session)

- While developer mode is on, a round button at the bottom right (`#noteBtn`, 52 px, a microphone icon, inside the
  safe areas, above focus mode's foot bar and the bottom sheet, `z-index` over the page's panels but under dialogs),
  on the Stories screen and in stories alike; hidden while a headset session runs.
- A press starts (the microphone asked within the tap), the button turns red with the time (*0:07*) and a small strip
  beside it says *Recording: tap or click anywhere to pin it. Press again to send.* A second press stops and sends.
  Esc cancels (nothing sent, a notice *Note cancelled*).
- **Pins** on a page: every `pointerdown` anywhere on the page while recording (capture phase, never stopped: the press
  still does what it does), except on the note button itself. A pin is `{ n, t, x, y, el }`: `x`, `y` in CSS pixels of
  the window; `el` the element under the point (`document.elementFromPoint` before any overlay of ours): `{ tag, id,
  cls, text }` (its text cut to 60 characters, its classes to 60), and when it is the WebGL canvas `{ tag: 'canvas' }`.
  Numbered markers are drawn over the page where each pin was (a fixed overlay, `pointer-events: none`) while recording
  and for 4 s after.
- **Pictures**: the WebGL canvas as above, the start and end, with the pins' numbered markers drawn into the end
  picture at their places (scaled from the window to the canvas's rectangle; a pin outside the canvas drawn at the
  nearest edge with an arrow is not needed: left out of the picture, kept in the list).
- The microphone refused: the note is not sent; the strip says *The microphone is not allowed: allow it for this site in
  the browser's settings.*

## The context (`context`, gathered as the recording stops; every read guarded, a failure leaves its field out)

```
{
  release: 'networks-v142', format: 'networks-44', shell: { n, id },     // sw.js VERSION as the page has it, FORMAT, HOST.shell
  url: location.origin + location.pathname + location.hash (with any token= or key= removed),
  device: 'headset' | 'phone' | 'tablet' | 'desktop', ua: navigator.userAgent, browser: Quest Browser's version if any,
  screen: { w, h, dpr }, xr: 'vr' | 'ar' | '' , focus: HOST.focus && HOST.focus(),
  story: HOST.curKey, mode: APP.mode, t: APP.t (s, 2 decimals), playing, chapter: { i, key, title },
  state: the story's collab.state() (cut to 16 KB as JSON; for the studio its own),
  studio: for the studio, HOST.cur.peek('STUDIO.state()') reduced to { source, scene, edit, sel, items: count, unsaved } (guarded),
  room: { code, via, live, station: { id, story, title }, people, lineUp: lineUp() words, here } or null,
  settings: { labels, cards, free, subs, sfx, voice, walk, fps, hz, occl, panels } (HOST.xr and HOST.panels as they are),
  perf: HOST.perf.stats() and the frame rate now,
  log: the last 60 lines of window.__collabLog (as text, the relay's password stripped as the shell's log already does)
}
```

## The note as sent

`POST <relay>/api/notes` with the relay's password (`Authorization: Bearer`, as every relay call; `HOST.collab
.relayFind()` gives `{ base, token }`), `Content-Type: application/json`, at most 16 MB:

```
{ v: 1, nonce: <16 random letters and digits, made with the note and kept with it in the outbox>, at: <ms, the device's clock>, dur: <s, 2 decimals>, kind: 'headset' | 'page', name: <the person's name in rooms, if any>,
  audio: { type: 'audio/webm;codecs=opus', data: <base64>, off: <s the microphone began after the recording did; a pin's place in the audio is its t less this> } | null,
  audioErr: <why there is no audio, at most 200 characters, when audio is null and a microphone was asked for>,
  shots: [ { at: 'start' | 'end', type: 'image/jpeg', w, h, data: <base64> } | { at, err: '...' } ],
  pins: [ ... ], context: { ... } }
```

The answer: `201 { id }`, or `200 { id, again: true }` when the relay has a note with the same `nonce` already (a retry after
an answer was lost: stored once; the client treats both alike). The relay keeps `audio.off` (a finite number from -10 to 60,
3 decimals), `audioErr` and `nonce` in `note.json`. A note refused with 400 or 413 is dropped from the outbox but said (a
notice, the page's strip). On any other failure (no relay: `relayFind()` null; refused; offline) the note goes into an outbox
(IndexedDB `networks-notes`, store `outbox`, at most 20 notes, the oldest dropped past that) and is sent again when the
page loads, when it comes online, and every 60 s while one waits; a notice says *Note kept on this device: it goes once
a relay answers* (headset) or the strip says so (page). Sent: a notice *Note sent (0:12, 2 pins)*.

`HOST.notes`: `state()` ({ rec, since, pins, outbox, sent, last: { id, err }, mic }), `start(why)`, `stop(send)`,
`frame(t, f)` (the wrap's hook), `context()`, `outbox()`; for tests `test({ clock, noMic })`.

## The relay

Notes are on whenever the relay keeps scenes: with `--scenes <dir>` in `<dir>/.notes/`, with `--scenes r2` under the
key prefix `R2_PREFIX + '.notes/'`; `--notes <dir>` keeps them in that folder instead (also without scenes);
`--no-notes` turns them off. The scenes' listing and watch, and `tools/studio/r2sync.mjs`, leave `.notes` out silently (with R2 the listing steps over the keys under
`<R2_PREFIX>.notes/`, so the notes' objects never count against the scenes' limit).
`/api/ping` says `notes: true` when on. Every endpoint needs the password as the API does (Bearer or `?token=`); with
`--public` a relay without a password keeps no notes. Answers `no-store`. Off: every notes endpoint 404 `{ error: 'this
relay keeps no notes' }`.

A note on disk (or as objects): `<id>/note.json` (the note as sent without `audio.data` and the shots' `data`, plus
`id`, `got` (the relay's ms), `size`, `status`: `'new'` | `'done'`, `transcript`: null | `{ text, lang, segments:
[{ start, end, text }], by, at }`), `<id>/audio.<webm|ogg|m4a|mp3>`, `<id>/shot-1.jpg`, `<id>/shot-2.jpg`. The id:
`YYYYMMDD-HHMMSS-` and 4 letters or digits, by the relay's UTC clock (sortable; never a client's).

- `POST /api/notes` (above): 201 `{ id }`; 400 bad JSON or fields (named in words); 413 over 16 MB (counted as it
  streams); 429 past 30 a minute from one address under `--public`; 507 past 2,000 notes.
- `GET /api/notes`: `{ notes: [ { id, at, got, dur, kind, name, status, story, station, release, device, pins: n,
  shots: n, audio: bool, transcript: first 200 characters | null } ] }`, newest first.
- `GET /api/notes/<id>`: its `note.json`.
- `GET /api/notes/<id>/audio`, `GET /api/notes/<id>/shot/<1|2>`: the bytes with their type, byte ranges, `no-store`.
- `POST /api/notes/<id>` `{ status?, transcript? }`: updates those fields (a transcript `{ text, lang, segments, by }`,
  `at` set by the relay; at most 200 KB); 200 the note.
- `POST /api/notes/<id>/delete`: 200 `{ ok: true }`; the note's files go.
- `GET /notes` redirects to `/notes/` (the page, an app folder served as `room-test/` is).

No transcript, name or note content in any log line; `--logs` lines say `note <id> <bytes>` at most.

## The notes page (`notes/index.html`)

A page of its own (no three.js), plain British English, dark, the app's look, readable on a phone. Its relay: the page's
own origin when `/api/ping` there answers as a relay, else `?relay=<https://...>` or a field (kept in `localStorage`
`notesRelay`). Its password: `localStorage` `relayTokens[<relay origin>]` (the app's own key, shared on the same
origin); a 401 shows a password field, kept there once it works. Lists notes newest first (*New*, *Done*, *All*), looked
for again every 15 s and on focus; each a card: when (local time), device and where (story or studio scene, station),
how long, its status; an audio player (fetched with the password into a blob URL as it is first played; a pin's time a
link that plays from there); both pictures (a press enlarges); the transcript when there is one (each segment's time a
link); the pins in a list (*Pin 2 at 0:04: the menu, button set:fps*); the context in a `<details>`; *Mark done* /
*Mark new*; *Copy as Markdown* (the note's whole text: when, where, transcript with pins in place by time, pins, the
context's key lines and the log); *Delete* (two presses within 3 s). A note sent from this device's outbox is not here
until it is sent.

## The tool (`tools/notes/notes.mjs`, Node, no packages)

`node tools/notes/notes.mjs <command>` with `NOTES_RELAY` (default `https://stories.lab.lbi-netmed.com`) and
`NOTES_TOKEN` (the relay's password; never printed, never written to a file):

- `list [--all]`: the new notes (all with `--all`), one line each.
- `pull <id|new> [--out <dir>]`: each note into `<dir>/<id>/` (default the system's temp folder): `note.json`, the audio,
  the pictures and `note.md` (as *Copy as Markdown* writes it).
- `transcribe <id|new> [--model small]`: pull, then `tools/notes/transcribe.py` on the audio (faster-whisper, CPU, int8,
  the language found by itself, so English or German), its result posted as the note's transcript (`by: 'whisper-<model>'`),
  and `note.md` written again with it; prints `note.md`.
- `done <id>`: status `done`.

`tools/notes/transcribe.py <audio> [--model small]` prints `{ text, lang, segments: [{ start, end, text }] }`; PEP 723
block naming `faster-whisper`, so `uv run` fetches it, or `python3 -I` with it installed; ffmpeg reads the audio.

## Untested on devices (until tried)

The microphone inside a Quest session (whether Quest Browser asks there, or only on the 2D page), reading the layer's
framebuffer on a Quest (its cost, whether it gives the picture), holding B or Y, the read-out, pins with real
controllers, the outbox through a real sleep, an iPhone's `audio/mp4`, and the page on a phone.
