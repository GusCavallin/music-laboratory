# Music Hub core

What the Music Hub pages share, so each page's own folder holds only the page.

| File | What it is |
|---|---|
| `build_data.py` / `build_data.sh` | Builds `data.js` from the library XML and the optional indexes (release years, genres, Feel ratings, tempo, the CD archive). Run it here, or click **Refresh data** in a page. |
| `helper.py` | The local helper every page talks to: serves the page, streams audio (with seeking), rates songs in iTunes, saves playlists and presets, rebuilds the data, and stops itself when the last page closes. Standard library only. |
| `data.js` | The built data (git-ignored, always regenerable). |
| `presets.json` | Your saved views (git-ignored; created on the first Save). Shared by the pages. |
| `mojibake_fixes.json` | Spelling repairs for the CD index. |
| `test_helper.py` | Tests for the helper and the data script, on an invented library. |

## How a page uses the helper

A page has a small `server.py` next to its files:

```python
import helper   # tools/music-hub-core is put on the path first
helper.run(app_dir, files=None, port=9123, signature="music-library-search")
```

- `app_dir` is the page's folder; `/` serves its `index.html`.
- `files` lists the only files that may be served (use it for a folder that also holds scripts, like `tools/music-hub`), or `None` for a folder that holds only the page (a built app).
- `port` is the page's own preferred port, so two pages can run at once. If it is busy the helper takes the next free one.
- `signature` is what `/ping` answers. A second launch of the same page sees its own helper and just opens the window again; it does not mistake another page's helper for its own.

| Page | Folder | Port | Signature |
|---|---|---|---|
| Music Hub | `tools/music-hub` | 9123 | `music-library-search` |
| Music Hub, React version | `tools/music-hub-react` (serves its built `dist/`; builds it first when it is out of date) | 9223 | `music-hub-react` |

`data.js` and `presets.json` stay here, so every page reads the same library and the same saved views.

## Tests

```
py -3 -m unittest test_helper -v
```

They copy the helper into a temporary folder with an invented library (nothing of yours is read or changed), start the helpers on spare ports, and check the routes, what is *not*
served, that two pages can run at once, and that `py -3 build_data.py` still works from `tools/music-hub`. Rating uses a stub in place of iTunes.
