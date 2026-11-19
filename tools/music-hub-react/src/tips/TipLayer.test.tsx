// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TIP_DELAY, TipLayer } from "./TipLayer";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const tipBox = () => document.getElementById("tip")!;
const hover = (el: Element) => act(() => void fireEvent.mouseOver(el, { clientX: 100, clientY: 100 }));
const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe("TipLayer", () => {
  it("shows the text of a data-tip a moment after the pointer arrives", () => {
    const { getByText } = render(<><TipLayer /><button data-tip="Save it">Save</button></>);
    hover(getByText("Save"));
    expect(tipBox().style.display).not.toBe("block");
    wait(TIP_DELAY);
    expect(tipBox().style.display).toBe("block");
    expect(tipBox().textContent).toBe("Save it");
  });
  it("finds the tip on a parent of what is under the pointer", () => {
    const { getByText } = render(<><TipLayer /><span data-tip="Outer"><b>inner</b></span></>);
    hover(getByText("inner"));
    wait(TIP_DELAY);
    expect(tipBox().textContent).toBe("Outer");
  });
  it("shows nothing for an element without one, and hides when the pointer moves to it", () => {
    const { getByText } = render(<><TipLayer /><button data-tip="Tip">A</button><button>B</button></>);
    hover(getByText("A"));
    wait(TIP_DELAY);
    hover(getByText("B"));
    wait(TIP_DELAY * 2);
    expect(tipBox().style.display).toBe("none");
  });
  it("leaving before the delay shows nothing", () => {
    const { getByText } = render(<><TipLayer /><button data-tip="Tip">A</button><p>x</p></>);
    hover(getByText("A"));
    wait(TIP_DELAY - 50);
    hover(getByText("x"));
    wait(500);
    expect(tipBox().style.display).not.toBe("block");
  });
  for (const ev of ["mouseDown", "wheel", "keyDown", "scroll", "dragStart"] as const) {
    it(`goes away on ${ev}`, () => {
      const { getByText } = render(<><TipLayer /><button data-tip="Tip">A</button></>);
      hover(getByText("A"));
      wait(TIP_DELAY);
      act(() => void fireEvent[ev](getByText("A")));
      expect(tipBox().style.display).toBe("none");
    });
  }
  it("a table cell shows its tip only when its text is cut off", () => {
    const { container } = render(<><TipLayer /><table><tbody><tr><td data-tip="Long long text" id="cell">Long…</td></tr></tbody></table></>);
    const td = container.querySelector("#cell")!;
    hover(td); // jsdom has no layout: nothing is cut off
    wait(TIP_DELAY);
    expect(tipBox().style.display).not.toBe("block");
    Object.defineProperty(td, "scrollWidth", { value: 300, configurable: true });
    Object.defineProperty(td, "clientWidth", { value: 100, configurable: true });
    hover(td);
    wait(TIP_DELAY);
    expect(tipBox().style.display).toBe("block");
  });
  it("a Feel score cell always does", () => {
    const { container } = render(<><TipLayer /><table><tbody><tr><td className="fv" data-tip="Power 7">7</td></tr></tbody></table></>);
    hover(container.querySelector("td")!);
    wait(TIP_DELAY);
    expect(tipBox().textContent).toBe("Power 7");
  });
  it("adds the extra lines it is given, and then a cell always shows", () => {
    const extra = vi.fn(() => ["Calm", "Road"]);
    const { container } = render(<><TipLayer extra={extra} /><table><tbody><tr><td data-tip="Song">Song</td></tr></tbody></table></>);
    hover(container.querySelector("td")!);
    wait(TIP_DELAY);
    expect(tipBox().textContent).toBe("Song\n\nIn playlists:\n• Calm\n• Road");
  });
  it("follows the pointer while it shows", () => {
    const { getByText } = render(<><TipLayer /><button data-tip="Tip">A</button></>);
    hover(getByText("A"));
    wait(TIP_DELAY);
    const before = tipBox().style.left;
    act(() => void fireEvent.mouseMove(getByText("A"), { clientX: 300, clientY: 100 }));
    expect(tipBox().style.left).not.toBe(before);
  });
  it("stops listening when removed", () => {
    const { getByText, unmount } = render(<><TipLayer /><button data-tip="Tip">A</button></>);
    const btn = getByText("A");
    unmount();
    expect(() => hover(btn)).not.toThrow();
  });
});
