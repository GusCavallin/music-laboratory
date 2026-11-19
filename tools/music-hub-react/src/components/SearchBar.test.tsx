// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { noFacet } from "../data/filter";
import { SearchBar } from "./SearchBar";

afterEach(cleanup);

const setup = (over: Partial<Parameters<typeof SearchBar>[0]> = {}) => {
  const onQuery = vi.fn<(value: string) => void>();
  const onRemoveFacet = vi.fn<(kind: "artist" | "album" | "volume") => void>();
  const onClear = vi.fn<() => void>();
  render(<SearchBar query="" count={3} total={1234} facet={noFacet()} onQuery={onQuery} onRemoveFacet={onRemoveFacet} onClear={onClear} {...over} />);
  return { onQuery, onRemoveFacet, onClear };
};

describe("SearchBar", () => {
  it("shows how many rows match out of the whole tab", () => {
    setup();
    expect(screen.getByText("3 of 1,234")).toBeTruthy();
  });

  it("reports what is typed, one character at a time", async () => {
    const p = setup();
    await userEvent.type(screen.getByRole("searchbox", { name: "Search" }), "ab");
    expect(p.onQuery.mock.calls.map((c) => c[0])).toEqual(["a", "b"]); // the box is controlled: the parent decides the text
  });

  it("the × appears only while there is text, and clears it", async () => {
    setup();
    expect(screen.queryByRole("button", { name: "Clear the search text" })).toBeNull();
    cleanup();
    const p = setup({ query: "abba" });
    await userEvent.click(screen.getByRole("button", { name: "Clear the search text" }));
    expect(p.onQuery).toHaveBeenCalledWith("");
  });

  it("shows a chip for each picked artist, album or CD, and removes it", async () => {
    const p = setup({ facet: { artist: "a-ha", album: null, volume: "Mp3_1S" } });
    expect(screen.getByText(/Artist: a-ha/)).toBeTruthy();
    expect(screen.getByText(/Volume: Mp3_1S/)).toBeTruthy();
    expect(screen.queryByText(/Album:/)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Remove the artist filter" }));
    expect(p.onRemoveFacet).toHaveBeenCalledWith("artist");
  });

  it("the Clear filters button asks the parent to clear", async () => {
    const p = setup();
    await userEvent.click(screen.getByRole("button", { name: /Clear filters/ }));
    expect(p.onClear).toHaveBeenCalledTimes(1);
  });
});
