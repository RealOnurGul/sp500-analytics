"""Build latest_summary from canonical price store (CSV): one row per ticker with returns and volatility."""
from pathlib import Path
from typing import List, Optional

import pandas as pd

from pipeline.utils.logging import get_logger

logger = get_logger(__name__)


def _compute_summary_for_ticker(store, ticker: str) -> Optional[pd.DataFrame]:
    """Compute one row: ticker, latest_date, latest_close, 1d/5d/20d return, 20d vol, avg_volume_20d."""
    df = store.read_ticker(ticker)
    if df is None or df.empty or len(df) < 2:
        return None
    df = df.sort_values("date").reset_index(drop=True)
    df["close"] = pd.to_numeric(df["close"], errors="coerce")
    df["volume"] = pd.to_numeric(df["volume"], errors="coerce")
    df = df.dropna(subset=["close"])
    if df.empty or len(df) < 2:
        return None
    latest = df.iloc[-1]
    latest_date = latest["date"]
    latest_close = float(latest["close"])
    # Daily returns
    df["daily_return"] = df["close"].pct_change()
    # 1d return
    if len(df) >= 2:
        prev_close = df.iloc[-2]["close"]
        ret_1d = (latest_close - prev_close) / prev_close if prev_close and prev_close != 0 else None
    else:
        ret_1d = None
    # 5d and 20d return (from close 5/20 days ago)
    ret_5d = None
    if len(df) >= 6:
        close_5d_ago = df.iloc[-6]["close"]
        if close_5d_ago and close_5d_ago != 0:
            ret_5d = (latest_close - close_5d_ago) / close_5d_ago
    ret_20d = None
    if len(df) >= 21:
        close_20d_ago = df.iloc[-21]["close"]
        if close_20d_ago and close_20d_ago != 0:
            ret_20d = (latest_close - close_20d_ago) / close_20d_ago
    # 20d volatility (std of daily returns)
    returns_20d = df["daily_return"].iloc[-20:]
    vol_20d = float(returns_20d.std()) if len(returns_20d) >= 2 else None
    # avg volume last 20 days
    vol_20d_avg = float(df["volume"].iloc[-20:].mean()) if len(df) >= 20 else None
    row = {
        "ticker": ticker,
        "latest_date": latest_date if hasattr(latest_date, "isoformat") else str(latest_date),
        "latest_close": latest_close,
        "1d_return": ret_1d,
        "5d_return": ret_5d,
        "20d_return": ret_20d,
        "20d_volatility": vol_20d,
        "avg_volume_20d": vol_20d_avg,
    }
    return pd.DataFrame([row])


def build_latest_summary(
    store,
    derived_dir: Path,
    tickers: Optional[List[str]] = None,
) -> pd.DataFrame:
    """
    Build data/derived/latest_summary.csv from canonical price data (CSV store).
    One row per ticker: ticker, latest_date, latest_close, 1d_return, 5d_return, 20d_return,
    20d_volatility, avg_volume_20d.
    """
    if tickers is None:
        tickers = store.list_tickers()
    if not tickers:
        logger.warning("No tickers to build summary")
        return pd.DataFrame()

    rows = []
    for ticker in tickers:
        one = _compute_summary_for_ticker(store, ticker)
        if one is not None and not one.empty:
            rows.append(one)
    if not rows:
        summary = pd.DataFrame()
    else:
        summary = pd.concat(rows, ignore_index=True)

    derived_dir = Path(derived_dir)
    derived_dir.mkdir(parents=True, exist_ok=True)
    if not summary.empty:
        summary["latest_date"] = pd.to_datetime(summary["latest_date"]).dt.strftime("%Y-%m-%d")
        summary.to_csv(derived_dir / "latest_summary.csv", index=False)
        logger.info("Wrote latest_summary to %s (%d tickers)", derived_dir, len(summary))
    return summary
