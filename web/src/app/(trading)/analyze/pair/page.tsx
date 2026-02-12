"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SearchTicker } from "@/components/SearchTicker";
import { getBars } from "@/lib/explore/data/getBars";
import { getUniverseTickers } from "@/lib/explore/data/getUniverseTickers";
import { alignCloses, alignReturns } from "@/lib/explore/math/align";
import { pearson, cov } from "@/lib/explore/math/stats";
import { spreadSeries, zScoreSeries } from "@/lib/explore/math/spread";
import { filterBarsByRange } from "@/lib/explore/dateRange";
import type { Bar } from "@/lib/explore/types";
import type { RangeKey } from "@/lib/explore/types";

const RANGE_OPTS: RangeKey[] = ["3M", "6M", "1Y", "3Y", "MAX"];
const Z_WINDOW_OPTS = [20, 60, 120];

export default function PairPage() {
  const searchParams = useSearchParams();
  const [tickers, setTickers] = useState<{ ticker: string; name: string }[]>([]);
  const [tickerA, setTickerA] = useState(searchParams.get("A") || "AAPL");
  const [tickerB, setTickerB] = useState(searchParams.get("B") || "MSFT");
  const [range, setRange] = useState<RangeKey>((searchParams.get("range") as RangeKey) || "1Y");
  const [zWindow, setZWindow] = useState(60);
  const [barsA, setBarsA] = useState<Bar[]>([]);
  const [barsB, setBarsB] = useState<Bar[]>([]);
  const [loading, setLoading] = useState(true);

  const { times, closeA, closeB } = useMemo(() => {
    if (barsA.length === 0 || barsB.length === 0) return { times: [] as string[], closeA: [] as number[], closeB: [] as number[] };
    return alignCloses(barsA, barsB);
  }, [barsA, barsB]);

  const { rA, rB } = useMemo(() => {
    if (barsA.length === 0 || barsB.length === 0) return { rA: [] as number[], rB: [] as number[] };
    return alignReturns(barsA, barsB);
  }, [barsA, barsB]);

  const betaVal = useMemo(() => {
    if (rA.length < 2 || rB.length < 2) return 0;
    const vB = cov(rB, rB);
    if (vB === 0) return 0;
    return cov(rA, rB) / vB;
  }, [rA, rB]);

  const spread = useMemo(
    () => (times.length ? spreadSeries(closeA, closeB, betaVal) : []),
    [times.length, closeA, closeB, betaVal]
  );

  const zSeries = useMemo(
    () => (spread.length >= zWindow ? zScoreSeries(spread, zWindow) : []),
    [spread, zWindow]
  );

  const corr1Y = useMemo(() => {
    if (rA.length < 2) return 0;
    return pearson(rA, rB);
  }, [rA, rB]);

  const corr3M = useMemo(() => {
    if (rA.length < 60) return corr1Y;
    const a = rA.slice(-60);
    const b = rB.slice(-60);
    return pearson(a, b);
  }, [rA, rB, corr1Y]);

  const zNow = useMemo(() => {
    if (zSeries.length === 0) return null;
    return zSeries[zSeries.length - 1];
  }, [zSeries]);

  const dislocation = useMemo(() => {
    if (zNow == null) return null;
    if (zNow > 0) return "A rich vs B";
    if (zNow < 0) return "A cheap vs B";
    return "Neutral";
  }, [zNow]);

  const isDislocated = zNow != null && Math.abs(zNow) >= 2;
  const isWeakening = corr1Y > 0.5 && corr3M < 0.4;

  useEffect(() => {
    getUniverseTickers().then((t) => setTickers(t));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      getBars(tickerA).then((b) => setBarsA(filterBarsByRange(b, range))),
      getBars(tickerB).then((b) => setBarsB(filterBarsByRange(b, range))),
    ]).finally(() => setLoading(false));
  }, [tickerA, tickerB, range]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex h-full">
      <aside className="w-64 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] p-3 space-y-3">
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
        <button
          type="button"
          onClick={load}
          className="w-full rounded bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-fg)]"
        >
          Compute
        </button>
        <Link
          href={`/algorithms/pairs-mean-reversion?A=${encodeURIComponent(tickerA)}&B=${encodeURIComponent(tickerB)}&range=${range}`}
          className="block w-full rounded border border-[var(--border)] px-3 py-1.5 text-center text-sm"
        >
          Send to Backtest
        </Link>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col p-3 gap-3 overflow-auto">
        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">Loading...</p>
        ) : times.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No aligned data.</p>
        ) : (
          <>
            {(isDislocated || isWeakening) && (
              <div className="flex gap-2">
                {isDislocated && (
                  <span className="rounded bg-[var(--red)]/20 px-2 py-0.5 text-xs text-[var(--red)]">Dislocated</span>
                )}
                {isWeakening && (
                  <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-600">Weakening</span>
                )}
              </div>
            )}
            <div className="rounded border border-[var(--border)] bg-[var(--surface)] p-2 h-48">
              <p className="text-xs text-[var(--text-muted)] mb-1">Spread (A - β×B)</p>
              <div className="h-36 flex items-end gap-px">
                {spread.slice(-120).map((v, i) => (
                  <div
                    key={i}
                    className="flex-1 min-w-0 rounded-sm bg-[var(--accent)] opacity-70"
                    style={{ height: `${Math.max(2, Math.min(100, 50 + (v / (Math.max(...spread, 1) || 1)) * 50))}%` }}
                  />
                ))}
              </div>
            </div>
            <div className="rounded border border-[var(--border)] bg-[var(--surface)] p-2 h-48">
              <p className="text-xs text-[var(--text-muted)] mb-1">Z-score (window {zWindow}D)</p>
              <div className="h-36 flex items-end gap-px">
                {zSeries.filter((v): v is number => v != null).slice(-120).map((v, i) => (
                  <div
                    key={i}
                    className="flex-1 min-w-0 rounded-sm bg-[var(--accent)] opacity-80"
                    style={{
                      height: `${Math.max(2, Math.min(100, 50 - v * 15))}%`,
                    }}
                  />
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-[var(--text-muted)] mt-0.5">
                <span>+2</span>
                <span>0</span>
                <span>-2</span>
              </div>
            </div>
          </>
        )}
      </div>

      <aside className="w-72 shrink-0 border-l border-[var(--border)] bg-[var(--surface)] p-3 overflow-auto">
        <h2 className="text-sm font-semibold">Stats</h2>
        {!loading && times.length > 0 && (
          <div className="mt-2 space-y-1 text-sm">
            <p>β (hedge): <strong>{betaVal.toFixed(4)}</strong></p>
            <p>Corr 1Y: <strong>{corr1Y.toFixed(4)}</strong></p>
            <p>Corr 3M: <strong>{corr3M.toFixed(4)}</strong></p>
            <p>Points: <strong>{times.length}</strong></p>
            <p>zNow: <strong>{zNow != null ? zNow.toFixed(3) : "–"}</strong></p>
            {dislocation && <p className="text-[var(--text-muted)]">{dislocation}</p>}
            <Link
              href={`/algorithms/pairs-mean-reversion?A=${encodeURIComponent(tickerA)}&B=${encodeURIComponent(tickerB)}&range=${range}`}
              className="mt-3 block w-full rounded bg-[var(--accent)] px-3 py-1.5 text-center text-sm font-medium text-[var(--accent-fg)]"
            >
              Run Pairs Backtest
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}
