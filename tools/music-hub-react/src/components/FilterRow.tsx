import type { Dispatch } from "react";
import { archiveCounts, categoryOptions, countryOptions, decadeOptions } from "../data/options";
import type { Dataset } from "../data/types";
import type { Action, UiState } from "../state/uiState";

interface Props {
  dataset: Dataset;
  state: UiState;
  dispatch: Dispatch<Action>;
}

const STAR_CHOICES = [0, 1, 2, 3, 4, 5];

/** The filters under the search box: those of the iTunes tab, or those of the archive tab. */
export function FilterRow({ dataset, state, dispatch }: Props) {
  return state.tab === "itunes" ? <SongFilters dataset={dataset} state={state} dispatch={dispatch} /> : <ArchiveFilters dataset={dataset} state={state} dispatch={dispatch} />;
}

function SongFilters({ dataset, state, dispatch }: Props) {
  const decades = decadeOptions(dataset);
  const countries = countryOptions(dataset);
  return (
    <div className="row filters">
      <label>
        Playlist{" "}
        <input
          type="search"
          className="pl"
          list="playlists"
          placeholder="any (type to filter)"
          autoComplete="off"
          spellCheck={false}
          value={state.playlist}
          onChange={(e) => dispatch({ type: "playlist", value: e.target.value })}
        />
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
