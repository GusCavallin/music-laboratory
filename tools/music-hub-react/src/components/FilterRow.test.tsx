// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fixtureLibrary } from "../data/fixture";
import { buildDataset } from "../data/load";
import { initialUiState, type UiState } from "../state/uiState";
import { FilterRow } from "./FilterRow";

afterEach(cleanup);
const dataset = buildDataset(fixtureLibrary());

const setup = (over: Partial<UiState> = {}) => {
  const dispatch = vi.fn();
  render(<FilterRow dataset={dataset} state={{ ...initialUiState(), ...over }} dispatch={dispatch} />);
  return dispatch;
};
const optionTexts = (select: HTMLElement) => within(select).getAllByRole("option").map((o) => o.textContent);

describe("FilterRow on the iTunes tab", () => {
  it("offers the decades and countries of the library", () => {
    setup();
    expect(optionTexts(screen.getByLabelText("Decade"))).toEqual(["any", "1890s", "1970s", "1980s", "1990s"]);
    expect(optionTexts(screen.getByLabelText("Country"))).toEqual(["any", "AU", "CZ", "NO", "US"]);
  });

  it("each control dispatches its own action", async () => {
    const dispatch = setup();
    await userEvent.selectOptions(screen.getByLabelText("Decade"), "1990s");
    await userEvent.selectOptions(screen.getByLabelText("Country"), "AU");
    await userEvent.selectOptions(screen.getByLabelText("Rating from"), "3");
    await userEvent.selectOptions(screen.getByLabelText("Rating to"), "4");
    await userEvent.click(screen.getByLabelText("Loved"));
    expect(dispatch.mock.calls.map((c) => c[0])).toEqual([
      { type: "decade", value: "1990s" }, { type: "country", value: "AU" }, { type: "starsFrom", value: 3 },
      { type: "starsTo", value: 4 }, { type: "loved", value: true },
    ]);
  });

  it("lists the playlists, with how many songs each has", () => {
    setup();
    const options = document.querySelectorAll<HTMLOptionElement>("#playlists option");
    expect([...options].map((o) => [o.value, o.label])).toEqual([["Road Trip", "4 songs"], ["Smart Mix", "1 songs"]]);
  });

  it("with a playlist chosen, clicking the box sets its text aside (kept as the placeholder) so the list offers every playlist, and clicking away brings it back", async () => {
    const user = userEvent.setup();
    setup({ playlist: "Road Trip" });
    const box = screen.getByLabelText("Playlist") as HTMLInputElement;
    expect(box.value).toBe("Road Trip");
    await user.click(box);
    expect(box.value).toBe("");
    expect(box.placeholder).toBe("Road Trip");
    await user.click(document.body);
    expect(box.value).toBe("Road Trip");
    expect(box.placeholder).toBe("any (type to filter)");
  });

  it("picking another playlist switches to it, and the × clears the filter", async () => {
    const user = userEvent.setup();
    const dispatch = setup({ playlist: "Road Trip" });
    const box = screen.getByLabelText("Playlist") as HTMLInputElement;
    await user.click(box);
    await user.type(box, "Smart Mix");
    expect(dispatch).toHaveBeenLastCalledWith({ type: "playlist", value: "Smart Mix" });
    await user.click(screen.getByRole("button", { name: "Show every song: no playlist" }));
    expect(dispatch).toHaveBeenLastCalledWith({ type: "playlist", value: "" });
  });

  it("has no × while no playlist is chosen", () => {
    setup();
    expect(screen.queryByRole("button", { name: "Show every song: no playlist" })).toBeNull();
  });

  it("shows the current choices", () => {
    setup({ stars: [2, 5], decade: "1980s", lovedOnly: true });
    expect((screen.getByLabelText("Decade") as HTMLSelectElement).value).toBe("1980s");
    expect((screen.getByLabelText("Rating from") as HTMLSelectElement).value).toBe("2");
    expect((screen.getByLabelText("Loved") as HTMLInputElement).checked).toBe(true);
  });
});

describe("FilterRow on the archive tab", () => {
  it("offers the categories and the iTunes choice with counts", () => {
    setup({ tab: "archive" });
    expect(optionTexts(screen.getByLabelText("Category"))).toEqual(["any", "Kids", "Rock"]);
    expect(optionTexts(screen.getByLabelText("In iTunes"))).toEqual(["any (3)", "in iTunes (1)", "not in iTunes (2)"]);
    expect(screen.queryByLabelText("Decade")).toBeNull();
  });

  it("dispatches the archive actions", async () => {
    const dispatch = setup({ tab: "archive" });
    await userEvent.selectOptions(screen.getByLabelText("Category"), "Kids");
    await userEvent.selectOptions(screen.getByLabelText("In iTunes"), "out");
    expect(dispatch.mock.calls.map((c) => c[0])).toEqual([{ type: "category", value: "Kids" }, { type: "inItunes", value: "out" }]);
  });
});
