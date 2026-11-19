// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DualRange } from "./DualRange";

afterEach(cleanup);

const setup = (over: Partial<Parameters<typeof DualRange>[0]> = {}) => {
  const onChange = vi.fn<(which: "lo" | "hi", value: number) => void>();
  const { container } = render(<DualRange min={0} max={10} step={1} lo={2} hi={7} label="Power" onChange={onChange} {...over} />);
  return { onChange, container };
};

describe("DualRange", () => {
  it("two knobs, named for assistive technology, at the given values", () => {
    setup();
    expect((screen.getByLabelText("Power minimum") as HTMLInputElement).value).toBe("2");
    expect((screen.getByLabelText("Power maximum") as HTMLInputElement).value).toBe("7");
  });
  it("reports which knob moved and where", () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByLabelText("Power minimum"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Power maximum"), { target: { value: "9" } });
    expect(onChange.mock.calls).toEqual([["lo", 4], ["hi", 9]]);
  });
  it("uses the min, max and step it is given", () => {
    setup({ min: -2.5, max: 3.5, step: 0.1, lo: -1, hi: 1 });
    const lo = screen.getByLabelText("Power minimum") as HTMLInputElement;
    expect([lo.min, lo.max, lo.step]).toEqual(["-2.5", "3.5", "0.1"]);
  });
  it("draws the filled stretch between the knobs", () => {
    const { container } = setup({ lo: 2, hi: 7 });
    const fill = container.querySelector(".fill") as HTMLElement;
    // jsdom writes calc(7px + (100% - 14px) * 0.2) in its simplified form, calc(20% + 4.2px)
    expect(fill.style.left).toContain("20%"); // 2 of 10
    expect(fill.style.width).toContain("50%"); // 5 of 10
  });
  it("puts the lower knob underneath when it is in the upper half, so two knobs at the top can still be told apart", () => {
    const low = setup({ lo: 2, hi: 7 }).container;
    const [a, b] = low.querySelectorAll("input");
    expect([a!.style.zIndex, b!.style.zIndex]).toEqual(["3", "1"]);
    cleanup();
    const high = setup({ lo: 8, hi: 9 }).container;
    const [c, d] = high.querySelectorAll("input");
    expect([c!.style.zIndex, d!.style.zIndex]).toEqual(["1", "3"]);
  });
});
