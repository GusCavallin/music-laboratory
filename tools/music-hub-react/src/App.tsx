import { useDeferredValue, useMemo, useReducer, type MouseEvent } from "react";
import { copyText } from "./clipboard";
import {
  cellText, columnsOf, FACET_COLUMNS, feelTip, groupOf, HIDDEN_BY_DEFAULT, scoreBackground, type Column,
} from "./columns";
import { CubeControls } from "./components/CubeControls";
import { DataTable } from "./components/DataTable";
import { FeelPanel } from "./components/FeelPanel";
import { FilterRow } from "./components/FilterRow";
import { GraphPanel } from "./components/GraphPanel";
import { SearchBar } from "./components/SearchBar";
import { Tabs } from "./components/Tabs";
import { feelColumnIndex } from "./data/feel";
import { filterArchive, filterSongs } from "./data/filter";
import type { ArchiveRow, Dataset, Song } from "./data/types";
import { buildCube } from "./feel/cube";
import { cubeModel, feelModel, type GraphModel } from "./feel/model";
import { useFlash } from "./hooks/useFlash";
import { useLibrary } from "./hooks/useLibrary";
import { archiveFilterOf, cubeBoxOf, initialUiState, isSongTab, reduce, songFilterOf } from "./state/uiState";

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

  const cube = useMemo(() => buildCube(dataset.songs, dataset.axes), [dataset]);
  const ratedCount = useMemo(() => dataset.songs.filter((s) => s.feel).length, [dataset]);

  // `ui` changes with every keystroke; the other fields keep their identity, so these are the real dependencies
  const rows: readonly (Song | ArchiveRow)[] = useMemo(
    () =>
      isSongTab(ui.tab)
        ? filterSongs(dataset, songFilterOf(ui, deferredQuery, cube), ui.sort)
        : filterArchive(dataset, archiveFilterOf(ui, deferredQuery), ui.sort),
    [dataset, cube, ui.tab, ui.facet, ui.stars, ui.lovedOnly, ui.decade, ui.country, ui.playlist, ui.category, ui.inItunes, ui.sort,
      ui.feel.ranges, ui.feel.confidence, ui.cube.ranges, ui.cube.maturity, deferredQuery],
  );

  const group = groupOf(ui.tab, ui.feel.graph);
  const columns = useMemo(() => columnsOf(group).filter((c) => !HIDDEN_BY_DEFAULT[group].has(c.key)), [group]);
  const feelTab = ui.tab === "feel" || ui.tab === "cube";
  const total = ui.tab === "archive" ? dataset.archive.length : feelTab ? ratedCount : dataset.songs.length;

  // the graph: the cube on Feel Axes, or the first narrowed scales on Raw Feel with "Show graph"
  const model: GraphModel | null = useMemo(() => {
    if (ui.tab === "cube") return cube ? cubeModel(cube, cubeBoxOf(ui, cube), dataset.feelStats) : null;
    if (ui.tab === "feel" && ui.feel.graph) return feelModel(ui.feel.order, ui.feel.ranges, dataset.feelStats);
    return null;
  }, [ui.tab, cube, ui.cube.ranges, ui.cube.maturity, ui.feel.graph, ui.feel.order, ui.feel.ranges, dataset.feelStats]);

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

  const cellTitle = (row: Song | ArchiveRow, column: Column): string | undefined => {
    if (feelColumnIndex(column.key) !== null) return "feel" in row ? feelTip(row, column.key, dataset.feelStats) || undefined : undefined;
    return TIP_COLUMNS.has(column.key) ? cellText(row, column.key) : undefined;
  };

  const cellStyle = (row: Song | ArchiveRow, column: Column) => {
    const fi = feelColumnIndex(column.key);
    if (fi === null || column.key === "f_conf" || !("feel" in row)) return undefined;
    const background = scoreBackground(row.feel?.[fi] ?? null, column.key, dataset.feelStats, ui.feel.color);
    return background ? { background } : undefined;
  };

  const emptyMessage =
    ui.tab === "archive" ? "No archive rows match these filters."
    : ui.tab === "cube" && !cube ? "No Feel Axes data yet (run tools\\emotions\\axes.py and refresh the data)."
    : feelTab ? "No rated songs match these filters."
    : "No songs match these filters.";

  return (
    <>
      <header>
        <div className="top">
          <h1>Music Hub</h1>
          <span className="preview" title="The React rebuild, slice 3: the Feel tabs">React preview</span>
          <Tabs tab={ui.tab} onChange={(tab) => dispatch({ type: "tab", tab })} />
          <div className="acts"><span className="rmsg" role="status">{message}</span></div>
        </div>
        <SearchBar
          query={ui.query}
          onQuery={(value) => dispatch({ type: "query", value })}
          count={rows.length}
          total={total}
          countNote={feelTab ? " with feel ratings" : ""}
          facet={ui.facet}
          onRemoveFacet={(kind) => dispatch({ type: "removeFacet", kind })}
          onClear={() => dispatch({ type: "clear" })}
        />
        {ui.tab === "feel" && <FeelPanel feel={ui.feel} dispatch={dispatch} />}
        {ui.tab === "cube" && <CubeControls cube={cube} ui={ui.cube} dispatch={dispatch} />}
        <FilterRow dataset={dataset} state={ui} dispatch={dispatch} />
      </header>
      <main className="split">
        <div className="listpane">
          <DataTable
            rows={rows}
            columns={columns}
            sort={ui.sort}
            onSort={(key) => dispatch({ type: "sort", key })}
            renderCell={(row, column) => (column.key === "stars" && "feel" in row ? <Stars n={row.stars} /> : cellText(row, column.key))}
            cellTitle={cellTitle}
            cellStyle={cellStyle}
            onCellClick={onCellClick}
            clickableKeys={CLICKABLE}
            emptyMessage={emptyMessage}
          />
        </div>
        {model && (
          <GraphPanel
            model={model}
            songs={dataset.songs}
            rows={rows as readonly Song[]}
            showViewChoice={ui.tab === "cube"}
            view={ui.cube.view}
            onView={(value) => dispatch({ type: "cubeView", value })}
          />
        )}
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
