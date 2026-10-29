# Release-year index

The library's `Year` tags are often the year of a **compilation or reissue**, not the song's release
(e.g. "Penny Lane" is tagged 2000 because it comes from *1*). This folder holds a corrected year for
every file track, looked up once on MusicBrainz and cached.

## Files
| File | What | Edit? |
|---|---|---|
| `release_years.csv` | One row per library file track (UTF-8 with BOM). **Use this for anything about years or decades.** | Regenerated, don't hand-edit |
| `mb_cache.json` | MusicBrainz lookup results keyed by song (`artist|title|variant[|album]`). The expensive part. | Never delete |
| `update_index.py` | Refreshes the index | — |

## Keeping it current
```
python update_index.py --dry-run   # how many new songs need a lookup
python update_index.py             # looks up only new songs (~1 s each), then rebuilds the CSV
```
Run it before any year- or decade-based analysis if tracks were added since the last run. Songs already
in `mb_cache.json` are never queried again; `--retry-nomatch` re-tries songs that previously found nothing.
The MusicBrainz User-Agent includes the contact email set as `contact_email` in `config.json`.

## Columns in `release_years.csv`
- `persistent_id`: stable iTunes ID; join on this or `location` (never `Track ID`).
- `kind`: `music`, `classical` (not looked up: composition era is a separate question), `podcast`, `no-artist`.
- `variant`: empty for studio originals; `live`, `unplugged`, `mix`, `acoustic`… for different recordings.
- `tag_year`: the iTunes `Year` tag. `original_year`: **the year to use**.
- `source`:
  - `musicbrainz:original` = first release of the studio recording, wherever it appeared.
  - `musicbrainz:variant-album` = first release of this live/unplugged/remix recording.
  - `musicbrainz:variant-similar` = a recording of the same kind and length (low confidence).
  - `tag<mb` = the tag year was earlier than MusicBrainz, so the tag year is kept.
  - `tag (no mb match)` = MusicBrainz didn't find the song, so the tag year is kept.
  - `tag` = not looked up (classical/podcast).
- `confidence`: `high` / `medium` / `low`. Treat `low` and `tag (no mb match)` as approximate.

## Rules applied
- Studio originals on best-ofs/compilations → year the recording was **first** released.
- A genuinely new song on a compilation (e.g. Green Day "Maria", 2001) keeps its own year.
- Live / unplugged / acoustic / remix / demo → that recording's own first release, never the studio year.
- Remasters, radio edits and single versions count as the original recording.
