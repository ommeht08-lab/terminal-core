import math
import os
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from typing import List, Optional

from alpaca_client import get_bot_pnl, get_bot_positions
from backtester import run_backtest
from data_engine import PolygonRateLimitError, fetch_batch_quotes, fetch_ohlcv
from database import ResearchNote, Watchlist, get_db, init_db
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
)

app = FastAPI(title="Quant Finance Model API")

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


class NoteBody(BaseModel):
    content: str


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
    """Raw DCF inputs for the client-side Interactive Valuation tool
    (`/ticker/[symbol]`). The actual discounted-cash-flow math (WACC/terminal
    growth sliders, margin of safety) runs client-side against these four
    numbers plus the live price -- this endpoint only fetches and validates
    the real fundamentals, it never computes or returns a valuation itself.
    """
    return get_valuation_inputs(ticker.upper())


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


@app.get("/api/watchlist")
def get_watchlist(db: Session = Depends(get_db)):
    rows = db.query(Watchlist).order_by(Watchlist.ticker).all()
    return [row.ticker for row in rows]


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
