import type { Bar } from "../types";

export interface AlignedPair<T> {
  time: string;
  a: T;
  b: T;
}

/**
 * Align two series by date intersection. Returns arrays of same length with aligned values.
 */
export function alignByDate(
  barsA: Bar[],
  barsB: Bar[],
  getValue: (bar: Bar) => number
): { times: string[]; valuesA: number[]; valuesB: number[] } {
  const setB = new Set(barsB.map((b) => b.time));
  const setA = new Set(barsA.map((b) => b.time));
  const times: string[] = [];
  const valuesA: number[] = [];
  const valuesB: number[] = [];
  const mapA = new Map(barsA.map((b) => [b.time, b]));
  const mapB = new Map(barsB.map((b) => [b.time, b]));
  for (const t of barsA.map((b) => b.time)) {
    if (!setB.has(t)) continue;
    const a = mapA.get(t);
    const b = mapB.get(t);
    if (!a || !b) continue;
    times.push(t);
    valuesA.push(getValue(a));
    valuesB.push(getValue(b));
  }
  return { times, valuesA, valuesB };
}

/**
 * Align two bar series and return aligned close prices and times.
 */
export function alignCloses(
  barsA: Bar[],
  barsB: Bar[]
): { times: string[]; closeA: number[]; closeB: number[] } {
  const { times, valuesA, valuesB } = alignByDate(barsA, barsB, (b) => b.close);
  return { times, closeA: valuesA, closeB: valuesB };
}

/**
 * Align two bar series and return aligned returns (r_t = close_t/close_{t-1} - 1).
 * Uses aligned closes then computes returns on the aligned series.
 */
export function alignReturns(barsA: Bar[], barsB: Bar[]): {
  times: string[];
  rA: number[];
  rB: number[];
} {
  const { times, closeA, closeB } = alignCloses(barsA, barsB);
  const rA: number[] = [];
  const rB: number[] = [];
  for (let i = 0; i < times.length; i++) {
    if (i === 0) {
      rA.push(0);
      rB.push(0);
      continue;
    }
    const pA0 = closeA[i - 1];
    const pA1 = closeA[i];
    const pB0 = closeB[i - 1];
    const pB1 = closeB[i];
    rA.push(pA0 !== 0 ? pA1 / pA0 - 1 : 0);
    rB.push(pB0 !== 0 ? pB1 / pB0 - 1 : 0);
  }
  return { times, rA, rB };
}
