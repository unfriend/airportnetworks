# The Bliss XP room: the video's components

The owner, 11 November 2026: "we need it almost 1 to 1, but the elements separated and dynamic on detected walls", "the
elements, but detached and mapped onto the room, with spatial audio of course", "keep in mind that it may need to be
reactive and react to user movements, where the user goes, instead of a static variant", "so this could actually be built
like a studio scene with trigger cubes etc that we can edit", "make sure its all cool and fancy 3d if possible", and "Also
add a little 3d version of clippy that is there and chills".

The video is "Bliss (Windows XP)" by anabology (3 min 1 s), a music video told on a parody XP desktop. This list reads it
second by second (from frames every 2 s) and says what each part becomes in the room. Everything in the room is our own:
drawn in code, painted procedurally, sounds synthesised (`README.md`, "The rules"). No frame, photo or likeness of the
performer, no people at all (the assistant is Clippy, our own paperclip), no logos or wordmarks of the real system.

The room is about 5 x 5 m round the scene's origin (where you stand at first, -z ahead): the desktop on the front wall,
chats and notes on the left wall, the door outside on the right wall, the way out on the back wall, the grass in the
middle. Wall items carry the studio's `wall` behaviour, so in AR they move onto the walls the headset finds (each headset
its own room); in VR and on a page they stand where they are placed.

Columns: **time** in the video, **what** it shows, **in the room** (model, picture on a model, sound, behaviour, cube),
**where** (wall, floor, ceiling; AR only or VR only).

| Time | What | In the room | Where |
| --- | --- | --- | --- |
| 126-130 | Boot screen: black, a logo, the progress bar with three blue blocks running | `boot-screen.glb`: a black slab, our emblem (a green hill under a blue sky in a rounded square) and "bliss"; the three blocks are real raised blocks sliding along the track (clip *Boot*) | front wall, `wall direction`; hidden for everyone once someone steps forward (cube *Entry*) |
| 000, 136-138 | Welcome screen: "welcome back.", user tiles (a rubber duck "You", a person), "To begin, click your user name", "Turn off computer" | `welcome-screen.glb`: the blue welcome panel with our emblem, the duck tile *You* and a *Clippy* tile (his picture drawn in 2D), the turn-off button raised; `title-welcome.glb`, "welcome back." as extruded 3D text with a shadow, floating in front of it | front wall; shown with the startup swell for everyone, once (cube *Entry*, everyone, stays) |
| 004, 016, 112 | The desktop: a green hill and a blue sky with clouds (day, night, sunset) | VR: `landscape.glb`, a large rolling hill (vertex-coloured, our own painting of light) under a sky dome with painted clouds; AR: `wallpaper.glb`, a framed painted wallpaper panel for the front wall | VR only (`shows: 'vr'`) / AR only (`shows: 'ar'`) |
| 004-060 | Clouds over the hill | `cloud-a/b/c.glb`, puffy 3D clouds of three kinds, drifting on slow orbits under the ceiling; three big ones far in the sky in VR | ceiling (both), sky (VR only) |
| 100, 124 | A hand in real grass: "Found New Hardware: Grass (real, touch-sensitive)" | `grass-patch.glb` and `grass-strip.glb`, merged blades in clumps swaying (clip *Sway*); the balloon `balloon-grass.glb` by the clock with the two notes up (hardware in) and down as you leave | floor; cube *Grass* (everyone) |
| 004 | Desktop icons (My Computer, My Documents, Internet, Media Player), Recycle Bin bottom right | `icon-my-computer.glb` (a beige CRT and tower), `icon-my-documents.glb` (a folder with papers), `icon-internet.glb` (a globe with a ring), `icon-media-player.glb` (a disc with a play button), each with its label plate; `recycle-bin.glb`, a wire basket bin with crumpled paper, and the crumple sound (cube *Recycle*) | front wall's left column (`wall direction`); the bin on the floor |
| 010, 070 | The taskbar: glossy blue bar, green start button, quick launch, task buttons, tray with clock | `taskbar-bar.glb`, `taskbar-start.glb`, `taskbar-quick.glb`, `taskbar-tasks.glb`, `taskbar-tray.glb` ("9:41 AM"), separate pieces in a group *Taskbar* | front wall's foot, `wall nearest` (they keep their order along the wall) |
| (XP) | The Start menu | `start-menu.glb`, the two-column menu with the duck avatar; shown with a click as you step up to the start button (cube *Start*) | front wall, `wall nearest` |
| 006, 058 | Balloon tips: "Found New Hardware", "Cursor is now connected - Speed: 54.0 Mbps, Signal Strength: Excellent" | `balloon-grass.glb`, `balloon-cursor.glb`: pale yellow balloons with a tail and an info icon, a pop-in clip (*Pop*) each time they show | over the tray, `wall nearest` |
| 008, 020, 082-084 | Chat windows ("Conversation") | `chat-clippy.glb`, `chat-duck.glb`, Luna windows as 3D slabs with our own short lines; the first slides along the walls with you (`wall person`); a cube plays the new-message chime, the nudge (its clip *Nudge*) and typing | left wall; cube *Chat* |
| 112-114 | "diary.txt - Notepad: The first time I got a mouse," | `notepad-diary.glb` | left wall |
| 026 | On-Screen Keyboard | `keyboard.glb`, every key raised | left wall, under the notepad |
| 066-068 | Notepad with code, "Confirm File Replace" (Yes / Yes to All / No / Cancel) | `confirm-replace.glb` (our own file name) | left wall |
| 096 | "hill.bmp - Paint" with its palette | `paint-hill.glb`, the palette's swatches raised | left wall |
| 064 | Media Player visualiser: tall green bars on black | `media-player.glb`: a dark player whose bars are real 3D bars jumping (clip *Bars*, one skinned mesh) | left wall, by the solitaire corner |
| 018, 030-036 | A search page "how to go outside" with picture results; a parody browser page | `search-outside.glb` (our results, our painted thumbnails hill_sonoma.jpg, bliss.bmp, on_the_hill.jpg), `browser-bliss.glb` ("the bliss network", a home page of our own) | right wall, overlapping as windows do |
| 110, 048 | "Bliss.jpg - Picture and Fax Viewer"; balloon "Bliss: Sonoma County, California. Photographed in January 1996." | `viewer-bliss.glb` (our painted hill); `balloon-sonoma.glb` shown at the door | right wall |
| 088-096 | A white door with a handle, "Go. Click the door to go outside.", the door open onto the hill | `door.glb`: a white door in its frame, the hill painted behind it, clip *Open*; `cursor-hand.glb` points at the handle; cube *Door* opens it (held while you stand there), with a click, the outdoor ambience from behind it and the balloons `balloon-go.glb` and `balloon-sonoma.glb` | right wall |
| 042, 144-154 | Windows titled "Go touch the grass", "Close all your windows", "Bliss is a real place" | `win-grass.glb` (a painted meadow inside), `win-close-all.glb`, `win-real-place.glb` (title bars being typed) | back wall over the grass; right wall over the door and the error corner |
| 038, 098 | The window-drag trail: a dialog smeared into a cascade of copies | `window-trail.glb`: twelve copies of one dialog along a curve that comes out of the wall (one texture, one draw) | back wall, error corner |
| 052 | "Cursor has encountered a problem and needs to close..." [Send Error Report] [Don't Send] | `error-cursor.glb`; cube *Error* (everyone) shows it with the trail and the ding, and hides the giant cursor while anyone is there | right wall, error corner |
| 022-024, 054-060, 162-164 | The giant mouse arrow cursor flying over the hill, ridden like a surfboard | `cursor-arrow.glb`, white with a black bevelled edge; behaviour *Follow* (at your right, facing where you look), shown once someone has stepped in (cube *Entry*) | floats with the nearest person |
| 028 | Hourglass cursor | `hourglass.glb`, glass and sand, flipping (clip *Flip*) and spinning (motion) | front right, mid-air |
| 062 | The Solitaire win: cards bouncing across the felt leaving trails | `solitaire.glb`: the felt on the wall and four trails of cards bouncing out of it into the room in 3D arcs, a card running along each (clip *Win*), with the flips sound (cube *Solitaire*) | back wall, left corner |
| 072 | 3D Pinball | left out: a game of its own, not a part of this story | |
| 074 | Browser "the bliss network" | `browser-bliss.glb` (above) | right wall |
| 156 | Task Manager, many processes, "CPU Usage: 100%" | `task-manager.glb` (clippy.exe at 100 %), the critical stop when you step up (cube *Task Manager*) | back wall |
| 014 | Remote Assistance: "would like to share control of your computer" Yes / No | `remote-assistance.glb` (Clippy asks) | back wall |
| 078, 170 | "Turn off computer" (Stand By / Turn Off / Restart) | `turn-off.glb`, the three round buttons raised; with the shutdown sound at the way out (cube *Exit*) | back wall |
| 172-174 | "It's now safe to turn off your computer." orange on black | `safe-off.glb`; shown at the way out; in VR the landscape goes and the starfield flies (cube *Exit*) | back wall |
| 132-134 | Flying through stars (the starfield screensaver) | `starfield.glb`: three layers of small stars flying towards you (clip *Fly*, one skinned mesh) | VR only, at the way out |
| 030-036, 090-094 | The assistant's yellow balloon: "It looks like you're trying to go outside. Would you like help?" and "It looks like you're trying to be happy." | `clippy.glb`, our own paperclip (a bent wire, metallic, big eyes and eyebrows), about 35 cm, chilling on `clippy-lounge.glb` (a little deckchair, a cushion, a drink): clips *Chill* (default, breathing, blinks, a lazy look round), *Blink*, *Wave*, *Dance*; `clippy-balloon-outside.glb` when you come near him (he waves, cube *Clippy*), `clippy-balloon-happy.glb` when someone touches the grass (he dances, cube *Grass*) | floor, front left corner |
| 000 | The rubber duck "You" | `duck.glb`, a rubber duck | floor, front |
| 104, 160 | A flip phone with the hill on its screen | `flip-phone.glb`, a big flip phone standing in the grass | floor, grass |
| 166-180 | A clear glass CRT monitor on the hill | `glass-crt.glb`: a CRT in a small glass case (its see-through parts kept small) with the hill on its screen | floor, grass |
| 050, 176-180 | Big title "bliss" | `title-bliss.glb`, extruded italic 3D text with a shadow | front wall, top |
| 012, 080 | Windows on a CRT in a room; a bedroom lit by a CRT | left out: the room itself is the room | |
| 044-046 | A white room with a curtain | left out: the room is the viewer's own (AR) or the hill (VR) | |
| 100, 120, 124, 158 | A hand in grass; the performer; dancers | left out: no people (the grass and Clippy's dance carry it) | |
| all | The song | left out: no music and no lyrics. Every sound is our own synthesis: startup swell, shutdown, ding, critical stop, balloon pop, new-message chime, nudge, hardware in and out, click, recycle crumple, typing, solitaire flips, outdoor ambience | each an emitter at its object (`on`), so it comes from there |

The trigger cubes (`layout.json`; "everyone" cubes carry `all: true`, the studio's contract for v137):

| Cube | Who | Where | What it does |
| --- | --- | --- | --- |
| Entry | everyone, stays | a step ahead of the start | hides the boot screen, shows the welcome screen, "welcome back.", the giant cursor and its balloon; plays the startup swell once |
| Start | each person, while | at the start button | shows the Start menu with a click |
| Clippy | each person, while | round Clippy's lounge | Clippy waves, his balloon pops in |
| Recycle | each person, while | at the bin | the crumple |
| Chat | each person, while | at the left wall | the new-message chime, the chat's nudge (clip and sound), typing while you stand there |
| Door | each person, while | at the right wall | the door opens and stays open while you stand there, a click, the outdoor ambience from behind it; the hand cursor goes; "Go." and "Bliss: Sonoma County" balloons |
| Grass | everyone, while | the grass in the middle | "Found New Hardware: Grass", hardware in (and out as you leave), Clippy dances with "It looks like you're trying to be happy." |
| Solitaire | each person, while | back left corner | the solitaire win from its start, the flips |
| Task Manager | each person, while | at the back wall | the critical stop |
| Exit | each person, while | at the back wall's middle | "Turn off computer" and "It's now safe", the shutdown sound; in VR the landscape goes and the starfield flies |
| Error | everyone, while | back right corner | the error, the trail, "Close all your windows", the ding; the giant cursor goes while anyone is there |
