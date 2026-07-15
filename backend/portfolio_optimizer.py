"""Modern Portfolio Theory optimization for the Dashboard's "Optimal Asset
Allocation" section (Phase 14). Computes the Maximum Sharpe Ratio (tangency)
and Minimum Volatility portfolios via scipy.optimize, plus a cloud of random
long-only portfolios for the Efficient Frontier scatter plot.

Polygon's free tier hard-caps at 5 requests/minute (confirmed repeatedly
elsewhere in this app -- data_engine.py, quant_metrics.screen_volatility),
and this endpoint costs one Polygon call per ticker to pull each asset's
own price history. Optimizing the full watchlist in a single request is
unworkable for any watchlist larger than ~5 tickers on this plan. Like the
volatility screener, this stops at the first PolygonRateLimitError and
optimizes over whatever tickers it already fetched -- an honest partial
result, flagged as such -- rather than blocking for minutes or refusing to
run at all.
"""

import numpy as np
import pandas as pd
import requests
from scipy.optimize import minimize

from data_engine import PolygonRateLimitError, fetch_recent_ohlcv

TRADING_DAYS_PER_YEAR = 252
RANDOM_PORTFOLIO_COUNT = 150
RISK_FREE_RATE = 0.04


def _fetch_price_matrix(tickers: list[str]) -> tuple[pd.DataFrame, bool]:
    """Daily closing prices for as many tickers as the Polygon rate limit
    allows (~2 calendar years each), aligned to their shared trading-day
    index. A ticker with fewer than 30 returned rows is dropped rather than
    included with a mostly-empty series. Returns (price_df, rate_limited).
    """
    series_by_ticker = {}
    rate_limited = False

    for ticker in tickers:
        try:
            df = fetch_recent_ohlcv(ticker, calendar_days=730)
        except PolygonRateLimitError:
            rate_limited = True
            break
        except (ValueError, requests.RequestException):
            continue

        if len(df) >= 30:
            series_by_ticker[ticker] = df["Close"]

    if not series_by_ticker:
        return pd.DataFrame(), rate_limited

    # dropna() keeps only the dates every fetched ticker actually traded on --
    # required for a coherent covariance matrix across misaligned data gaps.
    price_df = pd.DataFrame(series_by_ticker).dropna()
    return price_df, rate_limited


def _portfolio_stats(
    weights: np.ndarray, mean_returns: np.ndarray, cov_matrix: np.ndarray
) -> tuple[float, float, float]:
    port_return = float(np.dot(weights, mean_returns))
    port_vol = float(np.sqrt(np.dot(weights.T, np.dot(cov_matrix, weights))))
    sharpe = (port_return - RISK_FREE_RATE) / port_vol if port_vol > 0 else 0.0
    return port_return, port_vol, sharpe


def _negative_sharpe(weights, mean_returns, cov_matrix) -> float:
    _, _, sharpe = _portfolio_stats(weights, mean_returns, cov_matrix)
    return -sharpe


def _volatility(weights, mean_returns, cov_matrix) -> float:
    _, vol, _ = _portfolio_stats(weights, mean_returns, cov_matrix)
    return vol


def _optimize(mean_returns: np.ndarray, cov_matrix: np.ndarray, objective) -> np.ndarray:
    """Long-only, fully-invested optimum (weights in [0, 1], sum to 1) via
    SLSQP -- standard for this class of constrained, smooth objective.
    """
    n = len(mean_returns)
    bounds = tuple((0.0, 1.0) for _ in range(n))
    constraints = ({"type": "eq", "fun": lambda w: np.sum(w) - 1.0},)
    initial_guess = np.repeat(1.0 / n, n)

    result = minimize(
        objective,
        initial_guess,
        args=(mean_returns, cov_matrix),
        method="SLSQP",
        bounds=bounds,
        constraints=constraints,
    )
    # Falls back to the equal-weight starting point if SLSQP fails to
    # converge, rather than returning a solver's possibly-invalid partial
    # iterate as if it were a real optimum.
    return result.x if result.success else initial_guess


def _serialize_portfolio(
    weights: np.ndarray,
    tickers_used: list[str],
    mean_returns: np.ndarray,
    cov_matrix: np.ndarray,
) -> dict:
    ret, vol, sharpe = _portfolio_stats(weights, mean_returns, cov_matrix)
    return {
        "expected_return": round(ret * 100, 2),
        "volatility": round(vol * 100, 2),
        "sharpe_ratio": round(sharpe, 2),
        "weights": {
            ticker: round(float(w) * 100, 2) for ticker, w in zip(tickers_used, weights)
        },
    }


def optimize_portfolio(tickers: list[str]) -> dict:
    """Full response envelope for GET /api/portfolio/optimize.
    `available: False` covers both the empty-watchlist case and the case
    where the rate limit was hit before 2 tickers -- the minimum needed for
    a covariance matrix -- could be fetched.
    """
    price_df, rate_limited = _fetch_price_matrix(tickers)
    tickers_used = list(price_df.columns)

    if len(tickers_used) < 2:
        return {
            "available": False,
            "reason": "rate_limited" if rate_limited else "insufficient_tickers",
            "tickers_used": tickers_used,
            "requested_count": len(tickers),
            "rate_limited": rate_limited,
            "max_sharpe_portfolio": None,
            "min_volatility_portfolio": None,
            "random_portfolios": [],
        }

    daily_returns = price_df.pct_change().dropna()
    mean_returns = daily_returns.mean().to_numpy() * TRADING_DAYS_PER_YEAR
    cov_matrix = daily_returns.cov().to_numpy() * TRADING_DAYS_PER_YEAR

    max_sharpe_weights = _optimize(mean_returns, cov_matrix, _negative_sharpe)
    min_vol_weights = _optimize(mean_returns, cov_matrix, _volatility)

    rng = np.random.default_rng()
    random_portfolios = []
    for _ in range(RANDOM_PORTFOLIO_COUNT):
        weights = rng.dirichlet(np.ones(len(tickers_used)))
        ret, vol, sharpe = _portfolio_stats(weights, mean_returns, cov_matrix)
        random_portfolios.append(
            {
                "return": round(ret * 100, 2),
                "volatility": round(vol * 100, 2),
                "sharpe_ratio": round(sharpe, 2),
            }
        )

    return {
        "available": True,
        "reason": None,
        "tickers_used": tickers_used,
        "requested_count": len(tickers),
        "rate_limited": rate_limited,
        "max_sharpe_portfolio": _serialize_portfolio(
            max_sharpe_weights, tickers_used, mean_returns, cov_matrix
        ),
        "min_volatility_portfolio": _serialize_portfolio(
            min_vol_weights, tickers_used, mean_returns, cov_matrix
        ),
        "random_portfolios": random_portfolios,
    }
