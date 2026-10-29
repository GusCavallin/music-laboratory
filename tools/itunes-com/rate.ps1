<#
Read or set star ratings in the running iTunes through its COM interface (desktop iTunes only).

  .\rate.ps1 -Song "Howard Jones|No One Is To Blame"                 shows the current rating, changes nothing
  .\rate.ps1 -Song "Howard Jones|No One Is To Blame" -Stars 4         dry run: shows what it WOULD change
  .\rate.ps1 -Song "Howard Jones|No One Is To Blame" -Stars 4 -Apply  does it, then reads it back

-Song takes "Artist|Title" (Artist matches as a part of the name, Title as the start of the song name); repeat it for
several songs. A song is only changed when exactly ONE song matches; otherwise the matches are listed and nothing happens.
-Stars is 0-5 (0 = no rating). iTunes stores 0-100, so stars x 20.
The heart ("Loved") is NOT available through iTunes' COM interface, so it cannot be set from here.
Afterwards iTunes rewrites its library XML; click "Refresh data" in Music Hub to see the new ratings there.
#>
param(
    [Parameter(Mandatory = $true)][string[]]$Song,
    [ValidateRange(0, 5)][int]$Stars = -1,
    [switch]$Apply
)

$it = New-Object -ComObject iTunes.Application
$lib = $it.LibraryPlaylist
$mode = if ($Stars -lt 0) { "READ" } elseif ($Apply) { "APPLY" } else { "DRY RUN" }
"iTunes $($it.Version), mode: $mode"

foreach ($s in $Song) {
    $artist, $title = ($s -split '\|', 2)
    $found = @()
    $res = $lib.Search($title.Trim(), 5)            # 5 = search in song names
    if ($res) {
        for ($i = 1; $i -le $res.Count; $i++) {
            $t = $res.Item($i)
            if ($t.Name -like ($title.Trim() + '*') -and $t.Artist -like ('*' + $artist.Trim() + '*')) { $found += $t }
        }
    }
    ""
    "$artist | $title : $($found.Count) match(es)"
    foreach ($t in $found) {
        $kind = if ($t.ratingKind -eq 0) { "your rating" } else { "computed from the album (not yours)" }
        "   $($t.Artist) - $($t.Name)  [$($t.Album)]   now: $($t.Rating / 20) stars ($kind)"
    }
    if ($found.Count -ne 1) {
        if ($Stars -ge 0) { "   -> not changed: need exactly one match" }
        continue
    }
    if ($Stars -ge 0) {
        $t = $found[0]
        if ($t.Rating -eq $Stars * 20 -and $t.ratingKind -eq 0) { "   -> already $Stars stars, nothing to do"; continue }
        if ($Apply) {
            $t.Rating = $Stars * 20
            "   -> SET to $Stars stars; read back: $($t.Rating / 20) stars"
        } else {
            "   -> would set $($t.Rating / 20) -> $Stars stars (add -Apply to do it)"
        }
    }
}
[void][Runtime.InteropServices.Marshal]::ReleaseComObject($it)
