// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHistoryButtons } from "./useHistoryButtons";

let back: ReturnType<typeof vi.spyOn>;
let forward: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  history.replaceState(null, "");
  back = vi.spyOn(history, "back").mockImplementation(() => {});
  forward = vi.spyOn(history, "forward").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const pop = (hub: string) => window.dispatchEvent(new PopStateEvent("popstate", { state: { hub } }));
const hooks = (over: { back?: boolean; forward?: boolean } = {}) => {
  const f = { goBack: vi.fn(() => over.back ?? true), goForward: vi.fn(() => over.forward ?? true), say: vi.fn() };
  const r = renderHook(() => useHistoryButtons(f.goBack, f.goForward, f.say));
  return { ...f, ...r };
};

describe("useHistoryButtons", () => {
  it("parks the page on the middle of three history entries (b, m, f) and steps back to the middle", () => {
    const push = vi.spyOn(history, "pushState");
    hooks();
    expect(push.mock.calls.map((c) => (c[0] as { hub: string }).hub)).toEqual(["m", "f"]);
    expect(back).toHaveBeenCalledTimes(1);
  });
  it("does it only once, even when the effect runs twice or the page was reloaded", () => {
    const first = hooks();
    first.unmount();
    const push = vi.spyOn(history, "pushState");
    hooks(); // history.state is now the last entry made ("f" until the step back lands)
    expect(push).not.toHaveBeenCalled();
    history.replaceState({ hub: "m" }, "");
    hooks();
    expect(push).not.toHaveBeenCalled();
  });
  it("Back lands on b: goes back, then returns to the middle", () => {
    const h = hooks();
    forward.mockClear();
    pop("b");
    expect(h.goBack).toHaveBeenCalledTimes(1);
    expect(forward).toHaveBeenCalledTimes(1);
    expect(h.say).not.toHaveBeenCalled();
  });
  it("Forward lands on f: goes forward, then returns to the middle", () => {
    const h = hooks();
    back.mockClear();
    pop("f");
    expect(h.goForward).toHaveBeenCalledTimes(1);
    expect(back).toHaveBeenCalledTimes(1);
  });
  it("says so when there is nothing to go to, and still returns to the middle", () => {
    const h = hooks({ back: false, forward: false });
    forward.mockClear();
    back.mockClear();
    pop("b");
    pop("f");
    expect(h.say.mock.calls).toEqual([["Nothing to go back to"], ["Nothing to go forward to"]]);
    expect(forward).toHaveBeenCalledTimes(1);
    expect(back).toHaveBeenCalledTimes(1);
  });
  it("the middle entry and unrelated entries do nothing", () => {
    const h = hooks();
    forward.mockClear();
    back.mockClear();
    pop("m");
    window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
    expect(h.goBack).not.toHaveBeenCalled();
    expect(h.goForward).not.toHaveBeenCalled();
    expect(forward).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });
  it("uses the latest callbacks", () => {
    const first = vi.fn(() => true);
    const second = vi.fn(() => true);
    const { rerender } = renderHook(({ go }) => useHistoryButtons(go, () => true, () => {}), { initialProps: { go: first } });
    rerender({ go: second });
    pop("b");
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
  it("stops listening when the page is closed", () => {
    const h = hooks();
    h.unmount();
    pop("b");
    expect(h.goBack).not.toHaveBeenCalled();
  });
});
