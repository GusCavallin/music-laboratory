# Artist genres

The iTunes `Genre` tags are inconsistent (the same artist gets different genres on different albums, and some tracks have none), so
genre comes from **MusicBrainz community votes per artist** instead. Genre is mostly an artist trait,
which fixes the inconsistency at its source. Country/area comes along for free.

## Files
| File | What | Edit? |
|---|---|---|
| `artist_genres.csv` | One row per artist in scope (UTF-8 with BOM). **Use this for genre.** | Regenerated (git-ignored) |
| `artist_cache.json` | MusicBrainz artist results keyed by normalized name | Never delete |
| `mb_genres.txt` | MusicBrainz's official genre list, used to drop non-genre tags ("british") | Cached |
| `update_genres.py` | Refreshes the CSV | — |

```
python update_genres.py --dry-run   # how many new artists need a lookup
python update_genres.py             # looks up only new artists (~1 s each), rebuilds the CSV
```
Requires `../release-years/release_years.csv` (run `update_index.py` there first) to skip classical,
podcasts and no-artist tracks.

## Scope
Artists with at least one track **rated 3+ stars by hand** (not album-inherited) **or Loved**. Artists you only
rated 2 stars or lower are skipped. `--all` includes everyone.

## Columns in `artist_genres.csv`
- `artist`: primary artist as tagged (guests after "feat." dropped). Join tracks on `primary_artist()` from
  `../release-years/update_index.py`.
- `tracks` / `liked_tracks`: music tracks by this artist / those rated 3+ stars or Loved.
- `genres`: up to 5, most-voted first; only genres with at least 25% of the top genre's votes.
- `source`: `musicbrainz`, or `itunes-tag` when MusicBrainz has no genre votes for the artist.
- `confidence`: `high` (right artist, 5+ genre votes) / `medium` (right artist, few votes) / `low`
  (iTunes fallback, or a shared name that couldn't be confirmed).
  When several MusicBrainz artists share a name (Enigma, Queen, Sting…), the one credited on your own
  best-liked songs wins ("confirmed"); without that evidence the best-known one is guessed ("ambiguous").
- `itunes_genres`: the artist's most common iTunes tags, for comparison.
- `country` / `area`: from MusicBrainz (e.g. `AR` / `Argentina`).
