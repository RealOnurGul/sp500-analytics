# S&P 500 Web App

Next.js (App Router) frontend to browse and chart S&P 500 stocks. Reads CSV data from the repo `data/` folder via API routes; no separate backend.

## Run

From the **repo root** (or from `web/` after cloning):

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Data

- Ticker list: `data/meta/sp500_tickers.csv`
- Price files: `data/prices/<TICKER>.csv` (daily OHLCV)

Ensure the pipeline has been run at least once so these files exist.
