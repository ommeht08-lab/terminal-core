from datetime import datetime

import pandas as pd

from fmp_client import fmp_get, fmp_get_first


def calculate_rsi(close: pd.Series, period: int = 14) -> pd.Series:
    """Standard Wilder's RSI: exponential smoothing of average gains/losses over `period`."""
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)

    avg_gain = gain.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()

    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))

    # No losses in the window means maximally overbought (RSI = 100) by convention,
    # rather than the division-by-zero NaN/inf that avg_gain / 0 would otherwise produce.
    rsi = rsi.where(avg_loss != 0, 100)

    return rsi


def calculate_metrics(df: pd.DataFrame) -> pd.DataFrame:
    """Calculate 50/200-day SMAs, 20-day rolling Z-score, 14-day RSI, and trend classification on Close price."""
    out = df.copy()

    out["SMA_50"] = out["Close"].rolling(window=50).mean()
    out["SMA_200"] = out["Close"].rolling(window=200).mean()

    rolling_mean_20 = out["Close"].rolling(window=20).mean()
    rolling_std_20 = out["Close"].rolling(window=20).std()
    out["Z_Score_20"] = (out["Close"] - rolling_mean_20) / rolling_std_20

    out["RSI_14"] = calculate_rsi(out["Close"], period=14)

    def classify_trend(row: pd.Series) -> str:
        price, sma50, sma200 = row["Close"], row["SMA_50"], row["SMA_200"]
        if pd.isna(sma50) or pd.isna(sma200):
            return "Neutral"
        if price > sma50 > sma200:
            return "Bullish"
        if price < sma50 < sma200:
            return "Bearish"
        return "Neutral"

    out["Trend"] = out.apply(classify_trend, axis=1)

    return out


def _safe_float(value):
    return None if pd.isna(value) else float(value)


def build_history(metrics_df: pd.DataFrame, days: int = 1260) -> list[dict]:
    """Build a JSON-safe time-series of Close/SMA_50/SMA_200/Volume for the last `days` trading days.

    Defaults to ~5 years (252 trading days/year) so frontend timeframe toggles up to 5Y have real data.
    """
    recent = metrics_df.tail(days)

    return [
        {
            "date": date.strftime("%Y-%m-%d"),
            "close": _safe_float(row["Close"]),
            "sma_50": _safe_float(row["SMA_50"]),
            "sma_200": _safe_float(row["SMA_200"]),
            "volume": _safe_float(row["Volume"]),
        }
        for date, row in recent.iterrows()
    ]


def build_sparkline(metrics_df: pd.DataFrame, days: int = 30) -> list[float]:
    """Last `days` closing prices as a JSON-safe list of floats, for a mini trend sparkline."""
    if metrics_df.empty:
        return []
    return [float(v) for v in metrics_df["Close"].tail(days) if not pd.isna(v)]


def get_fundamental_snapshot(ticker: str) -> dict:
    """Fetch trailing/forward P/E, price-to-book, ROE, and operating margin via FMP.

    forward_pe has no accessible equivalent on this FMP plan (no forward-estimate
    endpoint reachable with this key) -- verified empirically, not assumed -- so it
    is always None here; the frontend already renders null as "N/A".
    """
    ratios = fmp_get_first("ratios-ttm", ticker)
    key_metrics = fmp_get_first("key-metrics-ttm", ticker)

    return {
        "trailing_pe": _safe_float(ratios.get("priceToEarningsRatioTTM")),
        "forward_pe": None,
        "price_to_book": _safe_float(ratios.get("priceToBookRatioTTM")),
        "roe": _safe_float(key_metrics.get("returnOnEquityTTM")),
        "operating_margin": _safe_float(ratios.get("operatingProfitMarginTTM")),
    }


def get_news(ticker: str, limit: int = 5) -> list[dict]:
    """Fetch recent news headlines for a ticker via FMP.

    FMP's news endpoint (/stable/news/stock) returns HTTP 402 "Restricted
    Endpoint" on the free tier this key is on -- confirmed against the live API,
    not assumed -- so fmp_get() returns [] and this degrades to no articles
    rather than erroring. The field-mapping below (title/publishedDate/site/url)
    follows FMP's documented shape for when the endpoint becomes reachable, but
    could not be verified against a real response since the plan blocks it.
    """
    raw_news = fmp_get("news/stock", {"symbols": ticker.upper(), "limit": limit})[:limit]

    articles = []
    for item in raw_news:
        title = item.get("title")
        link = item.get("url")

        if not title or not link:
            continue

        publisher = item.get("site") or item.get("publisher") or "Unknown"

        time_str = None
        pub_date = item.get("publishedDate")
        if pub_date:
            try:
                parsed = datetime.strptime(pub_date, "%Y-%m-%d %H:%M:%S")
                time_str = parsed.strftime("%b %d, %Y, %I:%M %p")
            except ValueError:
                time_str = pub_date

        articles.append(
            {
                "title": title,
                "publisher": publisher,
                "time": time_str,
                "link": link,
            }
        )

    return articles
