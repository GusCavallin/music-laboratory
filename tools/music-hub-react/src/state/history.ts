import { initialUiState, reduce, type Action, type UiState } from "./uiState";

/**
 * Back and forward through the views. A view is remembered when a click on an artist, album or CD replaces the filters, or when a preset is applied, so
 * "← back" undoes it. Going back remembers the view it left, so "forward" can return to it; any new view of those two kinds forgets what was ahead.
 */
export interface HistoryState {
  ui: UiState;
  /** what "back" returns to, the latest last */
  hist: UiState[];
  /** what a "back" just undid, the latest last */
  fwd: UiState[];
}

export const MAX_HISTORY = 20;

export const initialHistory = (ui: UiState = initialUiState()): HistoryState => ({ ui, hist: [], fwd: [] });

export type HistoryAction =
  | Action
  | { type: "back" }
  | { type: "forward" }
  /** a preset (or any whole view) applied: remembered, so back undoes it */
  | { type: "apply"; view: UiState };

/** The view put back keeps the Cube / Flat choice you have now: that is a way of looking, not part of the filters. */
const restore = (from: UiState, now: UiState): UiState => ({ ...from, cube: { ...from.cube, view: now.cube.view } });

const remember = (h: HistoryState): UiState[] => [...h.hist, h.ui].slice(-MAX_HISTORY);

export function historyReducer(h: HistoryState, a: HistoryAction): HistoryState {
  switch (a.type) {
    case "back": {
      const prev = h.hist[h.hist.length - 1];
      return prev ? { ui: restore(prev, h.ui), hist: h.hist.slice(0, -1), fwd: [...h.fwd, h.ui] } : h;
    }
    case "forward": {
      const next = h.fwd[h.fwd.length - 1];
      return next ? { ui: restore(next, h.ui), hist: [...h.hist, h.ui], fwd: h.fwd.slice(0, -1) } : h;
    }
    case "apply":
      return { ui: a.view, hist: remember(h), fwd: [] };
    case "facet":
      return { ui: reduce(h.ui, a), hist: remember(h), fwd: [] };
    default: {
      const ui = reduce(h.ui, a);
      return ui === h.ui ? h : { ...h, ui };
    }
  }
}
