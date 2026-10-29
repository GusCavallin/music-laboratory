# Writing playlists (preferred: M3U8)

All four formats below were tested with paths containing `ü`, `ë` and `ř` (`Dvořák`, not representable in Windows-1252). **All four
imported correctly**, matched existing library tracks, and created no duplicate tracks. M3U8 is the default because it is the
simplest to generate correctly; it needs only file paths.

## Default: M3U8

- Encoding **UTF-8, no BOM**; line endings **CRLF**; extension `.m3u8`.
- Paths: absolute Windows paths exactly as decoded from `Location` (backslashes).
- Playlist name in iTunes = **file name** without extension.

```python
lines = ["#EXTM3U"]
for t in selected:
    lines.append(f"#EXTINF:{t['Total Time']//1000},{t.get('Artist','')} - {t['Name']}")
    lines.append(winpath(t))
open(out_path, "wb").write(("\r\n".join(lines) + "\r\n").encode("utf-8"))
```

Before writing, check that every path exists in the library XML as a `File` track (and ideally on disk).

## Alternatives (also verified working)

| Format | When to use | Must-haves |
|---|---|---|
| `.txt` (iTunes TXT) | The user asks for "the same format as the export" | Header row + rows copied **verbatim** from an original export; **UTF-16 LE + BOM (FF FE), CRLF**. Header/notes/extra lines → silent failure. UTF-8 → silent failure. |
| `.m3u` | Another app needs `.m3u` | Same as M3U8 but write UTF-8 **with BOM** (EF BB BF). Without a BOM iTunes may read it as Windows-1252 and silently drop tracks with non-Latin-1 letters (ř, ő, č…). |
| `.xml` (Apple plist) | Need to carry a playlist description, or round-trip with other iTunes tools | Same structure as the library XML: `Tracks` dict (`Track ID`, `Name`, `Location`, …) + `Playlists` array with one playlist (`Name`, `Playlist Items`). Write with `plistlib.dumps`. Playlist name comes from the internal `Name`. |

## Failure mode to remember

**iTunes fails silently.** A malformed file "imports" with no message and no new playlist. That is why every write is followed by
verification (`IMPORT-VERIFY.md`): never report success based on the file alone.

## Naming

- File name = playlist name, so choose it deliberately: short, descriptive, e.g. `Classical Uplifting Calm.m3u8`. A colon
  cannot be in a Windows file name; use " - ".
- Mark agent-generated lists with a short prefix (this repo uses `[Gen] `, e.g. `[Gen] Rating Check.m3u8`) so they sort together
  in iTunes. An `.m3u8` carries no name of its own: iTunes always uses the file name.
- Don't reuse the name of an existing playlist unless asked. Importing a file whose name matches an existing playlist does **not**
  replace it and does not make a second one; iTunes keeps the old order and only appends the tracks it did not have at the end.
  If a list is being revised, the user deletes the old playlist in iTunes first, then imports.
- Order in the file = play order in iTunes. Default to grouping movements of the same work together in their original order.
- An MP3 CD can only be burned from MP3 files; iTunes will not convert AAC (m4a) files while burning. Convert them first
  (*File → Convert → Create MP3 Version*) and use the copies.
