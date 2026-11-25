# Shared rooms and the PC's Vive trackers

Read on demand; the rules every agent needs are in AGENTS.md. History (old versions, the owner's dated words) is kept apart; this file says what is true now.

## Shared rooms (`shared.js`, `relay/`)

Several headsets and desktop pages join a room on the relay (`#s=XYZ` in the
address while joined, the same on every headset; `&relay=wss://...` when the
relay is not the page's own origin). A room holds **stations**: `st.<id>` =
`{ story, x, z, yaw }` in room coordinates (metres, floor y = 0, yaw 0 faces -z;
the content floats 1.4 m ahead of the spot), with `st.<id>.play` (the clock:
`{ mode, t, playing, at }`, `at` in relay time), `st.<id>.x` (the story's
`collab.state()`), `st.<id>.panel` (the story panel: `{ x, y, z, yaw }` from the
spot, y over the floor) and `st.<id>.place` (the scene: `{ x, y, z }` moved from
where the story puts it, and `s` its size, a factor on the story's own; FORMAT
networks-8; both gain `q`, `[x, y, z, w]` to 4 decimals, the scene's turn and the
panel's tilt left by a free grip, absent when there is none; FORMAT networks-22),
`st.<id>.view` (the explore view there, `{ v, story }`, `v` the story's `collab.view()`; FORMAT networks-26; a write of
any of these, or of `st.<id>` itself, that carries a move by hand also has `ts`, the relay's time when it was written in
whole ms, and `h: 1` while it is still held: "Others' moves, smooth" below),
`st.<id>.arr` (the copy of its story the station runs, `{ v, story, by, at }`: `v` a copy's name on the relay, an
arrangement of the story's timing and places; written by whoever opens a copy at that station or saves one there, `at`
moving on so every device reads it again; `null` (or absent) the story as its own; gone with the station's other keys
when it shows another story; never refused by the circles lock; the arrangement itself is never in the room; FORMAT
networks-54; "A story's copy" in `docs/agents/shell.md`), `st.<id>.ui` (the station's panels and its story's lock, `{ panels, lock, story, by, at }`: `'shown'`, `'controls'` or
`'hidden'`, and `lock` true for *Lock this story*, for every headset at that circle; set from a headset's menu there or a
page's Shared dialog, never refused by the circles lock; a write keeps the other field; absent: shown, not locked; gone
with the station's other keys when it shows another story; FORMAT networks-25), `lock` (the circles lock, `{ on, by, at }`,
below; FORMAT networks-6),
`look` (the headsets' four settings, the two sound switches and the circles walked into or asked first, `{ labels, cards, free, subs, sfx, voice, ask, vg, by, at }`: set by anyone,
from a page's Shared dialog or a headset's menu, never refused by the circles
lock; a room without it gives labels on top, cards in 3D, no subtitles and circles asked first, and leaves a sound switch it never wrote to each device; free moving turned off takes
every `q` out of the stations' places and panels in the same write; `ask`: "Circles asked first" below, FORMAT networks-33, asked first by default since networks-35; `vg`: a number every press of Narration for everyone moves on, so each headset's own narration in the room goes, kept by every write of `look`: "The narration" under "Sound effects", FORMAT networks-36), and per area `rp.<id>` (an area's tape crosses: "Areas" below; FORMAT networks-41), and per shared space `rf.<space id>` (the room's frame in it) and
`rs.<space id>` (found split; FORMAT networks-9), `sg` (the room's shared-space
generation, `{ n, by, at }`), `near` (*Show on this network*, `{ on, by, at }`: absent or on, the room is listed under
*Rooms on this network*; set by anyone in the room, never refused by the circles lock) and `rid` (the room's own id, ten
letters written once by the page that made or holds it: a room joined again by itself can be told from another room
under the same code), `trk` (the PC's trackers in this room, `{ on, m: { a, b } | null, names, by, at }`: "Vive trackers"
below; set by anyone, never refused by either lock; FORMAT networks-38), `name` (a label for the room, `{ v, by, at }`: "Room names" below), and `pcam` (the desktop preview camera's place, `{ p: [x, y, z], q: [x, y, z, w], fov, ts, by }` in room coordinates: "The desktop preview camera" below; set by anyone, never refused by either lock; FORMAT networks-48). The current `FORMAT` is networks-59 (`shared.js`; v208: the cell story's `collab.state()` gains `net`, a network shared through the relay, below; networks-58, v207, its `lim`; networks-57, v205, its `cx` and sides; networks-56, v197, the VR goggles' shape; networks-55, v172, a circle's `ask`; networks-54, v170: a station's `st.<id>.arr`, the copy of its story it runs; before it networks-53, v164: a studio object's `anim: 'move'` and its `idle` and `strideK`, "As it moves" in `tools/studio/SPEC.md`; before it networks-52, v158: the studio's `stream` and `trail` fields, a path's `sync`/`beats`, a sequence's `beats` and its events `press` and `send`, the scene's `hands`, `bt.bar`, "The output page" below and `tools/output/SPEC.md` "v158"; before it networks-51, the output page, MIDI and OSC: the studio's `send` entries, a motion's `beat`, its state's `sw.<id>` and `bt`, the effect `send`, and `out` in hello and presence; "The output page" below); bump it whenever the keys or a story's `state()` change shape (every bump so far only added fields and keys; their history is in the history notes). The shell's own circles: an All stories circle `st.<id>` = `{ story: 'all' | <a story's key>, kind: 'all', sync, arc, x, z, yaw }`, a lobby circle `{ story: 'lobby', kind: 'lobby', x, z, yaw }`, with the room's key `allp` (`{ by, at }`, `pg: 1` while the arc is a page's); a studio circle made for a scene `{ story: 'studio', sc: true, x, z, yaw }`.
The plan is `docs/shared-space-plan.md`.

- All stories and Back to the lobby (the owner: a circle with all stories, like the single-player story menu, the default for new shared rooms; and a Back to the lobby circle). Two kinds of circle that are the shell's own, not stories: never in `stories/list.js`, never started
  (`HOST.start('all')` would refuse); `KINDS` in `shared.js` gives their look wherever a station's is taken (cards, rings,
  icons, the dialog and its map, the menu's lists, people and Follow lines): All stories (`'all'`, kicker *Every
  story*, a pale cyan-white `#cfeeff`, icon `all.stories`) and Back to the lobby (`'lobby'`, kicker *The lobby*, a soft
  green `#9fe5bf` (the design room has the gold), icon `all.lobby`); a key whose miniature's file is not here yet shows the glowing fallback. `lookKey(s)` is a
  station's kind, else its story; `runs(s)` the story it runs ('' for an All stories circle's cards and the lobby);
  `stTitle(s)` "All stories" (": <the story picked>"), "Back to the lobby" or the story's title.
  - The first headset adds one (`allFirst`, from the shell's tick): a headset in the room with the others (AR, or VR
    answered "in this room"; never one elsewhere), aligned, in its session, the circles not locked, in a room that has
    never had one put there by itself (`allp`, written in the same batch, so once per room: a removed one does not come
    back) and that has none (one added by hand on a page is enough), the conditions holding 1.5 s (a room refilled after a relay restart comes back empty first), once per page
    and room: an All stories circle 1.2 m ahead of its head along the floor (just outside the 1.1 m walk-in: one step and
    you are in it), facing away from it (its cards float ahead, as on the Stories screen), Own stories, always under one
    id (`all01`), so two headsets that place it at the same moment place one circle (the last writer's). It is
    the room's arc (`arc: true`, below) when the room has no other circle, standing where the headset stands (not 1.2 m
    ahead: its cards then float about 1.25 m in front of it, as on the single-player Stories screen), else an ordinary
    circle 1.2 m ahead (`arc: false`); and a room a page started already has the page's arc, which the first headset
    moves to where it stands instead, as
    long as it stands where the page put it (`allp` with `pg`; `allp` is then rewritten as the headset's). Tests turn
    both off (`HOST.collab.autoAll(false)`, or `localStorage` `collabAutoAll` = `off` before the page loads: every
    device in `tools/collab.mjs` starts so, and its pretend headsets keep it off, unless the All stories round asks).
  - The room's arc (the owner: the room behaves as a shared single-player room, its arc dragged by anyone, a circle once another circle is placed or Arrange all runs; anyone may move it, the circles lock stops that). A room starts as a
    shared version of the single-player Stories screen: one All stories circle, `st.all01` with `arc: true` (`arcSt()`,
    `HOST.collab.arc()`), made by the first headset (`allFirst`) or by a page that starts a room or joins one with no
    stations (`pageArc`, from the pump: at the room's origin facing -z, once per page and room, after the room has been
    empty for 1.5 s, with `allp` `{ by, at, pg: 1 }` written in the same batch, so the first headset moves it in front of
    itself and a removed one does not come back).
    - Everyone is at it without walking in (`arcStep`, from the pump and every headset frame): every aligned headset in
      the room with the others (AR, or VR answered "in this room"; one elsewhere walks into it as into any circle) has it
      as its live station (`choose(id, 'arc')`: `C.live`, `C.mine`, so `cards()` is true, `away()` false and `place()`
      puts the rig at its spot: everyone sees the same arc of cards at one place in the room; presence says `st` is the
      arc), and every page follows it (`C.follow`) and shows its Stories screen (`pageCards`), no Follow needed, unless
      it left it by hand (Stop following, or a story of its own: `C.arcOff`, per room). A pick there plays for everyone
      at it (`allPickAt`, in front of the arc), and the story panel's Stories button goes back (`allBack`). `zoneStep`
      never walks into it (it is live anyway). In a headset at it nothing of it is drawn (`drawPreviews`: no ring, card or
      icon; its cards are the circle).
    - Dragging it: the grip on its cards (the story's own panels: the ray's `near` from `HOST.collab.ray`) or in an
      unseen volume round them (`arcHit`, `ARC`: 0.7 to 3.1 m from its spot along the floor, within 1.35 rad of its
      facing, 0.95 m below to 0.75 m above the eyes; generous, for one arc or two rows of cards), only while its cards
      show, carries it for everyone as a station is carried (`grabStation`, `carryStation`, `sendStation` with `ts` and
      `h`; the others' cards glide, `SHOWN`): the point held stays under the ray (`MV.off`, `offAt`), swinging round
      the hand as you point, pushed away as you raise the controller, turned as you twist. The trigger still picks
      cards (the shell claims no hover for the volume). Refused while the circles are locked (`refused`, its notice).
      Move here (the menu) and the page's room map move it too; every write of it carries `arc` (`stVal`).
    - Turning it into a circle: the first other circle placed (`add`: the page's Add, the headset's Add here, Design room
      here, the lobby, another All stories circle) or Arrange all (`arrange`) writes `st.all01` with `arc: false` in the
      same batch (`arcEnd`): an ordinary All stories circle where it stands (ring, card, icon; walk-in from then on;
      Arrange all leaves it where it is). Headsets and pages at it stay with it (a station is left only by walking into
      another one); a headset that took it as the arc (`C.arcd`, never walked into it) sees its ring, faint as your own
      station's, while it stands outside it (more than 1.1 m from its spot), so it knows where the circle is. Removing
      every other circle leaves it a circle. An arc beside another circle (two writes crossing) is turned into a circle
      by whoever sees it.
    - Older rooms: a room kept on a device or a relay (revived from a copy) whose only station is `all01`
      (kind all) without `arc` becomes the arc as it is joined (`arcStep` writes `arc: true`); one with other circles keeps
      it a circle. A room of another `FORMAT` is refused as ever (devices update).
  - Walked into (as any circle), it is the headset's live station. Showing its cards (`HOST.room.cards()`), the story
    loaded hosts the single-player Stories screen there (the stories open it while `cards()` is true, below; the
    shell's `place()` puts their rig at the circle's spot, so the cards float ahead of it), the scene hidden, the story
    paused, nothing synced (no story there: `synced` is false, nothing goes out), not away (`away()` is false, so the
    cards are pointable). `HOST.room.allHere()` is true while the live station is an All stories circle, cards or a story;
    `HOST.room.allBack()` sends it back to its cards, for everyone there.
  - Picking (`allPick`, which `HOST.start` and the page's Stories screen ask first; `allPickAt(id, key)`): at an All
    stories circle a person's story (a card on the headset, the page's Stories screen while following it, the dialog's
    picker) never leaves the station: it is the circle's pick, written for everyone there, `st.<id>` with that story
    and, on its own keys, `st.<id>.play` `{ mode: 'story', t: 0, playing: true, at }` in the same batch (the relay drops
    the circle's other keys first: the epoch rule), so every headset and page at the circle switches to it from its
    start, playing, as a station given another story does. The story panel's Stories button there (and *Back to all
    stories* in the menu's Circles tab, and *Choosing a story* in the dialog's picker) writes `story: 'all'` again: its
    keys go. Repeat does not run at a station (a story's end opens explore mode there, as at any circle).
  - The switch (`sync`; *Own stories*, the default, or *With the room's circles*; `setAllSync`): the menu's Circles tab at
    that circle (a row under the two locks, beside *Back to all stories*) and the circle's row in the page's dialog;
    never refused by either lock. With it on and a circle of the picked story in the room (not an All stories one; the
    first by id), the All stories circle joins that circle's session (`sessOf(s)`, `sesSt()`: the station whose keys hold
    the clock, explore state, view, scene place, panel, panels and lock (`st.<other>.*`) and its effects (`e.<other>`);
    `liveSt()` stays the circle you stand in, for the rig, the sound zone, the cards, the people drawn and your
    presence's `st`), so people at both circles see the same moment and what one changes the other sees; the panel and
    scene are placed relative to each circle's own spot. A pick in sync mode writes only the circle's story (never the
    other circle's clock); with no such circle it runs on its own keys. Turned off with a story running in a linked
    session, its own keys are seeded from where that session is (its clock, explore state, scene place, panel, view,
    panels and lock; own ones that session does not have go), so the story goes on and nothing jumps. A linked circle
    that goes (removed, or given another story) leaves the circle on its own keys: the people at it write its clock and
    explore state from where the story is with them, so they stay together. Moving an All stories circle (the grip, the
    map) writes its story and switch as the room has them at that moment (`stVal`), never an older pick back. When the live
    station's story or session changes with the story already loaded, the room's clock and state apply at once
    (`C.liveSig`).
  - Back to the lobby: walking into it ends the headset's live station (no story: away, the story hidden, paused and
    silent, nothing of it goes out), and the room shows as before any circle (every ring, card and icon, everyone
    drawn); it is never a live station itself, its own ring, card and icon stay, and walking into a story circle after
    enters it as usual. No automatic lobby circle (the owner: "no automatic placement for now"). It is walked into with
    the circles asked first too, its ring hidden then (the owner: in the lobby the headsets go to the lobby automatically: "Circles asked first" below). Going to it,
    by walking in or *Go in*, in either mode, calls the story loaded's optional `lobby` hook (`HOST.cur.lobby()`, in its
    returned object; the studio's forgets what this headset has seen there, its cubes starting afresh).
  - Pages: a page following an All stories circle shows its Stories screen while the cards show (`pageCards`; a pick
    there is the circle's) and follows the story picked as any station (in sync mode, the linked session); the room's
    arc is followed without Follow (above). The dialog's row of an All stories circle has a picker (*Choosing a story* or
    a story) and its switch (the arc's says it is for everyone in the room until another circle is added); the lobby's row has no
    Follow, Panels or Lock (only Remove), and a click on its dot follows nothing.
  - Add (the dialog's picker and the headset's *Add here* page) offers *All stories* and *Back to the lobby* after the
    design room; moving, turning, removing, the circles lock and the map work on them as on any circle (a move keeps
    `kind`, `sync` and `arc`: `stVal`). Arrange all leaves both where they are (and turns the room's arc into a circle).

- `HOST.collab` keeps the room's keys (echo suppression by value, optimistic
  writes acknowledged by the relay, apply order stations > clock > state >
  panel; a moving thing's value compared without its `ts` and `h`), members, the relay's clock (ping/pong), presence
  (`p.<member>` at 15 Hz, with `ts`) and effects (`e.<station>`); it reconnects with backoff and brings the
  room back after a relay restart; its pump runs from a timer and from
  animation frames (long frames starve timers). Log: `window.__collabLog` (and
  `#debug`).
- Peer to peer (no relay; so the copy on GitHub Pages has
  rooms too). A room runs on the relay when the page knows one (or is served by
  one); when no relay is known, or the relay cannot be reached as the room is
  joined (no answer within 6 s), it runs peer to peer (`C.via`: `'relay'`,
  `'peer'` or `'local'`; `C.local` still means this device only). PeerJS
  (`peerjs.min.js`, loaded on demand from `appRoot()`) and its introduction
  server (PeerJS's public one, `0.peerjs.com`, by default; `&peer=host[:port][/path]`
  in a link, or `peer:host...` typed in the Shared dialog's relay field, picks
  another, such as the relay's `/peerjs`; `&peer=off` turns peer to peer off;
  kept as `collabPeer` in `localStorage`, and a room's link carries it)
  introduce the devices, which then talk directly over WebRTC data channels
  (Cloudflare's STUN server, `stun:stun.cloudflare.com:3478`, is the only ICE
  server; no TURN, so the devices need a network that allows direct links). The
  room's id there is `lbinet-<FORMAT>-<code>` (devices of another version never
  meet). Whoever holds the id hosts: a new room takes a free code whose id is
  free; a link or a kept room takes the id when nobody holds it (hosting this
  device's kept copy) or links to its holder. The host runs a `Hub` (the relay's
  rules, as for a room on this device: the welcome, a batch as one seq, the epoch
  and stale rules, refusals, members on hello and leave, `fx` passed on with
  `by`, pong with the room's time, the relay's limits on sizes and rates; keys
  kept in `localStorage` as a room on this device) with its own page through an
  in-page socket (`LocalSocket`) and each guest through its link; a guest's
  `PeerSocket` has the WebSocket face the shell uses and carries the relay's
  JSON (long texts in pieces), so join, connect and recv barely changed. Guests
  ping every 2 s. The host goes (Leave, `pagehide`): it destroys its PeerJS peer,
  freeing the id at once; the guests' links close and the one longest in the
  room (members' `since`; the others 1.5 s later each) takes the id over with
  its own copy (`C.keys`, seq from the highest seen) and its measure of the old
  host's clock as the hub's (`Hub.off`), so stations play on without a jump; the
  others find the id taken and link to it. A host not heard from for 6 s (a
  headset taken off): each guest keeps its link and tries now and then (in that
  order, then backing off) to take the id or link to whoever holds it, and a new
  link that opens replaces the old one. Known limit: a host that vanishes without
  letting go (asleep, out of Wi-Fi) holds the id until the introduction server
  times it out (PeerJS's public server: up to about a minute; the relay's:
  `--timeout`, 40 s), so the room waits that long. Meanwhile the room stays as
  it is on every page and the menu and dialog say "The host has gone: taking
  over"; writes made meanwhile give way to the room's when it is back, as with
  a relay that was away. A headset that hosts hands the room to the first screen
  (a laptop or desktop page, `dev` in its hello) that joins: it tells everyone
  who is next (`host`), lets go of the id, that screen takes it at once and the
  headset links back as a guest. A host whose id lapsed while its server link was
  away and was taken by someone else steps down (its guests link to the new
  one; writes made on the old host meanwhile are lost). Off peer to peer: Fresh
  shared space (`canFresh`) and the headsets' logs (`POST /api/log`). A room
  that runs peer to peer stays so until everyone has left (no move to a relay
  found later: every member would have to move at once); a room on this device
  that fell back because peer to peer failed asks again (probe, with the
  relay). When PeerJS cannot be loaded or its introduction server does not
  answer within 8 s (counting only time the page was awake), the room is on this
  device only, as below; when the server answered but no link to the host opens
  (15 s), it keeps trying. Recommended (and said in the dialog): start a
  peer-to-peer room on a laptop or desktop page that stays awake. The shell's
  listener bookkeeping must not take PeerJS's: `shared.js` makes
  `RTCPeerConnection` and `RTCDataChannel` add their listeners with `HOST.quiet`
  set. Test page for a network: `p2p/`.
- A room on this device: when no relay is known and peer to peer cannot be had
  (no introduction server, or `&peer=off`), or the relay cannot be
  reached as a room is joined and peer to peer cannot be had, the room works on the
  device alone (starting a room first asks whether the page's own server is a
  relay, 5 s at most: a room started before that was known stayed on the
  device until the next probe, and links to it were refused). A `Hub` with an in-page `LocalSocket` in `shared.js` plays the relay's part in the page
  (the same messages and the same rules for keys, a station's epoch and stale
  writes; presence and effects go nowhere, no log is sent). Its keys are kept
  in `localStorage` (`collabRoom.<code>`, the last 8 rooms), and a room joined
  through a relay is kept there too as last seen, so its layout is still there
  on a day the relay is not; a relay that forgot a room (expired overnight, or
  restarted) gets it back from any page that keeps a copy. The headset's menu
  has its shared room section without a relay too (*Start a room here*, the rooms kept on the
  headset). A headset alone is never asked about the others, and without marks
  or a shared space its stations stand on its floor where the session began
  (`'floor'`, for the session; calibrating keeps them in place). The room goes
  to a relay once one answers (asked every 15 s, and at once when an address
  is entered): made there from the device's copy when the relay has no such
  room or one with no stations, else joined as the relay has it (changes made
  meanwhile give way; a room there of another version is left alone, and the
  panel says so). The placement stays as it moves; a `'floor'` frame then gives
  way once the shared space gives a frame. Another tab's writes to a room on
  this device are taken (the `storage` event).
- Room names (v146; a room gets a name as a label; the three-letter code stays the address for links, `#s=XYZ`, join by code, peer-to-peer ids and kept copies). The room's key `name` = `{ v, by, at }` (FORMAT networks-47): set by anyone in the room, never refused by the circles lock or a story's lock (as `look`, `near` and `trk`), allowed in a room on this device, refused with no room and in camera mode. `roomNameClean(s)` cleans it everywhere (NFC, control, zero-width and bidi characters out, spaces collapsed, at most 40 characters by code point); anything a relay or a peer sends is cleaned on read, and a value of another shape reads as no name. `HOST.collab.roomName()`, `setRoomName(v)` (true when written; `''` clears it, written as `{ v: '', ... }` since `null` deletes only `st.*` and `pose.*`), `roomSay(code, name)` (*Lab (room ABC)*). The log says only `room name` with a length, never the name (headset logs go to the relay). Where it shows: the Shared dialog's room row (the name large, the code small beside it) and a *Name this room* field with *Set name* / *Clear name*; its status line; the headset menu's Circles heading and a *Name: Lab* row (`room:name`) that opens the keypad; every list of rooms (the dialog's and the menu's *On this network*, *Open rooms* and the kept rooms, the offer *Join Lab again*); and the notices about a room (*Back in Lab (room ABC)*, places, a room not joined). The relay (`titleOf`) gives `GET /api/near` and `GET /api/rooms` rows a `title` only when the room has one (also with `--unlisted` and `--public`: the label is the room's own and no member's name; a public relay shows a room's name to devices on the same network, and *Show on this network: off* hides the row), peer to peer a slot's answer carries `title` too; the first member's name stays `name`. The room's copy on a device (`collabRoom.<code>`) keeps the name, so a revived room gets it back. The keypad (`HOST.collab.keypad`) has two options for it: `caps` (a Shift key, word capitals by default as on a phone; the keys' ids stay lower case, only their labels change) and `empty` (OK pressable with nothing typed, giving `''`); the room name and the area name use `caps`. Tests: `node relay/test.mjs` (the step *a room's name*) and `node tools/collab.mjs --names`. Untested on a headset: the keypad's Shift and how the heading and two-line rows read there.
- Rooms on this network (the owner's rule: "Rejoin by itself, never join something new by itself"). Browsers
  cannot search the local network, so devices meet through the address they share on the internet.
  - The network's id (`C.net`): a short hash, never the address itself (kept only on the device, with its rooms, and
    never logged by the page or the relay): the first 24 bits of SHA-256 of a fixed salt (`networks-near-1`) and the
    network's name (one id stands for about 256 public addresses). With a relay, the relay's (`/api/ping` and
    `/api/near` say it): it hashes the address it sees, a private one by its /24 (a relay on the LAN sees the headsets'
    own addresses), IPv6 by its /64; behind a reverse proxy such as Coolify's it takes the last address in
    `X-Forwarded-For`, only when started with `--proxy` (behind `n` proxies, `--proxy n`, the `n`-th from the right:
    `--proxy 2` with a CDN such as Cloudflare in front; the Dockerfile leaves it off, Coolify's start command sets it,
    see `relay/README.md`). Without a relay (or one that does not answer), the public
    IPv4 address Cloudflare's STUN server reports (the srflx candidate of a throwaway `RTCPeerConnection`, its listener
    added with `HOST.quiet`), hashed in the page (`netName`, `netHash`: the relay's rules and salt, so both agree). For
    tests `#net=<word>` pretends one (no relay; kept for the tab in `sessionStorage`, `collabNet`; `off` drops it). None
    found: nothing listed and nothing joined by itself, and the dialog says so. It is asked only when the dialog or the
    menu lists rooms, when a room is joined (kept with it), or at load when a room was used in the last week.
  - *Rooms on this network* (the Shared dialog above *Open rooms*, the headset's menu as *On this network*; one press
    joins; looked for again every 15 s while either is open): the relay lists the rooms with someone on the asker's
    network (an empty room: on its last members' networks) unless their `near` is off (`GET /api/near`: code, the first
    member's name, people, stations; never an address). Peer to peer, a room's host holds the first free of eight slots
    named after the network on the introduction server (`lbinet-near-<FORMAT>-<net>-<0..7>`, `slotStep`, in the pump;
    let go when it no longer hosts, the room is hidden or left, or the page goes) and answers whoever links to it there
    with its code, its name, people and stations; a seeker (`seek`) links to all eight at once through a throwaway
    peer (a free slot answers after the introduction server's 5 s).
  - Rejoin (`rejoin`, `netAgain`): each room kept on the device (`collabRoom.<code>`, the last 8, as before) also keeps
    when it was last used (`at`), the network (`net`) and relay (`relay`, '' none) it was used through, and `left`
    (left on purpose) or `gone` (its code is another room's now). A device in no room joins again by itself the room
    it used last on the current network through the same relay (or none), within a week of its last use, when its copy
    holds the room's own id (`rid`; a copy without one, as when the page went before the id came back, is only offered,
    since another room under the code could not be told from it), at page load
    (no `#s=` in the link) and when the network or the relay becomes known (also on `online`, and when the page shows
    again a minute after the network was last found), with a notice (`#shToast` on a page, with *Shared*, *Leave* and a
    close button, gone by itself after 20 s: shown and hidden by its `display`, which outranks the `hidden` attribute;
    the shell's notice in a headset session) and *joined again by itself* in the dialog's status. With a relay: the
    room there is looked at first (`GET /api/rooms/<code>`): another room under the code (its `rid` differs: the relay
    forgot ours and gave the code again) is never joined (`notMine`: marked `gone`, a note says so); none there: joined
    by its code, and the relay gets it back from this device's copy (`revive`). Peer to peer: joined by its id, which is
    unique, so linked to whoever holds it, else hosted here from this device's copy (the existing rule for a kept room),
    so the others find it; two at once never split it (the second links to the first); a headset that ends up hosting
    hands the room to the first laptop page as before. A welcome from another room under the code (its `rid`) is left
    at once, and nothing of it is kept. Never: a room left on purpose (*Leave* in the dialog, the menu or the notice,
    and `HOST.collab.leave()`), until it is joined again by hand; a room the device was never in; one last used more
    than a week ago. Used last on another network, through another relay, or with no network found: nothing by itself,
    but one button, *Start room XYZ again* (*Join room XYZ again* with a relay; `offer`), in the dialog and the menu.
    In a headset the join is any join: the room's frame comes back as on any join, a calibration from last time is
    found by its anchors.
- A fresh shared space (*Fresh shared space* in the headset's menu and in
  the page's Shared dialog, two presses, only where the relay serves the page):
  Quest Browser keeps one shared space per page address, and two Quest 3s each
  kept their own copy of one, session after session (2.6 to 3.4 m apart by the
  tape). The relay also serves the app under `s/<n>/` (`serve`; `/s/<n>`
  without the slash is moved there), so the room's generation goes up by one
  (key `sg`) and every page in it moves to `s/<n>/` (`spaceMove`: only when that
  address answers, keeping the query and the room in the hash; a page opened at
  an older address later moves too; a room with no `sg`, as after a relay
  restart, moves nobody, and a page at `s/<n>/` gives it its generation). `SG` is the page's own generation and
  `appRoot()` the app's address, where the relay is (`detect`). The headsets
  leave AR as their pages move; the page and then the headset say to start AR on
  one headset first and the others after "Room ready". Every headset's
  log says its whole address (`search`, `sg` in `session`).
- Re-align (a button in the headset's menu, `HOST.room.realignNow()`):
  this headset lines up again from the start without leaving the session or
  forgetting its marks. The shared space is asked for again, what was held
  since waking is dropped, its own marks are looked for again by their anchors,
  and otherwise it asks whoever wrote the room's frame to write it into the
  space again (`q.frame`, passed on like presence) and takes it (waiting up to
  3 s). The frame held so far stays until another is found ("Re-aligned", or
  "Nothing to re-align to"). Once re-aligned, in AR in a room with spots, the check by eye asks (below).
- The room setup guide, its startup flow and Touch the spot (the owner: a guided room setup and an alignment check, so a group can start a shared room from zero and know whether the headsets line up; two fixed spots, tape crosses on the floor that also set the room's floor, are more accurate than two people touching controllers: "The room's floor is under the marks" below). It changes nothing in how alignment works: `lineUp()`
  (in `shared.js`, after `status()`) only says in plain words what the frame rests on: *Room ready* (this headset's
  shared space's origin is the room's, `R.src` `'shared'`; the notice of that name), *Lined up through the shared space*
  (`'adopted'`; *Lined up from the room's spots (shared space)* when that frame was made from spots,
  `R.mk`), *Lined up from the two spots you touched* (`'marks'`) or *from the room's spots, found again* (`'anchor'`),
  *Lining up with the room...*, or *Not lined up yet* with why (`LU_WHY`: no shared space, not in the others' shared
  space (`R.notJoined`), the space split (`splitHere`), no room scan (`R.noScan`, for a frame taken through the space),
  another Quest Browser version (the frame's writer's, `otherVersion`; `versionNote` before it lines up), the shared
  space switched off, or nothing after 20 s; its own spots' anchors not found again after waking, `R.reenter`,
  do not count: the check by eye asks instead). The user-facing words say *spot A* and
  *spot B* (the code still says marks: `mark()`, `R.saved`, `R.mk`, key `rm`).
  - The room's spots (`roomMk()`): `[height of A, A to B, height of B]` in room coordinates, as this headset puts them: a
    frame from spots has its origin at spot A and its x axis towards B, so A is at `(0, hA, 0)` and B at `(d, hB, 0)`.
    This headset's own (`R.mk`, `own()`), or those of the frame it took through the shared space (`R.mk` from its `m`),
    else the room's key `rm` (A's height over the room's floor, `FLOOR_TIP` for floor spots, and the distance; B as high
    as A); null while the room has none. `byMarks()`: this headset's frame rests on them; `roomSpots()`: the room has them (`rm`) or `byMarks()`.
  - The guide (`guidePage`, `PNL.page` `'guide'`, `PNL.gs` its page, in place of the rest of the Circles tab as the
    code page is): five pages, *Before you start* (the room scan, the same browser version, address and Wi-Fi, two tape
    crosses on the floor, A and B, about 2 m apart and 1 m at least, touched with the controller's tip on the floor, which
    set the room and its floor, drawn: `drawTape`), *Line up*, *Check that you line up*
    *Not lined up?* (Re-align and Check again, Calibrate, Fresh shared space where the relay serves the page) and *Areas*
    (v131: *Add spots for another area*, then each area's letters and name with *Check at C*, *Check at D* and *Calibrate
    here*: "Areas" under "Shared rooms"; Line up has *Calibrate on: <area>* while the room has areas), with
    Back, Next (Done on the last) and Close (*Skip for now* while the flow shows it), and over them a live status
    (`guideStatus`: the room, `lineUp()` in its colour, *Headsets lined up: n of m, k checked*, an amber note for another
    version or no room scan). *Line up* says what to do now (`lineCase()`): `'calib'` (calibrating: touch spot A, then
    B; Stop calibrating), `'check'` (lined up by the room's spots: Check, or Calibrate again), `'room'` (the room has
    its spots and this headset is not lined up by them, or its last check was out: *Calibrate on them*, the reason in red
    above; spots gone, new ones become the room's), `'first'` (no spots yet and this headset is the room's first,
    nobody else here or its origin: *Put two tape crosses on the floor, at least 1 m apart ... its tip on spot A, ...
    then spot B*, which sets the room and its floor for everyone: `claimFloor` and `publishOwn` as ever) or `'none'` (no
    spots yet, another headset is first:
    *Check with someone*, or Calibrate). *Check* has, once the room has its spots (`roomMk()`), *Check at A* and *Check
    at B* (a check on its own, `selfCheck`) and below them *Check here* with someone; without spots only Touch the spot.
    *Room setup* on the Circles tab (with `lineUp()`'s words beside it) opens it at the page last shown; only a headset
    in a room with the others or as its first (not one elsewhere, not a room on this device: `guideOn`).
  - The startup flow (`GD`, `guideStep` from the shell's tick, `guideOpen`, `guideClose`, `guideCal`, `guideGo`): every
    time a headset enters AR (or VR answered *In this room*) in a shared room, the guide opens by itself 1.5 s in
    (`FLOW.wait`), at *Check* when it is lined up by the room's spots already (in AR, since v119, the check by eye's
    question instead: `eyeInstead`, below), else at *Line up* (`GD.fl`: 0 not yet, 1 on show, 2 done, 3 skipped, 4 asked
    by eye). On *Line up*, before any press there (`GD.touched`), it turns to *Check* by itself (in AR: closes, and the
    check by eye asks) once this headset is lined up by the spots (its own found again, or through the shared space from
    them); a
    calibration started from the guide or the Debug tab (`guideCal`, `GD.cal` the marks' generation then) goes on to
    *Check* once it is made (opening the guide again there if the menu was closed meanwhile, not after Skip for now; the
    menu's own opening by itself, `autoGuide`, allowing). A check that stands
    (green or amber, on its own or with someone, or Yes by eye: `checkDone`) ends the flow for the session (`GD.ok`,
    `{ how: 'a' | 'b' | 'p' | 'e', d, at }`, until the frame it was made in changes: `setFrame`, a calibration, Re-align, Forget) and closes the
    guide, and the menu with it when the flow opened it (`GD.menu`). A red one (`checkRed`, `GD.red`) opens it again:
    at *Line up* once the room has its spots (calibrate on them), else at *Not lined up?*. *Skip for now* (or closing it
    any way: the menu closed, another tab) leaves it for the session, until a red check, being late (not lined up 20 s
    after entering with another headset there and the flow not on show: *Not lined up?*, `CK.late`) or the room getting
    its spots later with no check of this headset's standing (`GD.spots`: once, at *Check* (by eye in AR) or *Line up*). Never for a
    headset elsewhere or in a room on this device, never while calibrating or checking, never over the once-per-room
    question (it waits for the answer), and not while the menu is in use for something else (it waits). Opened by itself
    it stays open until used (`PNL.self`). Tests that do not look at it turn its opening by itself off
    (`HOST.collab.autoGuide(false)`). `roomGuide` in `localStorage` (an old once-per-device key) is removed.
  - The check by eye (the owner: it shows the two marks where the headset thinks they are and asks to align again when they are not there, anytime there could be misalignment; `EYEQ`, `eyeWant`, `eyeStep`,
    `drawEye`, `OV.eye`). In AR, in a room whose two spots are known (`roomMk()`), lined up, whenever the alignment may
    have slipped (`eyeWant(why)`: the session's start once lined up by the spots, in place of the flow's opening at
    *Check*; waking, the session visible again after hidden; a reset of `local-floor`, with or without a transform;
    Re-align; the spots' anchors lost (`lostMarks`) or found again (`restore`); the room's frame jumping by more than 5
    cm or 2 degrees, or taken from another source, in `setFrame`, but not the session's first frame nor spots just touched
    by hand, `'marks'`; the room getting its spots, `GD.spots`), the orange crosses show where this headset puts spot A
    and spot B (`drawMarks` from `roomMk()`; since v119 the crosses are drawn over everything, `depthTest` off,
    `renderOrder` 53, so neither the scene nor the room's own depth hides one a little under a table's surface) and a
    small panel in front of you (720 x 290 px, 0.42 m wide, 0.85 m ahead along the floor and 2 cm above the eyes, turned
    to you, `renderOrder` 55, the ray's first target, put in front again once the head turns more than 0.9 rad from it or
    walks 1.6 m off; amber, *CHECK BY EYE*) asks *Are both crosses on your spots?*, with why (*A new session.*, *The
    headset was off or asleep.*, *The headset moved its floor.*, *Re-aligned.*, the anchors lost or found again, *The
    room moved in this headset.*, *The room has its spots now.*), *Yes* and *No, calibrate again* (the ray or the right
    index fingertip, as the circles' question: `pokeSheet`). Yes stands as a check (`checkDone('e')`, `GD.ok.how` `'e'`:
    the flow done; presence's `lu.ck` `'e'`, the pages' list *checked by eye*; an older distance, `CK.res`, cleared). No
    (`GD.red` `{ spot: 'e' }`) opens the guide at *Line up*, case `'room'`, with *You said the orange crosses are not on
    your spots.* in red; `lineUp()` says not lined up meanwhile (`w` `'eye'`: *its crosses off the spots, by eye* in
    the pages' list). A burst of reasons asks once, 3 s after the last (`EYEQ.quiet`) and at most 10 s after the first
    (`EYEQ.most`); the first reason says why, a new session's over any other. It waits, and comes back, while
    calibrating or checking (`tipMode()`), re-aligning (`R.again`), the menu is open or the circles' question shows; a
    check that stands made since answers it; a room without spots drops it. Its opening by itself follows the guide's
    (`GD.auto`, `HOST.collab.autoGuide`). A headset elsewhere, in VR, in a room on this device or one without spots:
    nothing. After waking, with it on its way, the old *Check the spots* notice is not shown. Where the crosses are
    (the crosses highlighted with arrows towards them, the owner's wish; `EH`, `eyeHintBuild`, `eyeSpots` from `drawMarks`, `eyeArrows` from `drawEye`): only while the question
    shows, each cross is lit (1.6 to 1.95 times its size and brighter, a slow pulse of 1.6 s), a thin beam of light 1.2 m
    straight up from it (fading upwards) and its letter, *A* or *B* on an amber disc, over the beam, all in the room and
    over everything as the crosses are (`renderOrder` 53); under the question an arrow per spot (the one further to your
    left on the left), pointing at its cross from where the arrow floats, with its letter and its distance along the floor
    from your head under it (*A 2.3 m*; *A here* within 0.3 m); a cross behind you (more than 110 degrees from where you
    face, in front again within 95) gets a U-turn arrow to the side to turn to and *, behind you* in its words. The panel
    says *Follow the arrows to the two orange crosses* (its words in three lines of 20 px, the buttons a little lower).
    Built once, the first time the question shows; each frame only places them (a label is drawn again when its words
    change); gone with the question, the crosses as they were. For tests: `HOST.collab.eye()` (`{ ask, shown, why, due,
    can }`), `eyeTimes({ quiet, most })` and `eyeHint()` (the crosses, beams, letters and arrows in the story's scene).
    How the crosses and the panel read on a real Quest, how the lit crosses, beams, letters and arrows read there (over a
    real room, from across it), whether the reasons come at the right moments there (a real wake's resets) and how often
    it asks are untested.
  - A check on its own (`selfCheck`, `CK.self` `'a'` or `'b'` while armed): *Check at A* arms it; the next trigger off
    the menu takes the controller's tip where it was held still (`steady`) in room coordinates and measures it against
    where this headset puts that spot (`roomMk()`); nothing is sent. The orange crosses hide while any check or a
    calibration is armed (`drawMarks`, `tipMode()`), so the tip goes to the spot itself. The same limits and words as
    Touch the spot, with the spot: *Lined up: 3 cm at spot A*, *14 cm out at spot A: fine for walking about; calibrate
    on the spots for close work*, *40 cm out at spot A: not lined up*. Since v122 (floor spots) both kinds of check say
    the height part when it is 2 cm or more (`hPart`, `CK.res.h`: *Lined up: 3 cm at spot A (2 cm in height)*, *14 cm out
    at spot A (12 cm in height): ...*, in the menu's line and the notice's title): the spots are on the floor, so it is
    mostly how this headset's floor differs from the room's, which tells a headset lined up through the shared space
    (that keeps its own floor) that its floor is off. It checks this headset against the spots; Touch
    the spot checks two headsets against each other (it alone catches two headsets that calibrated on the spots in
    opposite orders).
  - Touch the spot (`CK`): *Check here* (the guide's check page, and the Debug tab beside Re-align) arms it; the next
    trigger off the menu takes the controller's tip where it was held still (`steady`, the point a calibration mark
    takes; the bright rings show, as while calibrating, `tipMode()`) in room coordinates with the relay's time, and sends
    it to the room as a one-off message (`fx` `q.check`, `{ p, at, n }`, as `q.frame` is: nothing stored). Each headset
    pairs its last check with another person's within 20 s (`CK.win`; the nearest in time; each pair once, so a new check
    waits for a new partner) and shows the distance between the two points: up to 10 cm green (*Lined up: 4 cm*), 10 to 25
    cm amber (*14 cm out: fine for walking about; calibrate on the spots for close work*), over 25 cm red (*60 cm out: not
    lined up*, which opens the guide again); a notice says it too. Alone: *Waiting for someone else to press Check here
    (20 s)*, then *Nobody else pressed Check here within 20 s*; someone else's check waiting: *Anna pressed Check here:
    touch the same spot and press it too*. The result (`CK.res`, either kind of check) stands until the next check,
    Re-align, a calibration, a frame that moves (another source, or 5 cm or 2 degrees: `setFrame`), five minutes
    (`CK.keep`) or a reason found since (the space split, another space, spots lost, another version, no scan), and
    `lineUp()` takes it as the better word (green or amber: lined up; red: not). An armed check takes the trigger
    everywhere but the menu, so it stops by itself after 30 s (`CK.armFor`), when the menu closes or once it cannot be
    made (its notice going with it). While a headset's own spots are still being found it is *Lining up* (not *no shared
    space*) until it is late.
  - Presence carries `lu` (`{ k, h, w, c, ck }`: `'ok'`, `'wait'`, `'no'`, `'away'` or `'alone'`, how, why, the check in
    cm, and this session's check that stood: `'a'` or `'b'` at that spot, `'p'` with someone, `''` none yet), and a
    headset in a room that is not lined up yet, or has lost its head pose, sends a presence without a head once a second
    (`statusOut`, with `al` as the full presence has it), so the pages hear it (older pages keep it as they keep a page's;
    nothing new is stored, no `FORMAT` change). The page's Shared dialog has *Setting up a room* under the room map (below
    it, so the map does not move as it changes): each headset in the room and how it lines up (`guideList`, `luLine`:
    *Anna: lined up (the room's spots, checked 3 cm at spot A)*, *lined up (shared space, checked 4 cm)*, *room ready
    (the room's origin, not checked yet)*, *not lined up (no room scan)*, *not lined up (checked 60 cm out at spot A)*,
    *elsewhere: nothing to line up*; an older app's headset by its `al`, and never *not checked yet* without its `ck`),
    *n of m headsets in the room lined up, k checked*, and the steps as text (a `<details>`, open, in `index.html`). For
    tests: `HOST.collab.guide()` (`{ open, step, status, check, lined: [lined up, headsets, checked], flow, case, ok, red,
    spots, menu }`), `guideOpen(k)` (by hand: the flow as it is), `checkArm(on, spot)`, `guideTimes({ win, late })` and
    `autoGuide(on)` (its opening by itself; the pretend headsets in `tools/collab.mjs` turn it off unless asked, `guide:
    true` in `installXR`, as they do `autoAll`). How it works on real Quests (how accurately a tip finds a tape cross on
    the floor, the points' accuracy, the guide's timing and whether it feels light, the notices) is untested.
  - The room's arc waits for that first calibration: the room's first headset becomes the room's origin through its
    shared space within about 8 s, and a calibration on the spots then moves the origin to spot A, so `allFirst` places
    nothing while the flow is on show asking it to calibrate (`guideShown()` with `R.calib` or `lineCase() === 'first'`);
    once calibrated, or on Skip for now, the arc stands where the headset stands.
- A headset runs live the station whose circle it walked into last (within
  1.1 m of its spot for 1 s; with the circles asked first, the default, the one it last went into by *Go
  in* instead, the lobby still walked into: "Circles asked first" below): stations are walk-in only (the owner's rules: stories only by going to their circle; a story is left only by walking into a new circle, not by moving away from it). Walked out of its circle, the headset keeps the station
  live (`C.mine`, `C.live`; `zoneStep`): its story shows where the station has
  it, plays on the station's clock and goes on syncing both ways (state, view,
  place, panel, the clock), and the narration fades with distance (the sound
  zone). Leaving the room, Leave, a new session (walk-in only: a session that
  starts drops a station the page followed or a session had) and a station
  removed end it; a station given another story takes the headset there. The
  trigger or a pinch on another station's card or ring runs nothing (a notice
  says to walk into its circle); the grip there still moves the station.
  `HOST.go` switches story (in a room `HOST.start` queues a request made while
  a story loads, and the pump retries a lost one). Away from every station
  (`HOST.room.away()`: a headset in a room that has walked into no circle yet
  this session, its story not yet loaded there, the room not yet aligned, or
  its station removed) no story shows: the stories hide their scene
  (`GL.world`, with the life-size holders in it), their story panels and
  labels, leave nothing of them to point at, and pause the story, silent
  (`xrAway`); only the shell's things show (the stations' rings, cards and
  icons, people, the menu, calibration marks), and nothing of a story
  goes out to the room. A desktop page follows one from the Shared dialog (a
  page cannot walk). A story the person starts themselves leaves the station
  (no longer following, not pulled back).
- Circles asked first (v118; the owner: circles reached only by pressing a card or icon and answering a question, for tight rooms). The room's (`look`'s `ask`, FORMAT networks-33:
  set by anyone, never refused by either lock; `askFirst()`, `setAsk(on)`, `HOST.collab.askFirst()` and `setAsk(on)`):
  the headset menu's Circles tab has *Circles: walk in* / *Circles: ask first* (with a note that it is for everyone here)
  and the page's Shared dialog the same button in its row of the headsets' settings (`data-sh="ask"`). **On by default**
  (the owner: "Circles should be ask first by default for everyone"; FORMAT networks-35): a
  room that never wrote `ask` asks first (`LOOK0.ask`), and the switch turned to walk in writes `ask: false` for the room. Tests that walk into circles start as before: a
  device with `localStorage` `collabAskDefault` = `walk` before the page loads (read once, as `collabAutoAll`; every page
  `tools/collab.mjs` opens has it but the round of the circles asked first) takes a room that never wrote `ask` as walked
  into, and `HOST.collab.askDefault(on)` sets the same (without an argument it says which). With it on:
  - Walking in does nothing (`zoneStep`: no dwell, no swell; `C.zone` is kept at the live station, so walking about with
    it on enters nothing and, turned off again, walking in starts from where you are), except into Back to the lobby
    (the owner: "in that one the headsets shall go to the lobby automatically"): the same dwell as
    walking in (within 1.1 m of its spot for 1 s) ends your live station there, once you have stood outside every lobby
    since *Go in* last took you somewhere (`C.lobbyArm`, so *Go in* pressed while standing in the lobby holds).
  - No ring is drawn at all (the owner: no rings when circles are entered by pressing a card and accepting): not the lobby's, not your own, not
    within 2 m, and nothing to point at where one was (`r.noRing` keeps a fading ring out of `OV.hit`), unless *Show
    all rings* is on (then as ever). The cards and icons stay as they are: they are what you press.
  - The trigger or a pinch on another station's card, ring or icon (not your own live one, nor the room's arc, which
    everyone here is at) opens a small panel in front of you instead of the notice (`askOpen`, `ASK`, `drawAsk`;
    `OV.ask`, a sheet of 720 x 300 px, 0.42 m wide, put 0.9 m ahead along the floor and 6 cm below the eyes as it opens,
    turned to you, then fixed; `renderOrder` 55, drawn over everything, the ray's first target, `kind: 'ask'`): the
    circle's kicker in its colour, its title (`stTitle`: "Back to the lobby", "All stories", "Studio: <scene>"), a line
    (the lobby: *Leave your story and see every circle again?*), *Go in* and *Not now*, and *Closes by itself in n s*.
    Pointed at by the ray (the hover tick, a click) or pressed by the right index fingertip (`pokeAsk`, as the menu's
    `poke`; a pinch and a poke at once count once). The station asked about keeps its card shown while it asks.
  - It goes after 10 s (`ASK.ms`; `HOST.collab.askMs(ms)` for tests), on *Not now*, when the menu opens, when the circle
    goes or is your live one, when the switch goes off and when the session ends (`askClose`).
  - *Go in* does what walking in does (`askGo`: `C.zone` set, `choose(id, 'walk')`, the *enter* swell; your presence's
    `st` then says so), for a story's circle, an All stories circle (its cards) and Back to the lobby (which ends your
    live station). The story stays at its circle: the rig at its spot as ever, wherever you stand (a person who goes in
    from across the room sees it there, small, and hears it faintly until they walk over). Nothing is written to the
    room but `look` (asking, Not now and the time running out write nothing).
  - The menu's Stations line says *Point at a circle and press to go in* (its note:
    *press a card or icon to go in; no rings*), and the lobby's line *Walk in or press: back to every circle* (the station
    cards have no tips). Pages are unchanged (they follow a station from the dialog). With it off, the trigger on a station
    shows the notice as before. `HOST.collab.asking()` (`{ id, left }` or null) is for tests. How the panel reads, where
    it stands and how the fingertip presses it on a real headset is untested.
  - Per circle (v172, FORMAT networks-55; the owner, 20 November 2026: "an option to set circles to walk in or click in
    per circle"): a circle's record may carry `ask: 'walk'` or `ask: 'ask'`, which beats the room's switch for that circle
    alone; without it the circle follows the room's (the switch is the default, not an override). Never the lobby's (it is
    walked into either way). `askFor(s)` is what every check above reads (walking in in `zoneStep`, the rings'
    `r.noRing`, the trigger's question, `drawAsk`'s closing); `circlesMode()` (`ask`, `walk` or `mixed`) words the menu's
    Stations line and the welcome (mixed: *Walk into a circle, or point at the card or icon of one that asks and press*).
    Set by anyone, never refused by either lock (`setStAsk(id, mode)`, `stVal` keeps it as a circle moves): the headset
    menu's Circles tab has *This circle: ...* under the room's switch, for the circle you are at (*As the room: walk in*,
    then the other way, then the room's again; `askNext`), and the page's Shared dialog a button in each circle's row
    (`data-sh="stask:<id>"`). In a room that asks first, a circle walked into is walked into as ever; *Go in* while you
    stand in such a circle does not take you back into it until you have stepped out (`C.stood`, as `C.lobbyArm` for the
    lobby). For tests `HOST.collab.stAsk(id[, mode])`, `askFor(id)`, `circlesMode()`; `tools/collab.mjs --ask` checks a
    circle set to walk in, in a room that asks first.
- A station in a headset (`ringFor`, `cardFor`, `drawPreviews`): a ring in its story's colour (0.44 to 0.52 m across
  its middle, a triangle at the front for its facing) floating 0.5 m over the room's floor (`RING.y`; the owner: circles about 50 cm in the air: a headset that finds the floor a little wrong sank a ring
  on the floor into it or lifted it off it), its card standing over the ring's middle (its middle at 1.45 m, `CARD_Y`,
  its top edge at 1.6 m; the owner: the card centred over the circle), turned to you and fading as your head comes within 0.8 m of the middle (gone within 0.45 m,
  `CARD_NEAR`: walking in, it would be in your face), and its icon above both (2.1 m). The card says only what does not
  change while its station stands (the owner: only how many people are in, drawn again only when it changes; `cardText`):
  its kicker and title (`stTitle`: a studio circle's scene, *Studio: <scene>*; an All stories circle its own title, never
  the story picked there) and how many people are at it (*Nobody here*, *1 person here*, *3 people here*: the count
  `whoAt` gives, pages and a camera among them, never their names). No play state, no names, no tips, nothing about
  moving it or the locks; the page's Shared dialog keeps its own lines (the time, the names). Its signature (`cardSig`) is that content alone (its look, kicker, title and count), so it is
  drawn again only when its title or its count changes; pointed at or carried, its edge lights (`o.edge`: a band round the
  card in the story's colour, a mesh shown and hidden, never pointable; nothing drawn or sent to the GPU). A card whose
  content changed waits in a queue (`DIRTY`), and at most one card is drawn a frame, the one pointed at or carried
  first, then the nearest (a card never drawn yet is not shown until its turn, so nothing blank goes to the GPU;
  `o.drawn` counts its drawings, for tests); mipmaps kept. Its back face (`o.back`, for reading it from behind) shows,
  and is pointable, only while there is no head pose and the card stands at its station's yaw; turned to you it would
  face away, a draw of nothing twice a frame for every card. Walking in still goes by where
  you stand on the floor (within 1.1 m of its spot). With the circles asked first no ring is drawn (above). At a studio
  station the studio can hide every other station (`HOST.collab.hideOthers(on)`, v119, the studio's switch; `HIDE`,
  `hidingOthers`): while on and this headset's live station runs the studio, the other stations' rings, cards and icons
  are neither drawn nor pointable (`r.hid`; people as ever) nor walked into (`zoneStep`: a circle you cannot see would
  switch your story as you walk about a life-size scene), but the lobby, where the headsets charge, is still walked into
  (its ring, card and icon hidden too); it lapses when the live station or its story changes (it
  holds what it was asked for, `HIDE.sig`), and `hideOthers()` without an argument says whether they are hidden now.
  Pages are as ever.
- In a circle, icons only (the owner's wish): while a headset has a live station,
  every other station shows its icon only, its card and ring hidden; another
  station's ring fades in within 2 m of its spot and out beyond 2.2 m (`RING` in
  `drawPreviews`, the ring's `near`), so you see where to step in. Your own
  station shows nothing (the owner: hidden once inside, unless *Show all rings* is on): no card, no
  icon and no ring, wherever you walk while it is yours, and nothing of it to
  point at. *Show all rings* (the menu's Circles tab; this headset's own, kept as
  `collabRings`, never in the room; `HOST.collab.allRings(on)`) shows every ring
  at any distance, yours too (faint), to find the circles or grab your own (and is the only way to see a ring while the
  circles are asked first). The icons stand for their stations: pointable
  through an unseen ball round each (`ICON.ball`, 0.2 m), grabbable, and the
  trigger there says to walk into its circle, as on a ring. Pointing at an
  icon, a ring or the card it brought up (a controller's ray or a hand's pinch
  ray resting on it) shows that station's card for as long as it points; it
  stays 2 s after and fades (`PEEK`: the ring's `seenAt` and `peek`, the
  card's opacity), so you can tell which story it is without walking over.
  Before any circle everything shows as before (rings, icons and cards).
- Follow a person (pages only; the owner's wish: a laptop for people
  who do not want to wear a headset follows along): in the Shared dialog's
  people list each person in a headset (`kind` `ar` or `vr`) has *Follow*
  (`HOST.collab.followPerson(id)`, `followingWho()`; `C.who`; refused for
  anyone not in a headset). The page then follows whichever station that
  person's headset runs, as their presence says (`st`: the circle they walked
  into last, which stays theirs when they walk out of it), switching as they
  walk into the next circle (`whoStep` in the pump; `choose(id, 'person')`);
  with their presence quiet (a headset taken off), or one that says no
  station, it stays on the last one. It stops when they
  leave the room (gone from the members for 15 s while this page is connected,
  `WHO_GONE`, so a socket of theirs back within it, as after a relay restart,
  keeps them; the page stays at their last station, following it as by hand),
  or when this page follows a station by hand (a station's Follow, the map),
  picks a story by hand, presses Stop following, leaves the room or starts a
  headset session. The dialog says "Following <name> (at <story>)", "(last at
  <story>; in no circle now)" or "(not at a station yet)"; Follow on someone not
  at a station yet keeps the dialog open. Nothing is written to the room (each
  page's presence already says where it is), so no `FORMAT` change. A reload in
  place (`HOST.place`, `who`) follows them again.
- Camera mode (v124; the owner: an Android phone in AR lined up with the room acts as a camera, combined with Follow, so people outside see what the headsets see; Android's own
  screen recorder records Chrome's AR session with the camera image, so nothing is recorded in the page). The camera mode
  section of `shared.js` (`CAM`, `camStart`, `camSession`, `camStep`, `camMark`, `camRender`), with small hooks
  elsewhere; no `FORMAT` change (nothing stored changes shape).
  - Offered on a device whose browser offers `immersive-ar` (`isSessionSupported`, asked once) and that is not a
    headset's browser (`IS_HEADSET`), in a room that is not on this device only (`camOffered`): *Camera mode* in the
    Shared dialog's room row, with a line saying what it is; and a link with `&camera` (`#s=XYZ&camera`): its own page
    (`#camera` before the session, `.cam-pre`) with one big button, *Start the camera* (a tap must start a session), the
    dialog not opened. A headset's browser, or a device without AR, gets a sentence instead of the button (since v153 a
    computer's page, `DEV` `'screen'`, opens the desktop preview camera's own page for `&camera` instead: below).
  - Starting (`camStart`, within the tap): `CAM.want` set, then the page's Enter AR button pressed (`btnAR.click()`), so
    the story on show starts its AR session as Enter AR does. `HOST.xr.request` (index.html) takes `extra` ({ features,
    init }), and `shared.js` wraps it: while `CAM.want`, AR also asks for `hit-test` and `dom-overlay` (`domOverlay: {
    root: #camera }`) on every rung of its ladder (depth sensing kept). A refusal shows on the camera's page; no request
    within 3 s (a story still loading) says to try again. The camera's session is only the one its own request gave
    (`CAM.sess`, noted as the request resolves, before the story makes it `HOST.session`; `camSession`, first in `watch`):
    `CAM.on`, `HOST.collab.cameraMode()` true (other parts of the shell guard on it). Any other session that starts
    meanwhile is not the camera's, and Start's wish (`CAM.want`) goes with it.
  - Lining up: no shared space and no controller tip on a phone. The overlay shows a crosshair in the middle of the
    screen; a hit test from the viewer space straight ahead (`requestHitTestSource`, `getHitTestResults` every frame,
    `camStep`) finds where the aim meets the floor (a ring there, `OV.camRet`); *Move the phone slowly so it finds the
    floor* until it does, then *Aim at spot A and tap Set spot A* and spot B. `camMark` hands that point, raised by
    `FLOOR_TIP` as a controller's tip held on the floor is, to the calibration (`markAt`, split out of `mark`), so the
    floor spots' rule (v122) gives the camera the headsets' room and floor (a test: within 1 cm and 0.5 degrees). A
    camera calibrates on the spots afresh each session (Chrome has anchors but no persistent handles: `HOST.anchor.keep`
    gives no handle, and its anchors hold the room for the session): a camera keeps no places (`roomFrames`:
    `storePlaces` writes none, and its session drops any, `placesDropAll`), and its session starts with none (`R.saved` cleared, any handles let go), so nothing is looked for
    (`restore`) while it asks for spot A; and again by itself once
    the room is lost (a reset without anchors to follow); *Calibrate again* in the overlay. It never writes the room's
    floor (`claimFloor`). Without the DOM overlay (domOverlayState missing) a tap on the screen (the session's `select`)
    sets the spot. The room setup guide, its startup flow and the check by eye never open (`guideOn`, `eyeRoom`), nor the
    menu (`menuOpen`); no notice, subtitle strip or frame rate is drawn in 3D (the overlay says what is needed: `camWords`).
  - What it shows: what a headset in the room at its circle sees. The station it follows is its live one: its story
    loaded, its rig at the station's spot (`place`, as a headset's), on the station's clock; the other circles' icons and
    cards as a headset sees them; everyone in a headset (`drawPeople`, as with People: everyone; rays, dots and name
    tags; as in a headset in AR a head and hands only for people elsewhere, since the camera sees the people in the room).
    Its narration plays as a page's (no sound zone).
  - Follow (the overlay's *Follow* list): a person in a headset (`followPerson`, `C.who`, `whoStep`: allowed during a
    camera's session, whichever circle their presence says), a circle (`choose(id, 'follow')`) or nobody; the room's arc
    as a page takes it (`arcStep`'s page branch). Walking with the phone never enters a circle (`zoneStep` and `allFirst`
    skipped), and the circles' question never opens. A session that starts keeps what the page followed.
  - An observer: it writes nothing to the room (`publish` refuses every key, `fx` every key but its presence;
    `camQuiet` logs each once, `camera().quiet` lists them). Its presence is `{ st, head, hands: [], kind: 'cam', ts }`
    (`statusOut`'s without the head while not lined up); its hello says kind `cam` and the name *Camera* (the relay's and
    the hub's kinds take `cam`; an older relay makes it `desktop`, which never counts as a headset either). Other devices
    mark it (`P.cam`): never drawn in a headset (no head, hands or tag), never in `heads()` (the studio's behaviours), never
    among the headsets that line up (`linedUp`, `othersIn`, the pages' guide list) or offered Follow (only kinds `ar` and
    `vr`); what a headset shows of its own (the welcome toast) guards on `cameraMode()`. The pages' people list and the
    headset menu's people rows say *camera (filming)* (never *here* or *elsewhere*), and the room map draws a small box
    for it. The page's Shared dialog names it *Camera* among the people at its circle, and a station card counts it among
    them (the cards give only a count, never names).
  - Taps on the camera image press nothing: the overlay root covers the screen and cancels every select
    (`beforexrselect`), and `ray()` takes a camera's rays as the shell's with nothing to press (a guard for a browser
    that does not honour it). Taps on the overlay's buttons are the overlay's. A double tap on the image (two within
    0.4 s and 60 px, `camTap`) brings a hidden overlay back.
  - The overlay (`#camera`, the DOM overlay's root; HTML, its CSS injected once, `CAM_CSS`; its listeners added with
    `HOST.quiet`): a small bar at the top with the lining-up status and *Follow*, *Calibrate again*, *Panels: shown /
    hidden* (this camera's own: `HOST.collab.panels` gives `hidden`, so the story hides its panels on this device only),
    *People: shown / hidden*, *Sound* (this device's mute), *Subtitles: on / off* (the narration's captions as a strip at
    the foot, `captionNow`, as focus mode shows them), *Hide* (the controls go until a double tap; the subtitles stay)
    and *Exit* (ends the session; the page then follows on as a page does, its kind `desktop` again). The crosshair, the
    step and *Set spot A* / *B* show while lining up. None of its settings is the room's.
  - For tests: `HOST.collab.cameraMode()`, `camera()` (`{ on, want, phase, ok, offered, lined, calib, hit, follow,
    station, story, hidden, panels, people, subs, list, words, quiet }`), `cameraOffered()`, `cameraStart(why)`.
  - Untested on a real phone: everything (the hit test on a tape cross and how close it lines up, a heavy story's frame
    rate on a phone, the DOM overlay on real Chrome, the recording with Android's screen recorder, sound in it).
- The desktop preview camera (v153; the owner, 16 November 2026: "A preview cam on desktop that shows what people are
  doing inside the virtual world and that i can move around so that i can place it in real space in the real position";
  asked what for, a screen for onlookers: a TV or a projector at an event showing what the people in headsets are doing,
  from a fixed spot in the real room; placed from a headset, fine-tuned on the desktop, its field of view settable so it
  could match a real camera later; then "build it but make it so that it can be placed on desktop too"). The preview
  camera section of `shared.js` (`PC`, `PCP`, `pcStart`, `pcSession`, `pcSessionMake`, `pcPatch`, `pcStep`, `pcRender`,
  `pcamWrite`, `pcamTake`, `pcamMark`, `pcamDraw`; v155: `pcKey`, `pcMotion`, `pcLook`, `pcHalt`), with small hooks elsewhere. Camera mode's sibling: `CAM.on` with
  `CAM.pc`, so every guard of camera mode applies (`HOST.collab.cameraMode()` true; kind `cam`).
  - Offered on a computer's page (`DEV` `'screen'`: not a phone or a tablet, which have Camera mode, nor a headset's
    browser) in a room that is not on this device only (`pcOffered`): *Preview camera* in the Shared dialog's room row,
    with a line saying what it is and where it stands (*Not placed yet...*, or *Placed by Ann: x, z, height*); and a link
    with `&camera` on such a page (`PC.link`): its own page (`#pcam`, `.pc-pre`), *Start the preview camera* (the dialog
    not opened; on a phone `&camera` is camera mode's link, as before).
  - Starting (`pcStart`): `PC.want` set, `pcPatch(true)`, then the page's Enter VR pressed (`btnVR.click()`), so the story
    on show starts its session as a headset's does (its own `xrStart`, `HOST.xr.request`, three.js's `setSession`,
    `xrAdopt` on a story change: the stories unchanged). `HOST.xr.request` (wrapped in camera mode's section) answers
    `immersive-vr` while `PC.want` with the shell's pretend session (`pcRequest`, `pcSessionMake`), never the browser's;
    `pcSession` (first in `camSession`) takes only that session as the camera's (another session: not the camera's,
    Start's wish dropped). No request within 3 s: *The story is still loading: try again in a moment.*
  - The pretend session: an `EventTarget` with `mode` `immersive-vr` (a VR look: a computer has no camera image),
    `environmentBlendMode` `opaque`, no input sources, `enabledFeatures` viewer, local and local-floor (no shared space,
    no anchors: `createAnchor` refuses); its local and local-floor spaces are the room's frame itself (`align`: src
    `'pcam'`, state `pcam`; nothing to line up, nothing calibrated or kept), its viewer the camera's place; a frame on
    each of the page's animation frames (every callback asked since gets that frame, as a headset's do), with one view
    filling the canvas at the page's size (device pixel ratio at most 2, and at most `PCAM.px`, 1920 x 1080's pixels, in all:
    a 4K TV is drawn at about 1080p, enough across a room and smooth for a heavy story; `pcFrameStep` sets the canvas's size, since
    three.js refuses `setSize` while presenting, and `#gl` is made 100vw x 100vh), its projection the camera's vertical
    field of view at the canvas's aspect, near and far from `renderState`. Listeners on it are added with `HOST.quiet`
    (as index.html keeps an `XRSession`'s), so a story change keeps three.js's. three.js r128's own WebXR path draws it:
    while it runs (`pcPatch`) `window.XRWebGLLayer` is a wrapper that gives the pretend session a layer drawing to the
    canvas itself (`framebuffer: null`, the canvas's size, one viewport) and any other session the browser's own layer,
    the context gets its own `makeXRCompatible` answering at once (a computer with no headset may refuse), and a browser
    without `navigator.xr` (Firefox, Safari) gets a stand-in offering nothing (the stories' `xrStart` asks for it); all
    put back as it ends, so a real headset on that computer afterwards is untouched, and nothing of it is ever offered
    to a headset or to camera mode.
  - Its place in the room: the key `pcam` = `{ p: [x, y, z], q: [x, y, z, w], fov, ts, by }` in room coordinates (FORMAT
    networks-48): `p` to the millimetre, `q` to 4 decimals (made unit as it is read), `fov` the vertical field of view in
    degrees to 0.1 (20 to 110, default 60), `ts` the relay's time of the write, `by` the writer. One camera for the room
    (two screens at once would want a key per camera, `pcam.<id>`, each with its glyph on the map and the headset's row
    asking which: not built). Read by `pcamOf` (a value of another shape reads as none); compared without `ts` and `h`
    (`sig`); set by anyone in the room, never refused by either lock (as `look`, `near`, `trk` and `name`), never by a
    phone in camera mode; the relay and the room on a device (peer to peer, this device only) store it by their usual key
    rules (nothing changed there). With no `pcam`, the camera starts 3 m behind the station it follows (or the first),
    1.6 m up, looking at it (`pcamDefault`; with no station, 3 m behind spot A looking towards spot B), not written until
    someone moves it. Every change is written once, when a drag or a run of keys ends, numbers are typed, a map drag is
    let go or a headset's trigger is pulled, and while it moves smoothly at most every 0.5 s and once as it stops (never a
    frame); the camera shows a change made on its page at once (`PC.edit`) and the room's again once written; one written
    elsewhere it jumps to.
  - What it shows (as camera mode): the station it follows at its spot as a headset in the room sees it (`place`, its
    story loaded, on the station's clock), the other circles' icons and cards, everyone in a headset with head and hands
    whatever circle they are at (`drawPeople` in VR: there is no camera image; rays, dots, name tags); no menu, notices,
    subtitle strip or frame rate in 3D, no sound zone (its narration a page's), never a 3D update panel (index.html's
    `xrTick`: not on a camera's picture, camera mode's either). Walking never enters a circle.
  - Follow (the overlay's *Follow* list): *What it looks at* (`PC.auto`, the default unless the page followed someone or
    a circle before: the circle, not the lobby, nearest the middle of its view along the floor, within its view; another
    taken only once 5 degrees nearer the middle, never while it is being moved; `pcAuto`), a person in a headset, a circle
    or nobody (as camera mode's).
  - Placed and fine-tuned on a computer, no headset needed: on every page's room map (the Shared dialog's) the camera is a
    small cyan glyph with its view's wedge (16:9) and a handle at the wedge's middle (dim, *Preview camera (not placed)*,
    at the default while there is no key; the camera's own presence is not drawn there as a box): its glyph dragged moves
    it along the floor, its handle dragged aims it (tilt, roll and field of view kept); one write as it is let go, an
    interrupted drag writes nothing (`mapGrab`, `MAP.drag.pc`, `pcamMap`, `pcamDraw`). A circle's dot or square within
    reach wins over the camera, so a dim default lying on another circle never takes that circle's click or drag (drag the
    camera from a free spot of its glyph). So it can be set up on the map and
    then started, or a second laptop can place it for the TV's page. On the camera's page, its overlay's numbers can be
    typed (x, y, z in metres, aim and tilt in degrees, the field of view): Enter or leaving a field writes them (`pcTyped`).
    The room's origin: spot A on the floor, x along the line from spot A towards spot B, z to the right of that line, y up
    (the overlay says so); aim 0 looks from spot A towards spot B and grows to the right (towards +z), tilt looks up.
  - Its overlay (`#pcam`, built once, its listeners the shell's, its CSS `PC_CSS`; the page's own UI hidden behind it,
    `body.pcam`): a bar with its status (*Not placed yet...* or *Placed by Ann.*), *Follow*, *Panels*, *People* (this
    camera's own, as camera mode's), *Labels* and *Cards* (below), *Sound* (this device's mute), *Subtitles* (the captions
    as a strip at the foot), *Full screen*, *Stop*, its numbers, *Level* (enabled with the roll it would take out),
    *Speed* and *Keys* (below), a line about the mouse (*Click the picture to look with the mouse; Esc lets the mouse go.
    Or drag the picture to turn and tilt it.*; once the browser refused to catch it, *Drag the picture...*) and a line of
    help that names the keys of the Keys setting. It hides itself and the mouse pointer after 3 s without the mouse moving
    (not while a field is typed in, the list is open or a drag runs; the pointer: `cursor: none` on `#pcam` and on the
    canvas `#gl`, `body.pcam-idle`) and both come back as the mouse moves or a key is pressed (while the mouse is caught,
    neither brings the bar back: the picture stays clear). On the picture: a drag turns (left, right) and tilts (up, down),
    0.2 degrees a pixel, Shift 0.02; a click (no drag) catches the mouse (below); the wheel the field of view (1 degree,
    Shift 0.1).
  - Keys (by their place on the keyboard, `ev.code`, so QWERTZ and other layouts work), with *Keys: smooth* (the default;
    v155; the owner, 16 November 2026: "Preview cam needs options for continuous movement with wasd/ijkl or mouse"): while
    a key is held the camera moves every frame of its session (`pcMotion`, from `pcFrameStep`, and as a key goes down or up,
    so how long a key is held counts exactly whatever the frame rate; a frame more than 0.2 s late moves it no further):
    W and S (or the up and down arrows) forward and back along the floor relative to its aim, A and D (or the left and
    right arrows) sideways, Q and E (or Page Down and Page Up) down and up, J and L turn it left and right, I and K tilt it
    up and down (tilt held within 89 degrees). Each speed (forward, sideways, up, turn, tilt) goes towards the keys held at
    a steady rate, full speed in 0.25 s (`PCAM.ramp`) and to a stop as gently, so a TV's picture never jerks and a hold
    moves it speed x time. *Speed: slow / normal / fast* (the button cycles; `PC_SPEED`): 0.25, 0.75 or 2 m/s along the
    floor (height half that) and 15, 45 or 90 degrees a second; Shift held, a quarter of all. The keyboard's repeats change
    nothing while a key is held (`PC.held`, code to move). *Keys: steps* is the earlier behaviour, a step a press (and the
    keyboard's repeats): along the floor 10 cm (Shift 1 cm), down and up 5 cm (Shift 1 cm), J, L, I and K 1 degree (Shift
    0.1). In both: the + and - keys zoom in and out (the field of view 1 degree, Shift 0.1; also by the character typed,
    always 1 degree, since a German keyboard's + and - are other keys and + needs Shift on a US one), R levels it (roll 0).
    A run of steps (and the wheel) is written once, 0.5 s after its last key (`pcEdit`, `pcRunEnd`).
    While it runs no other key reaches the story or the page, down or up (a window listener first, `pcKey` and `pcKeyUp`:
    the stories' Space and /, the shell's Escape), but the browser's own with Ctrl, Alt or Cmd, Tab and the F keys. A key
    held whose keyup could be lost stops it all at once and writes once (`pcHalt`): the window losing the focus (`blur`),
    the tab hidden (`visibilitychange`), the mouse let go (`pointerlockchange` ending the lock), numbers typed, Keys
    changed, Stop; Cmd pressed lets every held key go (a Mac sends no keyup for a key let go while Cmd is down); a halt
    also forgets Shift (a Shift let go while the window was away would keep it slow).
  - The mouse caught (pointer lock, the owner's "mouse catching and hiding"), with *Mouse: catch on click* (the default)
    or *Mouse: drag only* (`PC.opt.mouse`, `collabPcamMouse`: a click on the picture then never takes the mouse, for a TV
    someone may click to wake; choosing it lets a caught mouse go): a click on the picture (not on the bar's
    buttons or fields) asks for pointer lock on `#pcam` (`pcLockAsk`, as the click is let go; a drag stays a drag); while
    it is caught the browser hides the pointer, the bar hides and *Mouse caught: Esc lets it go* shows at the top until the
    overlay goes idle, and its movement (`movementX`, `movementY`) turns and tilts the camera (`pcLook`): the Speed's
    degrees a second / 450 a pixel (0.1 degree at normal, 0.033 slow, 0.2 fast), Shift a quarter, eased in over about 50 ms
    (`PCAM.look`) by the same frame step; a jump of more than 300 px in one event (a browser's own as the mouse is caught) is
    dropped. Esc (the browser's own) lets it go (`pcLockChange`: the overlay back, any held key stopped). Refused, or a
    browser without it (`pointerlockerror`, a rejected promise: `PC.lockNo`), the drag stays and the mouse line says so; a
    later click asks again. Works with the overlay idle and in full screen (`#pcam` is inside the element shown full screen).
  - Its writes while it moves smoothly (keys held or the mouse caught): never a frame; at most one every 0.5 s
    (`PCAM.every`), so the headsets' marker and the room map follow it, and one as it stops, each with `ts` (by `pcamWrite`,
    with its rounding: the place to the millimetre, the turn to 4 decimals); what it shows while it moves is its own
    (`PC.edit`, unrounded), as for a run of keys.
  - *Labels: shown / hidden* and *Cards: shown / hidden*: this camera's own (as camera mode's Panels and People; kept in
    `localStorage` with *Speed*, *Keys* and *Mouse*: `collabPcamLabels`, `collabPcamCards`, `collabPcamSpeed`, `collabPcamKeys`,
    `collabPcamMouse`;
    never in the room, a story's `state()` or `collab.state()`, no FORMAT change), the headsets' Labels and Cards settings
    and the room's `look` untouched. The headsets' Labels setting covers the scenes' small labels and their Cards setting
    the larger ones: the story panels, the station cards over the circles and people's name tags. On the camera:
    *Labels* takes away the scenes' small labels (`shared.js` wraps `HOST.xr.labels()`, which every story reads each frame,
    and `HOST.xr.sig()`, in their panels' signatures: `'hidden'` on the camera) and people's name tags (`tagMode`); *Cards*
    the cards over the circles (`stCardMode`); the story panels stay with *Panels*. Shown means as the room has them (on top
    or in 3D), or where the room hides them, labels on top and the cards and name tags in 3D (`pcShown`).
  - From a headset: the menu's Circles tab has *Place the preview camera* beside *Back to the lobby* (always in a room,
    so a camera can be placed before its screen is started; greyed until lined up, in a room on this device only and in
    camera mode): pressed, the next trigger press away from the menu takes the controller's tip (its target ray's origin
    held still, `steady`) and the way its ray points, in room coordinates, level (roll 0), the field of view kept
    (`pcamTake`); the button again stops it, and so does losing the room meanwhile (the press then places nothing and says
    to line up first, rather than every trigger press staying the shell's while the row is greyed). That press is the shell's, never the story's (`tipMode`: the ray's hover is
    `pcam`, only the menu itself pointable meanwhile, the aim's ring at the tip, a notice saying what to do). While placing,
    and while the menu is open, headsets draw the camera as a small marker with the outline of its view 60 cm out and a
    little roof on its top edge (`OV.pcam`: cyan opaque lines over everything, nothing see-through), where a press would put
    it while placing (`pcamAimed`), else at its place.
  - An observer: it writes nothing to the room but `pcam` (`publish` refuses everything else, `fx` everything but its
    presence; `camQuiet` logs each once), its presence is camera mode's with `pc: 1` (`{ st, head, hands: [], kind: 'cam',
    pc: 1, ts }`; others mark it `P.pc`), its hello names it *Preview camera*; the pages' people list and the headset menu's
    people rows say *preview camera*; never drawn in a headset or counted as one (camera mode's `P.cam`).
  - Stop (or the session ending) ends the pretend session: a page again (kind `desktop`), following on, `pcPatch(false)`,
    full screen left. A reload while it runs (a release, *Update the room*, by hand) starts it again by itself in that
    room (v161: its address has `&camera` while it runs, `PC.link`; a reload of that address, `navReload()`, runs
    `pcResume`: once the room and the story are there, within a minute, else its own page; a link opened afresh shows its
    page with Start; the tab's sessionStorage no longer restarts it, so a plain `#s=XYZ` reloads as a plain page; index.html's `reload()` keeps no *Enter VR to continue* for it, `HOST.collab.previewOn()`); Stop clears it.
    A new release is not asked about on its picture: it takes it at its next reload.
    Started again by itself, its sound waits for a click or a key (the browser's rule; the shell's unlock runs first on
    either): the status line then ends *Sound starts at a click or a key.*
  - For tests: `HOST.collab.previewOn()`, `previewOffered()`, `previewStart(why)`, `previewStop()`, `preview()` (`{ on,
    want, phase, offered, link, err, patched, pose, def, key, edit, idle, list, auto, follow, station, story, angles, cam:
    the three.js camera of its last frame { p, q, fov, vp }, canvas, src, aligned, quiet, moving, held: the codes held,
    speed: its five speeds while it moves, lock, lockNo, opt: { speed, keys, labels, cards }, labels: HOST.xr.labels() as
    the stories read it, tags, cards: the name tags' and the circles' cards' modes }`), `pcam()`, `setPcam(pose, why)`,
    `pcamPlace(on)`, `pcamPlacing()`, `mapCam()` (the map's glyph and handle in pixels).
  - Tests: `node tools/collab.mjs --preview` (`docs/agents/testing.md`).
  - Untested: everything on a real TV or projector and on a real computer's GPU (only headless Chromium in software here;
    Firefox and Safari, which have no WebXR, only by reading: the `navigator.xr` stand-in and the wrapper with no browser
    layer), a heavy story's frame rate on a computer, full screen, the sound; a real keyboard and mouse (how smooth moving
    and the mouse's turn look on a TV, the speeds, a real browser's pointer lock and its own Esc, in full screen and not,
    the pointer hidden, a Mac's Cmd); on a real headset the placing (the
    controller's tip and ray, how close it gets to a real camera's spot), the marker's look and the menu row.
- The output page (MIDI and OSC; FORMAT networks-51; the owner, 16 November 2026: "make it opt in by default and say who
  entered", "both", "in and out", "output page and then midi or local relay for osc and trackers i guess?"). The
  contract between the shell, the studio and the relay is `tools/output/SPEC.md`; setting it up is
  `tools/output/README.md`. A computer's page in a room (Chrome or Edge, a laptop or the room's PC) that follows a
  studio circle and runs its scene itself, and sends what happens there as MIDI (the browser's Web MIDI, one output port)
  and as OSC (over its own room socket to the relay, which sends UDP only to its `--osc-out` targets), and takes MIDI
  (one input port) and OSC (the relay's `--osc-in`) back in as the room's actions.
  - Its code is `output.js` (`HOST.out`), loaded on demand from `appRoot()` the first time it starts, as `peerjs.min.js`
    is (in `sw.js` `SHELL` and the relay's `APP_FILES`). `shared.js` keeps only the shell's part ("the output page":
    `OUT`, `outOffered`, `outStart`, `outStop`, `outMark`, `outResume`, `osc`, `oscCfg`, `oscPing`, `persons`).
  - Started: the Shared dialog's *Output page (MIDI and OSC)* (a computer's page, `DEV` `'screen'`, in a room not on this
    device; `.sh-outp`; the same button stops it), a link with `&output` (a computer's page only: a phone or a headset
    ignores it; a room on this device too, MIDI only), or by itself after a reload while it ran (v161: its address has
    `&output` while it runs or its link waits, so a reload starts it again; stopped, the address is the room's plain one;
    the tab's sessionStorage no longer restarts it). The address (`hash()`, `pageFlag()`, kept in step by `urlSync()` in
    `changed()`): `&output` for the output page, `&camera` for camera mode and the preview camera; a headset never gets
    either. Never in a headset session, never with camera mode or the preview
    camera (each refuses the other).
  - It is not an observer: it follows a studio circle (the one followed, else the first studio circle by id; its
    *Follows* picker takes any circle: a story that is not the studio gives people and trackers only) and writes the
    studio's state as any page following it does, only through the studio's `HOST.cur.out.act()` (presses, sequences,
    `sw.<id>`, `bt`); nothing else of the room.
  - Its hello: `name: 'Output page'`, `kind: 'desktop'`, `here: false`, `out: 1` (sent again as it starts and stops: the
    relay keeps `m.out` and lists `out: 1` in its members; the peer-to-peer and on-device hubs keep it as `m.outp`, since
    a hub member's `out` is its link's send, and list `out: 1` too). Its presence, once a second (a page's is every 2 s):
    `{ st, kind: 'desktop', out: 1, ts }`, never a head: others mark it `P.out`; it is never drawn, never a person in a
    headset, never in `heads()` or `persons()`. The pages' people list and the headset menu's people rows say *output
    page*.
  - The relay's `@osc` (fx with `by: ''`: OSC in, and the relay's OSC status) is taken in `onFx` only from the relay
    itself and only while this page runs as the output page (`HOST.out.oscFx`); never passed to a story.
  - `HOST.collab`: `outOn()`, `outOffered()`, `outStart(why)` (a promise), `outStop(why)`, `outMark(on)` (output.js's own:
    its hello, presence, body class `outp`, sessionStorage), `osc(msgs)` (`{ t: 'osc', m }` in pieces of 128; false off a
    relay, not open, or not the output page), `oscCfg({ trk })` (`{ t: 'osc-cfg' }`), `oscPing()` (a promise of what the
    relay's `/api/ping` says of OSC, `{ out, in, trk }`, or null), `persons()` (`[{ id, name, color, kind, st, body }]`:
    every member in a headset with a head heard in the last 2 s; the spec named it `people()`, which stays the presence
    Map the tests read), and for tests `presIn(id, v)` (a presence as if heard from member `id`).
  - The page (`output.js`; its overlay `#out`, a side panel at the right (v160; the studio's panel on the left stays usable), 420 px, scrolling, under the top bar, the story's
    picture visible at the left; its CSS `OUT_CSS`, injected once): Status (the room, how it runs, *Follows*, the scene;
    *Keep this tab in front* while the tab is hidden, since a hidden tab stops the scene's frames), MIDI (*MIDI: On/Off*,
    the output and input ports by name, *Test note*: 60 on channel 1, *MIDI clock to the room's beat*), OSC (what the
    relay says, *OSC*, *Trackers as OSC (the relay)*), Events (*Every press and sequence on the default addresses*, *Also
    what this page caused*: off, so what this page's own actions cause is not sent back; *Note length*), People (slots 1
    to 16, the lowest free one as first seen, freed 60 s after they leave; *People as OSC*, 15 a second at most each;
    *Everyone in the room* or *At this circle*), Items (*Items as OSC*: a pose as an item moves more than 1 mm or 0.2
    degrees or is shown or hidden, 30 a second at most each), Streams and Incoming (tables, an edit form each, *Learn*:
    the next MIDI or OSC message fills a row), the mapping's *Export* (`output-mapping.json`) and *Import* (a file or
    pasted), and the log (the last 200 messages in and out; streams and people are not logged one by one).
  - The scene's sends: each `send` entry of an event (`HOST.cur.out.listen`) gives one OSC message (its own `osc` address
    or the default, `/studio/cube|item|seq/<id>/<ev>`, `ssssi`: who's name, colour, member id, the item's name, 1 or 0;
    `at` adds the marker's time) while OSC is on, and a note (on, then off after the note length or, held, at the paired
    end: enter/leave, on/off, hover/unhover, start/stop; per item, entry and person; a person gone, Stop or MIDI off ends
    every held note) or a CC while MIDI is on; channel 0 is the person's slot. An event without entries (every press and
    sequence start or stop) goes out only with *Every press and sequence*, on its default address, as OSC only.
  - What the output page keeps is this machine's: localStorage `outMap` (`{ out: 1, opt, streams, incoming }`, validated
    as read, a bad row dropped and said); the scene's sends are the scene's (`layout.json`, `docs/agents/studio.md`).
  - The cube rule's one exception (AGENTS.md): only for a cube opted in to send (its record has `send` entries), the fact
    that a person walked into it or out of it is sent as an ephemeral effect from that person's device; what the cube
    shows, hides, changes or starts for them stays their own and is never sent. Pointing at an item whose press has
    `hover`/`unhover` entries is likewise sent. Nothing goes into `state()` for either.
  - Tests: `node tools/output/test-page.mjs` (MIDI and the studio's API stubbed; a room on this device and one on a plain
    relay), then the integrator's end-to-end round `node tools/collab.mjs --output`.
  - Known races (seen in the end-to-end round, v157; neither is the output page's): in a studio circle made for a scene
    (`addScene`, "Studio: <scene>"), where every device writes the scene's layout itself, the room's state was seen to end
    as `{ scene, settings }` with no items, written by the pretend headset that walked in first, and every device then
    empty (five of eight runs with the pretend headset's frames stopped between steps); a plain circle whose scene is
    picked on a page did not show it. Fixed in v179: a device that had opened the scene but not read its layout yet sent
    the scene's name alone, which could reach the relay after another device's whole layout; now the studio's `state()`
    is `undefined` (the shell's `statePoll` sends nothing) while a scene opened *fresh* has neither its layout read here
    nor an item (`freshWait`), and a station's one scene opened by itself (`chooseScene`) is opened *fresh* too. The
    trackers round's `addScene` circle checks the items on all four devices.
    Fixed while integrating: an item named in an incoming mapping just after it was added was refused until the output
    page's item list (read once a second) caught up; a name not found now reads the list again at once. And a cube or
    an item whose only entry for a start holds a note (`hold`) now also sends its paired end (`leave`, `unhover`,
    `off`), so the note ends.
  - v158 (FORMAT networks-52; the owner, 17 November 2026: values to send for objects, trails "for both and show to
    everyone at the circle", a loop recorder "movement for now, both clocks should be possible", then "also do the
    events"; the contract is `tools/output/SPEC.md`, "v158"): the room's beat has bars (`bt.bar`, `at` a downbeat); MIDI
    clock in takes Start as a downbeat and Song Position, *Beats a bar*, OSC `/studio/bar`; the room can lead (the page's
    *Tempo*: bpm, bar, Tap, Start, Stop) and *MIDI clock out* sends clock, Song Position, Start and Stop with Web MIDI
    timestamps from the room's beat; the scene's own streams (an item's card, `stream`) run on the output page beside its
    table (`list()`, `pose()` measured every frame: x y z, yaw pitch roll, speed, vx vy vz, acc, spin; `value()`: size,
    shown, clip, path, motion, near, count), as CC, 14-bit CC (`wide`), a threshold note (velocity fixed or from speed) or
    OSC (`/studio/item|cube/<id>/<v>`, `/gate`); the page's own table gains vx vy vz acc roll spin, 14-bit and notes. A
    card's stream *Try* is the effect `send` with `ev: 'stream'`, the page sweeping 0 to 1 to 0.
  - Untested until tried: Web MIDI with real virtual ports (loopMIDI, the IAC Driver, ALSA) and Cardinal, real MIDI clock
    from a DAW, OSC to real apps, UDP through a firewall, the trackers' OSC rate on the PC, cubes and pointing from real
    headsets, how in time it feels.
- Arrange all: two rows in front of you, half the stories of the main set (`HOST.list`; rounded up: about eight)
  1.2 m ahead and the rest 2.6 m further on (behind them; in the gaps when the second row is shorter), 2.4 m apart, every
  station facing away from you (its content floats 1.4 m beyond its spot); it
  needs about 17 m x 4 m of floor from 1.2 m in front of you. It leaves the design room's table where it is (not a
  story), the All stories and lobby circles too (never moved, made or removed by it), and since v188 the Experiments
  set's stories (`HOST.menu`, `list: "experiments"`): never placed by it, a circle of one stays where it is. Add (the
  page's picker, the headset's Add page) lists them after the main set's (`HOST.stories()`); an All stories circle's
  arch can open the Experiments set (this device's own, never the room's) and its pick may be one (`allPick` takes any
  of `HOST.stories()`); a station of one starts in story mode; no `FORMAT` change (the keys and states are as before). Remove asks first ("Remove for everyone?", 3 s), on the page and in the headset.
- Station icons and halos (v145): all stations' halos are one instanced billboard draw (`HALO`, `haloAdd` in `iconStep`; instanced
  quads in a small additive `ShaderMaterial`, not `Points`, whose size a GPU clamps; `I.halo` is only the colour holder); an
  icon's see-through mesh is hidden while its scale is under 0.3. Icon miniatures of a room's stations are built by `iconIdle`
  (a 40 ms timer, 2 ms slices, in a headset browser or session) and `iconStep` builds only the missing ones, one a frame and only
  on a frame that was not late (`ICON.okNow`).
- Station icons (`makeIcon`, `iconDef`, `miniDef`, placed by `iconStep` in `shared.js`; made from the miniatures): over each station's ring, its middle 2.1 m
  above the floor (over the heads of people in the circle and above the card's top edge at 1.6 m, so from across the
  room it covers neither), its story's main miniature: the `icon` of its entry in `stories/list.js` (a key of
  `LOWPOLY_MODELS`: the tour's interactome, the PET scanner, the airports' globe; the design room's own `design.table`,
  a small round table with props on plates in the stories' colours, which is only its icon, not a prop on the table;
  and the shell's two circles' own, `all.stories`, the Stories screen in miniature (sixteen cards in the stories' colours
  in two rows on an arc under its header, lit from within), and `all.lobby`, an open doorway with light in it, stepping
  stones up to it and a curved arrow turning back over it (the icons of All stories and Back to the lobby, `KINDS` in
  `shared.js`; not props either: story `all`, which the design room's build skips)), from the file that holds it (since
  v190 a story's own package's `minis.js`, the shell's four from `lowpoly.js`: `tools/packages/SPEC.md`, "Miniatures"),
  loaded once through `HOST.lowpoly(name)` the first time an icon wants one (again 30 s after a failure); a station of a
  story not on this device tries `packages/<key>/minis.js` and takes the miniature marked `icon` there, in the stand-in's grey. Its parts are merged into
  one mesh (one draw call; its see-through parts, glass and haze, in a second, drawn after without writing depth),
  centred and sized as the first hand-made models were (its box in a ball of 0.6 units, its longest side at most 0.9:
  a globe about 0.2 m across, `ICON.size` 0.3 m a unit), with a soft additive glow behind it in the story's colour
  (`col` in `HOST.list`), and its own colours drawn towards the story's (`ICON.tint` 0.55: by lightness, from a dark
  tone of the colour through the colour to a lighter one, so white parts take it too), so people can tell from across the room which circle
  is which story. It is turned to your head and leant back as far as you look up at it plus 0.2 rad (so its top
  shows), and turns about its own axis once in 12 s, each station in its own phase; the flat ones (lower than about
  0.6 of their width: the slide, the room, the table) lie back further, by how flat they are, so their top always
  shows. Lit by its own shader in view space (a light over your shoulder, a rim in a paler tone; glowing parts nearly
  unlit), so it looks the same in every story's scene whatever its lights. It follows the rings, not the cards: shown
  in every labels and cards mode, opaque, depth-tested and writing depth in the room, since it is part of the station
  rather than a card, and with cards hidden it is what tells the circles apart. At your own (live) station it shrinks away
  (your story is in front of you); in a circle the others' icons are what shows of their stations ("In a circle, icons
  only"). A child of its ring's group, so it eases with the station (`SHOWN`) and grows with it while carried; pointable
  through an unseen ball round it (`ICON.ball`), as its ring is. Built once per story, the
  first time a station of it shows, at most one a frame (a room's first view would build every one at once), and
  kept; until then, while its file loads (or if it cannot), and for a key whose entry names no miniature, a glowing
  dodecahedron with a ring in its colour stands there: a seventeenth story needs only its `icon`. 600 to 1,200
  triangles each. `tools/icons.html` (served next to the app) renders them all, every story's, then the design
  room's and the shell's two circles' (`HOST.collab.kinds()`, keys `all` and `lobby`), in a grid as a headset sees them (`?keys=a,b`, `&cols=`, `&t=` frozen, `&turns=4` four sides, `&fallback`),
  from the app in a hidden frame through `HOST.lowpoly('*')` and `HOST.collab.icon(key)` (its `model` says which
  miniature, '' the fallback). How they read from across a real room is untested on a headset.
- The design room in a room: not one of the stories, so never part of
  Arrange all (it neither places nor moves nor removes a station of it), but a station like any other once placed: the
  page's Shared dialog lists it after the stories in its station picker (Add), the headset's Add here page too, and the
  headset's menu has a *Design room* row (below the settings and Panels, above the shared room): outside a room it
  opens the design room (`HOST.go('design')`, the menu closing; greyed while you are there); in a room, *Design room
  here* puts the props table at your feet as a circle facing your way, or moves the room's one there when it has one
  (one table, not a pile of them; `pageHere`, `HOST.collab.design(b)`), refused while the circles are locked as Add
  is (greyed). A new station of a page that is not a story starts its clock at its table, in explore mode (a story's at
  its start, paused). Standing at it (it is at your feet) the headset takes it as its station and the table stands
  life size in front of you (its middle 1.55 m ahead of the spot), shared like a story at its station.
- The studio in a room (v111): a page that is not a story, placed and kept as the design room is. The page's Add and
  the headset's Add here list it after the design room (`STORY_EXTRA`'s order, then All stories and Back to the lobby);
  the menu's Settings tab has *Design room* and *Studio* side by side (`PAGE_ROW`, `pageRow`): outside a room *Studio*
  opens the studio (`HOST.go('studio')`), in a room *Studio here* puts a plain studio circle at your feet facing your
  way, or moves the room's plain one there (one not made for a scene: no `sc` in its record, told by how it was made and
  never by its state, which names a scene as soon as one is picked there; the first by id when there are several,
  whatever circles of scenes stand beside it; `pageOne`, `pageHere`, `HOST.collab.studio(b)`; a room may
  hold several studio circles), refused while the circles are locked; never Arrange all. Its clock starts in explore
  mode.
  - Scenes as circles (v118; the owner: "add scenes as possible circles"): the page's Add and the
    headset's Add here list after *Studio* one entry per scene of the studio's relay (*Studio: <scene>*; `SCN`,
    `scenesFetch`: `relayFind()`, then `GET /api/scenes` with the kept password through `api()`, asked again whenever
    the dialog or the Add here page opens, at most every 3 s; nothing listed without a relay, from a relay without
    `--scenes` or one that refuses; the headset's page shows at most 8, `SCN_ROWS`, and says how many more a page has).
    Such an entry (the picker's value and the button's id `scene:<name>`, `addOne`) makes a studio circle for that scene
    in one batch (`addScene`): `st.<id>` = `{ story: 'studio', sc: true, x, z, yaw }` (`sc`, the shell's own mark that
    the circle was made for a scene, kept by every move, `stVal`; FORMAT networks-33), its clock, and its state `st.<id>.x` =
    `{ scene }` (the studio's own field and nothing else: the studio at a station whose state names a scene and holds no
    items opens it and writes its saved layout, every device alike; the shell changes no `state()` shape). Several
    studio circles may stand in a room. Wherever the shell names a station (the cards, the dialog's rows and map, the
    menu's lists and Story tab, people and Follow lines, the question of circles asked first) a studio station whose
    state names a scene is *Studio: <scene>* (`sceneOf`, `stTitle`; a plain circle too, once a scene is picked there). `HOST.collab.scenes()`, `addScene(name, b)` and
    `sceneOf(id)` are for tests. Its scene is life size on the room's frame (v125; the owner: everything aligned to the room marks, the circle only the entry): its origin and axes the room's (the floor at y = 0; on a room calibrated on its floor spots spot A, x
  towards spot B), so every item stands at one place in the real room whichever circle shows it and wherever that circle
  stands (two studio circles of one scene show it at the same place); the circle is only the way in (walked into, or *Go
  in*), its panels float at it, and moving or turning it (the grip, the map, Move here) moves nothing of the scene (*Move the scene to this circle*, "The studio" below,
  puts a layout made before v125, when the scene stood round the circle's spot, back round its circle). Everyone at the station sees one scene and one layout: `state()` is the
  scene's name and one field per item ("What each story shares" below; the studio came with no `FORMAT` change, an older
  device showing the station as *A newer story*; sounds that follow a model changed a sound's record, networks-30;
  cut-outs added a field per cut-out, networks-31; groups a field per group and Faces an object's `faces`, networks-32). What each person's place reveals (the trigger cubes), editing, the selection, Walk, the
  VR stick walk and sound are each device's own. With exactly one scene in the relay's listing every device at a station
  with none picks it and writes its saved layout (every device writes the same records, so nothing doubles); else
  *Pick a scene*. A circle made for one scene (v118: the shell's *Studio: <scene>*, written as `st.<id>` = `{ story:
  'studio', x, z, yaw }` and in the same batch `st.<id>.x` = `{ scene }`): a station whose state names a scene and holds
  no item field at all is opened on every device there as `'fresh'` (`collabApply`), each writing the scene's saved layout
  alike (sending nothing before that, v179: `freshWait`, "Known races" below), so the circle shows the scene at once (a device with that scene open already, from another station or outside
  the room, opens it again there: `STU.stId`; items from the room that come first are the room's, `STU.fresh`). *Lock this
  story* refuses its editing for everyone at the circle ("The studio" below).
- Moving a station by hand: in a headset the grip on a station's ring, icon or card
  picks it up (the shell hears the session's own `squeezestart` and
  `squeezeend`, controller i being `session.inputSources[i]` in three.js r128,
  so the stories need nothing); it swings round your hand as you point, its
  distance from the hand grows as you raise the controller and shrinks as you
  lower it (`exp(2 x the pitch's change)`), and twisting your wrist turns it
  (`carryStation`). It goes out to the room at most every 66 ms while it moves
  (with `ts` and `h: 1`), once more as it comes to rest and once more without `h` when let go (`MV`; a carry the
  circles lock stops lands where it was last sent), and the others draw it as it moved, a moment later (`SHOWN` from
  its samples: "Others' moves, smooth"); it is also put down when its controller goes, its grip
  is up or the headset is taken off (no `squeezeend` may come then). Your own
  station's ring can be grabbed too while *Show all rings* shows it (a trigger on
  it does nothing; else *Move here* in the menu moves it). Every
  headset draws rings, cards and its live station's placement where `SHOWN`
  eases them to the room's value, so a moved station glides, and the people at
  a moved station keep it (a station is left only by walking into another
  circle). On a page the room map does the same: a station's dot dragged
  moves it, its square (where its content floats) dragged turns it; a click
  still follows it, the map keeps its scale while dragging, and an interrupted
  drag (`pointercancel`) puts it back.
- Two locks (the owner's wish: one for the circles' movement, globally, and one per story's circle for its panels and story):
  - The circles lock (key `lock`, `{ on, by, at }`, FORMAT networks-6): once the stations are in place anyone locks them
    (*Lock circles* in the headset's menu and the page's Shared dialog) and
    anyone unlocks them. While on, the grip on a station's ring or card, the
    room map's drag and turn, Arrange all, Add, Move here, Design room here
    and Remove are refused (`refused()`, `circlesLocked()`), a station being
    carried stops where it was last sent. It never
    locks a scene or a panel. A room whose old layout lock (v96) was on reads as circles
    locked only: its stories need locking once.
  - A story's lock (*Lock this story*; `lock` in `st.<id>.ui`, with its
    panels; `stLocked`, `setStLock`, `HOST.collab.stationLock(id)`,
    `setStationLock(id, on)`): the grip moving, turning or resizing the
    station's scene and moving or tilting its panel is refused for everyone
    at its circle (`HOST.room.gripLocked()` there, and the story panels'
    hint: "This story is locked"); a scene or panel held when it locks stops
    where it was last sent and glides back to the room's. Set in the clock
    menu at that station (beside *Lock circles*) and per station in the
    page's Shared dialog (*Lock story* / *Story locked* on each station's
    row); never refused by the circles lock, nor the other way round.
- The headset's menu (the shell's panel, `PNL`, `drawPanel`) is closed at the
  start of every session, and nothing of it shows then: no watch on the wrist (the owner: not needed, the menu opens by a stick click or a double pinch). The welcome, *Getting around* (v124, below), says how
  to open it; with the welcome off (tests) a notice titled *The menu*, 2.5 s into a session, says it as before
  (set as the session starts, in `watch`: *Click a stick to open the menu*, or with tracked hands *Pinch twice with your left hand, pointing at
  nothing*), unless it is open by then.
- Getting around (v124; the owner: a toast after alignment saying how to enter circles and what the trigger and grip do; `WEL`, `welStep`, `drawWelcome`,
  `OV.wel`): once a session in a headset, a small panel in front of you (its own sheet, not a notice, so `notes()` is
  unchanged: 760 x 360 px, 0.56 m wide, 1.05 m ahead and 2 cm under the eyes, eased with the head as the notices are
  and above where they show, over everything, `renderOrder` 54; since v182 pointable: the trigger on it closes it at once,
  `welClose('pressed')`, the owner's note) for 14 s (`WEL.ms`, *Closes by itself in n s, or press it*), with a soft chime. Its words: *Getting around*; in a room with circles (the room's arc aside), by the room's
  setting, *Point at a circle's card or icon and press the trigger to go in.* (asked first) or *Walk into a circle to go
  in.* (walked into); in a room with only the room's arc, *Point at a story's card in front of you and press the trigger
  to start it.*; then *Trigger (index finger): click.*, *Grip (middle finger): grab and move things.* and *Click a
  stick: the menu.*, beside a controller drawn from the side with its trigger in cyan and its grip in amber. With tracked
  hands (the left input source a hand): *pinch* for the trigger in the circles' line, *Pinch: click.* and *Pinch twice
  with your left hand: the menu.* (a hand grabs nothing: the grip comes from squeeze events only). In a shared room it
  waits until this headset is lined up (`lineUp().k` `'ok'`, or `'away'` or `'alone'` where nothing lines up) and nothing
  else is in front of it: not while the startup flow is to come or shows (the room setup guide, the check by eye), nor
  while calibrating, checking or re-aligning, nor over the circles' question, the once-per-room question, the menu or
  its keypad; outside a room 2.5 s into the session (`WEL.wait`). It closes early when the menu opens (or the circles'
  question, the check by eye or a calibration comes), and does not come again that session. Never in camera mode
  (`HOST.collab.cameraMode()`, where a version has it). Its opening by itself: `HOST.collab.autoWelcome(on)` (off also
  closes one on show), or `localStorage` `collabAutoWelcome` = `off` before the page loads (every page `tools/collab.mjs`,
  `tools/smoke.mjs` and `tools/audio.mjs` open has it, as `collabAutoAll`; `installXR`'s `welcome: true` turns it on);
  `HOST.collab.welcome()` (`{ shown, at, text, mode: 'ask' | 'walk' | 'arc' | '', hands, done }`) is for tests. How it
  reads and where it stands on a real headset, and its timing after a real alignment, are untested. The menu opens and closes with a click of either stick
  (`sticks`: `buttons[3]`, rising edge, per input source; a stick held down as its controller appears is no click; no
  story uses it: they use the stick's axes; it opens or closes once 0.4 s have passed with no second click of
  that stick, `CLK`: the left stick clicked twice turns moving with the sticks on or off (the right stick clicked twice
  launches or lands a spaceship; while one flies, a press of the right stick pushed past 0.5 from
  its middle counts for nothing) and never the menu, the other
  stick clicked meanwhile counts as the same click, so both at once still toggle it once; "Moving with the sticks" under
  "Four headset settings"; `buttons[4]`, A and X, plays and pauses nothing), or with tracked hands two
  pinches of the left hand within 0.4 s while its ray points at none of the panels (`pinched`, from the session's `selectstart`: not at the menu, a
  station (the shell's hover) or a story panel (the `near` the story passes to `HOST.collab.ray`), so two pinches
  meant for a panel's button stay the button's; the scene counts as nothing, since in the flock, the robots and the
  pass story's sea the scene is everywhere the ray goes, and the story gets those two pinches too; not the right
  hand's, not while calibrating; the owner: "only left double pinch"), and by Close in its header. Unused for
  20 s (`IDLE`; no press, no ray resting on it, no fingertip at it, not held) it closes by itself, not while
  calibrating, not while it asks its once-per-room question, and when it opened by itself (`PNL.self`) not until it has
  been used (neither opens again by itself). It
  floats in front of you (`floatMenu`, `FLOAT`; the owner: "Menu should be further away from the face by default, also
  should be movable with grabbing"): put there as it opens, level in the direction you face, its middle 0.8 m ahead
  along the floor and 12 cm under your eyes (`FLOAT.pos`, `{ d, h }`), at 1.05 of the panel's 0.42 m (about 44 cm
  wide: too far for a fingertip, the ray reaches it), turned to you, hanging from
  its top edge, so the tabs stay put while the tab below them changes height. It stays put while you use it and glides
  back in front once your head has turned more than 30 degrees from it, walked off (nearer than 0.35 m or further than
  1.4 m along the floor) or moved 25 cm up or down, never while a ray or a fingertip is at it. The grip on it (on its
  canvas or the Story tab's copies of the panels; `grabMenu`, before the shell looks for a station; `MG`) picks it up:
  it stays at that point of the controller's ray, as far along it as where it was taken, turned to you (`carryMenu`),
  and where you let go (`menuPut`) it stays for as long as it is open (`FLOAT.pinned`: no gliding back), and the
  distance and height you left it at are where it opens next time (`xrMenuAt` in `localStorage`, this headset's own;
  `d` 0.3 to 2 m, `h` -0.8 to +0.6 m). It is put down when its controller goes, its ray is stale or the menu closes.
  Its header shows *Menu* and the time (hours and minutes, `timeNow`, redrawn when the minute changes), how it closes,
  Close, and four tabs (`TABS`, `PNL.tab`, `setTab`; it opens on the tab used last, kept as `xrMenuTab`, Story the
  first time, and on Circles when it opens by itself), each as tall as what it shows:
  - **Story** (the owner: a tab showing the current circle's story panels): the
    story on show's own two panels, its text panel over its foot bar, drawn by the menu as two planes over its canvas
    (`OV.mirror`, `renderOrder` 54, `mirrorStep` each frame where `drawPanel` left room for them, `PNL.mirror`) with the
    story's own canvas textures, so they are the story's panels exactly as they are now (its pane, its hover, its
    buttons lit), whatever the Cards and Panels settings and wherever the story's own panels are. They are used there
    as on the story: the ray on a copy is a shell hit of kind `storypanel` that `HOST.collab.ray` returns as
    `{ kind: 'shell', panel: 'main' | 'foot', u, v, point, dist }`, and the story turns it into a hit on its own panel
    at that point (`menu: true`), so hovering, pressing and its sounds are the story's own; the grip there moves the
    menu, never the story's panel (`xrGrab` ignores `h.menu`). Over them the story's title in its colour; with no story
    on show a line instead (in a room away from every station: walk into a circle; else pick one). The story gives
    its panels through the `panels` hook (below).
  - **Settings**: Exit (ends the session: neither the story panels nor the headset Stories screen have one), *Recenter* and *Anchor: on/off* side by side
    (Recenter: the story's own, `HOST.cur.recenter`, as the story panel's
    button: you in front of it again, *Place again* while anchored; at a station the station's scene and panel back
    where the story puts them, for everyone at its circle, greyed while its story is locked; greyed away from every
    station. Anchor, `set:anchor`: `HOST.anchor.set`, anchored placement for every story; in a shared room it can be turned off, not on, as the room places everything), *Slideshow:
    on/off* (`HOST.slides.setGlobal`, for every story, shown when `HOST.slides` exists, a note beside it), *Repeat:
    off* / *all* / *one* (`set:repeat`, `HOST.setRepeat`, each press the next, this headset's own, a note beside it:
    what a story's end does, or in a room that it does not run there), *Labels* and *Cards* side by side, *Moving* and *Subtitles* side by side (the four headset settings,
    `HOST.xr`), *Moving with the sticks: on/off* (v125, this headset's own, the whole width with a note under it,
    greyed with the reason in AR, in a shared room and in the studio: "Moving with the sticks" under "Four headset
    settings"), *Spaceship: launch* / *Spaceship: land* (v132, the whole width with a note under it that the right stick
    clicked twice does the same, greyed with the reason where no ship can fly: "Spaceships"), *Frame rate: on/off* (the frame-rate read-out, this headset's own, a note beside it: "Four headset
    settings"), *Developer mode: on/off* (v125, this device's own, a note beside it: "Developer mode"), *My menu: only me* / *my circle* (this menu shown to the others at your circle, this headset's own, a note
    beside it: "Your menu shown to your circle" under "Four headset settings"), then *Panels* (the story on show's, `HOST.panels`, with a note beside it: in a room that the panels are
    for everyone at this circle and the rest for the room, else for that story only; with no story on show, in a room,
    a line that these four and Sound effects are the room's takes its place); *Sound: on/off* (`set:sound`, this headset's
    mute in the session, `HOST.audio.mute`: on until turned off there, v124, saved as `xrMuted`; a press is a tap, so it
    starts the engines too; a note beside it); *Sound effects: on/off* and *Narration: on/off* side by side (Sound effects
    for every story, in a room the room's: "The two sound switches"; Narration this headset's own, in a room until the
    lobby: "The narration"), then *Effects volume* (`HOST.sfx`, this headset's own, with a note saying so); *Design room* and *Studio* side by
    side (outside a room each opens its page; in a room *Design room here* and *Studio here* put its circle at your
    feet: "The design room in a room", "The studio in a room"), a note under each.
  - **Circles**: the shared room (also *Back to the lobby* under the two locks, ending this headset's live station as walking into a lobby circle does, greyed at no station and at the room's arc) (its code and people as the heading, with *Another room* beside them in a room; in no
    room the rooms, then *Start a room*, *Join with a code* and *Refresh*; the question; stations (Move here, Add here;
    Arrange all, Remove; *Lock circles* and *Lock this story* side by side, the latter at a station only; at an All
    stories circle its switch, *Own stories* / *With the room's circles*, and *Back to all stories*; *Show all
    rings* and *On this network*; *Circles: walk in* / *Circles: ask first* with a note (the room's, "Circles asked
    first"); *Narration for everyone here*: *On for all* and *Off for all* (v124, "The narration" under "Sound effects");
    above them, for a headset in the room with the others, *Room setup* and how it lines up), people (at most `PEOPLE_ROWS`, 6, and as many as leave room for You), You (name,
    colour, Leave). *Join with a code* and *Another room* open a page in place of the rest of the tab (`codePage`, `PNL.code`): the code so far in three
    boxes, a keypad of the 26 letters (seven to a row; a fourth letter refused), Delete, Join (once there are three
    letters, and not the room you are in; a code with no room says so, as on a page) and Back. *Room setup* opens the
    room setup guide's five pages there likewise (`guidePage`: "The room setup guide, its startup flow and Touch the
    spot"), which also opens there by itself as a headset enters a room.
  - A keypad for a word (v118, `HOST.collab.keypad({ title, hint, value, max })`: a promise of the text typed, or null;
    for pages that need a word in a headset, which cannot type, such as the studio's scene names): in place of the tab
    shown, whichever it is (`keyPage`, `PNL.kp`, the relay password's page as its model), the title, a hint, the text so
    far, the 26 lower-case letters and the ten digits nine to a row, *space*, `_`, `.` and `-`, Delete, OK (greyed while
    there is nothing but spaces; it gives the text as typed) and Back. The menu opens for it, and closes after OK or Back
    when it was closed before; it does not close by itself while the keypad waits. Back, another tab, the menu closing,
    another keypad and the session's end give null (`kpEnd`); with no headset session or no story scene to show the menu
    in, null at once. Its buttons' ids are `kp:<key>`, `kp:space`, `kp:del`, `kp:ok` and `kp:back`.
  - **Debug**: the room's alignment (in a room, once the question is answered: Calibrate, Re-align, *Check here* (Touch
    the spot) and what the check says, the shared space's lines, Forget calibration, Shared space: on/off, Fresh shared
    space, then *I am elsewhere* / *in the room*), *Places* (v130, in a room or in none: *Join ABC: you are standing in
    its place* when offered, each place kept with its *Forget*, the anchor budget's line, and since v131 the room's areas
    with *Forget area*: "Places" and "Areas" under "Shared rooms"),
    *People: same circle* / *everyone* and *Sound check* (a page in place of the rest of the tab: the two beeps,
    the engine choice, Reset the sound and `HOST.audio.report()`, redrawn twice a second; *Try the sound effects*;
    Back), *Trackers: shown / hidden* (v126: the PC's trackers as small pucks, this headset's own, a line beside it: "Vive
    trackers"), *Refresh rate: 90 Hz* and *Foveation* and *Resolution* side by side (v136, this headset's own: "The refresh
    rate" under "Four headset settings"), *What is new* (v125: this release's lists, a page in place of the rest of the tab, with Got it and Back:
    "Developer mode") and beside it in developer mode *Notes* (v148: the developer notebook's notes from the relay, a page
    in place of the rest of the tab, read, played, marked and deleted there: "Reading notes in a headset" in
    `docs/agents/shell.md`), then read-outs (`debugLines`: the release and `FORMAT`, the room's code, relay or peer to peer and its round
    trip, Quest Browser's version, the frame rate, `FPS`, once a second, with the session's refresh rate, and since v150 the GPU's textures (`gpuInfo`): a line *Textures: at most 16,384 px · compressed: ASTC, ETC2, ETC1* (`MAX_TEXTURE_SIZE` and the compressed formats in `getSupportedExtensions()`; *no compressed formats* without any, so every texture is raw pixels; *(WebGL 1)* on a WebGL 1 context) and the GPU's name on the Browser line (`WEBGL_debug_renderer_info`'s `UNMASKED_RENDERER_WEBGL`, else `RENDERER`, ANGLE's wrapper and *(TM)* taken off: *Qualcomm, Adreno 740, OpenGL ES 3.2*), one line more so the tab stays under the smoke test's 1,500 px; read once per WebGL context and logged once as `gpu` (ASTC's profiles too); `HOST.collab.gpuInfo()` for tests; the owner, 16 November 2026, before deciding on compressed (KTX2) textures: "add the debug lines so i can check"). The read-outs
    are drawn on their own as they change (v136; `stripStep`, `stripRow`, `sheetPatch`): the frame rate and the round trip
    are out of the menu's signature (`panelSig`), so the whole canvas (720 x 1920, 5.5 MB with its mipmaps) is no longer
    drawn and sent to the GPU each time they change; at most every 200 ms (`STRIP.ms`) a line that changed is drawn again
    on a small canvas of its own (its row: the menu's background, then the line), put on the menu's canvas in its place
    (so the picture shown to your circle, `menuShot`, has it; `cver` does not move for it) and sent to the menu's texture
    alone (`texSubImage2D` of that row, 652 x 30, then its mipmaps; a texture still to be sent whole carries it; without
    WebGL2 the whole texture), another number of lines drawing the tab again. Likewise (v136) the members are in the
    signature only on Circles and Debug (which name them) and the people's stations only on Circles (its people rows):
    someone walking between circles drew the whole menu again whatever tab it showed. `HOST.collab.strip()` (`{ rows,
    patched, lines, at, x, w, lh, ver }`), `stripMs(ms)` and `fpsTest(v)` (the frame rate as a second's count would set
    it) are for tests.
  With Sharp text (v177; `docs/agents/shell.md`, "Sharp text") the menu is also a WebXR quad layer in a headset:
  `HOST.collab.sharpMenu()` gives the shell its canvas, mesh, change count and the part shown.
  The canvas is 1920 px tall, more than any tab needs (Circles in a room with six people is about 1230 px, the room setup
  guide's tallest page about 1090; Settings about 1700 with a ship flying outside a room (the smoke test's spaceship steps print it and fail past 1900), Debug about 870 (v136's three rows add about 210 px: 1384 px in a room on this device with 20 stations and no places; the smoke test's frame rate steps print it and fail past 1500); What is new as tall as its lists, up to the
  canvas; Notes about 1400 at most (its views are of a fixed height); Story as tall as the story's two panels at the menu's width). A right index fingertip also presses its buttons (`poke`: within 1.5
  cm of the panel over one, again once pulled back 3 cm; a pinch on the ray at the same button within 0.7 s counts once
  with it, `twice`), not the Story tab's copies (the ray does). The
  once-per-room question still opens it by itself (on Circles), and so does the first time in a room with no stations
  (once per room: its Stations section says "None yet: Arrange all puts every story in front of you"; since v109
  not while this headset is about to make the room's arc: automatic circles on, no `allp` yet, in the room with the others). The notices
  say how to open it and under which tab (`menuWhere`). `HOST.collab.panelOpen(on)`, `HOST.collab.menu`,
  `menuTab(t)`, `menuIdle(ms)`, `menuFind(id)` (a button on whichever tab has it, that tab shown), `menuIds()`
  (every tab's buttons), `menuGrab` (held by the grip), `menuPos()` (`{ d, h, pinned }`) and `notes()` (the last eight notices
  shown, titles and texts, kept on the page only) are for tests.
- People in 5 draws (v145, `PPL`, `peopleBuild`, `drawPeople`): heads with visors are one `InstancedMesh`, hands one, dots one,
  rays one `LineSegments` with vertex colours, name signs one `InstancedMesh` reading an atlas of name tags (4 x 8 slots of
  384 x 84, `o.slot`; capacity 48 people, 32 tags; `gl_FrontFacing` mirrors the back); on-top names (Cards: on top) stay a sprite
  per person. `o` keeps a facade (`g`, `avatar`, empty `rays` and `dots` carrying poses, `tag`, `sign` with two face stand-ins)
  so the tests' reads still work. The visor now takes a little of the person's colour (a look change, approved).
  `peopleWarm` links the overlay's programs ahead of time (`renderer.compile`, from the idle timer) so a first person
  appearing is no hitch. Shell allocations: `areaList` and `areasAll` memoised (`AREAS.rev`), `look()` memoised (`LKC`), people per
  station counted once a frame (`whoRefresh`), the ray history a 128-entry `Float64Array` ring read by `steady()`. Sheets fixed to
  the head (notice, ask, eye, welcome, fps read-out, subtitles, rec) have no mipmaps (`sheet(..., flat)`). The page's Shared dialog
  does no work during a headset session (`DLG.stale`; one render when it ends). `detach()` lets the Story tab's mirror textures
  go; `HOST.collab.mirroring()` is true while the menu shows them.
- The menu's hover (v145): the light of what is pointed at is not in `panelSig`; `panelHover` redraws the old and new button
  rectangles (each region keeps a paint closure; 3 px pad) and sends them as `sheetPatch` patches with one mipmap pass, and a
  full redraw sends only rows 0 to H (`panelSend`) once the texture is on the GPU, so `tex.version` no longer moves on a redraw:
  tests count `OV.panel.draws` (full draws), `hv` (hover patches) and `full` (whole uploads). Measured: 5.3 MB per hover change
  down to about 0.16 MB. Untested on a headset: the patches' offsets, the instanced people and halos over a real passthrough,
  how the merged visor colour and the 0.3 haze cut read across a room, whether `peopleWarm`'s compile links what the first
  render needs.
- Other people in a headset (`drawPeople`: from their presence, in room
  coordinates: their rays and the dots at their ends, a name tag over the head,
  and in VR or for someone elsewhere a simple head and hands) are drawn only
  when they are at the same station as you (their presence's `st` is your live
  station; the owner's wish); before you have walked
  into any circle you see everyone. *People: same circle* / *everyone* in the
  clock menu draws everyone (this headset's own setting, `collabPeople` in
  `localStorage`, never in the room; default same circle; for debugging;
  `HOST.collab.seeAll(on)`). Pages' room maps still show everyone. Heads, hands and rays are drawn where the
  presence put them `SMOOTH.DELAY` ago, between its samples (`ts` in each); presence without `ts` eases to the latest
  (a 60 ms time constant), as before.
- People's bodies (v164; the owner, 18 November 2026: "body with feet possible for everyone even just headset and
  controllers"; `bodies.js`, `HOST.bodies`; `shared.js`: `BODIES`, `BOD`, `bodiesBegin`, `bodyOf`, `drawSelf`). Wherever
  a head with its visor was drawn, a whole body is drawn in its place, its hands in place of the hand balls (rays, dots
  and name signs stay; the sign sits just over the helmet, 0.2 m over the eyes): in VR everyone at your circle (People:
  everyone shows all), in AR only people elsewhere (never over a real person in the room: `m.here`), in camera mode and
  on the desktop preview camera as they drew people before. *Bodies: on* / *off* (the menu's Debug tab, This headset,
  beside *People*; this headset's own, `collabBodies` in `localStorage`, on by default, never in the room or a state;
  `HOST.collab.bodies(on)`): off, heads and hands as before.
  - The mannequin, 'street armour' (the judge's pick of two designs, with ideas from the other, the light frame:
    `docs/history.md`): made in code once (2,470 triangles; its glows 840), opaque faceted plates over an undersuit, both a
    deep shade of the person's colour (pearl for the near-white), the colour in thick lights (a V visor with a white-hot
    core, a crest and a band round the helmet, ear pods, the collar, the chest's V, shoulder rims, gems at the elbows,
    circuit traces ending in pads on the bracers, thighs and back, knee rings, shin and calf strips, boot cuffs and
    soles), a network emblem on the chest and a spine of five nodes down the back; a scan climbs each body every 5 s, out
    of step person to person (its phase a hash of the member id); a soft pool of light under each boot, dimming as the
    foot lifts. Self-lit (a key light fixed to the viewer, the sky from world up, a sheen, a rim in the person's colour):
    the scene's lights are not used. 23 bones with Mixamo's names in a T-pose facing +z, every vertex bound to one bone;
    the knees a little bent at rest (2.5 cm of slack: longer steps, a stance).
  - Posed by `ik.js`'s `'head'` setup (the hips worked out below the head, the arms reaching for the grips, the feet
    planted and stepped by turns, gliding under the hips faster than 1 m/s: the sticks), calibrated once from the
    mannequin's own T-pose (the headset at its eyes and 8 cm ahead of them, the grips where Quest controllers are held in
    a T-pose: WebXR's grip axes). Hands from presence's `g` (the grips, or a tracked hand's wrist), smoothed as the head is
    (between the samples, else eased); where `g` is missing (an app before v126), from the ray's start and direction
    (which hand by where it starts, right or left of the head); else, and for a controller asleep, a relaxed hanging arm,
    eased in and out over 0.2 s. Each person's size follows their standing eye height (the 90th percentile of their head's
    height over the floor, a sample every 0.5 s over the last 30 s, 1.0 to 2.05 m, 1.6 m until 3 s are in; eased over a
    second): sitting or crouching bends the legs instead of shrinking the body. A jump (the head more than 1 m in a frame,
    or faster than 6 m/s over more than 15 cm, as a leap drawn between samples shows; a change of station; coming back
    into view) plants the feet again under them. Each person's figure (`o.body`: its skeleton, never drawn, the solver's
    state, the eye samples) lives with their overlay object and goes when they go; the facade keeps `o.avatar.visible`
    (the figure drawn, a body or a head), `o.hands[i].visible` (a hand drawn: a ball, or a body's own, both of them) and
    adds `o.asBody`.
  - One draw for every body: the mannequin's geometry instanced (`InstancedBufferGeometry`, a person an instance, at most
    49: the overlay's 48 and your own), each person's 23 bones solved on their own skeleton and written into a float
    `DataTexture` (70 x 49 texels of four floats: a row a person, three texels a bone, the rows of its matrix with the room's
    frame and the bind pose folded in, then the figure's look, v173; sent whole each frame a body shows, 54 KB), an instance's row, colour, scan phase,
    self flag and floor height as attributes. The design's SHADING and HALO blocks are kept as they were; only the
    TRANSFORM block is the app's (the bone's matrix read from the texture). The glows (camera-facing soft spots along the
    lights and the floor pools, additive, no depth written) are the second draw; their blending adds the colour and keeps
    the layer's alpha (v194, as the ships' `ADD`: three.js's `AdditiveBlending` added alpha too, a black square round each
    glow over AR passthrough; `docs/history.md`, "People's bodies"). The two meshes hang in the overlay root
    (the reference space): others' bones go through the room's frame (`R.m`), yours not. Nothing is made a frame (V8 still
    boxes some numbers: about 1 to 2 KB a body a frame measured in Node); about 0.02 ms a person a frame to pose and write
    on the test machine. The renderer cannot read floats in a vertex shader (`capabilities.floatVertexTextures`, WebGL1
    without `OES_texture_float` or vertex texture units): never loaded, heads and hands (the Debug tab's row says *Bodies: heads only*).
  - Loading: `bodies.js` and `ik.js` are loaded by `shared.js` the first time a body is wanted (someone with a head in a
    room, or My body in VR), as `output.js` is; heads and hands meanwhile; its two programs compiled once as it arrives
    (`HOST.bodies.warm`); a failure logged (`bodies failed`) and tried again a minute later. Phones never load it unless a
    camera there draws someone.
  - My body (`HOST.xr.body()`, `setBody(on)` in `index.html`; `xrBody` in `localStorage`, off by default, `#body=on|off`;
    the owner: your own legs when you look down "off by default"): your own body drawn from your head and your controllers'
    grips (or a tracked hand's grip space) as this frame gives them (`selfGrips`, in the world's frame: in a room or not,
    `gripStep` running only in a room), the head and neck folded away (its neck scaled to nothing, its glows there
    dropped, its rim and glow toned down: the self flag), on the room's floor in a room, else the reference space's. In VR
    only (in AR you see your own), never in camera mode or on the preview camera, never sent. A row on the menu's Settings
    tab under *Frame rate*; the page's Shared dialog has none (it holds only the room's settings for the headsets).
  - A story's own figures (v173, the tutorial's guide; `packages/tutorial/src/SPEC.md` section B). `HOST.needBodies()`
    (`shared.js`) loads `ik.js` and `bodies.js` on a page too: a promise of true once ready, false where bodies cannot be
    drawn or the load failed. `HOST.bodies.set(cap)` (1 to 8) makes a draw set of the story's own, `{ cap, attach(parent),
    begin(t), add(B, I), end(), dispose(), stats(), meshes() }`: its own texture, instance attributes and two materials
    (the same programs), wrappers over the shared geometries; `begin(t)` its own clock in ms (story time: the scan stops
    when the story pauses); `dispose()` frees its texture and materials, never the geometries (a story that disposes its
    scene calls it first; the wrappers go to a pool the next set of that cap takes). The people's set (`begin`, `add`,
    `end`, `attach`, `stats`, `meshes`, `CAP` 49) is unchanged and draws today's pixels exactly. `add`'s `I` also takes
    `hide` and `dark` (bit masks over `HOST.bodies.PARTS`: 0 body, 1 chest emblem, 2 spine nodes, 3 visor, 4 helmet
    lights, 5 torso lights, 6 arm lights, 7 leg lights, 8 boots; 511 the whole figure), `power` (0 to 1: every light and
    glow, the rim at `mix(0.25, 1, power)` and the plates at `mix(0.45, 1, power)`), `flash` (`[part, a]`: that part's
    lights towards white by 0.6 a; part 0 never), `ease` (the hands' easing, s: 0.2, 0 none) and `warm` (solve only: no
    row, not counted). They go into the row's last texel (`[hide, dark, power, flash]`); the part rides in `aMat` and
    `aKind` (+ 4 x part), so neither shader gains an attribute. Helpers: `size(B, eye)` (a fixed size, never sampled),
    `grip(side, wrist, aim, out, k)` (the grip pose that puts a wrist there with the forearm along `aim`),
    `point(B, name, I, out)` (a rest point in the world after the last `add`: `emblem0` to `3`, `spine0` to `4`,
    `visor`, `chest`, `lfist`, `rfist`, `lboot`, `rboot`); `info(B).started` (the foot that began a step this frame, -1).
  - For tests: `HOST.collab.bodyState()` (`{ on, my, ready, can, drawing, err, loading, stats, self, selfFloor }`),
    `HOST.bodies.info(o.body)` (its feet, which are planted, its steps, gliding, its eye height and size, its hips, its
    neck's scale, its hands' hold) and `stats()` (instances, renders of each mesh). The smoke test's `bodies` block.
  - Untested on a headset: how the bodies, their lights, the scan and the glows read at 2 to 6 m on a Quest; the frame
    cost with ten or more people (the solver on a Quest's CPU, the 54 KB texture a frame, 2,470 triangles a person);
    real controllers' grip poses and tracked hands' wrists sent as `g` (a wrist's axes are not a grip's: hands may sit
    turned); a real person's walking, crouching and sitting; the comfort of My body; whether the first body hitches.
- At its station in a shared room a headset moves the scene and the panel for
  everyone: the grip on the scene moves it (`XR.globeOff`), both grips on it
  resize it (`xrResize`: the distance between the hands, a quarter to four times
  the story's own size, `XR.size`, in story and explore mode alike) and move it
  with their middle, the grip on the panel moves the panel; with free moving on
  (the room's setting) the grip turns the scene and tilts the panel too, and the
  turn is the station's, for everyone there whatever their own setting
  (`q` in the place and the panel; ignored while free moving is off). `placeSync` (every
  frame, from the shell's tick) sends what is held out at most every 66 ms while it moves (`xrPose().held`; `ts` and
  `h: 1`), once more as it comes to rest (so the others see it stop, rather than carry it on) and once more without
  `h` when let go (also when the story's lock stops it: it lands where it was last sent); someone else's move it puts
  exactly where their samples say it was `SMOOTH.DELAY` ago, every frame ("Others' moves, smooth"); otherwise it
  glides each to the room's value (`collab.panel`, `collab.place`; a turn by slerp, sent when it
  changed by more than 0.004 rad, the panel's `yaw` worked out from its
  quaternion), and puts both there at once when
  a station is reached. Both values carry the story they were written for, so
  a late one from before the station changed story is refused by the relay. `HOST.anchor.locked(kind)` is
  `HOST.room.gripLocked()` in a room: true away from any station and while
  the station's story is locked (*Lock this story*; then nothing moves, and the
  panels say so: `HOST.room.gripHint`, which `sigMain` includes, so the panel
  redraws); the circles lock does not lock it. The
  flock and the robots are life size (`life: true` in `HOST.list`): only their
  panel moves. Outside a room both grips resize the scene too, for this device
  only (kept with an anchored place, reset by Recenter). Recenter at its station (the story panel's button and the
  menu's; the owner: panel and 3D model back to their starting position; `HOST.room.recenter`, `recenterStation` in `shared.js`) takes the station's place and panel keys
  out of the room (absent, they are where the story puts them), so its scene (offset, size, turn) and its panel glide
  back there for everyone at its circle; in explore mode the view goes back to where the story itself put it there
  (`VW.home`: the first view after none, that is explore mode begun or a flight of its own landed, never one glided to
  from the room or turned by hand) and goes out as a view after a flight does. Refused while its story is locked, as the
  grip is (a notice; the menu's Recenter greyed). The life-size stories' own places (the pass story's `sea`) stay.
- In a shared room a headset never shows the Stories screen (neither its
  header nor the story cards) and the story panel has no Stories button (each
  station keeps its story; another story is another station), except at an All stories circle (above: its cards are
  the Stories screen, and its story panel's Stories button goes back to them for everyone there): one open closes
  at once when a room is started or joined (from the page, the headset's menu
  or a `#s=` link; `xrBegin`), entering VR or AR from the start screen in a
  room does not open it (`xrEnterScene`), nor does a new wearer
  (`xrFreshStart`) or a story's end. Leaving the room in the headset brings it
  back, as for a new wearer (`xrBegin` sees `XR.inRoom` turn false and calls
  `xrFreshStart`), and a session ended away from a station opens the page's
  Stories screen (`xrEnded`). Sound check is in the headset's menu.
- In VR the headset's menu opens by itself and asks once per room "Are you in the same room as the
  others?" (In this room / Somewhere else, kept per room code in
  `localStorage` `collabHere`); passthrough counts as in the room.
- `HOST.room` (headsets) asks for its own `local-floor` and `shared` spaces and
  runs its own frame callback. The room frame (an origin and a level x axis,
  kept in `local-floor` coordinates) comes from, first found first: (1) this
  headset's own calibration, which nothing overrides: two tape marks touched
  with a controller (`'marks'`), or last time's found again by the two anchors
  made at them (`'anchor'`; since v130 a calibration is this room's place, kept per room code in `localStorage`
  `roomFrames`, the marks and the anchors' handles, never coordinates alone: "Places" below); (1b) the PC's trackers, for
  the Index on the relay's PC only (`'trackers'`, v126: "Vive trackers"); (2) unless switched off
  (*Shared space: off* on the panel, for this page only: remembered, it
  left one headset unaligned in every room of an evening; on by default since
  two Quest 3s on one browser version lined up through it; the panel says
  when it is off) the
  frame published for its shared space (key `rf.<space id>`, `{ uuid, o, x, g,
  by, at, m }`, `g` `'marks'` or `'shared'`, `m` the marks for drawing) by a
  calibrated headset or the first one in the space (`'adopted'`, first on this
  headset's own floor, then held at that height in the shared space (`R.hS`),
  so a floor the headset estimates again does not move the room; followed
  when it moves more than 3 cm, 1 degree or 2 cm in height), or
  (3) the space's own origin when
  nobody published for it (`'shared'`); (4) else calibrate. A calibrated
  headset publishes its marks for its space anyway and reports how far the
  shared space puts another calibrated headset's marks from its own (`R.cmp`,
  a line on the panel). More than 10 cm or 3 degrees for 5 s, and it tells the
  room the space is split (`rs.<space id>` `{ uuid, bad, d, a, by, with, at }`,
  `splitCheck`; within 5 cm and 2 degrees it says whole again): while both
  headsets that measured it are in the room (`splitHere`), nobody takes a frame
  through that space or publishes its own origin there; a headset without
  marks keeps a frame it holds, or asks to calibrate ("Shared space not
  usable"). Only the pair that measured it writes it again (every minute while
  it still finds it so) or says whole again; older than 3 minutes, it lapses. Why: two Quest 3s on Quest Browser 152 with Physical space features
  off were in two spaces 2.6 m and 11 degrees apart under one id, neither its
  own floor, so nothing but the tape could tell. A headset whose session has
  plane or mesh detection and has found no plane or mesh 20 s in says it has
  no room scan (`scanCheck`, `R.noScan`: run Space Setup, Physical space
  features on), since the shared space and anchors rest on that scan. People
  elsewhere (VR) use their own floor.
- The room's floor is under the marks, not under each headset. Floor spots (v122; the owner: the floor set by the two calibration points, because headsets' floors were often off): the two spots are tape crosses on the floor, touched with the
  controller's tip on the floor, pointing down, so a calibration's floor is the floor under its spots: in local-floor
  coordinates mark A's touch height less `FLOOR_TIP` (0.02 m, the controller's target-ray origin over the floor with its
  tip on it, held pointing down: a guess until measured on a Quest), whatever this headset's own (Guardian) floor says
  (`floorUnder`, `fromMarks`, `marksMk` = `[FLOOR_TIP, d, FLOOR_TIP + B's height - A's]`, the same wherever the floor
  under the marks is worked out: a calibration, its anchors followed or found again, `refloor`, a reset, waking,
  Re-align), so every headset that calibrates on the spots gets the same floor. Its saved marks say so (`f: 1` in
  its place, `R.saved`, `onFloor()`), and so does the room's key `rm`: `{ a: FLOOR_TIP, d, f: 1, by, at }` (`a`
  mark A's height over the room's floor, `d` the marks' distance: marks within 10 cm of it, `SAME`, are the same
  marks). Older devices read `a` and `d` as before (their floor is their mark A less `a`: the same floor), so no
  `FORMAT` change. A floor-spot calibration writes `rm` when the room has none, its `rm` lacks `f`, its distance
  differs by more than `SAME` or its writer has left (`claimFloor`, at a calibration, when its marks are found again,
  and twice a second while `rm` is missing, its writer gone or without `f`); two headsets on the same spots never write
  it in turn, and its own frame never waits for it (two sets of floor spots in one room: `rm`'s `d` is the last
  calibrator's, or the last to find theirs again, so the other headset's note says its marks are that much further
  apart than the room's; the floor is the same either way). When the second spot is touched (`mark()`) spots more
  than 4 cm apart in height are refused (`SPOTS_DH`: *Spots at different heights*, back to spot A; the tip's height
  moves with how the controller is tilted; a guess until tuned from the headsets' logs). How high spot A stands over
  this headset's own floor is never limited (the owner's rule: a floor that is off, by however much, is what floor spots are for), so spots on a table are taken too, and the room's floor
  is then the table's. The log says `floor spots` with A's and B's touch
  heights over this headset's floor and their difference (`dh`) and, when the session has plane detection and a plane
  labelled floor (`scanFloorAt`, the lowest, every 2 s), over the room scan's floor too, and `mark refused` with why
  (and `dh`, or A's height `h`): later logs measure `FLOOR_TIP`, the two limits and the headsets' floors. A
  calibration from before v122 (no `f`: its spots may be table corners) keeps the old rule: `rm` is mark A's height
  over the floor of the first headset that calibrated (taken over by a newer calibration of the
  same headset, other marks, or a calibrated headset when its writer has left; never over the room's floor spots while
  their writer is here), and a headset whose floor differs puts the room's origin that far above its own floor; other
  marks (another distance): its own floor. Either way the origin's height comes from the anchors' heights, so a floor
  that jumps does not move the room, and the panel says how this headset's floor differs ("Your floor is 28 cm lower
  than the room's", `floorNote`). Headsets lined up through the shared space keep their own floor (`reconcile`,
  `R.hS`, unchanged): Check at A says the difference as the height part. Untested on a headset: `FLOOR_TIP` (how high
  the target-ray origin really is with the tip on the floor, and how people hold the controller), the two refusals'
  limits, floors that differ between real headsets.
- Why (the relay's logs of two Quest 3s in one room): the shared space came
  with the same id on both at once but was at first just one headset's own
  floor, jumped by 40 cm and 74 degrees when colocation found something, then
  stayed 0.9 m and 19 degrees out against the tape, and sometimes reported the
  head's pose; one headset's floor was 28 cm too low (its head at 2 m), and its
  origin later jumped 5.5 m and 0.7 m down; `local-floor` moves with a recentre
  without a reset event. Two anchors (positions only) keep the frame on the
  marks; without anchors a reset without a transform or a jump of the head
  asks to calibrate again.
- The shared space (Quest Browser's experiment, explainer
  github.com/cabanier/shared-spaces): a default space for a few seconds, then
  a reset and the real one; the first headset's origin is the space's; one
  space per page address; lost when a headset leaves VR or AR. Our reading of
  its pose (`floorFromShared`) is right: it keeps a headset's own marks in one
  place across its resets to 2 cm (the inverse is 80 cm out). In the logs the
  two Quest 3s had the same id but different spaces: the one with the older
  browser (149) had its own floor every session, the other (150) one frame
  that held to 2 cm over 71 minutes and three sessions; so the 0.9 m and 19
  degrees (later 1.2 m and 28, 2.4 m and 84) were two spaces, not an
  inaccurate one. Right after waking Quest gave the head's pose as the space's
  for up to 15 s: such a pose is not used (`sharedHead`), and nothing is
  published or compared through the space within 20 s of waking (`settled`). The panel names a space that is exactly this
  headset's own floor (`sharedOwn`: the default one, the first headset, or not
  joined) and shows the browser's version; the log has the page address.
  Every headset sends its Quest Browser version with its presence (`bv`):
  the people lists show it, and the panel warns when another headset here
  runs another version (`versionNote`; two versions never shared a space).
  The page drops `index.html` from its address on load, so every headset has
  the same address for the same page (one shared space per page address).
  Such a space is the first headset's (its origin is the space's) or, when
  someone here had already published for its id, or another headset here was
  aligned through a space of that id (`alignedHere`: presence carries `sp`, the
  space id, and `al`, `'adopted'` or `'shared'`), as the id appeared
  (`R.firstHere` false), not joined: then nothing is taken or published
  through it (`notInIt`), not even this headset's own frame from before, a
  frame held so far stays, and after 2 s the panel says so ("Not in the
  others' shared space"). Why: a Quest 3 that left AR and entered it again got
  its space back under the same id but as its own floor, while the other's
  stayed where it was; it took its own earlier frame through the new space and
  stood the room elsewhere (both Quest Browser 152). Both judgements are made
  once a session per space id (`R.firstFor`, `R.ownFor`): Re-align, the space
  asked for again after waking, or an id flicking to a default space and back
  never re-judge the first headset (its space is its own floor too, and the
  others are aligned through it by then). Presence says `al` only while a
  headset has joined. Once judged its own floor (within 2 cm and 1.5 degrees),
  a space stays so while within 15 cm and 2 degrees (such spaces drifted up to
  8 cm; a judgement flapping at 2 cm let the room through). Known limits: a
  headset judged not joined stays so for the session even when the others
  leave, and two headsets that both came back in spaces of their own are both
  not joined; restarting both browsers (one after the other) or calibrating
  both on tape is the way out, and the panel says so. A frame for the id from someone
  who has left may be last time's (the id stayed the same across sessions and
  days): every headset waits 8 s before taking it, and the first headset then
  replaces it with its own space. A frame someone here published for another
  space id means the others are elsewhere (`othersElsewhere`): this headset's
  own space then never becomes the room (not joined, calibrate).
- Standby with the shared space in use (an adopted frame, or the space's own
  origin): one headset was offset after waking in a test, and one of two after
  a night's standby. The frame the floor's resets carried over holds
  (`R.wakeHold`, only after a wake the session reported) until the
  shared space agrees with it again (10 cm and 3 degrees along the floor, not
  in the first 3 s while the resets come in; `wakeOK`): right after waking the
  space gave the head's pose, and after a night it may come back made again
  under the same id (around the headset that woke first). A space that still
  disagrees once settled (20 s) and still for 5 s: this headset's own
  publication is written into it again as
  held (not into a space that is just its own floor: nobody else is known to
  be in it); someone else's is followed only when written since this headset
  fell asleep (`p` in the frame, FORMAT networks-7; its writer writes it again
  once settled after waking, `R.refresh`) or when the floor moved with no
  transform (`R.blind`), never through a space that is just this headset's own
  floor; a headset still held once settled asks the writer once to write it
  again (`q.frame`, answered only when the writer can write it now). A headset
  still outside the others' space 15 s after waking asks for it once more. The height comes back from the space (`R.hS`; a jump of more
  than 30 cm keeps the room's height), since the floor came back 12 to 17 cm
  off after waking. A session that begins before the room's members are known
  (a socket not yet back after a night) waits up to 8 s before taking someone's
  frame. (Two rules from this round were taken out again after two Quest 3s
  could not align: a reset of the floor with no wake before it started a hold
  too, and another headset in the room since earlier counted as someone here,
  so a headset first in the shared space but later in the room never became
  the room.) Why: no logs
  of the night; two independent readings of the code found that the headset
  that woke second would follow last night's frame through a space made again
  around the other, which matches what was seen.
- Off and on again (the session hidden, then visible: sleep, the system menu)
  the origin moves under the frame (manual calibration lined two Quest 3s up,
  but switching one off and on left it "totally off"). Quest Browser says how
  with `reset` events of `local-floor` (two on waking) whose `transform`
  carries points from the old coordinates into the new ones (not the other
  way, as the spec reads: applied inverted it turned the room -126 instead of
  +126 degrees; applied this way it matched a fresh calibration on the same
  tape within 1 to 1.5 cm), and whose height is the head's change, not the
  floor's: `floorReset` uses only its turn about the vertical and its move
  along the floor. Anchors made in the session were not tracked again after a
  sleep: a woken calibrated headset keeps its frame (moved by the reset), waits
  up to 5 s for its anchors (`afterWake`), then looks for them again by their
  saved handles (they put the frame back on the marks) and shows the orange
  crosses for 30 s ("Check the spots"; in AR in a room with spots, since v119, the
  check by eye's question instead, which every wake asks: "The room setup guide").
  Not found (after 5 and 15 minutes
  asleep two Quest 3s did not find them, and did once AR was entered again), it
  looks again every 10 s for two minutes, then every minute up to ten
  (`restore`, `retryDue`; "Spots found again"); a retry does not hold the room
  in 'restoring', and a calibration from last time not found at session start
  is looked for the same way. Waking never drops a calibration
  (asking to calibrate after every wake was worse). Not found after waking
  (`lostMarks`, `R.reenter`, log `marks lost`; in a test after a standby twenty tries over ten minutes failed and a new
  AR session found them at once), and likewise after a reset without a
  transform or a jump of the origin while the anchors are not held but their
  handles are saved: the calibration is kept, its anchors are looked for again
  (at once, then on the retries' schedule; only a calibration with no saved handles asks to calibrate again), the
  headset still counts as lined up (`lineUp`), the Debug tab's line says *Your own marks (looking for their anchors
  again)*, and in AR in a room with spots the check by eye asks (`eyeWant('lost')`). No message asks to leave AR and enter again (the owner: alignment is nearly always good and has a check now). Re-align that finds no spots says *Spots not found*:
  the headset keeps looking, and to calibrate again if the orange crosses are off the two spots.
- The browser's store of saved anchors can be full ("Maximum number of
  anchors reached!": one Quest 3 refused every handle with 9 listed for the
  site, another saved with 11, so the limit is not simply per site). At
  session start `HOST.anchor` deletes saved anchors nobody here knows
  (`session.persistentAnchors` minus the placement's and `HOST.room.handles()`)
  and the room logs what that did (`anchors tidied`); a handle refused as full
  is asked once more after deleting again (`handlesAgain`,
  `HOST.anchor.handle(a)`); if it is still refused the marks hold for this
  session only and the panel says a restart will ask to calibrate. Meta's
  docs: 8 persistent anchors per site, deleted with the site's browsing
  history; the browser's author: a limited set across all sites. Clearing the
  browser's data is the remedy (not confirmed on our headsets).
- Calibrating: the two spots are tape crosses on the floor (v122), touched with
  the controller pointing down, its tip on the floor; a mark is where the
  controller's ray origin was held still 70 to
  260 ms before the trigger (a bright ring shows that point), at least 50 cm
  apart; a second pull within 0.6 s is ignored; spots more than 4 cm apart in
  height go back to spot A (how high spot A is over this headset's floor is
  never limited) (above: "The room's floor is under the marks"). Orange
  crosses show the marks where this headset puts them (while the headset's menu
  is open, and 30 s after aligning). The panel's room section also shows the
  shared space's id and *Forget calibration* (`HOST.room.forget()`, press
  twice: this room's place only, v130). Anchor requests carry the marks' generation (`R.mgen`), so ones that
  settle after Forget or new marks are thrown away; a handle the browser
  refuses is logged with its reason. Every 10 s a headset in a room sends its
  log (alignment samples every 5 s) to the relay (`POST /api/log`, kept in
  `relay/logs/` with `--lan` or `--logs`). While aligned and at its station,
  `HOST.anchor.frame()` returns the station's rig pose (spot at 1.6 m over the
  room's floor, facing its way, `room: true`), `held()` is true and
  `locked(kind)` is true (in a room it is anyway); `HOST.audio.zone()` pans the
  narration from the station (full volume within 1.5 m, so at the station's
  spot; nothing changes outside a room).
- Areas: more tape crosses in one room (v131, "areas" in `shared.js`, after `claimFloor`; the owner's wish: one room with several spots where things line up again, rather than a room per physical room; tape crosses in every area, measured once and shared by every headset). One shared room, one room frame, several pairs of crosses on
  its floor. Arrange all still lays its rows out in front of you, so in rooms side by side its rows may reach through a
  wall: place circles by hand there.
  - Spots A and B stay as ever (the room's key `rm`, the room's origin and floor). Each extra area is a key of its own,
    `rp.<id>` = `{ name, n, a, b, d, base: { d, at }, by, at }` (`AREA`, `areaIn`, `areaList`): `n` its number for its
    letters (`areaLetters`: 2 is C and D, 3 E and F...; the lowest free), `a` and `b` its two crosses in room coordinates
    as a lined-up headset took them: where the controller's target-ray origin was held still with its tip on each cross,
    so their `y` is the touch height over the room's floor (the area's floor as the room has it, plus `FLOOR_TIP`); `d`
    their distance along the floor; `base` spots A and B's `d` and taping time when it was measured (`rmBase`: `rm.t`,
    kept by `claimFloor` while the same spots are written again, else `rm.at`), so spots A and B taped again make the area
    stale (`areaStale`: the guide and the Debug tab say *measure again*, the map draws it dim). Forgotten by a tombstone
    `{ gone: true, by, at }` (the relay deletes only `st.*` and `pose.*`). At most 8 areas, spots A and B among them. Ids
    are 8 letters and digits (`AREA_ID`).
  - Adding one (`areaAdd`, `areaAsk`, `areaTake`, `areaWrite`; the room setup guide's fifth page, *Areas*, *Add spots for
    another area*): a headset lined up by its own spots (`own()`: its marks or their anchors; or the PC's trackers, `areaFrom`: one lined up
    through the shared space keeps its own floor, which would go into the new crosses' heights; the page says to calibrate
    first) names it (the shell's keypad,
    *Area 2*, *Area 3*...), then touches its two crosses with the controller's tip on the floor (`steady`, taken into room
    coordinates as a check is; the tip mode's target kind `area`); refused as a calibration's spots are (less than 50 cm
    apart, more than `SPOTS_DH` in height); a pair within 30 cm of spots A and B is refused (*These are spots A and B*), of
    an area's offers *Replace* (its tombstone and the new key in one batch; this headset's place at the old crosses goes
    at once with its anchors unless it lines up from it now, then at its next session). That headset makes its own place there from
    the same touches at once (`areaAnchors`: its two anchors made in the next frame, measured for its `yb`, let go; the
    survey finds them by their handles). The log's `area added` says the area's floor over the room's (`floor`: how far the
    room's frame drifted over the walk there, or a real step).
  - Calibrating on area k (`calibrate(k)`, `R.calib.k`; the guide's Line up has *Calibrate on: Lab (C and D)* while the
    room has areas, cycling through them, the area found where you stand first, `guidePk`; the Areas page has *Calibrate
    here* per area): the touches are fitted to the area's room points (`fitFrame`: turned about the vertical so the area's
    A to B lies along the touches, its origin where that puts the room's when the area's first cross is at the first
    touch, the room's floor as far under it as the area's first cross is over the room's floor: both touch heights, so
    `FLOOR_TIP` cancels and this headset's own floor at the area does not count); a touched distance more than `SAME` (10
    cm) from the area's is refused in words (*These crosses are 1.5 m apart; Lab's C and D are 2.0 m*). `claimFloor` only
    for spots A and B. What a calibration puts in the room is `{ k, A, B }` (`mkA`, `mkOf`: the area's id, '' spots A and
    B, and its crosses in room coordinates), `R.mk`; `roomMk` gives the area this headset lines up from, else the room's
    area nearest its head; `spotsOf(k)` a given area's; the legacy `[height of A, A to B, height of B]` is kept for spots A
    and B wherever it is read (`HOST.room.marks`, `guide().spots`, a published frame's `m`); an area's goes as `{ k, a, b }`
    (`mkOut`, `mkIn`).
  - Checking an area: the guide's Check page checks the area this headset lines up from (*Check at C*, *Check at D*; the
    buttons keep their ids `guide:selfA` and `guide:selfB`), its Areas page every area's (`guide:acheck:<id>:a`, `b`), so a
    second headset lined up elsewhere confirms an area measured. A check's area rides on presence (`lu.pk`, beside `ck`
    `'a'` or `'b'` for older readers): the pages' list says *at spot C* and *Lab's spots*.
  - What is drawn: the crosses of the area this headset lines up from (or the nearest, lined up by another source) at
    their room points, a sign over them with the area's name and letters while the room has areas (`OV.markName`); the
    check by eye's beams and arrows say the area's letters (`MKL`, *C 1.3 m*); the pages' room map draws every area's
    crosses with their letters and names. A headset also draws every other area's crosses, spots A and B among them, each pair with its line and its sign
    (`areaMarks`, `OV.areaMarks`, `OV.areaPairs`, made as needed), whenever the crosses would show (the menu open, or for
    30 s after lining up or after adding an area, which now sets `R.showUntil`), in a lined-up headset, never while the
    check by eye asks (its question is about the crosses above) or while a tip is armed.
  - Two headsets lined up by different areas' crosses are never compared through the shared space (`compare`: their
    frames differ by the room's drift between the areas, not by the space): logged (`compare across areas`), no split.
  - The PC's trackers line up on any area (the dialog's area picker: `trk.m.k`, and that area's floor points `ra`, `rb`,
    which `relay/trackers.mjs`'s `frameOf` fits as `fitFrame` does), and camera mode too (its overlay's *Spots: C and D*
    button while it lines up, `CAM.pk`).
  - The Debug tab lists the room's areas (letters, name, who measured it, *stale: measure again*) with *Forget area* (two
    presses: its tombstone; every headset's places there go at its next session). `HOST.collab.areas()`, `areaAdd(name)`,
    `areaPick(id)`, `areaWrite()`, `areaForget(id)` and `areaStop()` are for tests.
  - Untested on a headset: the room's drift over the walk between areas (the log's `area added` floor, a later check at
    the area's crosses), whether a Quest finds an area's anchors as it walks in mid-session or only at a session's start,
    a multi-room Space Setup, whether an anchor's own turn is kept exactly across sessions (a place gone down to one
    anchor rests on it), adding an area and calibrating on one with real controllers.
- Places: a calibration kept per room (v130, `PLC` and "places, kept" and "where this headset is" in `shared.js`). One shared room per physical room, each calibrated on its own spots.
  - A place is per area too ("Areas" above): `roomFrames` = `{ v: 4, places: [{ code, pair, rid, a, b, at,
    used, anchors, n, f, yb, ra, rb, base, an }] }` (`pair` the area's id, '' spots A and B; `ra` and `rb` a copy of the
    area's room points and `base` of its base, so a place survives the area changed meanwhile; `an` its name; `yb` B's
    turn from A in anchor A's own frame: anchor A is made turned towards B, and `yb` is measured from the anchors' live
    poses the first time both are tracked and fit, `ybLearn`, also for an older place, which had none, and for a place not in
    use by the survey finding both its anchors, their distance its marks' within 5 cm, `surveyMeasure`, log `place yb`
    with `by: 'survey'`; an older place made with
    one anchor has 0). A v3 place reads as spots A and B's. `placeOf(code, pair)`; `placeTake` takes this room's most
    recently used place (any area's). A place whose area has its tombstone, or whose `base` no longer matches `rm`, is
    stale: dropped at the next session in that room (`placesStale`, once the room's keys are in; the Debug tab says
    *Dropped: room ABC's Lab*). Places are kept most recently used first (`a` and `b` the marks in local-floor
    coordinates as touched, `code` the room's code, `at` when, `used` when it last lined this headset up, `anchors` the handles, `n` one or two,
    `f` floor spots, `rid` the room's own id, so a place never joins another room given its code). A v3 place (`{ v: 3, one, places: [{ code, rid, a, b, at, used, anchors, n, f }] }`) reads as spots A and B's. `R.saved` is the
    place of the room joined now (`placeTake`, from `HOST.room.joined`; `placeLeave` as the room is left), so lining
    up, waking, Re-align, the floor spots, `claimFloor`, publishing for the shared space and the guide's cases work as
    before inside a room. A calibration in a room makes or replaces that room's place (its old anchors deleted); the
    others stay. A calibration whose anchors are not made (yet), or were refused, holds for the session and is not
    stored. Forget calibration forgets this room's place only. An older `roomFrame` (v2: one calibration, no room) is
    kept as a place with no code, taken by the first room this headset lines up in with it (its anchors found there:
    `placeUsed`, log `place taken`); the key `roomFrame` goes. `HOST.room.handles()` gives every place's anchors, so
    `HOST.anchor`'s tidy-up keeps them. A camera keeps no places. Nothing new in the room's keys (`rm` stays per room):
    no `FORMAT` change.
  - The anchor budget (v131, `placesFit`; the owner's rule: two anchors a place until four, then the oldest go down to one, one by one): at
    most 8 saved anchors in all places together (every room's and area's), less one while `HOST.anchor` keeps a placement
    of its own (Anchor: on). A new place gets two (positions only, at spot A and spot B: the most accurate); while the total would pass the cap, the places made first (by `at`,
    never the new one) go down to anchor A alone, one at a time (B's anchor deleted; its direction from then on from
    anchor A's turn plus `yb`, `spotB`), so with four places of two a fifth takes the first two down to one (1 + 1 + 2 + 2
    + 2 = 8); one whose `yb` is not known yet is dropped instead; past that (every older place on one already) the place
    used least recently is dropped with its anchors. A notice names what changed (*Older places on one anchor*, *Older
    places dropped*; log `places fitted` with `down` and `dropped`). The Debug tab says the budget in a line. A place on
    one anchor has it at spot A, made turned about the vertical so its x axis lies level towards spot B (`yawTo`): found again, the room's origin is the floor
    under its position (the floor spots' rule) and x its turn's x axis made level, spot B that far along it at the marks'
    height difference (`spotB`, in `anchorsAt`, so everything downstream sees two marks). A place keeps how it was made. One anchor's turn is steadied (a wobble of its turn would
    turn the whole room about spot A, 2 degrees being 35 cm at 10 m): `oneYaw` takes the mean of its readings over the
    last 3 s (`ONE`), a reading more than 2 degrees from that mean starting it afresh (a real turn: local-floor moved
    without a reset event), the window starting afresh with new anchors and after a reset; `followAnchors` turns the room
    for one anchor only past 0.57 degrees (two anchors: 0.29). The alignment samples log the window's size and spread
    (`one`: how much a Quest's anchor turn wobbles, for tuning). A new anchor whose turn the browser did not keep as asked
    fails its check (spot B more than 5 cm off: `anchorsFit`) and the calibration holds for that session only. The cap (`placeCap`): Meta documents 8 persistent anchors per site; one Quest 3 refused a 9th.
  - Where this headset is (`placesStep`, from the shell's tick, in a headset session in a room or in none, AR or VR: an
    anchor found means the headset is there). Every place's spot A is looked for by its first anchor (never the room
    joined now's: `restore` does that), at the session's start, after a wake, while this headset is not lined up by its
    own place's anchors (every 10 s for two minutes, then every minute up to ten, then every 2 minutes) and every 2
    minutes otherwise; each find waits 10 s at most (`SV.wait`: a promise that never settles must not pile up), the
    anchors found are measured over a few frames (tracked, with a pose, 3 s at most) and deleted. Of the places found,
    the one whose spot A is nearest the head along the floor, within 10 m (`SV.near`), is where this headset is
    (`PLC.here`; the survey also looks for this room's other areas' places too, `PLC.hereArea` the area found: one
    found nearer by 2 m while this room's own is further than 4 m or not tracked is taken in its place, `areaSwitch`, no
    join, never while calibrating or adding an area: lined up from it, `src` `'anchor'`, the log's `area switch` with how
    far the room moved in cm and degrees, and the check by eye asks, why `area`; the cross-room offer shows only while
    this room has no area found where the headset stands). Another room than the one joined now: in no room, or in one joined by itself (a rejoin, or a place
    before: `C.auto`, `C.byPlace`), it joins that room by itself (`join(code, 'place', rid)`, checked by the room's own
    id as a rejoin is; the room left is not marked left on purpose), answers *In this room* for it (unless *Somewhere else* was answered for that room: kept, the Debug tab changes it), says so (*Room ABC:
    You are in its place, so this headset joined it*), lines up from its marks at once and the check by eye asks (why
    `place`), unless the room joined now holds (below); in a room joined by hand, or into a room left on purpose (or
    whose code is another room's now), never by itself: the Debug tab offers *Join ABC: you are standing in its place*
    (a join by hand, which since v131 counts as joined by its place: `C.byPlace`, so a later move is by itself) and a notice says so once a session. Never while calibrating. The room joined now holds (`ownState`,
    `placeDecide`; the review of v130: never leave a room the headset may well be standing in because another room's
    anchor answered first), and the other room is then offered only:
    - while its own place's first answer since the join, the session's start or a wake is not in (20 s at most,
      `SV.grace`; `restore` finds it, `R.tries` counts its misses): the decision waits (`place wait`) and the places are
      looked for again once it is in;
    - while its own place's spot A is known (its anchors held and tracked within the last 3 s, checked or not yet) within
      10 m, or the other room's spot A is not nearer by 2 m (`SV.margin`): two rooms side by side never flip;
    - while its own place lined this headset up as it went off and is not found since the wake (`SV.wokeIn`,
      `placesWoke`, from the session's visibility: a Quest loses anchors after standby, which is no move; a headset
      carried to another room while asleep is offered that room);
    - while its own place is not found and the other room's spot A is further than 4 m (`SV.sure`: its not being found
      is no proof the headset is elsewhere);
    - while its marks were touched there this session, unless its spot A is further than 10 m.
    A room with no place of its own here holds nothing. Logs: `places looked for`, `places found`, `place wait`, `place
    held` (with why: `lost`, `gone`, `here`), `place here`, `place join`.
  - The Debug tab's *Places* rows: the offer; *Places on this headset: n*, each place's room (*in use* for this room's,
    *you are in it* for the one found where you stand), one or two anchors (or *this session only*) and when it was
    calibrated, with *Forget* (two presses; this room's is Forget calibration; an area's place by `placeforget:ABC|<id>`);
    the budget's line, the places dropped as stale, and the room's areas with
    *Forget area*. `HOST.room.places(o)` (`{ list, cap, anchors, here, hereArea, offer, current, pair, surveys, res, own,
    waiting, wokeIn, dropped }`; `o.reset`, `reload`, `out`, `forget`, `look`, `wait`, `near`, `join`) is for tests.
  - Untested on a headset: whether a Quest finds a room's anchors when it walks in during a session or only at a
    session's start; a multi-room Space Setup (one scan over several rooms, or one per room); whether a persistent
    anchor keeps its turn exactly from one session to the next (one anchor per room rests on it: a turn restored a
    degree or two off turns the room about spot A, which steadying cannot see; the check by eye asks at each session's
    start and after a wake, and two anchors per room stay the default); how much a Quest's anchor turn wobbles (the
    samples' `one` will say); how far apart two rooms' places must be for the nearest to win, and whether 4 m and the 2 m
    margin suit real rooms; the cost of looking for 8 anchors every 10 s on a Quest.
- The explore view at a station (`st.<id>.view`, `{ v, story }`): headsets at the station share
  it (`viewSync`, every frame from the shell's tick: one turned here goes out while it changes frame by frame, at most
  every 66 ms with `ts` and `h: 1`, and once more without `h` when it rests; one that came at once here, after a flight
  (`collab.view()` is null while the camera flies), goes out plain; someone else's turn is put exactly where their
  samples say it was `SMOOTH.DELAY` ago, every frame, through `collab.setView(v, true)`, and nothing goes out
  meanwhile, so nothing applied from the room is written back; once it has landed where they let go and shows so here,
  turns made here go out again; a view from the room without `ts` glides in, the story's 0.25 s glide), so the scene
  stands turned and sized alike for everyone there; screens following the station keep their own camera.
- Others' moves, smooth (the owner: others' moves, such as a colleague spinning a network you stand in, must be smooth). Snapshot interpolation, as games do it (`SMOOTH`, `BUF`, `RT`,
  `bufPush`, `bufAt`, `MIX`, `smoothIn` in `shared.js`). Before, each new value (ten a second, the view five) started
  a glide from where the thing stood, so a steady spin sped up and slowed down at every arrival, and inside a large
  network a small step of a spin is a big jump at its far side. Now every write of a move by hand (a station's
  scene, panel and explore view, a station carried by the grip) and every presence carries `ts`, the relay's time
  (`now()`, whole ms) when it was written, and, while still held, `h: 1`; held writes go out at most every 66 ms (15
  a second, `SMOOTH.SEND`). Each device keeps the last 8 samples of every thing someone else moves (a gap of more
  than 1 s starts it again, as do a station reached, its story changed, a welcome, and a value without `ts`) and draws
  it where it was `SMOOTH.DELAY` (120 ms: two send intervals and a little, so the next sample is nearly always there
  already, even one 25 ms late) before the relay's time now, between the two samples around that moment: places in
  a straight line, sizes geometrically, turns by slerp (the shortest way), yaws by the shortest angle, a view
  component by component (its angles, in degrees in [-180, 180), unwrapped where they cross the seam). A new move
  starts from where the thing is shown (a sample there one send interval before its first). Past the last sample a
  held thing carries on as it went for at most 100 ms (`CARRY`: a late sample), then holds; a sample without `h` is
  where it was let go, and it lands exactly there (stamped no later than the last held one, as by a clock measured
  again meanwhile, it takes that one's place rather than being dropped as late), and once landed its samples are done
  with (the room's value from then on). A grip here (on the scene, the panel, or a station carried) drops the samples
  of someone else's move of the same thing, so letting go never pulls it back to where they left it. A view landed is
  what the story shows here, never a turn made here, even if it reads a little differently (`VW.here`). The render time (`RT`) runs on by each frame's own time and is
  eased towards the relay's clock less `DELAY` by at most 2 ms a frame, so a new measure of the relay's clock never
  jolts what moves. With nothing newer than 1 s (`LIVE`) plus `DELAY` the old behaviour returns: the glide to the
  room's value, a station just reached put at once, and a value from a write by hand (Arrange all, the map, a view
  after a flight) with no `ts` glides as before. Echo suppression and every "changed?" check compare a moving
  thing's value without `ts` and `h`; the rest and the letting go are forced writes (the same place again). A held
  move is neither logged nor redraws the page's dialog (it changes nothing the dialog says; the room map follows it
  from the pump). Known limit: moves carried inside a story's `collab.state()` (the pass story's school, `sea`, and
  the design room's miniatures) are not smoothed: they still come with the five-a-second state poll and the story's
  own glide. How smooth it feels can only be judged on headsets (untested there); the test is `node tools/collab.mjs
  --smooth`.
- The relay (`relay/server.mjs`) keeps per room a map key -> `{ v, seq, by }`
  (every stored write takes the next seq; the last writer wins), the members,
  and passes on ephemeral `fx` messages (presence, effects) without storing
  them. `null` deletes only `st.*` and `pose.*` keys; giving a station another
  story drops its `st.<id>.*` keys in the same seq. For now it runs on a machine
  on the same Wi-Fi as the headsets and serves the app itself
  (`node relay/server.mjs --lan`, see `relay/README.md`); GitHub Pages serves
  everything else, and a copy there can join a relay elsewhere with `&relay=`.
  The test place (`relay/README.md`, "The test place on Coolify"; the main site needs no hosted relay of its own and is a good place to test peer to peer): the main site is GitHub Pages from `main` at
  `https://stories.lbi-netmed.com/` (its `CNAME`); the owner's Coolify runs branch
  `dev` at `https://stories.lab.lbi-netmed.com/` (every name under
  `lab.lbi-netmed.com` points at the Coolify server with a wildcard certificate),
  served by its relay, with the studio's scenes in R2 and a webhook deploying every
  push to `dev`, and branch `main` as well,
  as the main site's relay at `https://main.lab.lbi-netmed.com/` (a clone of the test
  place's resource with its domain, branch and `R2_PREFIX` changed:
  `--proxy 1 --public --scenes r2` and a password), which the main site offers.
  Work goes to `dev` first, then `main` once the owner has tried it. A page can offer a relay of its own (`HOME_RELAY` in
  `shared.js`, keyed by the page's host, so never this machine, a LAN or the tests,
  where `HOST.collab.homeRelay(url)` offers one): while no relay is in use there
  (`homeOffer`), the Shared dialog has *The relay* (a password field, `homeTry`) and
  the headset menu's Circles tab a *Relay password* row opening the keypad page; the
  password accepted (there, or in *This relay needs its password* after a 401 of the
  studio's, which asks the offered relay for its scenes through `relayFind`), the
  device keeps it and uses that relay from then on (`setRelay`, kept as one typed
  in); without it rooms run peer to peer; *Forget the password*, out of a room, takes
  both off the device and the offer is back. The table has one entry,
  `'stories.lbi-netmed.com': 'https://main.lab.lbi-netmed.com'` (without the password the main site's rooms run peer to peer);
  `--public` allows `https://stories.lbi-netmed.com` (`APP_ORIGIN`), so the main
  relay needs no `--origin`; its test is `node tools/collab.mjs --home`.
  On a public server (the owner's Coolify) it runs with `--public` (`RELAY_ARGS="--proxy 1 --public"` in its environment; `relay/README.md`,
  "Public hosting on Coolify"): only the app's pages and its own may open a
  socket or use the API (`--origin`), no list of open rooms and no member's name
  in any answer or log line (`GET /api/rooms` is `[]`, `/api/ping` says
  `unlisted: true`), per address at most 30 lookups of unknown codes a minute
  (then any code is refused: 429, or on a socket `error` `limit`, close 4429;
  the app also takes the older 4029), 10 new rooms a minute and 64 sockets
  (`busy`, 4429), every room together 64 MB, and logs only with a token
  (`X-Log-Token`; the app sends none). Off unless asked: a laptop at an event
  runs as before. A room's version (the app's `FORMAT`, given as it is made or by its first hello) moves on to a newer
  `networks-<n>` from a newcomer once nobody of its own version is connected, or while a reload order names it, and
  never back (`takeOver`; "Updating a room" below); `--keep <file>` keeps every room in a file across restarts.
- Updating a room (v136; the owner: a switch that tells everyone to reload, as rooms got lost after updates; `relay/README.md`, "Rooms across updates"). Why
  rooms were lost: a room's version is the app's `FORMAT` and never
  changed once made (before v136); a deploy restarts the relay (1001), the pages still running the old app came back within a second and
  made the room again under the old version (`revive`), and every device that took the update was refused (4006) and
  stopped trying, for as long as the room lived (6 hours after it emptied); peer to peer the room's id names the version,
  so the first updated device hosted a second room. Owner's decisions: anyone in the room may press, never refused by
  either lock, never a camera; the relay moves a room on by itself; pages take a format update by themselves in a room
  (the countdown under "Hot reload and live updates"); `--keep` implemented, off by default; after a reload a headset's
  check by eye asks as for any new session; peer to peer does not look for a host on the previous format's id (a gap).
  No `FORMAT` change: nothing stored changes shape.
  - The relay (`relay/server.mjs`): a newcomer of a newer `networks-<m>` takes a room of `networks-<n>` once no other
    connected member has said hello with the room's version, or while a reload order named that version (2 minutes);
    then the members still on the old one get the relay's own order and are refused (4006), so their own live updates ask
    them: an app that obeys orders (its hello says `reload: 1`, this release on) 12 s after it was first told
    (`ORDER_GRACE`: the order, else the move), at least 3 s after the move, so never before its turn (up to 8 s); an older
    app, which ignores the order, 3 s after the move; an older newcomer is refused (4006, its words naming the room's version: `the room runs version
    networks-42`); other versions only the same; the log `XYZ version networks-41 -> networks-42`. `/api/ping` says
    `versions: 1` and `reload: true` (and `keep: true` with `--keep`); a taken code's 409 names its `version`. `POST
    /api/rooms/<code>/reload { n, to, shell, from }`: the order `{ t: 'fx', k: 'q.reload', v: { n, to, shell, by: '',
    from, at }, by: '' }` to every member whatever its version, `room.next` = `to` for 2 minutes; 200 `{ ok, members,
    version }`, 404, 400, 405, 429 within 10 s of the last order to the room; the password as every call; the log `XYZ
    reload to networks-42 (n members)`, no names. `--keep <file>`: every room's code, app, version, seq, keys and when it
    was last occupied written atomically (a temporary file renamed) every 5 s when something changed and as the relay
    stops (SIGTERM), read back as it starts (expired rooms and keys a write would refuse left out; a file that cannot be
    read kept aside as `.bad`), and for 2 minutes after the start the file looked at every second, another relay's write
    taken (a rolling update: a room missing here, or one nobody changed here since it was read, its members reconnecting).
  - Waiting or reloading (`shared.js`, `versionRefused`, `movedOn`): the welcome's `version` is kept (`C.roomVer`, also
    from the refusal's words and a revive's 409). Refused (4006) by an older room: status `older`, the note *Room XYZ
    still runs version networks-41 on a device that has not updated: joining as soon as it has.*, tried again every 3 s
    (`C.want` kept; the welcome then keeps `older` until the relay takes it in, its members saying so, so the note does
    not flicker), given up after 2 minutes on a relay whose ping lacks `versions` (each try would keep the old room from
    expiring: `capsGet`). By a newer room: status `newer`, `HOST.live.roomNewer` (above); log `room newer`; but while a
    reload order counts down here (`RL.pend`) it reloads in its turn as it was going to, neither at once nor asked in a
    headset (log `room newer: reloading in turn`, the note *... this device reloads in its turn.*), falling back to
    `roomNewer` if that reload has not come 40 s after its turn (`room newer: no reload in turn`). Another
    version that is not `networks-<n>`: refused, *the devices need the same release*. The connection line says *waiting
    for a device on an older version* or *this device needs the update*. Rooms on this network list rooms of other
    versions too, marked *older: it updates as you join* or *newer: this device needs the update* (peer to peer the
    slots name the format, so only the same). Kept copies (`collabRoom.<code>`) say their format, `f`, and `locLoad` and a
    welcome from an older room run `MIGRATE` (`{ 'networks-<n>': keys => keys }`, empty: every bump so far only added
    fields and keys).
  - The switch (*Update the room*; *Reload this device* in a room on this device): the page's Shared dialog under the
    room's code (`data-sh="reload"`, with a line saying what it does; also while `older`), the headset menu's Circles tab
    under the room's heading (`room:reload`, with the same line) and the update bar's and panel's *Reload every device*.
    Two presses (the first arms it for 3 s: *Reload every device? Press again*), anyone in the room, never refused by
    either lock (it moves nothing, as `look`, `near` and `trk`), never from a camera (`reloadCan`); one order a room every
    20 s from here (a second press is dropped and logged). The presser (`roomUpdate`): `version.json` (3 s at most) for
    `to` (its `format`) and `shell` (`{ n, id }`; else this device's), its own copy written (`locFlush`), then on a relay
    `GET /api/rooms/<code>` (404: the relay lost it, so `revive` first and its welcome waited for, 6 s at most) and the
    endpoint (an older relay: the order as the effect `q.reload` in the room; a 429: another order is out, nothing more);
    peer to peer the effect `q.reload`, which the host's hub passes to every member; a room on this device its other tabs
    (`localStorage` `collabReload`, the `storage` event). The order: `{ n: rid(8), to, shell, by, name, at }`, never
    stored, so no `FORMAT` change; an older app ignores the key. The presser obeys its own last (its rank the number of
    other members).
  - Obeying (`reloadIn`, `reloadGo`): skipped (logged `room reload skipped`) when its `n` was seen in this tab
    (`sessionStorage` `roomReloadSeen`, the last 8), one is under way, this device obeyed one in the last 30 s, its `at`
    is more than 2 minutes from the relay's time, or a camera follows nothing; this device's own as the relay sends it back
    (`RL.mine`). The order of reloading: the members by when they came into the room (the relay's `since`), then by id,
    the presser left out: 0.4 s, then 0.5 s more for each, at most 8 s, a headset session at least 3 s (about 1 MB
    gzipped a device: ten together on one router can pass the service worker's 4 s fallback). A headset says *This
    headset reloads in 3 s. Then press Enter VR to continue.* (a notice), a page the toast *Updating the room: reloading
    in n s.*. Then its copy written, `sessionStorage` `roomReload` = `{ code, n, to, shell, live, zone, from, at, tries,
    rank, wait }` and `HOST.live.reload('room')` (livePlace as ever: the story, mode, clock, explore state, view, the
    station or person followed, a headset's *Enter VR to continue*); a studio upload, conversion, save or recording under
    way first (30 s at most). It comes back by the room's code in its address.
  - Back (`reloadBack`, first in `HOST.collab.boot`, before anything joins): the shell checked against the order's (the
    same id, or a newer `n`); not (the service worker's old cache after 4 s or a network error): once more, its
    `livePlace` put back, twice at most (`room reload again`), then the bar's note *This device could not fetch the new
    version: reload it by hand.*; log `room reload back { n, from, to, ok, ms }`. A headset's next session in that room
    within 10 minutes keeps the station it was at (`reloadKeep`: `choose(live, 'reload')`, log `station kept after the
    reload`; the room not in yet: as its welcome comes; not the room's arc, which `arcStep` takes), instead of dropping it
    as every new session does; then `roomReload` goes. Alignment comes back as for any session (marks by their anchors,
    places, the check by eye).
  - Peer to peer: each device that gets the order lets go of the old id as it reloads (`pagehide`) and claims the new
    version's; the first back hosts from its copy (written as it went), the rest link to it, so the room does not split
    as long as every device got the order. Not yet: a newer device finding no host on the new id does not look on the
    old id to send it the order; a straggler that missed it stays on the old id until its own live update reloads it.
  - For tests: `HOST.collab.roomReload` (`{ ask(why), now(why), armed(), label(), can() }`), `reloadIn(v, by)`,
    `reloadState()`, `reloadTest(fn)` (fn(order) in place of the reload), `reloadClear()` and `format`; `HOST.live.roomNewer(code)`,
    `HOST.live.times(...)`. Untested on real devices: *Enter VR to continue* after an order on a Quest, the timings over
    real Wi-Fi with ten headsets and the service worker's 4 s fallback there, `--keep` on Coolify's volume through a
    rolling deploy, frozen tabs on Android.
- The relay's password (v110; the owner: one word a client enters once to use the relay, as menchelab/asdf10k-collab-backend does, no other way in):
  `COLLAB_TOKEN` in the relay's environment (or `--token`, also in `RELAY_ARGS`;
  empty or unset: none, everything as before), asdf10k-collab-backend's scheme
  (`relay/README.md`, "The shared password" and "Compared with
  asdf10k-collab-backend", which lists what matches and what does not for a later
  merge; `COLLAB_PORT` and `COLLAB_HOST` set `--port` and `--host` too). Needed for
  everything but `GET /api/health` (`{ ok, protocol, rooms }`) and the app's own
  files (a page must load to ask for it): the API as `Authorization: Bearer` or
  `?token=` (401 `{"error":"missing or wrong token"}`), the room's socket and
  `/api/watch` as `?token=` (the protocol's `error` `token`, then close 4401,
  before anything of a room), the introduction server as PeerJS's key (its default
  `peerjs` refused; `INVALID-KEY`, 4401). Compared in constant time. 20 wrong
  passwords a minute from one address, then 429 or close 4429 (none at all,
  PeerJS's default key and an unknown room code asked with the password are
  refused or answered but not counted: pages ask before they know it, and after a
  relay restart every device behind one router brings its rooms back). Never in a log
  line or file. In the app (`shared.js`, `AUTH`, `tokenFor`, `authSaw`,
  `authTry`, `authForget`): each device enters it once, kept per relay origin in
  `localStorage` `relayTokens` (`{ origin: password }`), never in a room's keys, a
  link, the address or a log (`log` strips any it knows, `?token=`, `key=` and
  `Bearer`); sent with every relay call (`api()`, `connect()`, `detect()`, the
  headsets' log, PeerJS's `key` when the introduction server is that relay's,
  `HOST.live`'s ping and `/api/watch`, the `p2p/` page). A relay that wants it (a
  401, a socket closed 4401) is not unreachable: the room meant for it waits
  (`C.status` `'auth'`), never peer to peer or on this device, nothing is joined by
  itself, and the relay is asked at most once a minute (`authWait`) until one is
  given. The page's Shared dialog shows *This relay needs its password* (a
  password field and Use; *That is not this relay's password*; a kept one the
  relay no longer takes is dropped and asked for again), *Forget the password* in
  its relay part; the headset menu's Circles tab a *Relay password* row (in a room
  and with none), which opens a keypad page as the code's (`passPage`, `PNL.pass`:
  the 26 lower-case letters and the ten digits, Delete, Use greyed while empty,
  Back). It is case-sensitive, so the owner's word is lower-case letters and
  digits. Accepted once a call with it succeeds: the room that waited starts or
  joins. Untested on a headset and on Coolify.
- The studio's scenes on the relay (v111; the relay serves the models and saves the layouts; the reference is
  `relay/README.md`, "Your own scenes (the studio)" and "Uploading (the upload page)"). `--scenes <dir>` (or
  `COLLAB_SCENES`, or inside `RELAY_ARGS`): each subfolder of `<dir>` is a scene (a name of up to 64 letters, digits,
  spaces and `_ . -`, not starting with a space, `.` or `-`, and not `watch`; others left out and said once in the
  log), its files up to 4 folders deep, at most 2,000 listed (dot files, `.history/`, temporary files and the scene's
  own `layout.json` and `files.json` left out; the rules in `relay/scenes.mjs`; v120: a model's picture for the studio's
  Add pane, `previews/<the model's path>.jpg`, listed and told with the kind `preview`, never `image`, anything else in
  `previews/` `other`, and `previews/` left out first past 2,000; an upload or copy there takes only such a `.jpg` of at
  most 200 KB, `.../put` signing its size, 413 *a picture in previews/ is at most 200 KB*, and `Previews/` in any other
  case is refused, 400: where case is ignored, Windows and macOS, it is that same folder; v125: a recorded path kept as a
  file, `recordings/<name>.json`, listed and told with the kind `recording`, served as JSON, at most 4 MB (and
  `--max-upload`), stored in R2 and signed as `application/json`; a `.json` anywhere else is refused, 400, and another kind
  in `recordings/` goes by its own rules; v144: a painting kept as a file, `paintings/<name>.json`, by the same rules, kind
  `painting`). `GET /api/scenes` (the scenes, and
  `save`, `upload`, `ffmpeg`, `maxUpload`), `GET /api/scenes/<name>` (its files with their kinds, its parsed `layout`
  and `layoutAt`), `GET /scenes/<name>/<path>` (the file: `ETag`, `no-cache`, 304, byte ranges, CORS; `..`,
  backslashes, NUL, dot files and links out of the scene refused), `POST /api/scenes/<name>/layout` (writes
  `layout.json` whole, the old one copied into `.history/layout-<time>.json`, the newest 20 kept), `GET
  /api/scenes/watch` (Server-Sent Events: `hello`, `scene`, `layout`, `scenes`; the folder looked at every 2 s while
  anyone listens, a change told once it has settled for 0.5 s), uploads (`POST /api/scenes` makes a scene, `POST
  /api/scenes/<name>/file?path=` stores a file, at most `--max-upload` MB (512) counted as it streams, never over a
  file without `replace=1`, written to a temporary dot file and moved into place, nothing left behind on a refusal;
  `POST /api/scenes/<name>/sound?path=` has `ffmpeg` make a long sound a mono MP3 at 96 kbit/s and 44.1 kHz, two at
  once, `--ffmpeg-limit` s each; v118: `POST /api/scenes/<name>/copy` `{ from, path, as?, replace? }` copies one file of
  another scene in, by an upload's path and kind rules, 409 when taken unless `replace`, the source a file its scene lists
  and at most `--max-upload`, written to a temporary dot file and put in place, told on the watch; with R2 the bucket's
  CopyObject, its `x-amz-copy-source` signed, nothing through the relay) and `GET /upload` (302 to `/#studio&upload` when the relay serves the app, else to
  `--app <url>`, by default the `--origin`, else `https://stories.lbi-netmed.com/`, with `&relay=` its own `wss://`
  address; no password needed to be sent on, and the query never passed on). `--scenes-readonly` writes nothing (no
  saving, no uploads: 403; the studio offers *Download layout.json*). `ffmpeg` is looked for once at the start
  (`ffmpeg -version` on the `PATH`; `--ffmpeg <path>` names one, which must run; `--no-ffmpeg` none), and the Docker
  image installs it (`apk add --no-cache ffmpeg`, about 133 MB); without it long sounds are kept as given. With a
  password every scene endpoint and file needs it, exactly as the API (wrong ones counted), and `--public` with
  `--scenes` refuses to start without one (the files are the owner's own work). `/api/ping` says `scenes: true`. In the
  shell (`shared.js`): `HOST.collab.relayFind()` gives the studio its relay, `{ base, token }` (the relay this page
  knows, else the page's own server when `detect()` finds it a relay, asked at most 5 s; `token` the password kept for
  it, '' none) or null, and `HOST.collab.relaySaw(base, status, sent, json)` passes what a studio call answered to
  `authSaw`, so a 401 brings up the shell's own password prompts (the Shared dialog's field, the menu's *Relay
  password* row) and an answer with a new password keeps it; a link `#studio&upload&relay=wss://...` sets the relay as a
  link does before the studio reads its options. Untested behind Coolify's proxy (`X-Forwarded-Proto` for `/upload`'s
  address, big uploads over slow links) and on Windows (finding `ffmpeg`, placing files by link and rename).
- The studio's scenes in R2 (v114; the owner's Coolify server on Hetzner with R2; the reference is `relay/README.md`, "Scenes in
  Cloudflare R2"). The relay keeps running on Coolify; with `--scenes r2` (or `COLLAB_SCENES=r2`, or in `RELAY_ARGS`) the
  scenes' files (models, textures, sounds, each `layout.json` and its `.history/`) live in a Cloudflare R2 bucket instead
  of a folder; the rooms never touch it. The bucket and its keys come only from the environment (`R2_ACCOUNT_ID`,
  `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`; optional `R2_PREFIX`, `R2_JURISDICTION` (`eu`: the endpoint
  `<account>.eu.r2.cloudflarestorage.com`), `R2_LINK_TTL` (12 h), `R2_POLL` (5 s), `R2_ENDPOINT` (tests)): missing or
  wrong ones stop the start with a sentence naming them (never a value), and the start lists the bucket (a sentence for
  refused keys, no bucket, an address that is no one's; a bucket that only does not answer now, a 5xx, 408, 429 or no
  answer, does not stop it: the relay starts, its rooms never need the bucket, the scenes answer 502 and it is asked
  again after 5 s and then every 30 s, `R2UP`), checks its CORS rule as a browser meets it (preflights) and tries an
  upload link as a page gets one (`r2PutCheck`: a PUT with its type, length and `If-None-Match` signed on a hidden
  `.put-check-*` object, removed again; refused, links sign only their type and `.../done` checks the size; both
  refused, `direct: false`; `If-None-Match` ignored is said); `--r2-check` does both and stops. Every scene endpoint goes through one store with two backends (`KEPT` in `server.mjs`: the folder's and
  R2's), so the rules (`relay/scenes.mjs`: `scenesOf` applies the listing rules to object keys) and answers are the
  same. With R2: `GET /api/scenes` adds `store: 'r2'`, `direct` and `linkTtl`; a scene's listing gives each file a
  signed GET (`url`, dated from the hour or the file's own time, so it stays the same for an hour and a changed file gets
  a new one), which the studio fetches straight from the bucket, from its own origin (`fileUrl`), and reads again once
  half its life has passed by the wall clock (every minute, when the page shows again, before a fetch) and after the
  bucket refuses one (403 or no answer: `linksAgain` in `call`; a streamed sound's element that fails gets a new one);
  `GET /scenes/...` is a 302 to one (no-store, CORS); a save copies the old layout into `.history/` (none when the
  newest copy is it already), puts the new one, and only then deletes past 20 (a save the bucket refuses answers 502 and
  costs no history); uploads go through the relay as before (received into its temporary folder, then put whole,
  `If-None-Match: *` unless `replace=1`; at most three at once, a fourth 429 with `Retry-After`) or straight into the
  bucket (`POST .../put` gives a signed PUT with its type, length and `If-None-Match` signed, or its type alone when the
  bucket refused the others at the start; `POST .../done` checks it and tells the watch, and removes an object past
  `--max-upload` only when a link of its own without its length signed brought it); the studio's Upload pane, Convert to
  GLB and texture buttons use them when `direct` (`tools/studio/engine/e7c_direct.js`), and send a file the bucket
  refuses (no answer, 400, 403, 501) through the relay, as every one after it on that page (`directOff`, `upVia` waiting
  on 429); `.../sound?from=<path>` makes the MP3 from a file already in
  the bucket (the studio sends a long sound's original straight there first); the watch lists the bucket every
  `R2_POLL` s while a page listens and tells a change at once (no settling: an object lands whole); a scene made empty
  keeps a hidden marker, `.scene`. R2's unexpected answers become 502s of ours (one retry for a 5xx or no answer; a PUT
  refused as `If-None-Match` says, 412 or 409, on its second try is taken as its own when the object's MD5 is what was
  sent); no key or signed link in any log line. A file with a signed link needs no password; with a folder the studio
  sends the password as a header, but in the address (`?token=`) for the loaders and sound elements, as before, and for
  a file of an R2 relay without a link (its redirect to another origin would drop a header). `tools/studio/r2sync.mjs`
  pulls scenes onto a laptop before an event and pushes them back (only what differs; a file newer where it would go
  kept and said unless `--force`; a `layout.json` replaced on either side copied first into that side's `.history/`;
  `--dry`, `--delete`, `--history`). No `FORMAT` change. Untested until tried with a real bucket: the signatures and CORS against R2 itself
  (`Origin: null` after the redirect from another origin, signed `If-None-Match` and `Content-Length` on PUTs: the
  start's check says, and both sides fall back; whether R2's 403s carry CORS headers), the EU endpoint, Quest Browser
  fetching and streaming signed links (and new ones after a night asleep), big uploads straight to R2, the costs in
  practice (a listing is a Class A operation per 1,000 objects: `R2_POLL=15` or more for a big bucket with a page left
  open).
- The shell wraps the story's `APP.seek`, `togglePlay`, `enterExplore` and
  `enterStory` to publish the clock, polls `collab.state()` five times a second
  and publishes it when its value changed; a value from the room goes through
  `collab.apply()`, merged per top-level field with controls changed here
  that the room has not yet acknowledged (so two people changing different
  controls at once both keep theirs). A story never publishes anything itself
  except effects.
  A page following a station (Follow) leaves its Stories screen: while that
  shows, nothing syncs.

The hooks every story keeps (all sixteen, the same lines; the flock is the
reference, `packages/flock/src/engine/`):

- `collab: { APP, scene: () => (LOAD.done ? GL.scene : null), state, apply, view, setView, effect, hover, panel, place }`
  in its returned object (`scene()` is null until the story is all built, so the shell attaches to it, applies the
  room's clock and state and hangs its overlay only then): `APP` is its own clock object, `effect(type, data, by)`
  plays a one-shot effect another person caused (without sending it again; `by`, since v103, is their member id as the
  relay or the host says, which a story trusts over anything in the data),
  `hover(i)` is how far controller i's ray reaches now (or 0), `panel(p, yaw, q)`
  puts the story panel where another person moved it (upright at `yaw`, or
  held at the turn `q` while free moving is on), `place(o, s, q)` the scene
  (`XR.globeOff`, `XR.size` and, free moving on, its turn `XR.rot`; `q` an
  array or null, null meaning no turn); `xrPose()` also returns `s` (the size),
  `held` (what grips hold: `'globe'`, `'panel'`, joined by spaces), `rot` (the
  scene's turn, `XR.rot`), `pq` (the panel's quaternion) and `pr` worked out
  from it (`yawOf`); `xrAdopt` takes `rot` and `pq` across a story change. `view()` is the scene's
  view in explore mode (`orbit.cur`, rounded; the longitude or azimuth
  normalised), which in a headset turns and sizes the scene in the room, or
  null (story mode, or while it flies somewhere); `setView(v, now)` glides there in
  0.25 s (`orbit.fast`), or with `now` (someone else turning it, smoothed by the shell) puts `orbit.cur` there at once
  (its angle unwrapped as for the glide; `orbit.to` null), the same lines in all sixteen (the flock, the robots and
  the design room take the argument and set nothing). The flock and the robots are life size in a headset:
  their `view()` is always null. While a headset stands at its station the
  explore sway rests (`HOST.room.placing()`).
- Two helpers next to `xrSig`:
  `const xrRoomOnly = () => !!(HOST.room && HOST.room.away && HOST.room.inRoom());`
  (a headset in a shared room: no Stories screen) and
  `const xrAway = () => !!(HOST.room && HOST.room.away && HOST.room.away());`
  (away from any station: in no circle yet this session, the story hidden and
  paused; walked out of its circle a headset keeps its station, so it is not
  away); a shell without `HOST.room.away` gives the old behaviour.
- Moving with the sticks (v125), the line after `xrSig`:
  `const xrWalking = () => !!(HOST.xr && HOST.xr.walking && HOST.xr.walking());` (the shell moves this headset with the
  sticks in VR: "Moving with the sticks" under "Four headset settings"); in `xrPoint` the explore view's spin and zoom by
  the stick waits on it, and since v132 on a spaceship flying with that controller,
  `if (APP.mode === 'explore' && !c.press && !c.grab && !xrWalking() && !(HOST.ships && HOST.ships.claims(c.src)))`, while a carried scene's
  reach by its stick in `carry` does not (its grip is held, so the shell leaves that stick to the story). The studio
  switches its own sticks with it and moves you itself while it is on (`sticks: { say(on), note }` in its returned
  object: "The studio's two stick modes"). No story reads A or X (`buttons[4]`) since v125.
- The All stories circle's lines (v104), after `xrAway`:
  `const xrCards = () => !!(HOST.room && HOST.room.cards && HOST.room.cards());` and
  `const xrAllHere = () => !!(HOST.room && HOST.room.allHere && HOST.room.allHere());`; `xrSig` ends with
  `+ (xrAllHere() ? 'A' : '')` (the panel redraws with its Stories button); in `xrBegin`, before the room's line that
  closes the Stories screen, `if (xrCards() && !XR.stories) { XR.stories = true; XR.inStory = false; XR.kbd.open = false; APP.playing = false; }`
  and that line becomes `if (XR.stories && !xrCards() && (roomOnly || (HOST.collab.mine() && HOST.room.placing()))) xrLandingClose();`
  (the cards close once a story is picked there or the headset walks into another circle); after the controllers
  `if (xrAway() || xrCards()) { APP.playing = false; SLIDE.tail = null; }`; the landing card's region
  `fn: () => (here && !xrCards() ? xrLandingClose() : HOST.go(s.key))` and the Stories pane's
  `if (here && !xrCards()) XR.stories = false; else HOST.go(k);` (the story on show's card picks it there, through
  `HOST.start` and `allPick`); the header's *Back to the story* and the pane's *Back* not drawn while `xrCards()`; and in
  `drawMain`, after the room's Stories line,
  `else if (xrAllHere() && !XR.stories) hb('stories', 'Stories', () => HOST.room.allBack(), 130);`. The smoke test checks
  the lines are in all sixteen stories and every page in `STORY_EXTRA` (the design room, the studio).
- Recenter, next to `xrRecenter` (the story panel's Recenter button, and `recenter: xrRecenterAsk,` in the returned
  object after `caption`, for the menu's Recenter and Place again):
  `function xrRecenterAsk() { if (HOST.room && HOST.room.recenter && HOST.room.placing && HOST.room.placing()) return HOST.room.recenter(); if (HOST.anchor.on) HOST.anchor.again(); XR.needRecenter = true; return true; }`
  (at a station the station's scene and panel go back where the story puts them, for everyone at its circle; else you
  in front of it again; a shell without `HOST.room.recenter` gives the old behaviour).
- The caption hook for the shell's subtitles, next to `xrAway`:
  `const xrCaption = () => { ... }` (null in explore mode, on the Stories
  screen and away from a station; else `{ s, end, els, narrT }`: the story time
  now, the chapter on show's end, its cues as `ST.items` keeps them, each
  `{ el, at, out }` in story time, and `narrT` to the clock's time), and
  `caption: xrCaption,` in the returned object, after `inputs`. The shell does
  the reading, splitting, timing and drawing; a story without it (the design
  room) simply has no subtitles.
- The panels hook for the menu's Story tab, after `recenter` in the returned object:
  `panels: () => (XR.main && XR.foot ? { main: XR.main, foot: XR.foot } : null),` (each panel with its `tex`, `w`
  and `h`; the shell draws their textures, the story keeps drawing them every frame whether they show or not).
- `xrPoint`: after raycasting its own panels (`hs`),
  `const sh = HOST.collab.ray(c.i, c.o, c.d, hs.length ? hs[0].distance : Infinity);`;
  a hit (`kind: 'shell'`: the shell's menu, the other stations' cards and
  rings, calibration marks) is nearer than the story's panels and is the hover
  instead of them and of the scene, except a hit on the menu's Story tab's copy
  of one of the story's panels (`sh.panel`, `'main'` or `'foot'`), which becomes
  a hit on that panel of the story's own at the same point:
  `if (sh && sh.panel && XR[sh.panel]) { const P = XR[sh.panel]; hit = { kind: 'panel', P, x: sh.u * P.w, y: (1 - sh.v) * P.h, point: sh.point, menu: true }; dist = sh.dist; }`
  before `else if (sh)`; then `else if (xrAway()) hit = null;`
  (nothing of the story to point at). `xrPress`:
  `if (h.kind === 'shell') { HOST.collab.press(c.i); return; }`.
- `xrGrab`: `if (XR.stories || h.menu || HOST.anchor.locked(h.kind)) return;` (in a
  shared room only at its station and unless its story is locked; the shell's
  own things never move the scene, the grip on a station's preview moves
  that station and the grip on the menu, its Story tab too, moves the menu, done by the shell); `carry` lets go when that turns locked, and
  a controller that disappears lets go too.
- `xrBegin`, after setting the rig from `HOST.anchor.frame()`:
  `const roomOnly = xrRoomOnly(); if (XR.inRoom && !roomOnly) xrFreshStart(); XR.inRoom = roomOnly;`
  and `if (XR.stories && (roomOnly || (HOST.collab.mine() && HOST.room.placing()))) xrLandingClose();`
  (no Stories screen in a room; at a station the story is the station's;
  leaving the room brings the Stories screen back); after the controllers,
  `if (xrAway()) { APP.playing = false; SLIDE.tail = null; }` (paused and
  silent away from its station; never published: the shell has no live
  station then). The scene's offset and size at a station come from the room
  (`placeSync`), not from before.
- `xrUpdate`: `const land = !!XR.stories, away = xrAway();`, the story panels
  `const pm = xrPanels(), pv = !land && !away && XR.cm !== 'hidden';` (`XR.main`
  `pv && pm === 'shown'`, `XR.foot` `pv && pm !== 'hidden'`: panels per story; the cards' mode, not the labels') and
  `GL.world.visible = !land && !away;`.
- The story lines that changed in v145 (the same in all sixteen, the design room and the studio, from `packages/lbi/src/engine/`):
  `sigFoot` (the foot panel's signature split from the main one, so a clock tick does not redraw the text panel); landing cards
  drawn at most two first draws a frame (`XR.landN`, `P.cap`) and drawn only while wanted (`P.want`; the menu's Story tab
  keeps the panels going while `HOST.collab.mirroring()`); text fades sending only the rows that moved (`panelFade`,
  `panelSend`, `FADE`: the part of a signature after `\u0001` is the fade, `P.fb` keeps each element's band); hidden panels
  not ticked; labels redrawn only when their text changes; `xrWarm` compiling a label's sprite, a sign, a panel, a controller's
  dot and ray in the load. Behind the Stories screen the frame idles as away does (`XR.idleK` `'c'`, after a second): only the
  cards hover and draw; `xrIdle` calls `XR.onIdle()` as it goes idle and `XR.onWake()` as it wakes, where a story lets go of
  and takes back what it can (the studio's emitters and screens). Sets: the instance pools and `K.fade` materials send only
  what changed and count a faded model see-through only while its fade is under 1; nothing else changed in a set's contract.
- Away a second, the frame idles (v136; the lobby diagnosis: the story left loaded went on working out its hidden scene,
  0.1 to 0.45 ms a frame here, the pass story's fish the most, and three.js walked the hidden `GL.world`'s matrices):
  `if (xrIdle(xr, dt)) return;` right after `if (xr) xrBegin(xrFrame, dt);` in `frame`, and `xrIdle` beside `xrAway`
  (with `_xrNoWalk`), the same lines in all sixteen, the design room and the studio. While `xrAway()` holds it counts the
  time away (`XR.awayT`); after a second (the frames meanwhile are full ones, so `xrUpdate` has hidden the scene, the
  panels and the labels and every fade is done: the studio's emitters fade out over 0.4 s) the frame does only xrBegin
  (the rays at the shell's things, its presses), `audioSync()` (the narration kept quiet) and the render: no sets, no
  state or camera, no labels, no `panelTick`, no sound cues. Meanwhile `GL.world.updateMatrixWorld` is a no-op of its own
  (`_xrNoWalk`, deleted again on the first frame back, when the session ends or away no longer holds), so three.js does
  not walk the hidden world (it recurses into invisible groups). Back at a station the first frame is a full one; a live
  simulation (the flock, the robots, the pass story's fish) goes on from where it was, a station's flock and school
  joining their leader as on any arrival. The smoke test's `away idle` steps check the lines in every story and page and
  drive a hand-written story, one built from sets and the flock through it.
- `xrEnterScene`: `XR.inRoom = xrRoomOnly(); const fromStart = (HOST.picking || HOST.landingVR) && !XR.inRoom;`.
- `xrEnded`: `const away = xrAway();` first, and
  `if (XR.stories || away) { XR.stories = false; HOST.openPicker(); }`.
- The panel footer: `if (!(HOST.room && HOST.room.placing()) && !xrRoomOnly()) hb('stories', ...)`;
  `xrResize` and the two-hand branch at the top of `carry`; `XR.size` in
  `xrPlace` (scene stories), `xrRecenter` and `xrAdopt`.
- The session asked for through the shell: `session = await (HOST.xr.request ? HOST.xr.request(mode) : navigator.xr.requestSession(mode, { optionalFeatures: HOST.xr.features(mode) }));` (v119; AR asks for `'shared'` and depth sensing; VR does not).
- `xrFreshStart`: `if (HOST.collab.mine() || xrRoomOnly()) { lastNow = 0; return; }`: a
  headset taken off in a room keeps its story and place (no Stories screen
  for a new wearer); at a station the room's clock and state go on applying.
- `xrLandingClose`: `if (!XR.inStory && !HOST.collab.mine() && !xrRoomOnly()) APP.enterStory(0);`
  and `if (APP.mode === 'story' && !xrRoomOnly()) APP.playing = true;`: closing
  a Stories screen in a room never restarts or plays the story (at a station
  it runs on the station's clock).
- The sound effects' lines (not a shared-room hook, but they keep a station's
  devices in step): the block after the slideshow block with `SLIDE.from`, the
  two lines in `frame()`, the click and hover lines in `xrRelease` and
  `xrPoint` (see "Sounds inside the stories" under "Sound effects"). Each
  device plays its own cues off the station's clock: nothing is sent.
- `HOST.collab.effect(type, data)` where the story itself causes a one-shot
  effect.

What each story shares:

| Story | `state()` | Effects |
| --- | --- | --- |
| airports, proteins | tab, colour, pillars, routes (to 0.05), hubs by, community level, closure mode and count, closed items, selection, path (items by airport code or gene symbol) | none |
| spatial | tab, colour, cell, routes, selection and its copy, path, community level, moves (a 0/1 string), bait and its labelling radius | none |
| lbi | tab, scene, every control of that scene, selected protein, route | none |
| nmd | tab, scene, every scene's controls, group, gene, picked endotypes, layers knocked out, your genes, the walk (its start and result, the same on every device), walkers, colour, grid, z-scores | none |
| endo | tab, scene, every scene's controls (synapse, network, tree, motor unit), endotype, gene, k (the seed-group step), method step (standing in the gap stays per device) | none |
| pet | tab, scene, every scene's controls (scanner, body, organs, liver), the comparison (a Table 2 row), network, organ (life size stays per device) | none |
| micro | tab, scene, every scene's controls (body, section, atlas, network), organ, domain, age, method step | none |
| ovary | tab, scene, every scene's controls (ovary: view, show; section: view, with By kind, show; never their Age steps), the kind of object picked, the age (20 to 70), the method (`rf` or `seg`) | none |
| qubits | tab, scene, every scene's controls (pairs; cube: view, network, cut, bits, algebra; chart: view, example, angles), the brick shown (a Pauli string by name), how many strings are added up, the gallery (kinds or largest) | none |
| mutation | tab, scene, every scene's controls (letters: view, letter or mix; rule: view, rule, start and parent letters; tree: view, tree, how fast letters change, machines; stem: view, numbers (the authors' test or this example), method), the branch length (`time`, to the hundredth), the read-outs and their seed, the branch picked, the pair favour (`w`), the rebuild's seed (never the camera or how far the read-outs have played) | none |
| topo | tab, scene, every scene's controls (the liver: lifted out, in the body or a slice; the slide: tissue, look, one scale; the tower: view, what is lit; the cohort: view, pieces or loops; the map: show, 50 or 100 µm), the patch's radius (`r`, µm to the hundredth), a cell's network radius (`mr`), the slide picked (`slide`, -1 none), the window of radii (`from`, `to`, on the 0.5 µm grid; `to` 100.5 is "and above"), the cell picked (`cell`, -1 the poster's cell v) | none |
| soil | tab, scene, every scene's controls (the soil block: view, fertiliser, wheat, DCD; the field: view, date, measure, wheat line, regime; the microbes: view, colour, split by), the module picked (`mod`, -1 none), the threshold (`rho`, to the hundredth), the shuffle (`shuf`, 0 or 1), the kind picked (`kind`, a cloud index, -1 none), the group of plots picked (`plot`, line * 3 + regime, -1 none) | none |
| pass | tab, scene, every scene's controls but the fish's view (the fish: neighbours watched, links, shark now and then; the globe: view, colour, pillars, outbreak on; the cell: view, organelles, colour, move), the school's size, the outbreak's start (an airport's code) and settings (incubation, infectious days, spread, flights cut), the city looked up, the protein picked, the school's place at a station (`sea`, moved with the grip there) (never the language, the outbreak's day, the steered shark or the sea moved outside a room) | `shark` (a passing one, as the flock's falcon, in the set's frame), `school` (quiet, twice a second, as the flock's `flock`), `fishes` (quiet, three times a second from the leader: every fish, as the flock's `birds`), `steered` (quiet, about 15 times a second while someone is the shark: their own shark, see the pass story's notes) |
| flock | birds, links, falcon | `falcon` (where it starts, its velocity and aim, in the set's frame; up to four in the air), `flock` (quiet, twice a second: where the flock is, see the flock's notes), `birds` (quiet, three times a second from the leader while anyone else is there: every bird, about 2.4 KB for 200) |
| robots | rule, robots, trails, links | `crumbs` (a pile: in room coordinates in a headset with an aligned frame, else in the station's frame), `dust` |
| ppicell (Back into the cell) | tab, scene, the cell's controls (show, sides, unknown sides, complexes, organelles, evidence, view), the protein, place or complex picked (`p`, `place`, `cx`), the Copies switch (`copies`), the Network tab's limits (`lim`: `top`, `sup`, `rel`, `pls`, `grp`, v207), the shared network on show (`net`: its id on the relay, absent for the built-in one, v208); never a network of one's own that is not shared | none |
| tutorial (an introduction, v173) | practice's network (`net`: `badge` or `grown`), the marker the guide stands at (`mk`, -1 at home), practice running (`run`, 0 or 1); never the ticks (each person's own, `sessionStorage`), practice's clock, the guide's reactions and glances, the narration hold or the copy: the guide is drawn by every device from the station's clock (a step apart after a pause or a marker change in practice; it nods at each person's own ticks) | `sig` (`{ n }`: a signal from node n, the same beads on every device, a pulse) |
| design (not a story) | the prop on the stage (`pick`), and one field per miniature moved by hand (its key: `[x, y, z, qx, qy, qz, qw, s]` in the table's frame, mm, 3 decimals, 2 decimals) | none |
| studio (not a story) | the scene's name (`scene`, `''` none) and one field per item, `o.<id>` (an object), `c.<id>` (a trigger cube, with its texture changes `tex` when it has any, v124, what it starts, `plays`, when it has anything, v136, `all: true` when it works for everyone here, v137, and `key` when it reacts to an item, v140), `s.<id>` (a sound, with what it follows: `on`, `bone`, `o`, and, a voice recorded with a movement, `sync`, `skip`, `len`, v125) or `x.<id>` (a cut-out: the object it cuts, `on`, and its `p`, `q` and `size` in that object's frame) or `g.<id>` (a group: its `name` and `items`, its members' ids) or `p.<id>` (a shape: `shape`, `p`, `q`, `size`, `colour`, `look`) or `e.<id>` (an empty: `p`, `q`) or `d.<id>` (a painting: its strokes or the file that keeps them, v144) or `q.<id>` (a sequence: its record, v146) with `qr.<id>` (its shared play state, `{ n, on, at, t, ts, by }`) and `pr.<id>` (an item's last press, `{ n, at, by }`), `sw.<id>` (an outside switch of an item or a cube, `{ on: 1 | 0, at, by }`, written only by the output page through `HOST.cur.out.act()`) and `bt` (the room's beat, `{ bpm, at, bar, by }`, likewise; `bar` beats a bar and `at` a downbeat since v158); a cube's, a press's and a sequence's record carries its `send` entries when set, and a motion its `beat` ("The output page", FORMAT networks-51); an object's, a shape's, an empty's, a sound's and a cube's record its `stream` entries, an object's, a shape's, an empty's and a sound's its `trail`, a recorded path its `sync: 'beat'` and `beats`, a sequence its `beats` (v158, FORMAT networks-52), and `settings` its `hands` (hand trails); an object's and a shape's record carries its `press` `{ do, hover, who }` when set; an object's record carries its `faces` when set, and its `tint` and `bright` (v125) when set, an object's, a shape's and an empty's its `motion` (v120) when set, an object's, a shape's, an empty's and a sound's its recorded `path` (its keys, or a recording kept as a file: `src`, `len`, `n`, v125), and an object's, a shape's and an empty's its `behaviour` (v120; a `follow` one's `side` when not in front, v127; a `follow` or `item` one's `face` when set from its card, v128; the kind `wall`, `{ at, who, range, speed, gap }`, v137) when set, an object's, a shape's and an empty's the tracker it follows, `trk` `{ id, o, q }` (v126), and an object's who wears it, `puppet` `{ on, rig, by, map, cal, s, floor }` (v126), when set, an object's, a sound's, a shape's and an empty's `shows` (`'ar'` or `'vr'`, v137) when set, and any record its `locked` when locked: its record as in `layout.json`, without `id` (an item absent from a state applied is removed there; a bad record is ignored and the item kept; changing the scene clears the items and the device that changed it writes the new scene's saved layout); and `settings` (the scene's: `others`, `real`; absent: a new scene's); never which cubes are active for whom (an everyone cube's heads are each device's from presence), what a cube has started for whom, where an item stands on a wall (each headset's own walls), editing, the selection, a group's picking, Walk, the stick walk, sound, a cut-out's *Preview*, a recording under way, Pause or *Start again*, a sequence's preview or an own-sync sequence's play state, what is pointed at (hover) or a press made with `who: 'own'`, or what the lobby made this device forget | `beh` (quiet, about ten times a second from the headset a behaviour reacts to, which drives it: `{ at, b: [[id, tx, tz, d, since], ...] }`, each item's move along the floor and turn from its placed pose in the scene's frame, a last `1` when it stops; the others draw it 120 ms behind: "Behaviours" under "The studio"), `send` (from a person's device, never a camera, the preview camera or the output page: `{ id, ev, at, t?, try? }`, a person walking into or out of their own cube opted in to send, or pointing at an item whose press sends on `hover`/`unhover`, or a card's *Try*; at most 10 a second; taken only by the output page: "The output page") |

The cell story's shared networks (v208; `packages/ppicell/src/SPEC.md`, "Stage 3"; `relay/README.md`, "Shared
networks"): a network a page read from its own file goes to the relay only on *Share with this room* (or *Put on the
relay* outside a room), kept by the relay's store `relay/nets.mjs` (`.nets/` beside the scenes, `<R2_PREFIX>.nets/` in
R2, or `--nets <dir>`; `--no-nets`; off on a public relay without a password; `/api/ping` says `nets: true`) under an id
made from its content. The station's `state()` then names it (`net`); every device there fetches it with the relay's
password as a header (the relay `HOST.collab.relayFind` gives; never in an address), builds it between frames and shows
it, `collab.state()` meanwhile giving the room's state as it came, so nothing is sent back. A device that cannot have it
(a peer-to-peer or on-device room, a relay without the store, a network removed) says why and shows the built-in
network without touching the room's state. R2's scenes' listing steps over `.nets/` as over `.notes/` (`R2.listAll`'s
`skip` takes a list), and `tools/studio/r2sync.mjs` leaves it alone.

Rules that matter most (from `docs/multiplayer.md`):

- Share outcomes, not events: `state()` is plain JSON of what another person
  must see alike (tab, controls, selection, search, route), and `apply()` sets
  it with the story's own setters so both panels (HTML and canvas) follow.
  Never share the camera, hover, open menus, text being typed, timers, page
  layout, or anything random or per device.
- `state()` must be the same on every device for the same view, and
  `apply(state())` must give the same `state()` back: echoes are suppressed by
  value, so a value that changes when applied goes back and forth for ever.
  `apply()` checks every field, ignores unknown ones and never publishes.
- One-shot effects are ephemeral (`e.<station>`), never stored; their data
  must mean the same on every device (the set's frame, room coordinates).
- Bump `FORMAT` in `shared.js` when the keys or a story's `state()` change
  shape (a room refuses another format).
- `dispose()` clears the story's timers: rooms make quick story changes
  likely, and a late timer that wrote into shared element ids once crashed
  the next story.
- The live simulations run on each device. The robots are not synced (only
  their controls and effects); the flock and the pass story's school follow one
  device at the station, bird by bird and fish by fish (see the flock's notes).
  `HOST.collab.effect(type, data, true)` sends a quiet effect: one sent often,
  kept out of the log on both sides.

Testing: `node relay/test.mjs` and `node tools/collab.mjs` (see Testing). A new
story gets the hooks, then an entry in `STORIES` in `tools/collab.mjs`.
What was tried on headsets is in the history notes. Not confirmed on headsets yet: whether they line up again after
standby (and a night), whether asking for the shared space again (Re-align, or 15 s after waking) joins the others'
space, how a scene moved, resized or turned at a station looks for the others, people's name tags in each cards mode,
the story panels in 3D in the life-size and stand-inside views (labels and cards as two independent settings, labels
on top by default, are untested there), persistent anchors restored (the log says why a handle is refused), whether a
recentre fires a reset, sound zones heard, comfort and frame rate with presence drawn, whether the socket keeps running
inside an immersive session; peer to peer with headsets and phones in a room, links inside VR and AR, a host change and
a headset's hand-over at an event, and how long PeerJS's public server keeps a sleeping host's id; how a station's card
reads when its icon or ring is pointed at, the story and its narration heard from out of the circle, the locks and the
People toggle in use.

## Live sound (v162, `shared.js` "live sound: hearing"; `tools/output/SPEC.md` "v162")

The owner (17 November 2026, "go as described"): the output page streams one sound input of its computer to the room
(lane A: "live sound: sending", the relay, `output.js`), and devices elsewhere hear it. The hearing side:

- **The wire.** Binary WebSocket frames from the relay (`ws.binaryType = 'arraybuffer'` on the relay's socket; `wire()`
  passes a non-string message to `liveIn`, never to `JSON.parse`): a 16-byte big-endian header (`tag` 1, `ch`, `sid`,
  `seq`, `at` on the relay's clock) and one Opus packet. The relay's effect `@snd` (`by: ''`): `{ on: true, sid, cfg,
  kbps, by }` or `{ on: false, sid, why }` to subscribers (`liveFx`), `{ st }` to the output page (`HOST.out.sndFx`).
- **Who hears it** (`liveWant`): never the output page itself, never off a relay (peer to peer, on this device, an old
  relay without `welcome.snd`), never while this device's Sound button is off; per device (`localStorage` `liveSound`,
  `auto` by default): `on` always, `off` never, `auto` when this device is elsewhere (`!here()`: a computer's page, a
  headset elsewhere by its own setting; a camera is here). `liveStep` (from the pump) sends `{ t: 'snd-sub', on }` when
  that changes and again on each new socket (a reconnect starts unsubscribed); unsubscribing drops the decoder and node.
- **Playing.** WebCodecs' `AudioDecoder` (`isConfigSupported` first; none or refused: `why` says *This browser cannot play
  the room's live sound* and it stops asking), each decoded frame copied to an `AudioBuffer` on `HOST.audio.fx()` (no
  context: dropped, counted `skipped`) and scheduled 0.25 s behind, each next one at the end of the one before; one due
  under 0.03 s or over 0.6 s ahead moves the schedule back to 0.25 s (`late`); a gap in `seq` is counted `lost` and the
  decoder goes on. Everything goes into one `GainNode`, `LV.out` (made again on a new context, never a context of its
  own): to the destination at `LIVE_LEVEL` 0.8, or, claimed, to the claimer's nodes (`liveClaim(owner)` cuts the
  destination link, `liveRelease(owner)` puts it back; leaving the room, unsubscribing and another story let any claim
  go). It fades to 0 while the Sound button is off (not Sound effects, not Narration). Not a story's background: the
  owner asked for it, and it plays only while the output page streams.
- **API** (`HOST.collab`): `liveSound()` `{ mode, want, on, playing, level, lagMs, frames, lost, late, skipped, src, by,
  claimed, why, avail, sub }`, `liveMode()`, `setLiveMode(m)`, `liveNode()`, `liveClaim(owner)`, `liveRelease(owner)`,
  `liveIn(buf)`, `liveFx(v)` (for tests). The calls in `pump()` and `leave()` wait for `HOST.collab` (the pump runs while
  the file is still being read).
- **Settings rows.** The Shared dialog, in a room and not on the output page: `.sh-live`, a button `data-sh="live"`
  (*Room's live sound: auto / on / off*, each press the next) and what it means and its state (*Playing now*, *The output
  page is not streaming*, *Not available: rooms on a relay only*, or *this relay is too old*; the button disabled then).
  The headset menu's Settings tab, after *Effects volume*, in a room: the same button (`live`) and a short note; the phone
  AR sheet (`phRows`): the row `live` after Sound effects. Never in `state()` or `collab.state()`; FORMAT unchanged.
- **Tests.** `node tools/smoke.mjs <url> --only 'studio live'` (frames encoded in the test with `AudioEncoder`, fed to
  `liveFx`/`liveIn`). Untested here: a real relay stream end to end (lane A; `tools/collab.mjs --live` if written),
  latency and dropouts over real networks, how it sounds (unheard), positional live sound in a headset, and whether Quest
  Browser has `AudioDecoder`.

## Talk (v178, `shared.js` "talk: shared", "talk: sending", "talk: hearing")

The owner (20 November 2026): "lets try open mic with mute row? yes talk only in relay rooms is ok for now", "lets go".
People in one shared room who are **not** in the same physical room talk to each other through the relay: open mic with
a voice gate and a *Mic* row, never push to talk (no controller button is taken). The code points here; the relay's side
is also in `relay/README.md` "Talk (v178)". Modelled on live sound (v162), whose paths it reuses: binary frames on the
room's own socket, WebCodecs, the shell's one context. The name is **Talk** everywhere (`talk...`, `TALK_...`, `TK`,
`TKH`, `TKS`, `TH`), never `voice` (that is Narration).

- **This device's own.** `localStorage` `talkOn`, `talkMic`, `talkRoom`; off until turned on (no microphone before).
  Never in `state()` or `collab.state()`; FORMAT stays `networks-55` (Talk is relay presence, as `snd`, not a room key).
  *Talk: on*: this device hears the others who talk, and its microphone is open unless muted; turning it on turns this
  device's **Sound** on too and the Mic on (a press). *Mic: muted* closes the microphone (listening only). A browser
  without `AudioDecoder` cannot turn Talk on; one without `getUserMedia`, `MediaStreamTrackProcessor` or `AudioEncoder`
  listens only. Relay rooms only (`talkAvail`: `C.code`, `C.via === 'relay'`, `C.talk` from the relay's `welcome`, not
  the output page, not camera mode); peer to peer, on this device and an old relay say why (`talkWhy`).
- **The wire.** A Talk frame is a binary WebSocket frame, both ways (the relay changes only `sid`): 16 bytes big-endian,
  `tag` u8 2 (live sound's is 1), `fl` u8 (bit 0: the first frame of a spurt), `sid` u16 (the sender writes 0, the relay
  the talker's stream id), `seq` u32 (frames handed to the socket since this `talk-start`; a frame the gate held back takes
  no number, one the socket refused does, so a gap at a listener is a real loss), `at` f64 (its first sample's capture on
  the relay's clock, `now()`), then one Opus packet of 1 to 1,000 bytes (`TALK_MAX_FRAME` 1,016 in all). 20 ms at
  24 kbit/s is about 60 bytes: 50 frames a second while someone speaks, none while silent. Text messages: `{ t:
  'talk-sub', on }` (hear the room's talkers, or not; a new socket starts unsubscribed), `{ t: 'talk-start', cfg }` (the
  encoder's `decoderConfig`: Opus, `sampleRate` in `TALK_RATES` 8, 12, 16, 24 or 48 kHz, one channel, `description`
  base64 of at most 512 characters or none), `{ t: 'talk-stop' }`. From the relay (`by: ''`): `@talk` `{ list: [{ sid,
  id, cfg, here }] }` to **every** member whenever it changes, and after a `welcome` only when it is not empty (no names:
  every member has them from `members`); `@talk` `{ st: { on, sid, subs, frames, bytes, dropped, bad, why, max } }` to a
  talker on its start and stop and every 2 s (`why` `''`, `stopped`, `gone`, `full`). `welcome` has `talk: 1` and
  `/api/ping` `talk: true`.
- **Who hears whom** (the relay routes, `talkHears`): talker *s* reaches member *l* iff *l* has `talk-sub` on, *l* is not
  *s*, and not both are `here` (the `here` of their `hello`s: the shell's `here()`, sent again whenever it changes). People
  in one place hear each other in the air, never through speakers. **Known limit:** two separate groups that are both
  `here` do not hear each other; a headset in AR counts as here until it says *I am elsewhere* (the Debug tab's `here`
  button), so two people in AR in two homes press that first. A VR headset that has not yet answered the menu's *Are you
  in the same room as the others?* (`askHere()`) neither talks nor hears until it does (its line says so). A screen
  always counts as elsewhere: next to the headsets, keep Talk off.
- **The relay's rules** (`relay/server.mjs` "Talk"): `TALK_MAX` 8 open microphones a room (the ninth `talk-start` gets
  `st` `why: 'full'`, `sid: 0`; listening still works; a restart does not count itself); a frame under 17 or over 1,016
  bytes counted `bad`; at most `TALK_RATE` 60 frames a second a talker (`quota`, the rest `dropped`); a listener whose
  socket is gone or backed up past `TALK_BACKLOG` 16 KB misses the frame (audio never queues); a tag-2 frame from a member
  with no stream is dropped and counted (`talkStray`), never a 1003 close (a plain member's tag-1 frame still is);
  `talk-start` from the output page or a camera is refused once a socket. A new sid at each `talk-start` (u16, never 0,
  never another talker's), so a late frame of a stopped stream never reaches a new decoder. A reconnect ends the old
  stream (`gone`) and the page starts again on the new socket; a talker's `here` changing sends the list again; a hello
  that says output page or camera ends the stream. Nothing stored; the log has started, stopped (why), refused (full) and
  changed counts, never bytes, a cfg, a name or an address.
- **Sending** ("talk: sending", lane A). A press (the user gesture) calls `getUserMedia` within its turn, voice settings
  (echo cancellation, noise suppression, gain control, mono, 48 kHz asked); `MediaStreamTrackProcessor` reads its
  `AudioData` (no `AudioContext` anywhere); WebCodecs `AudioEncoder`, Opus mono, 20 ms, 24 kbit/s, `voip` (without
  `voip` if refused). Every piece is encoded, gate open or not; the gate (`TALK_GATE` 0.01 RMS of the first channel,
  `TALK_HANG` 300 ms after the last loud piece) decides what is sent, the last `TALK_PRE` 2 packets (40 ms) sent first when
  it opens with `fl` 1. The stream starts (`talk-start`) on the first packet, before anyone speaks, and again on each new
  socket. Dropped, never queued: a packet while `bufferedAmount > TALK_SEND_MAX` 8,192, a piece while
  `encodeQueueSize > TALK_QUEUE` 10. `talkFail` closes everything and sets `TK.phase = 'error'`, `TK.err` (the words below)
  and `TK.mic = false` (not saved: one press tries again; no loop of prompts); `full` likewise (`TK.full`). By itself (no
  press: a load, *Update the room*, a relay coming back) the microphone opens only in the room it was last opened in
  (`talkRoom`) and only when `navigator.permissions` says `granted`; otherwise the Mic waits (`TK.held` `'room'` or
  `'reload'`). Leaving the room or the room leaving the relay closes it.
- **Hearing** ("talk: hearing", lane B). `talkHearWant`: Talk on, a Talk room, the menu's question answered, `AudioDecoder`
  there and **the Sound button on** (hearing follows only the Sound button, never Sound effects or Narration). `talkStep`
  (the pump, 5 times a second) runs `TKH.step()`, sends `talk-sub` on each new socket, forgets a list from an older socket,
  keeps one record per talker heard (not this device, not here while this device is here) and the rows' signature
  `TH.sig`. One `AudioDecoder` a talker (`isConfigSupported` first; made again at most 3 times in 10 s, then `why` *cannot
  decode*). **The jitter buffer**: each decoded frame an `AudioBuffer` on `HOST.audio.fx()`, the first scheduled
  `TALK_T0` 80 ms behind, each next one at the end of the one before; a new spurt (`fl` 1) the target again; one that ran
  dry restarts the schedule (`late`); one more than the target plus `TALK_SLACK` 0.1 s ahead is dropped. The target follows
  the spread of the frames' lateness (`now() - at`, the last `TALK_JW` 50; every 25 frames 40 ms plus the 90th percentile
  over the earliest, `TALK_TMIN` 60 to `TALK_TMAX` 300 ms). No Opus loss concealment (WebCodecs cannot be asked for it;
  over TCP frames are late, not lost). A `GainNode` each on the shell's context (`TALK_LEVEL` 1, faded to 0 while the
  Sound button is off; made again on a new context; never a context of its own, never live sound's `LV.out`).
- **Positional voices.** In a headset (`talkPlace`, from the tick) a talker whose head is drawn (`OV.people`, room to
  reference space by `OV.room.matrix`) is heard through an HRTF `PannerNode` at that head (`inverse`, `refDistance` 1.5,
  `rolloffFactor` 0.5), never further than `TALK_FAR` 6 m (a remote voice never fades away: about 8 dB down at most); the
  context's listener at this head. A page, a phone, a talker with no head drawn here: flat. Back to flat when the session
  ends.
- **The hooks** ("talk: shared", both lanes' verbatim piece): `TK` (this device's side: `on`, `mic`, `room`, `held`,
  `phase` `'off'`/`'asking'`/`'live'`/`'error'`, `err`, `full`, `max`, `started`, `st`, `level`, `frames`, `drops`),
  `TKH` (`open`, `step`, `halt`, `st`: filled by "talk: sending"; "talk: hearing" calls only these), `talkLacks`,
  `talkAvail`, `talkWhy`, `setTalk`, `setTalkMic`, `talkMic`. `TH` is the hearing's (`sub`, `list`, `talkers`, `stray`,
  `sig`). Joined: `wire()` sends tag-2 frames to `talkIn` (others to `liveIn`), `onFx` passes `@talk` `st` to `TKH.st` and
  a list to `talkFx`, `pump()` calls `talkStep`, `leave()` `talkLeave`, `tick()` `talkPlace`, `welcome()` sets `C.talk`.
- **The rows and their words.** The Shared dialog (`.sh-talk`, in a room, not on the output page): *Talk: on/off*
  (`data-sh="talk"`, its title `TALK_TITLE`), *Mic: on/muted* (`talkmic`) and the line. The headset menu's **Circles**
  tab, after *Narration for everyone here*, not in a room on this headset, and only when it fits above You. The phone AR
  sheet (`phRows`): `talk` (wide, the line as its note) and `talkmic`. Talk can always be turned off; the Mic only while
  Talk is on in a Talk room with a browser that can talk (`talkBtns`). The line (`talkLine`) names what a browser lacks
  (*This browser cannot use Talk (no ...)*, *Listening only: this browser cannot talk (no ...)*), the reason it is not
  available, *Off: no microphone, nothing heard* or *N people are talking: turn Talk on to hear them*, *First answer the
  menu: ...*, then this device (*N people hear you*, *Nobody hears you yet*, *Waiting for the microphone*, *Allow the
  microphone for this site: the question may show outside VR* after 8 s in a session, *Mic muted: you only listen*, *Mic
  muted after the reload / in this new room: press Mic to talk*, *The room is full for Talk (8 microphones): press Mic to
  try again*, the microphone's errors: *The microphone was not allowed: allow it for this site*, *This device has no
  microphone*, *The microphone is busy: another app may have it*, ...) and the others (*Talking: A, B, C and 2 more*,
  *Nobody else is talking*, *Sound is off: turn it on to hear ...*). No speaking marks: the line changes only with the
  list, the counts or the state.
- **API** (`HOST.collab`): `talkMic()`, `setTalk(on, why)`, `setTalkMic(on, why)`, `talkLacks()`, `talkState()` (adds
  `hear`, `test`, `soundOff`, `session`, `here`, `ear`, `stray` and `talkers`: `{ id, name, sid, here, rec, frames, lost,
  late, skipped, level, lagMs, target, playing, panned, gain, pos, why }`), `talkLine(s)`; for tests `talkSend(seq, at, fl,
  bytes)`, `talkGate(x)` (0: always open), `talkIn(buf)`, `talkFx(v)`, `talkTest(on)` (hearing without a room).
- **Tests.** `node relay/test.mjs --talk` (also in the main run: the relay's rules, eight steps), `node tools/smoke.mjs
  <url> --only talk` (off by default and the words for every state; the dialog's row; three talkers' frames encoded in
  the test; voices from their heads in a pretend headset), `node tools/collab.mjs --talk` (not in the main run: three pages
  on the run's relay with Chromium's fake microphone; A talks, B hears it, C reads that one person is talking, Mic muted,
  a reconnect).
- **Untested** (only a device shows): whether Quest Browser has `MediaStreamTrackProcessor`, `AudioEncoder` and
  `AudioDecoder` and Opus `voip` (the row names what it lacks: read it on the Quest); the microphone prompt and
  `getUserMedia` inside an immersive session (the 8 s note) and whether a press in the headset menu counts as a gesture;
  echo (a headset on its speakers, two headsets in one room with a remote person, a screen on loudspeakers; whether
  Quest's echo canceller hears what Web Audio plays); how voices sound (Opus at 24 kbit/s, the gate's 0.01 and hang-over
  on real microphones, the level against narration and effects, the HRTF voice at the head, the 6 m clamp: unheard);
  latency and gaps over Coolify's proxy on home Wi-Fi, venue Wi-Fi and mobile data; frame rate with several talkers and
  the relay's load with eight; positional voices lining up with drawn heads and bodies; phones in AR; Safari and Firefox
  (listening only at best). Nothing on the controllers (open mic).
- **Departures from the plan.** (1) The headset menu's row is on the Circles tab, not Settings: the Settings tab is 1,858
  of its 1,920 px in a room, and the menu's quad layer is pinned at 720 x 1920. (2) The list goes to every member, so a
  page with Talk off can say who is talking. (3) `@talk` carries no name and no `muted`: muting closes the stream and the
  microphone and frees a place under the cap. (4) `here` is the hello's, not a new message. (5) A new `sid` at each
  `talk-start`. (6) No `AudioWorklet` fallback for capture this round (the next round if a Quest lacks
  `MediaStreamTrackProcessor` but has `AudioEncoder`). (7) No speaking mark in a headset (a tag drawn again uploads the
  whole atlas). (8) No Opus loss concealment. (9) After a load the microphone opens by itself only with the permission
  `granted` and in the room it was last opened in. (10) The lanes meet only through `TKH` and two verbatim pieces. The
  builders': Chrome's `AudioEncoder` gives a `description` (an OpusHead, 28 base64 characters): sent as base64, left out
  if longer than 512; the gate reads the plain RMS of the first channel (output.js's meter doubles it); `talkPlace` keeps
  `T.pos` only while panned; two helpers of the hearing's own (`talkDecoder`, `talkB64`). **Busy pages:** the microphone
  is read on the page's main thread. On this machine's software-drawn pages (10 frames a second, three pages on 4 CPUs)
  Chromium's track reader handed over only 3 to 20 of the 50 packets a second (`tools/collab.mjs --talk` waits for 25
  frames within 15 s for that reason); blocking a light page for up to 80 ms at a time lost nothing, so a Quest drawing
  at 72 Hz with time to spare should not. Lane A measured 41 reads in 3 s on the full page against 301 on a light one,
  and 138 and 223 with the reader's `maxBufferSize` at 25 and 100; the code keeps the plan's `{ track }`. If voices
  break up while a headset is busy, try `maxBufferSize: 25` first, then the reader in a worker
  (`MediaStreamTrackProcessor` runs there too).

## Vive trackers (`tools/trackers/`, `relay/trackers.mjs`)

Vive Tracker 3.0s in the shared rooms (v126; the owner's choice:
phase 1, trackers in the rooms and props that follow them, and phase 3, a Mixamo character worn by a performer; about
9 to 11 trackers, three base stations, a Windows PC with SteamVR and a Valve Index that also runs the relay). The
contract between the lanes is `tools/trackers/SPEC.md`; setting it up, `tools/trackers/README.md`; the relay's side,
`relay/README.md` ("The PC's Vive trackers").

### The bridge and the relay (v126)

- **The bridge** (`tools/trackers/bridge.py`, Python 3 and pyopenvr, the standard library otherwise; `uv run` it, which
  fetches both by its PEP 723 block and `bridge.py.lock`, or `python` after `pip install openvr`): browsers cannot
  read the trackers, so this reads every device's pose from SteamVR (a background application, the standing universe:
  y up, the floor at 0) about 90 times a second and sends one UDP datagram a reading to `127.0.0.1:<port>` (47800):
  `{ v: 1, t, d: [{ s: <serial>, k: 'trk' | 'hmd' | 'ctl' | 'base', h?: 'l' | 'r', p, q, lv, av, ok, b }] }`, under 8 KB.
  Serial numbers are the ids everywhere. `--list`, `--fake` (made-up devices, no SteamVR), `--seconds`, `--port`,
  `--rate`. `tools/trackers/fake.mjs` is the same in Node for the tests (`startFake({ port, turn, move, devices })`:
  SteamVR's space the room turned and moved by a known transform, so every pose's truth is known).
- **The relay** (`--trackers [port]`, also in `RELAY_ARGS`; `relay/trackers.mjs`; nothing at all without it): takes the
  datagrams on 127.0.0.1 only (bad ones ignored, counted, said in the log at most once a second), keeps each device's
  latest reading with its own time, and answers `/api/ping` (`trackers: true`, `trackersSeen`), `GET /api/trackers` (every
  device raw in SteamVR's space) and `GET /api/trackers/still?id=&ms=` (a tracker's position averaged while it lies still,
  or why not: not seen, lost tracking, moved more than 5 mm), both with the password as the API.
- **Lining up by hand** (the room's key `trk = { on, m: { a, b } | null, names, by, at }`, written by pages and headsets,
  never refused by a lock; `m` may also carry `k`, an area's id, with `ra` and `rb`, that area's floor points
  in room coordinates as the page wrote them, its crosses less `FLOOR_TIP`: the tracker lay on that area's crosses, and
  `frameOf` fits `a` and `b` to them as a headset's calibration on an area is fitted, "Areas" under "Shared rooms"; the
  dialog has an area picker while the room has areas, `#shTrkArea`, and its spots' buttons say the area's letters): `m`
  holds the two points of a tracker lying on spot A and on spot B in SteamVR's space, and
  the room's frame from them is exactly a headset's from its floor spots (`shared.js`'s `fromMarks` with the floor
  spots' `floorUnder`, and `basis`; `TRK_FLOOR`, the tracker's pose origin over the floor lying on its base, 0 until
  measured, in place of `FLOOR_TIP`): origin the floor under spot A, x level towards spot B, y up. `relay/test.mjs` runs
  `shared.js`'s own code against `relay/trackers.mjs`'s. Reference trackers left on the spots wait for a later round.
- **`@trk`**: to every member of a room whose `trk.on` holds and whose `m` gives a frame, sent by the relay itself
  (`by: ''`, no member's fx rate), at most 60 a second (once a second while the bridge is silent): `{ t: 'fx', k: '@trk',
  v: { at: <relay ms of the newest reading>, l: 'hand', t: [[id, x, y, z, qx, qy, qz, qw, vx, vy, vz, ok, kind], ...] },
  by: '' }` in room coordinates (mm, 4 decimals; `ok` 0 also once a reading is 0.5 s old; `kind` `t`, `h`, `l`, `r`; no
  base stations; a device silent 5 s left out). On but not lined up: `{ at, l: '', t: [] }` once a second. A member
  whose socket holds over 256 KB unsent is skipped. Only rooms on that relay (peer to peer and on a device: none).
- `FORMAT` networks-38 (the room's key `trk`; the studio's records' `trk` and `puppet`).
- Untested until tried on the owner's PC: the bridge with SteamVR and real trackers (pyopenvr's calls, the rate on
  Windows), `TRK_FLOOR`, the lag through the relay, how steady the lining up by hand is.

### The shell (v126, `shared.js`: "the PC's trackers")

- **The room's key `trk`** = `{ on, m: { a: [x, y, z], b: [x, y, z] } | null, names: { <serial>: <name, at most 24
  characters> }, by, at }`: `on`, this room uses the PC's trackers; `m`, the two points (a tracker's raw position in
  SteamVR's standing space) taken with a tracker lying on spot A and on spot B. Written by pages and headsets, never
  refused by either lock; a write keeps the fields it does not change (`setTrk`, also fields of a newer app's). The room's
  frame from `m` is the headsets' frame from floor spots: its origin the floor under spot A, x along the floor towards
  spot B, y up, z = x cross y (a point to the right of the way from A to B has z > 0). The relay works it out; the shell
  keeps the headsets' own as the reference, `HOST.room.fromSpots(a, b, tip)` (`fromMarks` for floor spots: tip `FLOOR_TIP`
  for a controller, `TRK_FLOOR` for a tracker, the tracker's pose origin over the floor lying on its base, 0 until
  measured) and `HOST.room.roomOf(frame, p)` (a point in the spots' own space in room coordinates through it).
- **`@trk`** (the relay's own message to every member of a room whose `trk.on` holds and whose `m` is set, 60 a second,
  `by` ''): `{ at: <the relay's ms of its newest reading>, l: 'hand', t: [[id, x, y, z, qx, qy, qz, qw, vx, vy, vz, ok,
  kind], ...] }` in room coordinates (`kind` `'t'` a tracker, `'h'` the Index, `'l'` and `'r'` its controllers); with
  `trk.on` but no `m`, `{ at, l: '', t: [] }` once a second. Peer-to-peer rooms and rooms on this device get none. The
  shell's own (`onFx`, as `@menu` is), never passed to a story and never taken from a member (only with `by` ''): each
  one's last 8 samples by `at` (`TRK`), drawn at the relay's time now less `TRK.delay` (40 ms, eased as others' moves'
  render time is) between the two samples round that moment (places in a line, turns by slerp), carried on by its velocity
  for at most 100 ms past the last; not heard of for 0.5 s, `ok` false and its last pose kept (one its row says is not
  seen well, held, not carried). A bad row (no id, more than 64 characters, numbers that are not, a place past 10 km) is
  dropped, a late or repeated sample ignored, at most 64 trackers; one not heard of for a minute is forgotten.
- **The API** (`HOST.collab`): `trackers()` (`[{ id, name, kind, p, q, ok, age }]` in room coordinates now), `tracker(id,
  out)` (one, `out` filled in; null never seen), `trk()` (the key read safely with the last `l`, whether the relay has
  trackers, its count, whether this room uses them now, `used`, its status in words), `setTrk({ on, m, names })` and
  `trkName(id, name)`; `body(memberId)` (below). For tests: `trkIn(v, by)` (a `@trk` message through the shell's own
  intake, as the relay sends it; with `by` as a member would, ignored), `trkTime(ms)` (the relay's time held for the
  trackers, and for the Index's history below; `null` live), `trkPing()` (the relay asked now), `trackersShown(on)`,
  `pucks()`, `mapTrackers()`.
- **Pages** (the Shared dialog's *The PC's trackers*, `index.html`'s `.sh-trk`, drawn by `trkRender`): shown while the
  room is on a relay whose `/api/ping` says `trackers: true` (asked as the dialog opens, then every 3 s while it is open
  and every 15 s otherwise). *Use the PC's trackers in this room: on/off* (`trk.on`) with its status (*Not used in this
  room*, *Not lined up yet*, *Lined up by hand (the spots 1.84 m apart): 3 trackers in the room.*, *the relay sees no
  trackers: is the bridge running...*); lining up by hand: the tracker lying on the spot picked from the relay's list,
  *Set spot A* (`GET /api/trackers/still?id=<serial>&ms=1000`: its mean place while still, or the relay's words why not),
  then *Set spot B*, which writes `trk.m` (refused in words: less than 50 cm apart, or more than 4 cm apart in height,
  `SPOTS_DH`, as the headsets' floor spots); the trackers (`GET /api/trackers` twice a second while the dialog is open):
  serial, kind, seen or not, battery, a name typed into `trk.names`, a row that lights for 1.5 s while its tracker moves
  (more than 1 cm since the last look), the base stations counted. The room map draws them as small dots with their names
  while the room uses them.
- **Headsets**: *Trackers: shown / hidden* on the menu's Debug tab (this headset's own, kept as `xrTrackers`, hidden by
  default; a line beside it says how they stand): each tracker (kind `'t'`) a small puck where it is in the room (in the
  room's group, as people are drawn; a 7 cm disc along the tracker's own y, a ring on top that dims while it is not seen,
  its name on a sign turned to you), depth-tested.
- **The Index in the room** (`trkAlign`, `trkHist`, `trkEstimate`): the PC's page in VR with the Index (a browser that is
  not a standalone headset's, `!IS_HEADSET`) lines its room up from its head as the trackers see it (`'h'`, in room
  coordinates) against its own head in its `local-floor` at the same moments (a history of its viewer pose by the relay's
  clock, read from the frame itself: `update` also runs from the story's frame, through `place`, before the shell's tick
  has this frame's head). A level frame, the turn about the vertical from the heading of the two and the place (and the
  floor's height) from the two, over the last second of samples taken while the head is fairly still (at most 0.5 m/s
  and 0.6 rad/s as both see it: a pose WebXR predicts for the display and one the bridge read a moment before differ only
  while it moves), at least 10 of them across 0.3 s; followed past 1 cm or 0.5 degrees. A frame source of its own,
  `'trackers'`, after this headset's own marks and before the shared space; held while the trackers do not see it; while
  they see it and its first samples are still coming, lining up (never *Calibrate the room* meanwhile).
  `lineUp()` says *Lined up by the PC's trackers* (not lined up: *the PC's trackers have lost it* after 3 s); the pages'
  list *lined up (the PC's trackers, not checked yet)*; the startup flow never opens for it, and the menu's question (in this room, or
  elsewhere?) is answered for it while the trackers see it (*In the room*). No spots and no shared space needed. One such page per room: a second PC's browser in VR
  would take the Index's head for its own.
- **A person's head and hands** (`HOST.collab.body(memberId)`, for the studio's puppet worn with a Quest's head and
  hands): `{ head: [x, y, z, qx, qy, qz, qw], hands: [left, right] (each such a pose or null), at }` in room coordinates
  for a member in a headset, smoothed from presence as their figure is drawn, or this headset's own poses now; null for a
  page, a camera or anyone not heard of for 2 s. Presence gained `g`, the grips (or the tracked hands' wrists) as poses,
  `[left, right]` with null where there is none (`gripStep`, each frame of a headset session); its `hands`, the rays
  drawn, were in the order of the story's controller indices (the session's input sources, in no fixed order of hands)
  and are now the left's first. Older devices ignore `g` (a newer device reads none from them: hands null).
- Untested here: SteamVR, real trackers and the Index (what the bridge reads, `TRK_FLOOR`, how a tracker's own frame lies,
  so how the pucks sit), the Index's page in VR in Chrome or Edge through SteamVR's OpenXR (its frame from the trackers,
  whether its viewer pose and the bridge's head pose are the same point, lag through the relay), the pucks' look on a
  headset, a Quest's grips in presence on a real device. Only in headless Chromium with a pretend headset and the relay's
  answers stubbed (`--only trackers`).

The studio's side of the trackers (props on trackers, a Mixamo character worn with them, takes) is in the studio's notes ("The studio: props on trackers and a character worn with them").

## From CLAUDE.md

These notes were in `CLAUDE.md` (Notes for Claude Code); they are kept here word for word, beside the area they belong to.

- Shared rooms (`shared.js`, `relay/`, see "Shared rooms" above): keep
  the shared hooks in all sixteen stories, the same lines in each (the `collab`
  object, the ray and press lines, the grip line, the session through
  `HOST.xr.request(mode)` (its features from `HOST.xr.features(mode)`: AR asks for `'shared'` and depth sensing, VR for less), the Recenter lines (`xrRecenterAsk` and `recenter` in the returned object), the `HOST.collab.mine()` lines in `xrFreshStart` and
  `xrLandingClose`, and the walk-in lines: `xrRoomOnly` and `xrAway` (no Stories screen in a room; away from its station
  the story hidden, not pointable, paused) read in `xrBegin`, `xrPoint`, `xrUpdate`, `xrEnterScene`, `xrFreshStart`,
  `xrEnded`, `xrLandingClose` and the panel footer). `state()` never holds the camera, hover or anything per
  device, and `apply(state())` gives the same `state()` back. After touching
  `shared.js`, the relay or a story's hooks or its `state()`, run
  `node relay/test.mjs` and `node tools/collab.mjs` as well as the smoke test
  (and bump `FORMAT` in `shared.js` when a `state()` changes shape). Others' moves
  are smoothed in `shared.js` ("Others' moves, smooth" above): a write of a
  move by hand carries `ts` and, while held, `h`, and every comparison of such a value
  leaves them out (or writes and echoes go back and forth); `setView(v, now)` keeps the
  same lines in every story; after touching it run `node tools/collab.mjs --smooth`, and
  report how smooth it feels on headsets as untested. Shared
  spaces, calibration and sound zones only exist on headsets: report them as
  untested. Peer-to-peer rooms (no relay) are tested only between pages on one
  machine through the relay's `/peerjs`: tests never use PeerJS's public server
  (no internet), and links between real devices are untested until tried there.
