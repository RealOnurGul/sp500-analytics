"""
Entry point: python -m pipeline.refresh_tickers

Fetches the current S&P 500 list from Wikipedia and saves it to data/meta/sp500_tickers.csv.
Run this occasionally (e.g. weekly) to pick up index changes. Daily price updates use
the saved list and do not hit Wikipedia.
"""
import argparse
from pathlib import Path

from pipeline.sources.sp500_wikipedia import fetch_sp500_tickers
from pipeline.utils.logging import get_logger

logger = get_logger(__name__)

DEFAULT_DATA_DIR = Path("data")


def main() -> None:
    parser = argparse.ArgumentParser(description="Refresh S&P 500 ticker list from Wikipedia")
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=DEFAULT_DATA_DIR,
        help="Base directory for data (default: data)",
    )
    args = parser.parse_args()
    meta_dir = Path(args.data_dir).resolve() / "meta"

    fetch_sp500_tickers(meta_dir=meta_dir, save_metadata=True)
    logger.info("Done. Run python -m pipeline.update_prices to update prices for these tickers.")


if __name__ == "__main__":
    main()
