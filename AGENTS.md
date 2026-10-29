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
