<#
Set the star rating of ONE song, identified by its file path, in the running iTunes (used by Music Hub's clickable stars).

  .\rate_file.ps1 -Path "C:\...\song.mp3" -Name "Song title" -Stars 4

Finds the song with $lib.Search(Name) and keeps only the one whose Location equals -Path; changes it only when exactly one
matches. Prints one line: "OK <stars>" (read back from iTunes) or "ERR <reason>".
#>
param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][ValidateRange(0, 5)][int]$Stars,
    [string]$FromPlaylist = ""
)
try {
    $it = New-Object -ComObject iTunes.Application
    $res = $it.LibraryPlaylist.Search($Name.Trim(), 5)
    $found = @()
    if ($res) {
        for ($i = 1; $i -le $res.Count; $i++) {
            $t = $res.Item($i)
            try { if ($t.Location -ieq $Path) { $found += $t } } catch {}
        }
    }
    if ($found.Count -ne 1) { "ERR $($found.Count) songs matched"; exit 1 }
    $found[0].Rating = $Stars * 20
    $out = "OK $($found[0].Rating / 20)"
    # -FromPlaylist: a plain user playlist to take the song out of once it has a rating (the entry only, never the song)
    if ($FromPlaylist -and $Stars -gt 0) {
        foreach ($p in $it.LibrarySource.Playlists) {
            if ($p.Name -ceq $FromPlaylist -and $p.Kind -eq 2 -and -not $p.Smart) {
                $tr = $p.Tracks
                for ($i = 1; $i -le $tr.Count; $i++) {
                    $x = $tr.Item($i)
                    try { if ($x.Location -ieq $Path) { $x.Delete(); $out += " REMOVED"; break } } catch {}
                }
                break
            }
        }
    }
    $out
} catch {
    "ERR $($_.Exception.Message)"
    exit 1
}
