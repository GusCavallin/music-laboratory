<#
Removes from ONE user playlist the songs that have a rating of their own (they were "to rate" and now are rated).
Only the playlist entry goes: the song stays in the library and on disk.

  .\remove_rated.ps1 -Playlist "[Gen] To Rate"           dry run: lists who would go
  .\remove_rated.ps1 -Playlist "[Gen] To Rate" -Apply    does it

Refuses to run on the library itself or on a playlist that is not a plain user playlist.
#>
param(
    [Parameter(Mandatory = $true)][string]$Playlist,
    [switch]$Apply
)
$it = New-Object -ComObject iTunes.Application
$pl = $null
foreach ($p in $it.LibrarySource.Playlists) { if ($p.Name -ceq $Playlist) { $pl = $p; break } }
if (-not $pl) { "ERR no playlist named '$Playlist'"; exit 1 }
if ($pl.Kind -ne 2 -or $pl.Smart) { "ERR '$Playlist' is not a plain user playlist (Kind=$($pl.Kind), Smart=$($pl.Smart))"; exit 1 }
$tracks = $pl.Tracks
"iTunes $($it.Version), $(if ($Apply) { 'APPLY' } else { 'DRY RUN' }); '$Playlist' has $($tracks.Count) songs"
$rated = @()
for ($i = 1; $i -le $tracks.Count; $i++) {
    $t = $tracks.Item($i)
    if ($t.Rating -gt 0 -and $t.ratingKind -eq 0) { $rated += $t }
}
foreach ($t in $rated) { "   $($t.Artist) - $($t.Name)  ($($t.Rating / 20) stars)" }
"$($rated.Count) rated song(s) to remove from the playlist"
if ($Apply -and $rated.Count) {
    # on a track taken from a user playlist, Delete removes the playlist entry only. Track references go stale after
    # each removal, so find the next rated song again every time.
    for ($n = 0; $n -lt $rated.Count; $n++) {
        $tracks = $pl.Tracks
        for ($i = 1; $i -le $tracks.Count; $i++) {
            $t = $tracks.Item($i)
            if ($t.Rating -gt 0 -and $t.ratingKind -eq 0) { $t.Delete(); break }
        }
    }
    "Done. '$Playlist' now has $($pl.Tracks.Count) songs; the library has $($it.LibraryPlaylist.Tracks.Count) songs"
}
