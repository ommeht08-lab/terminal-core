"""Black-Scholes European options pricing + Greeks (Phase 17).

Standard closed-form Black-Scholes-Merton on a non-dividend-paying
underlying -- this doesn't model dividends, early exercise, or other
American-style features. Pure math with no external data fetch and no rate
limits, so it's safe to call on every slider movement from the frontend.

Formulas verified against the standard Hull textbook reference case
(S=100, K=100, T=1, r=0.05, sigma=0.2 -> Call 10.4506 / Put 5.5735, Delta
0.6368 / Gamma 0.0188 / Vega 0.3752 (per 1% vol) / Theta -0.0176/day /
Rho 0.5323 (per 1% rate)) before being wired into the API.

Theta is reported per calendar day and Vega/Rho per 1% change in
volatility/rate -- standard trading-desk conventions, not the raw
per-year/per-unit derivatives, which are far less intuitive to read.
"""

from math import exp, log, sqrt

from scipy.stats import norm


def _d1_d2(spot: float, strike: float, time_years: float, rate: float, volatility: float):
    sqrt_t = sqrt(time_years)
    d1 = (log(spot / strike) + (rate + 0.5 * volatility**2) * time_years) / (
        volatility * sqrt_t
    )
    d2 = d1 - volatility * sqrt_t
    return d1, d2


def price_options(
    spot: float, strike: float, time_years: float, rate: float, volatility: float
) -> dict:
    """Theoretical call/put prices and Greeks for the given inputs."""
    d1, d2 = _d1_d2(spot, strike, time_years, rate, volatility)
    sqrt_t = sqrt(time_years)
    discount_factor = exp(-rate * time_years)
    discounted_strike = strike * discount_factor

    call_price = spot * norm.cdf(d1) - discounted_strike * norm.cdf(d2)
    put_price = discounted_strike * norm.cdf(-d2) - spot * norm.cdf(-d1)

    delta_call = norm.cdf(d1)
    delta_put = delta_call - 1.0

    # Identical for calls and puts.
    gamma = norm.pdf(d1) / (spot * volatility * sqrt_t)
    vega = (spot * norm.pdf(d1) * sqrt_t) / 100.0

    theta_call = (
        -(spot * norm.pdf(d1) * volatility) / (2 * sqrt_t)
        - rate * discounted_strike * norm.cdf(d2)
    ) / 365.0
    theta_put = (
        -(spot * norm.pdf(d1) * volatility) / (2 * sqrt_t)
        + rate * discounted_strike * norm.cdf(-d2)
    ) / 365.0

    rho_call = (strike * time_years * discount_factor * norm.cdf(d2)) / 100.0
    rho_put = -(strike * time_years * discount_factor * norm.cdf(-d2)) / 100.0

    return {
        "call": {
            "price": round(call_price, 4),
            "delta": round(delta_call, 4),
            "gamma": round(gamma, 6),
            "theta": round(theta_call, 4),
            "vega": round(vega, 4),
            "rho": round(rho_call, 4),
        },
        "put": {
            "price": round(put_price, 4),
            "delta": round(delta_put, 4),
            "gamma": round(gamma, 6),
            "theta": round(theta_put, 4),
            "vega": round(vega, 4),
            "rho": round(rho_put, 4),
        },
        "inputs": {
            "spot": spot,
            "strike": strike,
            "time_years": round(time_years, 6),
            "rate": rate,
            "volatility": volatility,
        },
    }
