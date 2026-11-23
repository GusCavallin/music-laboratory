import { describe, expect, it } from "vitest";
import { fixtureLibrary } from "../data/fixture";
import { buildDataset } from "../data/load";
import { filterSongs, noSort } from "../data/filter";
import { historyReducer, initialHistory } from "./history";
import { openAction, parseOpenLink } from "./openLink";
import { initialUiState, reduce, songFilterOf } from "./uiState";

const ds = buildDataset(fixtureLibrary());
const names = (ui: ReturnType<typeof initialUiState>) => filterSongs(ds, songFilterOf(ui), noSort()).map((s) => s.name);

describe("parseOpenLink", () => {
  it("reads the artist, the album and the search text from the hash", () => {
    expect(parseOpenLink("#artist=a-ha&album=Hunting%20High%20and%20Low&q=Take+On+Me")).toEqual({
      artist: "a-ha", album: "Hunting High and Low", query: "Take On Me",
    });
  });
  it("keeps what is special in a name: & and ' and accents", () => {
    const hash = "#" + new URLSearchParams({ artist: "Antonín Dvořák", q: "Piano Sonata No. 8 'Pathetique' & more" }).toString();
    expect(parseOpenLink(hash)).toEqual({ artist: "Antonín Dvořák", album: null, query: "Piano Sonata No. 8 'Pathetique' & more" });
  });
  it("is null when the hash holds none of the three", () => {
    expect(parseOpenLink("")).toBeNull();
    expect(parseOpenLink("#")).toBeNull();
    expect(parseOpenLink("#something=else")).toBeNull();
  });
});

describe("opening a link", () => {
  it("shows the album: the iTunes tab with the artist and album chips, other filters cleared", () => {
    const busy = { ...initialUiState(), tab: "feel" as const, query: "rock", stars: [4, 5] as [number, number], lovedOnly: true };
    const ui = reduce(busy, openAction(ds, busy, { artist: "Duo", album: "Double", query: "" }));
    expect(ui.tab).toBe("itunes");
    expect(ui.facet).toEqual({ artist: "Duo", album: "Double", volume: null });
    expect(ui.query).toBe("");
    expect(ui.stars).toEqual([0, 5]);
    expect(ui.lovedOnly).toBe(false);
    expect(names(ui)).toHaveLength(3);
  });
  it("shows a song: the album chips plus its name in the search", () => {
    const s = initialUiState();
    const ui = reduce(s, openAction(ds, s, { artist: "Antonín Dvořák", album: "New World Symphony", query: "Largo" }));
    expect(ui.query).toBe("Largo");
    expect(names(ui)).toEqual(["Largo"]);
    const other = reduce(s, openAction(ds, s, { artist: "Antonín Dvořák", album: "New World Symphony", query: "Scherzo" }));
    expect(names(other)).toEqual([]); // a song the album does not have: nothing shows, even with all the words searched instead
  });
  it("matches capitals and accents like a click on a cell does", () => {
    const s = initialUiState();
    const ui = reduce(s, openAction(ds, s, { artist: "ANTONIN DVORAK", album: "new world symphony", query: "" }));
    expect(names(ui)).toEqual(["Largo"]);
  });
  it("searches the same words when the chips match nothing", () => {
    const s = initialUiState();
    const action = openAction(ds, s, { artist: "a-ha", album: "Hunting High and Low (Remastered)", query: "" });
    expect(action).toEqual({ type: "open", artist: null, album: null, query: "a-ha Hunting High and Low (Remastered)" });
    const none = openAction(ds, s, { artist: "Nobody Here", album: "Nothing", query: "" });
    expect(reduce(s, none).facet).toEqual({ artist: null, album: null, volume: null });
  });
  it("keeps the sort when it was already on the iTunes tab, drops it coming from another tab", () => {
    const sorted = { ...initialUiState(), sort: { key: "name", desc: false } };
    expect(reduce(sorted, { type: "open", artist: "Duo", album: null, query: "" }).sort).toEqual(sorted.sort);
    expect(reduce({ ...sorted, tab: "feel" }, { type: "open", artist: "Duo", album: null, query: "" }).sort.key).toBeNull();
  });
  it("goes into the history, so ← back returns to the view before the link", () => {
    const before = { ...initialUiState(), query: "love" };
    const h = historyReducer(initialHistory(before), { type: "open", artist: "Duo", album: "Double", query: "" });
    expect(h.hist).toEqual([before]);
    expect(historyReducer(h, { type: "back" }).ui.query).toBe("love");
  });
});
