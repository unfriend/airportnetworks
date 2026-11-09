# The PC's Vive trackers in the rooms

Vive Tracker 3.0s (with SteamVR and its base stations) placed in a shared room: their poses go to every headset and
page there, lined up with the room, for props that follow a tracker and a character worn by a performer (the studio).
The overview is [AGENTS.md](../../AGENTS.md), "Vive trackers"; the contracts as built are [SPEC.md](SPEC.md). Here: how
to set it up on the Windows PC, what to try when nothing shows, and what each file is. Nothing of it has been tried with
real trackers yet.

Browsers cannot read the trackers (WebXR has no tracker API; SteamVR solves their poses itself), so a small helper on
the PC reads them from SteamVR and hands them to the relay on the same PC, which serves the app and the room:

```
trackers, base stations, the Index  ->  SteamVR  ->  bridge.py  --UDP 127.0.0.1:47800-->  relay --trackers  ->  the room
```

| file | what it is |
| --- | --- |
| `bridge.py` | the bridge: Python 3 and the `openvr` package, reads every device's pose from SteamVR about 90 times a second and sends it to the relay (`--fake`: made-up devices, no SteamVR) |
| `fake.mjs` | a fake bridge in Node (no packages): the same datagrams, made up, for the tests and for trying the rooms' side without the hardware |
| `SPEC.md` | the contracts as built (the datagrams, the relay's endpoints, the room's key `trk`, the `@trk` message), what is open or deferred, and the tests |

The relay's side is `relay/trackers.mjs` (`--trackers`; [relay/README.md](../../relay/README.md), "The PC's Vive
trackers").

## On the Windows PC

The PC that runs SteamVR also runs the relay (`node relay/server.mjs --lan --trackers`), so headsets on the same Wi-Fi
open its `https://` address as for any session with a local relay (the relay's README, "A session on one Wi-Fi, step by
step"). The Valve Index is SteamVR's headset there, so SteamVR needs no null driver.

1. **SteamVR.** Install Steam and SteamVR; set up the room once (Room Setup, standing or room scale: it sets SteamVR's
   floor). Pair each tracker in SteamVR (*Devices*, *Pair Controller*; each Tracker 3.0 has its own USB dongle, plugged
   into the PC). Base stations as for the Index. The roles in *Manage Trackers* do not matter to the bridge: it
   takes every tracker SteamVR tracks (leave them on *Held in hand* or another role; whether SteamVR still tracks one
   set to *Disabled* is untested).
2. **Python.** Python 3.11 or newer from python.org (tick *Add python.exe to PATH*; 3.11 keeps the rate steady on
   Windows, where an older one's sleep is too coarse for 90 a second). Then, in a terminal:
   `pip install openvr` (pyopenvr, the SteamVR bindings).
3. **Node.** Node 18 or newer (for the relay), and the repository on the PC.
   - **The certificate for `--lan`**: the relay makes it with `openssl`, which on Windows comes with Git but is not on the
     PATH: start the relay from **Git Bash**, or add `C:\Program Files\Git\usr\bin` to PATH (relay/README.md, "A
     session on one Wi-Fi"). It is made once in `relay/.lan/` for the PC's addresses, and again when they change.
   - **The firewall**: the first time the relay starts, Windows asks whether Node may accept connections: allow it on
     private networks (the relay's port, TCP 8787 by default, for the headsets on the Wi-Fi). The trackers' UDP port
     needs nothing: the relay listens for it on 127.0.0.1 only, so nothing from the network reaches it.
4. **Start them**, SteamVR first:
   ```sh
   node relay/server.mjs --lan --trackers          # the app, the rooms, and the trackers on UDP 127.0.0.1:47800
   python tools/trackers/bridge.py                 # after SteamVR: "Sending 90 readings a second ..."
   ```
   `python tools/trackers/bridge.py --list` prints what SteamVR sees (serial numbers, kinds, batteries) and stops. The
   bridge waits for SteamVR when it is not running yet, and again when SteamVR closes. Another UDP port: `--trackers
   47801` on the relay and `--port 47801` on the bridge. Both stay on the PC: the bridge sends only to 127.0.0.1, and
   the relay takes datagrams only from there.
5. **Line the room up by hand** (on a page in the room: the Shared dialog, *The PC's trackers*): turn on *Use the PC's trackers
   in this room*, lay a tracker flat on its base on spot A (the tape cross the headsets calibrate on) and press *Set
   spot A*, then the same on spot B. Each takes the tracker's position averaged over a second while it lies still (the
   relay's `/api/trackers/still`; moved more than 5 mm meanwhile, it asks again). That gives the room's frame from
   SteamVR's space, exactly as a headset's from its floor spots: the origin on the floor under spot A, x towards spot
   B. It holds while the base stations stay where they are and SteamVR's room setup is not run again; after either,
   line it up again. The two trackers are free for props and the body afterwards.
6. **Name the trackers** in the same section (a name per serial number, kept in the room), moving each to see which
   row lights up.

Battery: a Tracker 3.0 lasts about 7.5 hours; `/api/trackers` and the page's list show each one's charge.

**The Index's own page in VR** (untested): on the PC, in Chrome or Edge with SteamVR as the OpenXR runtime, open the
relay's address (the one the headsets use, or `https://localhost:8787/`, which the relay prints for the PC itself; accept
the certificate warning), join the room and press *Enter VR*. With the room using the trackers and lined up by hand (step 5), the Index lines itself up
from its head as the trackers see it (*Lined up by the PC's trackers*): no spots, no shared space, and the question
whether it is in the room is answered for it. One such page per room.

## If nothing shows

- `python tools/trackers/bridge.py --list` lists each device SteamVR sees: serial, kind (`trk`, `hmd`, `ctl`, `base`),
  `ok` or `LOST`, battery and place. A tracker missing there is SteamVR's matter: paired, switched on, in view of the
  base stations? *SteamVR does not answer*: start SteamVR first.
- The bridge's status line, every 5 s (`--quiet` drops it), says what it sends: *5 trackers (5 tracked well), the
  headset, 2 controllers, 3 base stations; 90 readings a second*. *Could not send to UDP 127.0.0.1:47800 (...)*: check
  that the relay runs with `--trackers` (UDP gives no answer, so a missing relay is not always noticed here: look at the
  relay's side too). *The openvr package is missing*: `pip install openvr`.
- The relay's start line says where it listens (*Trackers: the bridge's readings on UDP 127.0.0.1:47800 ...*), and
  `https://<address>:8787/api/ping` (with a password: `?token=<the password>` after it) says `trackers: true` and
  `trackersSeen`, the trackers the bridge has sent in the last 5 s. No `trackers` there: the relay was started without
  `--trackers`.
- The ports must match: `--trackers <n>` on the relay and `--port <n>` on the bridge (47800 when neither says).
- On Windows, `py -3 tools/trackers/bridge.py` (and `py -3 -m pip install openvr`) when `python` is not found.
- The Shared dialog shows *The PC's trackers* only for a room on this relay while its `/api/ping` says `trackers: true`:
  peer-to-peer rooms and the relays on Coolify get no trackers. In it, *Not lined up yet* means spot A and spot B are
  still to be set.

## Without the hardware

```sh
node relay/server.mjs --static . --trackers        # any computer
node tools/trackers/fake.mjs                       # or: python tools/trackers/bridge.py --fake
```

The fake sends five trackers (two lying on spot A and spot B, 2 m apart; one going round a circle; one bobbing; one on
a table), a headset, its two controllers and two base stations, in a SteamVR space turned 30 degrees and moved against
the room. Line up by hand with the first two (they lie still on the spots), and the others then appear in the room
where the fake puts them. `node tools/trackers/fake.mjs --help` lists its options (`--turn`, `--move`, `--apart`,
`--rate`, `--seconds`).

## Tests

`node relay/test.mjs` checks the relay's side with `fake.mjs` (`node relay/test.mjs --trackers` runs only those steps,
in seconds) and, when `python3` is on the machine, `bridge.py --fake` against the relay. Nobody here has SteamVR:
`bridge.py`'s real path (pyopenvr's calls, the device classes, serial numbers, hands and batteries, SteamVR closing
and coming back) is untested until it runs on the owner's PC, and so are the rate on Windows, `TRK_FLOOR` (the tracker's
pose origin over the floor when it lies on its base, 0 until measured), the lag through the relay and how steady the
lining up by hand is with real trackers.
