import os
from datetime import date, timedelta
from typing import Optional

import pandas as pd
import requests
from dotenv import load_dotenv

load_dotenv()

POLYGON_API_KEY = os.getenv("POLYGON_API_KEY")
POLYGON_BASE_URL = "https://api.polygon.io"

# Empirically verified against the real API: free-tier keys are capped at 5
# requests/minute (a 6th request within the window returns HTTP 429), and a
# 5-year history request silently truncates to roughly the most recent 2 years
# of daily bars regardless of the requested range.
MAX_GROUPED_DAY_LOOKBACK = 8


class PolygonRateLimitError(RuntimeError):
    """Raised when Polygon returns HTTP 429 (free tier: 5 requests/minute)."""


def _to_polygon_ticker(ticker: str) -> str:
    """This app's DB/frontend use yfinance's dash convention for share classes
    (e.g. BRK-B), but Polygon uses dot notation (BRK.B) -- confirmed via
    Polygon's own ticker search (FMP, by contrast, already uses dash, so no
    conversion is needed there). Only applied at the Polygon request boundary.
    """
    return ticker.upper().replace("-", ".")


def _from_polygon_ticker(polygon_ticker: str) -> str:
    return polygon_ticker.upper().replace(".", "-")


def _polygon_get(path: str, params: Optional[dict] = None) -> dict:
    request_params = dict(params or {})
    request_params["apiKey"] = POLYGON_API_KEY
    response = requests.get(f"{POLYGON_BASE_URL}{path}", params=request_params, timeout=15)

    if response.status_code == 429:
        raise PolygonRateLimitError(
            "Polygon rate limit exceeded (free tier allows 5 requests/minute)"
        )
    response.raise_for_status()
    return response.json()


def fetch_ohlcv(ticker: str) -> pd.DataFrame:
    """Fetch daily OHLCV history for a ticker via Polygon Aggregates (Bars).

    Requests 5 years but the free tier only actually returns ~2 years of bars
    (verified empirically) -- still comfortably covers the 200-day SMA and RSI/
    Z-score windows calculate_metrics() needs.
    """
    end = date.today()
    start = end - timedelta(days=5 * 365)

    data = _polygon_get(
        f"/v2/aggs/ticker/{_to_polygon_ticker(ticker)}/range/1/day/{start.isoformat()}/{end.isoformat()}",
        {"adjusted": "true", "sort": "asc", "limit": 50000},
    )

    results = data.get("results") or []
    if not results:
        raise ValueError(f"No data returned for ticker '{ticker}'")

    df = pd.DataFrame(results)
    df["Date"] = pd.to_datetime(df["t"], unit="ms", utc=True).dt.tz_convert(None)
    df = df.rename(
        columns={"o": "Open", "h": "High", "l": "Low", "c": "Close", "v": "Volume"}
    )
    df = df.set_index("Date")[["Open", "High", "Low", "Close", "Volume"]].dropna()

    return df


def _fetch_grouped_day(day: date) -> dict[str, dict]:
    """Every US ticker's OHLCV for a single trading day, keyed by ticker symbol.

    Returns {} for any date with no usable data -- non-trading days (weekends/
    holidays) respond 200 OK with resultsCount=0 (verified empirically), and
    requesting *today* specifically returns HTTP 403 NOT_AUTHORIZED on the free
    tier ("Attempted to request today's data before end of day. Please upgrade
    your plan") -- also verified empirically. Both cases are treated the same
    way: no data for this date, caller should try the previous day. A genuine
    rate-limit (429) is a different failure mode and is allowed to propagate
    as PolygonRateLimitError rather than being swallowed here.
    """
    try:
        data = _polygon_get(
            f"/v2/aggs/grouped/locale/us/market/stocks/{day.isoformat()}", {"adjusted": "true"}
        )
    except PolygonRateLimitError:
        raise
    except requests.HTTPError:
        return {}
    return {_from_polygon_ticker(row["T"]): row for row in (data.get("results") or [])}


def fetch_batch_quotes(tickers: list[str]) -> dict[str, dict]:
    """Fetch current price + 1-day % change for many tickers.

    Uses Polygon's Grouped Daily endpoint (all ~12k US tickers for one trading
    day in a single API call) instead of one request per ticker: the free
    tier's 5 requests/minute cap makes per-ticker calls unworkable for a
    50-ticker watchlist. Starts from yesterday, not today -- today's grouped
    data is always rejected on the free tier (see _fetch_grouped_day), so
    probing it would waste a call on every single invocation. Walks backward
    from there to find the two most recent trading days, since weekends/
    holidays return no results.
    """
    if not tickers:
        return {}

    tickers_upper = [t.upper() for t in tickers]

    trading_days: list[dict[str, dict]] = []
    probe_date = date.today() - timedelta(days=1)
    for _ in range(MAX_GROUPED_DAY_LOOKBACK):
        if len(trading_days) >= 2:
            break
        day_data = _fetch_grouped_day(probe_date)
        if day_data:
            trading_days.append(day_data)
        probe_date -= timedelta(days=1)

    latest = trading_days[0] if len(trading_days) >= 1 else {}
    previous = trading_days[1] if len(trading_days) >= 2 else {}

    quotes: dict[str, dict] = {}
    for ticker in tickers_upper:
        latest_row = latest.get(ticker)
        if latest_row is None:
            quotes[ticker] = {"price": None, "change_percent": None}
            continue

        price = float(latest_row["c"])
        change_percent = None
        prev_row = previous.get(ticker)
        if prev_row is not None:
            prev_close = float(prev_row["c"])
            if prev_close:
                change_percent = (price - prev_close) / prev_close * 100

        quotes[ticker] = {"price": price, "change_percent": change_percent}

    return quotes
