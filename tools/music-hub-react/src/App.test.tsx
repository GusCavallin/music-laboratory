// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Library } from "./App";
import { fixtureLibrary } from "./data/fixture";
import { buildDataset } from "./data/load";
import { toSession } from "./state/session";
import { initialUiState, reduce, type Action } from "./state/uiState";

// jsdom has no layout (the table needs a window to show rows in) and plays no media
const sizes = ["clientHeight", "clientWidth"] as const;
const saved = sizes.map((k) => Object.getOwnPropertyDescriptor(HTMLElement.prototype, k));
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 600 });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 1000 });
});
afterAll(() => {
  sizes.forEach((k, i) => (saved[i] ? Object.defineProperty(HTMLElement.prototype, k, saved[i]!) : delete (HTMLElement.prototype as unknown as Record<string, unknown>)[k]));
});

beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, "");
  vi.spyOn(history, "back").mockImplementation(() => {});
  vi.spyOn(history, "forward").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); })); // no helper
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const dataset = () => buildDataset(fixtureLibrary());
const view = (...actions: Action[]) => actions.reduce(reduce, initialUiState());
const open = async (dsOverride = dataset()) => {
  await act(async () => void render(<Library dataset={dsOverride} reload={async () => dsOverride} />));
};
const duoCell = () => screen.getAllByText("Duo", { selector: "td" })[0]!;
const stored = (key: string) => JSON.parse(localStorage.getItem(key) ?? "null");
const columnHeaders = () => [...document.querySelectorAll("thead th")].map((th) => th.textContent);
const rowNames = () => [...document.querySelectorAll("tbody tr:not(.pad) td[data-k='name']")].map((td) => td.textContent);

describe("the page opens as it was left", () => {
  it("restores the search, filters and tab of the last visit", async () => {
    localStorage.setItem("ls_session", JSON.stringify(toSession(view({ type: "query", value: "take" }, { type: "starsFrom", value: 4 }), false, null)));
    await open();
    expect((screen.getByLabelText("Search") as HTMLInputElement).value).toBe("take");
    expect(rowNames()).toEqual(["Take On Me"]);
  });
  it("restores the song that was playing, paused at its position, and does not play by itself", async () => {
    localStorage.setItem("ls_session", JSON.stringify(toSession(initialUiState(), false, { path: "C:\\music\\Largo.mp3", t: 83 })));
    await open();
    expect(screen.getByText(/⏸ Largo — Antonín Dvořák\s+\(resume at 1:23\)/)).toBeTruthy();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(document.querySelector("tr.now")?.textContent).toContain("Largo");
  });
  it("under StrictMode (which runs effects twice) the restored song still has its place in the list, not 'next: from the current results'", async () => {
    localStorage.setItem("ls_session", JSON.stringify(toSession(initialUiState(), false, { path: "C:\\music\\Largo.mp3", t: 5 })));
    let audio: HTMLMediaElement | undefined;
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
      audio = this;
      return Promise.resolve();
    });
    const ds = dataset();
    await act(async () => void render(<StrictMode><Library dataset={ds} reload={async () => ds} /></StrictMode>));
    await userEvent.click(screen.getByRole("button", { name: "Play" }));
    act(() => void audio!.dispatchEvent(new Event("playing")));
    expect(screen.getByText(/▶ Largo — Antonín Dvořák\s+\(\d+\/8\)/)).toBeTruthy();
  });
  it("a song that is gone from the library is not brought back", async () => {
    localStorage.setItem("ls_session", JSON.stringify(toSession(initialUiState(), false, { path: "C:\\music\\Gone.mp3", t: 5 })));
    await open();
    expect(screen.getByText("Click a song to play the current selection")).toBeTruthy();
  });
  it("a playlist that no longer exists is dropped from the restored view, and the list is not empty", async () => {
    localStorage.setItem("ls_session", JSON.stringify(toSession(view({ type: "playlist", value: "Deleted Long Ago" }), false, null)));
    await open();
    expect(rowNames()).toHaveLength(8);
  });
  it("shuffle comes back too", async () => {
    localStorage.setItem("ls_session", JSON.stringify(toSession(initialUiState(), true, null)));
    await open();
    expect(screen.getByRole("button", { name: "Shuffle" }).getAttribute("aria-pressed")).toBe("true");
  });
  it("remembers what you do, in the format of the current page", async () => {
    await open();
    await userEvent.type(screen.getByLabelText("Search"), "largo");
    await userEvent.click(screen.getByRole("tab", { name: "Raw Feel" }));
    const s = stored("ls_session");
    expect(s).toMatchObject({ src: "itunes", feel: true, cube: false, song: null });
    expect(s.f.q).toBe("largo");
  });
  it("a session that is junk opens the usual page", async () => {
    localStorage.setItem("ls_session", "{broken");
    await open();
    expect(rowNames()).toHaveLength(8);
  });
});

describe("the demo data", () => {
  const demo = () => buildDataset({ ...fixtureLibrary(), demo: 1 });
  it("says so in the header, all the time, and a normal library does not", async () => {
    await open(demo());
    expect(document.querySelector(".rmsg")?.textContent).toBe("Demo data: classical Feel ratings, no audio");
    cleanup();
    await open();
    expect(document.querySelector(".rmsg")?.textContent).toBe("");
  });
  it("plays nothing, and says why", async () => {
    await open(demo());
    await userEvent.click(screen.getByRole("button", { name: "Next" })); // idle: it would start the list
    expect(document.querySelector(".rmsg")?.textContent).toBe("Demo data: there is no audio to play here");
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });
});

describe("back and forward through the views", () => {
  it("clicking an artist filters, offers '← back', and back returns", async () => {
    await open();
    expect(screen.queryByRole("button", { name: "← back" })).toBeNull();
    await userEvent.click(duoCell());
    expect(rowNames()).toHaveLength(3);
    await userEvent.click(screen.getByRole("button", { name: "← back" }));
    expect(rowNames()).toHaveLength(8);
    expect(screen.queryByRole("button", { name: "← back" })).toBeNull();
  });
});

describe("presets", () => {
  const saveAs = async (name: string) => {
    await userEvent.click(screen.getByRole("button", { name: /Presets/ }));
    await userEvent.type(screen.getByLabelText("Name for the current view"), `${name}{Enter}`);
  };
  it("saves the current view under a name, and applying it later restores it (and '← back' undoes that)", async () => {
    await open();
    await userEvent.type(screen.getByLabelText("Search"), "duo");
    await saveAs("Duo songs");
    expect(stored("ls_presets")).toEqual([expect.objectContaining({ name: "Duo songs", state: expect.objectContaining({ tab: "itunes", f: expect.objectContaining({ q: "duo" }) }) })]);
    await userEvent.click(screen.getByRole("button", { name: "✕ Clear filters" }));
    expect(rowNames()).toHaveLength(8);
    await userEvent.click(screen.getByRole("button", { name: /Presets/ }));
    await userEvent.click(screen.getByText("Duo songs"));
    expect(rowNames()).toHaveLength(3);
    await userEvent.click(screen.getByRole("button", { name: "← back" }));
    expect(rowNames()).toHaveLength(8);
  });
  it("a saved preset switches tabs", async () => {
    localStorage.setItem("ls_presets", JSON.stringify([{ name: "Axes", state: { tab: "cube", f: {} } }]));
    await open();
    await userEvent.click(screen.getByRole("button", { name: /Presets/ }));
    await userEvent.click(screen.getByText("Axes"));
    expect(screen.getByRole("tab", { name: "Feel Axes" }).getAttribute("aria-selected")).toBe("true");
  });
  it("delete asks first", async () => {
    localStorage.setItem("ls_presets", JSON.stringify([{ name: "Old", state: { tab: "itunes" } }]));
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    await open();
    await userEvent.click(screen.getByRole("button", { name: /Presets/ }));
    await userEvent.click(screen.getByRole("button", { name: "Delete Old" }));
    expect(stored("ls_presets")).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Delete Old" }));
    expect(stored("ls_presets")).toEqual([]);
    expect(confirm).toHaveBeenCalledTimes(2);
  });
});

describe("the column menu", () => {
  const rightClickHeader = (name: string) => fireEvent.contextMenu(screen.getByRole("button", { name }).closest("th")!, { clientX: 50, clientY: 50 });
  it("opens on a right-click of a header; unticking a column hides it, and it is remembered", async () => {
    await open();
    expect(columnHeaders()).toContain("Year");
    rightClickHeader("Name");
    const menu = screen.getByRole("menu", { name: "Columns" });
    await userEvent.click(within(menu).getByLabelText("Year"));
    expect(columnHeaders()).not.toContain("Year");
    expect(stored("ls_hidden").itunes).toContain("year");
  });
  it("ticking a column that starts hidden shows it", async () => {
    await open();
    expect(columnHeaders()).not.toContain("Path");
    rightClickHeader("Name");
    await userEvent.click(within(screen.getByRole("menu", { name: "Columns" })).getByLabelText("Path"));
    expect(columnHeaders()).toContain("Path");
  });
  it("hiding the column the list is sorted by ends the sort", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Year" }));
    expect(rowNames()[0]).toBe("Unrated Song");
    rightClickHeader("Name");
    await userEvent.click(within(screen.getByRole("menu", { name: "Columns" })).getByLabelText("Year"));
    expect(rowNames()[0]).toBe("Spider Man Theme");
  });
  it("the column order was saved and comes back; Reset order restores the usual one", async () => {
    localStorage.setItem("ls_order", JSON.stringify({ itunes: ["artist", "name"] }));
    await open();
    expect(columnHeaders().slice(0, 2)).toEqual(["Artist", "Name"]);
    rightClickHeader("Name");
    await userEvent.click(screen.getByRole("button", { name: /Reset order/ }));
    expect(columnHeaders().slice(0, 2)).toEqual(["Name", "Artist"]);
  });
  it("dragging a header onto another reorders the columns", async () => {
    await open();
    const dt = { setData: vi.fn(), effectAllowed: "" };
    const th = (n: string) => screen.getByRole("button", { name: n }).closest("th")!;
    fireEvent.dragStart(th("Artist"), { dataTransfer: dt });
    fireEvent.dragOver(th("Name"), { dataTransfer: dt });
    fireEvent.drop(th("Name"), { dataTransfer: dt });
    expect(columnHeaders().slice(0, 2)).toEqual(["Artist", "Name"]);
    expect(stored("ls_order").itunes.slice(0, 2)).toEqual(["artist", "name"]);
  });
  it("the other tabs keep their own columns", async () => {
    await open();
    rightClickHeader("Name");
    await userEvent.click(within(screen.getByRole("menu", { name: "Columns" })).getByLabelText("Year"));
    await userEvent.click(screen.getByRole("tab", { name: "MP3 Archive (CDs)" }));
    expect(columnHeaders()).toContain("Category");
    await userEvent.click(screen.getByRole("tab", { name: "iTunes Library" }));
    expect(columnHeaders()).not.toContain("Year");
  });
});

describe("the player on the MP3 Archive tab", () => {
  const LARGO = { path: "C:\\music\\Largo.mp3", t: 5 };
  const tabSelected = (name: string) => screen.getByRole("tab", { name }).getAttribute("aria-selected") === "true";
  const onArchiveWith = async (song: typeof LARGO | null) => {
    localStorage.setItem("ls_session", JSON.stringify(toSession(view({ type: "tab", tab: "archive" }), false, song)));
    await open();
  };
  it("the song is not paused when you switch to the tab, and the player stays", async () => {
    localStorage.setItem("ls_session", JSON.stringify(toSession(initialUiState(), false, LARGO)));
    await open();
    const pauses = vi.mocked(HTMLMediaElement.prototype.pause).mock.calls.length;
    await userEvent.click(screen.getByRole("tab", { name: "MP3 Archive (CDs)" }));
    expect(vi.mocked(HTMLMediaElement.prototype.pause).mock.calls.length).toBe(pauses);
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
  });
  it("Play, Pause and the song text work there", async () => {
    await onArchiveWith(LARGO);
    expect(screen.getByText(/⏸ Largo — Antonín Dvořák/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  });
  it("clicking the song's name goes to the iTunes Library and shows the song", async () => {
    await onArchiveWith(LARGO);
    expect(tabSelected("MP3 Archive (CDs)")).toBe(true);
    await userEvent.click(screen.getByText(/⏸ Largo — Antonín Dvořák/));
    expect(tabSelected("iTunes Library")).toBe(true);
    expect(document.querySelector("tr.now")?.textContent).toContain("Largo");
  });
  it("on any other tab the click stays where it is", async () => {
    localStorage.setItem("ls_session", JSON.stringify(toSession(view({ type: "tab", tab: "feel" }), false, LARGO)));
    await open();
    await userEvent.click(screen.getByText(/⏸ Largo — Antonín Dvořák/));
    expect(tabSelected("Raw Feel")).toBe(true);
  });
  it("Next does not change tab", async () => {
    await onArchiveWith(LARGO);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(tabSelected("MP3 Archive (CDs)")).toBe(true);
  });
  it("with nothing playing, nothing starts there, and it says why", async () => {
    await onArchiveWith(null);
    for (const name of ["Play", "Next", "Previous"]) {
      await userEvent.click(screen.getByRole("button", { name }));
      expect(screen.getByRole("status").textContent).toBe("Archive songs are on CDs, so they can't be played here");
    }
    await userEvent.click(document.querySelector("tbody tr:not(.pad) td[data-k='name']")!);
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });
  it("the song keeps its place in the queue on the archive tab: no 'next: from the current results'", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Next" })); // idle: starts the list (needs the helper, so nothing plays here)
    localStorage.clear();
    cleanup();
    await onArchiveWith(LARGO);
    expect(screen.getByText(/⏸ Largo — Antonín Dvořák\s+\(resume at 0:05\)/)).toBeTruthy();
    expect(screen.queryByText(/next: from the current results/)).toBeNull();
  });
});

describe("About, and the back and forward buttons", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    };
  });
  it("the About button opens the box with the library's version", async () => {
    await open();
    expect((document.getElementById("about") as HTMLDialogElement).open).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "ⓘ About" }));
    expect((document.getElementById("about") as HTMLDialogElement).open).toBe(true);
    expect(screen.getByText("Version 0.2.0")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect((document.getElementById("about") as HTMLDialogElement).open).toBe(false);
  });
  it("the version is the one the helper reads now, not the one data.js was built with; and when the data was built", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/version") return new Response(JSON.stringify({ version: "0.3.0" }), { status: 200 });
      throw new TypeError("Failed to fetch");
    }));
    await open(); // the fixture's data.js says 0.2.0
    await userEvent.click(screen.getByRole("button", { name: "ⓘ About" }));
    expect(screen.getByText("Version 0.3.0")).toBeTruthy();
    expect(screen.queryByText("Version 0.2.0")).toBeNull();
    expect(screen.getByText("Data built 2026-11-19 10:00")).toBeTruthy();
  });
  it("without the helper the About box falls back to the version in data.js", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "ⓘ About" }));
    expect(screen.getByText("Version 0.2.0")).toBeTruthy();
  });
  it("the mouse Back button undoes the last artist click, and says when there is nothing to go back to", async () => {
    await open();
    expect(history.back).toHaveBeenCalled(); // parked on the middle of three entries
    await userEvent.click(duoCell());
    expect(rowNames()).toHaveLength(3);
    act(() => void window.dispatchEvent(new PopStateEvent("popstate", { state: { hub: "b" } })));
    expect(rowNames()).toHaveLength(8);
    act(() => void window.dispatchEvent(new PopStateEvent("popstate", { state: { hub: "b" } })));
    expect(screen.getByRole("status").textContent).toBe("Nothing to go back to");
    act(() => void window.dispatchEvent(new PopStateEvent("popstate", { state: { hub: "f" } })));
    expect(rowNames()).toHaveLength(3);
  });
});

describe("tips", () => {
  it("every control has a tip of the page's own (no browser tooltips)", async () => {
    await open();
    expect(document.querySelectorAll("[title]").length).toBe(0);
    expect(document.getElementById("tip")).toBeTruthy();
  });
});
