"""Fetch S&P 500 ticker list and metadata from Wikipedia."""
import io
import re
from pathlib import Path
from typing import Optional

import pandas as pd
import requests

from pipeline.utils.logging import get_logger

logger = get_logger(__name__)

WIKI_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"


def normalize_ticker_for_yahoo(symbol: str) -> str:
    """Replace '.' with '-' for Yahoo Finance (e.g. BRK.B -> BRK-B)."""
    return symbol.replace(".", "-").strip()


def fetch_sp500_tickers(
    meta_dir: Optional[Path] = None,
    save_metadata: bool = True,
) -> pd.DataFrame:
    """
    Fetch current S&P 500 constituents from Wikipedia.
    Returns a DataFrame with columns: ticker, security_name, sector, sub_industry.
    Optionally saves to data/meta/sp500_tickers.csv.
    """
    logger.info("Fetching S&P 500 list from Wikipedia")
    headers = {"User-Agent": "S&P500-Pipeline/1.0 (https://github.com/sp500-analytics; data pipeline)"}
    resp = requests.get(WIKI_URL, timeout=30, headers=headers)
    resp.raise_for_status()
    tables = pd.read_html(io.StringIO(resp.text))
    # First table is the main component stocks
    df = tables[0].copy()

    # Normalize column names (Wikipedia may use "Symbol", "Security", "GICS Sector", "GICS Sub-Industry")
    col_map = {}
    for c in df.columns:
        c_clean = re.sub(r"\s+", " ", str(c).strip())
        if "Symbol" in c_clean or c_clean == "Symbol":
            col_map[c] = "Symbol"
        elif "Security" in c_clean or c_clean == "Security":
            col_map[c] = "Security"
        elif "GICS Sector" in c_clean or "Sector" in c_clean:
            col_map[c] = "Sector"
        elif "GICS Sub" in c_clean or "Sub-Industry" in c_clean:
            col_map[c] = "Sub-Industry"
    df = df.rename(columns=col_map)

    required = ["Symbol", "Security"]
    for r in required:
        if r not in df.columns:
            raise ValueError(f"Wikipedia table missing column: {r}. Got: {list(df.columns)}")
    df["Sector"] = df.get("Sector", "")
    df["Sub-Industry"] = df.get("Sub-Industry", "")

    # Build output with normalized ticker for Yahoo
    out = pd.DataFrame({
        "ticker": df["Symbol"].astype(str).map(normalize_ticker_for_yahoo),
        "security_name": df["Security"].astype(str),
        "sector": df["Sector"].astype(str),
        "sub_industry": df["Sub-Industry"].astype(str),
    })
    # Keep original symbol for metadata display (e.g. BRK.B in meta, BRK-B for Yahoo)
    out["symbol_original"] = df["Symbol"].astype(str)
    out = out.drop_duplicates(subset=["ticker"]).reset_index(drop=True)

    if save_metadata and meta_dir is not None:
        meta_dir = Path(meta_dir)
        meta_dir.mkdir(parents=True, exist_ok=True)
        meta_path = meta_dir / "sp500_tickers.csv"
        out.to_csv(meta_path, index=False)
        logger.info("Saved ticker metadata to %s", meta_path)

    return out
