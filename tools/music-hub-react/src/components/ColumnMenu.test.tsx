// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Column } from "../columns";
import { ColumnMenu } from "./ColumnMenu";

afterEach(cleanup);
const cols: Column[] = [
  { key: "name", label: "Name", width: 100 },
  { key: "year", label: "Year", width: 50, numeric: true },
  { key: "path", label: "Path", width: 300 },
];

const setup = (hidden: string[] = ["path"]) => {
  const fns = { onToggle: vi.fn(), onResetOrder: vi.fn(), onClose: vi.fn() };
  render(<ColumnMenu columns={cols} hidden={new Set(hidden)} at={{ x: 40, y: 60 }} {...fns} />);
  return fns;
};

describe("ColumnMenu", () => {
  it("lists every column in order, ticked unless hidden", () => {
    setup();
    const boxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(boxes.map((b) => b.parentElement!.textContent!.trim())).toEqual(["Name", "Year", "Path"]);
    expect(boxes.map((b) => b.checked)).toEqual([true, true, false]);
  });
  it("opens where the pointer was", () => {
    setup();
    const menu = screen.getByRole("menu");
    expect(menu.style.left).toBe("40px");
    expect(menu.style.top).toBe("60px");
  });
  it("ticking and unticking say which column and what is wanted", async () => {
    const f = setup();
    await userEvent.click(screen.getByLabelText("Path"));
    await userEvent.click(screen.getByLabelText("Year"));
    expect(f.onToggle.mock.calls).toEqual([["path", true], ["year", false]]);
  });
  it("Reset order", async () => {
    const f = setup();
    await userEvent.click(screen.getByRole("button", { name: /Reset order/ }));
    expect(f.onResetOrder).toHaveBeenCalled();
  });
  it("closes on Escape, on a press outside, and when the window loses focus", async () => {
    const f = setup();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(document.body);
    fireEvent.blur(window);
    expect(f.onClose).toHaveBeenCalledTimes(3);
  });
  it("does not close on a press inside it", async () => {
    const f = setup();
    await userEvent.click(screen.getByLabelText("Year"));
    expect(f.onClose).not.toHaveBeenCalled();
  });
});
