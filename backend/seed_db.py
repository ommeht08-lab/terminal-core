"""Bulk-load the top S&P 500 tickers into the watchlist table."""

from database import SessionLocal, Watchlist, init_db

TICKERS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK-B", "LLY", "V",
    "JPM", "UNH", "XOM", "JNJ", "WMT", "MA", "PG", "AVGO", "HD", "CVX",
    "MRK", "KO", "PEP", "COST", "ABBV", "BAC", "CRM", "MCD", "TMO", "CSCO",
    "ACN", "LIN", "ABT", "DHR", "NFLX", "AMD", "CMCSA", "INTC", "WFC", "TXN",
    "PM", "COP", "INTU", "CAT", "PFE", "IBM", "GE", "NKE", "NOW", "AMGN",
]


def seed_watchlist():
    init_db()
    db = SessionLocal()
    try:
        for ticker in TICKERS:
            existing = db.query(Watchlist).filter(Watchlist.ticker == ticker).first()
            if existing:
                continue
            db.add(Watchlist(ticker=ticker))
            db.commit()
            print(f"Added {ticker} to watchlist")
    finally:
        db.close()


if __name__ == "__main__":
    seed_watchlist()
