import { NextRequest } from "next/server";
import path from "path";
import fs from "fs";
import Papa from "papaparse";

const REPO_DATA = path.join(process.cwd(), "..", "data");
const TICKERS_PATH = path.join(REPO_DATA, "meta", "sp500_tickers.csv");

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

function loadTickers(): TickerMatch[] {
  if (cachedTickers) return cachedTickers;
  const raw = fs.readFileSync(TICKERS_PATH, "utf-8");
  const parsed = Papa.parse<Record<string, string>>(raw, { header: true });
  const rows = parsed.data.filter((r) => r && (r.ticker || r.Symbol));
  cachedTickers = rows.map((r) => {
    const ticker = normalizeTicker(r.ticker ?? r.Symbol ?? "");
    const name = r.security_name ?? r.Security ?? "";
    const sector = r.sector ?? r["GICS Sector"] ?? "";
    const subIndustry = r.sub_industry ?? r["GICS Sub-Industry"] ?? "";
    return { ticker, name, sector, subIndustry };
  });
  return cachedTickers;
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
