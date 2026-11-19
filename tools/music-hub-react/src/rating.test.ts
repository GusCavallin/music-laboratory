import { describe, expect, it } from "vitest";
import { fixtureLibrary } from "./data/fixture";
import { buildDataset } from "./data/load";
import { removeFromPlaylist, setSongStars } from "./data/mutate";
import { TO_RATE_TAG, playlistToRateFrom, starsAfterClick } from "./rating";

describe("starsAfterClick", () => {
  it("a click on another star sets that rating", () => {
    expect(starsAfterClick(3, 5)).toBe(5);
    expect(starsAfterClick(0, 1)).toBe(1);
    expect(starsAfterClick(5, 2)).toBe(2);
  });
  it("a click on the rating the song already has clears it", () => {
    expect(starsAfterClick(4, 4)).toBe(0);
    expect(starsAfterClick(1, 1)).toBe(0);
  });
});

describe("playlistToRateFrom", () => {
  const names = ["[Gen] To Rate", "[Gen] Evening Songs [To Rate]", "Road Trip"]; // (made-up names: the public export rewrites the private playlist's real name)
  it("the tag's name is [To Rate]", () => {
    expect(TO_RATE_TAG).toBe("[To Rate]");
  });
  it("a chosen playlist with the tag, while giving a rating, is the one to take the song off", () => {
    expect(playlistToRateFrom("[Gen] Evening Songs [To Rate]", names, 4)).toBe("[Gen] Evening Songs [To Rate]");
  });
  it("not when clearing a rating, when there is no tag, or when it is not a playlist", () => {
    expect(playlistToRateFrom("[Gen] Evening Songs [To Rate]", names, 0)).toBe("");
    expect(playlistToRateFrom("Road Trip", names, 4)).toBe("");
    expect(playlistToRateFrom("[To Rate] typed but not a playlist", names, 4)).toBe("");
    expect(playlistToRateFrom("", names, 4)).toBe("");
  });
  it("the name must be exactly a playlist's (text still being typed filters nothing)", () => {
    expect(playlistToRateFrom("[Gen] Evening", names, 4)).toBe("");
  });
});

describe("the in-place updates", () => {
  const ds = buildDataset(fixtureLibrary());
  it("setSongStars changes that song and no other", () => {
    const [a, b] = ds.songs;
    setSongStars(a!, 2);
    expect([a!.stars, b!.stars]).toEqual([2, 4]);
  });
  it("removeFromPlaylist takes the song off that playlist only", () => {
    expect(removeFromPlaylist(ds, "Road Trip", 0)).toBe(true);
    expect(ds.playlists.find((p) => p.name === "Road Trip")!.ids).toEqual([3, 3, 1]);
    expect(ds.playlists.find((p) => p.name === "Smart Mix")!.ids).toEqual([0]);
  });
  it("says whether it changed anything", () => {
    expect(removeFromPlaylist(ds, "Road Trip", 0)).toBe(false); // already gone
    expect(removeFromPlaylist(ds, "No such list", 0)).toBe(false);
  });
});
