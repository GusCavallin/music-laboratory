import { describe, expect, it, vi } from "vitest";
import type { PlaylistResult, PlaylistSong } from "../api/helper";
import { fixtureLibrary } from "../data/fixture";
import { buildDataset } from "../data/load";
import { cleanName, saveAsPlaylist, toPlaylistSong } from "./saveFlow";

const songs = buildDataset(fixtureLibrary()).songs.slice(0, 3);

const setup = (over: { typed?: string | null; confirms?: boolean[]; results?: PlaylistResult[]; iTunes?: string[]; list?: typeof songs } = {}) => {
  const confirms = [...(over.confirms ?? [])];
  const results = [...(over.results ?? [{ ok: true, file: "[Gen] Calm.m3u8", count: 3 } as PlaylistResult])];
  const prompt = vi.fn<(message: string) => string | null>(() => (over.typed === undefined ? "Calm" : over.typed));
  const confirm = vi.fn<(message: string) => boolean>(() => confirms.shift() ?? true);
  const save = vi.fn<(req: { name: string; songs: PlaylistSong[]; overwrite: boolean }) => Promise<PlaylistResult>>(async () => results.shift()!);
  const run = () => saveAsPlaylist({ songs: over.list ?? songs, iTunesPlaylists: over.iTunes ?? [], ui: { prompt, confirm }, save });
  return { prompt, confirm, save, run };
};

describe("cleanName", () => {
  it("trims and drops a typed [Gen] prefix (the helper adds its own)", () => {
    expect(cleanName("  Calm evenings ")).toBe("Calm evenings");
    expect(cleanName("[Gen] Calm")).toBe("Calm");
    expect(cleanName("[gen]   Calm")).toBe("Calm");
    expect(cleanName("   ")).toBe("");
  });
});

describe("toPlaylistSong", () => {
  it("keeps only what the playlist file needs", () => {
    expect(toPlaylistSong(songs[0]!)).toEqual({ path: "C:\\music\\Spider Man Theme.mp3", name: "Spider Man Theme", artist: "The Webs", secs: 200 });
  });
});

describe("saveAsPlaylist", () => {
  it("saves the songs in order under the name asked for, and says what to do next", async () => {
    const t = setup();
    expect(await t.run()).toBe("Saved 3 songs: [Gen] Calm.m3u8. Import it in iTunes.");
    expect(t.prompt.mock.calls[0]![0]).toContain("3 songs");
    expect(t.save).toHaveBeenCalledTimes(1);
    expect(t.save.mock.calls[0]![0]).toMatchObject({ name: "Calm", overwrite: false });
    expect(t.save.mock.calls[0]![0].songs.map((s) => s.name)).toEqual(songs.map((s) => s.name));
  });
  it("an empty list asks nothing", async () => {
    const t = setup({ list: [] });
    expect(await t.run()).toBe("Nothing to save: no songs match");
    expect(t.prompt).not.toHaveBeenCalled();
  });
  it("cancelling the name saves nothing and says nothing", async () => {
    const t = setup({ typed: null });
    expect(await t.run()).toBe("");
    expect(t.save).not.toHaveBeenCalled();
  });
  it("an empty name saves nothing", async () => {
    const t = setup({ typed: "   " });
    expect(await t.run()).toBe("No name, nothing saved");
    expect(t.save).not.toHaveBeenCalled();
  });
  it("a typed [Gen] prefix is not doubled", async () => {
    const t = setup({ typed: "[Gen] Calm" });
    await t.run();
    expect(t.save.mock.calls[0]![0].name).toBe("Calm");
  });

  describe("a playlist of that name already in iTunes", () => {
    it("warns that importing only adds songs, and goes on if you agree", async () => {
      const t = setup({ iTunes: ["[Gen] Calm"], confirms: [true] });
      expect(await t.run()).toContain("Saved 3 songs");
      expect(t.confirm.mock.calls[0]![0]).toContain("only adds the songs it doesn't have yet");
    });
    it("compares names ignoring capitals", async () => {
      const t = setup({ iTunes: ["[GEN] CALM"], confirms: [false] });
      expect(await t.run()).toBe("");
      expect(t.save).not.toHaveBeenCalled();
    });
    it("stops, silently, if you decline", async () => {
      const t = setup({ iTunes: ["[Gen] Calm"], confirms: [false] });
      expect(await t.run()).toBe("");
      expect(t.save).not.toHaveBeenCalled();
    });
    it("another name does not ask", async () => {
      const t = setup({ iTunes: ["[Gen] Other"] });
      await t.run();
      expect(t.confirm).not.toHaveBeenCalled();
    });
  });

  describe("a file of that name still waiting to be imported", () => {
    const pending: PlaylistResult = { ok: false, error: '"[Gen] Calm.m3u8" is already in the playlists folder, waiting to be imported', exists: "pending" };
    it("asks before replacing it, and replaces it if you agree", async () => {
      const t = setup({ results: [pending, { ok: true, file: "[Gen] Calm.m3u8", count: 3 }], confirms: [true] });
      expect(await t.run()).toContain("Saved 3 songs");
      expect(t.save.mock.calls.map((c) => c[0].overwrite)).toEqual([false, true]);
      expect(t.confirm.mock.calls[0]![0]).toContain("Replace that file?");
    });
    it("leaves it alone if you decline, and shows the helper's reason", async () => {
      const t = setup({ results: [pending], confirms: [false] });
      expect(await t.run()).toBe(pending.ok ? "" : pending.error);
      expect(t.save).toHaveBeenCalledTimes(1);
    });
  });

  it("a name that was already imported is refused with the helper's reason (no question)", async () => {
    const imported: PlaylistResult = { ok: false, error: '"[Gen] Calm" was already imported (it is in playlists/bak); choose another name', exists: "imported" };
    const t = setup({ results: [imported] });
    expect(await t.run()).toBe(imported.ok ? "" : imported.error);
    expect(t.confirm).not.toHaveBeenCalled();
  });
  it("any other failure is shown as it is", async () => {
    expect(await setup({ results: [{ ok: false, error: "Couldn't reach the helper, nothing saved" }] }).run()).toBe("Couldn't reach the helper, nothing saved");
  });
});
