import { mean, std } from "./stats";

/**
 * Spread on price levels: spread_t = closeA_t - beta * closeB_t
 */
export function spreadSeries(
  closeA: number[],
  closeB: number[],
  beta: number
): number[] {
  return closeA.map((a, i) => a - beta * (closeB[i] ?? 0));
}

/**
 * Rolling z-score: z_t = (spread_t - mean(spread_{t-W..t})) / std(spread_{t-W..t})
 * First (window-1) values are null. Std 0 => z = 0.
 */
export function zScoreSeries(
  spread: number[],
  window: number
): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < window - 1; i++) out.push(null);
  for (let i = window - 1; i < spread.length; i++) {
    const slice = spread.slice(i - window + 1, i + 1);
    const m = mean(slice);
    const s = std(slice);
    if (s === 0) out.push(0);
    else out.push((spread[i] - m) / s);
  }
  return out;
}
