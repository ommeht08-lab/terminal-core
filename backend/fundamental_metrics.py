import yfinance as yf


def _score_higher_better(value, thresholds):
    """thresholds: list of (min_exclusive_bound, points) ordered highest bound first."""
    if value is None:
        return 0
    for bound, points in thresholds:
        if value > bound:
            return points
    return 0


def _score_lower_better(value, thresholds):
    """thresholds: list of (max_exclusive_bound, points) ordered lowest bound first."""
    if value is None:
        return 0
    for bound, points in thresholds:
        if value < bound:
            return points
    return 0


def calculate_fundamentals(ticker: str) -> dict:
    info = yf.Ticker(ticker).info

    revenue_growth_score = _score_higher_better(
        info.get("revenueGrowth"), [(0.15, 12.5), (0.05, 8), (0, 4)]
    )
    earnings_growth_score = _score_higher_better(
        info.get("earningsGrowth"), [(0.15, 12.5), (0.05, 8), (0, 4)]
    )
    growth_score = revenue_growth_score + earnings_growth_score

    operating_margin_score = _score_higher_better(
        info.get("operatingMargins"), [(0.20, 12.5), (0.10, 8), (0.05, 4)]
    )
    roe_score = _score_higher_better(
        info.get("returnOnEquity"), [(0.20, 12.5), (0.10, 8), (0.05, 4)]
    )
    profitability_score = operating_margin_score + roe_score

    current_ratio_score = _score_higher_better(
        info.get("currentRatio"), [(2.0, 12.5), (1.5, 10), (1.0, 5)]
    )
    # yfinance reports debtToEquity as a percentage (e.g. 50 == 0.5 ratio).
    debt_to_equity_score = _score_lower_better(
        info.get("debtToEquity"), [(50, 12.5), (100, 10), (200, 5)]
    )
    health_score = current_ratio_score + debt_to_equity_score

    pe_score = _score_lower_better(
        info.get("trailingPE"), [(15, 15), (25, 10), (35, 5)]
    )
    ps_score = _score_lower_better(
        info.get("priceToSalesTrailing12Months"), [(2.0, 10), (5.0, 7), (10.0, 3)]
    )
    valuation_score = pe_score + ps_score

    total_score = growth_score + profitability_score + health_score + valuation_score

    return {
        "total_score": total_score,
        "breakdown": {
            "Growth": growth_score,
            "Profitability": profitability_score,
            "Health": health_score,
            "Valuation": valuation_score,
        },
        # Free to include: `info` is already fetched above for scoring, so this adds
        # no extra yfinance call. Lets callers cache a display name alongside the score.
        "name": info.get("shortName") or info.get("longName"),
    }
