"""VADER-based NLP sentiment analysis over recent news headlines for a
ticker (Phase 15).

The original spec called for pulling news directly from FMP's
`/v3/stock_news` endpoint. Verified empirically against the real API before
writing any of this: that legacy endpoint now returns HTTP 403 ("Legacy
Endpoint ... no longer supported"), and its `/stable/` successor
(`news/stock`) returns HTTP 402 ("Restricted Endpoint") on this plan --
the same per-plan restriction `quant_metrics.get_news()` already documents
and works around with a Google News RSS fallback. So this reuses
`get_news(ticker=...)` instead of hand-rolling a call to an endpoint
confirmed dead on this account, and gets real headlines either way.

Only headline text is available from either source (no full article body),
so sentiment is scored on headlines alone -- standard practice for
financial headline sentiment, and the honest ceiling of what data actually
exists here rather than a compromise.
"""

from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

from quant_metrics import get_news

_analyzer = SentimentIntensityAnalyzer()

BULLISH_THRESHOLD = 0.15
BEARISH_THRESHOLD = -0.15


def _classify(compound_score: float) -> str:
    if compound_score > BULLISH_THRESHOLD:
        return "Bullish"
    if compound_score < BEARISH_THRESHOLD:
        return "Bearish"
    return "Neutral"


def analyze_sentiment(ticker: str, limit: int = 20) -> dict:
    """Aggregated VADER sentiment for a ticker's recent headlines, plus the
    top 3 most positive and top 3 most negative articles so a user can see
    why the model landed on its classification. `available: False` (empty
    top_positive/top_negative, null score) means no news came back from
    either FMP or the Google News RSS fallback -- not an error, just nothing
    to score.
    """
    articles = get_news(ticker=ticker, limit=limit)

    if not articles:
        return {
            "ticker": ticker,
            "available": False,
            "compound_score": None,
            "classification": None,
            "article_count": 0,
            "top_positive": [],
            "top_negative": [],
        }

    scored = [
        {**article, "compound_score": round(_analyzer.polarity_scores(article["title"])["compound"], 4)}
        for article in articles
    ]

    average_compound = sum(a["compound_score"] for a in scored) / len(scored)

    ranked = sorted(scored, key=lambda a: a["compound_score"], reverse=True)
    top_positive = ranked[:3]
    top_negative = list(reversed(ranked[-3:]))

    return {
        "ticker": ticker,
        "available": True,
        "compound_score": round(average_compound, 4),
        "classification": _classify(average_compound),
        "article_count": len(scored),
        "top_positive": top_positive,
        "top_negative": top_negative,
    }
