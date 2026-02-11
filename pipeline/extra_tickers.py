"""
Extra (non-S&P 500) tickers by sector for update_extras script.
No duplicates with S&P 500; failed/delisted tickers removed.
Ticker format: Yahoo Finance symbol. File storage normalizes dots to hyphens.
"""
from typing import List, Tuple

# sector_slug -> list of (yfinance_ticker, display_name) — only non–S&P 500, no failed
EXTRA_TICKERS: dict[str, List[Tuple[str, str]]] = {
    "ai_infra": [
        ("TSM", "Taiwan Semiconductor"),
        ("ASML", "ASML"),
        ("SSNLF", "Samsung Electronics"),
        ("ARM", "Arm Holdings"),
        ("SNOW", "Snowflake"),
        ("MDB", "MongoDB"),
        ("SHOP", "Shopify"),
    ],
    "tech": [],
    "communication_services": [
        ("TCEHY", "Tencent"),
        ("BIDU", "Baidu"),
        ("SPOT", "Spotify"),
        ("ROKU", "Roku"),
        ("ZM", "Zoom"),
        ("PINS", "Pinterest"),
        ("SNAP", "Snap"),
    ],
    "consumer_discretionary": [
        ("LVMUY", "LVMH"),
        ("TM", "Toyota Motor"),
        ("RACE", "Ferrari"),
    ],
    "health_care": [],
    "financials": [
        ("BNS", "Bank of Nova Scotia"),
        ("TD", "Toronto-Dominion Bank"),
        ("RY", "Royal Bank of Canada"),
        ("HSBC", "HSBC Holdings"),
        ("ALIZY", "Allianz"),
    ],
    "energy": [
        ("2222.SR", "Saudi Aramco"),
        ("SHEL", "Shell"),
        ("BP", "BP"),
        ("TTE", "TotalEnergies"),
        ("E", "Eni"),
        ("SLB", "Schlumberger"),
        ("VLO", "Valero Energy"),
        ("PSX", "Phillips 66"),
        ("OXY", "Occidental Petroleum"),
        ("MPC", "Marathon Petroleum"),
        ("CNQ", "Canadian Natural Resources"),
        ("SU", "Suncor Energy"),
        ("REPYY", "Repsol"),
        ("EQNR", "Equinor"),
    ],
    "consumer_staples": [
        ("NSRGY", "Nestlé"),
        ("UL", "Unilever"),
        ("MDLZ", "Mondelez"),
        ("KR", "Kroger"),
        ("DANOY", "Danone"),
        ("OR.PA", "L'Oreal"),
        ("HRL", "Hormel Foods"),
    ],
    "industrials": [
        ("RR.L", "Rolls-Royce Holdings"),
    ],
    "materials": [
        ("BHP", "BHP"),
        ("RIO", "Rio Tinto"),
    ],
    "real_estate": [
        ("KRC", "Kilroy Realty"),
        ("JLL", "Jones Lang LaSalle"),
        ("CWK", "Cushman & Wakefield"),
    ],
    "utilities": [
        ("NGG", "National Grid"),
        ("ENLAY", "Enel"),
        ("IBDRY", "Iberdrola"),
    ],
}


def normalize_ticker_for_file(ticker: str) -> str:
    """Normalize ticker for CSV filename (e.g. BRK.B -> BRK-B, 2222.SR -> 2222-SR)."""
    return ticker.replace(".", "-")


def iter_all_extra_tickers() -> list[tuple[str, str, str, str]]:
    """Return (yf_ticker, file_ticker, name, sector) for all extras. Dedupe by file_ticker (first wins)."""
    seen: set[str] = set()
    out: list[tuple[str, str, str, str]] = []
    for sector, items in EXTRA_TICKERS.items():
        for yf_ticker, name in items:
            file_ticker = normalize_ticker_for_file(yf_ticker)
            if file_ticker in seen:
                continue
            seen.add(file_ticker)
            out.append((yf_ticker, file_ticker, name, sector))
    return out
