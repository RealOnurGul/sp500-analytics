import type { Bar } from "../types";

/**
 * Fetch OHLCV bars for a ticker. Uses existing prices API with range=MAX.
 * Optional start/end can be applied client-side after fetch for MVP.
 * Keeps app independent of storage; can be moved to server later.
 */
export async function getBars(ticker: string): Promise<Bar[]> {
  const res = await fetch(
    `/api/prices?ticker=${encodeURIComponent(ticker)}&range=MAX`
  );
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(`Failed to load bars for ${ticker}`);
  }
  const data = await res.json();
  const candles = data?.candles;
  if (!Array.isArray(candles)) return [];
  return candles as Bar[];
}
