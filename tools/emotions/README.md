# Emotions: Feel ratings, statistics and the 3D axes

How each song *feels*, rated on the nine **GEMS** scales plus **maturity**, saved as data for Music Hub's **Raw Feel** and **Feel Axes** tabs.

> **These are Claude's estimates, from knowing the songs, not measurements.** One rater, one pass: some of the overlap between
> scales is the rating process, not the music. Songs with confidence 1 are the ones Claude knows least (mostly deep album cuts and
> instrumentals). Spoken word (radio programs, lectures, meditations) is deliberately **not** rated: it has no musical tone.

## The scales

Nine from the Geneva Emotional Music Scale (Zentner, Grandjean and Scherer, 2008), each 0 to 10 for how strongly a typical listener *feels* it:
**wonder, transcendence, tenderness, nostalgia, peacefulness, power, joyful activation, tension, sadness**.

A tenth, **maturity** (0 to 10, empty for instrumentals), is how emotionally mature the *lyrics* are. High = ambivalence, taking responsibility, commitment as a
choice, repair after conflict, acceptance, loss told honestly. Low = obsession or possession, "can't live without you", begging, blaming, idealizing someone instead of knowing them, slogans.

Each rating also has a **confidence**: 1 low, 2 medium, 3 high.

## Files

| File | What it is |
|---|---|
| `gems.json` | **The ratings**, keyed by iTunes Persistent ID (git-ignored: your ratings stay on your machine). |
| `poc_songs.csv` | The songs that were queued for rating (idx, persistent_id, artist, name, album, secs); a song absent from `gems.json` was skipped on purpose (spoken word). |
| `batches/b01.csv` ... `b55.csv` | The raw ratings, one row per song: `idx, wonder, transcendence, tenderness, nostalgia, peacefulness, power, joyful, tension, sadness, maturity, confidence`. |
| `merge.py` | Rebuilds `gems.json` from `poc_songs.csv` + `batches/` (writes through a temp file, so it never leaves a half-written file). |
| `add_set.py` | Queues more songs by star rating: `py -3 add_set.py 4` (4-star loved) or `py -3 add_set.py 4 unloved`. |
| `stats.py` / `stats.md` | Mean and standard deviation of every scale overall and by stars and hearts. |
| `correlations.py` / `correlations.md` | The orthogonality check: correlations, principal components, variance inflation factors. |
| `axes.py` / `axes.json` | The three independent axes used by the Feel Axes tab (see below). |

## What has been rated

Songs are queued in sets by stars and hearts (`add_set.py`) and rated in batches. How many songs are rated, and how they split by stars and hearts, is in `stats.md` (written by `stats.py`); what was queued is in `poc_songs.csv`.

Not rated on purpose: songs at 2 stars or lower, and spoken word.

## Adding or fixing ratings

- **More songs:** queue them (`add_set.py`), write the ratings as a new `batches/bNN.csv`, run `py -3 merge.py`.
- **Fix one song:** edit its row in the right `batches/` file (find the row by `idx` in `poc_songs.csv`), run `merge.py`, then `stats.py` if the numbers matter. Music Hub shows it after **Refresh data**.
- **Spoken word** stays out; the 3D axes and statistics assume music only.

## What the numbers say

- **Overlap.** The ten scales are far from orthogonal (`correlations.md` has the correlation matrix). They behave like about **three independent dimensions**, matching the
  GEMS authors' three higher-order factors (sublimity, vitality, unease). Maturity overlaps with sadness. See `correlations.md`.
- **Hearts and stars.** Loved songs, at 4 and 5 stars alike, lean tender, peaceful, sad and mature; songs rated high but not loved lean powerful and joyful. See `stats.md`.

## The three axes of the Feel Axes tab

`axes.py` takes the **principal components** of the nine GEMS scales (all rated songs): three uncorrelated axes that together hold most of the variation (`py -3 axes.py` prints the share of each). Each is named after its high end and grows
toward the pleasant side; a song's coordinate is the sum of loading x z-score over the nine scales, divided by the square root of the eigenvalue (unit variance).

| Axis | High end | Low end | Main loadings |
|---|---|---|---|
| **Calm** | Calm · tender | Bright · strong | peacefulness, tenderness, nostalgia, transcendence; against joyful and power |
| **Ease** | Easy · cheerful | Demanding · intense | against tension and sadness; with joyful |
| **Awe** | Awe · grandeur | Everyday | wonder, transcendence, power |

Maturity is **not** part of the axes (it is empty for instrumentals); the page shows it as dot color. The axes are saved in `axes.json` and stay fixed while ratings are added, so the cube doesn't shift;
re-run `py -3 axes.py` only when you want them recomputed (Music Hub picks the new file up on **Refresh data**).
