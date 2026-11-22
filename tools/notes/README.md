# Developer notes: the page and the tool

A note is a voice recording with pictures, pins and context, kept on the relay (`tools/notes/SPEC.md`).

## The page

Open `<relay>/notes/` (for example `https://stories.lab.lbi-netmed.com/notes/`). It asks once for the relay's password
and keeps it on that device. Notes are listed newest first (New, Done, All) and refresh every 15 s. Open a note to
listen, see its two pictures (press one to enlarge), follow the transcript's and the pins' times, then Mark done,
Copy as Markdown (paste it to Claude Code) or Delete (press twice within 3 s). A closed note has Open, Mark done (or Mark new) and Delete beside each
other, so it can be handled without opening it; *Mark all done (n)* in the header marks every new note the list shows
done, after a second press within 3 s. `?relay=https://...` picks another relay.

## The tool

```sh
export NOTES_TOKEN=<the relay's password>        # never printed or written
export NOTES_RELAY=https://stories.lab.lbi-netmed.com   # the default
node tools/notes/notes.mjs list [--all]
node tools/notes/notes.mjs pull <id|new> [--out dir]          # note.json, audio, pictures, note.md
node tools/notes/notes.mjs transcribe <id|new> [--model small] # then prints note.md
node tools/notes/notes.mjs done <id>
node tools/notes/notes.mjs perf <run id>                       # a run log's table: per chapter, the 10 worst seconds
```

Run logs (developer mode, *Record a run* on the headset menu's Debug tab or the small button over the note button) are
listed by `list` and on the page under the notes; `pull <run id>` writes `log.json` and `perf.txt`.

`transcribe` runs `tools/notes/transcribe.py` (faster-whisper, CPU, English or German found by itself). It uses
`uv run` when `uv` is there, else `python3 -I` with `pip install faster-whisper`; ffmpeg support comes with the package.
