import DashboardSummary from "@/app/components/DashboardSummary";
import WatchlistTable from "@/app/components/WatchlistTable";
import { API_BASE, WatchlistSummaryItem, cardClasses } from "@/app/lib/analysis";

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

export default async function DashboardPage() {
  const tickers = await getWatchlist();
  const rows = await getWatchlistSummary(tickers);

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">
          Active Coverage Universe
        </h1>

        {rows.length === 0 ? (
          <div
            className={`${cardClasses} p-16 flex flex-col items-center justify-center gap-4 text-center`}
          >
            <div className="relative flex items-center justify-center">
              <div className="absolute w-16 h-16 rounded-full bg-indigo-500/20 blur-xl" />
              <svg
                className="relative w-10 h-10 text-indigo-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 18L9 11.25l4.306 4.306a11.95 11.95 0 015.814-5.518l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"
                />
              </svg>
            </div>
            <div>
              <p className="text-slate-300 font-medium">
                Your coverage universe is empty.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Search for a ticker above to begin your quantitative analysis.
              </p>
            </div>
          </div>
        ) : (
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
