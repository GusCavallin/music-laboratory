// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Preset } from "./presets";
import { usePresets } from "./usePresets";

const mk = (name: string): Preset => ({ name, state: { tab: "itunes" } });
let stored: unknown;     // what the "helper" holds
let helperUp: boolean;
let posts: unknown[];

beforeEach(() => {
  localStorage.clear();
  stored = [mk("From helper")];
  helperUp = true;
  posts = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
    if (!helperUp) throw new TypeError("Failed to fetch");
    if (init?.method === "POST") {
      const body = JSON.parse(init.body as string);
      posts.push(body.presets);
      stored = body.presets;
      return new Response(JSON.stringify({ ok: true }));
    }
    return new Response(JSON.stringify({ presets: stored }));
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("usePresets with the helper", () => {
  it("waits until it is known whether there is a helper", () => {
    const { result } = renderHook(() => usePresets(null, () => {}));
    expect(result.current.presets).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("loads the list the helper keeps", async () => {
    const { result } = renderHook(() => usePresets(true, () => {}));
    await waitFor(() => expect(result.current.presets).toEqual([mk("From helper")]));
  });
  it("saves the whole list to the helper, and shows it at once", async () => {
    const { result } = renderHook(() => usePresets(true, () => {}));
    await waitFor(() => expect(result.current.presets).toHaveLength(1));
    act(() => result.current.save([mk("A"), mk("B")]));
    expect(result.current.presets.map((p) => p.name)).toEqual(["A", "B"]);
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual([mk("A"), mk("B")]);
  });
  it("says so when the helper would not take it", async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => usePresets(true, onError));
    await waitFor(() => expect(result.current.presets).toHaveLength(1));
    helperUp = false;
    act(() => result.current.save([mk("A")]));
    await waitFor(() => expect(onError).toHaveBeenCalledWith("Couldn't save the presets"));
  });
  it("falls back to this browser's own list when the helper's answer is not a list", async () => {
    localStorage.setItem("ls_presets", JSON.stringify([mk("Local")]));
    stored = "garbage";
    const { result } = renderHook(() => usePresets(true, () => {}));
    await waitFor(() => expect(result.current.presets).toEqual([mk("Local")]));
  });
});

describe("usePresets without the helper", () => {
  it("uses this browser's storage", async () => {
    localStorage.setItem("ls_presets", JSON.stringify([mk("Local")]));
    const { result } = renderHook(() => usePresets(false, () => {}));
    await waitFor(() => expect(result.current.presets).toEqual([mk("Local")]));
    expect(fetch).not.toHaveBeenCalled();
  });
  it("saves there", async () => {
    const { result } = renderHook(() => usePresets(false, () => {}));
    act(() => result.current.save([mk("New")]));
    expect(JSON.parse(localStorage.getItem("ls_presets")!)).toEqual([mk("New")]);
  });
  it("ignores stored data that is not a list of presets", async () => {
    localStorage.setItem("ls_presets", '{"oops":true}');
    const { result } = renderHook(() => usePresets(false, () => {}));
    await waitFor(() => expect(result.current.presets).toEqual([]));
    localStorage.setItem("ls_presets", "not json");
    const again = renderHook(() => usePresets(false, () => {}));
    await waitFor(() => expect(again.result.current.presets).toEqual([]));
  });
  it("switches to the helper's list when the helper turns up", async () => {
    localStorage.setItem("ls_presets", JSON.stringify([mk("Local")]));
    const { result, rerender } = renderHook(({ h }) => usePresets(h, () => {}), { initialProps: { h: false as boolean | null } });
    await waitFor(() => expect(result.current.presets).toEqual([mk("Local")]));
    rerender({ h: true });
    await waitFor(() => expect(result.current.presets).toEqual([mk("From helper")]));
  });
});
