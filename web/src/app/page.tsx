"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RangeButtons, type RangeKey } from "@/components/RangeButtons";
import { StatsRow } from "@/components/StatsRow";
import { CandlesChart, type Candle } from "@/components/CandlesChart";
import type { TickerOption } from "@/components/SearchTicker";
import { SearchOverlay } from "@/components/SearchOverlay";
import { Watchlist } from "@/components/Watchlist";

function getDefaultTicker(options: TickerOption[]): string | null {
  if (options.length === 0) return null;
  const spy = options.find((t) => t.ticker === "SPY");
  if (spy) return spy.ticker;
  const aapl = options.find((t) => t.ticker === "AAPL");
  if (aapl) return aapl.ticker;
  return options[0].ticker;
}

export default function Home() {
  const [tickerOptions, setTickerOptions] = useState<TickerOption[]>([]);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>("1Y");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [stats, setStats] = useState<{
    lastClose: number;
    lastVolume: number;
    lastDate: string;
    change1dPct: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInitialQuery, setSearchInitialQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"chart" | "watchlist">("chart");
  const pendingWatchlistAdd = useRef<((ticker: string) => void) | null>(null);

  const fetchPrices = useCallback(async (t: string, r: RangeKey) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/prices?ticker=${encodeURIComponent(t)}&range=${encodeURIComponent(r)}`
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Failed to load prices");
        setCandles([]);
        setStats(null);
        return;
      }
      const data = await res.json();
      setCandles(data.candles || []);
      setStats(data.stats || null);
    } catch (e) {
      setError("Failed to load prices");
      setCandles([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tickers?q=")
      .then((r) => r.json())
      .then((list: TickerOption[]) => {
        if (cancelled || !Array.isArray(list)) return;
        setTickerOptions(list);
        setSelectedTicker((prev) => {
          if (prev) return prev;
          const defaultT = getDefaultTicker(list);
          return defaultT ?? null;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Global key handler: start typing to open search overlay
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (searchOpen) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
        setSearchMode("chart");
        pendingWatchlistAdd.current = null;
        setSearchOpen(true);
        setSearchInitialQuery(e.key);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [searchOpen]);

  useEffect(() => {
    if (!selectedTicker) return;
    fetchPrices(selectedTicker, range);
  }, [selectedTicker, range, fetchPrices]);

  const handleSelectTicker = (t: string) => {
    setSelectedTicker(t);
  };

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto flex max-w-7xl gap-4">
        <div className="flex-1">
          <header className="mb-6 flex flex-wrap items-center gap-4 border-b border-[var(--border)] pb-4">
            <h1 className="text-xl font-semibold">S&P 500</h1>
            <button
              type="button"
              onClick={() => {
                setSearchMode("chart");
                pendingWatchlistAdd.current = null;
                setSearchInitialQuery("");
                setSearchOpen(true);
              }}
              className="flex items-center gap-2 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--border)]/60"
            >
              <span>Search symbols</span>
              <span className="text-[10px] text-[var(--text-muted)]">
                Type to open
              </span>
            </button>
            <RangeButtons value={range} onChange={setRange} />
          </header>

          {error && (
            <div className="mb-4 rounded border border-[var(--red)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--red)]">
              {error}
            </div>
          )}

          {selectedTicker && (
            <StatsRow
              ticker={selectedTicker}
              stats={stats}
              className="mb-4"
            />
          )}

          <section className="rounded border border-[var(--border)] bg-[var(--surface)] p-4">
            {loading ? (
              <div className="flex h-[400px] items-center justify-center text-[var(--text-muted)]">
                Loading...
              </div>
            ) : candles.length > 0 ? (
              <CandlesChart ticker={selectedTicker ?? undefined} candles={candles} />
            ) : selectedTicker ? (
              <div className="flex h-[400px] items-center justify-center text-[var(--text-muted)]">
                No chart data for this range.
              </div>
            ) : (
              <div className="flex h-[400px] items-center justify-center text-[var(--text-muted)]">
                Search and select a ticker to view the chart.
              </div>
            )}
          </section>
        </div>
        <div className="w-72 shrink-0">
          <Watchlist
            onSelectTicker={(t) => {
              setSelectedTicker(t);
            }}
            onRequestSearchForAdd={(addToFolder) => {
              pendingWatchlistAdd.current = addToFolder;
              setSearchMode("watchlist");
              setSearchInitialQuery("");
              setSearchOpen(true);
            }}
          />
        </div>
      </div>

      <SearchOverlay
        open={searchOpen}
        initialQuery={searchInitialQuery}
        onClose={() => {
          setSearchOpen(false);
          setSearchMode("chart");
          pendingWatchlistAdd.current = null;
        }}
        onSelect={(t) => {
          if (searchMode === "chart") {
            setSelectedTicker(t);
          } else if (searchMode === "watchlist" && pendingWatchlistAdd.current) {
            pendingWatchlistAdd.current(t);
          }
          // Always also select the ticker in the main chart
          setSelectedTicker(t);
          setSearchOpen(false);
          setSearchMode("chart");
          pendingWatchlistAdd.current = null;
        }}
      />
    </main>
  );
}
