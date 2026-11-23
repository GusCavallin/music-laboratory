# AGENTS.md — music-laboratory

Instructions for AI agents working in this repo. This file is the index; the detail is in `agents/`.

**Rule of thumb: read from the library XML, write M3U8, verify by re-reading the library XML.**

## Always

- The library XML is **read-only**. Never touch the iTunes database (`*.itl`, `*.itdb`) or the media files. Never modify anything
  outside this repo, and never overwrite the user's own exports.
- Library changes (ratings, playlists, deleting) are a dry run first and done only after the user says so.
- iTunes fails silently: after an import, verify by re-reading the library XML before reporting success.
- Machine-specific paths and settings go in `config.json` (via `musiclab_config.py`), never in code.
- Commit finished work with a short message. Branch only if asked.
- Reply briefly and honestly: what was done, what was skipped or not tested.

## First time here?

Do this once, together with the user, before anything else. Check each step and skip what is already done.

1. **Config.** `config.json` at the repo root must exist, and `source_music_library` in it must point to a file that exists. If not, ask the user for
   the path of their library file. For iTunes it is `iTunes Music Library.xml` (in their iTunes folder, usually under `Music\iTunes`); iTunes writes it only
   when *Edit → Preferences → Advanced → "Share iTunes Library XML with other applications"* is on. Copy `config.example.json` to `config.json` (it is
   git-ignored), put the path in (forward slashes work), and leave out the optional keys the user has no use for. No path or setting goes in code.
2. **Read-only check.** `py -3 tools/music-hub-core/build_data.py` reads the library and builds `data.js`, printing the track and playlist counts. Show
   the user the numbers and ask whether they look right before going on. It never changes the library.
3. **Look around.** `tools/music-hub/serve.bat` opens Music Hub on their library (`serve.bat --demo` shows it on the published classical ratings).
4. **Feel ratings, if the user wants them.** Read `agents/RATING-FEEL.md`. Tell the user that the titles and artists of the songs go to the AI
   doing the rating, and that the ratings are estimates. Then start small: ask for a playlist of 20 to 50 songs they know well, list its unrated songs
   (`py -3 tools/emotions/queue_playlist.py "Name" --dry-run`), and queue them only after they agree. Rate them in a batch, run `merge.py`, and ask the
   user to click **Refresh data** in Music Hub. The scripts make their own data files on the first run.

## Components

| File | Read when |
|---|---|
| `agents/CORE.md` | always: rules, boundaries, repo layout and git |
| `agents/READING-LIBRARY.md` | reading the library XML (format, keys, gotchas, TXT fallback) |
| `agents/WRITING-PLAYLISTS.md` | writing a playlist file (M3U8 and the alternatives, naming, MP3 CDs) |
| `agents/IMPORT-VERIFY.md` | after the user imports a playlist |
| `agents/DATA-INDEXES.md` | anything about years, genres or tempo |
| `agents/RATING-FEEL.md` | rating how songs feel (the nine GEMS scales and maturity) |
| `agents/CHECKLIST.md` | before replying |
