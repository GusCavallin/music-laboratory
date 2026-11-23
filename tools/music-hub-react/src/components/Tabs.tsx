import type { Tab } from "../state/uiState";

const TABS: readonly { tab: Tab; label: string; tip?: string }[] = [
  { tab: "itunes", label: "iTunes Library" },
  { tab: "feel", label: "Raw Feel", tip: "Find songs by emotional tone (nine GEMS scales + maturity). Only songs that have been rated for feeling." },
  { tab: "cube", label: "Feel Axes", tip: "Every rated song as a dot in a cube of three independent feelings (Calm, Ease, Awe), colored by maturity; the box you size picks the songs in the list" },
  { tab: "archive", label: "MP3 Archive (CDs)" },
];

/** `hasArchive` false (no CD archive in the library) leaves the MP3 Archive tab out. */
export function Tabs({ tab, onChange, hasArchive = true }: { tab: Tab; onChange: (tab: Tab) => void; hasArchive?: boolean }) {
  return (
    <div className="tabs" role="tablist" aria-label="Library">
      {TABS.filter((t) => hasArchive || t.tab !== "archive").map((t) => (
        <button
          key={t.tab}
          type="button"
          role="tab"
          aria-selected={t.tab === tab}
          className={t.tab === tab ? "on" : ""}
          data-tip={t.tip}
          onClick={() => onChange(t.tab)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
