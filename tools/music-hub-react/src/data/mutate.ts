import type { Dataset, Song } from "./types";

/**
 * The two changes made to the loaded data in place, on purpose. After a rating is set in iTunes, the list keeps its order and its rows until the
 * next filter, search or sort, exactly as the current page does; a new copy of the data would re-sort and re-filter it under the pointer, so a
 * row you just rated could jump away. The caller asks React to redraw. A refresh of the data replaces all of it.
 */

/** The rating iTunes now has for the song. */
export function setSongStars(song: Song, stars: number): void {
  song.stars = stars;
}

/** Takes a song off a playlist after it was rated from it. Returns whether the playlist held it. */
export function removeFromPlaylist(ds: Dataset, playlistName: string, ix: number): boolean {
  const p = ds.playlists.find((x) => x.name === playlistName);
  if (!p || !p.ids.includes(ix)) return false;
  p.ids = p.ids.filter((i) => i !== ix);
  return true;
}
