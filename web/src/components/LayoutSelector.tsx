"use client";

import { useState, useRef, useEffect } from "react";

export type LayoutKey =
  | "1"
  | "2v"
  | "2h"
  | "3v"
  | "3h"
  | "4"
  | "4v"
  | "4h"
  | "6";

export const LAYOUT_OPTIONS: { key: LayoutKey; label: string; cols: number; rows: number }[] = [
  { key: "1", label: "1 chart", cols: 1, rows: 1 },
  { key: "2v", label: "2 (side by side)", cols: 2, rows: 1 },
  { key: "2h", label: "2 (stacked)", cols: 1, rows: 2 },
  { key: "3v", label: "3 (columns)", cols: 3, rows: 1 },
  { key: "3h", label: "3 (rows)", cols: 1, rows: 3 },
  { key: "4", label: "4 (2x2)", cols: 2, rows: 2 },
  { key: "4v", label: "4 (columns)", cols: 4, rows: 1 },
  { key: "4h", label: "4 (rows)", cols: 1, rows: 4 },
  { key: "6", label: "6 (2x3)", cols: 3, rows: 2 },
];

export function panelCountForLayout(layout: LayoutKey): number {
  const o = LAYOUT_OPTIONS.find((x) => x.key === layout);
  return o ? o.cols * o.rows : 1;
}

const GRID_CLASSES: Record<LayoutKey, string> = {
  "1": "grid-cols-1 grid-rows-1",
  "2v": "grid-cols-2 grid-rows-1",
  "2h": "grid-cols-1 grid-rows-2",
  "3v": "grid-cols-3 grid-rows-1",
  "3h": "grid-cols-1 grid-rows-3",
  "4": "grid-cols-2 grid-rows-2",
  "4v": "grid-cols-4 grid-rows-1",
  "4h": "grid-cols-1 grid-rows-4",
  "6": "grid-cols-3 grid-rows-2",
};

export function gridClassForLayout(layout: LayoutKey): string {
  return GRID_CLASSES[layout] ?? "grid-cols-1 grid-rows-1";
}

interface LayoutSelectorProps {
  value: LayoutKey;
  onChange: (layout: LayoutKey) => void;
  className?: string;
}

export function LayoutSelector({ value, onChange, className = "" }: LayoutSelectorProps) {
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

  const current = LAYOUT_OPTIONS.find((o) => o.key === value);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="chart-toolbar-btn flex items-center gap-2"
        title="Chart layout"
      >
        <LayoutIcon layout={value} />
        <span className="text-xs font-medium">{current?.label ?? value}</span>
        <svg className="h-3 w-3 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="chart-dropdown absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-md border border-[var(--border)] bg-[var(--surface)] py-2 shadow-lg">
          <div className="grid grid-cols-3 gap-1 px-2">
            {LAYOUT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => {
                  onChange(opt.key);
                  setOpen(false);
                }}
                className={`flex flex-col items-center gap-0.5 rounded p-2 text-[10px] transition ${
                  value === opt.key
                    ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                    : "text-[var(--text)] hover:bg-[var(--hover)]"
                }`}
                title={opt.label}
              >
                <LayoutIcon layout={opt.key} />
                <span className="truncate">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LayoutIcon({ layout }: { layout: LayoutKey }) {
  const size = 20;
  const gap = 2;
  const o = LAYOUT_OPTIONS.find((x) => x.key === layout);
  const cols = o?.cols ?? 1;
  const rows = o?.rows ?? 1;
  const w = (size - gap * (cols - 1)) / cols;
  const h = (size - gap * (rows - 1)) / rows;

  return (
    <svg width={size} height={size} className="shrink-0">
      {Array.from({ length: cols * rows }, (_, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = col * (w + gap);
        const y = row * (h + gap);
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={w}
            height={h}
            fill="currentColor"
            opacity={0.9}
            rx={1}
          />
        );
      })}
    </svg>
  );
}
