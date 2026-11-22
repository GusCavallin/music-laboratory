# Feel ratings of classical recordings

`classical-feel.csv` rates how classical recordings *feel*, on the nine GEMS scales plus maturity, for classical
pieces (the Feel tabs of Music Hub show the same kind of rating for the whole library; see
[tools/emotions](../tools/emotions/README.md) for the scales and how they are used).

**These are estimates, not measurements.** They were made by Claude (Anthropic), from knowing the music, for what a typical
listener feels: one rater, one pass. Treat them as a starting point, not as the truth.

## Columns

| Column | Meaning |
|---|---|
| `artist`, `composer`, `album`, `title` | As tagged in the library the ratings were made from. `composer` is empty when the library had none (the artist is then often the composer, in older tags). |
| `disc`, `track` | Position on the album. |
| `stars`, `loved` | The owner's own star rating (1 to 5) and favorite (`1`), a subjective judgment shared on purpose. Empty when there is none; stars that the player computed from the album are not included. |
| `seconds` | Length in whole seconds. With the artist, album and title it lets you match a recording in your own library; different recordings of the same piece differ in length and in feel. |
| `wonder`, `transcendence`, `tenderness`, `nostalgia`, `peacefulness`, `power`, `joyful`, `tension`, `sadness` | 0 to 10: how strongly a typical listener feels it (the Geneva Emotional Music Scale). |
| `maturity` | 0 to 10, how emotionally mature the *lyrics* are; empty for instrumental pieces, which is everything in this table so far. |
| `confidence` | 1 low, 2 medium, 3 high: how well the rater knows that recording. Weight low ones lightly. |

## Try it in Music Hub

No library needed: run `serve.bat --demo` in `tools/music-hub` (or `tools/music-hub-react`). Music Hub opens on these songs, with the
table, the filters, the Raw Feel sliders and the Feel Axes cube (placed with the axes in `feel-axes.json`). There is no audio, and the stars cannot be changed.

## What is not here

Nothing else of the library it came from: no file paths or files, no play counts or dates, no library ids.

## License and credit

Licensed under [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/) (CC BY 4.0): use, share and
adapt it, including commercially, as long as you give credit. Suggested credit:

> Feel ratings of classical recordings, from music-laboratory (https://github.com/GusCavallin/music-laboratory), by Gustavo Cavallin; ratings estimated by Claude (Anthropic). CC BY 4.0.

The license covers the ratings and the way they are put together, not the music, which belongs to its composers and performers.
The code in the rest of the repository has its own license (see [LICENSE](../LICENSE)).
