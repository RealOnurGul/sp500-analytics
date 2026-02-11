# S&P 500 + Extra Stocks Data Pipeline

Data foundation and web app for a stock dashboard: Python pipeline for ingestion and CSV storage (S&P 500 plus an “extras” list of non–S&P 500 tickers by sector), plus a Next.js TradingView-like frontend in `/web` to browse and chart stocks.

## Setup

This project uses [uv](https://docs.astral.sh/uv/) to run the Python pipeline. From the project root:

1. Install uv if needed: `brew install uv` (macOS) or see [install](https://docs.astral.sh/uv/getting-started/installation/).
2. Run any pipeline command with `uv run python -m pipeline.<module>`. uv will install dependencies from `pyproject.toml` (or `requirements.txt`) into a virtual environment automatically.

You can still use a manual venv and `pip install -r requirements.txt` if you prefer; run from the project root (the directory containing `pipeline/` and `data/`).

## Web app (Next.js)

To run the TradingView-like frontend that reads the same CSV data:

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You can search tickers (S&P 500 and extras), select a stock, and view candlestick charts with range buttons (1M, 3M, 6M, 1Y, 5Y, MAX). The app uses Next.js API routes to read from the repo `data/` folder; no separate backend is required.

## Migration (if you already have data in `data/prices/`)

S&P 500 prices now live under `data/prices/sp500/`. Move existing CSVs once:

```bash
mkdir -p data/prices/sp500
mv data/prices/*.csv data/prices/sp500/
```

(Leave any subdirs like `extras` in place; only move `.csv` files.)

## Two data sets

| Data set | Ticker list | Price CSVs | Script |
|----------|-------------|------------|--------|
| **S&P 500** | `data/meta/sp500_tickers.csv` (from Wikipedia) | `data/prices/sp500/<TICKER>.csv` | `update_prices` |
| **Extras** | `data/meta/extras_tickers.csv` (from `pipeline.extra_tickers`) | `data/prices/extras/<sector>/<TICKER>.csv` | `update_extras` |

Extras are grouped by sector (e.g. `ai_infra`, `tech`, `health_care`, `financials`, `energy`, …). Add or edit tickers in `pipeline/extra_tickers.py`, then re-run `update_extras`.

## S&P 500: ticker list vs price updates

1. **Refresh ticker list** (run occasionally, e.g. weekly): fetches the current S&P 500 from Wikipedia and saves `data/meta/sp500_tickers.csv`.
2. **Update prices** (run daily): reads that list and writes/updates CSVs under `data/prices/sp500/`; does not call Wikipedia.

## First run

From the project root.

**S&P 500 only:**

```bash
uv run python -m pipeline.refresh_tickers
uv run python -m pipeline.update_prices
```

- `refresh_tickers`: Fetches the current S&P 500 list from Wikipedia and writes `data/meta/sp500_tickers.csv`.
- `update_prices`: For each S&P 500 ticker, downloads **full daily history** (from 1990 onward, as far back as Yahoo provides) and saves it as **CSV** in `data/prices/sp500/<TICKER>.csv`. Also builds `data/derived/latest_summary.csv` and writes `data/meta/last_updated.json` and `data/meta/failed_tickers.txt`.

**Extras only (non–S&P 500 tickers by sector):**

```bash
uv run python -m pipeline.update_extras
```

- Reads the ticker list from `pipeline/extra_tickers.py` (sectors: ai_infra, tech, communication_services, consumer_discretionary, health_care, financials, energy, consumer_staples, industrials, materials, real_estate, utilities).
- For each ticker, downloads **full daily history** (from 1990 or listing) and saves it in `data/prices/extras/<sector>/<TICKER>.csv`.
- Writes `data/meta/extras_tickers.csv` (ticker, name, sector) for the web app.

Expect the first runs to take a while (throttling and many tickers). Some tickers may fail (e.g. delisted or bad symbols); they are logged and retried once.

## Daily update run (S&P 500 + Extras)

To refresh both S&P 500 and extras in one go (e.g. after market close):

```bash
uv run python -m pipeline.update_prices && uv run python -m pipeline.update_extras
```

- **S&P 500**: Reads `data/meta/sp500_tickers.csv`, fetches from the day after the last saved date through today (incremental), appends to each ticker’s CSV under `data/prices/sp500/`, and refreshes `latest_summary.csv` and metadata.
- **Extras**: For each ticker in `extra_tickers.py`, fetches incrementally and appends under `data/prices/extras/<sector>/`, then overwrites `data/meta/extras_tickers.csv`.

When the S&P 500 index changes, run `uv run python -m pipeline.refresh_tickers` once, then continue with the daily command above.

For quick testing:

- `uv run python -m pipeline.update_prices --limit 5`
- `uv run python -m pipeline.update_extras --limit 5`

## Viewing the data

- **S&P 500**: `data/prices/sp500/<TICKER>.csv`
- **Extras**: `data/prices/extras/<sector>/<TICKER>.csv`

To print a ticker’s history in the terminal (looks in sp500 then extras):

```bash
uv run python -m pipeline.view_data AAPL
uv run python -m pipeline.view_data AAPL --format json --head 50
```

## Where data lives

| Path | Description |
|------|-------------|
| `data/prices/sp500/<TICKER>.csv` | One CSV per S&P 500 ticker: full OHLCV history. |
| `data/prices/extras/<sector>/<TICKER>.csv` | One CSV per extra ticker, grouped by sector. |
| `data/meta/sp500_tickers.csv` | S&P 500 list: ticker, security name, sector, sub-industry (from Wikipedia). |
| `data/meta/extras_tickers.csv` | Extras list: ticker, name, sector (from `update_extras`). |
| `data/meta/last_updated.json` | Last S&P 500 run: timestamp, successes/failures, failed tickers. |
| `data/meta/failed_tickers.txt` | S&P 500 failed tickers, one per line. |
| `data/derived/latest_summary.csv` | One row per S&P 500 ticker: latest_date, latest_close, returns, volatility, etc. |

## How the frontend reads the data

- **Tickers**: Merges `sp500_tickers.csv` and `extras_tickers.csv` for search.
- **Prices**: Resolves each ticker to either `data/prices/sp500/<TICKER>.csv` or `data/prices/extras/<sector>/<TICKER>.csv` and returns JSON for the chart.
