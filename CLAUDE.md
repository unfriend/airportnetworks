# CLAUDE.md

@AGENTS.md

## Notes for Claude Code

**Warning: Claude Code runs without asking here.** This repository's `.claude/settings.json` allows every command, file
edit, web fetch and agent without a permission prompt (the owner, 14 November 2026, for a cloud machine used only by
Claude). Anyone who runs Claude Code on their own computer with this repository gets the same. If you do not want that,
delete or edit `.claude/settings.json` (or override it in your own `.claude/settings.local.json`) before you start.

At the start of a session on a machine that is not the owner's cloud machine, tell the person about this warning once,
so they can decide.

**No approval prompts** (the owner, 18 November 2026). In a cloud session the owner keeps *Auto* mode; even so, Auto
still asks before deletions, force pushes and similar risky commands, whatever `.claude/settings.json` allows. So this
session and every agent and workflow it starts avoid them, and every agent prompt says so:

- No `rm`, `rm -rf`, `unlink`, `git clean`, `git reset --hard`, `git push --force`, `git branch -D`, `git worktree
  remove --force` or `git checkout -- <file>` that throws work away. Leave clean-up for the person, or say what is left.
- Temporary files go in the scratchpad (or another git-ignored place), never in the tree, so nothing has to be deleted
  before a commit. `node_modules` (folder or symlink) and `.claude/worktrees/` are git-ignored for this: a worktree's
  `ln -s /opt/node22/lib/node_modules node_modules` may stay.
- A background server or test is stopped by letting it end (`timeout <s> ...`), not by killing it afterwards.
- If a prompt still comes, find which command caused it and add a line here so the next session avoids it too.
- `node tools/notes/notes.mjs done <id>` (marking a developer note done) is refused by Auto mode as an unwanted
  action: leave notes for the owner to mark done on the notes page, and say which ones are handled.

- A cloud session starts with the checkout brought up to date by `.claude/hooks/session-start.sh` (its line *Checkout
  (session-start hook): ...* comes first). If it says behind, diverged or could not fetch, merge GitHub's branch before
  working, as the line says (`git fetch origin <branch> && git merge origin/<branch>`, the branch it names; no rebase,
  no force push).
- Read `AGENTS.md` (imported above) first: it is the core (structure, rules, conventions, testing). The details are in
  `docs/agents/`, read on demand; `docs/history.md` says why rules are as they are.
- New features document themselves in the matching `docs/agents/` file (and the tool's `SPEC.md` where one exists).
  `AGENTS.md` gets at most a line per feature and stays under 70 KB; this file stays short.
- The story files are large (`stories/airports.js` is ~640 KB because of its embedded data). Search with Grep and read
  line ranges; never read them whole. The same for the `docs/agents/` files.
- Prefer small, exact edits. When a change touches the headset code, apply it to all sixteen stories: their XR, panel
  and landing-screen code is meant to stay identical apart from story-specific panes.
- Verify visual changes by serving the folder and taking headless Chromium screenshots (hashes such as `#spatial&t=60`
  jump straight to a moment). Report anything that can only be checked on a real headset as untested.
- When the test suites run (the owner, 7 November 2026: "only running when pushing to main makes sense for now"): the
  full suites (smoke, relay, shared rooms, and update, live, sound and room test where a change touches them) run only
  before `main` moves. A push to `dev` gets the cheap checks only: `node --check` on the changed files, the builds'
  `--check`, and `node tools/release.mjs --check`; no smoke test or shared-room run, and a red result is not chased on
  `dev`. Every "run ... after touching" line in `AGENTS.md` and `docs/agents/` names what goes into that release run.
  Why: running is free (CPU), but chasing red results costs tokens, and most were the tests' own or the machine's.
- After any change to app files, bump `VERSION` in `sw.js`. After changing `sw.js` or how files load, run
  `tools/update.mjs`.
- Releasing: after the `VERSION` bump, run `node tools/release.mjs` (it writes `version.json` and stamps the shell's
  release into `index.html`; commit both; `--check` says whether they are current), and rewrite `whatsnew.json` by hand
  for the release (developer mode's box: what is new, what to test, what is untested; `--check` fails while it names
  another release). Running pages take a release from it. The list of stories is `stories/list.js`. After touching
  `HOST.live`, `HOST.swap`, `HOST.load`, the release script or the relay's `--watch`, run `node tools/live.mjs`; a swap
  in a headset and the update panel there are untested until tried on one.

## Hard rules

- Never put the owner's own scene files (models, textures, sounds, layouts) in the repository, not even as tests.
- Never show patient or variant data.
- Stories never create or close an `AudioContext`: sound is the shell's (`HOST.audio`).
- Built files are edited in their sources and rebuilt (commit both; `--check` says when they are out of step):

| Built file | Source | Build |
| --- | --- | --- |
| `stories/lbi.js`, `nmd.js`, `endo.js`, `pet.js`, `micro.js`, `ovary.js`, `qubits.js`, `mutation.js`, `topo.js`, `soil.js`, `pass.js`, `flock.js`, `robots.js`, `tutorial.js`, `design.js`, `studio.js` | `tools/<key>/` | `node tools/<key>/build.mjs` (after a shared engine part in `tools/engine/`: `node tools/engine/all.mjs`) |
| `lowpoly.js` | `tools/lowpoly/` | `node tools/lowpoly/build.mjs` |
| `examples/bliss-xp` | `tools/studio/xp/` | `node tools/studio/xp/make.mjs` |
| `tools/studio/test/scenes/` | `tools/studio/test/make.mjs` | the same, then `node tools/studio/scan.mjs tools/studio/test/scenes --check` |
| `version.json` | `sw.js` `VERSION` | `node tools/release.mjs` |
| `docs/narration.md` | the running stories | `node tools/narration.mjs` |

## Where the details are

- Sound, the two engines, the hum, the watchdog, effects, mute and narration defaults, headset settings, anchors,
  stick moving, synthetic narration, `--watch` while developing: `docs/agents/shell.md`.
- Shared rooms, their hooks in every story, smoothing, peer to peer, the PC's trackers: `docs/agents/shared-rooms.md`.
- Each built story's sources, data and rules (spelling, permissions, hedges): `docs/agents/stories.md`.
- The studio, its scenes, uploads and the Bliss XP room: `docs/agents/studio.md`.
- Every test and what it checks: `docs/agents/testing.md`.
- Every file and folder: `docs/agents/layout.md`.

## Keeping token use down

Follow "Working economically" in `AGENTS.md`. In particular:

- Ask for (or read) a token budget before large work, and say roughly what a
  multi-agent run will cost before starting one. Ultracode or other
  "exhaustive" modes are for showpiece work, not routine changes.
- Models (the owner, 15 November 2026: "opus is used for planning and code and
  sonnet for the cheaper part"; 23 November 2026: the default is Fable, for narration only): the main conversation
  runs on Fable (`"model": "fable"` in `.claude/settings.json`). It writes and rewrites narration (a story's spoken
  script) itself, talks with the owner and hands everything else over unless the owner says otherwise: planning,
  building, integrating and fixing code go to sub-agents and workflow agents with `model: 'opus'` (a larger job to
  one Opus agent that integrates and reports back, so the main conversation reads reports, not code); reviewing,
  verifying, running tests, sweeping screenshots, measuring, extracting data and writing docs go to `model: 'sonnet'`
  (or `'haiku'` for mechanical checks), at low or medium effort. No agent but the main conversation runs on Fable
  unless the owner asks for it.
- One critique and one fix round; batch verification; only high-severity
  findings get verified.
- In the main conversation, view screenshots as small contact sheets, read line
  ranges with Grep/Read instead of whole files, and delegate broad searches.
