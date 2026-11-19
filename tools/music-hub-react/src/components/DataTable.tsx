import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import type { Column } from "../columns";
import type { SortSpec } from "../data/filter";

/** Every row is this tall, so the list can be windowed: only the rows on screen (plus a few) are in the page. */
export const ROW_HEIGHT = 30;

interface Props<R extends { ix: number }> {
  rows: readonly R[];
  columns: readonly Column[];
  sort: SortSpec;
  onSort: (key: string) => void;
  /** what a cell shows */
  renderCell: (row: R, column: Column) => ReactNode;
  /** a click on a cell (not on the header) */
  onCellClick?: (row: R, column: Column, event: MouseEvent) => void;
  /** a hover text for a cell, if it is worth one */
  cellTitle?: (row: R, column: Column) => string | undefined;
  /** a style for a cell (the tint of a Feel score) */
  cellStyle?: (row: R, column: Column) => CSSProperties | undefined;
  emptyMessage?: string;
  /** cell keys that can be clicked to pick something (the pointer shows it) */
  clickableKeys?: ReadonlySet<string>;
}

export function DataTable<R extends { ix: number }>({
  rows, columns, sort, onSort, renderCell, onCellClick, cellTitle, cellStyle, emptyMessage = "Nothing matches.", clickableKeys,
}: Props<R>) {
  const scroller = useRef<HTMLDivElement>(null);
  const byKey = useMemo(() => new Map(columns.map((c) => [c.key, c] as const)), [columns]);
  const totalWidth = columns.reduce((sum, c) => sum + c.width, 0);

  const virtual = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });

  // a new list (a filter, a search or a sort changed) starts at the top
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0;
  }, [rows]);

  const items = virtual.getVirtualItems();
  const padTop = items.length ? items[0]!.start : 0;
  const padBottom = items.length ? virtual.getTotalSize() - items[items.length - 1]!.end : 0;

  const handleClick = (e: MouseEvent<HTMLTableSectionElement>) => {
    if (!onCellClick) return;
    const td = (e.target as HTMLElement).closest("td");
    const tr = (e.target as HTMLElement).closest("tr");
    const key = td?.dataset.k;
    const index = tr?.dataset.i;
    if (!key || index === undefined) return;
    const row = rows[Number(index)];
    const column = byKey.get(key);
    if (row && column) onCellClick(row, column, e);
  };

  return (
    <div className="scroll" ref={scroller}>
      <table style={{ width: totalWidth }}>
        <colgroup>
          {columns.map((c) => <col key={c.key} style={{ width: c.width }} />)}
        </colgroup>
        <thead>
          <tr>
            {columns.map((c) => {
              const sorted = sort.key === c.key;
              return (
                <th
                  key={c.key}
                  className={c.center ? "fv" : c.numeric ? "n" : undefined}
                  aria-sort={sorted ? (sort.desc ? "descending" : "ascending") : undefined}
                >
                  <button type="button" className={sorted ? (sort.desc ? "sorted desc" : "sorted") : undefined} onClick={() => onSort(c.key)} title="Click to sort">
                    {c.label}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody onClick={handleClick}>
          {padTop > 0 && <tr className="pad" style={{ height: padTop }}><td colSpan={columns.length} /></tr>}
          {items.map((item) => {
            const row = rows[item.index];
            if (!row) return null;
            return (
              <tr key={row.ix} data-i={item.index} style={{ height: ROW_HEIGHT }}>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    data-k={c.key}
                    className={[c.center ? "fv" : c.numeric ? "n" : "", clickableKeys?.has(c.key) ? "pick" : ""].join(" ").trim() || undefined}
                    title={cellTitle?.(row, c)}
                    style={cellStyle?.(row, c)}
                  >
                    {renderCell(row, c)}
                  </td>
                ))}
              </tr>
            );
          })}
          {padBottom > 0 && <tr className="pad" style={{ height: padBottom }}><td colSpan={columns.length} /></tr>}
        </tbody>
      </table>
      {rows.length === 0 && <p className="empty">{emptyMessage}</p>}
    </div>
  );
}
