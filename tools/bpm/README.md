# Tempo (BPM) index

Where the **BPM** column in Music Hub comes from. MusicBrainz itself has no tempo data (a recording record has titles,
artists, ISRCs, tags, ratings, links, but no BPM), and iTunes holds a BPM for only 3 tracks. **AcousticBrainz** analysed
the audio of many recordings and stored the tempo under the MusicBrainz recording ID; it stopped collecting in 2022 but
its API still answers.

```
py -3 update_bpm.py              # asks only about recordings not yet in bpm_cache.json, then rebuilds bpm.csv
py -3 update_bpm.py --limit 500  # at most 500 new recordings this run
py -3 update_bpm.py --no-fetch   # rebuild bpm.csv from the cache only
```

- Input: `tools/release-years/release_years.csv` (its `mb_recording_id`). Run `update_index.py` there first for new songs.
- `bpm_cache.json` (committed, costly to rebuild): `{recording id: {bpm, danceability, onset, loudness, n}}`; a miss is cached as `{bpm: null}`.
  Since AcousticBrainz no longer collects data, a recording needs asking about only once.
- `bpm.csv` (derived, git-ignored): one row per track, joined by `persistent_id`. `tools/music-hub/build_data.py`
  reads it, so run `build_data.sh` (or **Refresh data** in Music Hub) afterwards.
- One request per second, 25 recordings per request. A whole library takes a while the first time.

**Limits:** only tracks with a MusicBrainz recording ID can be looked up (classical, podcasts and children's music are
not in the release-year index), and only some of those have a tempo in AcousticBrainz. The tempo is computed
by software, so it can be double or half of the real one (a slow ballad shown as 140, a fast song as 70). Danceability,
onset rate (note/beat events per second) and loudness are stored in the cache and the CSV; `workout_playlist.py` uses them.

## Workout playlists (`workout_playlist.py`)

BPM alone is a poor "workout" filter: the tempo estimator often reports double the real tempo for slow songs, so ballads
show up at 150+. `workout_playlist.py` builds an energetic list from your best-rated songs using, besides tempo,
danceability (>= 1.06), onset rate (>= 3.2) and **events per beat** (onset x 60 / bpm, >= 1.3; a ballad measured at double
tempo has about 1, real fast songs 1.4+). On hand-picked examples this separates doubled-tempo ballads from rock and pop;
genuinely mid-tempo ballads (e.g. *Daniel*, *The End of the Innocence*) look like upbeat pop to these measures and slip
through, so review the list. It also drops videos, children's, holiday, spoken-word, classical and jazz (artist genre
tags or the iTunes Genre), and needs your own rating of 4+.

```
py -3 workout_playlist.py --name "Road bike ride" --seed "Everything But The Girl|Wrong" --seed "Maroon 5|Maps" --seed "Katy Perry|Firework" --seed "Ke$ha|TiK ToK" --seed "Madonna|Hung Up" --seed "The Cure|Just Like Heaven"   # the current Road bike ride list
py -3 workout_playlist.py --dry-run --show 40 --candidates 40     # report only: a sample, and songs without data to consider
py -3 workout_playlist.py --dry-run --explain "Travis|Love Will Come Through"   # why a song is in or out
```
`--seed "Artist|Title"` always includes a song (use it for songs AcousticBrainz has no data for), `--drop "Artist|Title"`
leaves one out (`--drop "Artist|"` drops the whole artist). The file is written to `playlists/[Gen] <name>.m3u8`
in a fixed shuffled order.
