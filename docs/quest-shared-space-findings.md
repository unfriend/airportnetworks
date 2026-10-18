# Quest shared spaces: what we learnt

October 2026. From a WebXR app that lines up two Quest 3 headsets in one room (Quest Browser) for one shared
scene. It adds to the notes `shared-spaces.md` and `multiplayer.md`. Their design held: keep a room frame in each
headset's `local-floor`, pass it on through the shared space, use two tape marks as the fallback, keep anchors to
follow origin jumps, and follow a new frame only past 3 cm or 1 degree. What the notes did not say is how Quest
behaves. We learnt that from alignment logs both headsets sent to our relay. Each item says what we saw and
what we do about it.

## In short

1. Give every headset the same Quest Browser version. The same shared-space id does not mean the same space.
2. The first headset's space is exactly its own floor. Decide "first" or "not joined" when the id appears.
3. A `local-floor` reset transform maps old coordinates to new ones. Use only its turn and its move along the floor.
4. After waking, the shared space gives the head's pose for up to 15 s. Ignore it, and hold the frame.
5. Take the room's floor from the tape marks, not from each headset's floor.
6. The persistent anchor store fills up. Delete unknown anchors, then ask again.
7. Send each headset's log to a server. Nothing here could be seen from inside one headset.

## 1. One browser version on every headset

- **The same id is not one space.** In three tests both Quest 3s reported the same shared-space id, but they
  were never in one space. Quest Browser 149 got the id at once with an identity pose: its space was its own
  floor, a new place every session. Quest Browser 150 got a default space for 1.5 s, then the real one, which
  held to 1-2 cm over 71 minutes and three sessions.
- So the error between them was a different rigid offset each session (0.9 m and 19 degrees, then 1.2 m and 28,
  then 2.4 m and 84). That is two spaces, not one inaccurate space.
- With both headsets on the same version, the shared space lined them up with no tape at all.
- What we do: show the browser version on the panel. Judge a space by how far it puts two calibrated headsets'
  marks apart (shown on the panel too), never by its id.
- Read the id every frame. It is empty right after the request, and it can arrive or change without a reset.
- Our reading of the pose is right: `floorFromShared = inverse(localFloorInLocal) x getPose(shared, local)`. It
  kept each headset's own marks in one place across its resets to 1-2 cm. Read the other way round they moved
  by 80 cm and more.

## 2. First in the space, or not joined?

- The first headset's space is exactly its own floor (an identity pose). So is a space a headset has not really
  joined. The pose cannot tell them apart.
- We decide once, when the id appears: if someone in the room has already published a frame for that id, this
  headset is not the first. An own-floor space then means "not joined": nothing is taken or published through
  it, and the panel says "Not in the others' shared space".
- If someone here published for a different id, the others are elsewhere. This headset's own space then never
  becomes the room.
- The id stays the same across sessions and days, so a frame stored for it may be last time's. If its writer has
  left, everyone waits 8 s, then the first headset replaces it with its own.

## 3. Standby and waking

- **Reset transforms.** On waking, `local-floor` fired two `reset` events with a transform. The matrix carries
  points from the old coordinates into the new ones, the opposite of how we had read the spec. Applied inverted,
  it turned the room -126 degrees instead of +126. Applied this way, it matched a fresh calibration on the same
  tape within 1 to 1.5 cm.
- Its height is the change in the head's height, not the floor's. Use only its turn about the vertical and its
  move along the floor.
- **The head glitch.** For up to 15 s after waking, `getPose(shared, local)` returned the head's pose on both
  headsets. Frames published or compared then were metres out. We ignore a shared pose within 5 cm of the head,
  and publish or compare nothing through the space for 20 s after waking.
- **Holding the frame.** After waking, the frame the resets carried over holds until the shared space agrees with
  it again (10 cm and 3 degrees along the floor), or until the space has held still for 5 s and is not just this
  headset's own floor.
- **The height.** The floor came back 12 to 17 cm off after waking. With the shared space in use we keep the
  room's height in the space's coordinates, not over the floor.
- **Anchors.** Anchors made during the session were not tracked again after waking. We wait up to 5 s, then look
  them up again by their persistent handles. Waking never drops a calibration: asking to calibrate after every
  wake was worse.

## 4. Floors and origins move

- Two headsets' floors differed by 28 cm in one test and about 50 cm in another. One wearer's head read 1.9 to
  2.05 m.
- What we do: the first headset to calibrate stores mark A's height over its own floor (and the distance between
  the marks, to recognise the same marks later). Every other headset puts the room's floor that far below its own
  mark A, and the panel says by how much its floor differs.
- In one session a headset's whole origin jumped 5.5 m and its floor 0.7 m. In our logs a recentre moved
  `local-floor` with no `reset` event we could see. Two anchors at the marks (positions only) catch both.

## 5. The persistent anchor store fills up

- `requestPersistentHandle` failed with "Maximum number of anchors reached!". One Quest 3 refused every handle
  with 9 anchors listed for the site; the other saved with 11 listed. So the limit is not simply per site. Meta's
  docs say 8 per site; the browser's author says a limited set across all sites.
- That headset asked to calibrate after every restart.
- What we do: at session start, delete saved anchors nobody knows (`session.persistentAnchors` minus our own
  handles). When a handle is refused as full, delete again and ask once more. If it is still refused, the marks
  hold for this session only, and the panel says a restart will ask to calibrate. Clearing the browser's data
  should free the store (not confirmed on our headsets).

## 6. Calibration details

- Take a mark where the controller's ray origin was 70 to 260 ms before the trigger: pulling the trigger moves
  the controller. Show that point as a ring.
- Ignore a second pull within 0.6 s (a double pull once took mark B 0.1 s after mark A). Ask for marks at least
  50 cm apart, and add a note when they are more than 5 cm apart in height.
- A headset's own marks always win over a frame from the shared space. A calibrated headset still publishes its
  marks through the space and shows how far the space puts another calibrated headset's marks from its own.
  That distance is the best accuracy test we have.

## 7. Log to a server

Every 10 s each headset in a room posts its log to the relay. The log holds alignment samples every 5 s (the
frame, `local-floor` in `local`, the shared space in `local-floor`, the head, the anchors), every reset with its
transform, anchor results with the browser's reasons for refusals, the browser version and the page address.
Comparing both headsets' logs afterwards found every item on this page.

## Still untested on headsets

Whether headsets line up again after standby with these rules, whether restored persistent anchors hold, and
whether a recentre ever fires a reset.

## Sources

- Shared spaces explainer and demo: https://github.com/cabanier/shared-spaces
- Meta, WebXR mixed reality (anchors and their persistence):
  https://developers.meta.com/horizon/documentation/web/webxr-mixed-reality/
- Persistent anchor limits and deleting them: https://github.com/immersive-web/anchors/issues/79
