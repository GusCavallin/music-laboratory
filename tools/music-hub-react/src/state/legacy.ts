import { groupOf, hasColumn } from "../columns";
import { FEEL_SCALES } from "../data/feel";
import { noFacet, noSort } from "../data/filter";
import type { ConfidenceChoice } from "../data/feel";
import { PAIRS, updateFeelOrder } from "../feel/pairs";
import { initialUiState, type Tab, type UiState } from "./uiState";

/**
 * Presets and the remembered session are stored in the format of the current page (tools/music-hub/index.html): every filter value is a string, as the
 * page read it from its controls. This app keeps that format on disk, so the presets already saved in presets.json keep working here and in the
 * current page, and a preset saved here can be applied there. These functions turn that format into the state of this app and back.
 */
export interface LegacyView {
  tab: Tab;
  /** the controls' values: q, pl, stars, starsmax, dec, cty, cat, inits, fl_conf, fl_color and fl_<scale>_lo / _hi */
  f: Record<string, string>;
  loved: boolean;
  facet: { artist: string | null; album: string | null; volume: string | null };
  /** the Feel Axes box: "0", "1", "2" (the axes) and "m" (maturity), each [from, to] */
  cx?: Record<string, [string, string]>;
  /** the Show graph switch */
  g: boolean;
  /** the scales whose slider is narrowed, in the order they were narrowed */
  fo: number[];
  /** the pairs whose link is on */
  lk?: string[];
  sort: { k: string | null; d: number };
}

const TABS: readonly Tab[] = ["itunes", "feel", "cube", "archive"];
const CONFIDENCES: readonly ConfidenceChoice[] = ["all", "low", "medium", "high"];

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown, fallback: string): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : fallback);
const num = (v: unknown, fallback: number): number => {
  const n = typeof v === "string" && v.trim() === "" ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** A range from two stored numbers, kept inside lo..hi and in order. */
function range(a: unknown, b: unknown, fallback: [number, number], lo: number, hi: number): [number, number] {
  const from = clamp(num(a, fallback[0]), lo, hi);
  const to = clamp(num(b, fallback[1]), lo, hi);
  return [Math.min(from, to), Math.max(from, to)];
}

const sameRange = (a: readonly [number, number], b: readonly [number, number]) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;

/**
 * A saved view applied on top of `base`. Anything missing or unusable keeps the value `base` has, as in the current page; a value that is
 * there is checked (a confidence the menu does not offer means All, a sort on a column the tab does not have is dropped).
 * `cubeBounds` (the extent of the three Feel Axes) lets a box that covers the whole cube be stored as "the whole cube".
 */
export function legacyToView(saved: unknown, base: UiState = initialUiState(), cubeBounds?: readonly (readonly [number, number])[]): UiState {
  if (!isRecord(saved)) return base;
  const f: Record<string, unknown> = isRecord(saved.f) ? saved.f : {};
  const tab: Tab = TABS.includes(saved.tab as Tab) ? (saved.tab as Tab) : base.tab;

  const ranges = FEEL_SCALES.map((s, i) => range(f[`fl_${s.key}_lo`], f[`fl_${s.key}_hi`], base.feel.ranges[i] ?? [0, 10], 0, 10));
  const confidence = CONFIDENCES.includes(f.fl_conf as ConfidenceChoice) ? (f.fl_conf as ConfidenceChoice) : "all"; // an older page stored 1, 2, 3: back to All
  const linked = Array.isArray(saved.lk) ? saved.lk.filter((n): n is string => typeof n === "string" && PAIRS.some((p) => p.name === n)) : base.feel.linked;
  const fo = Array.isArray(saved.fo) ? saved.fo.filter((i): i is number => Number.isInteger(i) && i >= 0 && i < FEEL_SCALES.length) : [];
  const graph = !!saved.g;

  let cube = base.cube;
  if (isRecord(saved.cx)) {
    const cx = saved.cx;
    const at = (k: string): [number, number] | null => {
      const r = cx[k];
      return Array.isArray(r) && r.length === 2 ? range(r[0], r[1], [0, 0], -Infinity, Infinity) : null;
    };
    const axes = ["0", "1", "2"].map(at);
    let boxRanges: [number, number][] | null = axes.every((r): r is [number, number] => r !== null) ? axes : base.cube.ranges;
    if (boxRanges && cubeBounds && boxRanges.every((r, i) => cubeBounds[i] && sameRange(r, cubeBounds[i]!))) boxRanges = null;
    const m = at("m");
    cube = { ...base.cube, ranges: boxRanges, maturity: m ? [clamp(m[0], 0, 10), clamp(m[1], 0, 10)] : base.cube.maturity };
  }

  const f2 = saved.facet;
  const facet = isRecord(f2)
    ? { artist: typeof f2.artist === "string" && f2.artist ? f2.artist : null, album: typeof f2.album === "string" && f2.album ? f2.album : null, volume: typeof f2.volume === "string" ? f2.volume : null }
    : noFacet();

  const next: UiState = {
    ...base,
    tab,
    query: text(f.q, base.query),
    playlist: text(f.pl, base.playlist),
    stars: range(f.stars, f.starsmax, base.stars, 0, 5),
    lovedOnly: !!saved.loved,
    decade: text(f.dec, base.decade),
    country: text(f.cty, base.country),
    category: text(f.cat, base.category),
    inItunes: f.inits === "in" || f.inits === "out" ? f.inits : "any",
    facet,
    sort: noSort(),
    feel: {
      ranges, confidence, linked, graph,
      order: [],
      color: f.fl_color === "raw" ? "raw" : "dev",
    },
    cube,
  };
  next.feel.order = updateFeelOrder(fo, ranges, new Set(linked));

  const s = saved.sort;
  if (isRecord(s) && typeof s.k === "string" && hasColumn(groupOf(next.tab, next.feel.graph), s.k)) next.sort = { key: s.k, desc: !!s.d };
  return next;
}

/** The view in the stored format. `cubeBounds` are the extent of the three axes (the box written when it is "the whole cube"); omit when there is no cube. */
export function viewToLegacy(ui: UiState, cubeBounds?: readonly (readonly [number, number])[]): LegacyView {
  const f: Record<string, string> = {
    q: ui.query, pl: ui.playlist, stars: String(ui.stars[0]), starsmax: String(ui.stars[1]), dec: ui.decade, cty: ui.country, cat: ui.category,
    inits: ui.inItunes === "any" ? "" : ui.inItunes, fl_conf: ui.feel.confidence, fl_color: ui.feel.color,
  };
  FEEL_SCALES.forEach((s, i) => {
    f[`fl_${s.key}_lo`] = String(ui.feel.ranges[i]?.[0] ?? 0);
    f[`fl_${s.key}_hi`] = String(ui.feel.ranges[i]?.[1] ?? 10);
  });
  const view: LegacyView = {
    tab: ui.tab, f, loved: ui.lovedOnly, facet: { ...ui.facet }, g: ui.feel.graph, fo: [...ui.feel.order], lk: [...ui.feel.linked],
    sort: { k: ui.sort.key, d: ui.sort.desc ? 1 : 0 },
  };
  const boxRanges = ui.cube.ranges ?? cubeBounds;
  if (boxRanges && boxRanges.length >= 3) {
    view.cx = {
      "0": [String(boxRanges[0]![0]), String(boxRanges[0]![1])],
      "1": [String(boxRanges[1]![0]), String(boxRanges[1]![1])],
      "2": [String(boxRanges[2]![0]), String(boxRanges[2]![1])],
      m: [String(ui.cube.maturity[0]), String(ui.cube.maturity[1])],
    };
  }
  return view;
}
