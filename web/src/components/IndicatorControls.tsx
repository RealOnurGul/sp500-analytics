"use client";

import { useState, useRef, useEffect } from "react";

export interface IndicatorState {
  emaRibbon: boolean;
  ema50: boolean;
  ema200: boolean;
  vwap: boolean;
  bollinger: boolean;
  sar: boolean;
}

export const DEFAULT_INDICATORS: IndicatorState = {
  emaRibbon: false,
  ema50: true,
  ema200: true,
  vwap: false,
  bollinger: false,
  sar: false,
};

const LABELS: { key: keyof IndicatorState; label: string }[] = [
  { key: "emaRibbon", label: "EMA Ribbon (8–144)" },
  { key: "ema50", label: "EMA 50" },
  { key: "ema200", label: "EMA 200" },
  { key: "vwap", label: "VWAP" },
  { key: "bollinger", label: "Bollinger Bands" },
  { key: "sar", label: "Parabolic SAR" },
];

interface IndicatorControlsProps {
  indicators: IndicatorState;
  onChange: (next: IndicatorState) => void;
  className?: string;
}

export function IndicatorControls({
  indicators,
  onChange,
  className = "",
}: IndicatorControlsProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const count = (LABELS.filter(({ key }) => indicators[key])).length;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="chart-toolbar-btn flex items-center gap-2"
        title="Indicators"
      >
        <span className="text-xs font-medium">Indicators</span>
        {count > 0 && (
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded bg-[var(--accent)] px-1.5 text-[10px] font-medium text-[var(--accent-fg)]">
            {count}
          </span>
        )}
        <svg className="h-3 w-3 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="chart-dropdown absolute left-0 top-full z-50 mt-1 min-w-[220px] rounded-md border border-[var(--border)] bg-[var(--surface)] py-2 shadow-lg">
          <div className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Indicators
          </div>
          {LABELS.map(({ key, label }) => (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--hover)]"
            >
              <input
                type="checkbox"
                checked={Boolean(indicators[key])}
                onChange={(e) =>
                  onChange({ ...DEFAULT_INDICATORS, ...indicators, [key]: e.target.checked })
                }
                className="h-4 w-4 rounded border-[var(--border)]"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
