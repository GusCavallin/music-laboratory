import { columnsOf, HIDDEN_BY_DEFAULT, type Column, type ColumnGroup } from "../columns";

/**
 * Which columns are shown and in what order, for each set of columns (iTunes, Archive, Raw Feel, Feel Axes). Kept in this browser in the format of the
 * current page: "ls_hidden" (the hidden columns, and which columns the page has already seen) and "ls_order".
 */
export interface ColumnPrefs {
  hidden: Record<ColumnGroup, ReadonlySet<string>>;
  order: Record<ColumnGroup, readonly string[]>;
}

export const GROUPS: readonly ColumnGroup[] = ["itunes", "archive", "feel", "cube"];
export const HIDDEN_KEY = "ls_hidden";
export const ORDER_KEY = "ls_order";

export interface PrefsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const keysOf = (g: ColumnGroup): string[] => columnsOf(g).map((c) => c.key);
const each = <T,>(f: (g: ColumnGroup) => T): Record<ColumnGroup, T> => ({ itunes: f("itunes"), archive: f("archive"), feel: f("feel"), cube: f("cube") });

/** The columns as they come: the usual order, the usual ones hidden. */
export const defaultPrefs = (): ColumnPrefs => ({ hidden: each((g) => new Set(HIDDEN_BY_DEFAULT[g])), order: each(keysOf) });

/**
 * A saved order, brought up to date with the columns that exist now: columns that are gone are dropped, and a column that was added since goes just
 * before the next known column that follows it in the usual order (or last).
 */
export function mergeOrder(base: readonly string[], saved: readonly unknown[]): string[] {
  const out = saved.filter((k): k is string => typeof k === "string" && base.includes(k)).filter((k, i, a) => a.indexOf(k) === i);
  for (const m of base.filter((k) => !out.includes(k))) {
    const next = base.slice(base.indexOf(m) + 1).find((k) => out.includes(k));
    if (next) out.splice(out.indexOf(next), 0, m);
    else out.push(m);
  }
  return out;
}

const parse = (storage: PrefsStorage, key: string): Record<string, unknown> => {
  try {
    const v = JSON.parse(storage.getItem(key) ?? "{}");
    return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/**
 * Reads what was saved. A column the page had not seen when it saved (it is new since) starts hidden if it is hidden by default, as before; a column the
 * user chose to show stays shown.
 */
export function loadPrefs(storage: PrefsStorage | null = typeof localStorage === "undefined" ? null : localStorage): ColumnPrefs {
  const prefs = defaultPrefs();
  if (!storage) return prefs;
  let raw: Record<string, unknown>;
  let order: Record<string, unknown>;
  try {
    raw = parse(storage, HIDDEN_KEY);
    order = parse(storage, ORDER_KEY);
  } catch {
    return prefs;
  }
  const seen = (typeof raw.seen === "object" && raw.seen !== null ? raw.seen : {}) as Record<string, unknown>;
  const known = (g: ColumnGroup) => new Set(keysOf(g));
  const hidden = each((g) => {
    if (!(g in raw)) return new Set(HIDDEN_BY_DEFAULT[g]);
    const set = new Set(list(raw[g]).filter((k): k is string => typeof k === "string" && known(g).has(k)));
    for (const c of HIDDEN_BY_DEFAULT[g]) if (!list(seen[g]).includes(c)) set.add(c);
    return set;
  });
  return { hidden, order: each((g) => mergeOrder(keysOf(g), list(order[g]))) };
}

export function savePrefs(prefs: ColumnPrefs, storage: PrefsStorage | null = typeof localStorage === "undefined" ? null : localStorage): void {
  if (!storage) return;
  try {
    storage.setItem(HIDDEN_KEY, JSON.stringify({ ...each((g) => [...prefs.hidden[g]]), seen: each(keysOf) }));
    storage.setItem(ORDER_KEY, JSON.stringify(each((g) => [...prefs.order[g]])));
  } catch {
    /* not remembered */
  }
}

/** The columns on screen, in order. */
export function visibleColumns(group: ColumnGroup, prefs: ColumnPrefs): Column[] {
  const all = columnsOf(group);
  const hidden = prefs.hidden[group];
  return prefs.order[group].flatMap((k) => {
    const c = all.find((x) => x.key === k);
    return c && !hidden.has(k) ? [c] : [];
  });
}

/** Shows or hides one column. The last shown column cannot be hidden (the result is the same prefs object). */
export function setColumnShown(prefs: ColumnPrefs, group: ColumnGroup, key: string, shown: boolean): ColumnPrefs {
  const hidden = new Set(prefs.hidden[group]);
  if (shown) hidden.delete(key);
  else {
    hidden.add(key);
    if (columnsOf(group).every((c) => hidden.has(c.key))) return prefs;
  }
  return { ...prefs, hidden: { ...prefs.hidden, [group]: hidden } };
}

/** The dragged column takes the place of the one it is dropped on. */
export function moveColumn(prefs: ColumnPrefs, group: ColumnGroup, from: string, to: string): ColumnPrefs {
  const order = [...prefs.order[group]];
  const fi = order.indexOf(from);
  const ti = order.indexOf(to);
  if (from === to || fi < 0 || ti < 0) return prefs;
  order.splice(fi, 1);
  order.splice(ti, 0, from);
  return { ...prefs, order: { ...prefs.order, [group]: order } };
}

export function resetOrder(prefs: ColumnPrefs, group: ColumnGroup): ColumnPrefs {
  return { ...prefs, order: { ...prefs.order, [group]: keysOf(group) } };
}
