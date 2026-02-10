"""
Entry point: python -m pipeline.update_prices

Reads the S&P 500 ticker list from data/meta/sp500_tickers.csv (created by
python -m pipeline.refresh_tickers), updates canonical CSV price files (one per ticker)
from Yahoo Finance. First run per ticker: from earliest available (1990 or listing) to
today (US/Eastern). Later runs: incremental (most recent day only). All data is saved
as CSVs locally (data/prices/<TICKER>.csv). Builds latest_summary, writes run metadata.
Does not call Wikipedia.
"""
import argparse
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd

from pipeline.features.summary import build_latest_summary
from pipeline.sources.yfinance_prices import download_prices
from pipeline.storage.csv_store import CsvStore
from pipeline.storage.meta_store import MetaStore
from pipeline.utils.dates import date_to_str, today_est
from pipeline.utils.logging import get_logger

logger = get_logger(__name__)

DEFAULT_DATA_DIR = Path("data")
FULL_HISTORY_START_YEAR = 1990


def _start_date_for_ticker(store: CsvStore, ticker: str) -> str:
    """Return start date (YYYY-MM-DD): day after last saved date, or full history start."""
    last = store.get_last_date(ticker)
    if last is None:
        return f"{FULL_HISTORY_START_YEAR}-01-01"
    next_day = last + timedelta(days=1)
    return date_to_str(next_day)


def main() -> None:
    parser = argparse.ArgumentParser(description="Update S&P 500 daily price data")
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR, help="Base directory for data")
    parser.add_argument("--limit", type=int, default=None, metavar="N", help="Only process first N tickers")
    args = parser.parse_args()

    data_dir = Path(args.data_dir).resolve()
    prices_dir = data_dir / "prices"
    meta_dir = data_dir / "meta"
    derived_dir = data_dir / "derived"

    store = CsvStore(prices_dir)
    meta_store = MetaStore(meta_dir)

    tickers_path = meta_dir / "sp500_tickers.csv"
    if not tickers_path.exists():
        logger.error("Ticker list not found at %s. Run first: python -m pipeline.refresh_tickers", tickers_path)
        sys.exit(1)
    tickers_df = pd.read_csv(tickers_path)
    tickers = tickers_df["ticker"].astype(str).tolist()
    if args.limit is not None:
        tickers = tickers[: args.limit]
        logger.info("Limited to first %d tickers", len(tickers))
    else:
        logger.info("S&P 500 tickers: %d", len(tickers))

    end_date = today_est()
    end_str = date_to_str(end_date)
    total = len(tickers)
    success_set = set()
    throttle_every_n = 25
    sleep_seconds = 1.0
    retry_delay_seconds = 10

    for i, ticker in enumerate(tickers):
        start_str = _start_date_for_ticker(store, ticker)
        start_d = datetime.strptime(start_str, "%Y-%m-%d").date()
        if start_d > end_date:
            print(f"[{i + 1:3d}/{total}] {ticker}  (up to date)", flush=True)
            success_set.add(ticker)
            continue
        print(f"[{i + 1:3d}/{total}] {ticker}  {start_str} → {end_str}", flush=True)
        if (i + 1) % throttle_every_n == 0:
            time.sleep(sleep_seconds)
        df = download_prices(ticker, start_d, end_date, interval="1d")
        if df is not None and not df.empty:
            store.append_bars(ticker, df)
            success_set.add(ticker)
        elif start_d == end_date:
            success_set.add(ticker)

    to_retry = [t for t in tickers if t not in success_set]
    if to_retry:
        logger.info("Retrying %d failed tickers after %s s", len(to_retry), retry_delay_seconds)
        time.sleep(retry_delay_seconds)
        for j, ticker in enumerate(to_retry):
            start_str = _start_date_for_ticker(store, ticker)
            start_d = datetime.strptime(start_str, "%Y-%m-%d").date()
            if start_d > end_date:
                success_set.add(ticker)
                continue
            print(f"[retry {j + 1}/{len(to_retry)}] {ticker}  {start_str} → {end_str}", flush=True)
            df = download_prices(ticker, start_d, end_date, interval="1d")
            if df is not None and not df.empty:
                store.append_bars(ticker, df)
                success_set.add(ticker)
            elif start_d == end_date:
                success_set.add(ticker)

    failed_after_retry = [t for t in tickers if t not in success_set]
    meta_store.write_last_updated(
        tickers_processed=len(tickers),
        successes=len(success_set),
        failures=len(failed_after_retry),
        failed_tickers=failed_after_retry,
    )
    meta_store.write_failed_tickers(failed_after_retry)
    build_latest_summary(store, derived_dir, tickers=tickers)

    print("--- Pipeline summary ---")
    print(f"Tickers processed: {len(tickers)} | Successes: {len(success_set)} | Failures: {len(failed_after_retry)}")
    print(f"Prices (CSV): {prices_dir}")
    print(f"Summary: {derived_dir / 'latest_summary.csv'}")
    if failed_after_retry:
        print(f"Failed: {', '.join(failed_after_retry[:20])}{' ...' if len(failed_after_retry) > 20 else ''}")


if __name__ == "__main__":
    main()
