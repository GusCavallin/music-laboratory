import { filterSongs, noSort } from "../data/filter";
import type { Dataset } from "../data/types";
import { reduce, songFilterOf, type Action, type UiState } from "./uiState";

/**
 * A link from outside (another page or tool): `#artist=…&album=…&q=…` opens the iTunes tab on that album, or on a song of it (`q` is the
 * song's name). The current page reads the same links (index.html, openFromHash).
 */
export interface OpenLink {
  artist: string | null;
  album: string | null;
  query: string;
}

/** The link in a URL hash (`location.hash`), or null when it holds none of the three. */
export function parseOpenLink(hash: string): OpenLink | null {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const artist = p.get("artist") || null;
  const album = p.get("album") || null;
  const query = p.get("q") || "";
  return artist || album || query ? { artist, album, query } : null;
}

/**
 * What opening the link does to the view: the artist and album chips (and the search for a song) on the iTunes tab. When the chips match nothing,
 * a name the library spells differently, the same words are searched instead.
 */
export function openAction(dataset: Dataset, ui: UiState, link: OpenLink): Action {
  const chips: Action = { type: "open", artist: link.artist, album: link.album, query: link.query };
  if (!link.artist && !link.album) return chips;
  const found = filterSongs(dataset, songFilterOf(reduce(ui, chips)), noSort());
  if (found.length > 0) return chips;
  return { type: "open", artist: null, album: null, query: [link.artist, link.album, link.query].filter(Boolean).join(" ") };
}
