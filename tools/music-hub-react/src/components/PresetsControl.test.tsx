// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Preset } from "../presets/presets";
import { PresetsControl } from "./PresetsControl";

afterEach(cleanup);
const list: Preset[] = [{ name: "Calm", state: { tab: "feel" } }, { name: "Road Trip", state: { tab: "itunes" } }];

const setup = (presets: Preset[] = list, onSave = vi.fn(() => true)) => {
  const fns = { onSave, onApply: vi.fn(), onReplace: vi.fn(), onRename: vi.fn(), onDelete: vi.fn() };
  render(<PresetsControl presets={presets} {...fns} />);
  return fns;
};
const open = () => userEvent.click(screen.getByRole("button", { name: /Presets/ }));

describe("PresetsControl", () => {
  it("is closed until you press the button, and opens a menu", async () => {
    setup();
    expect(screen.queryByRole("menu")).toBeNull();
    await open();
    expect(screen.getByRole("menu")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Presets/ }).getAttribute("aria-expanded")).toBe("true");
  });
  it("lists each preset with the tab it belongs to", async () => {
    setup();
    await open();
    const rows = document.querySelectorAll(".pm-row .nm");
    expect([...rows].map((r) => r.textContent!.replace(/\s+/g, " ").trim())).toEqual(["Calm Raw Feel", "Road Trip iTunes"]);
  });
  it("says what to do when there are none", async () => {
    setup([]);
    await open();
    expect(screen.getByText(/No presets yet/)).toBeTruthy();
  });
  it("saves the name typed (Save, or Enter), and clears the box when it was taken", async () => {
    const f = setup();
    await open();
    const box = screen.getByLabelText("Name for the current view") as HTMLInputElement;
    await userEvent.type(box, "Evening{Enter}");
    expect(f.onSave).toHaveBeenCalledWith("Evening");
    expect(box.value).toBe("");
    await userEvent.type(box, "Night");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(f.onSave).toHaveBeenLastCalledWith("Night");
  });
  it("keeps the typed text when the name was refused", async () => {
    setup(list, vi.fn(() => false));
    await open();
    const box = screen.getByLabelText("Name for the current view") as HTMLInputElement;
    await userEvent.type(box, "{Enter}");
    await userEvent.type(box, "x{Enter}");
    expect(box.value).toBe("x");
  });
  it("applying closes the menu and reports which preset", async () => {
    const f = setup();
    await open();
    await userEvent.click(screen.getByText("Road Trip"));
    expect(f.onApply).toHaveBeenCalledWith(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });
  it("replace, rename and delete report which preset and keep the menu open", async () => {
    const f = setup();
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Replace Calm with the current view" }));
    await userEvent.click(screen.getByRole("button", { name: "Rename Road Trip" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete Calm" }));
    expect([f.onReplace.mock.calls, f.onRename.mock.calls, f.onDelete.mock.calls]).toEqual([[[0]], [[1]], [[0]]]);
    expect(screen.getByRole("menu")).toBeTruthy();
  });
  it("closes with Escape, and with a click outside it", async () => {
    setup();
    await open();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    await open();
    await userEvent.click(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });
  it("the button toggles it", async () => {
    setup();
    await open();
    await open();
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
