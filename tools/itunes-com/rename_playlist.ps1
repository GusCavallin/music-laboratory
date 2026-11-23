<#
Rename ONE plain user playlist in the running iTunes (the songs are not touched).

  .\rename_playlist.ps1 -Old "[Gen] Some Name" -New "[Gen] Better Name"           dry run: says what it would do
  .\rename_playlist.ps1 -Old "[Gen] Some Name" -New "[Gen] Better Name" -Apply    really renames it, then reads the name back

Only done when exactly one plain (not smart) playlist has the old name (an exact, case-sensitive match) and no playlist has the new one.
Prints one line: "OK <what happened>" or "ERR <reason>". iTunes must be running or it will be started.
#>
param(
    [Parameter(Mandatory = $true)][string]$Old,
    [Parameter(Mandatory = $true)][string]$New,
    [switch]$Apply
)
try {
    $it = New-Object -ComObject iTunes.Application
    $found = @()
    $taken = 0
    foreach ($p in $it.LibrarySource.Playlists) {
        if ($p.Name -ceq $New) { $taken++ }
        if ($p.Name -ceq $Old -and $p.Kind -eq 2 -and -not $p.Smart) { $found += $p }
    }
    if ($found.Count -ne 1) { "ERR $($found.Count) plain playlists are named '$Old'"; exit 1 }
    if ($taken -gt 0) { "ERR a playlist named '$New' already exists"; exit 1 }
    $count = $found[0].Tracks.Count
    if (-not $Apply) { "DRY RUN: would rename '$Old' ($count songs) to '$New'. Add -Apply to do it."; exit 0 }
    $found[0].Name = $New
    $back = $found[0].Name
    if ($back -ceq $New) { "OK renamed to '$back' ($count songs)" } else { "ERR the name reads back as '$back'"; exit 1 }
} catch {
    "ERR $($_.Exception.Message)"
    exit 1
}
