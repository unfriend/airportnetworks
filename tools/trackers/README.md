# The PC's Vive trackers in the rooms

Vive Tracker 3.0s (with SteamVR and its base stations) placed in a shared room: their poses go to every headset and
page there, lined up with the room, for props that follow a tracker and a character worn by a performer (the studio).
The contract between the parts is [SPEC.md](SPEC.md). Here: how to set it up on the Windows PC, and what each file is.

Browsers cannot read the trackers (WebXR has no tracker API; SteamVR solves their poses itself), so a small helper on
the PC reads them from SteamVR and hands them to the relay on the same PC, which serves the app and the room:

```
trackers, base stations, the Index  ->  SteamVR  ->  bridge.py  --UDP 127.0.0.1:47800-->  relay --trackers  ->  the room
```

| file | what it is |
| --- | --- |
| `bridge.py` | the bridge: Python 3 and the `openvr` package, reads every device's pose from SteamVR about 90 times a second and sends it to the relay (`--fake`: made-up devices, no SteamVR) |
| `fake.mjs` | a fake bridge in Node (no packages): the same datagrams, made up, for the tests and for trying the rooms' side without the hardware |
| `SPEC.md` | the plan and the contracts (the datagrams, the relay's endpoints, the room's key `trk`, the `@trk` message) |

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
4. **Start them**, SteamVR first:
   ```sh
   node relay/server.mjs --lan --trackers          # the app, the rooms, and the trackers on UDP 127.0.0.1:47800
   python tools/trackers/bridge.py                 # after SteamVR: "Sending 90 readings a second ..."
   ```
   `python tools/trackers/bridge.py --list` prints what SteamVR sees (serial numbers, kinds, batteries) and stops. The
   bridge waits for SteamVR when it is not running yet, and again when SteamVR closes. Another UDP port: `--trackers
   47801` on the relay and `--port 47801` on the bridge. Both stay on the PC: the bridge sends only to 127.0.0.1, and
   the relay takes datagrams only from there.
5. **Line the room up by hand** (on a page in the room: the Shared dialog, *Trackers*): turn on *Use the PC's trackers
   in this room*, lay a tracker flat on its base on spot A (the tape cross the headsets calibrate on) and press *Set
   spot A*, then the same on spot B. Each takes the tracker's position averaged over a second while it lies still (the
   relay's `/api/trackers/still`; moved more than 5 mm meanwhile, it asks again). That gives the room's frame from
   SteamVR's space, exactly as a headset's from its floor spots: the origin on the floor under spot A, x towards spot
   B. It holds while the base stations stay where they are and SteamVR's room setup is not run again; after either,
   line it up again. The two trackers are free for props and the body afterwards.
6. **Name the trackers** in the same section (a name per serial number, kept in the room), moving each to see which
   row lights up.

Battery: a Tracker 3.0 lasts about 7.5 hours; `/api/trackers` and the page's list show each one's charge.

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
