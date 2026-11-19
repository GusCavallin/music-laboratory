import type { PlaylistResult, PlaylistSong } from "../api/helper";
import type { Song } from "../data/types";

/** The questions the flow asks (the browser's prompt and confirm in the app; stand-ins in tests). */
export interface SaveUi {
  prompt: (message: string) => string | null;
  confirm: (message: string) => boolean;
}

interface Options {
  /** the songs in the list, in the order shown */
  songs: readonly Song[];
  /** the names of the playlists iTunes already has */
  iTunesPlaylists: readonly string[];
  ui: SaveUi;
  save: (req: { name: string; songs: PlaylistSong[]; overwrite: boolean }) => Promise<PlaylistResult>;
}

/** What gets written: the path (for iTunes to find the song), and the name, artist and length for the playlist's own lines. */
export const toPlaylistSong = (s: Song): PlaylistSong => ({ path: s.path, name: s.name, artist: s.artist, secs: s.secs });

/** The name as typed, without a "[Gen]" prefix the helper would add again. */
export const cleanName = (typed: string): string => typed.trim().replace(/^\[gen\]\s*/i, "");

/**
 * Saving the list as a playlist file, in three questions at most: the name; whether to go on if iTunes already has a playlist of that name (importing it
 * would only add songs, not replace the old list); and whether to replace a file still waiting to be imported. Returns the message to show ("" = nothing).
 */
export async function saveAsPlaylist({ songs, iTunesPlaylists, ui, save }: Options): Promise<string> {
  if (!songs.length) return "Nothing to save: no songs match";
  const typed = ui.prompt(
    `Name for the playlist (${songs.length.toLocaleString()} songs, in the order shown).\nIt is saved as "[Gen] <name>.m3u8" in the playlists folder.`,
  );
  if (typed === null) return "";
  const name = cleanName(typed);
  if (!name) return "No name, nothing saved";
  const full = `[gen] ${name.toLowerCase()}`;
  if (
    iTunesPlaylists.some((p) => p.toLowerCase() === full) &&
    !ui.confirm(
      `iTunes already has a playlist called "[Gen] ${name}".\nImporting a file with the same name only adds the songs it doesn't have yet; it does not replace the old list.\n\nSave the file anyway?`,
    )
  ) {
    return "";
  }
  const songsOut = songs.map(toPlaylistSong);
  let result = await save({ name, songs: songsOut, overwrite: false });
  if (!result.ok && result.exists === "pending" && ui.confirm(`${result.error}.\nReplace that file?`)) {
    result = await save({ name, songs: songsOut, overwrite: true });
  }
  return result.ok ? `Saved ${result.count.toLocaleString()} songs: ${result.file}. Import it in iTunes.` : result.error || "Couldn't save the playlist";
}
