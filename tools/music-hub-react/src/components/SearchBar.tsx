import { useRef, type ReactNode } from "react";
import type { Facet } from "../data/filter";

interface Props {
  query: string;
  onQuery: (value: string) => void;
  /** rows shown and rows on this tab */
  count: number;
  total: number;
  /** after the numbers, such as " with feel ratings" */
  countNote?: string;
  facet: Facet;
  onRemoveFacet: (kind: keyof Facet) => void;
  onClear: () => void;
  /** the Save as playlist button (shown only when given: it needs the helper, and a list of iTunes songs) */
  onSavePlaylist?: () => void;
  /** the "← back" chip (shown only when given: there is a view to go back to) */
  onBack?: () => void;
  /** a control placed after the chips (the presets button) */
  after?: ReactNode;
}

const CHIPS: readonly { kind: keyof Facet; label: string }[] = [
  { kind: "artist", label: "Artist" },
  { kind: "album", label: "Album" },
  { kind: "volume", label: "Volume" },
];

export function SearchBar({ query, onQuery, count, total, countNote = "", facet, onRemoveFacet, onClear, onSavePlaylist, onBack, after }: Props) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="qrow">
      <span className="qwrap">
        <input
          ref={input}
          type="search"
          className="q"
          value={query}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          aria-label="Search"
          placeholder="Search name, artist, album, composer… (all words must match; accents ignored)"
          onChange={(e) => onQuery(e.target.value)}
        />
        {query !== "" && (
          <button
            type="button"
            className="qclear"
            aria-label="Clear the search text"
            data-tip="Clear the search text"
            onClick={() => {
              onQuery("");
              input.current?.focus();
            }}
          >
            ×
          </button>
        )}
      </span>
      <span className="count" aria-live="polite">
        {count.toLocaleString()} of {total.toLocaleString()}{countNote}
      </span>
      <span className="chips">
        {onBack && (
          <button type="button" className="chip" data-tip="Back to the filters you had before the last artist/album click" onClick={onBack}>
            ← back
          </button>
        )}
        {CHIPS.map(({ kind, label }) => {
          const value = facet[kind];
          return value === null ? null : (
            <span key={kind} className="chip on">
              {label}: {value}{" "}
              <button type="button" aria-label={`Remove the ${label.toLowerCase()} filter`} data-tip="Remove this filter" onClick={() => onRemoveFacet(kind)}>
                ×
              </button>
            </span>
          );
        })}
      </span>
      {after}
      {onSavePlaylist && (
        <button
          type="button"
          data-tip={"Write the songs in the list, in this order, as a playlist file (\"[Gen] name.m3u8\" in the playlists folder). Then import it in iTunes: File → Library → Import Playlist."}
          onClick={onSavePlaylist}
        >
          💾 Save as playlist
        </button>
      )}
      <button type="button" data-tip="Reset the search box and all filters (keeps the sort)" onClick={onClear}>
        ✕ Clear filters
      </button>
    </div>
  );
}
