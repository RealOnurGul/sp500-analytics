"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RangeButtons, type RangeKey } from "@/components/RangeButtons";
import type { TickerOption } from "@/components/SearchTicker";
import { SearchOverlay } from "@/components/SearchOverlay";
import { LeftSidebar } from "@/components/LeftSidebar";
import { ChartPanel } from "@/components/ChartPanel";
import { Watchlist } from "@/components/Watchlist";
import { SyncControls, type SyncState } from "@/components/SyncControls";
import {
  LayoutSelector,
  type LayoutKey,
  panelCountForLayout,
  gridClassForLayout,
} from "@/components/LayoutSelector";

function getDefaultTicker(options: TickerOption[]): string | null {
  if (options.length === 0) return null;
  const spy = options.find((t) => t.ticker === "SPY");
  if (spy) return spy.ticker;
  const aapl = options.find((t) => t.ticker === "AAPL");
  if (aapl) return aapl.ticker;
  return options[0].ticker;
}

const DEFAULT_LAYOUT: LayoutKey = "1";

export default function Home() {
  const [tickerOptions, setTickerOptions] = useState<TickerOption[]>([]);
  const [range, setRange] = useState<RangeKey>("1Y");
  const [layout, setLayout] = useState<LayoutKey>(DEFAULT_LAYOUT);
  const [panels, setPanels] = useState<Array<{ id: string; ticker: string | null }>>([
    { id: "panel-1", ticker: null },
  ]);
  const [activePanelId, setActivePanelId] = useState<string>("panel-1");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInitialQuery, setSearchInitialQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"chart" | "watchlist">("chart");
  const pendingWatchlistAdd = useRef<((ticker: string) => void) | null>(null);

  const [sync, setSync] = useState<SyncState>({
    symbol: false,
    interval: true,
    crosshair: false,
    time: false,
    dateRange: false,
  });
  const [sharedCrosshairTime, setSharedCrosshairTime] = useState<string | null>(null);
  const [sharedVisibleRange, setSharedVisibleRange] = useState<{
    from: number;
    to: number;
  } | null>(null);

  const panelCount = panelCountForLayout(layout);

  // Keep panels array in sync with layout
  useEffect(() => {
    setPanels((prev) => {
      const next: Array<{ id: string; ticker: string | null }> = [];
      for (let i = 0; i < panelCount; i++) {
        const existing = prev[i];
        next.push({
          id: existing?.id ?? `panel-${i + 1}`,
          ticker: existing?.ticker ?? null,
        });
      }
      return next;
    });
    setActivePanelId((prev) => {
      const firstId = `panel-1`;
      return prev && panelCount >= 1 ? prev : firstId;
    });
  }, [panelCount]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tickers?q=")
      .then((r) => r.json())
      .then((list: TickerOption[]) => {
        if (cancelled || !Array.isArray(list)) return;
        setTickerOptions(list);
        const defaultT = getDefaultTicker(list);
        if (defaultT) {
          setPanels((prev) =>
            prev.map((p, index) =>
              index === 0 && p.ticker == null ? { ...p, ticker: defaultT } : p
            )
          );
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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

  const setActivePanelTicker = useCallback(
    (ticker: string) => {
      setPanels((prev) =>
        sync.symbol
          ? prev.map((p) => ({ ...p, ticker }))
          : prev.map((p) => (p.id === activePanelId ? { ...p, ticker } : p))
      );
    },
    [activePanelId, sync.symbol]
  );

  const onCrosshairMove = useCallback((time: string) => {
    setSharedCrosshairTime(time);
  }, []);

  const onVisibleRangeChange = useCallback((range: { from: number; to: number }) => {
    setSharedVisibleRange(range);
  }, []);

  const openSearch = (mode: "chart" | "watchlist") => {
    setSearchMode(mode);
    pendingWatchlistAdd.current = null;
    setSearchInitialQuery("");
    setSearchOpen(true);
  };

  return (
    <div className="flex min-h-screen">
      <LeftSidebar onOpenSearch={openSearch} />

      <div className="flex min-w-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <header className="flex shrink-0 items-center gap-4 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <LayoutSelector value={layout} onChange={setLayout} />
            <SyncControls sync={sync} onChange={setSync} />
            <div className="flex-1" />
          </header>

          {/* Chart grid - takes remaining height */}
          <div
            className={`grid flex-1 auto-rows-fr gap-3 overflow-auto p-4 ${gridClassForLayout(
              layout
            )}`}
            style={{ minHeight: 0 }}
          >
            {panels.map((panel) => (
              <ChartPanel
                key={panel.id}
                id={panel.id}
                ticker={panel.ticker}
                range={range}
                active={panel.id === activePanelId}
                onClick={() => setActivePanelId(panel.id)}
                syncCrosshair={sync.crosshair}
                syncTime={sync.time}
                syncDateRange={sync.dateRange}
                syncedCrosshairTime={sync.crosshair ? sharedCrosshairTime : null}
                syncedVisibleRange={
                  sync.time || sync.dateRange ? sharedVisibleRange : null
                }
                onCrosshairMove={sync.crosshair ? onCrosshairMove : undefined}
                onVisibleRangeChange={
                  sync.time || sync.dateRange ? onVisibleRangeChange : undefined
                }
              />
            ))}
          </div>

          {/* Bottom bar: time range for all charts (bottom left) */}
          <footer className="flex shrink-0 items-center border-t border-[var(--border)] bg-[var(--surface)] px-4 py-2">
            <div className="flex items-center gap-1">
              <span className="mr-2 text-xs text-[var(--text-muted)]">Time range</span>
              <RangeButtons value={range} onChange={setRange} className="flex-wrap gap-1" />
            </div>
          </footer>
        </main>

        {/* Right watchlist panel */} 
        <aside className="w-72 shrink-0 border-l border-[var(--border)] bg-[var(--surface)]">
          <Watchlist
            onSelectTicker={(t) => {
              // apply to active chart panel
              setPanels((prev) =>
                prev.map((p) =>
                  p.id === activePanelId ? { ...p, ticker: t } : p
                )
              );
            }}
            onRequestSearchForAdd={(addToFolder) => {
              pendingWatchlistAdd.current = addToFolder;
              setSearchMode("watchlist");
              setSearchInitialQuery("");
              setSearchOpen(true);
            }}
          />
        </aside>
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
            setActivePanelTicker(t);
          } else if (searchMode === "watchlist" && pendingWatchlistAdd.current) {
            pendingWatchlistAdd.current(t);
          }
          setSearchOpen(false);
          setSearchMode("chart");
          pendingWatchlistAdd.current = null;
        }}
      />
    </div>
  );
}
