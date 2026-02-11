import type { UniverseTicker } from "../types";

/**
 * Fetch all universe tickers (S&P 500 + extras).
 * Keeps app independent of storage; can be swapped to server later.
 */
export async function getUniverseTickers(): Promise<UniverseTicker[]> {
  const res = await fetch("/api/explore/tickers");
  if (!res.ok) throw new Error("Failed to load universe tickers");
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}
