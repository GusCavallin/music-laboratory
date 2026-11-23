# music-laboratory

Tools for exploring and working with a personal music library: search and play it in the browser, look up original
release years, genres and tempo, rate how songs *feel*, and build playlists. Everything reads your **source music library**
(a property-list file a music player exports, such as iTunes' `iTunes Music Library.xml`; it is never modified), whose location you set in
`config.json`.

## Try it without a library

No music library needed: run `serve.bat --demo` in `tools/music-hub` (from Git Bash: `./serve.sh --demo`; Python 3 is all it needs). Music Hub opens on the
published [Feel ratings of classical recordings](data/README.md): the table, the filters, the Raw Feel sliders and the Feel Axes cube all work, and the
MP3 Archive tab shows a few made-up CDs. There is no audio and the stars cannot be changed (a highlighted "Demo data" note in the header says so); your own
data and saved views are never touched. The React version has the same option (`serve.bat --demo` in `tools/music-hub-react`, after `npm install` once).

## Setup (for your own library)

1. Copy `config.example.json` to `config.json` (it is git-ignored, so your paths stay on your machine).
2. Set `source_music_library` to the path of your library file (forward slashes work on Windows: `C:/Music/Library.xml`). In iTunes the file is
   `iTunes Music Library.xml` in your iTunes folder; it exists when *Edit → Preferences → Advanced → "Share iTunes Library XML with other applications"* is on. Optional:
   `cd_archive_index` (a spreadsheet indexing MP3s burned on CDs, for Music Hub's archive tab) and, for the MusicBrainz
   lookups, `contact_email`.
3. Run a tool from its folder, for example `py -3 build_data.py`. The environment variables `MUSICLAB_SOURCE_LIBRARY`,
   `MUSICLAB_CD_ARCHIVE_INDEX` and `MUSICLAB_CONTACT_EMAIL` override the file.

The scripts get these settings from `musiclab_config.py` at the repo root. Python 3 is the only requirement (standard library only); the React version of Music
Hub also needs Node.js, and the iTunes COM scripts need the desktop iTunes for Windows.

## Rate how your songs feel, with an AI agent

Point your AI agent at this repo and ask it to set you up: [AGENTS.md](AGENTS.md) has a "First time here?" section that makes `config.json`, checks that your library reads
correctly, and then queues a small first playlist for the agent to rate on the nine GEMS scales plus maturity. The ratings show up in Music Hub (Raw Feel and Feel Axes). They
are the agent's estimates, not measurements, and the titles and artists of the songs go to whichever AI you use. See [tools/emotions](tools/emotions/README.md).

## Tools

| Folder | What |
|---|---|
| `tools/music-hub/` | **Music Hub**: search, play, rate and explore the whole library, with the Feel tabs and graphs ([README](tools/music-hub/README.md)) |
| `tools/music-hub-react/` | **Music Hub in React and TypeScript**: the same page rebuilt slice by slice, with its own helper (`serve.bat`, port 9223) and installable as an app; runs beside the one above ([README](tools/music-hub-react/README.md)) |
| `tools/music-hub-core/` | What the Music Hub pages share: the local helper, the data builder (`data.js`) and the saved views ([README](tools/music-hub-core/README.md)) |
| `tools/release-years/` | Original release year per track, via MusicBrainz ([README](tools/release-years/README.md)) |
| `tools/artist-genres/` | Genre and country per artist, via MusicBrainz votes ([README](tools/artist-genres/README.md)) |
| `tools/bpm/` | Tempo index (AcousticBrainz) and a workout playlist builder ([README](tools/bpm/README.md)) |
| `tools/emotions/` | Scripts for Feel ratings (nine GEMS scales plus maturity), the three independent axes, queuing a playlist's unrated songs and fetching lyrics to rate from ([README](tools/emotions/README.md)) |
| `tools/itunes-com/` | Read and set star ratings, remove rated songs from a to-rate playlist and rename a playlist in the running desktop iTunes, through COM, Windows only ([README](tools/itunes-com/README.md)) |
| `data/` | **Feel ratings of classical recordings** (artist, composer, album, title, stars and the ten scales), free to use under CC BY 4.0 ([README](data/README.md)) |

`AGENTS.md` and `agents/` hold instructions for AI agents working in this repo (reading the library, writing and verifying playlists, rating how songs feel).

The tools that need your own data (ratings, caches, playlists) build it from your library the first time you run them. None of it is
included here, except the classical Feel ratings in `data/`, which are published on purpose.

## License

music-laboratory is licensed under the [PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0),
with the Required Notice in the first line of [LICENSE](LICENSE).

The data in `data/` is the exception: it is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) (see [data/README.md](data/README.md)).

## Trademarks

This project is not affiliated with or endorsed by Apple. iTunes is a trademark of Apple Inc., registered in the U.S. and other countries. Other product names are used only to say what the tools work with.
