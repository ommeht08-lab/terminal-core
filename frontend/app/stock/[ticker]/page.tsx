import { API_BASE, AnalyzeResponse, SentimentResponse, ValuationInputs } from "@/app/lib/analysis";
import TearSheet from "./TearSheet";

async function getAnalysis(ticker: string): Promise<AnalyzeResponse | null> {
  const res = await fetch(`${API_BASE}/api/analyze/${ticker}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    return null;
  }

  return res.json();
}

function unavailableValuation(ticker: string): ValuationInputs {
  return {
    ticker,
    available: false,
    free_cash_flow: null,
    total_debt: null,
    cash_and_equivalents: null,
    shares_outstanding: null,
    current_price: null,
  };
}

// DCF inputs are a separate, independently-degrading fetch -- a missing/failed
// valuation should never take down the rest of the tear sheet, so failures
// here resolve to an "unavailable" shape rather than throwing.
async function getValuation(ticker: string): Promise<ValuationInputs> {
  try {
    const res = await fetch(`${API_BASE}/api/valuation/${ticker}`, { cache: "no-store" });
    if (!res.ok) return unavailableValuation(ticker);
    return await res.json();
  } catch {
    return unavailableValuation(ticker);
  }
}

function unavailableSentiment(ticker: string): SentimentResponse {
  return {
    ticker,
    available: false,
    compound_score: null,
    classification: null,
    article_count: 0,
    top_positive: [],
    top_negative: [],
  };
}

// Also independently-degrading -- a sentiment fetch failure never takes
// down the rest of the tear sheet.
async function getSentiment(ticker: string): Promise<SentimentResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/sentiment/${ticker}`, { cache: "no-store" });
    if (!res.ok) return unavailableSentiment(ticker);
    return await res.json();
  } catch {
    return unavailableSentiment(ticker);
  }
}

export default async function StockPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const [data, valuation, sentiment] = await Promise.all([
    getAnalysis(ticker),
    getValuation(ticker),
    getSentiment(ticker),
  ]);

  if (!data) {
    return (
      <div className="min-h-screen bg-[#020617]">
        <div className="max-w-5xl mx-auto p-4">
          <p className="text-rose-400">
            Failed to load data for {ticker.toUpperCase()}
          </p>
        </div>
      </div>
    );
  }

  return <TearSheet data={data} valuation={valuation} sentiment={sentiment} />;
}
