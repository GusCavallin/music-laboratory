import type { Tab } from "../state/uiState";

/** A saved view: a name and the view in the stored format (state/legacy.ts), which the current page reads and writes too. */
export interface Preset {
  name: string;
  state: { tab?: Tab } & Record<string, unknown>;
}

export const TAB_LABEL: Record<string, string> = { itunes: "iTunes", feel: "Raw Feel", cube: "Feel Axes", archive: "Archive" };

const byName = (a: Preset, b: Preset) => a.name.localeCompare(b.name);

/** Is this what presets.json holds: a list of { name, state }? Anything else is not used. */
export function isPresetList(x: unknown): x is Preset[] {
  return Array.isArray(x) && x.every((p) => typeof p === "object" && p !== null && typeof p.name === "string" && typeof p.state === "object" && p.state !== null);
}

/**
 * Saves the current view under a name. A name that already exists (ignoring capitals) is updated and keeps its own spelling.
 * Returns the new list (in name order) and whether it was an update; null when the name is empty.
 */
export function saveAs(list: readonly Preset[], name: string, state: Preset["state"]): { list: Preset[]; updated: boolean } | null {
  const clean = name.trim();
  if (!clean) return null;
  const at = list.findIndex((p) => p.name.toLowerCase() === clean.toLowerCase());
  const next = at >= 0 ? list.map((p, i) => (i === at ? { name: p.name, state } : p)) : [...list, { name: clean, state }];
  return { list: next.sort(byName), updated: at >= 0 };
}

/** The same preset, with the current view in it. */
export const replaceState = (list: readonly Preset[], index: number, state: Preset["state"]): Preset[] =>
  list.map((p, i) => (i === index ? { name: p.name, state } : p));

/** Renames a preset (the list stays in name order). An empty name changes nothing. */
export function rename(list: readonly Preset[], index: number, name: string): Preset[] {
  const clean = name.trim();
  if (!clean || !list[index]) return [...list];
  return list.map((p, i) => (i === index ? { name: clean, state: p.state } : p)).sort(byName);
}

export const remove = (list: readonly Preset[], index: number): Preset[] => list.filter((_, i) => i !== index);

/** The browser's questions, injectable so that the flows can be tested. */
export interface PresetUi {
  prompt: (message: string, initial: string) => string | null;
  confirm: (message: string) => boolean;
}

/** Asks for a new name; null if you cancelled or typed nothing. */
export function renameWithPrompt(list: readonly Preset[], index: number, ui: PresetUi): Preset[] | null {
  const p = list[index];
  if (!p) return null;
  const typed = ui.prompt("New name for this preset", p.name);
  return typed && typed.trim() ? rename(list, index, typed) : null;
}

/** Asks first; null if you declined. */
export function removeWithConfirm(list: readonly Preset[], index: number, ui: PresetUi): Preset[] | null {
  const p = list[index];
  return p && ui.confirm(`Delete the preset "${p.name}"?`) ? remove(list, index) : null;
}
