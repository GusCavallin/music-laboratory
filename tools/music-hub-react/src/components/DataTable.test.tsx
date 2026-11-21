// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { Column } from "../columns";
import { noSort } from "../data/filter";
import { DataTable, type DataTableHandle } from "./DataTable";

interface Row { ix: number; name: string; plays: number }
const columns: Column[] = [
  { key: "name", label: "Name", width: 200 },
  { key: "plays", label: "Plays", width: 64, numeric: true },
];
const makeRows = (n: number): Row[] => Array.from({ length: n }, (_, i) => ({ ix: i, name: `Song ${i}`, plays: i * 2 }));

// jsdom has no layout: give the scroll area a size so the windowing has a window to work with
const sizes = ["clientHeight", "clientWidth"] as const;
const saved = sizes.map((k) => Object.getOwnPropertyDescriptor(HTMLElement.prototype, k));
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 600 });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 1000 });
});
afterAll(() => {
  sizes.forEach((k, i) => (saved[i] ? Object.defineProperty(HTMLElement.prototype, k, saved[i]!) : delete (HTMLElement.prototype as unknown as Record<string, unknown>)[k]));
});
afterEach(cleanup);

const setup = (rows: Row[], over: Partial<Parameters<typeof DataTable<Row>>[0]> = {}) => {
  const onSort = vi.fn<(key: string) => void>();
  const onCellClick = vi.fn<(row: Row, column: Column, event: unknown, index: number) => void>();
  render(
    <DataTable<Row>
      rows={rows}
      columns={columns}
      sort={noSort()}
      onSort={onSort}
      renderCell={(r, c) => String(r[c.key as keyof Row])}
      onCellClick={onCellClick}
      {...over}
    />,
  );
  return { onSort, onCellClick };
};

describe("DataTable", () => {
  it("shows the column headers and the first rows", () => {
    setup(makeRows(5));
    expect(screen.getByRole("button", { name: "Name" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Plays" })).toBeTruthy();
    expect(screen.getByText("Song 0")).toBeTruthy();
    expect(screen.getByText("Song 4")).toBeTruthy();
  });

  it("windows the rows: a long list puts only a screenful in the page", () => {
    setup(makeRows(20_000));
    const rendered = document.querySelectorAll("tbody tr[data-i]").length;
    expect(rendered).toBeGreaterThan(10);
    expect(rendered).toBeLessThan(100); // 600 px / 30 px = 20 rows on screen, plus overscan
    expect(screen.queryByText("Song 19999")).toBeNull();
  });

  it("clicking a header asks to sort by that column", async () => {
    const p = setup(makeRows(3));
    await userEvent.click(screen.getByRole("button", { name: "Plays" }));
    expect(p.onSort).toHaveBeenCalledWith("plays");
  });

  it("marks the sorted column for assistive technology and with an arrow style", () => {
    setup(makeRows(3), { sort: { key: "plays", desc: true } });
    const th = screen.getByRole("columnheader", { name: "Plays" });
    expect(th.getAttribute("aria-sort")).toBe("descending");
    expect(within(th).getByRole("button").className).toContain("desc");
    expect(screen.getByRole("columnheader", { name: "Name" }).getAttribute("aria-sort")).toBeNull();
  });

  it("clicking a cell reports the row and the column", async () => {
    const rows = makeRows(4);
    const p = setup(rows);
    await userEvent.click(screen.getByText("Song 2"));
    const [row, column] = p.onCellClick.mock.calls[0]!;
    expect(row).toBe(rows[2]);
    expect(column.key).toBe("name");
  });

  it("says so when there are no rows", () => {
    setup([], { emptyMessage: "No songs match these filters." });
    expect(screen.getByText("No songs match these filters.")).toBeTruthy();
  });

  it("right-aligns numeric columns", () => {
    setup(makeRows(2));
    expect(screen.getByRole("columnheader", { name: "Plays" }).className).toBe("n");
    expect(screen.getByText("2").className).toContain("n");
  });
});

describe("DataTable row hooks", () => {
  it("a click reports where the row is in the list (to start playing from it)", async () => {
    const rows = makeRows(6);
    const p = setup(rows);
    await userEvent.click(screen.getByText("Song 4"));
    expect(p.onCellClick.mock.calls[0]![3]).toBe(4);
  });
  it("a row can have its own classes (the playing song, a rated song leaving a list)", () => {
    setup(makeRows(4), { rowClass: (r) => (r.ix === 2 ? "now rated" : undefined) });
    const trs = document.querySelectorAll("tbody tr[data-i]");
    expect([...trs].map((t) => t.className)).toEqual(["", "", "now rated", ""]);
  });
  it("hands its parent a way to scroll to a row, even one far off screen", () => {
    const handle = createRef<DataTableHandle>();
    setup(makeRows(5000), { handle });
    expect(typeof handle.current!.scrollToIndex).toBe("function");
    expect(() => handle.current!.scrollToIndex(4000)).not.toThrow();
  });
  it("the list goes back to the top when the reset key changes, not when only the rows do", () => {
    const rows = makeRows(300);
    const { rerender } = render(
      <DataTable<Row> rows={rows} columns={columns} sort={noSort()} onSort={() => {}} renderCell={(r, c) => String(r[c.key as keyof Row])} scrollResetKey="a" />,
    );
    const scroller = document.querySelector(".scroll") as HTMLElement;
    scroller.scrollTop = 500;
    rerender(<DataTable<Row> rows={makeRows(300)} columns={columns} sort={noSort()} onSort={() => {}} renderCell={(r, c) => String(r[c.key as keyof Row])} scrollResetKey="a" />);
    expect(scroller.scrollTop).toBe(500); // the data was refreshed: the place is kept
    rerender(<DataTable<Row> rows={makeRows(300)} columns={columns} sort={noSort()} onSort={() => {}} renderCell={(r, c) => String(r[c.key as keyof Row])} scrollResetKey="b" />);
    expect(scroller.scrollTop).toBe(0); // a filter changed: back to the top
  });
});

describe("DataTable header menu and reordering", () => {
  const header = (name: string) => screen.getByRole("button", { name }).closest("th") as HTMLElement;
  const dt = () => ({ setData: vi.fn(), effectAllowed: "" });

  it("a right-click on the header row is reported", () => {
    const onHeaderContextMenu = vi.fn();
    setup(makeRows(3), { onHeaderContextMenu });
    fireEvent.contextMenu(header("Plays"));
    expect(onHeaderContextMenu).toHaveBeenCalledTimes(1);
  });
  it("a right-click on a row is not", () => {
    const onHeaderContextMenu = vi.fn();
    setup(makeRows(3), { onHeaderContextMenu });
    fireEvent.contextMenu(screen.getByText("Song 1"));
    expect(onHeaderContextMenu).not.toHaveBeenCalled();
  });
  it("headers are draggable only when moving is possible", () => {
    setup(makeRows(2));
    expect(header("Name").draggable).toBe(false);
    cleanup();
    setup(makeRows(2), { onMoveColumn: vi.fn() });
    expect(header("Name").draggable).toBe(true);
  });
  it("dragging one header onto another reports which moved where", () => {
    const onMoveColumn = vi.fn();
    setup(makeRows(2), { onMoveColumn });
    fireEvent.dragStart(header("Plays"), { dataTransfer: dt() });
    fireEvent.dragOver(header("Name"), { dataTransfer: dt() });
    expect(header("Name").className).toContain("over");
    expect(header("Plays").className).toContain("dragging");
    fireEvent.drop(header("Name"), { dataTransfer: dt() });
    expect(onMoveColumn).toHaveBeenCalledWith("plays", "name");
    expect(header("Name").className).not.toContain("over");
  });
  it("dropping on itself, or a drag that ends elsewhere, moves nothing", () => {
    const onMoveColumn = vi.fn();
    setup(makeRows(2), { onMoveColumn });
    fireEvent.dragStart(header("Plays"), { dataTransfer: dt() });
    fireEvent.drop(header("Plays"), { dataTransfer: dt() });
    fireEvent.dragStart(header("Plays"), { dataTransfer: dt() });
    fireEvent.dragEnd(header("Plays"));
    fireEvent.drop(header("Name"), { dataTransfer: dt() });
    expect(onMoveColumn).not.toHaveBeenCalled();
  });
  it("dragging does not sort", () => {
    const { onSort } = setup(makeRows(2), { onMoveColumn: vi.fn() });
    fireEvent.dragStart(header("Plays"), { dataTransfer: dt() });
    fireEvent.drop(header("Name"), { dataTransfer: dt() });
    expect(onSort).not.toHaveBeenCalled();
  });
});

describe("DataTable column resizing", () => {
  const header = (name: string) => screen.getByRole("button", { name }).closest("th") as HTMLElement;
  const edge = (name: string) => header(name).querySelector(".rs") as HTMLElement;
  const colWidths = () => [...document.querySelectorAll("col")].map((c) => (c as HTMLElement).style.width);
  const tableWidth = () => (document.querySelector("table") as HTMLElement).style.width;

  it("there is an edge to drag only when resizing is possible", () => {
    setup(makeRows(2));
    expect(document.querySelector(".rs")).toBeNull();
    cleanup();
    setup(makeRows(2), { onResizeColumn: vi.fn() });
    expect(document.querySelectorAll(".rs")).toHaveLength(2);
  });
  it("dragging an edge moves only that column while it is held, and reports the width on release", () => {
    const onResizeColumn = vi.fn();
    setup(makeRows(2), { onResizeColumn });
    expect(colWidths()).toEqual(["200px", "64px"]);
    fireEvent.mouseDown(edge("Name"), { button: 0, clientX: 500 });
    fireEvent.mouseMove(document, { clientX: 560 });
    expect(colWidths()).toEqual(["260px", "64px"]);
    expect(tableWidth()).toBe("324px");
    expect(onResizeColumn).not.toHaveBeenCalled();
    fireEvent.mouseUp(document, { clientX: 560 });
    expect(onResizeColumn).toHaveBeenCalledWith("name", 260);
  });
  it("can be dragged narrower, but not below the minimum", () => {
    const onResizeColumn = vi.fn();
    setup(makeRows(2), { onResizeColumn });
    fireEvent.mouseDown(edge("Plays"), { button: 0, clientX: 500 });
    fireEvent.mouseMove(document, { clientX: 480 });
    expect(colWidths()).toEqual(["200px", "44px"]);
    fireEvent.mouseMove(document, { clientX: 100 });
    expect(colWidths()).toEqual(["200px", "30px"]);
    fireEvent.mouseUp(document);
    expect(onResizeColumn).toHaveBeenCalledWith("plays", 30);
  });
  it("after the release the table follows the widths it is given again", () => {
    setup(makeRows(2), { onResizeColumn: vi.fn() });
    fireEvent.mouseDown(edge("Name"), { button: 0, clientX: 0 });
    fireEvent.mouseMove(document, { clientX: 50 });
    fireEvent.mouseUp(document);
    expect(colWidths()).toEqual(["200px", "64px"]); // the parent did not change them in this test
  });
  it("only the left button resizes", () => {
    const onResizeColumn = vi.fn();
    setup(makeRows(2), { onResizeColumn });
    fireEvent.mouseDown(edge("Name"), { button: 2, clientX: 500 });
    fireEvent.mouseMove(document, { clientX: 600 });
    fireEvent.mouseUp(document);
    expect(colWidths()).toEqual(["200px", "64px"]);
    expect(onResizeColumn).not.toHaveBeenCalled();
  });
  it("the click that ends a resize does not sort, and a later click does", async () => {
    const onSort = vi.fn();
    setup(makeRows(2), { onResizeColumn: vi.fn(), onSort });
    fireEvent.mouseDown(edge("Name"), { button: 0, clientX: 500 });
    fireEvent.mouseMove(document, { clientX: 520 });
    fireEvent.mouseUp(document);
    fireEvent.click(screen.getByRole("button", { name: "Name" })); // the click the browser sends after the release
    expect(onSort).not.toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 5));
    await userEvent.click(screen.getByRole("button", { name: "Name" }));
    expect(onSort).toHaveBeenCalledWith("name");
  });
  it("a click on the edge itself sorts nothing", async () => {
    const onSort = vi.fn();
    setup(makeRows(2), { onResizeColumn: vi.fn(), onSort });
    await userEvent.click(edge("Name"));
    expect(onSort).not.toHaveBeenCalled();
  });
  it("a double-click on the edge asks for the usual width", () => {
    const onResetColumnWidth = vi.fn();
    setup(makeRows(2), { onResizeColumn: vi.fn(), onResetColumnWidth });
    fireEvent.doubleClick(edge("Plays"));
    expect(onResetColumnWidth).toHaveBeenCalledWith("plays");
  });
});
