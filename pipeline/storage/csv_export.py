"""Optional CSV export: rebuild data/csv/<TICKER>.csv from canonical Parquet."""
from pathlib import Path
from typing import List

import pandas as pd

from pipeline.utils.logging import get_logger

logger = get_logger(__name__)


class CsvExporter:
    """Export per-ticker CSV from Parquet store for convenience."""

    def __init__(self, parquet_store: "ParquetStore", csv_dir: Path):
        self.parquet_store = parquet_store
        self.csv_dir = Path(csv_dir)

    def export_ticker(self, ticker: str) -> None:
        """Write data/csv/<TICKER>.csv from canonical Parquet for one ticker."""
        df = self.parquet_store.read_ticker(ticker)
        if df is None or df.empty:
            return
        self.csv_dir.mkdir(parents=True, exist_ok=True)
        path = self.csv_dir / f"{ticker}.csv"
        df["date"] = df["date"].astype(str)
        df.to_csv(path, index=False)
        logger.debug("Exported %s to %s", ticker, path)

    def export_tickers(self, tickers: List[str]) -> None:
        """Export CSV for each ticker."""
        for ticker in tickers:
            self.export_ticker(ticker)
        logger.info("Exported %d tickers to %s", len(tickers), self.csv_dir)
