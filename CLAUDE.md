# CLAUDE.md

@AGENTS.md

`AGENTS.md` (imported above) is the core: structure, rules, conventions, testing. This file adds only what is
particular to Claude Code. Keep it short.

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
- `node tools/notes/notes.mjs done <id>` (marking a developer note done): the session marks a note done once its
  change is pushed to `dev`, and says which ones it marked (the owner, 25 November 2026). A note that is only
  discussed, or whose fix is not pushed, stays new. Sub-agents still leave notes alone: the main conversation marks
  them.

**Working with agents**

- Builders started with the Agent tool cannot start agents of their own: the main conversation starts the review
  itself when the builder reports, then one fix round.
- Sub-agents may not write report files with the Write tool: they return their findings as text (working notes
  appended with a shell redirect in the scratchpad survive a cut-off).
- While a builder is still running, its uncommitted files are its own work in progress: do not commit them because the
  stop hook asks (say that they are a running builder's). Two agents in one checkout: each commits its own files by
  explicit path, and only one of them touches `sw.js`, `version.json`, `whatsnew.json` and `index.html`.
- A release under review is pushed once its review and fix round are in, not before, so the test site does not take a
  version that changes again under the same number.

**The machine and the checkout**

- A cloud session starts with the checkout brought up to date by `.claude/hooks/session-start.sh` (its line *Checkout
  (session-start hook): ...* comes first). If it says behind, diverged or could not fetch, merge GitHub's branch before
  working, as the line says (`git fetch origin <branch> && git merge origin/<branch>`; no rebase, no force push).
- The synthetic voice is rendered in the cloud session too (the owner, 25 November 2026): a fresh cloud machine has no
  Kokoro, but `tools/voice/README.md`'s "Setup (once)" takes a few minutes there (`~/kokoro`, outside the repository).
  Never hand a render to the owner because the tool "is not here"; set it up, render, and report the recording as
  unheard.

**Reading and checking**

- The story files and `shared.js`, `index.html`, `tools/smoke.mjs`, `tools/collab.mjs` and the `docs/agents/` files are
  large (up to 2 MB; some lines are hundreds of kilobytes of data). Search with Grep and read line ranges; never read
  them whole. `docs/narration.md` and `docs/props.md` are print-outs: Grep them, do not open them.
- The `docs/agents/` files open with a generated table of contents: read it, then one line range; run
  `node tools/docs/toc.mjs` after editing one. `docs/history/` is the old, longer text: Grep it, never read it whole.
- Prefer small, exact edits.
- Verify visual changes by serving the folder and taking headless Chromium screenshots (hashes such as
  `#spatial&t=60` jump straight to a moment). Report anything that can only be checked on a real headset as untested.

## Models and token use

Follow "Working economically" in `AGENTS.md`, and:

- Ask for (or read) a token budget before large work. Ultracode or other "exhaustive" modes are for showpiece work,
  not routine changes.
- Models (the owner, 15 November 2026: "opus is used for planning and code and sonnet for the cheaper part"; 23
  November 2026: the default is Fable, for narration only; 26 November 2026: "do everything possible with opus and only
  the parts that are really smart with fable"): the main conversation runs on Fable (`"model": "fable"` in
  `.claude/settings.json`). It writes and rewrites narration (a story's spoken script) itself, talks with the owner and
  hands everything else over unless the owner says otherwise: planning, building, integrating and fixing code go to
  sub-agents and workflow agents with `model: 'opus'` (a larger job to one Opus agent that integrates and reports back,
  so the main conversation reads reports, not code); reviewing, verifying, running tests, sweeping screenshots,
  measuring, extracting data and writing docs go to `model: 'sonnet'` (or `'haiku'` for mechanical checks), at low or
  medium effort. No agent but the main conversation runs on Fable unless the owner asks for it; many Fable agents at
  once reach the five-hour limit within minutes.
- In the main conversation, view screenshots as small contact sheets and delegate broad searches.
