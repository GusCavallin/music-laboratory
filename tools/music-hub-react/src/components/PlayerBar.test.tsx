// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlayerBar } from "./PlayerBar";

afterEach(cleanup);

const setup = (over: Partial<Parameters<typeof PlayerBar>[0]> = {}) => {
  const fns = {
    onPrev: vi.fn(), onStop: vi.fn(), onToggle: vi.fn(), onNext: vi.fn(), onShuffle: vi.fn(), onNow: vi.fn(), onSeek: vi.fn(),
    onSkip: vi.fn<(seconds: number) => number | null>(() => 12), onVolume: vi.fn(), onVolumeBy: vi.fn(), onMute: vi.fn(), onHint: vi.fn(),
  };
  const { container } = render(
    <PlayerBar text="Click a song to play the current selection" paused time={0} duration={NaN} shuffle={false} vol={80} muted={false} {...fns} {...over} />,
  );
  return { ...fns, container };
};
const wheel = (el: Element, deltaY: number) => fireEvent.wheel(el, { deltaY });

describe("PlayerBar buttons", () => {
  it("previous, stop, play, next, shuffle", async () => {
    const p = setup();
    await userEvent.click(screen.getByRole("button", { name: "Previous" }));
    await userEvent.click(screen.getByRole("button", { name: "Stop" }));
    await userEvent.click(screen.getByRole("button", { name: "Play" }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Shuffle" }));
    expect([p.onPrev, p.onStop, p.onToggle, p.onNext, p.onShuffle].map((f) => f.mock.calls.length)).toEqual([1, 1, 1, 1, 1]);
  });
  it("the play button is a pause button while a song plays", () => {
    setup({ paused: false });
    expect(screen.getByRole("button", { name: "Pause" }).textContent).toBe("⏸");
    expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
  });
  it("shuffle shows whether it is on", () => {
    setup({ shuffle: true });
    expect(screen.getByRole("button", { name: "Shuffle" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Shuffle" }).className).toBe("on");
  });
});

describe("PlayerBar now playing", () => {
  it("shows the line and the song's path on hover; a click asks to show the song in the list", async () => {
    const p = setup({ text: "▶ Largo — Dvořák  (2/4)", path: "C:\\m\\Largo.mp3" });
    const now = document.querySelector(".pnow") as HTMLElement; // (Testing Library's text search collapses the double space in the line)
    expect(now.textContent).toBe("▶ Largo — Dvořák  (2/4)");
    expect(now.dataset.tip).toBe("C:\\m\\Largo.mp3");
    await userEvent.click(now);
    expect(p.onNow).toHaveBeenCalledTimes(1);
  });
});

describe("PlayerBar progress", () => {
  it("the clock and the slider follow the song", () => {
    setup({ time: 75, duration: 300 });
    expect(screen.getByText("1:15 / 5:00")).toBeTruthy();
    expect((screen.getByLabelText("Position in the song") as HTMLInputElement).value).toBe("250");
  });
  it("with no song loaded it reads 0:00 / 0:00 and the slider is at the start", () => {
    setup();
    expect(screen.getByText("0:00 / 0:00")).toBeTruthy();
    expect((screen.getByLabelText("Position in the song") as HTMLInputElement).value).toBe("0");
  });
  it("dragging the slider seeks, as a fraction of the song", () => {
    const p = setup({ time: 10, duration: 100 });
    fireEvent.change(screen.getByLabelText("Position in the song"), { target: { value: "500" } });
    expect(p.onSeek).toHaveBeenCalledWith(0.5);
  });
  it("the wheel over the progress skips 5 seconds a notch, and says where it landed", () => {
    const p = setup({ time: 10, duration: 200 });
    const zone = screen.getByLabelText("Position in the song").parentElement!;
    wheel(zone, -100);
    expect(p.onSkip).toHaveBeenCalledWith(5);
    expect(p.onHint).toHaveBeenCalledWith("0:12 / 3:20");
  });
  it("the wheel the other way skips back", () => {
    const p = setup({ time: 10, duration: 200 });
    wheel(screen.getByLabelText("Position in the song").parentElement!, 100);
    expect(p.onSkip).toHaveBeenCalledWith(-5);
  });
  it("with no song the wheel does nothing visible (no hint)", () => {
    const p = setup({ onSkip: vi.fn(() => null) });
    wheel(screen.getByLabelText("Position in the song").parentElement!, -100);
    expect(p.onHint).not.toHaveBeenCalled();
  });
});

describe("PlayerBar volume", () => {
  it("the slider and the icon follow the volume", () => {
    setup({ vol: 30 });
    expect((screen.getByLabelText("Volume") as HTMLInputElement).value).toBe("30");
    expect(screen.getByRole("button", { name: "Mute" }).textContent).toBe("🔉");
  });
  it("a muted player shows the muted icon and offers to unmute", () => {
    setup({ muted: true });
    expect(screen.getByRole("button", { name: "Unmute" }).textContent).toBe("🔇");
  });
  it("the slider and the mute button report", async () => {
    const p = setup();
    fireEvent.change(screen.getByLabelText("Volume"), { target: { value: "55" } });
    await userEvent.click(screen.getByRole("button", { name: "Mute" }));
    expect(p.onVolume).toHaveBeenCalledWith(55);
    expect(p.onMute).toHaveBeenCalledTimes(1);
  });
  it("the wheel over the volume changes it by 5 a notch, and says the new level", () => {
    const p = setup({ vol: 80 });
    wheel(screen.getByLabelText("Volume").parentElement!, -100);
    expect(p.onVolumeBy).toHaveBeenCalledWith(5);
    expect(p.onHint).toHaveBeenCalledWith("Volume 85%");
  });
  it("the hint never goes past 0 or 100", () => {
    const loud = setup({ vol: 98 });
    wheel(screen.getByLabelText("Volume").parentElement!, -100);
    expect(loud.onHint).toHaveBeenCalledWith("Volume 100%");
  });
  it("the page is not scrolled by the wheel (the handler cancels it)", () => {
    setup();
    const zone = screen.getByLabelText("Volume").parentElement!;
    const event = new WheelEvent("wheel", { deltaY: -100, bubbles: true, cancelable: true });
    zone.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
