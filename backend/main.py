import math
import os
import secrets
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from typing import List, Optional

from alpaca_client import get_bot_pnl, get_bot_positions
from alpaca_engine import BrokerError, execute_market_order
from backtester import run_backtest, run_mean_reversion_backtest
from data_engine import PolygonRateLimitError, fetch_batch_quotes, fetch_ohlcv
from database import AlgoConfig, ExecutionLedger, ResearchNote, Watchlist, get_db, init_db
from options_engine import price_options
from portfolio_optimizer import optimize_portfolio
from sentiment_engine import analyze_sentiment
from fundamental_metrics import calculate_fundamentals
from hybrid_engine import generate_hybrid_signal
from quant_metrics import (
    SECTOR_NEWS_QUERIES,
    build_history,
    build_sparkline,
    calculate_metrics,
    get_diagnostics,
    get_fundamental_snapshot,
    get_news,
    get_valuation_inputs,
    screen_volatility,
)

app = FastAPI(title="Quant Finance Model API")


@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "Prism Quantitative API",
        "version": "1.0.0"
    }


# Comma-separated list, e.g. "https://terminal-core.vercel.app,http://localhost:3000".
# Falls back to the local dev frontend if unset or empty (blank/whitespace-only
# entries are dropped so a stray trailing comma doesn't produce a "" origin).
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
] or ["http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()


# Shared secret the Java execution engine must present (via the X-Bot-Auth
# header) to POST /api/webhooks/execute. Unset means the webhook is closed
# to everyone -- fail closed, not open, rather than trusting an absent
# secret as "no auth required".
BOT_WEBHOOK_SECRET = os.getenv("BOT_WEBHOOK_SECRET")


class NoteBody(BaseModel):
    content: str


class AlgoConfigBody(BaseModel):
    ma_lookback_period: int = Field(gt=0, le=500)
    std_dev_multiplier: float = Field(gt=0, le=10)


class BacktestRequest(BaseModel):
    ticker: str = "AAPL"
    ma_lookback_period: int = Field(20, gt=0, le=500)
    std_dev_multiplier: float = Field(2.0, gt=0, le=10)


class ExecutionPayload(BaseModel):
    ticker: str
    action: str
    quantity: float = Field(gt=0)
    price: float = Field(gt=0)
    strategy: str = "Mean Reversion"


class TradeRequest(BaseModel):
    ticker: str
    action: str
    quantity: float = Field(gt=0)


# Single-user app, no auth system -- hardcoded so every note's byline is attached
# at the data layer for the planned PDF "tear sheet" export.
NOTE_AUTHOR = "Om Mehta"


class WatchlistSummaryRequest(BaseModel):
    tickers: List[str]


class WatchlistSummaryItem(BaseModel):
    ticker: str
    name: Optional[str]
    price: Optional[float]
    change_percent: Optional[float]
    fundamental_score: Optional[float]


def safe_round(value, digits=2):
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    return round(value, digits)


def _cache_fundamentals(db: Session, ticker: str, fundamentals: dict) -> None:
    """Persist name + fundamental_score onto an existing Watchlist row.

    Only updates tickers already on the watchlist -- viewing an arbitrary searched
    ticker's detail page should not silently add it to the watchlist. This is what
    lets POST /api/watchlist/summary read scores straight from the DB instead of
    re-hitting yfinance per ticker.
    """
    row = db.query(Watchlist).filter(Watchlist.ticker == ticker).first()
    if row is None:
        return
    row.name = fundamentals.get("name")
    row.fundamental_score = fundamentals.get("total_score")
    db.commit()


@app.get("/api/analyze/{ticker}")
def analyze(ticker: str, db: Session = Depends(get_db)):
    try:
        df = fetch_ohlcv(ticker.upper())
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PolygonRateLimitError as e:
        raise HTTPException(status_code=429, detail=str(e))

    metrics_df = calculate_metrics(df)
    latest = metrics_df.iloc[-1]
    fundamentals = calculate_fundamentals(ticker.upper())
    backtest = run_backtest(metrics_df)
    _cache_fundamentals(db, ticker.upper(), fundamentals)

    z_score = safe_round(latest["Z_Score_20"])
    fundamental_score = fundamentals["total_score"]
    hybrid_signal = generate_hybrid_signal(z_score or 0.0, fundamental_score)
    history = build_history(metrics_df)
    sparkline = build_sparkline(metrics_df)
    news = get_news(ticker.upper())
    fundamental_snapshot = get_fundamental_snapshot(ticker.upper())
    diagnostics = get_diagnostics(ticker.upper())

    return {
        "ticker": ticker.upper(),
        "date": metrics_df.index[-1].strftime("%Y-%m-%d"),
        "price": safe_round(latest["Close"]),
        "sma_50": safe_round(latest["SMA_50"]),
        "sma_200": safe_round(latest["SMA_200"]),
        "z_score": z_score,
        "trend": latest["Trend"],
        "fundamental_score": fundamental_score,
        "fundamental_breakdown": fundamentals["breakdown"],
        "hybrid_signal": hybrid_signal,
        "history": history,
        "sparkline": sparkline,
        "backtest": backtest,
        "news": news,
        "trailing_pe": safe_round(fundamental_snapshot["trailing_pe"]),
        "forward_pe": safe_round(fundamental_snapshot["forward_pe"]),
        "price_to_book": safe_round(fundamental_snapshot["price_to_book"]),
        # roe/operating_margin are raw fractions the frontend multiplies by 100 for
        # display, so they need more precision than the default 2 decimals to avoid
        # losing accuracy after that multiplication (e.g. 0.32275 -> 0.32 -> "32.00%").
        "roe": safe_round(fundamental_snapshot["roe"], digits=4),
        "operating_margin": safe_round(fundamental_snapshot["operating_margin"], digits=4),
        "rsi_14": safe_round(latest["RSI_14"]),
        # DuPont ROE decomposition + systematic health scores, real values from
        # FMP (see quant_metrics.get_diagnostics) -- net_profit_margin/
        # asset_turnover are raw fractions/ratios like roe/operating_margin
        # above, hence digits=4.
        "net_profit_margin": safe_round(diagnostics["net_profit_margin"], digits=4),
        "asset_turnover": safe_round(diagnostics["asset_turnover"], digits=4),
        "financial_leverage": safe_round(diagnostics["financial_leverage"], digits=4),
        "piotroski_score": safe_round(diagnostics["piotroski_score"], digits=0),
        "altman_z_score": safe_round(diagnostics["altman_z_score"]),
    }


@app.post("/api/watchlist/summary", response_model=List[WatchlistSummaryItem])
def watchlist_summary(body: WatchlistSummaryRequest, db: Session = Depends(get_db)):
    """Lightweight batch quotes for the dashboard grid.

    Deliberately skips the heavy per-ticker pipeline (SMAs, Wilder RSI, Z-score,
    nested news parsing) that GET /api/analyze/{ticker} runs -- that endpoint isn't
    safe to fan out to 50 tickers concurrently from the browser. Price + change come
    from Polygon's Grouped Daily endpoint (all US tickers for one trading day per
    call, see fetch_batch_quotes) -- typically 2 calls total regardless of ticker
    count, well within Polygon's 5-requests/minute free-tier cap. fundamental_score/
    name are read straight from the DB cache populated by GET /api/analyze/{ticker}.
    """
    tickers = [t.upper() for t in body.tickers]
    if not tickers:
        return []

    cached_rows = {
        row.ticker: row
        for row in db.query(Watchlist).filter(Watchlist.ticker.in_(tickers)).all()
    }
    try:
        quotes = fetch_batch_quotes(tickers)
    except PolygonRateLimitError as e:
        raise HTTPException(status_code=429, detail=str(e))

    results = []
    for ticker in tickers:
        row = cached_rows.get(ticker)
        quote = quotes.get(ticker, {})
        results.append(
            WatchlistSummaryItem(
                ticker=ticker,
                name=row.name if row else None,
                price=safe_round(quote.get("price")),
                change_percent=safe_round(quote.get("change_percent")),
                fundamental_score=row.fundamental_score if row else None,
            )
        )
    return results


@app.get("/api/news/sector")
def sector_news(sector: str):
    """News for a macro sector (Sector Intel page), not a specific ticker.

    `sector` is validated against SECTOR_NEWS_QUERIES (Technology/Finance/
    Healthcare/Energy) rather than relayed into the Google News RSS query
    unchecked -- this app has no legitimate use for arbitrary free-text here,
    so an allowlist is simpler and safer than trying to sanitize open input.
    """
    if sector not in SECTOR_NEWS_QUERIES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown sector '{sector}'. Expected one of: {', '.join(SECTOR_NEWS_QUERIES)}",
        )
    return get_news(sector=sector)


@app.get("/api/valuation/{ticker}")
def valuation(ticker: str):
    """Raw DCF inputs for the client-side Interactive Valuation tool,
    integrated into the stock tear sheet (`/stock/[ticker]`). The actual
    discounted-cash-flow math (WACC/terminal growth sliders, margin of
    safety) runs client-side against these four numbers plus the live price
    -- this endpoint only fetches and validates the real fundamentals, it
    never computes or returns a valuation itself.
    """
    return get_valuation_inputs(ticker.upper())


@app.get("/api/sentiment/{ticker}")
def sentiment(ticker: str):
    """VADER sentiment over the ticker's recent news headlines (FMP,
    Google-News-RSS fallback -- see get_news()). `available: False` means
    no news came back from either source, not an error.
    """
    return analyze_sentiment(ticker.upper())


@app.get("/api/options/pricing")
def options_pricing(
    S: float = Query(..., gt=0, description="Spot price"),
    K: float = Query(..., gt=0, description="Strike price"),
    T: float = Query(..., gt=0, le=30, description="Time to maturity, in years"),
    r: float = Query(0.042, ge=0, le=1, description="Risk-free rate, as a decimal"),
    sigma: float = Query(..., gt=0, le=5, description="Implied volatility, as a decimal"),
):
    """Black-Scholes theoretical call/put prices + Greeks. Pure math, no
    external data fetch -- safe to call on every slider movement.
    """
    return price_options(spot=S, strike=K, time_years=T, rate=r, volatility=sigma)


@app.get("/api/bot/positions")
def bot_positions():
    """Read-only: current open paper-trading positions from the Java
    execution engine's Alpaca account. Never places or modifies orders.
    """
    return get_bot_positions()


@app.get("/api/bot/pnl")
def bot_pnl():
    """Read-only: the execution engine's paper-account equity curve over the
    trailing 30 days.
    """
    return get_bot_pnl()


def _serialize_algo_config(config: AlgoConfig) -> dict:
    return {
        "ma_lookback_period": config.ma_lookback_period,
        "std_dev_multiplier": config.std_dev_multiplier,
        "updated_at": config.updated_at.isoformat() if config.updated_at else None,
    }


@app.get("/api/bot/config")
def get_bot_config(db: Session = Depends(get_db)):
    """Current tunable parameters for the execution engine's strategy.
    Singleton row, created with sane defaults on first read rather than
    requiring a separate seed step.
    """
    config = db.query(AlgoConfig).first()
    if config is None:
        config = AlgoConfig(ma_lookback_period=20, std_dev_multiplier=2.0)
        db.add(config)
        db.commit()
        db.refresh(config)
    return _serialize_algo_config(config)


@app.post("/api/bot/config")
def update_bot_config(body: AlgoConfigBody, db: Session = Depends(get_db)):
    """Persists new strategy parameters. This app has no channel to the Java
    engine itself -- it only writes the row here, so the update only takes
    effect if/however that engine is set up to poll this table.
    """
    config = db.query(AlgoConfig).first()
    now = datetime.now(timezone.utc)

    if config is None:
        config = AlgoConfig(
            ma_lookback_period=body.ma_lookback_period,
            std_dev_multiplier=body.std_dev_multiplier,
            updated_at=now,
        )
        db.add(config)
    else:
        config.ma_lookback_period = body.ma_lookback_period
        config.std_dev_multiplier = body.std_dev_multiplier
        config.updated_at = now

    db.commit()
    db.refresh(config)
    return _serialize_algo_config(config)


@app.post("/api/backtest")
def backtest(body: BacktestRequest):
    """Historical simulation of the Risk Controls' mean-reversion parameters
    against real Polygon OHLCV (~2 years on the free tier, same source and
    truncation behavior as /api/analyze/{ticker}). Lets a user try out
    ma_lookback_period/std_dev_multiplier changes against real price history
    before deciding whether to actually update the live config.
    """
    ticker = body.ticker.upper()

    try:
        df = fetch_ohlcv(ticker)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PolygonRateLimitError as e:
        raise HTTPException(status_code=429, detail=str(e))

    result = run_mean_reversion_backtest(
        df, body.ma_lookback_period, body.std_dev_multiplier
    )
    return {"ticker": ticker, **result}


def _serialize_execution(entry: ExecutionLedger) -> dict:
    return {
        "id": entry.id,
        "timestamp": entry.timestamp.isoformat() if entry.timestamp else None,
        "ticker": entry.ticker,
        "action": entry.action,
        "quantity": entry.quantity,
        "price": entry.price,
        "strategy": entry.strategy,
    }


@app.post("/api/webhooks/execute")
def webhook_execute(
    body: ExecutionPayload,
    x_bot_auth: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """Inbound trade-execution webhook for the Java execution engine. Requires
    the X-Bot-Auth header to match BOT_WEBHOOK_SECRET via a constant-time
    comparison (avoids leaking the secret's length/prefix through response
    timing) -- a missing/unset secret always rejects, it's never treated as
    "no auth required".
    """
    if not BOT_WEBHOOK_SECRET or not x_bot_auth or not secrets.compare_digest(
        x_bot_auth, BOT_WEBHOOK_SECRET
    ):
        raise HTTPException(status_code=401, detail="Unauthorized")

    action = body.action.strip().upper()
    if action not in ("BUY", "SELL"):
        raise HTTPException(status_code=422, detail="action must be 'BUY' or 'SELL'")

    entry = ExecutionLedger(
        timestamp=datetime.now(timezone.utc),
        ticker=body.ticker.upper(),
        action=action,
        quantity=body.quantity,
        price=body.price,
        strategy=body.strategy or "Mean Reversion",
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return _serialize_execution(entry)


@app.get("/api/bot/executions")
def bot_executions(db: Session = Depends(get_db)):
    """The 50 most recent trades the execution engine has reported via the
    webhook above, newest first.
    """
    rows = (
        db.query(ExecutionLedger)
        .order_by(ExecutionLedger.timestamp.desc())
        .limit(50)
        .all()
    )
    return [_serialize_execution(row) for row in rows]


@app.post("/api/broker/trade")
def broker_trade(body: TradeRequest, db: Session = Depends(get_db)):
    """Places a real market order against the configured Alpaca account
    (paper by default) and, on success, writes it into execution_ledger
    with strategy="Manual Override" so it appears in the Live Execution
    Ledger alongside trades the Java engine reports via the webhook.
    Alpaca failures (bad ticker, insufficient buying power, market closed
    for this order type, etc.) come back as a clean 400, not a 500.
    """
    action = body.action.strip().lower()
    if action not in ("buy", "sell"):
        raise HTTPException(status_code=422, detail="action must be 'buy' or 'sell'")

    try:
        order = execute_market_order(ticker=body.ticker, qty=body.quantity, side=action)
    except BrokerError as e:
        raise HTTPException(status_code=400, detail=str(e))

    entry = ExecutionLedger(
        timestamp=datetime.now(timezone.utc),
        ticker=order["ticker"],
        action=action.upper(),
        quantity=order["quantity"],
        price=order["price"],
        strategy="Manual Override",
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    return {"order": order, "ledger_entry": _serialize_execution(entry)}


@app.get("/api/watchlist")
def get_watchlist(db: Session = Depends(get_db)):
    rows = db.query(Watchlist).order_by(Watchlist.ticker).all()
    return [row.ticker for row in rows]


@app.get("/api/screener/volatility")
def screener_volatility(db: Session = Depends(get_db)):
    """Dashboard's volatility/mean-reversion screener over the current
    Watchlist. See screen_volatility() for the Polygon rate-limit handling --
    an empty watchlist here just means an empty `rows` list, not an error.
    """
    tickers = [row.ticker for row in db.query(Watchlist).order_by(Watchlist.ticker).all()]
    return screen_volatility(tickers)


@app.get("/api/portfolio/optimize")
def portfolio_optimize(db: Session = Depends(get_db)):
    """Markowitz mean-variance optimization (Max Sharpe / Min Volatility
    portfolios + an Efficient Frontier random-portfolio cloud) over the
    current Watchlist. See optimize_portfolio() for the Polygon rate-limit
    handling -- `available: False` covers both an empty/near-empty watchlist
    and a rate limit hit before 2 tickers could be fetched.
    """
    tickers = [row.ticker for row in db.query(Watchlist).order_by(Watchlist.ticker).all()]
    return optimize_portfolio(tickers)


@app.post("/api/watchlist/{ticker}")
def add_to_watchlist(ticker: str, db: Session = Depends(get_db)):
    ticker = ticker.upper()
    existing = db.query(Watchlist).filter(Watchlist.ticker == ticker).first()
    if not existing:
        db.add(Watchlist(ticker=ticker))
        db.commit()
    return {"ticker": ticker, "watchlisted": True}


@app.delete("/api/watchlist/{ticker}")
def remove_from_watchlist(ticker: str, db: Session = Depends(get_db)):
    ticker = ticker.upper()
    db.query(Watchlist).filter(Watchlist.ticker == ticker).delete()
    db.commit()
    return {"ticker": ticker, "watchlisted": False}


@app.get("/api/notes")
def get_all_notes(db: Session = Depends(get_db)):
    notes = db.query(ResearchNote).order_by(ResearchNote.updated_at.desc()).all()
    return [
        {
            "ticker": note.ticker,
            "content": note.content,
            "author": note.author,
            "updated_at": note.updated_at.isoformat() if note.updated_at else None,
        }
        for note in notes
    ]


@app.get("/api/notes/{ticker}")
def get_note(ticker: str, db: Session = Depends(get_db)):
    note = db.query(ResearchNote).filter(ResearchNote.ticker == ticker.upper()).first()
    if not note:
        return {"ticker": ticker.upper(), "content": None, "author": None, "updated_at": None}
    return {
        "ticker": note.ticker,
        "content": note.content,
        "author": note.author,
        "updated_at": note.updated_at.isoformat() if note.updated_at else None,
    }


@app.post("/api/notes/{ticker}")
def save_note(ticker: str, body: NoteBody, db: Session = Depends(get_db)):
    ticker = ticker.upper()
    note = db.query(ResearchNote).filter(ResearchNote.ticker == ticker).first()
    now = datetime.now(timezone.utc)

    if note:
        note.content = body.content
        note.author = NOTE_AUTHOR
        note.updated_at = now
    else:
        note = ResearchNote(
            ticker=ticker, content=body.content, author=NOTE_AUTHOR, updated_at=now
        )
        db.add(note)

    db.commit()
    return {
        "ticker": ticker,
        "content": body.content,
        "author": NOTE_AUTHOR,
        "updated_at": now.isoformat(),
    }


def _note_excerpt(content: str, max_len: int = 200) -> str:
    """Plain-text preview of a research note's markdown content, for the
    landing page's Recent Theses card. Strips a single leading '# Heading'
    line (the journal editor's own convention) rather than running a full
    markdown parser for a one-line preview. If the note is nothing but a
    heading (real case: an existing NVDA note is just "# Updated thesis"),
    falls back to the heading text itself instead of returning an empty
    excerpt -- still the founder's real words, not synthesized filler.
    """
    text = content.strip()
    lines = text.split("\n", 1)

    if lines[0].startswith("#"):
        heading = lines[0].lstrip("#").strip()
        body = lines[1].strip() if len(lines) > 1 else ""
        preview = body or heading
    else:
        preview = text

    if len(preview) <= max_len:
        return preview

    return preview[:max_len].rsplit(" ", 1)[0] + "…"


@app.get("/api/journal/recent")
def recent_theses(limit: int = 4, db: Session = Depends(get_db)):
    """Latest research notes for the landing page's Recent Theses grid.
    Real journal data only -- an empty list here means the page renders its
    own "no theses yet" state rather than falling back to mock content.
    """
    notes = (
        db.query(ResearchNote)
        .order_by(ResearchNote.updated_at.desc())
        .limit(limit)
        .all()
    )
    if not notes:
        return []

    tickers = [note.ticker for note in notes]
    names = {
        row.ticker: row.name
        for row in db.query(Watchlist).filter(Watchlist.ticker.in_(tickers)).all()
    }

    return [
        {
            "ticker": note.ticker,
            "name": names.get(note.ticker),
            "excerpt": _note_excerpt(note.content),
            "updated_at": note.updated_at.isoformat() if note.updated_at else None,
        }
        for note in notes
    ]
