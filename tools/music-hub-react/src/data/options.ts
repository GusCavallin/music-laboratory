import { decadeOf } from "./format";
import type { Dataset } from "./types";

/** The distinct non-empty values, in plain text order (as the current page's menus list them). */
const distinctSorted = (values: Iterable<string>): string[] => [...new Set(values)].filter(Boolean).sort();

/** "1890s", "1950s", ...: the decades of the songs that have a year. */
export const decadeOptions = (ds: Dataset): string[] => distinctSorted(ds.songs.filter((s) => s.year).map((s) => decadeOf(s.year)));

export const countryOptions = (ds: Dataset): string[] => distinctSorted(ds.songs.map((s) => s.country));

export const categoryOptions = (ds: Dataset): string[] => distinctSorted(ds.archive.map((r) => r.category));

/** How many archive rows there are, and how many are also in iTunes (for the "In iTunes" menu). */
export function archiveCounts(ds: Dataset): { total: number; inItunes: number; notInItunes: number } {
  const inItunes = ds.archive.filter((r) => r.in_itunes).length;
  return { total: ds.archive.length, inItunes, notInItunes: ds.archive.length - inItunes };
}
