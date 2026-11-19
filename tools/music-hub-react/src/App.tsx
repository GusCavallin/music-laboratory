import { useDeferredValue, useMemo, useReducer, type MouseEvent } from "react";
import { copyText } from "./clipboard";
import { cellText, columnsOf, FACET_COLUMNS, HIDDEN_BY_DEFAULT, type Column } from "./columns";
import { DataTable } from "./components/DataTable";
import { FilterRow } from "./components/FilterRow";
import { SearchBar } from "./components/SearchBar";
import { Tabs } from "./components/Tabs";
import { filterArchive, filterSongs } from "./data/filter";
import type { ArchiveRow, Dataset, Song } from "./data/types";
import { useFlash } from "./hooks/useFlash";
import { useLibrary } from "./hooks/useLibrary";
import { archiveFilterOf, initialUiState, reduce, songFilterOf } from "./state/uiState";

export function App() {
  const { state } = useLibrary();
  if (state.status === "loading") return <p className="status">Loading data.js…</p>;
  if (state.status === "error") {
    return (
      <p className="status">
        Couldn't load data.js ({state.message}). Build it with <code>py -3 tools\music-hub\build_data.py</code>, or point
        <code> MUSICLAB_DATA_JS </code> at it.
      </p>
    );
  }
  return <Library dataset={state.dataset} />;
}

/** Text worth a hover tip because a narrow column cuts it off. */
const TIP_COLUMNS: ReadonlySet<string> = new Set(["name", "artist", "album", "genres", "composer", "path", "category"]);
const CLICKABLE = new Set([...Object.keys(FACET_COLUMNS), "path"]);

function Library({ dataset }: { dataset: Dataset }) {
  const [ui, dispatch] = useReducer(reduce, undefined, initialUiState);
  const [message, flash] = useFlash();
  const deferredQuery = useDeferredValue(ui.query); // typing stays responsive; the list follows a moment later

  // `ui` changes with every keystroke; the other fields keep their identity, so these are the real dependencies
  const rows: readonly (Song | ArchiveRow)[] = useMemo(
    () =>
      ui.tab === "itunes"
        ? filterSongs(dataset, songFilterOf(ui, deferredQuery), ui.sort)
        : filterArchive(dataset, archiveFilterOf(ui, deferredQuery), ui.sort),
    [dataset, ui.tab, ui.facet, ui.stars, ui.lovedOnly, ui.decade, ui.country, ui.playlist, ui.category, ui.inItunes, ui.sort, deferredQuery],
  );

  const columns = useMemo(() => columnsOf(ui.tab).filter((c) => !HIDDEN_BY_DEFAULT[ui.tab].has(c.key)), [ui.tab]);
  const total = ui.tab === "itunes" ? dataset.songs.length : dataset.archive.length;

  const onCellClick = (row: Song | ArchiveRow, column: Column, e: MouseEvent) => {
    if (column.key === "path") {
      void copyText(row.path).then(() => flash("Copied path"));
      return;
    }
    const kind = FACET_COLUMNS[column.key];
    if (!kind || window.getSelection()?.toString()) return; // the user is selecting text, not picking
    const value = kind === "volume" ? ("volume" in row ? row.volume : "") : row[kind];
    if (value) dispatch({ type: "facet", kind, value, keep: e.ctrlKey || e.metaKey });
  };

  return (
    <>
      <header>
        <div className="top">
          <h1>Music Hub</h1>
          <span className="preview" title="The React rebuild, slice 2: table, search, filters and sorting">React preview</span>
          <Tabs tab={ui.tab} onChange={(tab) => dispatch({ type: "tab", tab })} />
          <div className="acts"><span className="rmsg" role="status">{message}</span></div>
        </div>
        <SearchBar
          query={ui.query}
          onQuery={(value) => dispatch({ type: "query", value })}
          count={rows.length}
          total={total}
          facet={ui.facet}
          onRemoveFacet={(kind) => dispatch({ type: "removeFacet", kind })}
          onClear={() => dispatch({ type: "clear" })}
        />
        <FilterRow dataset={dataset} state={ui} dispatch={dispatch} />
      </header>
      <main>
        <DataTable
          rows={rows}
          columns={columns}
          sort={ui.sort}
          onSort={(key) => dispatch({ type: "sort", key })}
          renderCell={(row, column) => (column.key === "stars" && "feel" in row ? <Stars n={row.stars} /> : cellText(row, column.key))}
          cellTitle={(row, column) => (TIP_COLUMNS.has(column.key) ? cellText(row, column.key) : undefined)}
          onCellClick={onCellClick}
          clickableKeys={CLICKABLE}
          emptyMessage={ui.tab === "itunes" ? "No songs match these filters." : "No archive rows match these filters."}
        />
      </main>
    </>
  );
}

/** Five stars, filled up to the rating. (Clicking one to rate arrives in slice 4.) */
function Stars({ n }: { n: number }) {
  return (
    <span className="stars" role="img" aria-label={n ? `${n} of 5 stars` : "not rated"}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= n ? "on" : undefined}>{i <= n ? "★" : "☆"}</span>
      ))}
    </span>
  );
}
