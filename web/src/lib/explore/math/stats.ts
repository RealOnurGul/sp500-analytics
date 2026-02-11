/**
 * Sample mean.
 */
export function mean(x: number[]): number {
  if (x.length === 0) return 0;
  return x.reduce((s, v) => s + v, 0) / x.length;
}

/**
 * Sample standard deviation (Bessel-corrected).
 */
export function std(x: number[]): number {
  if (x.length < 2) return 0;
  const m = mean(x);
  const sq = x.reduce((s, v) => s + (v - m) ** 2, 0);
  return Math.sqrt(sq / (x.length - 1));
}

/**
 * Sample covariance of two same-length arrays.
 */
export function cov(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0;
  const mx = mean(x);
  const my = mean(y);
  let s = 0;
  for (let i = 0; i < x.length; i++) s += (x[i] - mx) * (y[i] - my);
  return s / (x.length - 1);
}

/**
 * Pearson correlation. Returns 0 if variance is zero.
 */
export function pearson(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0;
  const sx = std(x);
  const sy = std(y);
  if (sx === 0 || sy === 0) return 0;
  return cov(x, y) / (sx * sy);
}

/**
 * Rank array (1-based ranks; ties get average rank).
 */
export function ranks(x: number[]): number[] {
  const n = x.length;
  const idx = x.map((v, i) => ({ v, i }));
  idx.sort((a, b) => a.v - b.v);
  const out = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && idx[j + 1].v === idx[j].v) j++;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) out[idx[k].i] = avgRank;
    i = j + 1;
  }
  return out;
}

/**
 * Spearman correlation = Pearson on ranks.
 */
export function spearman(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0;
  return pearson(ranks(x), ranks(y));
}

/**
 * Rolling correlation over a window. Result length = x.length; first (window-1) values are null.
 */
export function rollingCorr(
  x: number[],
  y: number[],
  window: number
): (number | null)[] {
  if (x.length !== y.length || window < 2 || x.length < window) {
    return x.map(() => null);
  }
  const out: (number | null)[] = [];
  for (let i = 0; i < window - 1; i++) out.push(null);
  for (let i = window - 1; i < x.length; i++) {
    const sx = x.slice(i - window + 1, i + 1);
    const sy = y.slice(i - window + 1, i + 1);
    out.push(pearson(sx, sy));
  }
  return out;
}

/**
 * Beta: Cov(rA, rB) / Var(rA). (Sensitivity of B to A when A is the market.)
 * Document: beta = Cov(rA,rB)/Var(rA) => B moves beta * (change in A) for a unit change in A.
 */
export function beta(rA: number[], rB: number[]): number {
  if (rA.length !== rB.length || rA.length < 2) return 0;
  const vA = cov(rA, rA);
  if (vA === 0) return 0;
  return cov(rA, rB) / vA;
}

/**
 * Vol ratio = std(rB) / std(rA). Protect divide-by-zero.
 */
export function volRatio(rA: number[], rB: number[]): number {
  if (rA.length !== rB.length) return 0;
  const sA = std(rA);
  if (sA === 0) return 0;
  return std(rB) / sA;
}

/**
 * Stability score = mean(rollingCorr) - std(rollingCorr). Higher = more stable correlation.
 */
export function stabilityScore(rollingCorrSeries: (number | null)[]): number {
  const valid = rollingCorrSeries.filter((v): v is number => v != null);
  if (valid.length < 2) return 0;
  return mean(valid) - std(valid);
}
