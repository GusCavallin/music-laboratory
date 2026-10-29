# Importing and verifying

1. The user imports: *File → Library → Import Playlist…* → choose the file.
2. Wait a few seconds, then re-read `iTunes Music Library.xml` (check that its file timestamp changed).
3. Find the playlist by name and confirm:
   - it exists (zero matches = silent failure → check encoding/BOM/line endings);
   - `len(Playlist Items)` equals the number of tracks written (fewer = some paths did not resolve, usually encoding, or a file that
     moved or was deleted);
   - the track order matches the file (an earlier playlist with the same name makes iTunes append instead of replace);
   - the total track count of the library did not increase (an increase means paths did not match existing tracks and iTunes added
     new entries; tell the user so they can remove them).
4. Only then report success, with the track count.
