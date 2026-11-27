# The studio: where its contract is now

This file was the studio's contract, 361 KB, written section by section as each feature was built and kept up to
about v165. It is now an index. **`docs/agents/studio.md` is the one live description** of what the studio does and
what every change must keep; it holds the rules of every section below (the ones this file had and that
`studio.md` lacked were added to it, each under its feature's bullet as *Also from the v165 contract*).

The old text, word for word and unchanged, is `docs/history/studio-spec.md` (Grep it by the old heading; it holds the
owner's words behind each section and the reasons). Read it for why a rule is as it is, never as the current state:
where it and `studio.md` differ, `studio.md` is right.

How to read `studio.md`: it opens with a generated table of contents (line numbers and sizes; `node
tools/docs/toc.mjs` rewrites it after any edit, `--check` says whether it is current). Read the table, then one
section's line range. A section is made of bullets, one per feature, named in bold; Grep `- \*\*<name>` to land on
one.

The other pieces of the studio's documentation:

- `tools/studio/README.md` - the formats guide and the upload page, for people.
- `tools/output/SPEC.md` - the output page's contract (MIDI, OSC, streams, trails, loops on the beat).
- `relay/README.md` and `relay/docs/` - the relay's side: scenes, uploads, R2, the scene API.
- `docs/agents/shared-rooms.md` - the studio in a shared room (`st.<id>`, `layout`, effects), "The studio's scenes on
  the relay".
- `docs/agents/testing.md` - the studio's tests and smoke steps (the old "Tests" section).
- `tools/studio/xp/README.md`, `tour/README.md`, `tracker-guide/README.md`, `dub/README.md` - the example scenes.

## Index: the old section, and where it lives now

Code comments and other docs still say `tools/studio/SPEC.md, "<section>"`; this table finds that section in
`studio.md` (heading, then the bullet's bold name). `Old` is the old heading in `docs/history/studio-spec.md`.

| Old section | Now in `docs/agents/studio.md` (heading › bullet) |
| --- | --- |
| Names | Scenes, models and converting › What it is |
| Where scenes come from: the relay, an R2 bucket, a plain folder, the page's side | Scenes, models and converting › Scenes; `relay/README.md` and `relay/docs/`; `shared-rooms.md` "The studio's scenes on the relay" |
| Models | Scenes, models and converting › Models |
| A scene's layout | The layout and trigger cubes › `layout.json` (and each feature's bullet for its own fields) |
| Trigger cubes | The layout and trigger cubes › Trigger cubes |
| Cubes for everyone | The layout and trigger cubes › Cubes for everyone |
| Cubes that switch cubes | The layout and trigger cubes › Cubes that switch cubes |
| Moved by anyone, and cubes with a key | The layout and trigger cubes › Moved by anyone; Cubes with a key |
| AR or VR only | Showing by kind of session... › AR or VR only |
| Trigger cubes that change textures | Showing by kind of session... › Trigger cubes that change textures |
| Trigger cubes that start things | Showing by kind of session... › Trigger cubes that start things |
| Sequences (record, play state, firing and late joiners, show and hide, starting, editing, tests) | Sequences, pressing, sends... › Sequences |
| Pressed and pointed at | Sequences, pressing, sends... › Press and hover |
| Sends to the output page (MIDI and OSC) | Sequences, pressing, sends... › Sends to the output page (MIDI and OSC); `tools/output/SPEC.md` |
| Streams on a card; Trails; Loops on the beat | Sequences, pressing, sends... › Streams, trails and loops on the beat; `tools/output/SPEC.md` "v158" |
| Sounds (emitters); Long sounds are streamed | Sounds › Sounds |
| Sounds that follow a model | Sounds › Sounds that follow a model |
| Live sound | Live sound (v162) |
| Editing | Editing, performance and saving › Editing; The panes; Saving |
| Nothing see-through while editing | Editing, performance and saving › Nothing see-through while editing |
| Editing without the cost | Editing, performance and saving › Editing without the cost; Performance |
| Shared rooms | Example scenes, placement... › Shared rooms; `shared-rooms.md` "The studio in a room" |
| Placement in a headset | Example scenes, placement... › Placement in a headset |
| GLB first, and converting | Scenes, models and converting › GLB first |
| Compressed textures (KTX2) | Scenes, models and converting › Compressed textures (KTX2) |
| Textures: found, added, converted | Scenes, models and converting › Textures: found, added, converted |
| The upload page | Scenes, models and converting › The upload page; Pushing a folder; `tools/studio/README.md` |
| Fewer triangles; Change texture | Scenes, models and converting › Fewer triangles and Change texture |
| The viewer | Scenes, models and converting › The viewer |
| Pictures in the Add pane; The Items pane as cards | Scenes, models and converting › Pictures in the Add pane; Editing... › The panes |
| New scene and From another scene | Editing... › The panes (the Scene pane); Scenes, models and converting › Scenes |
| Cut-outs | Cut-outs, groups, faces, tint... › Cut-outs |
| Groups | Cut-outs, groups, faces, tint... › Groups |
| Faces; Tint and brightness | Cut-outs, groups, faces, tint... › Faces; Tint and brightness |
| The colour picker | Cut-outs, groups, faces, tint... › The colour picker |
| Shapes and empties; Locked in place; The scene's settings; The lobby | Shapes, locks, goggles and behaviours › Shapes, empties, locks, the scene's settings and the lobby |
| Behaviours | Shapes, locks, goggles and behaviours › Behaviours |
| Things on walls | Shapes, locks, goggles and behaviours › Things on walls |
| Motions | Motions, recorded paths... › Motions |
| A model's timeline | Motions, recorded paths... › A model's timeline |
| As it moves: clip by distance | Motions, recorded paths... › As it moves: clip by distance |
| Recorded paths (ten minutes as a file, a voice with the movement, stays on the floor) | Motions, recorded paths... › Recorded paths |
| The ghost, Pause and placing what moves; The recording's ghost and the loop join | Motions, recorded paths... › The ghost, Pause and placing what moves; Recorded paths |
| Example scenes | Example scenes, placement... › Example scenes |
| The Bliss XP room | Example scenes, placement... › The Bliss XP room (example scene); `tools/studio/xp/README.md` |
| Props that follow a tracker; Worn with trackers: a Mixamo character | Props on trackers and a character worn with them; Example scenes... › Trackers |
| The room scan | Screens, paintings and the room scan › The room scan |
| Screens: video and audio players | Screens, paintings and the room scan › Screens: video and audio players |
| Paintings: drawing in the air | Screens, paintings and the room scan › Paintings: drawing in the air |
| Formats guide | `tools/studio/README.md` |
| Tests | `docs/agents/testing.md` (the studio's smoke steps and test scenes: Grep `studio`) |

Newer than the old contract, in `studio.md` only: the dub techno demo, VR goggles, the studio tour, game screens, the
tracker guide, takes, mirror the visitor, and everything from v165 on.

## Rules that stayed in `AGENTS.md`

The studio's rules every change must keep are in `AGENTS.md`, "The studio" (and "Sound", "Shared rooms"): at a station
the scene's frame is the room's; motions, paths, behaviours and trackers draw through the pose pipeline; nothing
see-through while editing; trigger cubes are each person's own unless `all: true`; a sequence's play state, a press
stamp and a screen's `play` are never in `layout.json` or Undo; locked items refuse every move, size and delete;
editing, Upload and conversion are never offered with `&visit`; the owner's own scene files never enter the
repository.
