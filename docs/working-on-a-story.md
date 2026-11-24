# Working on your story

For a story's author who is not the app's maintainer. Written for the CDK5 story, *The switch that sticks*
(`packages/cdk5/`), but it works the same for any story package: put its key where this page says `cdk5`.

You edit your story, look at it on your own computer, and publish it with one command. A minute or two later it is on
the test site, **https://stories.lab.lbi-netmed.com/#cdk5**, on every computer, phone and headset. The main site
(stories.lbi-netmed.com) only changes when the maintainer moves the test site's version there.

## What you need

- **git** (https://git-scm.com) and **Node.js 20 or newer** (https://nodejs.org). Nothing else for most changes: no
  `npm install`, no build tools.
- The right to push to the repository on GitHub (the maintainer gives it). The first time you push, git asks you to sign
  in to GitHub.
- Optional: Playwright, so the command can also open your story in a hidden browser and check it plays
  (`npm i --no-save playwright` and `npx playwright install chromium` in the repository's folder). Without it, the
  command still checks everything else and says that it skipped this.

## Getting the repository

```sh
git clone https://github.com/unfriend/airportnetworks.git
cd airportnetworks
git switch dev
```

You always work on the branch `dev`. Tell git your name once, if you never have:

```sh
git config --global user.name "Your Name"
git config --global user.email "you@example.org"
```

## Where things are in your story

Everything of yours is in `packages/cdk5/`. The parts you edit are in `packages/cdk5/src/`:

| What | Where |
| --- | --- |
| The chapters: their text, what the voice says, when each line appears, the camera | `src/engine/e3_story.js` |
| Explore mode: the tabs Scenes, Proteins, Diseases and About | `src/engine/e4_explore.js` |
| The 3D pieces: the network (`net.js`), the close-up at the centre (`core.js`), the colours (`look.js`) | `src/sets/` |
| The data (`sets/data.js`) | made by `src/data/gen_data.py` from a clone of CDK5_data; never edit it by hand (see below) |
| The protein structures | listed in `src/models.json`, made into `packages/cdk5/models/` by `tools/mol/` (see below) |
| The story's card: title, description, length | `packages/cdk5/story.json` |

`src/README.md` says more about each file, and `src/SPEC.md` what the story must do.

Two words used below: a **key point** is a line on the story's panel; **`data-say`** is what the voice says for it (it
may be worded differently from the panel).

## The loop

1. **Edit** a file in `packages/cdk5/src/`.
2. **Preview** on your computer. Start this once, in the repository's folder, and leave it running:

   ```sh
   node relay/server.mjs --static . --watch --build
   ```

   Open **http://localhost:8787/#cdk5**. Each time you save a file in `src/`, the story is built again and the page
   swaps it in by itself within a second or two, at the same place in the story. If a save shows nothing new (it can
   happen on Linux with some editors), stop the command with Ctrl+C and start it again. To see it in a headset on the
   same Wi-Fi, start it with `--lan` added and open the address it prints in the headset's browser (it warns about the
   certificate once).
3. **Publish**, in a second terminal, in the repository's folder:

   ```sh
   node tools/packages/publish.mjs cdk5 "One sentence on what you changed." --test "What to look at."
   ```

   It builds the story, runs its checks, saves your change in git (a *commit*), takes in what others published
   meanwhile, and sends it to GitHub. `--test` is optional. To try everything without sending anything, add `--dry`.
4. **Look at the test site** after a minute or two: https://stories.lab.lbi-netmed.com/#cdk5 (reload the page). A page
   that is already open takes the new version by itself within about a minute.
5. **In a headset**, reload the page (or open the story again from the Stories screen).

## What not to touch

- `packages/cdk5/main.js` is built from `src/`; never edit it. The command builds it.
- `src/sets/data.js` is made by the generator; never edit it by hand.
- Anything outside `packages/cdk5/`. The command refuses to publish when files outside it are changed and lists them,
  so you cannot change the rest of the app by accident. If you did not mean to change them, ask the maintainer.
- Never add the authors' raw files, patient data or anything personal to the repository; only derived numbers go in.

The rules from the app's guide (`AGENTS.md`) that matter for your story:

- Never show patient or variant data.
- Never lay out the authors' networks again in the app: every layout, colour and link is the authors' own, read from
  their data.
- Keep the scientific wording careful: "in this map" for numbers computed on these data, and keep the caveats that are
  there (for example that well-studied proteins have more known partners). The one link the authors added, CDK5 to
  calpain, is not an interaction of the interactome, and the story says so.
- No 2D charts as chapters: things in 3D that move, grow or stand in the room.
- British spelling. The voice speaks like a scientist talking to a general audience: short spoken sentences, "we" and
  "you", round numbers.

## What needs the maintainer, or extra set-up

- **New spoken words.** If you change what the voice says (a `data-say`, a key point, a heading), the recording no
  longer matches. The command tells you, and still publishes: the test site then shows your new text with the old
  voice. A new recording needs the synthetic voice (Kokoro) set up, as `tools/voice/README.md` describes; then
  `node tools/voice/narrate.mjs cdk5` with the preview running, and `node tools/voice/check.mjs cdk5 --quick`. Or ask the
  maintainer to record it.
- **New data.** `src/data/gen_data.py` needs a clone of CDK5_data and a Python with numpy, Pillow, scipy and
  scikit-learn; the command is in `src/README.md`.
- **New protein structures.** `tools/mol/` needs its own Python set-up (`tools/mol/README.md`).
- **Anything in the app itself** (the menu, the headset controls, other stories): ask the maintainer.

## When the command stops

It stops at the first problem and says what it is. The usual ones:

- *"files outside packages/cdk5/ are changed"*: you (or a tool) changed something else. If it was not on purpose, ask
  the maintainer how to put it back. Nothing was published.
- *"the story's build failed"* or *"the story's own test failed"*: the lines above it say which file and line. Fix it
  (the preview shows the same problem), then run the command again.
- *"someone else changed the same lines as you on GitHub"*: your change is saved in a commit on your computer, not
  lost, but not sent. Ask the maintainer to combine the two; then run the command again.
- *"could not reach GitHub"* or *"GitHub did not take the change"*: check the internet connection and that you can sign
  in to GitHub; if it says you may not have the right to push, ask the maintainer. Your change is kept on your computer.
- *"the release step ..."* or *"the release check failed"*: the app itself has unfinished changes of the maintainer's.
  Not your doing: ask the maintainer.

## On your own fork

The way for colleagues who write a story of their own (the owner, 24 November 2026: "they fork it ... and i pull it on
once it is ready"). You need no right to push to the app's repository: you work on your own copy on GitHub, show it at
your own address, and the maintainer takes your story over when you say it is ready. Not yet tried by anyone from start
to finish: tell the maintainer where it goes wrong.

1. **Fork** https://github.com/unfriend/airportnetworks on GitHub (*Fork*, top right). **Untick "Copy the `main` branch
   only"**: you need the branch `dev`. `main` is the released app and can be many versions behind; a story started
   there does not fit the app as it is now.
2. **Clone your fork** and work on `dev`, as above, with your own address:

   ```sh
   git clone https://github.com/<you>/airportnetworks.git
   cd airportnetworks
   git switch dev
   git remote add upstream https://github.com/unfriend/airportnetworks.git
   ```

3. **A new story** starts from the template: `tools/packages/SPEC.md` says how (`tools/packages/template/` is a
   package's `src/`; `packages/hello/` is a finished small example). An existing one is in `packages/<key>/`.
4. **Publish as this page says** (`node tools/packages/publish.mjs <key> "<what changed>"`). On a fork it sends to your
   own `dev`, not to the app's.
5. **Your own address.** In your fork on GitHub: *Settings*, *Pages*, *Deploy from a branch*, branch `dev`, folder `/`.
   A few minutes later your copy is at `https://<you>.github.io/airportnetworks/#<key>`, on a computer, a phone and a
   headset. Shared rooms there are untested (your copy has no relay of its own).
6. **Keep up with the app**, every week or so and always before you say it is ready, so your story runs on the app as
   it is now:

   ```sh
   git fetch upstream dev
   git merge upstream/dev
   ```

   If git reports a conflict only in generated files (`packages/index.json`, `version.json`), take the app's copy
   (`git checkout --theirs <file>`, `git add <file>`, `git commit`) and run the publish command again: it writes them
   anew. A conflict anywhere else means you changed something outside your story: ask the maintainer.
7. **When it is ready**, tell the maintainer your fork's address and your story's key (or open a pull request from your
   `dev` to the app's `dev`). The maintainer takes your `packages/<key>/` folder only: changes outside it are left
   behind, so keep to "What not to touch" above.

The maintainer's side: `git fetch https://github.com/<them>/airportnetworks.git dev`, then
`git checkout FETCH_HEAD -- packages/<key>` on `dev`, a line for a new key in `packages/order.json`, and
`node tools/packages/publish.mjs <key> "<what changed>"`, which builds it against the app as it is now, checks it and
puts it on the test site. It goes to the main site with the next release, as every story does.

## If you use Claude Code

This repository's `.claude/settings.json` lets Claude Code run every command and edit every file without asking you
(the owner set it up for a cloud machine). If you do not want that on your own computer, decide before you start: put
your own rules in a new file `.claude/settings.local.json` (it wins, and the publish command never sends it), rather
than editing `.claude/settings.json` (a change there would make the command refuse to publish). Tell Claude Code to work
only in `packages/cdk5/` and to publish with the command above.
