# Multiplayer: how to sync several headsets (rules and lessons)

Guidance for building shared sessions in this app: several headsets (usually 2-8 Quest 3, usually in one room)
and desktop browsers that see the same stories in the same state. It condenses what another WebXR project
(a graph viewer with a Node relay, built and tested on two Quest 3 headsets in October 2026) designed, reviewed
and learnt the hard way. Facts marked *verified* were seen on real headsets there; everything else is design.
The headset side (one room frame for everybody, Quest shared spaces, calibration, anchors) is in
[shared-spaces.md](shared-spaces.md).

## 1. Sync state, not events or intents

- **Publish outcomes, not intents.** The device where a person acts computes the result and publishes the new
  value of a **state key** (`story.flock.ctl.birds = "400"`, `story.robots.rule = 3`). Other devices set the value,
  and their own code reacts as if it had happened there (renderers redraw, panels update).
- **Never replicate events** (they report a change that already happened; replaying them changes nothing or
  loops) and **never replay actions** that read local state or are not reproducible (anything relative, random,
  GPU-computed, or dependent on local lists or counters). Re-running them on every device diverges.
- **Hook at choke points**, one per area, not at every call site: wherever the UI writes state directly, first
  route it through one setter (`setX(value, origin)`) that changes the state, fires the change event and
  publishes. An audit in the other project found ~115 direct state writes; setters were the fix.
- **One-shot effects that are not state** (a pulse, a beep, a falcon launched now) go as **ephemeral** messages,
  never stored.

## 2. The relay

- A small WebSocket relay (Node `ws`, ~300 lines) is enough: rooms, a **key -> {value, seq, author}** map per room
  (latest value only), a member list, and an **ephemeral broadcast channel** (presence, pointer rays, poses in a
  drag; 10-30 Hz, never stored). Every stored write gets the room's next sequence number; **last writer wins**,
  ordered by that number.
- **Rooms** have short codes (3 letters: ~17k codes; lab use only) and expire after some idle hours. Join by a
  URL parameter (`?s=XYZ`, not a bare `?XYZ`, which clashes with other flags). A list of open rooms
  (`GET /rooms`) lets a headset pick one instead of typing.
- **No auth: the code is the secret.** Fine on a lab network; say so in the docs. Keep data in the lab: the relay
  is self-hosted (nginx in front: proxy the path with the WebSocket upgrade, and ping every ~20 s, below nginx's
  `proxy_read_timeout`).
- Big values (blobs, position maps) go over HTTP, not the socket.
- Fallbacks considered and rejected there: WebRTC mesh (needs signalling and TURN anyway, no ordering
  authority), hosted SaaS (connection caps such as 10 per room; data leaves the lab), CRDT frameworks such as
  Yjs or Croquet (built for documents or bit-exact simulations; coarse keys suit better). Cloudflare Durable
  Objects run the same protocol on a free plan if self-hosting is impossible (quota ~100k requests a day: fine
  for sessions, not for days of 30 Hz traffic).

## 3. Client rules

- **Echo suppression by value**: publish a key only when its local value differs from the last value synced
  (published or applied). A global "applying remote" flag fails: deferred writes (timeouts, workers, animation
  ends) fire after it clears and echo.
- **Optimistic apply**: the acting device applies at once; a remote write to a key that has an unacknowledged
  local write is ignored (the relay orders the local write later, so it wins everywhere). The writer's own batch
  coming back is its acknowledgement. Sliders do not flicker.
- **Epochs**: when something resets a whole family of state (there: the dataset; here: what a station shows),
  write it with a new epoch; the relay drops every older key of that family and every late write of the old
  epoch, and clients buffer remote keys while they switch.
- **Apply order** in a batch and on join is fixed, dependencies first (what is shown -> its parameters ->
  selections -> panels -> poses). A key whose dependency is missing waits and is retried.
- **Atomic batches** for changes that belong together (a preset, a result plus the settings that show it).
- **Join**: connect the socket first; the relay's `welcome` carries the whole room state over that socket (no gap
  between a fetch and the stream). The room's values win; keys the room lacks are filled in from the joiner; an
  empty room takes the creator's state.
- **Reconnect** with backoff (1 s to 15 s), at once on `visibilitychange`, `online` and XR session start or end
  (headsets sleep); a ping every 15 s; a socket silent for 40 s is closed and reopened; on reconnect, refetch the
  whole state. Refuse to join (with a message to reload) on another app version or protocol.
- **Throttle out, coalesce in**: at most one write per key every 100-150 ms (leading and trailing, so the last
  value always goes), and apply remote changes at most once per frame (or every 250 ms on a headset).
- **Drags**: the dragger streams the pose as ephemeral messages (at most every 100 ms, leading and trailing) and
  stores the final pose on release, so late joiners get it. Receivers **ease** towards the latest target every
  frame (time constant ~60 ms): ~10 updates a second look smooth (*verified*: 79 intermediate steps for a 1 s
  drag). An object dragged here ignores remote moves until released. A soft lock per object (with a timeout)
  refuses a second dragger.
- **Spawn claims**: when several devices would place the same new thing (a panel both open from a config), each
  waits a random 0.3-1.2 s; the first to publish a pose wins and the others adopt it.
- **Per-device state is never synced**: hover, tooltips, camera, render quality, the open state of menus, toasts,
  desktop window positions. Classify every field as shared or local; mixed objects need splitting.
- While in a session, do not write shared state to `localStorage` (keep it in memory); leaving (a reload) gives
  the person's own state back. No stash-and-restore.
- **No undo** in a first version.

## 4. Diagnostics

- Keep a ring buffer of the last ~1000 session events in the page (`window.__collabLog`: socket open and close,
  welcome, publish, ack, receive with seq and key names, apply decisions, reconcile decisions, alignment steps,
  reference-space resets) and print it to the console with a debug flag. Read it from a headset over the Chrome
  DevTools protocol (see [shared-spaces.md](shared-spaces.md), testing).
- The relay logs every write: room, member, seq, key names, or why it was dropped.

## 5. Bugs met in the two-headset test (and their causes)

| What people saw | Cause | Lesson |
| --- | --- | --- |
| Things stuck or jumping back; the room's epoch at 15,880 after minutes | keys outside a known family were published as **deletions** every 200 ms | never publish "no value" by default; the relay refuses nonsense writes (`null` for a required key) |
| A panel jumped after ~1 s, again after a change | both headsets published their own spawn pose; a recreated panel spawned anew | spawn claims (above); change things in place instead of recreating |
| An edit mode ended at once when a second headset joined | a remote apply of the same key ended the local edit | while someone edits here, remote values for that key wait |
| Panels did not move after a recalibration | missing poses were published as deletions | as the first row |
| Recalibration needed on every AR entry; "alignment quirky" | the `local` reference space (origin re-made per session), frames never reconciled, fit from live bounds | see [shared-spaces.md](shared-spaces.md) |

## 6. Open points worth testing early

- Do WebSocket messages and timers keep arriving during an immersive session on Quest Browser? (One report saw a
  drop on entering VR; if so, drain the queue in the XR frame loop.) The other project's relay worked during AR
  sessions in practice.
- The cost on a Quest of applying remote changes (coalesce them).
- Scripted bot clients (a test hook on `window`) make repeatable two-client tests without headsets; two desktop
  tabs cover most logic; only alignment needs two headsets.
