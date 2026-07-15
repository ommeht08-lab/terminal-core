# Prism Quantitative

**An institutional-grade equity research and quantitative analysis platform, built and maintained by Om Mehta.**

Prism Quantitative is a full-stack research terminal combining systematic quantitative screening, fundamentals-driven valuation modeling, and live telemetry from an independently operated algorithmic execution engine. The platform is designed around a strict separation of concerns: a Python/FastAPI service layer performs all data acquisition and quantitative computation, a Next.js presentation layer renders it, and a decoupled Java trading engine executes strategy logic against a paper-trading account with no inbound control path from this repository.

---

## 1. System Architecture

Prism Quantitative is composed of three independently deployable systems. Only one of the three — the execution engine — lives outside this repository.

```
┌─────────────────────────┐        ┌──────────────────────────┐
│   Next.js Frontend        │  REST  │   FastAPI Backend          │
│   (App Router / TS)     │◄──────►│   (Python 3.9)             │
│   Presentation layer     │        │   Data + quant layer        │
└─────────────────────────┘        └──────────────┬───────────┘
                                                     │
                              ┌──────────────────────┼──────────────────────┐
                              │                      │                      │
                        ┌─────▼─────┐         ┌──────▼──────┐        ┌──────▼──────┐
                        │  Polygon.io │         │      FMP      │        │    Alpaca     │
                        │  Market data │         │ Fundamentals │        │  Paper trading │
                        └────────────┘         └─────────────┘        └──────┬──────┘
                                                                               │
                                                                        ┌──────▼──────┐
                                                                        │ Java Execution │
                                                                        │    Engine       │
                                                                        │  (out-of-repo)  │
                                                                        └───────────────┘
```

**A note on the execution engine.** The strategy that actually places trades is a separately developed and separately deployed Java service. It is not part of this repository, and this repository does not import, invoke, or otherwise have a direct integration surface with it. The two systems communicate exclusively and indirectly through Alpaca's brokerage API: the Java engine submits paper trades to Alpaca, and this platform's `/telemetry` module reads that same Alpaca account's positions and portfolio history back out. This backend also exposes a persisted `algo_config` table (`ma_lookback_period`, `std_dev_multiplier`) intended for the execution engine to poll for its own strategy parameters; this repository writes to that table but has no mechanism to confirm the engine consumes it, and does not push updates to the engine directly. The relationship is therefore observational and configurational, not operational — this platform can display what the engine has done and stage parameters for it to read, but cannot instruct it to act.

### 1.1 Backend (`/backend`)

FastAPI service (Python 3.9) responsible for all external data acquisition, persistence, and quantitative computation. The frontend performs no calculation of its own beyond the client-side DCF and equity-curve rendering described in §2.

| Module | Responsibility |
|---|---|
| `main.py` | FastAPI application and route definitions |
| `data_engine.py` | Polygon-backed OHLCV retrieval, rate-limit handling, ticker symbology normalization |
| `fmp_client.py` | Shared Financial Modeling Prep HTTP client |
| `quant_metrics.py` | Technical indicators (SMA, RSI, rolling Z-score), the volatility screener, DuPont/Piotroski/Altman diagnostics, news aggregation |
| `fundamental_metrics.py` | Proprietary 100-point Growth/Profitability/Health/Valuation scoring engine |
| `hybrid_engine.py` | Signal synthesis combining mean-reversion and fundamental scores |
| `backtester.py` | Two independent backtesting engines (see §2.3) |
| `alpaca_client.py` | Read-only Alpaca REST client for paper-account telemetry |
| `database.py` | SQLAlchemy models and schema migration helpers (SQLite locally, Postgres in production) |

### 1.2 Frontend (`/frontend`)

Next.js 16 application (App Router, Turbopack, TypeScript, Tailwind CSS v4) implementing a glassmorphic design system. Server Components perform data fetching against the FastAPI backend at request time; Client Components own interactive state (sliders, forms, charts) where required.

### 1.3 Execution Engine (out-of-repo)

A Java service implementing a standard-deviation mean-reversion strategy against a paper-trading Alpaca account. Not distributed with, or accessible from, this repository.

---

## 2. Core Features

### 2.1 Interactive DCF Valuation Engine

Location: `/stock/[ticker]`, integrated into the primary equity tear sheet.

A client-side, single-stage Gordon Growth discounted cash flow model. The backend (`GET /api/valuation/{ticker}`) supplies four real inputs sourced from FMP — trailing free cash flow, total debt, cash and equivalents, and shares outstanding — plus the live quote price. The frontend then recomputes the implied per-share value and margin of safety in real time as the user adjusts WACC (default 10%) and terminal growth rate (default 2.5%) via slider controls, with no additional network round-trip per adjustment. If FMP does not report full fundamentals for a given ticker under the platform's current API tier, the tool degrades to an explicit unavailable state rather than approximating missing inputs.

### 2.2 Volatility & Risk Matrix

Location: `/dashboard`.

A live statistical screener over the active watchlist, computed via `GET /api/screener/volatility`. For each ticker, the backend fetches a recent OHLCV window from Polygon and derives the 14-day RSI, the 30-day rolling standard deviation of closing price, and the current price's percentage deviation from the 20-day simple moving average. Rows are visually flagged as oversold or overbought when RSI crosses the conventional 30/70 thresholds or when price deviates more than two standard deviations from the mean, surfacing candidates consistent with the execution engine's mean-reversion mandate. Because Polygon's free tier enforces a five-request-per-minute ceiling, the screener returns partial, honestly labeled results (`rate_limited: true`) rather than blocking on a full watchlist scan.

### 2.3 Historical Backtesting Sandbox

Location: `/telemetry`, adjacent to the Risk Controls panel.

An in-house, configurable backtesting engine (`POST /api/backtest`, `run_mean_reversion_backtest` in `backtester.py`) that simulates the same Bollinger-band mean-reversion logic the Risk Controls panel is designed to parameterize for the execution engine — buy when price closes below `SMA − k·σ`, close the position above `SMA + k·σ`. Users may adjust the moving-average lookback window and standard-deviation multiplier and immediately backtest those exact values against one to two years of real historical price data, before deciding whether to persist them as the engine's live configuration. Results include total return, an annualized Sharpe ratio (4% risk-free rate), maximum drawdown, win rate, and a paired daily equity curve plotted against a buy-and-hold benchmark of the same instrument. This engine is a research approximation of the execution engine's strategy shape; it is not a certified replica of the Java engine's live source, which this platform cannot inspect.

### 2.4 Supporting Modules

- **Sector Intel** (`/intel`) — aggregated macro news by sector (Technology, Finance, Healthcare, Energy).
- **Long-Term Horizons** (`/long-term`) — baseline index ETF tracking and a compound-growth accumulation model.
- **Algo Telemetry** (`/telemetry`) — read-only equity curve and open-position feed from the execution engine's Alpaca paper account, plus the Risk Controls and Backtesting Sandbox described above.
- **Research Journal** (`/journal`) — persisted, per-ticker analyst notes, surfaced on the public landing page as "Recent Theses."

---

## 3. Data & API Integrations

| Provider | Purpose | Notes |
|---|---|---|
| [Polygon.io](https://polygon.io/) | Daily OHLCV price history, batch quotes | Free tier: 5 requests/minute, ~2 years of historical lookback. All Polygon-dependent endpoints degrade gracefully and report rate-limit state explicitly rather than failing silently. |
| [Financial Modeling Prep](https://financialmodelingprep.com/) | Fundamentals, valuation ratios, DuPont/Piotroski/Altman diagnostics, DCF inputs, news fallback | Certain tickers and endpoints are restricted per the platform's API tier; unavailable fields are surfaced as `null`, never estimated. |
| [Alpaca](https://alpaca.markets/) | Read-only paper-trading account telemetry | This platform only calls Alpaca's read endpoints (`list_positions`, `get_portfolio_history`). It does not place, modify, or cancel orders under any code path. |

This platform maintains a standing engineering principle: **no financial metric is ever estimated, interpolated, or fabricated to fill a gap in provider data.** Where a data source cannot supply a value, the API and UI represent that absence explicitly (`null`, an unavailable-state card, or a partial-results banner) rather than approximating a plausible-looking number.

---

## 4. Technology Stack

| Layer | Technology |
|---|---|
| Frontend framework | Next.js 16.2.10 (App Router, Turbopack), React 19 |
| Frontend language | TypeScript |
| Styling | Tailwind CSS v4, custom glassmorphic design system |
| Charting | Recharts 3.9 |
| PDF export | react-to-pdf |
| Backend framework | FastAPI (Python 3.9) |
| ORM / persistence | SQLAlchemy — SQLite (development), PostgreSQL (production) |
| Quantitative computation | pandas |
| Brokerage integration | alpaca-trade-api |

---

## 5. API Reference

All routes are served from the FastAPI backend under `/api`.

**Equity Analysis**
- `GET /api/analyze/{ticker}` — price, SMAs, RSI, Z-score, trend, fundamentals, DuPont/Piotroski/Altman, backtest, news, history
- `GET /api/valuation/{ticker}` — raw DCF inputs for the Interactive Valuation Engine
- `POST /api/backtest` — historical mean-reversion backtest for a given ticker and parameter set

**Screening & Watchlist**
- `GET /api/screener/volatility` — RSI/std-dev/SMA-deviation screener over the active watchlist
- `POST /api/watchlist/summary` — lightweight batch quotes for a ticker set
- `GET /api/watchlist`, `POST /api/watchlist/{ticker}`, `DELETE /api/watchlist/{ticker}`

**Algo Telemetry**
- `GET /api/bot/positions`, `GET /api/bot/pnl` — read-only Alpaca paper-account telemetry
- `GET /api/bot/config`, `POST /api/bot/config` — persisted execution-engine strategy parameters

**News & Research**
- `GET /api/news/sector` — macro sector news
- `GET /api/journal/recent` — most recent research notes, for the landing page
- `GET /api/notes`, `GET /api/notes/{ticker}`, `POST /api/notes/{ticker}` — research journal CRUD

---

## 6. Getting Started

### 6.1 Prerequisites

- Python 3.9+
- Node.js 18+ and npm
- API keys: [Polygon.io](https://polygon.io/) and [Financial Modeling Prep](https://financialmodelingprep.com/) are required for core functionality; [Alpaca](https://app.alpaca.markets/paper/dashboard/overview) (paper) is optional and required only for the Algo Telemetry module.

### 6.2 Clone the repository

```bash
git clone https://github.com/ommeht08-lab/terminal-core.git
cd terminal-core
```

### 6.3 Backend setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Populate `backend/.env` with real credentials:

```bash
POLYGON_API_KEY=your_polygon_key
FMP_API_KEY=your_fmp_key

# Optional — enables the Algo Telemetry module
ALPACA_API_KEY=your_alpaca_paper_key
ALPACA_SECRET_KEY=your_alpaca_paper_secret

# Optional — defaults to local SQLite if unset
# DATABASE_URL=postgresql://user:password@host:5432/dbname
```

The database schema (SQLite by default, at `backend/journal.db`) is created automatically on first run; no manual migration step is required for a fresh installation.

### 6.4 Frontend setup

```bash
cd frontend
npm install
cp .env.example .env.local
```

`frontend/.env.local` only needs `NEXT_PUBLIC_API_URL` set if the backend is not running at its local default (`http://127.0.0.1:8000`).

### 6.5 Run the platform

From the repository root, both services can be launched together:

```bash
./start.sh
```

This activates the backend virtual environment, starts `uvicorn` on `:8000`, and starts the Next.js dev server on `:3000`. Alternatively, run each service independently:

```bash
# Terminal 1 — backend
cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend && npm run dev
```

The application will be available at `http://localhost:3000`.

---

## 7. Disclaimer

Prism Quantitative is a research and educational platform. Nothing rendered by this application — including but not limited to DCF valuations, backtested strategy performance, technical signals, or fundamental scores — constitutes investment advice or a recommendation to buy, sell, or hold any security. All strategy simulations are historical approximations run against publicly available market data and do not guarantee, and should not be interpreted as predictive of, future performance.

---

## 8. Author

Built and maintained by **Om Mehta**, a junior at Rock Ridge High School.
