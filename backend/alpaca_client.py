"""Read-only Alpaca paper-trading client for the Algo Telemetry dashboard
(Phase 8). The actual trading logic lives in a separate Java execution
engine; this app only ever reads account state (positions, portfolio
history) from that engine's paper account -- it never places, modifies, or
cancels orders.

Base URL is pinned to the paper-trading endpoint, not alpaca-trade-api's
default (which is the *live* trading endpoint) -- paper keys are rejected
there, so getting this wrong would silently 401 instead of working.
"""

import os
from typing import Optional

import alpaca_trade_api as tradeapi
import pandas as pd
from alpaca_trade_api.rest import APIError
from dotenv import load_dotenv

load_dotenv()

ALPACA_API_KEY = os.getenv("ALPACA_API_KEY")
ALPACA_SECRET_KEY = os.getenv("ALPACA_SECRET_KEY")
ALPACA_BASE_URL = "https://paper-api.alpaca.markets"


def _get_client() -> Optional[tradeapi.REST]:
    if not ALPACA_API_KEY or not ALPACA_SECRET_KEY:
        return None
    return tradeapi.REST(ALPACA_API_KEY, ALPACA_SECRET_KEY, base_url=ALPACA_BASE_URL)


def _error_kind(exc: Exception) -> str:
    if isinstance(exc, APIError) and exc.status_code == 429:
        return "rate_limited"
    return "unavailable"


def get_bot_positions() -> dict:
    """Open paper-trading positions from the execution engine's Alpaca
    account. `configured: False` means no API keys are set (not an error --
    the telemetry dashboard just has nothing to show yet). `error` is set
    only when keys are present but the request itself failed, so the
    frontend can tell "not wired up" apart from "temporarily down".
    """
    client = _get_client()
    if client is None:
        return {"configured": False, "positions": [], "error": None}

    try:
        positions = client.list_positions()
    except Exception as exc:
        return {"configured": True, "positions": [], "error": _error_kind(exc)}

    return {
        "configured": True,
        "error": None,
        "positions": [
            {
                "ticker": p.symbol,
                "quantity": float(p.qty),
                "current_price": float(p.current_price),
                "unrealized_pl": float(p.unrealized_pl),
                "unrealized_plpc": float(p.unrealized_plpc),
                "market_value": float(p.market_value),
            }
            for p in positions
        ],
    }


def get_bot_pnl() -> dict:
    """Equity curve for the trailing 30 days, from Alpaca's portfolio-history
    endpoint. Same configured/error envelope as get_bot_positions().
    """
    client = _get_client()
    if client is None:
        return {"configured": False, "equity_curve": [], "error": None}

    try:
        history = client.get_portfolio_history(period="30D", timeframe="1D")
    except Exception as exc:
        return {"configured": True, "equity_curve": [], "error": _error_kind(exc)}

    df = history.df.reset_index()

    def _clean(value):
        return None if pd.isna(value) else float(value)

    return {
        "configured": True,
        "error": None,
        "equity_curve": [
            {
                "date": row["timestamp"].strftime("%Y-%m-%d"),
                "equity": _clean(row["equity"]),
                "profit_loss": _clean(row["profit_loss"]),
                "profit_loss_pct": _clean(row["profit_loss_pct"]),
            }
            for _, row in df.iterrows()
        ],
    }
