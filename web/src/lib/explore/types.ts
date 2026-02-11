/** Single OHLCV bar (matches API candles). */
export interface Bar {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Universe ticker with optional metadata. */
export interface UniverseTicker {
  ticker: string;
  name: string;
  sector: string;
}

/** Date range presets. */
export type RangeKey = "3M" | "6M" | "1Y" | "3Y" | "MAX";

export const RANGE_DAYS: Record<RangeKey, number | null> = {
  "3M": 90,
  "6M": 180,
  "1Y": 365,
  "3Y": 365 * 3,
  MAX: null,
};
