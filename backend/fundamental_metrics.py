from fmp_client import fmp_get_first


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
    profile = fmp_get_first("profile", ticker)
    ratios = fmp_get_first("ratios-ttm", ticker)
    key_metrics = fmp_get_first("key-metrics-ttm", ticker)
    growth = fmp_get_first("financial-growth", ticker)

    revenue_growth_score = _score_higher_better(
        growth.get("revenueGrowth"), [(0.15, 12.5), (0.05, 8), (0, 4)]
    )
    earnings_growth_score = _score_higher_better(
        growth.get("epsgrowth"), [(0.15, 12.5), (0.05, 8), (0, 4)]
    )
    growth_score = revenue_growth_score + earnings_growth_score

    operating_margin_score = _score_higher_better(
        ratios.get("operatingProfitMarginTTM"), [(0.20, 12.5), (0.10, 8), (0.05, 4)]
    )
    roe_score = _score_higher_better(
        key_metrics.get("returnOnEquityTTM"), [(0.20, 12.5), (0.10, 8), (0.05, 4)]
    )
    profitability_score = operating_margin_score + roe_score

    current_ratio_score = _score_higher_better(
        ratios.get("currentRatioTTM"), [(2.0, 12.5), (1.5, 10), (1.0, 5)]
    )
    # FMP reports debtToEquityRatioTTM as a raw ratio (e.g. 0.5), but these
    # thresholds are calibrated to yfinance's old percentage-scaled convention
    # (e.g. 50 == 0.5 ratio) -- verified empirically that FMP's value is raw,
    # not pre-scaled -- so multiply by 100 to reuse the same threshold scale.
    debt_to_equity_ratio = ratios.get("debtToEquityRatioTTM")
    debt_to_equity_score = _score_lower_better(
        debt_to_equity_ratio * 100 if debt_to_equity_ratio is not None else None,
        [(50, 12.5), (100, 10), (200, 5)],
    )
    health_score = current_ratio_score + debt_to_equity_score

    pe_score = _score_lower_better(
        ratios.get("priceToEarningsRatioTTM"), [(15, 15), (25, 10), (35, 5)]
    )
    ps_score = _score_lower_better(
        ratios.get("priceToSalesRatioTTM"), [(2.0, 10), (5.0, 7), (10.0, 3)]
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
        "name": profile.get("companyName"),
    }
