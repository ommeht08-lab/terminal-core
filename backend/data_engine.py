import pandas as pd
import yfinance as yf

from yf_session import YF_SESSION


def fetch_ohlcv(ticker: str) -> pd.DataFrame:
    """Fetch 5 years of daily OHLCV data for a ticker and return a cleaned DataFrame."""
    df = yf.Ticker(ticker, session=YF_SESSION).history(
        period="5y", interval="1d", auto_adjust=False
    )

    if df.empty:
        raise ValueError(f"No data returned for ticker '{ticker}'")

    df = df[["Open", "High", "Low", "Close", "Volume"]].dropna()
    df.index.name = "Date"

    return df


def fetch_batch_quotes(tickers: list[str]) -> dict[str, dict]:
    """Fetch current price + 1-day % change for many tickers in one batched request.

    Uses yf.download(group_by="ticker") instead of loop-instantiating yf.Ticker per
    symbol, so N tickers cost one network round trip instead of N. Note: in the
    installed yfinance version, group_by="ticker" always yields a (Ticker, Price)
    MultiIndex on df.columns, even for a single ticker — verified empirically, so no
    single-vs-multi special-casing is needed here.
    """
    if not tickers:
        return {}

    data = yf.download(
        tickers=" ".join(tickers),
        period="2d",
        interval="1d",
        group_by="ticker",
        threads=True,
        progress=False,
        auto_adjust=False,
        session=YF_SESSION,
    )

    quotes: dict[str, dict] = {}
    for ticker in tickers:
        try:
            closes = data[ticker]["Close"].dropna()
        except KeyError:
            closes = pd.Series(dtype=float)

        if closes.empty:
            quotes[ticker] = {"price": None, "change_percent": None}
            continue

        price = float(closes.iloc[-1])
        change_percent = None
        if len(closes) >= 2:
            prev_close = float(closes.iloc[-2])
            if prev_close:
                change_percent = (price - prev_close) / prev_close * 100

        quotes[ticker] = {"price": price, "change_percent": change_percent}

    return quotes
