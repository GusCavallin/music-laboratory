# music-laboratory

Tools for exploring and working with a personal music library: search and play it in the browser, look up original
release years, genres and tempo, rate how songs *feel*, and build playlists. Everything reads your **source music library**
(a property-list file a music player exports, such as iTunes' `iTunes Music Library.xml`; it is never modified), whose location you set in
`config.json`.

## Setup

1. Copy `config.example.json` to `config.json` (it is git-ignored, so your paths stay on your machine).
2. Set `source_music_library` to the path of your library file (forward slashes work on Windows: `C:/Music/Library.xml`). Optional:
   `cd_archive_index` (a spreadsheet indexing MP3s burned on CDs, for Music Hub's archive tab) and, for the MusicBrainz
   lookups, `contact_email`.
3. Run a tool from its folder, for example `py -3 build_data.py`. The environment variables `MUSICLAB_SOURCE_LIBRARY`,
   `MUSICLAB_CD_ARCHIVE_INDEX` and `MUSICLAB_CONTACT_EMAIL` override the file.

The scripts get these settings from `musiclab_config.py` at the repo root. Python 3 is the only requirement (standard library only).

## Tools

| Folder | What |
|---|---|
| `tools/music-hub/` | **Music Hub**: search, play, rate and explore the whole library, with the Feel tabs and graphs ([README](tools/music-hub/README.md)) |
| `tools/release-years/` | Original release year per track, via MusicBrainz ([README](tools/release-years/README.md)) |
| `tools/artist-genres/` | Genre and country per artist, via MusicBrainz votes ([README](tools/artist-genres/README.md)) |
| `tools/bpm/` | Tempo index (AcousticBrainz) and a workout playlist builder ([README](tools/bpm/README.md)) |
| `tools/emotions/` | Scripts for Feel ratings (nine GEMS scales plus maturity) and the three independent axes ([README](tools/emotions/README.md)) |
| `tools/itunes-com/` | Read and set star ratings in the running desktop iTunes through COM, Windows only ([README](tools/itunes-com/README.md)) |

`AGENTS.md` and `agents/` hold instructions for AI agents working in this repo (reading the library, writing and verifying playlists, rating how songs feel).

The tools that need your own data (ratings, caches, playlists) build it from your library the first time you run them. None of it is
included here.

## License

music-laboratory is licensed under the [PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0),
with the Required Notice in the first line of [LICENSE](LICENSE).
