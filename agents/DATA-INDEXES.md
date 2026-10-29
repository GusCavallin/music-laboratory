# Years, genres and tempo: use the indexes, not the tags

The tags in a music library are unreliable for these three questions. The repo has index tools that fix them from open data
(MusicBrainz, AcousticBrainz). They only look up what is new, keep their caches (never delete a cache), and each has a README.

- **Years and decades: don't trust the iTunes `Year` tag.** It is often the compilation or reissue year, so songs tagged 2000s can
  really be from decades earlier. Use `original_year` from `tools\release-years\release_years.csv`, joined on `persistent_id` or
  `location`. Run `python update_index.py` there first: it queries MusicBrainz only for songs not yet in `mb_cache.json` (about 1 s
  each) and rebuilds the CSV. Compilation tracks get the song's first release; live/unplugged/remix versions keep their own
  recording's year. Classical and podcasts aren't looked up.
- **Genre: don't trust the iTunes `Genre` tag** either: the same artist gets different genres on different albums. Use `genres` and
  `country` from `tools\artist-genres\artist_genres.csv` (MusicBrainz votes per artist; join on the track's primary artist). Run
  `python update_genres.py` there first; it only looks up new artists. By default it covers artists with a hand-rated 3+ star or
  Loved track.
- **Tempo, "energetic" and workout lists: don't trust iTunes BPM, or BPM alone.** Use `tools\bpm\` (AcousticBrainz data via
  MusicBrainz recording IDs; only part of a library has data; run `update_bpm.py` for new songs). The estimator often reports double
  the real tempo for slow songs, so ballads show up at 150+. `tools\bpm\workout_playlist.py` combines danceability, onset rate and
  events per beat, and has `--seed/--drop/--explain/--dry-run`; read its README first. Mid-tempo ballads can still slip through, so
  show the user a sample and let them prune. Songs with no data are only added when the user names them.

Match library tracks to these indexes by `persistent_id` or `location`, as `READING-LIBRARY.md` explains.
