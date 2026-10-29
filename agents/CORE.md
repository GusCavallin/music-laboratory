# Core rules

This repo holds code and generated output for a personal music library (iTunes for Windows): playlists that agents generate
(by mood, composer, ratings, play history, etc.) for the user to import into iTunes, plus analysis tools and small toys built on
the library.

**Rule of thumb: read from the library XML, write M3U8, verify by re-reading the library XML.**
Reading and writing are deliberately asymmetric: use the richest source to read and the simplest format to write.

## Boundaries

- The library XML is **read-only**. Never touch the iTunes database (`*.itl`, `*.itdb`) or the media files.
- Never modify, rename or "clean up" anything outside this repo. Inside it, don't overwrite the user's own exports (`exports\`).
- Anything that changes the library itself (ratings, playlists, deleting) is shown as a dry run first and done only after the
  user says so.
- **iTunes fails silently.** Never report success from the file you wrote; verify by re-reading the library (`IMPORT-VERIFY.md`).
- Report honestly: say what was skipped, what was a judgement call and what was not tested.

## Repo layout and git

- `playlists\` generated playlist files · `exports\` manual iTunes exports · `tools\<name>\` scripts and their data ·
  `games\<name>\` self-contained pages.
- Each tool folder has its own `README.md`. Outputs derived from the library that can be regenerated (e.g. `release_years.csv`,
  `data.js`) are git-ignored. Caches that are costly to rebuild (e.g. `mb_cache.json`) are kept, and never deleted.
- **Machine-specific paths and settings go in `config.json`, never in code.** A new script imports `SOURCE_LIBRARY` from
  `musiclab_config` (see its docstring) instead of writing the library path; `config.json` is git-ignored and
  `config.example.json` is committed.
- Commit when a piece of work is done, with a short message saying what changed. Branch only if asked.
- Keep the root `README.md` in step when a folder is added.

## Components

Read what the task needs:

| File | When |
|---|---|
| `READING-LIBRARY.md` | any task that reads the library |
| `WRITING-PLAYLISTS.md` | any task that makes a playlist file |
| `IMPORT-VERIFY.md` | after the user imports a playlist |
| `DATA-INDEXES.md` | years, genres or tempo |
| `RATING-FEEL.md` | rating how songs feel |
| `CHECKLIST.md` | before replying |
