"use client";

import { useEffect, useState } from "react";
import { CandlesChart, type Candle, type VisibleRange } from "./CandlesChart";
import { StatsRow, type Stats } from "./StatsRow";
import type { RangeKey } from "./RangeButtons";

interface ChartPanelProps {
  id: string;
  ticker: string | null;
  range: RangeKey;
  active: boolean;
  onClick?: () => void;
  syncCrosshair?: boolean;
  syncTime?: boolean;
  syncDateRange?: boolean;
  syncedCrosshairTime?: string | null;
  syncedVisibleRange?: VisibleRange | null;
  onCrosshairMove?: (time: string) => void;
  onVisibleRangeChange?: (range: VisibleRange) => void;
}

export function ChartPanel({
  id: _id,
  ticker,
  range,
  active,
  onClick,
  syncCrosshair,
  syncTime,
  syncDateRange,
  syncedCrosshairTime,
  syncedVisibleRange,
  onCrosshairMove,
  onVisibleRangeChange,
}: ChartPanelProps) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ticker) {
      setCandles([]);
      setStats(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(
      `/api/prices?ticker=${encodeURIComponent(ticker)}&range=${encodeURIComponent(range)}`
    )
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to load prices");
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setCandles(data.candles || []);
        setStats(data.stats || null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load prices");
        setCandles([]);
        setStats(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ticker, range]);

  return (
    <section
      className={`flex min-h-0 min-w-0 flex-col overflow-hidden bg-[var(--surface)] p-2 transition ${
        active ? "ring-2 ring-[var(--accent)] ring-inset" : "hover:bg-gray-50"
      }`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <div className="mb-1 flex items-center justify-between text-xs text-[var(--text-muted)]">
        <span className="font-medium text-[var(--text)]">{ticker ?? "No symbol selected"}</span>
      </div>

      {ticker && (
        <StatsRow ticker={ticker} stats={stats} className="mb-1 text-xs" />
      )}

      {error && (
        <div className="mb-1 rounded border border-[var(--red)] bg-[var(--surface)] px-2 py-0.5 text-xs text-[var(--red)]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[120px] flex-1 items-center justify-center text-[var(--text-muted)]">
          Loading...
        </div>
      ) : ticker && candles.length > 0 ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <CandlesChart
            ticker={ticker}
            candles={candles}
            syncCrosshair={syncCrosshair}
            syncTime={syncTime}
            syncDateRange={syncDateRange}
            syncedCrosshairTime={syncedCrosshairTime}
            syncedVisibleRange={syncedVisibleRange}
            onCrosshairMove={onCrosshairMove}
            onVisibleRangeChange={onVisibleRangeChange}
          />
        </div>
      ) : ticker ? (
        <div className="flex min-h-[120px] flex-1 items-center justify-center text-[var(--text-muted)]">
          No chart data for this range.
        </div>
      ) : (
        <div className="flex min-h-[120px] flex-1 items-center justify-center text-[var(--text-muted)]">
          Select a ticker for this panel.
        </div>
      )}
    </section>
  );
}

