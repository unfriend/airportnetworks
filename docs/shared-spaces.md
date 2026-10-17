# Shared space: one room frame for several headsets (Quest)

How co-located headsets agree on where things are, so people in one room see the same virtual objects in the
same physical place, can point at them together, and so on. Condensed from another WebXR project that built and
tested this on two Quest 3 headsets (Quest Browser 152, October 2026). *Verified* marks what was seen on
devices; the rest is design or the browser vendor's explainer. Syncing state between the headsets is in
[multiplayer.md](multiplayer.md).

## 1. The problem

Each headset tracks in its own reference space. With **`local-floor`** the floor height agrees (gravity, y = 0
on the floor), but the yaw and the x/z origin do not. WebXR anchors exist on Quest Browser (persistent ones
too) but only per device; Meta's shared spatial anchors and colocation are for native apps, except through the
experimental *shared spaces* below.

## 2. Use `local-floor`, never `local`, for anything shared or saved

- `local` puts the origin at the head when the session starts and makes it again per session and on every
  recentre: a room frame or a placement saved in `local` coordinates lives in a dead coordinate system after
  the next entry. This was the main cause of "quirky alignment" there.
- `local-floor` is the Guardian (stage) origin: stable across sessions on the same headset. Verify it by logging
  the viewer height (*verified*: 1.73 m standing).
- **This app uses `local` today** (`setReferenceSpaceType('local')` in every story's `e5_xr.js` or its hand-written
  copy) and treats the floor as 1.6 m below the head. A shared space needs `local-floor` (with a fallback to
  `local` when it is refused), and every story's placement code must then use the known floor.

## 3. The room frame

- **Room frame** = an origin and a horizontal x axis per headset, in that headset's `local-floor` space. Make it
  the matrix of **one root group** that holds everything placed in the room (there: panels, the graph box;
  here: the stations, their panels and stories). Content is then stored in room coordinates natively, and a
  calibration, an adoption from another headset or a reference-space reset only changes that one matrix.
- Store every shared pose (station places, panel poses, pointers) in room coordinates, in metres.
- A **reference-space reset**: with a transform, correct the frame (content follows through the root); without
  one, change nothing (with `local-floor`). Attach the `reset` listener at session start, not on the first frame.
- Never let a reset move shared content for everybody: shared poses live in room coordinates and are never
  rewritten by a local reset (only the local frame is).
- Stick locomotion in VR must move the rig (or the room transform), never every scene child, or shared poses
  drift per person.

## 4. Getting the frame: the alignment state machine

One idempotent `ensureAligned()` per session, run on headset entry **and** when the session connects (joining
while already in AR must align too). States: unaligned -> shared space adopted | shared space defined | marks
-> aligned; show the state in the UI.

1. **Shared space available** (see section 5): if a room frame was published for this shared space's id, adopt
   it ("Aligned automatically"). If nobody published within ~8 s, use this headset's saved marks, else the
   shared space's own origin, and publish that.
2. **No shared space**: this headset's earlier marks ("Room calibration from last time"): first the
   **persistent anchor** made at mark A (its pose survives a moved Guardian origin), else the saved
   `local-floor` coordinates, else calibrate.
3. **Two-point calibration**: the person touches mark A, then mark B, with the controller tip (tape crosses on a
   table or the floor, as far apart as comfortable, e.g. diagonal table corners). A gives the translation, A->B
   the yaw, gravity the rest. Expected accuracy 1-2 cm and under 1 degree (controller error ~3 mm; rotation
   error ~ touch error / distance). About 20 s a person. Only frames from marks are saved. Marks are the
   controller's target-ray origin: hold it the same way at both marks.
4. **Reconciliation** (twice a second while a shared space is known): a headset whose frame differs from the
   room's for this shared-space id by more than **3 cm or 1 degree** adopts it ("Re-aligned"), unless its own
   marks are newer, in which case it republishes and the others follow. A published frame for another id whose
   publisher is still in the session is left alone (two groups in two spaces; marks are the reference then);
   a stale one (publisher gone) is replaced.

VR users and people in other rooms skip all this: their room frame is their own floor origin (they share the
content, not the room).

**Persistent anchors** (Quest Browser, optional feature `anchors`, *verified* working): create one at mark A with
the frame's yaw after each calibration, keep its handle in `localStorage`, delete the old one (**8 per site**).
Restore it next session and read the frame from its pose. Restoring took more than 3 s once (*verified*): allow
about 8 s. This app's `HOST.anchor` already manages one persistent anchor per site for headset placement; a
room-frame anchor must share that budget and code.

**Notices** in the headset: a small self-closing panel in front of the person for each step ("Aligned
automatically", "Shared space found", "Room calibration from last time", "Calibrate the room" with the how-to
and the flag tip, "Room calibrated", "Re-aligned").

## 5. Quest Browser shared spaces (experimental)

- Since Quest Browser v39 (June 2025): headsets in the same room get a **common reference space** with an id, so
  coordinates can be exchanged directly. Built on Meta's colocation. Explainer and demo:
  https://github.com/cabanier/shared-spaces (demo https://sharedshooter.arvr.social/).
- API: add `'shared'` to the session's optional features; once the session runs,
  `session.requestReferenceSpace('shared')` returns an `XRSharedReferenceSpace`.
- Verified on Quest 3 (browser 152): `session.enabledFeatures` listed `shared` (requested with
  `optionalFeatures: ['hand-tracking', 'shared', 'anchors']`). The id property is spelt **`UUId`** (not `uuid` as in
  the explainer; read `UUId ?? uuid ?? UUID`), and it is **empty right after the request**: it arrives with the
  space's `reset` event 0.1-4 s later. `frame.getPose(shared, localFloor)` returns a pose **only inside the XR
  frame callback** (null from a timer with the last frame).
- Behaviour (explainer): finding the right space can take a few seconds (a default one is reported until then;
  then `reset` fires with new coordinates and a new id); **no reset for the first headset** to go immersive; the
  common origin is the first headset's origin; bounded by the room's size; **per page URL** (keep the URL
  identical on every headset, query string included, until known otherwise); a headset that leaves WebXR loses
  the space; the space is gone when the last one leaves.
- Hence: **do not use the shared space as the room frame itself** (its origin is the first headset's and it is
  lost when everyone leaves, so stored poses would move between sessions). Use it only to **transfer** a room
  frame: publish `{ uuid, o: [x, y, z], x: [x, y, z], by, at, src }`, the room frame expressed in shared-space
  coordinates (`localFromShared = frame.getPose(shared, localFloor).transform.matrix`).
- Requirements on every headset: `chrome://flags` > "WebXR experiments" > Enabled, then **restart the browser**
  completely; **Enhanced spatial services** on (Quest settings, privacy / device permissions; Meta requires it for
  colocated experiences); all headsets in the same room, on the same page, the first staying in AR while the
  others enter.
- **Seen there**: two headsets in one room got **different** ids (probably enhanced spatial services off; not
  re-tested). Same id on all headsets = colocated. Keep the two-point calibration as the fallback.

## 6. Panels and placed things

- Shared panel poses are applied directly in room coordinates; a local drag wins while it lasts. Publish a pose
  only for real moves (2 mm tolerance), after a drag, or as a spawn claim (random 0.3-1.2 s wait; see
  [multiplayer.md](multiplayer.md)).
- Dispose panels at session end and place them anew in the next session (old world poses are wrong).
- Changes below a few millimetres are rounding: no refit, no republish (resets re-round values).
- Fit content from stable bounds (a layout's bounds), never from live bounds that move while people drag
  things, or headsets that apply the fit at different times get different scales.

## 7. Testing on headsets

- WebXR needs a secure context. Serve over HTTPS on the LAN, or use `adb reverse tcp:<port> tcp:<port>` per
  headset (USB or Wi-Fi adb) so `http://localhost:<port>` is secure.
- DevTools per headset: `adb -s <serial> forward tcp:922X localabstract:chrome_devtools_remote`, then the Chrome
  DevTools protocol on `localhost:922X` (`curl -s localhost:922X/json` lists targets) to navigate and evaluate
  (read the session log ring buffer). Never take DevTools screenshots while the headset presents.
- Quest Browser 152 refuses `requestSession` without a click; `navigator.xr.offerSession` shows the browser's own
  Enter AR prompt, which the person accepts with a controller.
- Long-running servers belong in the person's own terminal (background shells of agents stop).
- Log, in the session ring buffer: the session's enabled features, getting the shared space (and its property
  names), its resets and id, publishing or adopting a frame, fallbacks, viewer height, reference-space resets.

## 8. Open questions (from that test)

1. Does enhanced spatial services give both headsets the same shared-space id?
2. Does the query string count as part of the page for the shared space?
3. How long does a second headset take to get the first one's id?
4. How accurate is the shared space compared with tape marks?
5. Is a reset with a transform on `local-floor` right at session start related to the shared space?
