import { describe, expect, it } from "vitest";
import { decadeOf, formatStars, formatTime, formatTrack } from "./format";

describe("formatTime", () => {
  it("shows minutes and two-digit seconds", () => {
    expect(formatTime(227)).toBe("3:47");
    expect(formatTime(60)).toBe("1:00");
    expect(formatTime(5)).toBe("0:05");
    expect(formatTime(3725)).toBe("62:05");
  });
});

describe("formatTrack", () => {
  it("shows track of total", () => {
    expect(formatTrack({ track: 5, tracks: 13, disc: 1, discs: 1 })).toBe("5/13");
  });
  it("adds the disc on a multi-disc album", () => {
    expect(formatTrack({ track: 5, tracks: 12, disc: 2, discs: 2 })).toBe("2-5/12");
  });
  it("leaves out an unknown total, and is empty without a track number", () => {
    expect(formatTrack({ track: 5, tracks: 0, disc: 1, discs: 1 })).toBe("5");
    expect(formatTrack({ track: 0, tracks: 13, disc: 1, discs: 1 })).toBe("");
  });
});

describe("formatStars and decadeOf", () => {
  it("repeats the star, nothing for unrated", () => {
    expect(formatStars(3)).toBe("⭐⭐⭐");
    expect(formatStars(0)).toBe("");
  });
  it("names the decade of a year", () => {
    expect(decadeOf(1994)).toBe("1990s");
    expect(decadeOf(2000)).toBe("2000s");
    expect(decadeOf(0)).toBe("0s");
  });
});
