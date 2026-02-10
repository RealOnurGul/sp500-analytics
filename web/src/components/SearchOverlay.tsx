"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TickerOption } from "./SearchTicker";

interface SearchOverlayProps {
  open: boolean;
  initialQuery: string;
  onClose: () => void;
  onSelect: (ticker: string) => void;
}

export function SearchOverlay({
  open,
  initialQuery,
  onClose,
  onSelect,
}: SearchOverlayProps) {
  const [query, setQuery] = useState(initialQuery);
  const [options, setOptions] = useState<TickerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Sync query when overlay is opened with a new initialQuery
  useEffect(() => {
    if (open) {
      setQuery(initialQuery);
      setOptions([]);
      setHighlight(0);
      // small timeout so focus works reliably after mount
      const id = setTimeout(() => {
        inputRef.current?.focus();
        if (initialQuery) {
          inputRef.current?.setSelectionRange(initialQuery.length, initialQuery.length);
        }
      }, 0);
      return () => clearTimeout(id);
    }
  }, [open, initialQuery]);

  const fetchTickers = useCallback(async (q: string) => {
    if (!q.trim()) {
      setOptions([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/tickers?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setOptions(Array.isArray(data) ? data : []);
      setHighlight(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchTickers(query);
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, query, fetchTickers]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (options.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + options.length) % options.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const chosen = options[highlight];
      if (chosen) {
        onSelect(chosen.ticker);
        onClose();
      }
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-16">
      <div className="w-full max-w-2xl rounded-lg bg-[var(--surface)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-[var(--text)]">Search</span>
            <span className="text-xs text-[var(--text-muted)]">
              Type a ticker or company name. Press Enter to select.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--border)]"
          >
            Esc to close
          </button>
        </div>
        <div className="border-b border-[var(--border)] px-4 py-3">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search symbols..."
            className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:border-[var(--text-muted)] focus:outline-none"
          />
        </div>
        <div className="max-h-96 overflow-auto px-1 py-2">
          {loading && (
            <div className="px-4 py-2 text-sm text-[var(--text-muted)]">Searching...</div>
          )}
          {!loading && options.length === 0 && query.trim() && (
            <div className="px-4 py-2 text-sm text-[var(--text-muted)]">No matches.</div>
          )}
          {options.map((opt, i) => (
            <button
              key={opt.ticker}
              type="button"
              onClick={() => {
                onSelect(opt.ticker);
                onClose();
              }}
              className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm ${
                i === highlight ? "bg-[var(--border)]" : "hover:bg-[var(--border)]/60"
              }`}
            >
              <div className="flex flex-col">
                <span className="font-medium text-[var(--text)]">{opt.ticker}</span>
                <span className="text-xs text-[var(--text-muted)]">{opt.name}</span>
              </div>
              <div className="text-right text-xs text-[var(--text-muted)]">
                <div>{opt.sector}</div>
                {opt.subIndustry && <div>{opt.subIndustry}</div>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

