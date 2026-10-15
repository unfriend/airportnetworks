# CLAUDE.md

@AGENTS.md

## Notes for Claude Code

- Read `AGENTS.md` (imported above) first; it is the single source of truth
  for structure, conventions and testing. Update it, not this file, when the
  architecture changes.
- The story files are large (`stories/airports.js` is ~640 KB because of its
  embedded data). Search with Grep and read line ranges; never read them whole.
- Prefer small, exact edits. When a change touches the headset code, apply it
  to all three stories: their XR, panel and landing-screen code is meant to
  stay identical apart from story-specific panes.
- Verify visual changes by serving the folder and taking headless Chromium
  screenshots (hashes such as `#spatial&t=60` jump straight to a moment), and
  run `node tools/smoke.mjs` before committing. Report anything that can only
  be checked on a real headset as untested.
- After any change to app files, bump `VERSION` in `sw.js`.
