"""Canonical price storage as CSV: one file per ticker, saved locally. No Parquet."""
from datetime import date
from pathlib import Path
from typing import List, Optional

import pandas as pd

from pipeline.utils.dates import parse_date
from pipeline.utils.logging import get_logger

logger = get_logger(__name__)

COLUMNS = [
    "date", "open", "high", "low", "close", "adj_close", "volume",
    "ticker", "source", "updated_at",
]


class CsvStore:
    """
    One CSV per ticker under base_path: <base_path>/<TICKER>.csv.
    All data for a stock in one file. Idempotent: dedupe on (ticker, date), keep latest.
    """

    def __init__(self, base_path: Path):
        self.base_path = Path(base_path)

    def _path(self, ticker: str) -> Path:
        return self.base_path / f"{ticker}.csv"

    def get_last_date(self, ticker: str) -> Optional[date]:
        p = self._path(ticker)
        if not p.exists():
            return None
        try:
            df = pd.read_csv(p, usecols=["date"])
            if df.empty:
                return None
            dates = pd.to_datetime(df["date"], errors="coerce").dt.date
            return dates.dropna().max()
        except Exception as e:
            logger.warning("Error reading %s: %s", p, e)
            return None

    def read_ticker(self, ticker: str) -> Optional[pd.DataFrame]:
        p = self._path(ticker)
        if not p.exists():
            return None
        try:
            df = pd.read_csv(p)
            for c in COLUMNS:
                if c not in df.columns:
                    df[c] = None
            df = df[[c for c in COLUMNS if c in df.columns]]
            df["date"] = pd.to_datetime(df["date"], errors="coerce").dt.date
            df = df.dropna(subset=["date"])
            df = df.drop_duplicates(subset=["ticker", "date"], keep="last").sort_values("date").reset_index(drop=True)
            return df
        except Exception as e:
            logger.warning("Error reading %s: %s", p, e)
            return None

    def append_bars(self, ticker: str, df: pd.DataFrame) -> None:
        if df is None or df.empty:
            return
        df = df.copy()
        df["date"] = pd.to_datetime(df["date"]).dt.date
        for c in COLUMNS:
            if c not in df.columns:
                df[c] = pd.NA if c == "adj_close" else None
        df = df[[c for c in COLUMNS if c in df.columns]]
        existing = self.read_ticker(ticker)
        combined = pd.concat([existing, df], ignore_index=True) if existing is not None and not existing.empty else df
        combined = combined.drop_duplicates(subset=["ticker", "date"], keep="last").sort_values("date").reset_index(drop=True)
        combined["date"] = combined["date"].astype(str)
        self.base_path.mkdir(parents=True, exist_ok=True)
        out_path = self._path(ticker)
        combined.to_csv(out_path, index=False)
        logger.debug("Wrote %s (%d rows)", out_path, len(combined))

    def list_tickers(self) -> List[str]:
        if not self.base_path.exists():
            return []
        return sorted(
            p.stem for p in self.base_path.iterdir()
            if p.is_file() and p.suffix.lower() == ".csv" and not p.name.startswith(".")
        )
