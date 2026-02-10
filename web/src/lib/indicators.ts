/**
 * Technical indicator calculations for OHLC data.
 * All functions assume arrays are in chronological order (oldest first).
 */

export const EMA_RIBBON_PERIODS = [8, 13, 21, 34, 55, 89, 144] as const;
export const EMA_50_PERIOD = 50;
export const EMA_200_PERIOD = 200;

/** Opacity for each ribbon line (index 0 = EMA 8 most visible, 6 = EMA 144 least visible). */
export const RIBBON_OPACITIES = [0.9, 0.78, 0.65, 0.52, 0.38, 0.25, 0.15] as const;

/**
 * Option A: Trend regime from slope of EMA 8.
 * Bullish if EMA8[t] > EMA8[t-1], bearish if <; if equal, keep previous to avoid flicker.
 */
export function ema8SlopeRegime(ema8: (number | null)[]): ("bullish" | "bearish")[] {
  const out: ("bullish" | "bearish")[] = new Array(ema8.length);
  let prev: "bullish" | "bearish" = "bullish";
  for (let i = 0; i < ema8.length; i++) {
    const curr = ema8[i];
    const prevVal = i > 0 ? ema8[i - 1] : null;
    if (curr != null && prevVal != null) {
      if (curr > prevVal) prev = "bullish";
      else if (curr < prevVal) prev = "bearish";
    }
    out[i] = prev;
  }
  return out;
}

export function ema(close: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(close.length);
  const k = 2 / (period + 1);
  for (let i = 0; i < close.length; i++) {
    if (i < period - 1) {
      out[i] = null;
      continue;
    }
    if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += close[j];
      out[i] = sum / period;
      continue;
    }
    const prev = out[i - 1];
    if (prev == null) {
      out[i] = null;
      continue;
    }
    out[i] = close[i] * k + prev * (1 - k);
  }
  return out;
}

export function sma(close: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(close.length);
  for (let i = 0; i < close.length; i++) {
    if (i < period - 1) {
      out[i] = null;
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += close[j];
    out[i] = sum / period;
  }
  return out;
}

export function stdDev(close: number[], period: number, smaValues: (number | null)[]): (number | null)[] {
  const out: (number | null)[] = new Array(close.length);
  for (let i = 0; i < close.length; i++) {
    if (i < period - 1 || smaValues[i] == null) {
      out[i] = null;
      continue;
    }
    const m = smaValues[i]!;
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const d = close[j] - m;
      sumSq += d * d;
    }
    out[i] = Math.sqrt(sumSq / period);
  }
  return out;
}

export interface BollingerResult {
  middle: (number | null)[];
  upper: (number | null)[];
  lower: (number | null)[];
}

export function bollingerBands(
  close: number[],
  period = 20,
  mult = 2
): BollingerResult {
  const middle = sma(close, period);
  const std = stdDev(close, period, middle);
  const upper: (number | null)[] = new Array(close.length);
  const lower: (number | null)[] = new Array(close.length);
  for (let i = 0; i < close.length; i++) {
    if (middle[i] == null || std[i] == null) {
      upper[i] = null;
      lower[i] = null;
    } else {
      upper[i] = middle[i]! + mult * std[i]!;
      lower[i] = middle[i]! - mult * std[i]!;
    }
  }
  return { middle, upper, lower };
}

/** Parabolic SAR: step 0.02, max 0.2 */
export function parabolicSAR(
  high: number[],
  low: number[],
  close: number[]
): (number | null)[] {
  const len = high.length;
  const out: (number | null)[] = new Array(len);
  const step = 0.02;
  const maxAf = 0.2;

  if (len === 0) return out;
  out[0] = null;
  if (len === 1) return out;

  let sar = low[0];
  let ep = high[0];
  let af = step;
  let isUp = true;

  for (let i = 1; i < len; i++) {
    const h = high[i];
    const l = low[i];
    const c = close[i];

    if (isUp) {
      sar = sar + af * (ep - sar);
      if (low[i - 1] < sar) sar = low[i - 1];
      if (high[i - 1] > sar) sar = low[i - 1];
      if (h > ep) {
        ep = h;
        af = Math.min(af + step, maxAf);
      }
      if (sar > l) {
        isUp = false;
        sar = ep;
        ep = l;
        af = step;
      }
    } else {
      sar = sar + af * (ep - sar);
      if (high[i - 1] > sar) sar = high[i - 1];
      if (low[i - 1] < sar) sar = high[i - 1];
      if (l < ep) {
        ep = l;
        af = Math.min(af + step, maxAf);
      }
      if (sar < h) {
        isUp = true;
        sar = ep;
        ep = h;
        af = step;
      }
    }
    out[i] = sar;
  }
  return out;
}

/** Simple buy/sell markers: SAR flip (SAR crosses price). Returns array of 'buy' | 'sell' | null per index. */
export function sarFlipMarkers(
  high: number[],
  low: number[],
  close: number[],
  sar: (number | null)[]
): ("buy" | "sell" | null)[] {
  const len = close.length;
  const out: ("buy" | "sell" | null)[] = new Array(len);
  for (let i = 0; i < len; i++) out[i] = null;
  if (len < 2) return out;

  let prevUp: boolean | null = null;
  for (let i = 1; i < len; i++) {
    if (sar[i] == null) continue;
    const s = sar[i]!;
    const c = close[i];
    const isUp = s < c;
    if (prevUp === false && isUp) out[i] = "buy";
    if (prevUp === true && !isUp) out[i] = "sell";
    prevUp = isUp;
  }
  return out;
}
