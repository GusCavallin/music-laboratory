/** Capitals and accents ignored: "Dvořák" matches "dvorak". */
export const fold = (s: string | null | undefined): string =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Punctuation as word breaks: "Spider-Man" becomes "spider man". */
export const spaced = (s: string): string =>
  fold(s)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** Punctuation joined: "A-ha" becomes "aha", "AC/DC" becomes "acdc". */
export const joined = (s: string): string =>
  fold(s)
    .replace(/[-'’./&]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** The searchable forms of a list of fields (padded with a space at each end, as the current page does). A typed term matches anywhere inside them. */
export function searchForms(fields: readonly (string | number)[]): { h: string; j: string } {
  const text = fields.join(" | ");
  return { h: ` ${spaced(text)} `, j: ` ${joined(text)} ` };
}

/** One typed word in both forms; a row matches a term if either form is found. */
export type SearchTerm = readonly [spaced: string, joined: string];

/** "Spider man" becomes [["spider","spider"],["man","man"]]; every term must match. */
export function parseTerms(query: string): SearchTerm[] {
  return fold(query)
    .split(/\s+/)
    .filter(Boolean)
    .map((t): SearchTerm => [spaced(t), joined(t)])
    .filter(([a, b]) => a !== "" || b !== "");
}

export function matchesTerms(row: { h: string; j: string }, terms: readonly SearchTerm[]): boolean {
  return terms.every(([a, b]) => (a !== "" && row.h.includes(a)) || (b !== "" && row.j.includes(b)));
}
