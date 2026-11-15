# The Bliss XP room (the studio's first example scene)

`examples/bliss-xp/` is a studio scene that ships with the app: the music video "Bliss (Windows XP)" by anabology taken
apart into its components and built again as a room you walk through, in VR on our painted hill and in AR on your own
walls. It is made by the generator in this folder; **never edit `examples/bliss-xp/` by hand**: change the generator
and run it again. To change the room for yourself, open it in the studio and *Copy to the relay*, then edit the copy.

The owner, 11 November 2026: "we need it almost 1 to 1, but the elements separated and dynamic on detected walls",
"the elements, but detached and mapped onto the room, with spatial audio of course", "it may need to be reactive and
react to user movements, where the user goes, instead of a static variant", "so this could actually be built like a
studio scene with trigger cubes etc that we can edit", "make sure its all cool and fancy 3d if possible", and "Also add
a little 3d version of clippy that is there and chills".

## Making it

```sh
node tools/studio/xp/make.mjs            # builds every part, writes examples/bliss-xp/ and the listings
node tools/studio/xp/make.mjs --check    # says whether examples/bliss-xp is current (exit 1 when not)
node tools/studio/xp/make.mjs --only clippy,door --out /tmp/xp --sheet /tmp/xp/sheet.png   # while working on parts
```

It needs Playwright with a Chromium build, as `tools/smoke.mjs` and `tools/studio/convert.mjs` do (`PLAYWRIGHT_MODULE`
and `CHROMIUM_PATH` as there); it takes about 15 s. It is deterministic (every random number seeded): run it again and
the same bytes come out. A build whose checks or budgets fail writes nothing, so the folder keeps the last good build.
`--check` builds into a temporary folder and compares: the same files, `layout.json` and the sounds (made in Node) byte
for byte, the models and their pictures (made in the browser) each within 2 % of its size; then
`tools/studio/scan.mjs examples --check`.

## What is here

- `COMPONENTS.md`: the video's components second by second, and what each became in the room (a model, a picture on a
  model, a sound, a behaviour, a trigger cube, AR or VR only, on a wall), with what was left out and why.
- `make.mjs`: opens `page.html` in headless Chromium, builds each part, writes it as a binary glTF with its clips
  (three.js r128's own `GLTFExporter`), reads it back with `GLTFLoader`, checks it and draws its picture for the studio's
  Add pane (`previews/<the model's path>.jpg`, 256 px, as the studio draws them: lit as it lights a scene, a little above
  and in front, on a dark ground); then the sounds, the layout and the listings.
- `page.html`, `kit.js`: the generator's page and its kit: seeded numbers, canvas painting (our own rolling hill under a
  blue sky with clouds, `XP.hill`; a meadow; our emblem, a little green hill in a rounded square), the Luna look (title
  bars, buttons, menus), slabs whose face carries a canvas picture and whose raised parts (buttons, keys, tiles) show the
  same picture on their tops and its border on their sides, balloons, text traced off a canvas and extruded in 3D, merging
  into one indexed geometry per material, and the export and pictures.
- `parts/*.js`: one module per family of components (the screens, titles, landscape and starfield, clouds, grass, icons
  and the bin, the taskbar and Start menu, the windows, the media player, the drag trail, solitaire, balloons, cursors,
  things: the door, the flip phone, the glass CRT, the duck; Clippy and his lounge). Each registers
  `XP.part(name, { file, build })`; `build()` returns `{ root, clips }`, metres, Y up, its front +z. Wall items have their
  back at z = 0 and their middle at x = y = 0; floor items stand on y = 0.
- `sounds.mjs`: every sound synthesised in Node (mono 16-bit WAV at 22,050 Hz): the startup swell, shutdown, ding,
  critical stop, balloon pop, new message, nudge, hardware in and out, click, the bin's crumple, typing, solitaire flips
  and the outdoors (wind and birds), the loops made seamless.
- `layout.mjs`: the room (below).

## The room

81 objects (66 models), 16 trigger cubes, 35 sound emitters, 10 groups and 20 sequences. In VR it stands round you as placed, in a room of
5 x 5 m (walls at +-2.5 m round the scene's origin, where you stand at first, -z ahead), on our painted hill under its
sky. In AR it goes onto your own walls: the studio's `wall` behaviour (v137) maps each wall item onto the walls the
headset's room scan finds, so the same layout fits any room from about 3 x 3 m to 5 x 5 m.

- **Clusters on the walls.** Each wall holds clusters, each one an anchor with the `wall` behaviour (`direction`: the
  ray from the walls' middle along its placed direction) and its neighbours riding on it (the behaviour `item`: they keep
  their offsets from it, so a cluster stays one piece in any room). The anchors are placed on the ray that, in the
  smallest room (3 x 3 m), meets their wall where they are meant to be, so in a bigger room the clusters spread with the
  walls and never pile up; `layout.mjs`'s `anchor`, `rider` and `onAnchor` work the poses out from each part's box.
  - The front wall is the desktop, riding on the taskbar's bar (centred, 2.55 m wide): its buttons and tray ("9:41 AM"),
    the Start menu over the start button (in front of the icons, as the menu covers them), the balloons over the clock,
    the wallpaper (AR only), the boot screen and the welcome screen in the middle, "welcome back." and "bliss" in 3D, the
    four icons down the left and the hourglass spinning out from the wall at the right.
  - The left wall: Clippy's corner (his deckchair against the wall, Clippy on it, his two balloons over him, the duck's
    chat above), the notes (diary.txt, the On-Screen Keyboard under it, Confirm File Replace over both), Paint over Media
    Player.
  - The right wall: the pages (the bliss network and how to go outside, the Recycle Bin on the floor under them), the door
    outside with the hand pointing at its handle, its two balloons and "Bliss is a real place" over it, and the picture
    viewer.
  - The back wall: Task Manager over the solitaire win (its cards bounce down to the floor), the way out (Turn off
    computer, "You can switch off now. The grass will wait." under it in orange on black, "Go touch the grass" over it),
    and the error corner riding on Remote Assistance: "Close all your windows" over it, the window trail under it with
    the error dialog where the trail comes out of the wall. They stack by height, so on a 3 m wall the clusters share
    the width without meeting; only the trail, out in the room, stands in front of the right end of the way out's lower
    line in the smallest rooms, when someone is in the error corner (it is everyone's) while another is at the way out.
  - Clippy's chat window slides along the walls to the person nearest it (`wall`, `person`).
- **In the middle** (inside the smallest room): three patches of grass, the clear CRT on them with the rubber duck
  watching it, the flip phone, and five small clouds drifting under the ceiling; the giant cursor follows you at your
  right, facing where you look (`follow`, side right, face along).
- **VR only** (`shows: 'vr'`): the hill and sky, four big clouds far in the sky, the starfield and the wind and birds.
  **AR only** (`shows: 'ar'`): the wallpaper.
- **The walk** (trigger cubes; most reach from inside the smallest room out past the walls of the biggest, so they are
  walked into in any of them; the entry and the grass stand in the middle):
  - *Entry* (everyone, stays): a step forward hides the boot screen and shows the welcome screen, "welcome back.", the
    giant cursor and its balloon, with the startup swell (shown with them, so it plays once as it first shows; the cube
    stays, and walking through it again on the way to the desktop does not play it again).
  - *Clippy*: near him, he waves and asks whether you are trying to go outside (his balloon pops in).
  - *Recycle Bin*: the crumple.
  - *Chat*: at the notes, the new-message chime, the chat's nudge and the typing (while you stand there).
  - *Door*: the door opens onto the hill and stays open while you stand there, a click, the outdoors coming through it;
    "Go. Click the door" and "Bliss: a painted hill" pop in, the hand goes; in VR the hill's wind and birds rest
    meanwhile (the outdoors through the door is the same sound).
  - *Grass* (everyone): "Found New Hardware: Grass" with the two notes up (and down as you leave), and Clippy dances,
    asking whether you are trying to be happy.
  - *Task Manager*: coming towards the back left corner, the critical stop.
  - *Solitaire*: nearer the wall there, the solitaire win with its flips under Task Manager. The two cubes are bands
    side by side, never one inside the other: a cube that hides what another starts, where both are active, would
    silence it (`layout.mjs`'s `checkLayout` refuses it).
  - *Way out*: Turn off computer and "You can switch off now", the shutdown; in VR the hill gives way to the starfield.
  - *Error corner* (everyone): the trail, the error dialog and "Close all your windows", the ding; the giant cursor goes
    while anyone is there.
- **Things to press** (v146, the owner, 15 November 2026: "Bliss more interactive ... PRESS an item (anyone, visitors too,
  editing off too)"; a click, the trigger or a pinch, with editing off). A press is a record on the object (`press`: what it
  starts) and what it starts is mostly a *sequence* (a timeline of events on items, kept in `layout.json` as `sequences`):
  both are shared on the room's clock, so what one person presses everyone at the circle sees at the same room moment, a late
  joiner too. Pointing at something (`press.hover`) is each person's own and sends nothing.
  - *Start*: the start button opens the Start menu with a click (Start open); pressing the open menu closes it (Start close).
    There is no toggle on the button itself: the menu closes by pressing it. Pointed at, the button comes 8 mm out of the bar.
  - *Icons*: My Computer, My Documents, Internet and Media Player each turn a small loading hourglass in front of their window
    (and the desktop's) for 1.2 s, then show the window (the picture viewer, the notes, the search, the player) with its red
    close button over the drawn one; the windows start closed. The close button hides both again with a click. Pressing the icon
    of a window that is open loads it again (it goes and comes back after the 1.2 s). The close buttons and the player's
    buttons are separate parts (`close-button`, `media-play`, `media-stop`) placed over the drawn ones from where the window
    parts say their buttons are (`info.marks`), riding on their window, so they stay on it in any room. Pointed at, an icon
    lifts and turns a little and a button comes 4 mm out.
  - *Media Player*: its play button starts the bars and our own music (a 4.8 s loop: a pad on two chords, a plucked bass and a
    bell tune of eight notes of a pentatonic scale, `sounds.mjs`'s `music`; for ten minutes at most, or until stop or closing the
    player), its stop button ends both, and closing the player does too.
  - *Clippy* waves while he is pointed at and dances, with a giggle, when he is pressed.
  - *Balloons*: pressing any of the six bursts it with a pop; it grows back out of its tail 8 s later. (Its unseen box stays
    during those 8 s: pointed at and pressed again, it bursts again.)
  - *Welcome*: pressing the welcome screen logs in: it and "welcome back." go with a click. (Only Log in hides them and no cube shows them, so every device agrees,
    whoever walks in or reloads later.)
- **What anyone can pick up** (`grab`): four playing cards (our own faces, pips only: an ace of hearts, a seven of spades, a
  three of diamonds, a ten of clubs, 9.5 x 13.3 cm, backs plain blue) on the floor in front of the solitaire, and two old
  printed pages ("plans for today") by the right wall. Dropped in the Recycle Bin they crumple into a ball, held crumpled while
  they are in the bin, with the crumple sound and the bin's gulp; carried out they smooth out. Six low key cubes (floor to
  0.5 m, each reacting to its own card or page, `key`) stand round where the bin is in the 3 x 3 m room and in the 5 x 5 m room
  and between (the bin rides on the browser on the right wall, so in AR it moves with the wall), 0.18 m wider on every side;
  `layout.mjs` works the two places out the way the wall behaviour places the browser. In a room much smaller or bigger than that,
  or much longer than wide, the bin can stand past a cube's edge: it then crumples nothing.
- **Sounds**: 17 synthesised sounds as 35 emitters, each at its object (`on`), so it comes from there. An emitter is
  heard only as much as its object is shown (its level is its own fade times its object's), so a sound a cube starts
  once is on an object that is always shown and placed at the one it belongs to (`o`): the balloon pops on Clippy, the
  ding on Remote Assistance, the shutdown on "Go touch the grass", the startup swell on the taskbar's bar. Otherwise it
  would start as its object fades in and lose its attack (`checkLayout` refuses that too).
- **Where to stand.** In AR the walls' middle is the room scan's, but the floor things and the cubes stand round the
  scene's origin, which is where the session began: **start in the middle of the room, facing the wall you want the
  desktop on, and Recenter there** (the boot screen says so). Started 0.4 m off the middle of a 3 x 3.5 m room, a few
  floor things and cubes already touch the walls. In a shared room the
  scene's frame is the room's (spot A): there, put spot A in the middle of the room. Rooms much wider than deep (facing a
  long wall) push a few side-wall windows a few centimetres past the corners.

## Budgets

Every model under 30,000 triangles (the biggest, the hill, 7,368) and the room 75,042 triangles as placed in VR (about 58,000 in
AR), every picture at most 1,024 px (JPEG where opaque), few draws per model (static parts merged by material; only parts
that move are nodes of their own): 152 draws with everything shown in VR (118 before v146; five hourglasses of 4 draws, the cards and pages and the buttons added
the rest), 144 in AR. The folder is 5.81 MB (under 6). `make.mjs` stops when a budget is passed. Unlit models (the windows' faces, the
landscape, the grass, the clouds and the cursors, their light baked into their corners) look the same in any light; some
have no normals (they need none), which the studio's Add pane notes as it does for a scan.

## The rules

- Our own drawings only: no frame, still or likeness of the performer or anyone else (no people at all: the assistant's
  part is Clippy's, our own paperclip, built from scratch), and none of the video's pictures.
- No logos: never the four-coloured flag or the system's or its maker's wordmarks; our own emblem and the word "bliss"
  on the boot and welcome screens. The UI's generic labels are fine (start, My Computer, Recycle Bin, Notepad, Task
  Manager, title bars and buttons).
- No sound files or tunes of the real system and no song: every sound is our own synthesis (the critical stop three short low
  buzzes on one note, the startup and shutdown plain broken chords, up and down again), and the only music is our own short loop
  for Media Player (a plain chord loop and a pentatonic tune, seeded).
- No people on the cards: aces and pip cards only, no kings, queens or jacks.
- None of the system's own sentences: the way out says "You can switch off now. The grass will wait.", the cursor's
  error dialog is in our words, and the Bliss balloon says the hill is painted (never the photograph's place or date).
- No song lyrics: only the few short phrases the video's UI shows as window titles and balloons ("Go touch the grass",
  "Close all your windows", "Bliss is a real place", "It looks like you're trying to go outside.", the diary's one line);
  the chats, pages and search results are our own words.
- The wallpaper is a photograph: our hill and sky are painted in code (`XP.hill`), never traced from it.
- The video's frames were only looked at, never copied into the repository.

## Untested

Everything on a headset (presses with a real trigger or pinch, hover reactions, the cards picked up life size and dropped into a bin
that stands where a real room's wall puts it in AR, the player's buttons over the drawn ones; the music, the giggle and the burst are
unheard here): how the room maps onto a real Quest's room scan (the studio's `wall` behaviour on its planes:
checked here only on pretend walls, rooms of 3 x 3 to 6 x 5 m, in headless Chromium), how the windows, balloons and
titles read life size, the frame rate with the whole room (about 75,000 triangles and at most 152 draws in VR), the
sounds through HRTF (unheard here: synthesised and checked for length and level only; the pops, the ding and the shutdown
now come from the objects they are on but placed where they belong, which only a headset can confirm by ear), Clippy's clips life size, the
giant cursor at your right, and how the everyone cubes feel with several people.
