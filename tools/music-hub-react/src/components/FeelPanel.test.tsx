// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initialFeel, setFeelRange, toggleFeelLink, type FeelState } from "../feel/feelState";
import { FeelPanel } from "./FeelPanel";

afterEach(cleanup);
const setup = (feel: FeelState = initialFeel()) => {
  const dispatch = vi.fn();
  render(<FeelPanel feel={feel} dispatch={dispatch} />);
  return dispatch;
};

describe("FeelPanel", () => {
  it("ten sliders, each with its current range, in five stacked pairs", () => {
    setup(setFeelRange(initialFeel(), 5, "lo", 4));
    expect(screen.getAllByRole("slider")).toHaveLength(20); // two knobs each
    expect(screen.getByText("Power").parentElement!.textContent).toContain("4–10");
    expect(document.querySelectorAll(".fpair")).toHaveLength(5);
  });
  it("each stack is the upper scale, the link pill and the lower scale", () => {
    setup();
    const calm = [...document.querySelectorAll(".fpair")][1]!;
    expect([...calm.querySelectorAll("b")].map((b) => b.firstChild!.textContent!.trim())).toEqual(["Peacefulness", "Tenderness"]);
    expect(calm.querySelector(".flk")!.textContent).toContain("Calm");
  });
  it("moving a knob dispatches the scale and the end", () => {
    const dispatch = setup();
    fireEvent.change(screen.getByLabelText("Peacefulness minimum"), { target: { value: "6" } });
    expect(dispatch).toHaveBeenCalledWith({ type: "feelRange", index: 4, which: "lo", value: 6 });
  });
  it("a link pill shows its state, and a click toggles it", async () => {
    const dispatch = setup(toggleFeelLink(initialFeel(), "Awe"));
    expect(screen.getByRole("button", { name: /Awe/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /Calm/ }).getAttribute("aria-pressed")).toBe("false");
    await userEvent.click(screen.getByRole("button", { name: /Calm/ }));
    expect(dispatch).toHaveBeenCalledWith({ type: "feelLink", pair: "Calm" });
  });
  it("the weak pairs have the dashed pill", () => {
    setup();
    expect(screen.getByRole("button", { name: /Edge/ }).className).toContain("weak");
    expect(screen.getByRole("button", { name: /Depth/ }).className).toContain("weak");
    expect(screen.getByRole("button", { name: /Calm/ }).className).not.toContain("weak");
  });
  it("the pill's hover text says how strong the link is", () => {
    setup();
    expect(screen.getByRole("button", { name: /Calm/ }).title).toContain("strongly linked");
  });
  it("the options dispatch their own actions", async () => {
    const dispatch = setup();
    await userEvent.click(screen.getByRole("button", { name: "Reset sliders" }));
    await userEvent.click(screen.getByLabelText(/Show graph/));
    await userEvent.selectOptions(screen.getByLabelText(/Confidence/), "high");
    await userEvent.selectOptions(screen.getByLabelText(/Color/), "raw");
    expect(dispatch.mock.calls.map((c) => c[0])).toEqual([
      { type: "feelReset" }, { type: "feelGraph", value: true }, { type: "feelConfidence", value: "high" }, { type: "feelColor", value: "raw" },
    ]);
  });
  it("shows the current options", () => {
    setup({ ...initialFeel(), graph: true, confidence: "low", color: "raw" });
    expect((screen.getByLabelText(/Show graph/) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText(/Confidence/) as HTMLSelectElement).value).toBe("low");
    expect((screen.getByLabelText(/Color/) as HTMLSelectElement).value).toBe("raw");
  });
});
