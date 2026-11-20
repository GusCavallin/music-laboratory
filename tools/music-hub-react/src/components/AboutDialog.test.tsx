// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AboutDialog } from "./AboutDialog";

// jsdom has no modal dialogs: these stand in for showModal and close
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});
afterEach(cleanup);

const dialog = () => document.getElementById("about") as HTMLDialogElement;

describe("AboutDialog", () => {
  it("is closed until asked for, then open", () => {
    const { rerender } = render(<AboutDialog open={false} version="" onClose={() => {}} />);
    expect(dialog().open).toBe(false);
    rerender(<AboutDialog open version="" onClose={() => {}} />);
    expect(dialog().open).toBe(true);
  });
  it("says the version, or that there is none yet", () => {
    const { rerender } = render(<AboutDialog open version="0.2.0" onClose={() => {}} />);
    expect(screen.getByText("Version 0.2.0")).toBeTruthy();
    rerender(<AboutDialog open version="" onClose={() => {}} />);
    expect(screen.getByText("Not released yet")).toBeTruthy();
  });
  it("says when the data was built, if it says", () => {
    const { rerender } = render(<AboutDialog open version="0.3.0" built="2026-11-19 17:18" onClose={() => {}} />);
    expect(screen.getByText("Data built 2026-11-19 17:18")).toBeTruthy();
    rerender(<AboutDialog open version="0.3.0" onClose={() => {}} />);
    expect(screen.queryByText(/Data built/)).toBeNull();
  });
  it("has the name, the licence and the links, opening in a new tab", () => {
    render(<AboutDialog open version="" onClose={() => {}} />);
    expect(screen.getByRole("heading", { name: "Music Hub" })).toBeTruthy();
    const links = [...dialog().querySelectorAll("a")].map((a) => [a.textContent, a.getAttribute("href"), a.target, a.rel]);
    expect(links).toEqual([
      ["PolyForm Noncommercial 1.0.0", "https://polyformproject.org/licenses/noncommercial/1.0.0/", "_blank", "noopener noreferrer"],
      ["github.com/GusCavallin/music-laboratory", "https://github.com/GusCavallin/music-laboratory", "_blank", "noopener noreferrer"],
      ["ko-fi.com/gustavocavallin", "https://ko-fi.com/gustavocavallin", "_blank", "noopener noreferrer"],
    ]);
  });
  it("the Close button asks to close", async () => {
    const onClose = vi.fn();
    render(<AboutDialog open version="" onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it("a click on the backdrop closes it, a click inside does not", () => {
    const onClose = vi.fn();
    render(<AboutDialog open version="" onClose={onClose} />);
    fireEvent.click(screen.getByText(/Search, explore and play/));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(dialog());
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it("Esc (the dialog's own close event) asks to close", () => {
    const onClose = vi.fn();
    render(<AboutDialog open version="" onClose={onClose} />);
    fireEvent(dialog(), new Event("close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it("closes when told to", () => {
    const { rerender } = render(<AboutDialog open version="" onClose={() => {}} />);
    rerender(<AboutDialog open={false} version="" onClose={() => {}} />);
    expect(dialog().open).toBe(false);
  });
});
