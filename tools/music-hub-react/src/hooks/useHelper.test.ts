// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHelper } from "./useHelper";

/** A helper that answers /ping, or does not; `up` can change while the test runs. */
let up: boolean;
let pings: number;
let streams: string[];
class FakeEventSource {
  constructor(public url: string) {
    streams.push(url);
  }
  close() {
    streams.splice(streams.indexOf(this.url), 1);
  }
}

beforeEach(() => {
  up = false;
  pings = 0;
  streams = [];
  vi.stubGlobal("fetch", vi.fn(async () => {
    pings++;
    if (!up) throw new TypeError("Failed to fetch");
    return new Response("music-library-search");
  }));
  vi.stubGlobal("EventSource", FakeEventSource);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useHelper", () => {
  it("does not know at first, then says whether the helper answered", async () => {
    up = true;
    const { result } = renderHook(() => useHelper());
    expect(result.current.available).toBeNull();
    await waitFor(() => expect(result.current.available).toBe(true));
  });
  it("is false when there is no helper", async () => {
    const { result } = renderHook(() => useHelper());
    await waitFor(() => expect(result.current.available).toBe(false));
  });
  it("holds the presence stream open while the helper is there, and lets go when the page goes", async () => {
    up = true;
    const { result, unmount } = renderHook(() => useHelper());
    await waitFor(() => expect(result.current.available).toBe(true));
    expect(streams).toEqual(["/presence"]);
    unmount();
    expect(streams).toEqual([]);
  });
  it("opens no stream when there is no helper", async () => {
    const { result } = renderHook(() => useHelper());
    await waitFor(() => expect(result.current.available).toBe(false));
    expect(streams).toEqual([]);
  });

  describe("ensure", () => {
    it("with the helper there, it does not ask again", async () => {
      up = true;
      const { result } = renderHook(() => useHelper());
      await waitFor(() => expect(result.current.available).toBe(true));
      const before = pings;
      expect(await result.current.ensure()).toBe(true);
      expect(pings).toBe(before);
    });
    it("without it, it asks again: start serve.bat, click, and it works with no reload", async () => {
      const { result } = renderHook(() => useHelper());
      await waitFor(() => expect(result.current.available).toBe(false));
      up = true;
      let answer = false;
      await act(async () => {
        answer = await result.current.ensure();
      });
      expect(answer).toBe(true);
      expect(result.current.available).toBe(true);
    });
    it("still no helper: false", async () => {
      const { result } = renderHook(() => useHelper());
      await waitFor(() => expect(result.current.available).toBe(false));
      let answer = true;
      await act(async () => {
        answer = await result.current.ensure();
      });
      expect(answer).toBe(false);
    });
  });

  it("coming back to the window while it is missing asks again", async () => {
    const { result } = renderHook(() => useHelper());
    await waitFor(() => expect(result.current.available).toBe(false));
    up = true;
    act(() => void window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(result.current.available).toBe(true));
  });
  it("and stops asking on a focus once the helper is there", async () => {
    up = true;
    const { result } = renderHook(() => useHelper());
    await waitFor(() => expect(result.current.available).toBe(true));
    const before = pings;
    act(() => void window.dispatchEvent(new Event("focus")));
    expect(pings).toBe(before);
  });
});
