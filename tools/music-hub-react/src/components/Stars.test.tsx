// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Stars } from "./Stars";

afterEach(cleanup);

describe("Stars (only shown)", () => {
  it("draws the rating as filled and empty stars, described for assistive technology", () => {
    render(<Stars n={3} />);
    const el = screen.getByRole("img", { name: "3 of 5 stars" });
    expect(el.textContent).toBe("★★★☆☆");
  });
  it("an unrated song says so", () => {
    render(<Stars n={0} />);
    expect(screen.getByRole("img", { name: "not rated" }).textContent).toBe("☆☆☆☆☆");
  });
  it("has no buttons", () => {
    render(<Stars n={4} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});

describe("Stars (clickable)", () => {
  it("five buttons, each naming what a click does", () => {
    render(<Stars n={2} onRate={() => {}} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["★", "★", "☆", "☆", "☆"]);
    expect(buttons[0]!.getAttribute("aria-label")).toBe("1 star");
    expect(buttons[2]!.getAttribute("aria-label")).toBe("3 stars");
  });
  it("the star that is the current rating says that a click clears it", () => {
    render(<Stars n={4} onRate={() => {}} />);
    expect(screen.getByRole("button", { name: "4 stars, click again to clear" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "4 stars, click again to clear" }).title).toBe("Click again to clear the rating");
    expect(screen.getByRole("button", { name: "5 stars" }).title).toBe("Rate 5 stars in iTunes");
  });
  it("a click reports the star (what it does with the current rating is the caller's rule)", async () => {
    const onRate = vi.fn();
    render(<Stars n={2} onRate={onRate} />);
    await userEvent.click(screen.getByRole("button", { name: "5 stars" }));
    await userEvent.click(screen.getByRole("button", { name: "2 stars, click again to clear" }));
    expect(onRate.mock.calls).toEqual([[5], [2]]);
  });
  it("a click does not reach the row around it (which would start the song)", async () => {
    const onRow = vi.fn();
    render(
      <div onClick={onRow}>
        <Stars n={1} onRate={() => {}} />
      </div>,
    );
    await userEvent.click(screen.getByRole("button", { name: "3 stars" }));
    expect(onRow).not.toHaveBeenCalled();
  });
  it("the filled stars are marked, for the color", () => {
    render(<Stars n={2} onRate={() => {}} />);
    expect(screen.getAllByRole("button").map((b) => b.className)).toEqual(["on", "on", "", "", ""]);
  });
});
