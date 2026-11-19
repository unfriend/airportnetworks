# Arrangements: a story's copy on the relay, retimed and rearranged (step 3 of the packages plan)

The owner, 18 and 19 November 2026: the stories stay as they are in git; "a copy button to copy them to the relay and
then edit in case this is wanted"; what is edited is "rearranging and timing etc, no logic"; captions may be edited, the
numbers computed from the data staying live (`{tokens}`).

An *arrangement* is plain data laid over a story's own timeline: never code. The story still runs from its own file
(`stories/<key>.js`, or a package's `main.js`); with an arrangement it plays the same sets, chapters and explore mode,
retimed and rearranged. Every story built with the shared engine parts (the fourteen built stories, and every package
made from the template) can be arranged; the hand-written ones (airports, proteins, cell map) and the studio cannot (no
*Copy to relay* there).

## Where it lives

A copy is a scene on the relay: a folder made with the scenes API (`POST /api/scenes { name }`), its `layout.json`
`{ "studio": 1, "story": <arrangement> }` saved with `POST /api/scenes/<name>/layout` (2 MB at most, history kept, the
relay's password, folder or R2: all as for a scene; the relay needs no change). Its name is `<key>-copy`, `<key>-copy-2`
... (the scene name rule). A recording uploaded for it goes into the copy's `sounds/` (the scenes' sound upload). The
studio lists copies with the scenes and opens one by starting the story with it (below); it never edits a copy's layout
as a scene, and its Save never drops the `story` field.

## The address and the room

- `#<key>&arr=<scene name>` opens the story with that copy's arrangement (the relay the page already uses, with its
  password); `&edit` also opens the editor (a page only). Without a relay, or when the copy cannot be read, the story
  plays as its own and the bar says *Copy not found*.
- In a shared room a station may run a copy: the station's state gains `arr` (the scene name, or absent), set by whoever
  opens the copy at that station; every device reads the arrangement from the relay and plays it. This changes the
  room's keys: `FORMAT` goes to `networks-54`. A device that cannot read the copy plays the story as its own and says
  so. The arrangement itself is never in `collab.state()`.

## The story's side: `arrange` in a story's returned object (shared engine parts)

```
arrange: {
  model(),      // the story's own timeline as data (below), as built by buildStory, before any arrangement
  apply(A),     // lay arrangement A over it (null: back to the story's own); returns { dropped: [ids] }; safe while
                // playing or paused and in explore mode; the story's time (APP.t) keeps its place in the story
  get(),        // the arrangement now applied, or null
}
```

### The model (`model()`)

All times are the story's own seconds (story time, `CH` a/b), before any arrangement.

```
{ v: 1, key, len,                                  // len: the story's end in story time
  chapters: [ { key, name, a, b } ],
  sync: [ [rec, story], ... ],                     // NARRATION_SYNC (recording seconds -> story seconds)
  narration: <address or null>,
  tracks: [ { id, name, set, kind, keys: [ { i, t, v } ] } ],   // every param track (TR): id 'p:<param>'; kind 'show'
                                                   // for a set's fade (<set>_a), 'step' for a step param, else 'param'
  camera: [ { i, t, label } ],                     // the camera's waypoints, in order
  captions: [ { id, ch, i, at, text, tokens } ],   // the story panel's points per chapter (id '<chapter key>:<i>'), when
                                                   // each shows (at, story time), their plain text and the numbers in it
  labels: [ { id, t0, t1, text } ],                // the story's timed labels, if any
  cues: [ { i, t, name } ],                        // sound effects on the timeline (sfxCue)
  sets: [ { key, name } ] }
```

### The arrangement (`A`, what is saved)

```
{ v: 1, key, made: '<date>', from: '<the story file's fingerprint when copied>',
  chapters: { '<chapter key>': { len: <seconds>, skip: true } },   // a new length (stretched or squeezed), or skipped
  keys:     { '<track id>#<i>': { t, was } },     // a keyframe moved: t its new time, was the time it had (story time)
  camera:   { '<i>': { t, was } },
  cues:     { '<i>': { t, was } },
  captions: { '<id>': { text, was, at, wasAt } }, // new text (and/or time): {1}, {2} ... are the numbers of the story's
                                                  // own text, in order, filled in live; was: the story's own text
  labels:   { '<id>': { text, was } },
  sync:     [ [rec, story], ... ] | absent,        // the narration's timing replaced (story time, before chapter lengths)
  narration: 'sounds/<file>.mp3' | absent,         // a recording in the copy's folder
  place:    { '<set key>': [dx, dy, dz, turn, scale] } }   // a set moved (story units), turned (degrees about up),
                                                           // scaled (1 = as is), on top of where the story puts it
```

Every edit names what it changed from (`was`): an edit whose `was` no longer matches the story's own (the story changed
since the copy was made) is dropped and listed (`dropped`), never applied to something else. Unknown fields are
ignored; a bad value is dropped.

### How it is applied, in order

1. The story's own timeline (as `model()` gives it).
2. Moved keyframes, waypoints, cues, captions' times and labels (story time); a track's keyframes stay in time order
   (a key moved past its neighbour is clamped to it).
3. Chapter lengths: each chapter's span is stretched or squeezed to its new length and every time inside it (keyframes,
   waypoints, cues, captions, labels, the narration's story side) scaled with it; everything after it moves on. `CH`,
   the timeline's chapter marks and the slideshow follow.
4. Skipped chapters: playing jumps from a skipped chapter's start to the next one not skipped (the narration with it);
   the timeline shows them greyed; explore mode is unchanged.
5. The narration: `sync` replaces `NARRATION_SYNC` (before step 3's stretch); `narration` replaces the recording
   (fetched from the copy with the password and played by the shell's narration as a story's own).
6. Places: each set's group moved, turned and scaled on top of what the story does with it, every frame, in story and
   explore mode, page and headset (a `keepClear` set still never comes nearer than 0.35 m).
7. Captions: the text replaces the point's, `{n}` filled with the n-th number of the story's own text as it is now; the
   page's HTML twin and the headset's canvas twin both show it.

Without an arrangement nothing changes: `tools/engine/same.mjs`, `xrsame.mjs` and `panelsame.mjs` show no difference.

## The shell's side

- `HOST.arrange`: `read(name)`, `save(name, A)`, `copy(key)` (a new copy: the next free `<key>-copy[-n]`, its layout
  `{ studio: 1, story: { v: 1, key, made, from } }`), `list()` (the relay's copies: scenes whose layout has `story`),
  `upload(name, file)` (a recording into its `sounds/`), `url(name, path)` (a file of the copy, fetched with the password
  as the studio fetches scene files: never a password in an address).
- *Copy to relay*: on a story that has `arrange`, when a relay is known and its password held: on the page's story bar
  (in developer mode, and always when the page has `&edit`); it makes the copy and opens it with the editor.
- The editor (a page only; a headset plays a copy but does not edit it): a drawer above the timeline.
  - The chapters as a strip: drag a chapter's end to change its length; a switch to skip it.
  - Lanes: the narration's timing (its anchors, dragged), each set's show and hide (from its `show` track), the other
    tracks (folded by set), the camera, captions, labels and sound cues: keyframes as dots, dragged in time; the story
    seeks to what is dragged.
  - A caption clicked: its text in a box, numbers shown as `{1}`, `{2}`; *Back to the story's own*.
  - Places: each set's move, turn and size as small controls (and in the drawer only, never by dragging the scene).
  - The recording: *Upload a recording* (MP3) for the copy, *Back to the story's own recording*.
  - *Save* (to the copy on the relay), *Undo*/*Redo* (this page's), *Unsaved changes*, and a line for edits dropped
    because the story changed.
- The studio: its scene list shows copies (*Copy of <title>*, with *Open*), which start the story with the copy
  (`HOST.go(key)` with `arr`); a copy is never opened as a scene to place things in.
