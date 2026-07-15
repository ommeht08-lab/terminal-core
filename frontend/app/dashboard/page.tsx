import DashboardSummary from "@/app/components/DashboardSummary";
import EfficientFrontier from "@/app/components/EfficientFrontier";
import VolatilityScreener from "@/app/components/VolatilityScreener";
import WatchlistTable from "@/app/components/WatchlistTable";
import {
  API_BASE,
  PortfolioOptimizeResponse,
  VolatilityScreenerResponse,
  WatchlistSummaryItem,
  cardClasses,
} from "@/app/lib/analysis";

async function getWatchlist(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/watchlist`, {
    cache: "no-store",
  });

  if (!res.ok) {
    return [];
  }

  return res.json();
}

async function getWatchlistSummary(
  tickers: string[]
): Promise<WatchlistSummaryItem[]> {
  if (tickers.length === 0) {
    return [];
  }

  const res = await fetch(`${API_BASE}/api/watchlist/summary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tickers }),
    cache: "no-store",
  });

  if (!res.ok) {
    return [];
  }

  return res.json();
}

function emptyScreener(): VolatilityScreenerResponse {
  return { rows: [], rate_limited: false, requested_count: 0, returned_count: 0 };
}

// Independent from the watchlist-summary fetch above -- a Polygon rate limit
// or network failure here should never take down the rest of the Dashboard.
async function getVolatilityScreener(): Promise<VolatilityScreenerResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/screener/volatility`, { cache: "no-store" });
    if (!res.ok) return emptyScreener();
    return await res.json();
  } catch {
    return emptyScreener();
  }
}

function emptyPortfolio(requestedCount: number): PortfolioOptimizeResponse {
  return {
    available: false,
    reason: "insufficient_tickers",
    tickers_used: [],
    requested_count: requestedCount,
    rate_limited: false,
    max_sharpe_portfolio: null,
    min_volatility_portfolio: null,
    random_portfolios: [],
  };
}

// Independent from the other two fetches -- a Polygon rate limit or network
// failure here should never take down the rest of the Dashboard.
async function getPortfolioOptimization(requestedCount: number): Promise<PortfolioOptimizeResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/portfolio/optimize`, { cache: "no-store" });
    if (!res.ok) return emptyPortfolio(requestedCount);
    return await res.json();
  } catch {
    return emptyPortfolio(requestedCount);
  }
}

export default async function DashboardPage() {
  const tickers = await getWatchlist();
  const [rows, screener, portfolio] = await Promise.all([
    getWatchlistSummary(tickers),
    getVolatilityScreener(),
    getPortfolioOptimization(tickers.length),
  ]);

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto p-6 space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Active Coverage Universe
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Volatility &amp; Risk Matrix &mdash; RSI, 30-day price deviation, and
            distance from the 20-day SMA, tailored to the execution engine&rsquo;s
            mean-reversion strategy.
          </p>
        </div>

        <VolatilityScreener data={screener} />

        <div>
          <h2 className="text-lg font-semibold tracking-tight">Optimal Asset Allocation</h2>
          <p className="mt-1 text-sm text-slate-500">
            Markowitz mean-variance optimization over the watchlist &mdash; the Maximum
            Sharpe (tangency) and Minimum Volatility portfolios, plotted against a cloud
            of random long-only allocations.
          </p>
          <div className="mt-3">
            <EfficientFrontier data={portfolio} />
          </div>
        </div>

        {rows.length > 0 && (
          <>
            <DashboardSummary data={rows} />
            <div className={`${cardClasses} overflow-x-auto`}>
              <WatchlistTable data={rows} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
