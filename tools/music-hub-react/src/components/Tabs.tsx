import type { Tab } from "../state/uiState";

// Raw Feel and Feel Axes join this list in slice 3.
const TABS: readonly { tab: Tab; label: string }[] = [
  { tab: "itunes", label: "iTunes Library" },
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
          onClick={() => onChange(t.tab)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
