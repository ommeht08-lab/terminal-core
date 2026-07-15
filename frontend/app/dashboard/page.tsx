import DashboardSummary from "@/app/components/DashboardSummary";
import VolatilityScreener from "@/app/components/VolatilityScreener";
import WatchlistTable from "@/app/components/WatchlistTable";
import { API_BASE, VolatilityScreenerResponse, WatchlistSummaryItem, cardClasses } from "@/app/lib/analysis";

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

export default async function DashboardPage() {
  const tickers = await getWatchlist();
  const [rows, screener] = await Promise.all([
    getWatchlistSummary(tickers),
    getVolatilityScreener(),
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
