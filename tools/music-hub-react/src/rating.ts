/** Rating a song while a playlist with this tag in its name is chosen also takes it off that playlist (the helper checks the same tag). */
export const TO_RATE_TAG = "[To Rate]";

/** The rating a click on a star sets: clicking the rating the song already has clears it. */
export const starsAfterClick = (current: number, clicked: number): number => (clicked === current ? 0 : clicked);

/**
 * The playlist a rating should also take the song off: the one chosen in the Playlist box if it exists, has the tag in its name, and a rating
 * is being given (clearing one does not take a song off). "" = none.
 */
export function playlistToRateFrom(chosen: string, playlistNames: readonly string[], stars: number): string {
  return stars > 0 && chosen.includes(TO_RATE_TAG) && playlistNames.includes(chosen) ? chosen : "";
}
