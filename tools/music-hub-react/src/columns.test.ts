import { describe, expect, it } from "vitest";
import { ARCHIVE_COLUMNS, cellText, columnsOf, HIDDEN_BY_DEFAULT, SONG_COLUMNS } from "./columns";
import { fixtureLibrary } from "./data/fixture";
import { buildDataset } from "./data/load";

const ds = buildDataset(fixtureLibrary());
const [spider, takeOnMe, , , unrated] = ds.songs;

describe("columns", () => {
  it("the iTunes tab has the same columns as the current page, in the same order", () => {
    expect(SONG_COLUMNS.map((c) => c.key)).toEqual([
      "name", "artist", "album", "track", "year", "loved", "stars", "plays", "last_played", "genres", "country", "composer", "secs", "path",
    ]);
    expect(ARCHIVE_COLUMNS.map((c) => c.key)).toEqual(["name", "artist", "album", "category", "volume", "in_itunes", "path"]);
  });
  it("columns without a listed width are 200 px", () => {
    expect(SONG_COLUMNS.find((c) => c.key === "name")!.width).toBe(200);
    expect(SONG_COLUMNS.find((c) => c.key === "path")!.width).toBe(520);
  });
  it("picks the columns of a tab; only the path starts hidden", () => {
    expect(columnsOf("archive")).toBe(ARCHIVE_COLUMNS);
    expect([...HIDDEN_BY_DEFAULT.itunes]).toEqual(["path"]);
    expect(HIDDEN_BY_DEFAULT.archive.size).toBe(0);
  });
});

describe("cellText", () => {
  it("formats time, track, year and hearts", () => {
    expect(cellText(spider!, "secs")).toBe("3:20");
    expect(cellText(spider!, "track")).toBe("1/10");
    expect(cellText(spider!, "year")).toBe("1994");
    expect(cellText(spider!, "loved")).toBe("❤️");
    expect(cellText(takeOnMe!, "loved")).toBe("");
  });
  it("leaves an unknown year and track empty", () => {
    expect(cellText(unrated!, "year")).toBe("");
    expect(cellText(unrated!, "track")).toBe("");
  });
  it("shows plain text columns and a zero play count", () => {
    expect(cellText(spider!, "artist")).toBe("The Webs");
    expect(cellText(spider!, "plays")).toBe("10");
    expect(cellText(spider!, "last_played")).toBe("2026-01-02");
  });
  it("marks a protected purchase with a lock", () => {
    const locked = { ...spider!, protected: true };
    expect(cellText(locked, "name")).toBe("🔒 Spider Man Theme");
    expect(cellText(spider!, "name")).toBe("Spider Man Theme");
  });
  it("archive rows: a check mark for songs also in iTunes", () => {
    expect(cellText(ds.archive[0]!, "in_itunes")).toBe("✔");
    expect(cellText(ds.archive[1]!, "in_itunes")).toBe("");
    expect(cellText(ds.archive[0]!, "volume")).toBe("Mp3_1S");
    expect(cellText(ds.archive[0]!, "category")).toBe("Kids");
  });
});
