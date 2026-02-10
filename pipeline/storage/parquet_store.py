"""Canonical Parquet storage: partitioned by ticker and year, with deduplication."""
from datetime import date
from pathlib import Path
from typing import List, Optional

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

from pipeline.utils.dates import parse_date
from pipeline.utils.logging import get_logger

logger = get_logger(__name__)
CANONICAL_COLUMNS = [
    "date", "open", "high", "low", "close", "adj_close", "volume",
    "ticker", "source", "updated_at",
]
SCHEMA = pa.schema([
    ("date", pa.string()),
    ("open", pa.float64()),
    ("high", pa.float64()),
    ("low", pa.float64()),
    ("close", pa.float64()),
    ("adj_close", pa.float64()),
    ("volume", pa.float64()),
    ("ticker", pa.string()),
    ("source", pa.string()),
    ("updated_at", pa.string()),
])


class ParquetStore:
    def __init__(self, base_path: Path):
        self.base_path = Path(base_path)

    def _partition_path(self, ticker: str, year: int) -> Path:
        return self.base_path / f"ticker={ticker}" / f"year={year}" / "part.parquet"

    def get_last_date(self, ticker: str) -> Optional[date]:
        ticker_dir = self.base_path / f"ticker={ticker}"
        if not ticker_dir.exists():
            return None
        last = None
        for year_dir in ticker_dir.iterdir():
            if not year_dir.is_dir() or not year_dir.name.startswith("year="):
                continue
            part = year_dir / "part.parquet"
            if not part.exists():
                continue
            try:
                pf = pq.ParquetFile(part)
                t = pf.read(columns=["date"])
                if t.num_rows > 0:
                    dates = t.column("date")
                    for i in range(dates.length()):
                        try:
                            d = parse_date(str(dates[i]))
                            if last is None or d > last:
                                last = d
                        except (ValueError, TypeError):
                            continue
            except Exception as e:
                logger.warning("Error reading %s: %s", part, e)
        return last

    def append_bars(self, ticker: str, df: pd.DataFrame) -> None:
        if df is None or df.empty:
            return
        df = df.copy()
        df["date"] = pd.to_datetime(df["date"]).dt.date
        for col in CANONICAL_COLUMNS:
            if col not in df.columns:
                df[col] = pd.NA if col == "adj_close" else None
        df = df[[c for c in CANONICAL_COLUMNS if c in df.columns]]
        existing = self.read_ticker(ticker)
        combined = pd.concat([existing, df], ignore_index=True) if existing is not None and not existing.empty else df
        combined = combined.drop_duplicates(subset=["ticker", "date"], keep="last").sort_values("date").reset_index(drop=True)
        combined["date"] = combined["date"].astype(str)
        for year, group in combined.groupby(pd.to_datetime(combined["date"]).dt.year):
            part_path = self._partition_path(ticker, int(year))
            part_path.parent.mkdir(parents=True, exist_ok=True)
            table = pa.Table.from_pandas(group[CANONICAL_COLUMNS], preserve_index=False).cast(SCHEMA)
            pq.write_table(table, part_path)

    def read_ticker(self, ticker: str) -> Optional[pd.DataFrame]:
        ticker_dir = self.base_path / f"ticker={ticker}"
        if not ticker_dir.exists():
            return None
        parts = []
        for year_dir in sorted(ticker_dir.iterdir()):
            if not year_dir.is_dir() or not year_dir.name.startswith("year="):
                continue
            part = year_dir / "part.parquet"
            if part.exists():
                parts.append(part)
        if not parts:
            return None
        dfs = []
        for p in parts:
            try:
                df = pd.read_parquet(p)
                for col in ("ticker", "source", "updated_at", "date"):
                    if col in df.columns:
                        df[col] = df[col].astype(str)
                dfs.append(df)
            except Exception as e:
                logger.warning("Error reading %s: %s", p, e)
        if not dfs:
            return None
        out = pd.concat(dfs, ignore_index=True)
        out["date"] = pd.to_datetime(out["date"]).dt.date
        return out.drop_duplicates(subset=["ticker", "date"], keep="last").sort_values("date").reset_index(drop=True)

    def list_tickers(self) -> List[str]:
        if not self.base_path.exists():
            return []
        return sorted(
            d.name.replace("ticker=", "")
            for d in self.base_path.iterdir()
            if d.is_dir() and d.name.startswith("ticker=")
        )
