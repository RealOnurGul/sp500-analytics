"""Download daily OHLCV price data from Yahoo Finance."""
from datetime import date
from typing import List, Optional, Tuple

import pandas as pd
import yfinance as yf

from pipeline.utils.dates import date_to_str
from pipeline.utils.logging import get_logger

logger = get_logger(__name__)
SOURCE_LABEL = "yfinance"


def _bars_to_dataframe(ticker: str, start: date, end: date, hist: pd.DataFrame) -> Optional[pd.DataFrame]:
    if hist is None or hist.empty:
        return None
    hist = hist.copy()
    hist.index = pd.to_datetime(hist.index).tz_localize(None)
    hist = hist[hist.index.date >= start]
    hist = hist[hist.index.date <= end]
    if hist.empty:
        return None
    hist = hist.sort_index()
    df = pd.DataFrame({
        "date": [date_to_str(d) for d in hist.index.date],
        "open": hist["Open"].values,
        "high": hist["High"].values,
        "low": hist["Low"].values,
        "close": hist["Close"].values,
        "adj_close": hist["Adj Close"].values if "Adj Close" in hist.columns else None,
        "volume": hist["Volume"].values,
    })
    df["ticker"] = ticker
    df["source"] = SOURCE_LABEL
    df["updated_at"] = pd.Timestamp.now(tz="UTC").isoformat()
    return df


def download_prices(
    ticker: str,
    start: date,
    end: date,
    interval: str = "1d",
) -> Optional[pd.DataFrame]:
    """Download daily OHLCV for one ticker from start to end (inclusive)."""
    try:
        obj = yf.Ticker(ticker)
        hist = obj.history(start=start, end=end, interval=interval, auto_adjust=False)
        if hist is not None and "Adj Close" not in hist.columns:
            hist["Adj Close"] = hist["Close"]
        return _bars_to_dataframe(ticker, start, end, hist)
    except Exception as e:
        logger.warning("yfinance download failed for %s: %s", ticker, e)
        return None


def download_prices_batch(
    tickers: List[str],
    start: date,
    end: date,
    interval: str = "1d",
    throttle_every_n: int = 25,
    sleep_seconds: float = 1.0,
) -> Tuple[List[str], List[str], List[pd.DataFrame]]:
    success_tickers, failed_tickers, results = [], [], []
    for i, ticker in enumerate(tickers):
        if (i + 1) % throttle_every_n == 0:
            import time
            time.sleep(sleep_seconds)
        df = download_prices(ticker, start, end, interval)
        if df is not None and not df.empty:
            success_tickers.append(ticker)
            results.append(df)
        else:
            failed_tickers.append(ticker)
    return success_tickers, failed_tickers, results
