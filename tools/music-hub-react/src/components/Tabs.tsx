import type { Tab } from "../state/uiState";

const TABS: readonly { tab: Tab; label: string; tip?: string }[] = [
  { tab: "itunes", label: "iTunes Library" },
  { tab: "feel", label: "Raw Feel", tip: "Find songs by emotional tone (nine GEMS scales + maturity). Only songs that have been rated for feeling." },
  { tab: "cube", label: "Feel Axes", tip: "Every rated song as a dot in a cube of three independent feelings (Calm, Ease, Awe), colored by maturity; the box you size picks the songs in the list" },
  { tab: "archive", label: "MP3 Archive (CDs)" },
];

export function Tabs({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <div className="tabs" role="tablist" aria-label="Library">
      {TABS.map((t) => (
        <button
          key={t.tab}
          type="button"
          role="tab"
          aria-selected={t.tab === tab}
          className={t.tab === tab ? "on" : ""}
          title={t.tip}
          onClick={() => onChange(t.tab)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
