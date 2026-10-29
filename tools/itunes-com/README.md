# iTunes COM control

Windows only. These scripts need the **desktop** iTunes for Windows (tested with 12.13.11.1), which registers the
`iTunes.Application` automation object (the Microsoft Store build does not).
PowerShell: `New-Object -ComObject iTunes.Application` (iTunes must be running or it will be started).

`rate.ps1` reads or sets **star ratings**. It lists by default, `-Stars N` is a dry run, `-Stars N -Apply` really changes the
rating and reads it back. Only a song with exactly one match is ever changed. See the header of the script.

What the interface offers per song (78 members): `Rating` (0-100, read/write), `ratingKind` (0 = the song's own rating, 1 = computed
from the album), `AlbumRating`, `PlayedCount`, `BPM`, `Comment`, `Grouping`, `Genre`, `Year`, `Location`, `Play`, `Delete`...
It does **not** have `Loved` (the heart): that can only be set inside iTunes.

Rules that stay in force: anything that changes the library (ratings, playlists, deleting) is shown as a dry run first and done only
after the owner confirms. Reading is slow through COM (about 70 ms per song, so a whole library takes minutes): use the library XML
for bulk reading, COM for the few songs being changed. After a change iTunes rewrites `iTunes Music Library.xml` within seconds;
click "Refresh data" in Music Hub to see it there.

`rate_file.ps1` sets ONE song's rating by file path; Music Hub's clickable stars call it through `server.py` (`POST /rate`,
only songs listed in data.js). Clicking a star sets that rating in iTunes; clicking the current rating again clears it.

`remove_rated.ps1` removes the songs that have a rating of their own from one plain user playlist (playlist entry only; dry run by default, `-Apply` to do it).

`clean_to_rate.bat`: double-click to run `remove_rated.ps1` on "[Gen] To Rate": shows who would go, asks y/n, then removes.

**The `[To Rate]` tag:** any plain playlist with `[To Rate]` in its name works as a to-rate list. In Music Hub, rating a song while such a playlist is selected also removes it from the playlist (entry only; `server.py` checks the tag and `rate_file.ps1` refuses smart playlists).
