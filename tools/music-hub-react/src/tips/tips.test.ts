import { describe, expect, it } from "vitest";
import { PL_TIP_MAX, playlistsOf, withPlaylists, worthShowing } from "./tips";

const pl = (name: string, ids: number[], smart = false) => ({ name, ids, smart });

describe("playlistsOf", () => {
  it("lists the playlists a song is in, in the library's order", () => {
    const d = { playlists: [pl("Calm", [1, 2]), pl("Road", [2]), pl("Other", [3])] };
    expect(playlistsOf(d, { ix: 2 })).toEqual(["Calm", "Road"]);
    expect(playlistsOf(d, { ix: 9 })).toEqual([]);
  });
  it("never the smart (rule-driven) ones", () => {
    expect(playlistsOf({ playlists: [pl("Rule", [1], true), pl("Hand", [1])] }, { ix: 1 })).toEqual(["Hand"]);
  });
  it("a long list is cut, and says how many more", () => {
    const d = { playlists: Array.from({ length: PL_TIP_MAX + 4 }, (_, i) => pl(`P${i}`, [5])) };
    const names = playlistsOf(d, { ix: 5 });
    expect(names).toHaveLength(PL_TIP_MAX + 1);
    expect(names[PL_TIP_MAX]).toBe("… and 4 more");
  });
  it("exactly the most is not cut", () => {
    const d = { playlists: Array.from({ length: PL_TIP_MAX }, (_, i) => pl(`P${i}`, [5])) };
    expect(playlistsOf(d, { ix: 5 })).toHaveLength(PL_TIP_MAX);
  });
  it("follows a removal made in place", () => {
    const d = { playlists: [pl("Calm", [1, 2])] };
    expect(playlistsOf(d, { ix: 2 })).toEqual(["Calm"]);
    d.playlists[0]!.ids = [1];
    expect(playlistsOf(d, { ix: 2 })).toEqual([]);
  });
});

describe("withPlaylists", () => {
  it("adds them under the text", () => expect(withPlaylists("Song", ["A", "B"])).toBe("Song\n\nIn playlists:\n• A\n• B"));
  it("or nothing when there are none", () => expect(withPlaylists("Song", [])).toBe("Song"));
});

describe("worthShowing", () => {
  const el = (tagName: string, scrollWidth: number, clientWidth: number, cls: string[] = []) => ({
    tagName, scrollWidth, clientWidth, classList: { contains: (c: string) => cls.includes(c) },
  });
  it("anything but a table cell always is", () => expect(worthShowing(el("BUTTON", 5, 50), false)).toBe(true));
  it("a cell whose text is cut off is", () => expect(worthShowing(el("TD", 300, 100), false)).toBe(true));
  it("a cell whose text is all visible is not", () => expect(worthShowing(el("TD", 100, 100), false)).toBe(false));
  it("unless it is a Feel score, or has playlists to add", () => {
    expect(worthShowing(el("TD", 10, 100, ["fv"]), false)).toBe(true);
    expect(worthShowing(el("TD", 10, 100), true)).toBe(true);
  });
  it("a Track cell is, because its tip says it in words, even when its text is all visible", () => {
    const track = (text: string, tip: string) => ({ ...el("TD", 10, 100), textContent: text, dataset: { k: "track", tip } });
    expect(worthShowing(track("2-5/12", "Disc 2 - Track 5 of 12"), false)).toBe(true);
    expect(worthShowing(track("5/13", "Track 5 of 13"), false)).toBe(true);
  });
  it("but a Track cell whose tip is only its own text (the archive's) is not, and another column never gets this", () => {
    expect(worthShowing({ ...el("TD", 10, 100), textContent: "3", dataset: { k: "track", tip: "3" } }, false)).toBe(false);
    expect(worthShowing({ ...el("TD", 10, 100), textContent: "Song", dataset: { k: "name", tip: "Something else" } }, false)).toBe(false);
  });
});
