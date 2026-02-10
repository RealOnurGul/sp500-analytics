"""
Entry point: python -m pipeline.view_data <TICKER>

Prints a ticker's full price history. Reads from local CSV (data/prices/<TICKER>.csv).
Use --format csv or json.
"""
import argparse
import json
import sys
from pathlib import Path

import pandas as pd

from pipeline.storage.csv_store import CsvStore

DEFAULT_DATA_DIR = Path("data")


def main() -> None:
    parser = argparse.ArgumentParser(description="View all data points for one ticker")
    parser.add_argument("ticker", help="Ticker symbol (e.g. AAPL)")
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=DEFAULT_DATA_DIR,
        help="Base directory for data (default: data)",
    )
    parser.add_argument(
        "--format",
        choices=("csv", "json"),
        default="csv",
        help="Output format (default: csv)",
    )
    parser.add_argument(
        "--head",
        type=int,
        default=None,
        metavar="N",
        help="Show only first N rows (default: all)",
    )
    args = parser.parse_args()
    prices_dir = Path(args.data_dir).resolve() / "prices"
    store = CsvStore(prices_dir)

    df = store.read_ticker(args.ticker.strip().upper())
    if df is None or df.empty:
        print(f"No data for {args.ticker}", file=sys.stderr)
        sys.exit(1)

    if args.head is not None:
        df = df.head(args.head)
    df["date"] = df["date"].astype(str)

    if args.format == "csv":
        df.to_csv(sys.stdout, index=False)
    else:
        out = df.to_dict(orient="records")
        print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
