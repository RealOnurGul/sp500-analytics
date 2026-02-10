import { NextRequest } from "next/server";
import path from "path";
import fs from "fs";
import Papa from "papaparse";

const REPO_DATA = path.join(process.cwd(), "..", "data");
const TICKERS_PATH = path.join(REPO_DATA, "meta", "sp500_tickers.csv");
const PRICES_DIR = path.join(REPO_DATA, "prices");

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

function normalizeTicker(s: string): string {
  return String(s).replace(/\./g, "-").trim();
}

function loadTickerSet(): Set<string> {
  if (cachedTickerSet) return cachedTickerSet;
  const raw = fs.readFileSync(TICKERS_PATH, "utf-8");
  const parsed = Papa.parse<Record<string, string>>(raw, { header: true });
  const tickers = new Set<string>();
  for (const r of parsed.data) {
    const t = normalizeTicker(r.ticker ?? r.Symbol ?? "");
    if (t) tickers.add(t);
  }
  cachedTickerSet = tickers;
  return tickers;
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
    const filePath = path.join(PRICES_DIR, `${normalized}.csv`);
    if (!fs.existsSync(filePath)) {
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
