# Changelog

Notable changes to Music Laboratory. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions are
`MAJOR.MINOR.PATCH`: a patch fixes something, a minor adds or improves something.

## Unreleased

## 0.5.0 - 2026-11-20

Music Hub columns can be resized, a Track cell says it in words, and the Album and Track sorts handle compilations and multi-disc albums. Screenshots are in the READMEs. After updating, reload Music Hub; restart the React helper (`serve.bat`) so it rebuilds the page.

### Fixed

- Music Hub: sorting by Album keeps a compilation in disc and track order even when every song has a different artist (it used to sort by artist first, which scrambled "100 Best Piano Classics"). Different albums that share a title, like several "Greatest Hits", are still told apart by artist. The React preview does the same.
- Music Hub: sorting by the Track column goes disc by disc (every track of disc 1 by number, then disc 2), not by the track number alone, which mixed all the discs together. The React preview does the same.

### Added

- Screenshots of Music Hub (the iTunes Library tab, Raw Feel as a list and with one, two and three sliders narrowed, and Feel Axes) in its README, and the same six of the React preview in its README, in `docs/`.
- Music Hub: hovering a Track cell says it in words, "Disc 2 - Track 5 of 12" (the disc is left out on a single-disc album; the total is the tracks on that disc). The React preview does the same.
- Music Hub: drag the right edge of a column header to resize that column only; the others keep their width and the table gets wider or narrower. Double-click the edge to go back to the column's usual width. Each tab remembers its own widths, and the React preview reads and writes the same ones. (The table no longer stretches to fill the window when its columns are narrower than the window.)

## 0.4.0 - 2026-11-19

The React version of Music Hub can now be installed as an app and runs with its own helper, beside the current page. After updating, restart the helper if it was running.

### Added

- The React preview of Music Hub (`tools/music-hub-react`) has its own helper and can be installed as an app (`react-slice-6`). `serve.bat` (or `./serve.sh`) builds the page when it is out of date, starts the helper on its own port, 9223 (the current page keeps 9123, so both can run at once), and opens it in an app window; the browser can install it as "Music Hub (React)", with a teal icon. `preview.bat` is now for development only, and the dev server now reaches that helper.
- `docs/architecture-react.svg`: a diagram of how the parts of Music Hub in React fit together, from the iTunes library file through the helper to the layers of the app.

## 0.3.1 - 2026-11-19

The About box shows the version that is running, and the search box no longer looks in the genre. After updating, restart the helper.

### Changed

- Music Hub: the About box shows the version of the code that is running (the helper reads the `VERSION` file each time, through a new `/version` route), not the one `data.js` was built with, so a new release no longer shows the old number until you click Refresh data. It also says when the data was built ("Data built 2026-11-19 17:50"). Without the helper it falls back to the number in `data.js`. The React preview does the same. Restart the helper after updating.
- Music Hub: the search box no longer looks in the genre: typing "rock" finds songs with "rock" in the name, artist, album or composer, not every song tagged Rock. On the MP3 Archive tab it no longer looks in the category or the CD either (the Category menu and a click on a CD cell do that). The React preview does the same.

## 0.3.0 - 2026-11-19

Music Hub keeps playing when you switch to the MP3 Archive tab, and what the Music Hub pages share now lives in `tools/music-hub-core/`. Also new: a React preview of the page, built slice by slice, that does not replace the current one.
After updating, restart the helper and click **Refresh data**.

### Added

- **Music Hub in React and TypeScript, a preview** (`tools/music-hub-react`), built one slice at a time; each slice is a tagged commit, so the history shows how it
  grows. It reads the same `data.js` and does not replace the current page, which is still the one to use.
  - `react-slice-1`: the data layer (loading `data.js`, search, filters, sorting, the Feel scales), with tests.
  - `react-slice-2`: the table, search box, filters and sorting on screen, with windowed rows, for the iTunes and MP3 archive tabs.
  - `react-slice-3`: the Feel tabs. Raw Feel (ten sliders in five linked pairs, a graph of the first four narrowed scales) and Feel Axes (every rated song in a 3D cube you can turn, with a box that picks the list, and a flat view).
  - `react-slice-4`: everything that goes through the Python helper. The player (click a row or a dot to play, shuffle, seeking, volume, the media keys), rating by clicking stars (including taking a song off a `[To Rate]` playlist), Save as playlist and Refresh data. It says so when the helper is not running.
  - `react-slice-5`: the page as you use it. Presets (★ Presets), the view and the playing song remembered between visits, ← back and the mouse Back and Forward buttons for the filter views, a column menu (right-click a header; drag to reorder), hover tips, and an ⓘ About box. The song keeps playing on the MP3 archive tab, and `preview.bat` starts the preview (the dev server now uses port 5273).

### Changed

- Music Hub: what the pages share moved to a new folder, `tools/music-hub-core/`: the local helper (`server.py` became `helper.py`; `tools/music-hub/server.py` now just starts it), `build_data.py`, the built `data.js`, your `presets.json` and `mojibake_fixes.json`. `serve.bat`, `py -3 build_data.py` and `./build_data.sh` in `tools/music-hub` work as before. Your saved views are copied to the new place the first time the helper starts. After updating, restart the helper and click **Refresh data** (or run `build_data.py`), because `data.js` is now built in the new folder. The helper has tests (`py -3 -m unittest test_helper` in the new folder).
- Music Hub: the song keeps playing, and the player bar stays, when you switch to the MP3 Archive tab (it used to pause). Clicking the song's name in the player
  on that tab takes you to the iTunes Library tab and shows the song; on every other tab it stays where you are. Next and Previous don't change tab.

## 0.2.0 - 2026-11-09

New in Music Hub: saving a filtered list as a playlist, a Track column, and linked Feel sliders. After updating, restart the helper and click **Refresh data**.

### Added

- Music Hub: a **Track** column on the iTunes tab (`5/13`, or `2-5/12` for a multi-disc album), and sorting by Album now keeps each album together in disc and
  track order, so missing tracks show as gaps. Click **Refresh data** once after updating.
- Music Hub: the Raw Feel sliders are stacked in five pairs of scales that move together (Awe, Calm, Light and dark, Edge, Depth), each with a
  **link toggle** that makes the two sliders follow each other (a mirror image for the opposite pair, joyful and sadness). Off at first.
- Music Hub: **Save as playlist** writes the songs in the current list (any filter, in the order shown) as a `[Gen] <name>.m3u8` file in the
  `playlists` folder, ready to import into iTunes. Restart the helper after updating.
- `docs/architecture.svg`: a diagram of how the parts fit together, from the iTunes library file through the index tools and Music Hub to the running iTunes.

## 0.1.0 - 2026-10-30

The first numbered release: the public tools plus the changes below.

### Added

- Music Hub: hover a song's name to see the playlists it is in (hand-made and generated ones, not smart ones). Click **Refresh data** once
  after updating, so the page learns which playlists are smart.
- Music Hub: an **About** box with the version, what Music Hub is, the license, and links to the source and the support page.
- The helper prints the version when it starts ("Music Hub 0.1.0 running at ...").
- A `VERSION` file at the repo root (the one place the number is written) and this changelog.
- Music Hub: the mouse Back and Forward buttons (and Alt+Left / Alt+Right) undo and redo the filter views, like the "← back" chip.
- A funding link: the Sponsor button on the repository points to the Ko-fi page.
