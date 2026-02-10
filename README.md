# S&P 500 Data Pipeline

Data foundation and web app for a long-lived S&P 500 stock dashboard: Python pipeline for ingestion and CSV storage, plus a Next.js TradingView-like frontend in `/web` to browse and chart stocks.

## Setup

1. Create a virtual environment and install dependencies:

   ```bash
   python -m venv .venv
   source .venv/bin/activate   # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. Run from the project root (the directory containing `pipeline/` and `data/`).

## Web app (Next.js)

To run the TradingView-like frontend that reads the same CSV data:

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You can search tickers, select a stock, and view candlestick charts with range buttons (1M, 3M, 6M, 1Y, 5Y, MAX). The app uses Next.js API routes to read from the repo `data/` folder; no separate backend is required.

## Two steps: ticker list vs price updates

The pipeline is split so daily runs do not depend on Wikipedia:

1. **Refresh ticker list** (run occasionally, e.g. weekly): fetches the current S&P 500 from Wikipedia and saves `data/meta/sp500_tickers.csv`.
2. **Update prices** (run daily): reads that list and writes/updates **CSV files** (one per ticker) locally; does not call Wikipedia.

## First run

From the project root:

```bash
python -m pipeline.refresh_tickers
python -m pipeline.update_prices
```

- `refresh_tickers`: Fetches the current S&P 500 list from Wikipedia and writes `data/meta/sp500_tickers.csv`.
- `update_prices`: Reads that list and, for each ticker, downloads **full daily history** (from 1990 onward, as far back as Yahoo provides) and saves it as **CSV** in `data/prices/<TICKER>.csv`. Also builds `data/derived/latest_summary.csv` and writes `data/meta/last_updated.json` and `data/meta/failed_tickers.txt`. All data is stored in CSV on your machine; no export step needed.

Expect the first price run to take a while (throttling and many tickers). Some tickers may fail (e.g. delisted or bad symbols); they are logged and retried once.

## Daily update run

Run only the price updater on a schedule (e.g. after market close):

```bash
python -m pipeline.update_prices
```

- Reads tickers from `data/meta/sp500_tickers.csv` (no Wikipedia).
- For each ticker, fetches from **the day after the last saved date** through today (incremental) and appends to that ticker’s CSV.
- Deduplicates on `(ticker, date)` so multiple runs do not duplicate rows.
- Refreshes `latest_summary.csv` and metadata.

When the index changes (additions/removals), run `python -m pipeline.refresh_tickers` once, then continue with daily `update_prices`.

For quick testing, you can limit the number of tickers: `python -m pipeline.update_prices --limit 5`.

## Viewing the data

All price data is stored as **CSV files** in `data/prices/`. Each ticker has one file: `data/prices/AAPL.csv`, `data/prices/MMM.csv`, etc. Open any of them in Excel, Numbers, or a text editor to see all rows (date, open, high, low, close, volume, etc.) for that stock.

To print a ticker’s history in the terminal or as JSON:

```bash
uv run python -m pipeline.view_data AAPL
uv run python -m pipeline.view_data AAPL --format json --head 50
```

## Where data lives

| Path | Description |
|------|-------------|
| `data/prices/<TICKER>.csv` | One CSV per ticker: full OHLCV history (date, open, high, low, close, adj_close, volume, ticker, source, updated_at). Saved locally on every run. |
| `data/meta/sp500_tickers.csv` | Ticker list and metadata: ticker, security name, sector, sub-industry (from Wikipedia). |
| `data/meta/last_updated.json` | Last run timestamp, tickers processed, successes/failures, list of failed tickers. |
| `data/meta/failed_tickers.txt` | One failed ticker per line. |
| `data/derived/latest_summary.csv` | One row per ticker: latest_date, latest_close, 1d_return, 5d_return, 20d_return, 20d_volatility, avg_volume_20d. |

## How a future frontend/backend can read the data

- **Single ticker**: Read `data/prices/<TICKER>.csv` (e.g. with Node `fs` + a CSV parser, or a small API that returns JSON). One file = full history for that stock.
- **Summary table**: Read `data/derived/latest_summary.csv` once for the dashboard (search, sort, filter by returns or volatility).
- **Date range**: Load the ticker’s CSV and filter rows by date in code.
