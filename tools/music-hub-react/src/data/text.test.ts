import { describe, expect, it } from "vitest";
import { fold, joined, matchesTerms, parseTerms, searchForms, spaced } from "./text";

describe("fold", () => {
  it("ignores capitals and accents", () => {
    expect(fold("Dvořák")).toBe("dvorak");
    expect(fold("Antonín")).toBe("antonin");
  });
  it("copes with missing values", () => {
    expect(fold(null)).toBe("");
    expect(fold(undefined)).toBe("");
  });
});

describe("spaced and joined", () => {
  it("spaced treats punctuation as a word break", () => {
    expect(spaced("Spider-Man")).toBe("spider man");
    expect(spaced("  Hello,   World! ")).toBe("hello world");
  });
  it("joined removes dashes, apostrophes, dots, slashes and ampersands", () => {
    expect(joined("A-ha")).toBe("aha");
    expect(joined("AC/DC")).toBe("acdc");
    expect(joined("Guns N' Roses")).toBe("guns n roses");
    expect(joined("Simon & Garfunkel")).toBe("simon garfunkel");
  });
});

describe("parseTerms and matchesTerms", () => {
  const row = searchForms(["Take On Me", "a-ha", "Hunting High and Low", "", "pop"]);

  it("a blank query has no terms and matches everything", () => {
    expect(parseTerms("   ")).toEqual([]);
    expect(matchesTerms(row, [])).toBe(true);
  });
  it("every word must match, in any order", () => {
    expect(matchesTerms(row, parseTerms("take me"))).toBe(true);
    expect(matchesTerms(row, parseTerms("me take"))).toBe(true);
    expect(matchesTerms(row, parseTerms("take zebra"))).toBe(false);
  });
  it("a word matches anywhere inside the text, like the current page", () => {
    expect(matchesTerms(row, parseTerms("unt"))).toBe(true); // inside "Hunting"
  });
  it("finds a band written with or without its punctuation", () => {
    expect(matchesTerms(row, parseTerms("a-ha"))).toBe(true);
    expect(matchesTerms(row, parseTerms("aha"))).toBe(true);
    const acdc = searchForms(["Highway to Hell", "AC/DC"]);
    expect(matchesTerms(acdc, parseTerms("acdc"))).toBe(true);
    expect(matchesTerms(acdc, parseTerms("ac/dc"))).toBe(true);
  });
  it("ignores accents in both the text and the query", () => {
    const dvorak = searchForms(["Largo", "Antonín Dvořák"]);
    expect(matchesTerms(dvorak, parseTerms("dvorak largo"))).toBe(true);
    expect(matchesTerms(dvorak, parseTerms("DVOŘÁK"))).toBe(true);
  });
  it("does not join words that have spaces between them", () => {
    const spider = searchForms(["Spider Man Theme"]);
    expect(matchesTerms(spider, parseTerms("spider man"))).toBe(true);
    expect(matchesTerms(spider, parseTerms("spiderman"))).toBe(false);
  });
});
