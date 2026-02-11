import { NextRequest } from "next/server";
import path from "path";
import fs from "fs";
import Papa from "papaparse";
import { getDataDir } from "@/lib/data-path";

function getMetaPaths() {
  const metaDir = path.join(getDataDir(), "meta");
  return {
    SP500_TICKERS_PATH: path.join(metaDir, "sp500_tickers.csv"),
    EXTRAS_TICKERS_PATH: path.join(metaDir, "extras_tickers.csv"),
  };
}

export interface TickerMatch {
  ticker: string;
  name: string;
  sector: string;
  subIndustry: string;
}

function normalizeTicker(symbol: string): string {
  return String(symbol).replace(/\./g, "-").trim();
}

let cachedTickers: TickerMatch[] | null = null;
let cachedTickersMetaTime = 0;

function loadTickers(): TickerMatch[] {
  const { SP500_TICKERS_PATH, EXTRAS_TICKERS_PATH } = getMetaPaths();
  const mtime = (p: string) => (fs.existsSync(p) ? fs.statSync(p).mtimeMs : 0);
  const nowMeta = Math.max(mtime(SP500_TICKERS_PATH), mtime(EXTRAS_TICKERS_PATH));
  if (cachedTickers && nowMeta <= cachedTickersMetaTime) return cachedTickers;
  cachedTickers = null;
  cachedTickersMetaTime = nowMeta;
  const out: TickerMatch[] = [];
  if (fs.existsSync(SP500_TICKERS_PATH)) {
    const raw = fs.readFileSync(SP500_TICKERS_PATH, "utf-8");
    const parsed = Papa.parse<Record<string, string>>(raw, { header: true });
    for (const r of parsed.data) {
      if (!r || (!r.ticker && !r.Symbol)) continue;
      const ticker = normalizeTicker(r.ticker ?? r.Symbol ?? "");
      if (!ticker) continue;
      out.push({
        ticker,
        name: r.security_name ?? r.Security ?? "",
        sector: r.sector ?? r["GICS Sector"] ?? "",
        subIndustry: r.sub_industry ?? r["GICS Sub-Industry"] ?? "",
      });
    }
  }
  if (fs.existsSync(EXTRAS_TICKERS_PATH)) {
    const raw = fs.readFileSync(EXTRAS_TICKERS_PATH, "utf-8");
    const parsed = Papa.parse<Record<string, string>>(raw, { header: true });
    for (const r of parsed.data) {
      if (!r || !r.ticker) continue;
      const ticker = normalizeTicker(r.ticker);
      if (!ticker) continue;
      const sector = r.sector ?? "";
      out.push({ ticker, name: r.name ?? ticker, sector, subIndustry: sector });
    }
  }
  cachedTickers = out;
  return out;
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  try {
    const all = loadTickers();
    if (!q || q.length < 1) {
      return Response.json(all.slice(0, 50));
    }
    const lower = q.toLowerCase();
    const matches = all.filter(
      (t) =>
        t.ticker.toLowerCase().includes(lower) ||
        t.name.toLowerCase().includes(lower)
    );
    const top = matches.slice(0, 20);
    return Response.json(top);
  } catch (e) {
    console.error("tickers API", e);
    return Response.json(
      { error: "Failed to load tickers" },
      { status: 500 }
    );
  }
}
