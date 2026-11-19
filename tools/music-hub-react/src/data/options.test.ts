import { describe, expect, it } from "vitest";
import { fixtureLibrary } from "./fixture";
import { buildDataset } from "./load";
import { archiveCounts, categoryOptions, countryOptions, decadeOptions } from "./options";

const ds = buildDataset(fixtureLibrary());

describe("menu options", () => {
  it("decades: only songs that have a year, each once, in order", () => {
    expect(decadeOptions(ds)).toEqual(["1890s", "1970s", "1980s", "1990s"]);
  });
  it("countries: the distinct ones, in order, without blanks", () => {
    expect(countryOptions(ds)).toEqual(["AU", "CZ", "NO", "US"]);
  });
  it("archive categories", () => {
    expect(categoryOptions(ds)).toEqual(["Kids", "Rock"]);
  });
  it("archive counts: how many rows, and how many are also in iTunes", () => {
    expect(archiveCounts(ds)).toEqual({ total: 3, inItunes: 1, notInItunes: 2 });
  });
});
