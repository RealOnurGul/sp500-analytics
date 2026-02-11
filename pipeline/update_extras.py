"""
Entry point: python -m pipeline.update_extras

Downloads full daily history (from 1990 or listing) for the "Extra" (non-S&P 500) tickers
defined in pipeline.extra_tickers, organized by sector. Writes CSVs under data/prices/extras/<sector>/.
Also writes data/meta/extras_tickers.csv (ticker, name, sector) for the web app.
Incremental on re-run: only fetches from day after last saved date.
"""
import argparse
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd

from pipeline.extra_tickers import EXTRA_TICKERS, normalize_ticker_for_file
from pipeline.sources.yfinance_prices import download_prices
from pipeline.storage.csv_store import CsvStore
from pipeline.utils.dates import date_to_str, today_est
from pipeline.utils.logging import get_logger

logger = get_logger(__name__)

DEFAULT_DATA_DIR = Path("data")
FULL_HISTORY_START_YEAR = 1990


def _start_date_for_ticker(store: CsvStore, file_ticker: str) -> str:
    """Return start date (YYYY-MM-DD): day after last saved date, or full history start."""
    last = store.get_last_date(file_ticker)
    if last is None:
        return f"{FULL_HISTORY_START_YEAR}-01-01"
    next_day = last + timedelta(days=1)
    return date_to_str(next_day)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Update daily price data for extra (non-S&P 500) tickers by sector"
    )
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR, help="Base directory for data")
    parser.add_argument("--limit", type=int, default=None, metavar="N", help="Only process first N tickers total")
    args = parser.parse_args()

    data_dir = Path(args.data_dir).resolve()
    extras_base = data_dir / "prices" / "extras"
    meta_dir = data_dir / "meta"

    meta_dir.mkdir(parents=True, exist_ok=True)

    # Build flat list (yf_ticker, file_ticker, name, sector) for all; dedupe by file_ticker
    seen: set[str] = set()
    all_entries: list[tuple[str, str, str, str]] = []
    for sector, items in EXTRA_TICKERS.items():
        for yf_ticker, name in items:
            file_ticker = normalize_ticker_for_file(yf_ticker)
            if file_ticker in seen:
                continue
            seen.add(file_ticker)
            all_entries.append((yf_ticker, file_ticker, name, sector))

    if args.limit is not None:
        all_entries = all_entries[: args.limit]
        logger.info("Limited to first %d tickers", len(all_entries))
    else:
        logger.info("Extra tickers: %d", len(all_entries))

    end_date = today_est()
    end_str = date_to_str(end_date)
    total = len(all_entries)
    success_set: set[str] = set()
    throttle_every_n = 25
    sleep_seconds = 1.0
    retry_delay_seconds = 10

    for i, (yf_ticker, file_ticker, name, sector) in enumerate(all_entries):
        sector_dir = extras_base / sector
        sector_dir.mkdir(parents=True, exist_ok=True)
        store = CsvStore(sector_dir)
        start_str = _start_date_for_ticker(store, file_ticker)
        start_d = datetime.strptime(start_str, "%Y-%m-%d").date()
        if start_d > end_date:
            print(f"[{i + 1:3d}/{total}] {file_ticker}  (up to date)", flush=True)
            success_set.add(file_ticker)
            continue
        print(f"[{i + 1:3d}/{total}] {file_ticker}  {sector}  {start_str} → {end_str}", flush=True)
        if (i + 1) % throttle_every_n == 0:
            time.sleep(sleep_seconds)
        df = download_prices(yf_ticker, start_d, end_date, interval="1d")
        if df is not None and not df.empty:
            df = df.copy()
            df["ticker"] = file_ticker
            store.append_bars(file_ticker, df)
            success_set.add(file_ticker)
        elif start_d == end_date:
            success_set.add(file_ticker)

    to_retry = [e for e in all_entries if e[1] not in success_set]
    if to_retry:
        logger.info("Retrying %d failed tickers after %s s", len(to_retry), retry_delay_seconds)
        time.sleep(retry_delay_seconds)
        for j, (yf_ticker, file_ticker, name, sector) in enumerate(to_retry):
            sector_dir = extras_base / sector
            store = CsvStore(sector_dir)
            start_str = _start_date_for_ticker(store, file_ticker)
            start_d = datetime.strptime(start_str, "%Y-%m-%d").date()
            if start_d > end_date:
                success_set.add(file_ticker)
                continue
            print(f"[retry {j + 1}/{len(to_retry)}] {file_ticker}  {start_str} → {end_str}", flush=True)
            df = download_prices(yf_ticker, start_d, end_date, interval="1d")
            if df is not None and not df.empty:
                df = df.copy()
                df["ticker"] = file_ticker
                store.append_bars(file_ticker, df)
                success_set.add(file_ticker)
            elif start_d == end_date:
                success_set.add(file_ticker)

    # Write extras_tickers.csv for the web app (ticker = file_ticker, name, sector)
    extras_meta_path = meta_dir / "extras_tickers.csv"
    rows = [
        {"ticker": file_ticker, "name": name, "sector": sector}
        for (_yf, file_ticker, name, sector) in all_entries
    ]
    pd.DataFrame(rows).to_csv(extras_meta_path, index=False)
    logger.info("Wrote %s (%d tickers)", extras_meta_path, len(rows))

    failed = [e[1] for e in all_entries if e[1] not in success_set]
    print("--- Extras pipeline summary ---")
    print(f"Tickers processed: {len(all_entries)} | Successes: {len(success_set)} | Failures: {len(failed)}")
    print(f"Prices (CSV): {extras_base}")
    print(f"Meta: {extras_meta_path}")
    if failed:
        print(f"Failed: {', '.join(failed[:20])}{' ...' if len(failed) > 20 else ''}")


if __name__ == "__main__":
    main()
