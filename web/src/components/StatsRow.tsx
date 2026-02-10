"use client";

export interface Stats {
  lastClose: number;
  lastVolume: number;
  lastDate: string;
  change1dPct: number | null;
}

interface StatsRowProps {
  ticker: string;
  stats: Stats | null;
  className?: string;
}

function formatNum(n: number, decimals = 2): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatVolume(v: number): string {
  if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(2) + "K";
  return String(Math.round(v));
}

export function StatsRow({
  ticker,
  stats,
  className = "",
}: StatsRowProps) {
  if (!stats) {
    return (
      <div className={`flex flex-wrap gap-6 text-sm text-[var(--text-muted)] ${className}`}>
        <span>{ticker}</span>
        <span>No data</span>
      </div>
    );
  }
  const isPositive = stats.change1dPct != null && stats.change1dPct >= 0;
  const changeColor = stats.change1dPct == null ? "" : isPositive ? "text-[var(--green)]" : "text-[var(--red)]";

  return (
    <div className={`flex flex-wrap items-center gap-6 text-sm ${className}`}>
      <span className="font-medium">{ticker}</span>
      <span>Close: {formatNum(stats.lastClose)}</span>
      {stats.change1dPct != null && (
        <span className={changeColor}>
          1d: {isPositive ? "+" : ""}{formatNum(stats.change1dPct)}%
        </span>
      )}
      <span className="text-[var(--text-muted)]">
        Volume: {formatVolume(stats.lastVolume)}
      </span>
      <span className="text-[var(--text-muted)]">
        Last: {stats.lastDate}
      </span>
    </div>
  );
}
