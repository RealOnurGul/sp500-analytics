"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface TickerOption {
  ticker: string;
  name: string;
  sector: string;
  subIndustry: string;
}

interface SearchTickerProps {
  onSelect: (ticker: string) => void;
  selectedTicker: string | null;
  className?: string;
}

export function SearchTicker({
  onSelect,
  selectedTicker,
  className = "",
}: SearchTickerProps) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<TickerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

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
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setOptions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      fetchTickers(query);
      setOpen(true);
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchTickers]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || options.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + options.length) % options.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      onSelect(options[highlight].ticker);
      setQuery("");
      setOpen(false);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => options.length > 0 && setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search ticker or company..."
        className="w-full max-w-md rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:border-[var(--text-muted)] focus:outline-none"
        aria-label="Search ticker"
      />
      {open && options.length > 0 && (
        <ul
          className="absolute top-full left-0 z-50 mt-1 max-h-72 w-full max-w-md overflow-auto rounded border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg"
          role="listbox"
        >
          {options.map((opt, i) => (
            <li
              key={opt.ticker}
              role="option"
              aria-selected={i === highlight}
              className={`cursor-pointer px-3 py-2 text-sm ${
                i === highlight ? "bg-[var(--border)]" : ""
              }`}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(opt.ticker);
                setQuery("");
                setOpen(false);
              }}
            >
              <span className="font-medium">{opt.ticker}</span>
              <span className="ml-2 text-[var(--text-muted)]">{opt.name}</span>
            </li>
          ))}
        </ul>
      )}
      {loading && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)]">
          Searching...
        </span>
      )}
      {selectedTicker && (
        <span className="ml-2 text-sm text-[var(--text-muted)]">
          Selected: {selectedTicker}
        </span>
      )}
    </div>
  );
}
