import type { Bar } from "../types";

/**
 * Daily return: r_t = close_t / close_{t-1} - 1
 * First bar has no previous close; returns null for index 0.
 */
export function barsToReturns(bars: Bar[]): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < bars.length; i++) {
    if (i === 0) {
      out.push(null);
      continue;
    }
    const prev = bars[i - 1].close;
    const curr = bars[i].close;
    if (prev == null || prev === 0) {
      out.push(null);
      continue;
    }
    out.push(curr / prev - 1);
  }
  return out;
}

/**
 * Returns series with time (aligned to bar index; index 0 has no return).
 */
export function barsToReturnsWithTime(bars: Bar[]): { time: string; value: number }[] {
  const ret = barsToReturns(bars);
  const out: { time: string; value: number }[] = [];
  for (let i = 0; i < bars.length; i++) {
    if (ret[i] != null && !Number.isNaN(ret[i]!)) {
      out.push({ time: bars[i].time, value: ret[i]! });
    }
  }
  return out;
}
