"""Outbound Alpaca order execution (Phase 18) -- the write counterpart to
alpaca_client.py's read-only telemetry. This is the only module in this app
that places a trade; alpaca_client.py deliberately never does, by design,
since Phase 8. Base URL is pinned to the paper-trading endpoint by default
(the SDK's own default is live-trading, which rejects paper keys), same as
alpaca_client.py -- ALPACA_BASE_URL is only worth overriding to point at a
different environment.

Note on verification: every other external integration in this app has
been tested against the real live API during development. This one wasn't
-- placing a live order, even against a paper account, is still executing
a trade, which isn't something to do outside of the account holder's own
explicit action. The `submit_order`/`get_latest_trade` method signatures
below were verified via inspect.signature() against the real installed
SDK (no network call), and the Order/TradeV2 entity fields are Alpaca's
documented, stable API shapes -- but the actual request/response round
trip has not been exercised. Test the first live order yourself.
"""

import os
from typing import Optional

import alpaca_trade_api as tradeapi
from alpaca_trade_api.rest import APIError
from dotenv import load_dotenv

load_dotenv()

ALPACA_API_KEY = os.getenv("ALPACA_API_KEY")
ALPACA_SECRET_KEY = os.getenv("ALPACA_SECRET_KEY")
ALPACA_BASE_URL = os.getenv("ALPACA_BASE_URL", "https://paper-api.alpaca.markets")


class BrokerError(Exception):
    """Raised for any failure placing an order -- missing config, Alpaca
    rejecting the order (insufficient buying power, invalid/untradeable
    ticker, market closed for certain order types, etc.), or a network
    failure. Callers catch this and translate it to a clean 400-level HTTP
    response rather than a raw 500.
    """


def _get_client() -> Optional[tradeapi.REST]:
    if not ALPACA_API_KEY or not ALPACA_SECRET_KEY:
        return None
    return tradeapi.REST(ALPACA_API_KEY, ALPACA_SECRET_KEY, base_url=ALPACA_BASE_URL)


def execute_market_order(ticker: str, qty: float, side: str) -> dict:
    """Submit a market order (time_in_force='gtc'). Raises BrokerError on
    any failure rather than returning a partial/ambiguous result.

    `price` in the returned dict is the order's `filled_avg_price` if
    Alpaca filled it synchronously, otherwise the latest trade price for
    the symbol (Alpaca's own market data, queried only as a fallback) --
    never a fabricated or zero placeholder, since this value gets written
    straight into execution_ledger.
    """
    client = _get_client()
    if client is None:
        raise BrokerError("Alpaca isn't configured (ALPACA_API_KEY/ALPACA_SECRET_KEY unset).")

    symbol = ticker.upper()

    try:
        order = client.submit_order(
            symbol=symbol,
            qty=qty,
            side=side,
            type="market",
            time_in_force="gtc",
        )
    except APIError as exc:
        raise BrokerError(str(exc)) from exc
    except Exception as exc:
        raise BrokerError(f"Order submission failed: {exc}") from exc

    fill_price = getattr(order, "filled_avg_price", None)
    if fill_price is None:
        try:
            fill_price = client.get_latest_trade(symbol).price
        except Exception:
            fill_price = None

    if fill_price is None:
        raise BrokerError(
            f"Order {order.id} was submitted but no fill or reference price is "
            "available yet -- check its status in Alpaca before assuming it filled."
        )

    return {
        "order_id": order.id,
        "ticker": order.symbol,
        "side": order.side,
        "quantity": float(order.qty),
        "price": float(fill_price),
        "status": order.status,
        "submitted_at": order.submitted_at.isoformat() if order.submitted_at else None,
    }
