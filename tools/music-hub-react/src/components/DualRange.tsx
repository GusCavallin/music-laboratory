interface Props {
  min: number;
  max: number;
  step: number;
  lo: number;
  hi: number;
  /** what the two knobs are called for assistive technology: "Wonder minimum", "Wonder maximum" */
  label: string;
  onChange: (which: "lo" | "hi", value: number) => void;
}

/**
 * A slider with two knobs, made of two range inputs laid over each other. The parent owns the values and decides what happens when the knobs
 * cross. When the lower knob is in the upper half it goes underneath, so that two knobs at the top end can still be told apart.
 */
export function DualRange({ min, max, step, lo, hi, label, onChange }: Props) {
  const span = max - min || 1;
  const from = (lo - min) / span;
  const upperHalf = from >= 0.5;
  return (
    <div className="dual">
      <div className="tr" />
      <div className="fill" style={{ left: `calc(7px + (100% - 14px) * ${from})`, width: `calc((100% - 14px) * ${(hi - lo) / span})` }} />
      <input
        type="range" min={min} max={max} step={step} value={lo} aria-label={`${label} minimum`}
        style={{ zIndex: upperHalf ? 1 : 3 }}
        onChange={(e) => onChange("lo", Number(e.target.value))}
      />
      <input
        type="range" min={min} max={max} step={step} value={hi} aria-label={`${label} maximum`}
        style={{ zIndex: upperHalf ? 3 : 1 }}
        onChange={(e) => onChange("hi", Number(e.target.value))}
      />
    </div>
  );
}
