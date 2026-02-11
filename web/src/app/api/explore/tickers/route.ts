import { NextResponse } from "next/server";
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

function normalizeTicker(symbol: string): string {
  return String(symbol).replace(/\./g, "-").trim();
}

export async function GET() {
  try {
    const { SP500_TICKERS_PATH, EXTRAS_TICKERS_PATH } = getMetaPaths();
    const out: { ticker: string; name: string; sector: string }[] = [];
    if (fs.existsSync(SP500_TICKERS_PATH)) {
      const raw = fs.readFileSync(SP500_TICKERS_PATH, "utf-8");
      const parsed = Papa.parse<Record<string, string>>(raw, { header: true });
      for (const r of parsed.data) {
        if (!r || (!r.ticker && !r.Symbol)) continue;
        const ticker = normalizeTicker(r.ticker ?? r.Symbol ?? "");
        if (!ticker) continue;
        out.push({
          ticker,
          name: r.security_name ?? r.Security ?? ticker,
          sector: r.sector ?? r["GICS Sector"] ?? "",
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
        out.push({
          ticker,
          name: r.name ?? ticker,
          sector: r.sector ?? "",
        });
      }
    }
    return NextResponse.json(out);
  } catch (e) {
    console.error("explore tickers API", e);
    return NextResponse.json(
      { error: "Failed to load universe tickers" },
      { status: 500 }
    );
  }
}
