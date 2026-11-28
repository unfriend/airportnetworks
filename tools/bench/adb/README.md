# The headset bench's adb helper

For the owner's computer (Windows, macOS or Linux; Node 22, no packages). Bench mode works without it: the page and
the relay are enough, and a person enters AR once by hand. With the helper, the headset also gets Enter AR pressed again
after every page load (a new shell version among them), its own frame statistics (the `VrApi` log lines) attached to each
bench job, device screenshots, and is kept awake. The design is `tools/bench/SPEC.md`, section 9.

```
node tools/bench/adb/adb.mjs [check|wake|open|enter|stats|shot|watch] [options]
```

| Command | Does |
| --- | --- |
| `check` (the default) | finds the headset, its battery, the browser's DevTools, the bench page's phase, and the relay's bench |
| `wake` | keeps the headset awake until Ctrl+C, then puts that back |
| `open` | opens `<site>#dev=on&bench=on&benchxr=ar` in Quest Browser |
| `enter` | presses the page's `#benchEnter` once with a real input event and says what happened |
| `stats` | reads the `VrApi` lines for `--sec` seconds (default 30) and prints one Markdown table |
| `shot` | a device screenshot (the capture service, else `screencap`), saved to `--out` or the temporary folder |
| `watch` (or `--watch`) | all of it until Ctrl+C: awake, open, Enter after every load, the relay's `to: 'adb'` jobs, statistics onto every bench job |

Options: `--site <url>` (default the test place, `https://stories.lab.lbi-netmed.com/`), `--relay <url>` (default
`NOTES_RELAY`, else the site's origin), `--serial <s>`, `--adb <path>` (adb itself; a `.mjs` file is run with Node, as
the test's stand-in is), `--xr ar|vr`, `--no-awake`, `--once`, `--sec <n>`, `--out <file>`, `--press-gap <s>` (default
15). The relay's password comes from `NOTES_TOKEN` only, and is never printed, logged, written or put in an address.

Exit: 0 fine, 1 an error or usage, 2 the relay refused, 3 no headset (none, several, not allowed, no adb), 4 not entered.

What it evaluates in the page: exactly `HOST.bench && HOST.bench.state()` and the `#benchEnter` rectangle (SPEC 9.1),
nothing else. A JavaScript dialog on the page is reported and never answered.

Keeping awake: one table, `AWAKE` in `adb.mjs`, with where each command comes from. A refused command is said once and
the rest carries on; none changes a stored setting.

## The ten-minute first try

On the computer, in the checkout, with the Quest on a USB data cable and developer mode on for it (Meta Horizon app:
Devices, Headset settings, Developer mode):

1. `adb devices -l` lists one line ending `model:Quest_3 ...` with `device`. If it says `unauthorized`, put the headset
   on and allow USB debugging (tick *Always allow*). No line: another cable or port, developer mode on.
2. `node tools/bench/adb/adb.mjs check`: *Headset: <serial> (Quest_3)*, the battery, and *No bench page yet: ...*
   (Quest Browser closed, or not on the test site). Exit 3 with a plain sentence otherwise; do what it says.
3. `node tools/bench/adb/adb.mjs open`: *Opened https://stories.lab.lbi-netmed.com/#dev=on&bench=on&benchxr=ar in
   Quest Browser.* The headset's browser shows the test site with the bench bar.
4. `node tools/bench/adb/adb.mjs check` again: *Bench <id> is enter (no session), networks-v232.* If it says *held: the
   relay wants its password*, put the headset on, enter the relay's password in the menu once, take it off.
   *Quest Browser offers no DevTools socket*: the browser is not running; step 3 again.
5. `node tools/bench/adb/adb.mjs enter`: *Pressed Enter AR: the page is in AR (a trusted press).* If it says the browser
   may be asking a question, put the headset on, allow AR for the site once, and run `enter` again. If it says *the
   press did not reach the page* or the page could not start the session, write down the message: that is the
   SPEC's first open risk (section 12), and a person enters AR by hand meanwhile.
6. `node tools/bench/adb/adb.mjs stats --sec 20` while in AR: a table of fps, stale frames, levels, loads and temperature.
   *No VrApi lines*: the browser logs none on this system version (SPEC 12); everything else still works.
7. `node tools/bench/adb/adb.mjs shot`: a picture's path; open it (may be black for an immersive page).
8. `NOTES_TOKEN=<the relay's password> node tools/bench/adb/adb.mjs --watch` (Windows PowerShell:
   `$env:NOTES_TOKEN='<password>'; node tools/bench/adb/adb.mjs --watch`): *Keeping the headset awake*, the bench's
   phase, and *Pressed Enter AR ...* whenever the page loads. Leave it running; the cloud's `node tools/bench/bench.mjs
   status` lists the helper as seen.
9. From the cloud: `node tools/bench/bench.mjs send report`, then `run picking`: the watch prints *Frame statistics
   attached to job ...* a few seconds after each job ends.
10. Ctrl+C: *The headset may sleep again as it is set to.*

## Its test

`node tools/bench/adb/test.mjs [--tmp <folder>]`: no headset. A stand-in adb (`shim/adb.mjs`, behind an executable `adb`
the test writes into its temporary folder; on Windows it is given as `--adb shim/adb.mjs`), a headless Chromium with a
remote-debugging port in place of Quest Browser's DevTools, a stand-in relay and a stand-in bench page. It checks no
device, two devices, unauthorised, not a Quest, no adb; the address in single quotes; a trusted press and the session
(stand-in); no WebXR; a permission question that never resolves; a dialog box; the password question; watch: Enter
again after a reload, the helper's own job (devshot, vrapi), statistics of three line shapes with unreadable lines
attached to a page job and none to `adb: false`; Ctrl+C putting the awake setting back; the password in no output, adb
command or address. Everything only the Quest can show stays untested.
