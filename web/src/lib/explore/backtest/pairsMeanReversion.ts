import { alignCloses, alignReturns } from "../math/align";
import { cov } from "../math/stats";
import { spreadSeries, zScoreSeries } from "../math/spread";
import type { Bar } from "../types";

export interface PairsBacktestParams {
  barsA: Bar[];
  barsB: Bar[];
  zWindow: number;
  entryThreshold: number;
  exitThreshold: number;
  stopThreshold: number;
  costPerLegPct: number;
}

export interface PairsTrade {
  entryTime: string;
  exitTime: string;
  direction: "long" | "short";
  entryZ: number;
  exitZ: number;
  returnPct: number;
  holdDays: number;
}

export interface PairsBacktestResult {
  equityCurve: { time: string; equity: number }[];
  drawdownCurve: { time: string; drawdown: number }[];
  trades: PairsTrade[];
  totalReturnPct: number;
  maxDrawdownPct: number;
  winRate: number;
  numTrades: number;
  avgHoldDays: number;
  sharpe: number;
}

/** Hedge A with B: spread = A - beta*B, beta = Cov(rA,rB)/Var(rB) */
function hedgeBeta(rA: number[], rB: number[]): number {
  if (rA.length !== rB.length || rA.length < 2) return 0;
  const vB = cov(rB, rB);
  if (vB === 0) return 0;
  return cov(rA, rB) / vB;
}

export function runPairsMeanReversionBacktest(
  params: PairsBacktestParams
): PairsBacktestResult {
  const {
    barsA,
    barsB,
    zWindow,
    entryThreshold,
    exitThreshold,
    stopThreshold,
    costPerLegPct,
  } = params;

  const { times, closeA, closeB } = alignCloses(barsA, barsB);
  if (times.length < zWindow + 1) {
    return {
      equityCurve: [{ time: times[0] ?? "", equity: 100 }],
      drawdownCurve: [{ time: times[0] ?? "", drawdown: 0 }],
      trades: [],
      totalReturnPct: 0,
      maxDrawdownPct: 0,
      winRate: 0,
      numTrades: 0,
      avgHoldDays: 0,
      sharpe: 0,
    };
  }

  const { rA, rB } = alignReturns(barsA, barsB);
  const betaVal = hedgeBeta(rA, rB);
  const spread = spreadSeries(closeA, closeB, betaVal);
  const zSeries = zScoreSeries(spread, zWindow);

  const costPct = (costPerLegPct / 100) * 2 * 2; // 2 legs, entry+exit
  let equity = 100;
  const equityCurve: { time: string; equity: number }[] = [];
  const drawdownCurve: { time: string; drawdown: number }[] = [];
  let peak = 100;
  const trades: PairsTrade[] = [];
  let position: "long" | "short" | null = null;
  let entryIdx = -1;
  let entryZ = 0;
  let entrySpread = 0;
  let entryEquity = 100;

  for (let i = zWindow - 1; i < times.length; i++) {
    const z = zSeries[i] ?? 0;

    if (position === null) {
      if (z >= entryThreshold) {
        position = "short";
        entryIdx = i;
        entryZ = z;
        entrySpread = spread[i];
        entryEquity = equity;
        equity *= 1 - costPct / 100;
      } else if (z <= -entryThreshold) {
        position = "long";
        entryIdx = i;
        entryZ = z;
        entrySpread = spread[i];
        entryEquity = equity;
        equity *= 1 - costPct / 100;
      }
    } else {
      const exitLong = position === "long" && (z >= -exitThreshold || z <= -stopThreshold);
      const exitShort = position === "short" && (z <= exitThreshold || z >= stopThreshold);
      if (exitLong || exitShort) {
        const spreadNow = spread[i];
        const spreadRet = Math.abs(entrySpread) > 1e-10
          ? (position === "long" ? (spreadNow - entrySpread) / Math.abs(entrySpread) : (entrySpread - spreadNow) / Math.abs(entrySpread))
          : 0;
        const returnPct = spreadRet * 100;
        equity = entryEquity * (1 + spreadRet) * (1 - costPct / 100);
        trades.push({
          entryTime: times[entryIdx],
          exitTime: times[i],
          direction: position,
          entryZ,
          exitZ: z,
          returnPct,
          holdDays: i - entryIdx,
        });
        position = null;
      }
    }

    if (equity > peak) peak = equity;
    const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
    equityCurve.push({ time: times[i], equity });
    drawdownCurve.push({ time: times[i], drawdown: dd });
  }

  if (position !== null) {
    const i = times.length - 1;
    const spreadNow = spread[i];
    const spreadRet = Math.abs(entrySpread) > 1e-10
      ? (position === "long" ? (spreadNow - entrySpread) / Math.abs(entrySpread) : (entrySpread - spreadNow) / Math.abs(entrySpread))
      : 0;
    trades.push({
      entryTime: times[entryIdx],
      exitTime: times[i],
      direction: position,
      entryZ,
      exitZ: zSeries[i] ?? 0,
      returnPct: spreadRet * 100,
      holdDays: i - entryIdx,
    });
  }

  const totalReturnPct = ((equity - 100) / 100) * 100;
  const maxDrawdownPct = drawdownCurve.length ? Math.max(...drawdownCurve.map((d) => d.drawdown)) : 0;
  const numTrades = trades.length;
  const wins = trades.filter((t) => t.returnPct > 0).length;
  const winRate = numTrades > 0 ? wins / numTrades : 0;
  const avgHoldDays = numTrades > 0 ? trades.reduce((s, t) => s + t.holdDays, 0) / numTrades : 0;
  const returns: number[] = [];
  for (let j = 1; j < equityCurve.length; j++) {
    const r = ((equityCurve[j].equity - equityCurve[j - 1].equity) / equityCurve[j - 1].equity) * 100;
    returns.push(r);
  }
  const meanRet = returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const stdRet = returns.length >= 2
    ? Math.sqrt(returns.reduce((s, r) => s + (r - meanRet) ** 2, 0) / (returns.length - 1))
    : 0;
  const sharpe = stdRet !== 0 ? (meanRet / stdRet) * Math.sqrt(252) : 0;

  return {
    equityCurve,
    drawdownCurve,
    trades,
    totalReturnPct,
    maxDrawdownPct,
    winRate,
    numTrades,
    avgHoldDays,
    sharpe,
  };
}
