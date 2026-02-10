"""Metadata and run summary: last_updated.json and failed_tickers.txt."""
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import List

from pipeline.utils.logging import get_logger

logger = get_logger(__name__)


class MetaStore:
    """Write pipeline run metadata and failure list."""

    def __init__(self, meta_dir: Path):
        self.meta_dir = Path(meta_dir)

    def write_last_updated(
        self,
        tickers_processed: int,
        successes: int,
        failures: int,
        failed_tickers: List[str],
    ) -> None:
        """Write data/meta/last_updated.json."""
        self.meta_dir.mkdir(parents=True, exist_ok=True)
        payload = {
            "pipeline_run_ts_utc": datetime.now(timezone.utc).isoformat(),
            "tickers_processed": tickers_processed,
            "successes": successes,
            "failures": failures,
            "failed_tickers": failed_tickers,
        }
        path = self.meta_dir / "last_updated.json"
        with open(path, "w") as f:
            json.dump(payload, f, indent=2)
        logger.info("Wrote %s", path)

    def write_failed_tickers(self, failed_tickers: List[str]) -> None:
        """Write data/meta/failed_tickers.txt (one ticker per line)."""
        self.meta_dir.mkdir(parents=True, exist_ok=True)
        path = self.meta_dir / "failed_tickers.txt"
        with open(path, "w") as f:
            for t in failed_tickers:
                f.write(t + "\n")
        logger.info("Wrote %s (%d failed)", path, len(failed_tickers))
