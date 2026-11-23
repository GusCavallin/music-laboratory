import { useState, type Dispatch } from "react";
import { archiveCounts, categoryOptions, countryOptions, decadeOptions } from "../data/options";
import type { Dataset } from "../data/types";
import type { Action, UiState } from "../state/uiState";

interface Props {
  dataset: Dataset;
  state: UiState;
  dispatch: Dispatch<Action>;
}

const STAR_CHOICES = [0, 1, 2, 3, 4, 5];

/** The filters under the search box: those of the iTunes songs (the three song tabs share them), or those of the archive tab. */
export function FilterRow({ dataset, state, dispatch }: Props) {
  return state.tab === "archive" ? <ArchiveFilters dataset={dataset} state={state} dispatch={dispatch} /> : <SongFilters dataset={dataset} state={state} dispatch={dispatch} />;
}

function SongFilters({ dataset, state, dispatch }: Props) {
  // The browser's list only offers playlists that match the box's text, so with one chosen it would offer just that one. When the box is
  // clicked with a playlist in it, the text is set aside (it becomes the placeholder) so the list offers them all; picking one switches,
  // clicking away restores the old one. `draft` is that set-aside state; null = show the real value. The × clears the filter.
  const [draft, setDraft] = useState<string | null>(null);
  const known = (name: string) => dataset.playlists.some((p) => p.name === name);
  const plText = draft ?? state.playlist;
  const decades = decadeOptions(dataset);
  const countries = countryOptions(dataset);
  return (
    <div className="row filters">
      <label>
        Playlist{" "}
        <span className="plwrap">
          <input
            type="search"
            className="pl"
            list="playlists"
            placeholder={draft === "" && known(state.playlist) ? state.playlist : "any (type to filter)"}
            autoComplete="off"
            spellCheck={false}
            aria-label="Playlist"
            value={plText}
            onFocus={() => known(plText) && setDraft("")}
            onMouseDown={() => known(plText) && setDraft("")}
            onKeyDown={(e) => (e.key === "ArrowDown" || e.key === "ArrowUp") && known(plText) && setDraft("")}
            onBlur={() => setDraft(null)}
            onChange={(e) => {
              setDraft(e.target.value);
              dispatch({ type: "playlist", value: e.target.value });
            }}
          />
          {plText !== "" && (
            <button
              type="button"
              className="plclear"
              aria-label="Show every song: no playlist"
              data-tip="No playlist (show every song)"
              onClick={() => {
                setDraft(null);
                dispatch({ type: "playlist", value: "" });
              }}
            >
              ×
            </button>
          )}
        </span>
        <datalist id="playlists">
          {dataset.playlists.map((p) => (
            <option key={p.name} value={p.name} label={`${p.ids.length.toLocaleString()} songs`} />
          ))}
        </datalist>
      </label>
      <label>
        Rating{" "}
        <select aria-label="Rating from" value={state.stars[0]} onChange={(e) => dispatch({ type: "starsFrom", value: Number(e.target.value) })}>
          {STAR_CHOICES.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>{" "}
        –{" "}
        <select aria-label="Rating to" value={state.stars[1]} onChange={(e) => dispatch({ type: "starsTo", value: Number(e.target.value) })}>
          {STAR_CHOICES.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <label>
        <input type="checkbox" checked={state.lovedOnly} onChange={(e) => dispatch({ type: "loved", value: e.target.checked })} /> Loved
      </label>
      <label>
        Decade{" "}
        <select value={state.decade} onChange={(e) => dispatch({ type: "decade", value: e.target.value })}>
          <option value="">any</option>
          {decades.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </label>
      <label>
        Country{" "}
        <select value={state.country} onChange={(e) => dispatch({ type: "country", value: e.target.value })}>
          <option value="">any</option>
          {countries.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
    </div>
  );
}

function ArchiveFilters({ dataset, state, dispatch }: Props) {
  const categories = categoryOptions(dataset);
  const n = archiveCounts(dataset);
  return (
    <div className="row filters">
      <label>
        Category{" "}
        <select value={state.category} onChange={(e) => dispatch({ type: "category", value: e.target.value })}>
          <option value="">any</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label>
        In iTunes{" "}
        <select value={state.inItunes} onChange={(e) => dispatch({ type: "inItunes", value: e.target.value as UiState["inItunes"] })}>
          <option value="any">any ({n.total.toLocaleString()})</option>
          <option value="in">in iTunes ({n.inItunes.toLocaleString()})</option>
          <option value="out">not in iTunes ({n.notInItunes.toLocaleString()})</option>
        </select>
      </label>
    </div>
  );
}
