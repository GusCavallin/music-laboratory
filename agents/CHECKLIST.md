# Checklist for an agent

- [ ] Read the **current** library XML (stage or copy it fresh; it changes after every import).
- [ ] Filter to `Track Type == "File"`; dedupe by `Location`.
- [ ] Anything year-based: refresh and use the release-year index, not the `Year` tag (`DATA-INDEXES.md`).
- [ ] Anything genre-based: refresh and use the artist-genre index, not the `Genre` tag.
- [ ] Write the playlist to `playlists\<Playlist Name>.m3u8` (UTF-8, no BOM, CRLF).
- [ ] Don't touch anything outside this repo; commit finished work.
- [ ] After the user imports, verify via the library XML (exists, count and order match, library size unchanged).
- [ ] Reply briefly: playlist name, track count, total duration, notable inclusions and exclusions, and the borderline calls.
