# Rating how songs feel

This is how an agent rates songs for the Feel tabs of Music Hub. The data lives in `tools\emotions\`; read its `README.md` too.

## What you rate

For each song, ten numbers from 0 to 10 and a confidence:

- Nine scales from the Geneva Emotional Music Scale (Zentner, Grandjean and Scherer, 2008): **wonder, transcendence, tenderness,
  nostalgia, peacefulness, power, joyful activation, tension, sadness**. Each is how strongly a typical listener *feels* it.
- **Maturity**: how emotionally mature the *lyrics* are. High = ambivalence, taking responsibility, commitment as a choice, repair
  after conflict, acceptance, loss told honestly. Low = obsession or possession, "can't live without you", begging, blaming,
  idealizing someone instead of knowing them, slogans. Leave it empty for instrumentals.
- **Confidence**: 1 low, 2 medium, 3 high. Use 1 for songs you hardly know (deep album cuts, instrumentals), not a neutral guess.

## How to rate

- Rate the song, not the user's taste. A star rating or a heart says what the user likes; the scales say how the song feels. Never copy
  one into the other.
- Rate from what you know about the song: sound, tempo, mode, arrangement, lyrics, reputation. Use the full 0 to 10 range; a
  quiet ballad can be tender 8 and power 1.
- Don't invent. If you don't know a song, lower the confidence. Never quote lyrics anywhere; write only numbers.
- **Spoken word is never rated** (radio programs, lectures, meditations): it has no musical tone. The queue skips it on purpose.
- The scales overlap strongly (about 3 independent dimensions: roughly sublime, lively and uneasy). Rate each scale on its own,
  but don't read the ten numbers as ten independent facts. Joyful and sad tend to be opposites; a calm song can be low on both.
- These are an agent's estimates from one pass, not measurements. Say so when you report them.

## Workflow

1. **Queue songs.** `py -3 add_set.py 4` appends the 4-star loved songs that are not yet queued to `poc_songs.csv`
   (`add_set.py 4 unloved` for those without a heart; `5` for five stars). A song absent from `gems.json` but present in
   `poc_songs.csv` was skipped on purpose.
2. **Write a batch.** Add `batches\bNN.csv`: one row per song, no header, columns
   `idx, wonder, transcendence, tenderness, nostalgia, peacefulness, power, joyful, tension, sadness, maturity, confidence`,
   where `idx` is the song's row number in `poc_songs.csv`.
3. **Merge.** `py -3 merge.py` rebuilds `gems.json` from `poc_songs.csv` and the batches (it writes aside and swaps, so it never leaves
   a half-written file) and reports bad rows. Then `py -3 axes.py` rebuilds `axes.json` for the Feel Axes tab; `stats.py` and
   `correlations.py` refresh the summaries.
4. **Fix one song.** Edit its row in the right batch (find the batch by searching for the `idx`), then run `merge.py` and `axes.py`.
5. In Music Hub, click **Refresh data** to see the result.

Ratings come from the user's own library and are personal data: `gems.json`, `axes.json`, `poc_songs.csv` and `batches\` are not
published.
