import { useRef } from "react";
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
}

const CHIPS: readonly { kind: keyof Facet; label: string }[] = [
  { kind: "artist", label: "Artist" },
  { kind: "album", label: "Album" },
  { kind: "volume", label: "Volume" },
];

export function SearchBar({ query, onQuery, count, total, countNote = "", facet, onRemoveFacet, onClear }: Props) {
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
          placeholder="Search name, artist, album, composer, genre… (all words must match; accents ignored)"
          onChange={(e) => onQuery(e.target.value)}
        />
        {query !== "" && (
          <button
            type="button"
            className="qclear"
            aria-label="Clear the search text"
            title="Clear the search text"
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
        {CHIPS.map(({ kind, label }) => {
          const value = facet[kind];
          return value === null ? null : (
            <span key={kind} className="chip on">
              {label}: {value}{" "}
              <button type="button" aria-label={`Remove the ${label.toLowerCase()} filter`} title="Remove this filter" onClick={() => onRemoveFacet(kind)}>
                ×
              </button>
            </span>
          );
        })}
      </span>
      <button type="button" title="Reset the search box and all filters (keeps the sort)" onClick={onClear}>
        ✕ Clear filters
      </button>
    </div>
  );
}
