import type { Dataset, Song } from "../data/types";

/** The most playlist names a tip lists; the rest is counted. */
export const PL_TIP_MAX = 15;

/**
 * The playlists a song is in: the ones made by hand or by an agent, never the rule-driven (smart) ones. Looked up when the tip opens, so it follows
 * Refresh data and removals.
 */
export function playlistsOf(dataset: Pick<Dataset, "playlists">, song: Pick<Song, "ix">): string[] {
  const names = dataset.playlists.filter((p) => !p.smart && p.ids.includes(song.ix)).map((p) => p.name);
  return names.length > PL_TIP_MAX ? [...names.slice(0, PL_TIP_MAX), `… and ${names.length - PL_TIP_MAX} more`] : names;
}

/** A tip's text, with a song's playlists under it. */
export const withPlaylists = (text: string, names: readonly string[]): string =>
  names.length ? `${text}\n\nIn playlists:\n${names.map((n) => `• ${n}`).join("\n")}` : text;

/**
 * Whether a tip is worth showing. A table cell shows one only when its text is cut off (the tip then shows all of it), or when it has more to say
 * than the text: the Feel scores (their tip is the distribution), a song's playlists, and a Track cell (its tip says "Disc 2 - Track 5 of 12" for "2-5/12").
 */
export function worthShowing(
  el: {
    tagName: string;
    scrollWidth: number;
    clientWidth: number;
    classList: { contains(c: string): boolean };
    textContent?: string | null;
    dataset?: { k?: string; tip?: string };
  },
  hasExtra: boolean,
): boolean {
  if (el.tagName !== "TD") return true;
  const wordsForTrack = el.dataset?.k === "track" && el.dataset.tip !== undefined && el.dataset.tip !== (el.textContent ?? "");
  return hasExtra || el.scrollWidth > el.clientWidth || el.classList.contains("fv") || wordsForTrack;
}
