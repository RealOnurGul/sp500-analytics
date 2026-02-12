"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SearchTicker } from "@/components/SearchTicker";
import { getBars } from "@/lib/explore/data/getBars";
import { filterBarsByRange } from "@/lib/explore/dateRange";
import { runPairsMeanReversionBacktest } from "@/lib/explore/backtest/pairsMeanReversion";
import type { Bar } from "@/lib/explore/types";
import type { RangeKey } from "@/lib/explore/types";

const RANGE_OPTS: RangeKey[] = ["3M", "6M", "1Y", "3Y", "MAX"];
const Z_WINDOW_OPTS = [20, 60, 120];

export default function PairsMeanReversionPage() {
  const searchParams = useSearchParams();
  const [tickerA, setTickerA] = useState(searchParams.get("A") || "AAPL");
  const [tickerB, setTickerB] = useState(searchParams.get("B") || "MSFT");
  const [range, setRange] = useState<RangeKey>((searchParams.get("range") as RangeKey) || "1Y");
  const [zWindow, setZWindow] = useState(60);
  const [entryThreshold, setEntryThreshold] = useState(2);
  const [exitThreshold, setExitThreshold] = useState(0.5);
  const [stopThreshold, setStopThreshold] = useState(4);
  const [costPerLegPct, setCostPerLegPct] = useState(0.05);
  const [result, setResult] = useState<ReturnType<typeof runPairsMeanReversionBacktest> | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const [barsA, barsB] = await Promise.all([
        getBars(tickerA).then((b) => filterBarsByRange(b, range)),
        getBars(tickerB).then((b) => filterBarsByRange(b, range)),
      ]);
      const res = runPairsMeanReversionBacktest({
        barsA,
        barsB,
        zWindow,
        entryThreshold,
        exitThreshold,
        stopThreshold,
        costPerLegPct,
      });
      setResult(res);
    } finally {
      setLoading(false);
    }
  }, [tickerA, tickerB, range, zWindow, entryThreshold, exitThreshold, stopThreshold, costPerLegPct]);

  return (
    <div className="flex h-full">
      <aside className="w-64 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] p-3 space-y-3 overflow-auto">
        <h2 className="text-sm font-semibold">Controls</h2>
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">Ticker A</label>
          <SearchTicker
            selectedTicker={tickerA || null}
            onSelect={(t) => setTickerA(t)}
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">Ticker B</label>
          <SearchTicker
            selectedTicker={tickerB || null}
            onSelect={(t) => setTickerB(t)}
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)]">Date range</label>
          <div className="mt-1 flex flex-wrap gap-1">
            {RANGE_OPTS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`rounded px-2 py-0.5 text-xs ${range === r ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "bg-[var(--bg)]"}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)]">Z-score window</label>
          <select
            value={zWindow}
            onChange={(e) => setZWindow(Number(e.target.value))}
            className="mt-0.5 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm"
          >
            {Z_WINDOW_OPTS.map((w) => (
              <option key={w} value={w}>{w}D</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)]">Entry threshold</label>
          <input
            type="number"
            step="0.1"
            value={entryThreshold}
            onChange={(e) => setEntryThreshold(Number(e.target.value))}
            className="mt-0.5 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)]">Exit threshold</label>
          <input
            type="number"
            step="0.1"
            value={exitThreshold}
            onChange={(e) => setExitThreshold(Number(e.target.value))}
            className="mt-0.5 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)]">Stop threshold</label>
          <input
            type="number"
            step="0.1"
            value={stopThreshold}
            onChange={(e) => setStopThreshold(Number(e.target.value))}
            className="mt-0.5 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)]">Cost per leg %</label>
          <input
            type="number"
            step="0.01"
            value={costPerLegPct}
            onChange={(e) => setCostPerLegPct(Number(e.target.value))}
            className="mt-0.5 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="w-full rounded bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-fg)] disabled:opacity-50"
        >
          {loading ? "Running…" : "Run Backtest"}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col p-3 gap-3 overflow-auto">
        {result && (
          <>
            <div className="rounded border border-[var(--border)] bg-[var(--surface)] p-2 h-48">
              <p className="text-xs text-[var(--text-muted)] mb-1">Equity curve</p>
              <div className="h-36 flex items-end gap-px">
                {result.equityCurve.map((p, i) => (
                  <div
                    key={p.time}
                    className="flex-1 min-w-0 rounded-sm bg-[var(--green)] opacity-80"
                    style={{
                      height: `${Math.max(2, (p.equity / Math.max(...result.equityCurve.map((e) => e.equity), 100)) * 100)}%`,
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="rounded border border-[var(--border)] bg-[var(--surface)] p-2 h-40">
              <p className="text-xs text-[var(--text-muted)] mb-1">Drawdown</p>
              <div className="h-28 flex items-end gap-px">
                {result.drawdownCurve.map((p) => (
                  <div
                    key={p.time}
                    className="flex-1 min-w-0 rounded-sm bg-[var(--red)] opacity-70"
                    style={{ height: `${Math.min(100, p.drawdown)}%` }}
                  />
                ))}
              </div>
            </div>
            <div className="rounded border border-[var(--border)] bg-[var(--surface)] overflow-auto">
              <p className="text-xs text-[var(--text-muted)] p-2 border-b border-[var(--border)]">Trades</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[var(--text-muted)]">
                    <th className="p-2">Entry</th>
                    <th className="p-2">Exit</th>
                    <th className="p-2">Dir</th>
                    <th className="p-2">Entry Z</th>
                    <th className="p-2">Exit Z</th>
                    <th className="p-2">Return %</th>
                    <th className="p-2">Hold</th>
                  </tr>
                </thead>
                <tbody>
                  {result.trades.map((t, i) => (
                    <tr key={i} className="border-b border-[var(--border)]">
                      <td className="p-2">{t.entryTime}</td>
                      <td className="p-2">{t.exitTime}</td>
                      <td className="p-2">{t.direction}</td>
                      <td className="p-2">{t.entryZ.toFixed(2)}</td>
                      <td className="p-2">{t.exitZ.toFixed(2)}</td>
                      <td className="p-2">{t.returnPct.toFixed(2)}%</td>
                      <td className="p-2">{t.holdDays}d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {!result && !loading && (
          <p className="text-sm text-[var(--text-muted)]">Set A, B and date range, then Run Backtest.</p>
        )}
      </div>

      <aside className="w-72 shrink-0 border-l border-[var(--border)] bg-[var(--surface)] p-3 overflow-auto">
        <h2 className="text-sm font-semibold">Summary</h2>
        {result && (
          <div className="mt-2 space-y-2 text-sm">
            <div className="rounded border border-[var(--border)] p-2">
              <p className="text-[var(--text-muted)]">Total return</p>
              <p className="font-medium">{result.totalReturnPct.toFixed(2)}%</p>
            </div>
            <div className="rounded border border-[var(--border)] p-2">
              <p className="text-[var(--text-muted)]">Max drawdown</p>
              <p className="font-medium">{result.maxDrawdownPct.toFixed(2)}%</p>
            </div>
            <div className="rounded border border-[var(--border)] p-2">
              <p className="text-[var(--text-muted)]">Win rate</p>
              <p className="font-medium">{(result.winRate * 100).toFixed(1)}%</p>
            </div>
            <div className="rounded border border-[var(--border)] p-2">
              <p className="text-[var(--text-muted)]">Trades</p>
              <p className="font-medium">{result.numTrades}</p>
            </div>
            <div className="rounded border border-[var(--border)] p-2">
              <p className="text-[var(--text-muted)]">Avg hold (days)</p>
              <p className="font-medium">{result.avgHoldDays.toFixed(1)}</p>
            </div>
            <div className="rounded border border-[var(--border)] p-2">
              <p className="text-[var(--text-muted)]">Sharpe (approx)</p>
              <p className="font-medium">{result.sharpe.toFixed(2)}</p>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
