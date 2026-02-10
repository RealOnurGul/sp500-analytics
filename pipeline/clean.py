"""
Entry point: python -m pipeline.clean

Removes all pipeline-generated data (prices, derived, meta) so you can reset.
Requires --yes to confirm. After cleaning, run refresh_tickers then update_prices.
"""
import argparse
import shutil
from pathlib import Path

from pipeline.utils.logging import get_logger

logger = get_logger(__name__)
DEFAULT_DATA_DIR = Path("data")
DATA_SUBDIRS = ("prices", "derived", "meta")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Remove all pipeline data to reset (prices, derived, meta)."
    )
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR, help="Base directory for data")
    parser.add_argument("--yes", action="store_true", help="Confirm deletion. Without this, only prints what would be removed.")
    args = parser.parse_args()
    data_dir = Path(args.data_dir).resolve()
    to_remove = [data_dir / name for name in DATA_SUBDIRS]
    existing = [p for p in to_remove if p.exists()]

    if not existing:
        logger.info("Nothing to clean under %s", data_dir)
        return
    if not args.yes:
        print("Would remove:")
        for p in existing:
            print(f"  {p}")
        print("Run with --yes to confirm.")
        return
    for p in existing:
        if p.is_dir():
            shutil.rmtree(p)
            logger.info("Removed %s", p)
        else:
            p.unlink()
            logger.info("Removed %s", p)
    logger.info("Done. Run: uv run python -m pipeline.refresh_tickers && uv run python -m pipeline.update_prices")


if __name__ == "__main__":
    main()
