import type { FeelStat, Song } from "./types";

/** The nine GEMS scales (Zentner, Grandjean and Scherer, 2008) plus maturity. The order is the order of the scores in data.js: do not reorder. */
export const FEEL_SCALES = [
  { key: "wonder", label: "Wonder", tip: "filled with wonder, amazed" },
  { key: "transcendence", label: "Transcendence", tip: "spiritual, uplifted, awe" },
  { key: "tenderness", label: "Tenderness", tip: "tender, affectionate, in love" },
  { key: "nostalgia", label: "Nostalgia", tip: "nostalgic, sentimental, dreamy" },
  { key: "peacefulness", label: "Peacefulness", tip: "calm, serene, relaxed" },
  { key: "power", label: "Power", tip: "strong, energetic, triumphant" },
  { key: "joyful", label: "Joyful activation", tip: "joyful, bouncy, makes you want to dance" },
  { key: "tension", label: "Tension", tip: "tense, agitated, nervous" },
  { key: "sadness", label: "Sadness", tip: "sad, sorrowful, tearful" },
  {
    key: "maturity",
    label: "Maturity",
    tip: "emotionally mature: ambivalence, responsibility, commitment, repair, acceptance, honest loss (empty for instrumentals)",
  },
] as const;

export type FeelKey = (typeof FEEL_SCALES)[number]["key"];

/** Position of the confidence (1 low, 2 medium, 3 high) after the ten scores in a song's `feel` array. */
export const CONFIDENCE_INDEX = FEEL_SCALES.length;

/** The Confidence menu: 0 = show every confidence. */
export const CONFIDENCE_CHOICES = { all: 0, low: 1, medium: 2, high: 3 } as const;
export type ConfidenceChoice = keyof typeof CONFIDENCE_CHOICES;

/** A range for every scale, in FEEL_SCALES order. The full range [0, 10] filters nothing. */
export type FeelRanges = [number, number][];

export const fullFeelRanges = (): FeelRanges => FEEL_SCALES.map(() => [0, 10]);

/** A song's score on one scale (null: not rated, or an instrumental has no maturity). Accepts "f_wonder" column names too. */
export function feelScore(song: Song, scaleIndex: number): number | null {
  return song.feel?.[scaleIndex] ?? null;
}

/** The statistic columns ("f_wonder", ..., "f_conf") map to positions in `feel`; null for any other column. */
export function feelColumnIndex(column: string): number | null {
  if (column === "f_conf") return CONFIDENCE_INDEX;
  if (!column.startsWith("f_")) return null;
  const i = FEEL_SCALES.findIndex((s) => s.key === column.slice(2));
  return i < 0 ? null : i;
}

/** Mean and sample standard deviation of each scale over all rated songs (any stars, hearts or category). */
export function computeFeelStats(songs: readonly Song[]): Record<FeelKey, FeelStat> {
  const out = {} as Record<FeelKey, FeelStat>;
  FEEL_SCALES.forEach((scale, i) => {
    const values: number[] = [];
    for (const s of songs) {
      const v = s.feel?.[i];
      if (v != null) values.push(v);
    }
    const n = values.length;
    const mean = n ? values.reduce((a, b) => a + b, 0) / n : 0;
    const sd = n > 1 ? Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
    out[scale.key] = { n, mean, sd };
  });
  return out;
}

/** Does the song pass every range and the confidence choice? Unrated songs never pass; a missing score passes only a full range. */
export function passesFeel(song: Song, ranges: FeelRanges, confidence: number): boolean {
  const f = song.feel;
  if (!f) return false;
  if (confidence && f[CONFIDENCE_INDEX] !== confidence) return false;
  for (let i = 0; i < FEEL_SCALES.length; i++) {
    const [lo, hi] = ranges[i] ?? [0, 10];
    const v = f[i];
    if (v == null) {
      if (lo > 0 || hi < 10) return false;
      continue;
    }
    if (v < lo || v > hi) return false;
  }
  return true;
}
