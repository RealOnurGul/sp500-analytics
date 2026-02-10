"""Date parsing and formatting utilities."""
from datetime import date, datetime, timedelta, timezone
from typing import Union

import pandas as pd


def parse_date(value: Union[str, date, datetime, pd.Timestamp, None]) -> date:
    """Parse various date-like values to a timezone-naive date. Handles None/invalid."""
    if value is None or (isinstance(value, str) and value in ("None", "", "NaT", "nan")):
        raise ValueError("Cannot parse null or empty date")
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date() if value.tzinfo is None else value.astimezone(timezone.utc).date()
    if isinstance(value, pd.Timestamp):
        if pd.isna(value):
            raise ValueError("Cannot parse NaT")
        if value.tz is not None:
            value = value.tz_convert("UTC")
        return value.date()
    if isinstance(value, str):
        parsed = pd.to_datetime(value, errors="coerce")
        if pd.isna(parsed):
            raise ValueError(f"Cannot parse date from string: {value!r}")
        return parsed.date()
    raise TypeError(f"Cannot parse date from {type(value)}: {value}")


def date_to_str(d: date) -> str:
    """Format date as YYYY-MM-DD."""
    return d.strftime("%Y-%m-%d")


def today_utc() -> date:
    """Return current date in UTC."""
    return datetime.now(timezone.utc).date()


def today_est() -> date:
    """Return current date in US/Eastern (market calendar)."""
    try:
        import zoneinfo
        tz = zoneinfo.ZoneInfo("America/New_York")
    except Exception:
        tz = timezone(timedelta(hours=-5))
    return datetime.now(tz).date()
