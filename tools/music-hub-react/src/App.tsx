import { useCallback, useDeferredValue, useEffect, useMemo, useReducer, useRef, useState, type MouseEvent } from "react";
import * as helperApi from "./api/helper";
import { copyText } from "./clipboard";
import { cellText, columnsOf, FACET_COLUMNS, feelTip, groupOf, scoreBackground, type Column } from "./columns";
import { AboutDialog } from "./components/AboutDialog";
import { ColumnMenu } from "./components/ColumnMenu";
import { CubeControls } from "./components/CubeControls";
import { DataTable, type DataTableHandle } from "./components/DataTable";
import { FeelPanel } from "./components/FeelPanel";
import { FilterRow } from "./components/FilterRow";
import { GraphPanel } from "./components/GraphPanel";
import { PlayerBar } from "./components/PlayerBar";
import { PresetsControl } from "./components/PresetsControl";
import { SearchBar } from "./components/SearchBar";
import { Stars } from "./components/Stars";
import { Tabs } from "./components/Tabs";
import { feelColumnIndex } from "./data/feel";
import { filterArchive, filterSongs } from "./data/filter";
import { removeFromPlaylist, setSongStars } from "./data/mutate";
import { categoryOptions, countryOptions, decadeOptions } from "./data/options";
import type { ArchiveRow, Dataset, Song } from "./data/types";
import { buildCube } from "./feel/cube";
import { cubeModel, feelModel, type GraphModel } from "./feel/model";
import { useFlash } from "./hooks/useFlash";
import { useHelper } from "./hooks/useHelper";
import { useHistoryButtons } from "./hooks/useHistoryButtons";
import { useLibrary } from "./hooks/useLibrary";
import { saveAsPlaylist } from "./playlist/saveFlow";
import { useAudioPlayer } from "./player/useAudioPlayer";
import { useVolume } from "./player/useVolume";
import * as presetOps from "./presets/presets";
import { usePresets } from "./presets/usePresets";
import { playlistToRateFrom, starsAfterClick } from "./rating";
import { trackTip } from "./data/format";
import { loadPrefs, moveColumn, resetColumnWidth, resetOrder, savePrefs, setColumnShown, setColumnWidth, visibleColumns } from "./state/columnPrefs";
import { historyReducer, initialHistory } from "./state/history";
import { legacyToView, viewToLegacy } from "./state/legacy";
import { fitToLibrary, fromSession, loadSession, toSession, writeSession } from "./state/session";
import { archiveFilterOf, cubeBoxOf, isSongTab, songFilterOf, type UiState } from "./state/uiState";
import { playlistsOf } from "./tips/tips";
import { TipLayer } from "./tips/TipLayer";

export function App() {
  const { state, reload } = useLibrary();
  if (state.status === "loading") return <p className="status">Loading data.js…</p>;
  if (state.status === "error") {
    return (
      <p className="status">
        Couldn't load data.js ({state.message}). Build it with <code>py -3 tools\music-hub-core\build_data.py</code>, or point
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

export function Library({ dataset, reload }: { dataset: Dataset; reload: () => Promise<Dataset | null> }) {
  // the view of the last visit (the page opens as it was left); `hist` and `fwd` are what the "← back" chip and the mouse buttons go through
  const [boot] = useState(() => {
    const saved = fromSession(loadSession());
    const names = dataset.playlists.map((p) => p.name);
    return { ...saved, ui: fitToLibrary(saved.ui, { playlists: names, decades: decadeOptions(dataset), countries: countryOptions(dataset), categories: categoryOptions(dataset) }) };
  });
  const [{ ui, hist, fwd }, dispatch] = useReducer(historyReducer, boot.ui, initialHistory);
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

  // On the archive tab (songs on CDs, nothing to start) the player goes on with the list it had: the songs of the last tab that has songs.
  const lastSongRows = useRef<readonly Song[]>(NO_SONGS);
  const onSongTab = isSongTab(ui.tab);
  const songRows = onSongTab ? (rows as readonly Song[]) : lastSongRows.current;
  useEffect(() => {
    lastSongRows.current = songRows;
  });

  // ---- the player ----
  const player = useAudioPlayer(songRows, volume, boot.shuffle);
  const { markStale, restore } = player;
  // the list changed: the song playing goes on, the next one comes from the new list (not on the first render, which only repeats under StrictMode;
  // not on the archive tab, whose rows are not songs to play: coming back to a song tab the lists differ, and that is when it counts)
  const lastRows = useRef(rows);
  useEffect(() => {
    if (!onSongTab || lastRows.current === rows) return;
    lastRows.current = rows;
    markStale();
  }, [rows, onSongTab, markStale]);

  // the song of the last visit comes back paused at its position (a page must not start playing by itself); press play to go on
  const restoreTried = useRef(false);
  const sessionSettled = useRef(!boot.song); // the session is not saved until the song is back, or known not to come back
  useEffect(() => {
    if (restoreTried.current) return;
    restoreTried.current = true;
    const saved = boot.song;
    const song = saved && dataset.songs.find((s) => s.path === saved.path);
    if (!saved || !song || song.protected) {
      sessionSettled.current = true;
      return;
    }
    restore(song, songRows.findIndex((s) => s.path === song.path), saved.t);
  }, [boot.song, dataset, restore, songRows]);

  // remember the view and the song, as the page is used and when it is closed (the position is kept up to date while playing)
  const sessionNow = useRef({ ui, shuffle: player.queue.shuffle, song: player.queue.current, time: player.status.time, serial: player.queue.serial });
  useEffect(() => {
    sessionNow.current = { ui, shuffle: player.queue.shuffle, song: player.queue.current, time: player.status.time, serial: player.queue.serial };
  });
  const saveSession = useCallback(() => {
    const { ui, shuffle, song, time, serial } = sessionNow.current;
    if (song || serial > 0) sessionSettled.current = true; // the song is back (or it was started, or it would not load and was dropped)
    if (!sessionSettled.current) return;
    writeSession(toSession(ui, shuffle, song ? { path: song.path, t: Math.floor(time) } : null));
  }, []);
  const playingPath = player.queue.current?.path;
  useEffect(() => saveSession(), [ui, player.queue.shuffle, playingPath, player.queue.serial, saveSession]);
  const playingNow = !player.status.paused;
  useEffect(() => {
    if (!playingNow) return;
    const id = window.setInterval(saveSession, 3000);
    return () => window.clearInterval(id);
  }, [playingNow, saveSession]);
  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && saveSession();
    window.addEventListener("pagehide", saveSession);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", saveSession);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [saveSession]);

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
      if (ui.tab !== "archive") showNow(); // the archive tab has no row for the song: stay there
    }
    // runs when a new song starts
  }, [player.queue.serial]);
  // A click on the song's name goes to its row. The playing song is in the iTunes Library, so from the archive tab that means changing tab (every other
  // tab stays as it is); the row is shown once that tab is on screen.
  const wantShowOnTab = useRef(false);
  useEffect(() => {
    if (wantShowOnTab.current && ui.tab !== "archive") {
      wantShowOnTab.current = false;
      showNow();
    }
  }, [ui.tab]);
  const onNow = () => {
    if (ui.tab === "archive") {
      wantShowOnTab.current = true;
      dispatch({ type: "tab", tab: "itunes" });
    } else showNow();
  };
  // Songs are streamed by the helper. Without it every song would fail to load and the player would skip through the list, so say so instead
  // (asking again first: start serve.bat, click a song, and it plays).
  const ensureHelper = helper.ensure;
  const { start: startSong, toggle: toggleSong, notice } = player;
  /** Nothing can be started on the archive tab (its songs are on CDs); what is already playing goes on. */
  const canStart = () => {
    if (ui.tab !== "archive" || player.queue.current) return true;
    flash("Archive songs are on CDs, so they can't be played here");
    return false;
  };
  const tryStart = async (index: number | null) => {
    if (ui.tab === "archive") return void flash("Archive songs are on CDs, so they can't be played here");
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

  // ---- presets: saved views ----
  const bounds = useMemo(() => (cube ? cube.lo.map((lo, i): [number, number] => [lo, cube.hi[i]!]) : undefined), [cube]);
  const presets = usePresets(helper.available, flash);
  const asked = { prompt: (m: string, initial: string) => window.prompt(m, initial), confirm: (m: string) => window.confirm(m) };
  const currentState = (): presetOps.Preset["state"] => ({ ...viewToLegacy(ui, bounds) });
  const applyPreset = (index: number) => {
    const p = presets.presets[index];
    if (!p) return;
    const names = dataset.playlists.map((x) => x.name);
    const view: UiState = fitToLibrary(legacyToView(p.state, undefined, bounds), {
      playlists: names, decades: decadeOptions(dataset), countries: countryOptions(dataset), categories: categoryOptions(dataset),
    });
    dispatch({ type: "apply", view: { ...view, cube: { ...view.cube, view: ui.cube.view } } }); // the Cube / Flat choice is a way of looking, not part of a view
  };
  const savePreset = (name: string): boolean => {
    const r = presetOps.saveAs(presets.presets, name, currentState());
    if (!r) return false;
    presets.save(r.list);
    flash(r.updated ? "Preset updated" : "Preset saved");
    return true;
  };

  // ---- back and forward through the views ("← back", the mouse buttons, Alt+Left and Alt+Right) ----
  const goBack = () => {
    if (!hist.length) return false;
    dispatch({ type: "back" });
    return true;
  };
  const goForward = () => {
    if (!fwd.length) return false;
    dispatch({ type: "forward" });
    return true;
  };
  useHistoryButtons(goBack, goForward, flash);
  const [aboutOpen, setAboutOpen] = useState(false);
  const closeAbout = useCallback(() => setAboutOpen(false), []);
  // The version of the code running now comes from the helper (it reads the VERSION file each time); data.js only has the one it was built with.
  // Asked at the start and again whenever the box opens or closes, so an update shows without a Refresh.
  const [liveVersion, setLiveVersion] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    void helperApi.loadVersion().then((v) => {
      if (current && v !== null) setLiveVersion(v);
    });
    return () => {
      current = false;
    };
  }, [aboutOpen]);

  // ---- what the table shows ----
  const group = groupOf(ui.tab, ui.feel.graph);
  const [prefs, setPrefs] = useState(() => loadPrefs());
  const changePrefs = (next: typeof prefs) => {
    setPrefs(next);
    savePrefs(next);
  };
  const columns = useMemo(() => visibleColumns(group, prefs), [group, prefs]);
  const allColumns = useMemo(() => prefs.order[group].map((k) => columnsOf(group).find((c) => c.key === k)!), [group, prefs]);
  const [colMenu, setColMenu] = useState<{ x: number; y: number } | null>(null);
  const closeColMenu = useCallback(() => setColMenu(null), []);
  const showColumn = (key: string, shown: boolean) => {
    const next = setColumnShown(prefs, group, key, shown);
    if (next === prefs) return flash("At least one column stays");
    changePrefs(next);
    if (!shown && ui.sort.key === key) dispatch({ type: "dropSort" }); // a sort on a column that is gone ends
  };
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
    if (selecting) return;
    void tryStart(index);
  };

  const cellTitle = (row: Song | ArchiveRow, column: Column): string | undefined => {
    if (feelColumnIndex(column.key) !== null) return "feel" in row ? feelTip(row, column.key, dataset.feelStats) || undefined : undefined;
    if (column.key === "track" && "disc" in row) return trackTip(row) || undefined; // "Disc 2 - Track 5 of 12"
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

  // hovering a song's name also lists the playlists it is in
  const songPlaylists = (el: HTMLElement): readonly string[] => {
    if (el.tagName !== "TD" || el.dataset.k !== "name" || !isSongTab(ui.tab)) return [];
    const row = rows[Number(el.closest("tr")?.dataset.i)];
    return row && "feel" in row ? playlistsOf(dataset, row) : [];
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
          <span className="preview" data-tip="The React version of Music Hub: it has its own helper (port 9223) and can be installed as an app">React</span>
          <Tabs tab={ui.tab} onChange={(tab) => dispatch({ type: "tab", tab })} />
          <div className="acts">
            {helper.available === false && (
              <span className="nohelper" data-tip="The Python helper (serve.bat) streams the songs and talks to iTunes. Start it and this note goes away.">
                ⚠ helper not running
              </span>
            )}
            <span className="rmsg" role="status" data-tip={message || undefined}>{message}</span>
            <button
              type="button"
              disabled={refreshing}
              data-tip="Rebuild from iTunes and swap in the new data without reloading the page (needs serve.bat; otherwise just reloads data.js)"
              onClick={() => void refresh()}
            >
              {refreshing ? "⟳ Refreshing…" : "⟳ Refresh data"}
            </button>
            <button type="button" data-tip="About Music Hub" onClick={() => setAboutOpen(true)}>ⓘ About</button>
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
          onBack={hist.length ? goBack : undefined}
          after={
            <PresetsControl
              presets={presets.presets}
              onSave={savePreset}
              onApply={applyPreset}
              onReplace={(i) => {
                presets.save(presetOps.replaceState(presets.presets, i, currentState()));
                flash("Preset replaced");
              }}
              onRename={(i) => {
                const next = presetOps.renameWithPrompt(presets.presets, i, asked);
                if (next) presets.save(next);
              }}
              onDelete={(i) => {
                const next = presetOps.removeWithConfirm(presets.presets, i, asked);
                if (next) presets.save(next);
              }}
            />
          }
        />
        {ui.tab === "feel" && <FeelPanel feel={ui.feel} dispatch={dispatch} />}
        {ui.tab === "cube" && <CubeControls cube={cube} ui={ui.cube} dispatch={dispatch} />}
        <FilterRow dataset={dataset} state={ui} dispatch={dispatch} />
        <PlayerBar
          text={player.text}
          path={playing?.path}
          paused={player.status.paused}
          time={player.status.time}
          duration={player.status.duration}
          shuffle={player.queue.shuffle}
          vol={volume.vol}
          muted={volume.muted}
          onPrev={() => { if (canStart()) { wantShow.current = true; player.prev(); } }}
          onNext={() => { if (canStart()) { wantShow.current = true; player.next(); } }}
          onStop={player.stop}
          onToggle={playOrPause}
          onShuffle={() => player.setShuffle(!player.queue.shuffle)}
          onNow={onNow}
          onSeek={player.seekTo}
          onSkip={player.skipBy}
          onVolume={volume.setVol}
          onVolumeBy={volume.changeBy}
          onMute={volume.toggleMute}
          onHint={flash}
        />
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
            onHeaderContextMenu={(e) => {
              e.preventDefault();
              setColMenu({ x: e.clientX, y: e.clientY });
            }}
            onMoveColumn={(from, to) => changePrefs(moveColumn(prefs, group, from, to))}
            onResizeColumn={(key, width) => changePrefs(setColumnWidth(prefs, group, key, width))}
            onResetColumnWidth={(key) => changePrefs(resetColumnWidth(prefs, group, key))}
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
      {colMenu && (
        <ColumnMenu
          columns={allColumns}
          hidden={prefs.hidden[group]}
          at={colMenu}
          onToggle={showColumn}
          onResetOrder={() => changePrefs(resetOrder(prefs, group))}
          onClose={closeColMenu}
        />
      )}
      <AboutDialog open={aboutOpen} version={liveVersion ?? dataset.version} built={dataset.built} onClose={closeAbout} />
      <TipLayer extra={songPlaylists} />
    </>
  );
}
