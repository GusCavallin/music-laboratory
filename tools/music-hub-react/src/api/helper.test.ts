import { describe, expect, it, vi } from "vitest";
import { audioUrl, loadPresets, loadVersion, ping, rateSong, rebuild, savePlaylist, savePresetsToHelper, type Fetch } from "./helper";

const reply = (body: unknown, init: ResponseInit = {}) => new Response(typeof body === "string" ? body : JSON.stringify(body), { status: 200, ...init });
const fakeFetch = (impl: (url: string, init?: RequestInit) => Response | Promise<Response>) => vi.fn(impl as never) as unknown as Fetch & ReturnType<typeof vi.fn>;
const down: Fetch = (() => Promise.reject(new TypeError("Failed to fetch"))) as never;

describe("audioUrl", () => {
  it("asks the helper for a song by its path, safely encoded", () => {
    expect(audioUrl("C:\\Music\\Dvořák\\01 Largo.mp3")).toBe("/audio?p=C%3A%5CMusic%5CDvo%C5%99%C3%A1k%5C01%20Largo.mp3");
  });
});

describe("ping", () => {
  it("is true when the helper answers with its name", async () => {
    expect(await ping(fakeFetch(() => reply("music-library-search")))).toBe(true);
  });
  it("is false for another answer, an error, or no helper at all", async () => {
    expect(await ping(fakeFetch(() => reply("something else")))).toBe(false);
    expect(await ping(fakeFetch(() => reply("nope", { status: 502 })))).toBe(false);
    expect(await ping(down)).toBe(false);
  });
});

describe("loadVersion", () => {
  it("is the version the helper reads from the VERSION file, asked for fresh each time", async () => {
    const f = fakeFetch(() => reply({ version: "0.3.0" }));
    expect(await loadVersion(f)).toBe("0.3.0");
    expect(f).toHaveBeenCalledWith("/version", { cache: "no-store" });
  });
  it("is an empty string before the first release", async () => {
    expect(await loadVersion(fakeFetch(() => reply({ version: "" })))).toBe("");
  });
  it("is null when there is no helper, an error, or an answer that is not a version", async () => {
    expect(await loadVersion(down)).toBeNull();
    expect(await loadVersion(fakeFetch(() => reply("nope", { status: 404 })))).toBeNull();
    expect(await loadVersion(fakeFetch(() => reply({ version: 3 })))).toBeNull();
    expect(await loadVersion(fakeFetch(() => reply("<html>")))).toBeNull();
  });
});

describe("rateSong", () => {
  const req = { path: "C:\\m\\a.mp3", name: "A", stars: 4, from_playlist: "" };
  it("posts the song and the stars as JSON", async () => {
    const f = fakeFetch(() => reply({ ok: true, stars: 4, removed: false }));
    expect(await rateSong(req, f)).toEqual({ ok: true, stars: 4, removed: false });
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe("/rate");
    expect(init).toMatchObject({ method: "POST", headers: { "Content-Type": "application/json" } });
    expect(JSON.parse(init!.body as string)).toEqual(req);
  });
  it("reports that the song left a To Rate playlist", async () => {
    expect(await rateSong({ ...req, from_playlist: "[Gen] To Rate" }, fakeFetch(() => reply({ ok: true, stars: 5, removed: true })))).toMatchObject({ ok: true, removed: true });
  });
  it("passes on the helper's reason when iTunes refused", async () => {
    expect(await rateSong(req, fakeFetch(() => reply({ ok: false, error: "track not found in iTunes" })))).toEqual({ ok: false, error: "track not found in iTunes" });
  });
  it("says so when the helper cannot be reached, without throwing", async () => {
    expect(await rateSong(req, down)).toEqual({ ok: false, error: "Can't reach the helper" });
  });
  it("copes with a reply that is not JSON", async () => {
    expect(await rateSong(req, fakeFetch(() => reply("<html>bad gateway</html>", { status: 502 })))).toEqual({ ok: false, error: "Can't reach the helper" });
  });
});

describe("savePlaylist", () => {
  const songs = [{ path: "C:\\m\\a.mp3", name: "A", artist: "X", secs: 200 }];
  it("posts the name, the songs in order and the overwrite flag", async () => {
    const f = fakeFetch(() => reply({ ok: true, file: "[Gen] Calm.m3u8", count: 1 }));
    expect(await savePlaylist({ name: "Calm", songs, overwrite: false }, f)).toEqual({ ok: true, file: "[Gen] Calm.m3u8", count: 1 });
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe("/playlist");
    expect(JSON.parse(init!.body as string)).toEqual({ name: "Calm", songs, overwrite: false });
  });
  it("tells a name that is taken apart: waiting to be imported, or already imported", async () => {
    const pending = fakeFetch(() => reply({ ok: false, error: "already waiting", exists: "pending" }, { status: 409 }));
    expect(await savePlaylist({ name: "Calm", songs, overwrite: false }, pending)).toEqual({ ok: false, error: "already waiting", exists: "pending" });
    const imported = fakeFetch(() => reply({ ok: false, error: "already imported", exists: "imported" }, { status: 409 }));
    expect(await savePlaylist({ name: "Calm", songs, overwrite: false }, imported)).toMatchObject({ exists: "imported" });
  });
  it("other refusals carry only the message", async () => {
    expect(await savePlaylist({ name: " ", songs, overwrite: false }, fakeFetch(() => reply({ ok: false, error: "give the playlist a name" }, { status: 400 })))).toEqual({ ok: false, error: "give the playlist a name" });
  });
  it("says so when the helper cannot be reached", async () => {
    expect(await savePlaylist({ name: "Calm", songs, overwrite: false }, down)).toEqual({ ok: false, error: "Couldn't reach the helper, nothing saved" });
  });
});

describe("rebuild", () => {
  it("true when the helper rebuilt data.js", async () => {
    const f = fakeFetch(() => reply({ ok: true, output: "iTunes tracks: 7275" }));
    expect(await rebuild(f)).toEqual({ ok: true });
    expect(f.mock.calls[0]![0]).toBe("/rebuild");
  });
  it("passes on why it failed", async () => {
    expect(await rebuild(fakeFetch(() => reply({ ok: false, error: "a rebuild is already running" })))).toEqual({ ok: false, error: "a rebuild is already running" });
    expect(await rebuild(fakeFetch(() => reply({ ok: false, output: "missing library file" })))).toEqual({ ok: false, error: "missing library file" });
  });
  it("says so when the helper cannot be reached", async () => {
    expect(await rebuild(down)).toEqual({ ok: false, error: "Can't reach the helper (is its window still open?)" });
  });
});

describe("presets", () => {
  it("loads the list the helper keeps", async () => {
    const f = fakeFetch(() => reply({ presets: [{ name: "A", state: {} }] }));
    expect(await loadPresets(f)).toEqual([{ name: "A", state: {} }]);
    expect(f.mock.calls[0]![0]).toBe("/presets");
  });
  it("an empty answer is an empty list", async () => {
    expect(await loadPresets(fakeFetch(() => reply({})))).toEqual([]);
  });
  it("null when the helper cannot be reached or refuses", async () => {
    expect(await loadPresets(down)).toBeNull();
    expect(await loadPresets(fakeFetch(() => reply("nope", { status: 502 })))).toBeNull();
  });
  it("writes the whole list as JSON", async () => {
    const f = fakeFetch(() => reply({ ok: true, count: 1 }));
    expect(await savePresetsToHelper([{ name: "A", state: {} }], f)).toBe(true);
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe("/presets");
    expect(init).toMatchObject({ method: "POST" });
    expect(JSON.parse(init!.body as string)).toEqual({ presets: [{ name: "A", state: {} }] });
  });
  it("false when it could not be written", async () => {
    expect(await savePresetsToHelper([], fakeFetch(() => reply({ ok: false, error: "bad presets" }, { status: 400 })))).toBe(false);
    expect(await savePresetsToHelper([], down)).toBe(false);
  });
});
