"use client";

export type RangeKey = "1M" | "3M" | "6M" | "1Y" | "5Y" | "MAX";

const RANGES: RangeKey[] = ["1M", "3M", "6M", "1Y", "5Y", "MAX"];

interface RangeButtonsProps {
  value: RangeKey;
  onChange: (range: RangeKey) => void;
  className?: string;
}

export function RangeButtons({
  value,
  onChange,
  className = "",
}: RangeButtonsProps) {
  return (
    <div
      className={`flex flex-wrap gap-1 ${className}`}
      role="group"
      aria-label="Time range"
    >
      {RANGES.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={value === r ? "range-btn active" : "range-btn"}
        >
          {r}
        </button>
      ))}
    </div>
  );
}
