import xml.etree.ElementTree as ET
from datetime import datetime
from email.utils import parsedate_to_datetime
from typing import Optional

import pandas as pd
import requests

from fmp_client import fmp_get, fmp_get_first

GOOGLE_NEWS_RSS_URL = "https://news.google.com/rss/search"

# Sector names accepted by get_news(sector=...) / GET /api/news/sector -- kept
# as an explicit allowlist (validated in main.py, the actual request boundary)
# rather than relaying arbitrary caller-supplied text into a Google search
# query, since this app has no other use for free-text sector input.
SECTOR_NEWS_QUERIES = {
    "Technology": "Technology sector market",
    "Finance": "Finance sector market",
    "Healthcare": "Healthcare sector market",
    "Energy": "Energy sector market",
}


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


def get_diagnostics(ticker: str) -> dict:
    """DuPont ROE decomposition + Piotroski/Altman scores, sourced entirely
    from FMP's real ratios-ttm/key-metrics-ttm/financial-scores endpoints --
    no synthesized or estimated values. financial-scores has the same
    per-ticker restriction as other FMP endpoints on this plan (confirmed
    empirically: works for AAPL/MSFT, HTTP 402s for BRK-B/LIN), so all fields
    gracefully null rather than approximating when unavailable.

    Note: net_profit_margin * asset_turnover * financial_leverage will not
    always exactly reconcile to roe -- confirmed empirically (e.g. MSFT:
    0.393 * 0.458 * 1.675 = 0.302 vs reported ROE 0.331) -- because FMP
    computes these TTM ratios with slightly different period-averaging
    methodologies across endpoints. Reporting the real components as-is
    rather than forcing one to match, since adjusting a value just to make
    the arithmetic look clean would itself be a form of fabrication.
    """
    ratios = fmp_get_first("ratios-ttm", ticker)
    key_metrics = fmp_get_first("key-metrics-ttm", ticker)
    scores = fmp_get_first("financial-scores", ticker)

    return {
        "net_profit_margin": _safe_float(ratios.get("netProfitMarginTTM")),
        "asset_turnover": _safe_float(ratios.get("assetTurnoverTTM")),
        "financial_leverage": _safe_float(ratios.get("financialLeverageRatioTTM")),
        "roe": _safe_float(key_metrics.get("returnOnEquityTTM")),
        "piotroski_score": _safe_float(scores.get("piotroskiScore")),
        "altman_z_score": _safe_float(scores.get("altmanZScore")),
    }


def _parse_google_news_rss(query: str, limit: int) -> list[dict]:
    """Fallback news source: Google News' public RSS search feed, no API key
    needed. `query` is a pre-built search string (e.g. "AAPL stock" or
    "Technology sector market") -- callers own query construction so this
    stays a generic RSS-fetch-and-parse helper. Verified empirically against a
    real response, not assumed:
    - <item><title> is formatted "Headline - Publisher", redundant with the
      separate <source> element, so the " - Publisher" suffix is stripped.
    - <link> is a Google News redirect URL (news.google.com/rss/articles/...),
      not the direct publisher URL -- still a valid, clickable link, just an
      extra hop; decoding the real destination would require following the
      redirect server-side, not worth the added latency/fragility here.
    - <pubDate> is RFC 822 (e.g. "Mon, 13 Jul 2026 18:29:00 GMT"), parsed with
      email.utils rather than a fixed strptime pattern since RSS feeds aren't
      guaranteed perfectly uniform.
    Any failure (network error, malformed XML, unexpected structure) returns
    [] rather than raising, so a bad feed never crashes the request.
    """
    try:
        response = requests.get(
            GOOGLE_NEWS_RSS_URL,
            params={"q": query, "hl": "en-US", "gl": "US", "ceid": "US:en"},
            timeout=10,
        )
        response.raise_for_status()
        root = ET.fromstring(response.content)
    except (requests.RequestException, ET.ParseError):
        return []

    articles = []
    for item in root.findall("./channel/item")[:limit]:
        title_el = item.find("title")
        link_el = item.find("link")
        source_el = item.find("source")
        pubdate_el = item.find("pubDate")

        title = title_el.text if title_el is not None else None
        link = link_el.text if link_el is not None else None

        if not title or not link:
            continue

        publisher = (
            source_el.text if source_el is not None and source_el.text else "Unknown"
        )

        suffix = f" - {publisher}"
        if publisher != "Unknown" and title.endswith(suffix):
            title = title[: -len(suffix)]

        time_str = None
        if pubdate_el is not None and pubdate_el.text:
            try:
                parsed = parsedate_to_datetime(pubdate_el.text)
                time_str = parsed.strftime("%b %d, %Y, %I:%M %p")
            except (TypeError, ValueError):
                time_str = pubdate_el.text

        articles.append(
            {"title": title, "publisher": publisher, "time": time_str, "link": link}
        )

    return articles


def get_news(
    ticker: Optional[str] = None, sector: Optional[str] = None, limit: int = 5
) -> list[dict]:
    """Fetch recent news headlines for either a ticker or a macro sector.

    Exactly one of ticker/sector should be given; returns [] if neither is
    provided rather than guessing. Ticker requests try FMP first (its
    /stable/news/stock endpoint returns HTTP 402 "Restricted Endpoint" on the
    free tier this key is on -- confirmed against the live API, not assumed --
    so fmp_get() returns [] here today; kept as the first attempt in case the
    plan is upgraded). FMP has no sector-level news endpoint, so sector
    requests go straight to Google News RSS. Both paths ultimately fall back
    to _parse_google_news_rss, which degrades to [] on any failure rather than
    raising -- callers never need to handle an exception from this function.
    """
    if ticker:
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

        if articles:
            return articles

        return _parse_google_news_rss(f"{ticker} stock", limit)

    if sector:
        query = SECTOR_NEWS_QUERIES.get(sector, f"{sector} sector market")
        return _parse_google_news_rss(query, limit)

    return []
