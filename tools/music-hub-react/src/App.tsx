import { useDeferredValue, useEffect, useMemo, useReducer, useRef, useState, type MouseEvent } from "react";
import * as helperApi from "./api/helper";
import { copyText } from "./clipboard";
import {
  cellText, columnsOf, FACET_COLUMNS, feelTip, groupOf, HIDDEN_BY_DEFAULT, scoreBackground, type Column,
} from "./columns";
import { CubeControls } from "./components/CubeControls";
import { DataTable, type DataTableHandle } from "./components/DataTable";
import { FeelPanel } from "./components/FeelPanel";
import { FilterRow } from "./components/FilterRow";
import { GraphPanel } from "./components/GraphPanel";
import { PlayerBar } from "./components/PlayerBar";
import { SearchBar } from "./components/SearchBar";
import { Stars } from "./components/Stars";
import { Tabs } from "./components/Tabs";
import { feelColumnIndex } from "./data/feel";
import { filterArchive, filterSongs } from "./data/filter";
import { removeFromPlaylist, setSongStars } from "./data/mutate";
import type { ArchiveRow, Dataset, Song } from "./data/types";
import { buildCube } from "./feel/cube";
import { cubeModel, feelModel, type GraphModel } from "./feel/model";
import { useFlash } from "./hooks/useFlash";
import { useHelper } from "./hooks/useHelper";
import { useLibrary } from "./hooks/useLibrary";
import { saveAsPlaylist } from "./playlist/saveFlow";
import { useAudioPlayer } from "./player/useAudioPlayer";
import { useVolume } from "./player/useVolume";
import { playlistToRateFrom, starsAfterClick } from "./rating";
import { archiveFilterOf, cubeBoxOf, initialUiState, isSongTab, reduce, songFilterOf } from "./state/uiState";

export function App() {
  const { state, reload } = useLibrary();
  if (state.status === "loading") return <p className="status">Loading data.js…</p>;
  if (state.status === "error") {
    return (
      <p className="status">
        Couldn't load data.js ({state.message}). Build it with <code>py -3 tools\music-hub\build_data.py</code>, or point
        <code> MUSICLAB_DATA_JS </code> at it.
      </p>
    );
  }
  return <Library dataset={state.dataset} reload={reload} />;
}

/** Text worth a hover tip because a narrow column cuts it off. */
const TIP_COLUMNS: ReadonlySet<string> = new Set(["name", "artist", "album", "genres", "composer", "path", "category"]);
const CLICKABLE = new Set([...Object.keys(FACET_COLUMNS), "path"]);
const NO_SONGS: readonly Song[] = [];

function Library({ dataset, reload }: { dataset: Dataset; reload: () => Promise<Dataset | null> }) {
  const [ui, dispatch] = useReducer(reduce, undefined, initialUiState);
  const [message, flash] = useFlash();
  const deferredQuery = useDeferredValue(ui.query); // typing stays responsive; the list follows a moment later
  const helper = useHelper();
  const volume = useVolume();
  const table = useRef<DataTableHandle>(null);

  // ratings and playlists are updated in place after iTunes accepts a change (see data/mutate.ts); these ask React to redraw
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  const [playlistRev, playlistChanged] = useReducer((n: number) => n + 1, 0);

  const cube = useMemo(() => buildCube(dataset.songs, dataset.axes), [dataset]);
  const ratedCount = useMemo(() => dataset.songs.filter((s) => s.feel).length, [dataset]);

  // `ui` changes with every keystroke; the other fields keep their identity, so these are the real dependencies
  const filters = [
    ui.tab, ui.facet, ui.stars, ui.lovedOnly, ui.decade, ui.country, ui.playlist, ui.category, ui.inItunes, ui.sort,
    ui.feel.ranges, ui.feel.confidence, ui.cube.ranges, ui.cube.maturity, deferredQuery,
  ];
  const rows: readonly (Song | ArchiveRow)[] = useMemo(
    () =>
      isSongTab(ui.tab)
        ? filterSongs(dataset, songFilterOf(ui, deferredQuery, cube), ui.sort)
        : filterArchive(dataset, archiveFilterOf(ui, deferredQuery), ui.sort),
    // `filters` lists the parts of `ui` it reads (the list itself must not be rebuilt on every keystroke)
    [dataset, cube, playlistRev, ...filters],
  );
  // the list goes back to the top when a filter changes, but not when the data is refreshed or a rated song leaves a playlist
  const scrollKey = useMemo(() => ({}), filters);

  const songRows = useMemo(() => (isSongTab(ui.tab) ? (rows as readonly Song[]) : NO_SONGS), [rows, ui.tab]);

  // ---- the player ----
  const player = useAudioPlayer(songRows, volume);
  const { markStale, pause } = player;
  useEffect(() => markStale(), [rows, markStale]); // the list changed: the song playing goes on, the next one comes from the new list
  useEffect(() => {
    if (ui.tab === "archive") pause(); // archive songs are on CDs; nothing plays there
  }, [ui.tab, pause]);

  const [pinged, setPinged] = useState<string | null>(null);
  const pingTimer = useRef<number | undefined>(undefined);
  /** Scrolls the list to the playing song and flashes its row. */
  const showNow = () => {
    const song = player.queue.current;
    if (!song) return;
    const at = songRows.findIndex((o) => o.path === song.path);
    if (at < 0) return flash("The playing song is not in the current results");
    table.current?.scrollToIndex(at);
    setPinged(null);
    requestAnimationFrame(() => setPinged(song.path));
    window.clearTimeout(pingTimer.current);
    pingTimer.current = window.setTimeout(() => setPinged(null), 1500);
  };
  // Next, Previous and a click on a dot show the song they land on, which is known one render later
  const wantShow = useRef(false);
  useEffect(() => {
    if (wantShow.current && player.queue.current) {
      wantShow.current = false;
      showNow();
    }
    // runs when a new song starts
  }, [player.queue.serial]);
  // Songs are streamed by the helper. Without it every song would fail to load and the player would skip through the list, so say so instead
  // (asking again first: start serve.bat, click a song, and it plays).
  const ensureHelper = helper.ensure;
  const { start: startSong, toggle: toggleSong, notice } = player;
  const tryStart = async (index: number | null) => {
    if (!(await ensureHelper())) return notice("Playing needs the helper: start serve.bat (this page notices when it is up)", 5000);
    startSong(index);
  };
  const playOrPause = () => (player.queue.current ? toggleSong() : void tryStart(null));
  const playDot = (song: Song) => {
    const i = songRows.indexOf(song);
    if (i < 0) return;
    wantShow.current = true;
    void tryStart(i);
  };
  // playback gave up after several failures: perhaps the helper has stopped
  const { recheck } = helper;
  const gaveUp = player.queue.halted === "errors";
  useEffect(() => {
    if (gaveUp) void recheck();
  }, [gaveUp, recheck]);

  // the space bar plays and pauses, unless you are typing or on a control
  const playOrPauseRef = useRef(playOrPause);
  useEffect(() => {
    playOrPauseRef.current = playOrPause;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || /INPUT|SELECT|BUTTON|SUMMARY/.test((e.target as HTMLElement).tagName)) return;
      e.preventDefault();
      playOrPauseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // ---- rating ----
  const [fx, setFx] = useState<Record<number, "rated" | "out">>({}); // rows that were rated from a To Rate playlist and are about to leave it
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);
  const later = (ms: number, fn: () => void) => void timers.current.push(window.setTimeout(fn, ms));

  const rate = async (song: Song, clicked: number) => {
    if (!(await ensureHelper())) return flash("Rating needs the helper (serve.bat talks to iTunes)");
    const stars = starsAfterClick(song.stars, clicked);
    const from = playlistToRateFrom(ui.playlist, dataset.playlists.map((p) => p.name), stars);
    flash(`Setting ${stars} stars in iTunes…`);
    const r = await helperApi.rateSong({ path: song.path, name: song.name, stars, from_playlist: from });
    if (!r.ok) return flash(`Not changed: ${r.error}`);
    setSongStars(song, r.stars);
    redraw();
    if (!from || !r.removed) return flash(`${song.name}: ${r.stars} stars`);
    // rated from the to-rate list: the row turns green, then slides out; the playlist is updated here and in iTunes
    setFx((f) => ({ ...f, [song.ix]: "rated" }));
    flash(`Rated ${r.stars}★ and removed from the playlist`);
    later(1000, () => {
      setFx((f) => ({ ...f, [song.ix]: "out" }));
      later(450, () => {
        removeFromPlaylist(dataset, from, song.ix);
        playlistChanged();
        setFx(({ [song.ix]: _gone, ...rest }) => rest);
      });
    });
  };

  // ---- save as playlist, refresh ----
  const savePlaylist = async () => {
    const text = await saveAsPlaylist({
      songs: songRows,
      iTunesPlaylists: dataset.playlists.map((p) => p.name),
      ui: { prompt: (m) => window.prompt(m, ""), confirm: (m) => window.confirm(m) },
      save: (req) => helperApi.savePlaylist(req),
    });
    if (text) flash(text);
  };

  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    try {
      if (helper.available) {
        flash("Rebuilding from iTunes (the list stays usable)…");
        const built = await helperApi.rebuild();
        if (!built.ok) return flash(`Rebuild failed: ${built.error}`);
      }
      const before = dataset.songs.length;
      const next = await reload();
      if (!next) return flash("Couldn't reload data.js");
      const d = next.songs.length - before;
      flash(
        (next.built ? `Data from ${next.built} · ` : "") + (d ? `${d > 0 ? "+" : ""}${d} tracks` : "no new tracks") +
          (helper.available ? "" : " (not rebuilt: start serve.bat to rebuild from here)"),
      );
    } finally {
      setRefreshing(false);
    }
  };

  // ---- what the table shows ----
  const group = groupOf(ui.tab, ui.feel.graph);
  const columns = useMemo(() => columnsOf(group).filter((c) => !HIDDEN_BY_DEFAULT[group].has(c.key)), [group]);
  const feelTab = ui.tab === "feel" || ui.tab === "cube";
  const total = ui.tab === "archive" ? dataset.archive.length : feelTab ? ratedCount : dataset.songs.length;

  // the graph: the cube on Feel Axes, or the first narrowed scales on Raw Feel with "Show graph"
  const model: GraphModel | null = useMemo(() => {
    if (ui.tab === "cube") return cube ? cubeModel(cube, cubeBoxOf(ui, cube), dataset.feelStats) : null;
    if (ui.tab === "feel" && ui.feel.graph) return feelModel(ui.feel.order, ui.feel.ranges, dataset.feelStats);
    return null;
    // `ui` is read through its parts below
  }, [ui.tab, cube, ui.cube.ranges, ui.cube.maturity, ui.feel.graph, ui.feel.order, ui.feel.ranges, dataset.feelStats]);

  const onCellClick = (row: Song | ArchiveRow, column: Column, e: MouseEvent, index: number) => {
    if (column.key === "path") {
      void copyText(row.path).then(() => flash("Copied path"));
      return;
    }
    const selecting = !!window.getSelection()?.toString(); // the user is selecting text, not picking
    const kind = FACET_COLUMNS[column.key];
    if (kind && !selecting) {
      const value = kind === "volume" ? ("volume" in row ? row.volume : "") : row[kind];
      if (value) return dispatch({ type: "facet", kind, value, keep: e.ctrlKey || e.metaKey });
    }
    if (selecting || !isSongTab(ui.tab)) return;
    void tryStart(index);
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

  const playing = player.queue.current;
  const rowClass = (row: Song | ArchiveRow): string | undefined => {
    const c: string[] = [];
    if (playing && row.path === playing.path) c.push("now");
    const f = "feel" in row ? fx[row.ix] : undefined;
    if (f) c.push(f === "out" ? "rated out" : "rated");
    if (pinged === row.path) c.push("ping");
    return c.join(" ") || undefined;
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
          <span className="preview" title="The React rebuild, slice 4: the player, rating and Save as playlist">React preview</span>
          <Tabs tab={ui.tab} onChange={(tab) => dispatch({ type: "tab", tab })} />
          <div className="acts">
            {helper.available === false && (
              <span className="nohelper" title="The Python helper (serve.bat) streams the songs and talks to iTunes. Start it and this note goes away.">
                ⚠ helper not running
              </span>
            )}
            <span className="rmsg" role="status">{message}</span>
            <button
              type="button"
              disabled={refreshing}
              title="Rebuild from iTunes and swap in the new data without reloading the page (needs serve.bat; otherwise just reloads data.js)"
              onClick={() => void refresh()}
            >
              {refreshing ? "⟳ Refreshing…" : "⟳ Refresh data"}
            </button>
          </div>
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
          onSavePlaylist={isSongTab(ui.tab) && helper.available ? () => void savePlaylist() : undefined}
        />
        {ui.tab === "feel" && <FeelPanel feel={ui.feel} dispatch={dispatch} />}
        {ui.tab === "cube" && <CubeControls cube={cube} ui={ui.cube} dispatch={dispatch} />}
        <FilterRow dataset={dataset} state={ui} dispatch={dispatch} />
        {isSongTab(ui.tab) && (
          <PlayerBar
            text={player.text}
            path={playing?.path}
            paused={player.status.paused}
            time={player.status.time}
            duration={player.status.duration}
            shuffle={player.queue.shuffle}
            vol={volume.vol}
            muted={volume.muted}
            onPrev={() => { wantShow.current = true; player.prev(); }}
            onNext={() => { wantShow.current = true; player.next(); }}
            onStop={player.stop}
            onToggle={playOrPause}
            onShuffle={() => player.setShuffle(!player.queue.shuffle)}
            onNow={showNow}
            onSeek={player.seekTo}
            onSkip={player.skipBy}
            onVolume={volume.setVol}
            onVolumeBy={volume.changeBy}
            onMute={volume.toggleMute}
            onHint={flash}
          />
        )}
      </header>
      <main className="split">
        <div className="listpane">
          <DataTable
            handle={table}
            rows={rows}
            columns={columns}
            sort={ui.sort}
            onSort={(key) => dispatch({ type: "sort", key })}
            scrollResetKey={scrollKey}
            renderCell={(row, column) =>
              column.key === "stars" && "feel" in row ? <Stars n={row.stars} onRate={(k) => void rate(row, k)} /> : cellText(row, column.key)
            }
            cellTitle={cellTitle}
            cellStyle={cellStyle}
            rowClass={rowClass}
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
            nowSong={playing}
            onDotClick={playDot}
          />
        )}
      </main>
    </>
  );
}
