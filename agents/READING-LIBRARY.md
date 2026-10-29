# Reading the library (preferred: library XML)

iTunes keeps `iTunes Music Library.xml` up to date automatically (setting: *Edit → Preferences → Advanced →
"Share iTunes Library XML with other applications"*, which must be on). It is rewritten within seconds of any library change, so it is
always current. For a library of ten thousand tracks it is about 19 MB.

The path is the `source_music_library` setting in `config.json`. In a script:

```python
import pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2]))   # the repo root (adjust the depth)
from musiclab_config import SOURCE_LIBRARY
```

Format: Apple property list, UTF-8. Parse it with a plist parser, do not regex it.

```python
import plistlib, urllib.parse
lib = plistlib.load(open(SOURCE_LIBRARY, "rb"))
tracks = lib["Tracks"]            # dict: "Track ID" (string key) -> track dict
playlists = lib["Playlists"]      # list of playlist dicts

def track(tid):                   # Playlist Items use int IDs, Tracks keys are strings
    return tracks[str(tid)]

def winpath(t):                   # Location -> Windows path
    loc = t["Location"]           # file://localhost/C:/Users/you/Music/iTunes/iTunes%20Music/...
    return urllib.parse.unquote(loc.replace("file://localhost/", "")).replace("/", "\\")

pl = next(p for p in playlists if p["Name"] == "Some Playlist")
items = [track(i["Track ID"]) for i in pl.get("Playlist Items", [])]
```

Useful track keys (all optional except `Track ID`, `Name`, `Track Type`, `Persistent ID`):
`Name, Artist, Album Artist, Composer, Album, Genre, Year, Total Time` (ms) `, Track Number, Disc Number,
Play Count, Play Date UTC, Skip Count, Rating` (0–100; 20 per star) `, Rating Computed` (true = inherited
from album, not a real track rating) `, Loved, Comments, Grouping, Work, Date Added, Kind, Location`.

## Gotchas

- **Not every track is a file.** Keep only `Track Type == "File"` with a `Location`. Radio streams and podcasts are `URL`, and a few
  entries are `Remote`; skip those.
- Track identity: use `Location` (decoded Windows path) for matching across sources; `Persistent ID` is the stable iTunes ID.
  `Track ID` can change between library rebuilds, so never store it long-term.
- Playlists: skip `Master: True` (the whole library) and anything with `Distinguished Kind` (built-in Music/Podcasts/etc.).
  Smart playlists have `Smart Info`/`Smart Criteria` (binary, ignore); their current members are still listed in
  `Playlist Items`. Folders have `Folder: True`; children point to them with `Parent Persistent ID`.
- The same recording often exists several times (for example on a compilation and on the original album) with different paths.
  That is normal; dedupe by `Location`, and only by Name+Artist if asked.

## Fallback: manual TXT exports

If the XML is missing or stale, ask the user to export a playlist (*File → Library → Export Playlist…*, type *Text files*) into
`exports\`. Format: **UTF-16 LE with BOM, CRLF line endings, tab-separated, one header row**, 31 columns:
`Name, Artist, Composer, Album, Grouping, Work, Movement Number, Movement Count, Movement Name, Genre,
Size, Time, Disc Number, Disc Count, Track Number, Track Count, Year, Date Modified, Date Added, Bit Rate,
Sample Rate, Volume Adjustment, Kind, Equalizer, Comments, Plays, Last Played, Skips, Last Skipped,
My Rating, Location`. `Time` is in seconds; `Location` is a plain Windows path.
Read with `open(p, "rb").read().decode("utf-16")` and split on `"\r\n"`.
Files that pass through chat uploads may arrive re-encoded as UTF-8. If you need exact bytes, read the original from disk.
