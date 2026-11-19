import { describe, expect, it } from "vitest";
import {
  ARCHIVE_COLUMNS, CUBE_COLUMNS, FEEL_COLUMNS, SONG_COLUMNS, cellText, columnsOf, feelTip, groupOf, hasColumn, HIDDEN_BY_DEFAULT, scoreBackground,
} from "./columns";
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

describe("the Feel column sets", () => {
  it("Raw Feel: name, artist and rating, then the ten scores and Sure, then the rest", () => {
    expect(FEEL_COLUMNS.map((c) => c.key).slice(0, 15)).toEqual([
      "name", "artist", "stars", "f_wonder", "f_transcendence", "f_tenderness", "f_nostalgia", "f_peacefulness", "f_power", "f_joyful",
      "f_tension", "f_sadness", "f_maturity", "f_conf", "album",
    ]);
    expect(FEEL_COLUMNS.find((c) => c.key === "f_conf")!.label).toBe("Sure");
    expect(FEEL_COLUMNS).toHaveLength(3 + 11 + 11);
  });
  it("Feel Axes: maturity is the only score", () => {
    expect(CUBE_COLUMNS.map((c) => c.key).slice(0, 5)).toEqual(["name", "artist", "stars", "f_maturity", "album"]);
    expect(CUBE_COLUMNS.some((c) => c.key === "f_power")).toBe(false);
  });
  it("scores are centered; the widths are the current page's", () => {
    const power = FEEL_COLUMNS.find((c) => c.key === "f_power")!;
    expect(power).toMatchObject({ center: true, width: 66 });
    expect(FEEL_COLUMNS.find((c) => c.key === "f_joyful")!.width).toBe(112);
  });
  it("Raw Feel with its graph on uses the Feel Axes columns", () => {
    expect(groupOf("feel", true)).toBe("cube");
    expect(groupOf("feel", false)).toBe("feel");
    expect(groupOf("cube")).toBe("cube");
    expect(groupOf("itunes", true)).toBe("itunes");
    expect(columnsOf("cube")).toBe(CUBE_COLUMNS);
    expect(hasColumn("feel", "f_power")).toBe(true);
    expect(hasColumn("cube", "f_power")).toBe(false);
  });
  it("what starts hidden on each tab", () => {
    expect(HIDDEN_BY_DEFAULT.feel.has("plays")).toBe(true);
    expect(HIDDEN_BY_DEFAULT.cube.has("plays")).toBe(false);
    expect(HIDDEN_BY_DEFAULT.cube.has("track")).toBe(true);
    expect(HIDDEN_BY_DEFAULT.feel.has("album")).toBe(false);
  });
});

describe("Feel cells", () => {
  it("the text of a score, empty when there is none or the song is unrated", () => {
    expect(cellText(spider!, "f_wonder")).toBe("3");
    expect(cellText(spider!, "f_maturity")).toBe("7");
    expect(cellText(spider!, "f_conf")).toBe("3");
    expect(cellText(ds.songs[2]!, "f_maturity")).toBe(""); // an instrumental
    expect(cellText(unrated!, "f_wonder")).toBe("");
  });
  it("the hover text says where a score stands among all rated songs", () => {
    expect(feelTip(spider!, "f_wonder", ds.feelStats)).toBe("Wonder 3 · mean 3.25 · stdev 2.63 · −0.25 points from the mean (−0.10 stdev) · all 4 rated songs");
    expect(feelTip(spider!, "f_conf", ds.feelStats)).toBe("Confidence in these ratings: high");
    expect(feelTip(ds.songs[2]!, "f_maturity", ds.feelStats)).toBe("Maturity: no score (an instrumental has no words to judge)");
    expect(feelTip(unrated!, "f_wonder", ds.feelStats)).toBe("");
    expect(feelTip(spider!, "name", ds.feelStats)).toBe("");
  });
});

describe("scoreBackground", () => {
  const stats = { power: { n: 100, mean: 5, sd: 2 } };
  it("no tint near the mean or without a score", () => {
    expect(scoreBackground(5, "f_power", stats, "dev")).toBeUndefined();
    expect(scoreBackground(5.1, "f_power", stats, "dev")).toBeUndefined();
    expect(scoreBackground(null, "f_power", stats, "dev")).toBeUndefined();
  });
  it("warm above the mean and cool below, at full strength from 2.5 stdev", () => {
    expect(scoreBackground(10, "f_power", stats, "dev")).toBe("color-mix(in srgb, var(--warm) 55%, transparent)");
    expect(scoreBackground(100, "f_power", stats, "dev")).toBe("color-mix(in srgb, var(--warm) 55%, transparent)");
    expect(scoreBackground(0, "f_power", stats, "dev")).toBe("color-mix(in srgb, var(--cool) 55%, transparent)");
    expect(scoreBackground(7.5, "f_power", stats, "dev")).toBe("color-mix(in srgb, var(--warm) 28%, transparent)");
  });
  it("raw mode shades by the score", () => {
    expect(scoreBackground(5, "f_power", stats, "raw")).toBe("hsl(205 80% 50% / 0.30)");
    expect(scoreBackground(0, "f_power", stats, "raw")).toBe("hsl(205 80% 50% / 0.00)");
  });
});
