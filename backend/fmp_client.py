"""Shared Financial Modeling Prep HTTP client.

FMP's old /api/v3/ paths are fully deprecated for non-legacy accounts (verified
empirically: they now return a 402-style "Legacy Endpoint" error regardless of
the requested resource). The current base is /stable/. News endpoints
(/stable/news/*) return HTTP 402 "Restricted Endpoint" on the free tier --
confirmed against the real API, not assumed -- so get_news() degrades to an
empty list rather than erroring.
"""

import os

import requests
from dotenv import load_dotenv

load_dotenv()

FMP_API_KEY = os.getenv("FMP_API_KEY")
FMP_BASE_URL = "https://financialmodelingprep.com/stable"


def fmp_get(path: str, params: dict) -> list:
    """GET a /stable/{path} endpoint. Returns [] on any failure -- missing
    ticker, restricted endpoint, a specific ticker outside this plan's allowed
    universe (confirmed empirically: e.g. AAPL/MSFT/NVDA work on ratios-ttm,
    but BRK-B/LIN 402 with "this value set for 'symbol' is not available under
    your current subscription" -- not predictable from the ticker itself), or
    a network error -- rather than raising. Callers treat a missing metric as
    an absent field, same as the yfinance .info.get() pattern this replaces.
    Note this means calculate_fundamentals() silently scores 0/100 for a
    restricted ticker rather than distinguishing "no data" from "bad
    fundamentals" -- pre-existing behavior of the scoring function, not
    something this migration changed, but worth knowing since FMP's free tier
    has broader ticker gaps than yfinance did.
    """
    request_params = dict(params)
    request_params["apikey"] = FMP_API_KEY

    try:
        response = requests.get(f"{FMP_BASE_URL}/{path}", params=request_params, timeout=15)
        response.raise_for_status()
        data = response.json()
    except requests.RequestException:
        return []

    return data if isinstance(data, list) else []


def fmp_get_first(path: str, symbol: str) -> dict:
    """Convenience wrapper for the common case: /stable/{path}?symbol={symbol}
    endpoints that return a single-element array (profile, ratios-ttm, etc).
    """
    results = fmp_get(path, {"symbol": symbol.upper()})
    return results[0] if results else {}
