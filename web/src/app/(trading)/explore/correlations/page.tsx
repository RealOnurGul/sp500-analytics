"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SearchTicker } from "@/components/SearchTicker";
import { getBars } from "@/lib/explore/data/getBars";
import { getUniverseTickers } from "@/lib/explore/data/getUniverseTickers";
import { alignReturns } from "@/lib/explore/math/align";
import { pearson, spearman, rollingCorr, beta, volRatio, stabilityScore } from "@/lib/explore/math/stats";
import { filterBarsByRange } from "@/lib/explore/dateRange";
import type { Bar } from "@/lib/explore/types";
import type { RangeKey } from "@/lib/explore/types";

const RANGE_OPTS: RangeKey[] = ["3M", "6M", "1Y", "3Y", "MAX"];
const ROLLING_OPTS = [20, 60, 120];
const MIN_POINTS_DEFAULT = 120;

interface CorrRow {
  ticker: string;
  name: string;
  pearson: number;
  spearman: number;
  stability: number;
  beta: number;
  volRatio: number;
  points: number;
  rollingCorrSeries: (number | null)[];
}

export default function CorrelationsPage() {
  const searchParams = useSearchParams();
  const [tickers, setTickers] = useState<{ ticker: string; name: string; sector: string }[]>([]);
  const [tickerA, setTickerA] = useState(searchParams.get("A") || "AAPL");
  const [range, setRange] = useState<RangeKey>((searchParams.get("range") as RangeKey) || "1Y");
  const [basis, setBasis] = useState<"returns" | "prices">("returns");
  const [corrType, setCorrType] = useState<"pearson" | "spearman">("pearson");
  const [rollingWindow, setRollingWindow] = useState(60);
  const [minPoints, setMinPoints] = useState(MIN_POINTS_DEFAULT);
  const [results, setResults] = useState<CorrRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [computing, setComputing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [selected, setSelected] = useState<CorrRow | null>(null);
  const [search, setSearch] = useState("");
  const [topN, setTopN] = useState(100);
  const [barsA, setBarsA] = useState<Bar[]>([]);

  useEffect(() => {
    getUniverseTickers().then(setTickers);
  }, []);

  useEffect(() => {
    if (!tickerA) return;
    setResults([]);
    setLoading(true);
    getBars(tickerA)
      .then((b) => {
        setBarsA(filterBarsByRange(b, range));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tickerA, range]);

  const compute = useCallback(async () => {
    if (barsA.length < minPoints) return;
    setComputing(true);
    setProgress(0);
    setProgressLabel("0 / 0");
    const filteredA = barsA;
    const rows: CorrRow[] = [];
    const list = tickers.map((t) => t.ticker).filter((t) => t !== tickerA);
    const total = list.length;
    for (let i = 0; i < list.length; i++) {
      try {
        const barsB = await getBars(list[i]);
        const filteredB = filterBarsByRange(barsB, range);
        const { times, rA, rB } = alignReturns(filteredA, filteredB);
        if (times.length < minPoints) continue;
        const p = pearson(rA, rB);
        const s = spearman(rA, rB);
        const roll = rollingCorr(rA, rB, rollingWindow);
        const stab = stabilityScore(roll);
        const bVal = beta(rA, rB);
        const volR = volRatio(rA, rB);
        const meta = tickers.find((t) => t.ticker === list[i]);
        rows.push({
          ticker: list[i],
          name: meta?.name ?? list[i],
          pearson: p,
          spearman: s,
          stability: stab,
          beta: bVal,
          volRatio: volR,
          points: times.length,
          rollingCorrSeries: roll,
        });
      } catch {
        // skip
      }
      const done = i + 1;
      const pct = Math.round((done / total) * 100);
      if (done % 5 === 0 || done === total) {
        setProgress(pct);
        setProgressLabel(`${done} / ${total}`);
      }
      if (i % 10 === 9) await new Promise((r) => setTimeout(r, 0));
    }
    rows.sort((a, b) => b.pearson - a.pearson);
    setResults(rows);
    setProgress(100);
    setProgressLabel(`${total} / ${total}`);
    setComputing(false);
  }, [barsA, range, tickers, basis, rollingWindow, minPoints]);

  useEffect(() => {
    if (barsA.length >= minPoints && tickers.length > 0 && results.length === 0 && !computing) {
      compute();
    }
  }, [barsA.length, tickers.length, minPoints, compute, results.length, computing]);

  const filteredResults = useMemo(() => {
    let list = results;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.ticker.toLowerCase().includes(q) || r.name.toLowerCase().includes(q));
    }
    return list.slice(0, topN);
  }, [results, search, topN]);

  const sortBy = useMemo(() => "pearson", []);
  const displayResults = useMemo(
    () => [...filteredResults].sort((a, b) => (b as Record<string, number>)[sortBy] - (a as Record<string, number>)[sortBy]),
    [filteredResults, sortBy]
  );

  return (
    <div className="flex h-full gap-px bg-[var(--border)]">
      <aside className="w-64 shrink-0 rounded-l-lg border border-[var(--border)] bg-[var(--surface)] p-3 space-y-3 shadow-sm">
        <h2 className="text-sm font-semibold text-[var(--text)]">Controls</h2>
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">Base ticker A</label>
          <SearchTicker
            selectedTicker={tickerA || null}
            onSelect={(t) => setTickerA(t)}
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
                className={`rounded px-2.5 py-1 text-xs font-medium transition ${range === r ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "bg-[var(--bg)] text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)]"}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)]">Basis</label>
          <select
            value={basis}
            onChange={(e) => setBasis(e.target.value as "returns" | "prices")}
            className="mt-0.5 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm"
          >
            <option value="returns">Returns</option>
            <option value="prices">Prices</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)]">Correlation</label>
          <select
            value={corrType}
            onChange={(e) => setCorrType(e.target.value as "pearson" | "spearman")}
            className="mt-0.5 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm"
          >
            <option value="pearson">Pearson</option>
            <option value="spearman">Spearman</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)]">Rolling window</label>
          <select
            value={rollingWindow}
            onChange={(e) => setRollingWindow(Number(e.target.value))}
            className="mt-0.5 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm"
          >
            {ROLLING_OPTS.map((w) => (
              <option key={w} value={w}>{w}D</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)]">MIN_POINTS</label>
          <input
            type="number"
            value={minPoints}
            onChange={(e) => setMinPoints(Number(e.target.value) || 120)}
            className="mt-0.5 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={compute}
          disabled={loading || computing || barsA.length < minPoints}
          className="w-full rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--accent-fg)] hover:bg-[var(--accent)]/90 disabled:opacity-50 transition"
        >
          {computing ? "Computing…" : "Compute"}
        </button>
        {computing && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-[var(--text-muted)]">
              <span>{progressLabel}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg)]">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-sm overflow-hidden">
        <div className="shrink-0 flex flex-col gap-2 border-b border-[var(--border)] bg-[var(--surface)] p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              placeholder="Filter tickers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1.5 text-sm text-[var(--text)] w-48 focus:border-[var(--accent)] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setTopN(topN === 100 ? 25 : 100)}
              className="chart-toolbar-btn rounded-md px-2.5 py-1.5 text-xs"
              title={topN === 100 ? "Show only top 25" : "Show top 100"}
            >
              Show {topN === 100 ? 25 : 100}
            </button>
            {results.length > 0 && (
              <span className="text-xs text-[var(--text-muted)]">
                Showing top {Math.min(topN, results.length)} of {results.length}
              </span>
            )}
          </div>
          {computing && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 overflow-hidden rounded-full bg-[var(--bg)]">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-[var(--text-muted)] shrink-0">{progress}%</span>
            </div>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-[var(--surface)] shadow-[0_1px_0_0_var(--border)]">
              <tr className="text-left text-[var(--text-muted)]">
                <th className="p-2.5 font-medium">Ticker</th>
                <th className="p-2.5 font-medium">Pearson</th>
                <th className="p-2.5 font-medium">Spearman</th>
                <th className="p-2.5 font-medium">Stability</th>
                <th className="p-2.5 font-medium">Beta</th>
                <th className="p-2.5 font-medium">VolRatio</th>
                <th className="p-2.5 font-medium" title="Aligned trading days with A in the selected date range (same for all pairs)">Points</th>
              </tr>
            </thead>
            <tbody>
              {displayResults.map((r, rowIdx) => (
                <tr
                  key={r.ticker}
                  onClick={() => setSelected(r)}
                  className={`cursor-pointer transition-colors ${rowIdx % 2 === 0 ? "bg-[var(--surface)]" : "bg-[var(--border-light)]"} hover:bg-[var(--hover-blue)] ${selected?.ticker === r.ticker ? "!bg-[var(--accent)]/10 ring-1 ring-inset ring-[var(--accent)]/30" : ""}`}
                >
                  <td className="p-2.5 font-medium">{r.ticker}</td>
                  <td className="p-2.5 tabular-nums">{r.pearson.toFixed(4)}</td>
                  <td className="p-2.5 tabular-nums">{r.spearman.toFixed(4)}</td>
                  <td className="p-2.5 tabular-nums">{r.stability.toFixed(4)}</td>
                  <td className="p-2.5 tabular-nums">{r.beta.toFixed(4)}</td>
                  <td className="p-2.5 tabular-nums">{r.volRatio.toFixed(4)}</td>
                  <td className="p-2.5 tabular-nums">{r.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {computing && results.length === 0 && (
            <div className="p-4 text-center text-sm text-[var(--text-muted)]">
              Scanning universe… {progressLabel}
            </div>
          )}
        </div>
      </div>

      <aside className="w-80 shrink-0 rounded-r-lg border border-[var(--border)] bg-[var(--surface)] p-3 overflow-auto shadow-sm">
        <h2 className="text-sm font-semibold text-[var(--text)]">Details</h2>
        {selected ? (
          <div className="mt-3 space-y-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3">
            <p className="text-sm font-medium text-[var(--text)]"><span className="font-semibold">{selected.ticker}</span> {selected.name}</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
              <span>Pearson</span><span className="tabular-nums text-[var(--text)]">{selected.pearson.toFixed(4)}</span>
              <span>Spearman</span><span className="tabular-nums text-[var(--text)]">{selected.spearman.toFixed(4)}</span>
              <span>Stability</span><span className="tabular-nums text-[var(--text)]">{selected.stability.toFixed(4)}</span>
              <span>Beta</span><span className="tabular-nums text-[var(--text)]">{selected.beta.toFixed(4)}</span>
              <span>VolRatio</span><span className="tabular-nums text-[var(--text)]">{selected.volRatio.toFixed(4)}</span>
              <span>Points</span><span className="tabular-nums text-[var(--text)]">{selected.points}</span>
            </div>
            <div className="h-24 rounded-md border border-[var(--border)] bg-[var(--surface)] flex items-end gap-px p-1.5">
              {selected.rollingCorrSeries.filter((v): v is number => v != null).slice(-60).map((v, i) => (
                <div
                  key={i}
                  className="flex-1 min-w-0 rounded-sm bg-[var(--accent)] opacity-80"
                  style={{ height: `${Math.max(2, (v + 1) * 50)}%` }}
                  title={String(v.toFixed(3))}
                />
              ))}
            </div>
            <Link
              href={`/analyze/pair?A=${encodeURIComponent(tickerA)}&B=${encodeURIComponent(selected.ticker)}&range=${range}`}
              className="chart-toolbar-btn mt-1 block w-full rounded-lg bg-[var(--accent)] px-3 py-2 text-center text-sm font-medium text-[var(--accent-fg)] hover:bg-[var(--accent)]/90"
            >
              Open Pair Analysis
            </Link>
          </div>
        ) : (
          <p className="mt-2 text-xs text-[var(--text-muted)]">Click a row to see details.</p>
        )}
      </aside>
    </div>
  );
}
