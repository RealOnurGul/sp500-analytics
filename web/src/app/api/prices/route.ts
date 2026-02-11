import { NextRequest } from "next/server";
import path from "path";
import fs from "fs";
import Papa from "papaparse";
import { getDataDir } from "@/lib/data-path";

function getPaths() {
  const repoData = getDataDir();
  const metaDir = path.join(repoData, "meta");
  return {
    SP500_TICKERS_PATH: path.join(metaDir, "sp500_tickers.csv"),
    EXTRAS_TICKERS_PATH: path.join(metaDir, "extras_tickers.csv"),
    PRICES_SP500_DIR: path.join(repoData, "prices", "sp500"),
    PRICES_EXTRAS_DIR: path.join(repoData, "prices", "extras"),
  };
}

type RangeKey = "1M" | "3M" | "6M" | "1Y" | "5Y" | "MAX";

const RANGE_DAYS: Record<RangeKey, number | null> = {
  "1M": 30,
  "3M": 90,
  "6M": 180,
  "1Y": 365,
  "5Y": 365 * 5,
  MAX: null,
};

let cachedTickerSet: Set<string> | null = null;
let cachedMetaTime = 0;

function normalizeTicker(s: string): string {
  return String(s).replace(/\./g, "-").trim();
}

let cachedExtrasSectorMap: Map<string, string> | null = null;

function loadTickerSet(): Set<string> {
  const paths = getPaths();
  const mtime = (p: string) => (fs.existsSync(p) ? fs.statSync(p).mtimeMs : 0);
  const nowMeta = Math.max(mtime(paths.SP500_TICKERS_PATH), mtime(paths.EXTRAS_TICKERS_PATH));
  if (cachedTickerSet && nowMeta <= cachedMetaTime) return cachedTickerSet;
  cachedTickerSet = null;
  cachedExtrasSectorMap = null;
  cachedMetaTime = nowMeta;
  const { SP500_TICKERS_PATH, EXTRAS_TICKERS_PATH } = paths;
  const tickers = new Set<string>();
  if (fs.existsSync(SP500_TICKERS_PATH)) {
    const raw = fs.readFileSync(SP500_TICKERS_PATH, "utf-8");
    const parsed = Papa.parse<Record<string, string>>(raw, { header: true });
    for (const r of parsed.data) {
      const t = normalizeTicker(r.ticker ?? r.Symbol ?? "");
      if (t) tickers.add(t);
    }
  }
  if (fs.existsSync(EXTRAS_TICKERS_PATH)) {
    const raw = fs.readFileSync(EXTRAS_TICKERS_PATH, "utf-8");
    const parsed = Papa.parse<Record<string, string>>(raw, { header: true });
    for (const r of parsed.data) {
      const t = normalizeTicker(r.ticker ?? "");
      if (t) tickers.add(t);
    }
  }
  cachedTickerSet = tickers;
  return tickers;
}

function loadExtrasSectorMap(): Map<string, string> {
  if (cachedExtrasSectorMap) return cachedExtrasSectorMap;
  const { EXTRAS_TICKERS_PATH } = getPaths();
  const map = new Map<string, string>();
  if (fs.existsSync(EXTRAS_TICKERS_PATH)) {
    const raw = fs.readFileSync(EXTRAS_TICKERS_PATH, "utf-8");
    const parsed = Papa.parse<Record<string, string>>(raw, { header: true });
    for (const r of parsed.data) {
      const t = normalizeTicker(r.ticker ?? "");
      if (t && r.sector) map.set(t, r.sector);
    }
  }
  cachedExtrasSectorMap = map;
  return map;
}

function resolvePricePath(normalizedTicker: string): string | null {
  const { PRICES_SP500_DIR, PRICES_EXTRAS_DIR } = getPaths();
  const sp500Path = path.join(PRICES_SP500_DIR, `${normalizedTicker}.csv`);
  if (fs.existsSync(sp500Path)) return sp500Path;
  const sector = loadExtrasSectorMap().get(normalizedTicker);
  if (sector) {
    const extrasPath = path.join(PRICES_EXTRAS_DIR, sector, `${normalizedTicker}.csv`);
    if (fs.existsSync(extrasPath)) return extrasPath;
  }
  return null;
}

const pricesCache = new Map<string, { data: PricesResponse; ts: number }>();
const CACHE_TTL_MS = 60_000;

export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PricesStats {
  lastClose: number;
  lastVolume: number;
  lastDate: string;
  change1dPct: number | null;
}

export interface PricesResponse {
  ticker: string;
  candles: Candle[];
  stats: PricesStats;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker")?.trim();
  const range = (request.nextUrl.searchParams.get("range")?.trim() ||
    "1Y") as RangeKey;
  if (!ticker) {
    return Response.json(
      { error: "Missing ticker" },
      { status: 400 }
    );
  }
  const validRanges: RangeKey[] = ["1M", "3M", "6M", "1Y", "5Y", "MAX"];
  if (!validRanges.includes(range)) {
    return Response.json(
      { error: "Invalid range" },
      { status: 400 }
    );
  }
  const normalized = normalizeTicker(ticker);
  try {
    const tickerSet = loadTickerSet();
    if (!tickerSet.has(normalized)) {
      return Response.json(
        { error: "Ticker not found" },
        { status: 404 }
      );
    }
    const cacheKey = `${normalized}:${range}`;
    const cached = pricesCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return Response.json(cached.data);
    }
    const filePath = resolvePricePath(normalized);
    if (!filePath) {
      return Response.json(
        { error: "No price data for this ticker" },
        { status: 404 }
      );
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = Papa.parse<Record<string, string>>(raw, { header: true });
    const rows = parsed.data.filter(
      (r) => r && (r.date || r.Date) && (r.close || r.Close)
    );
    const get = (r: Record<string, string>, key: string): string => {
      const k = key.toLowerCase();
      for (const kk of Object.keys(r)) {
        if (kk.toLowerCase() === k) return r[kk];
      }
      return "";
    };
    const candles: Candle[] = rows
      .map((r) => {
        const time = get(r, "date") || get(r, "Date");
        const open = parseFloat(get(r, "open") || get(r, "Open")) || 0;
        const high = parseFloat(get(r, "high") || get(r, "High")) || 0;
        const low = parseFloat(get(r, "low") || get(r, "Low")) || 0;
        const close = parseFloat(get(r, "close") || get(r, "Close")) || 0;
        const volume = parseFloat(get(r, "volume") || get(r, "Volume")) || 0;
        return { time, open, high, low, close, volume };
      })
      .filter((c) => c.time)
      .sort((a, b) => a.time.localeCompare(b.time));

    if (candles.length === 0) {
      return Response.json(
        { error: "No candle data" },
        { status: 404 }
      );
    }

    const lastDate = candles[candles.length - 1].time;
    const lastClose = candles[candles.length - 1].close;
    const lastVolume = candles[candles.length - 1].volume;
    let change1dPct: number | null = null;
    if (candles.length >= 2) {
      const prevClose = candles[candles.length - 2].close;
      if (prevClose && prevClose !== 0) {
        change1dPct = ((lastClose - prevClose) / prevClose) * 100;
      }
    }

    const lastDateObj = new Date(lastDate + "T12:00:00Z");
    let filtered = candles;
    const days = RANGE_DAYS[range];
    if (days !== null) {
      const cutoff = addDays(lastDateObj, -days);
      const cutoffStr = dateStr(cutoff);
      filtered = candles.filter((c) => c.time >= cutoffStr);
    }

    const result: PricesResponse = {
      ticker: normalized,
      candles: filtered,
      stats: {
        lastClose,
        lastVolume,
        lastDate,
        change1dPct,
      },
    };
    pricesCache.set(cacheKey, { data: result, ts: Date.now() });
    return Response.json(result);
  } catch (e) {
    console.error("prices API", e);
    return Response.json(
      { error: "Failed to load prices" },
      { status: 500 }
    );
  }
}
