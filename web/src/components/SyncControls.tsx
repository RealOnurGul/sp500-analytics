"use client";

import { useState, useRef, useEffect } from "react";

export interface SyncState {
  symbol: boolean;
  interval: boolean;
  crosshair: boolean;
  time: boolean;
  dateRange: boolean;
}

interface SyncControlsProps {
  sync: SyncState;
  onChange: (next: SyncState) => void;
  className?: string;
}

const LABELS: { key: keyof SyncState; label: string }[] = [
  { key: "symbol", label: "Symbol" },
  { key: "interval", label: "Interval" },
  { key: "crosshair", label: "Crosshair" },
  { key: "time", label: "Time" },
  { key: "dateRange", label: "Date range" },
];

export function SyncControls({ sync, onChange, className = "" }: SyncControlsProps) {
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

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="chart-toolbar-btn flex items-center gap-2"
        title="Sync in layout"
      >
        <span className="text-xs font-medium">Sync</span>
        <svg className="h-3 w-3 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="chart-dropdown absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-md border border-[var(--border)] bg-[var(--surface)] py-2 shadow-lg">
          <div className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Sync in layout
          </div>
          {LABELS.map(({ key, label }) => (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--hover)]"
            >
              <input
                type="checkbox"
                checked={sync[key]}
                onChange={(e) => onChange({ ...sync, [key]: e.target.checked })}
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
