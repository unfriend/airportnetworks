# CLAUDE.md

@AGENTS.md

## Notes for Claude Code

- Read `AGENTS.md` (imported above) first; it is the single source of truth
  for structure, conventions and testing. Update it, not this file, when the
  architecture changes.
- The story files are large (`stories/airports.js` is ~640 KB because of its
  embedded data). Search with Grep and read line ranges; never read them whole.
- Prefer small, exact edits. When a change touches the headset code, apply it
  to all four stories: their XR, panel and landing-screen code is meant to
  stay identical apart from story-specific panes.
- Verify visual changes by serving the folder and taking headless Chromium
  screenshots (hashes such as `#spatial&t=60` jump straight to a moment), and
  run `node tools/smoke.mjs` before committing. Report anything that can only
  be checked on a real headset as untested.
- After any change to app files, bump `VERSION` in `sw.js`. After changing
  `sw.js` or how files load, run `tools/update.mjs` (see Testing in `AGENTS.md`).
- Sound belongs to the shell (`HOST.audio` in `index.html`); stories never
  create or close an `AudioContext`. Keep both engines, the hum and the
  watchdog (see the sound notes in `AGENTS.md`): each guards against a way the
  narration went silent on the Quest. After touching sound, run
  `node tools/audio.mjs` as well as the smoke test, and report audible output
  on a headset as untested (Sound check is the on-device tool).
- `stories/lbi.js` is built from `tools/lbi/`: edit there and run
  `node tools/lbi/build.mjs`.

## Keeping token use down

Follow "Working economically" in `AGENTS.md`. In particular:

- Ask for (or read) a token budget before large work, and say roughly what a
  multi-agent run will cost before starting one. Ultracode or other
  "exhaustive" modes are for showpiece work, not routine changes.
- Sub-agents and workflow agents that review, verify, sweep screenshots or
  extract data get `model: 'sonnet'` (or `'haiku'` for mechanical checks) and
  low or medium effort; keep the strongest model for building and integration.
- One critique and one fix round; batch verification; only high-severity
  findings get verified.
- In the main conversation, view screenshots as small contact sheets, read line
  ranges with Grep/Read instead of whole files, and delegate broad searches.
