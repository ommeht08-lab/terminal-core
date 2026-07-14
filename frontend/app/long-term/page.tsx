import {
  API_BASE,
  WatchlistSummaryItem,
  cardClasses,
  changeColorClass,
  formatChangePercent,
} from "@/app/lib/analysis";
import CompoundProjection from "./CompoundProjection";

const TRACKED_ETFS = ["QQQ", "SPY", "VOO"];

const ETF_NAMES: Record<string, string> = {
  QQQ: "Invesco QQQ Trust",
  SPY: "SPDR S&P 500 ETF Trust",
  VOO: "Vanguard S&P 500 ETF",
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatPrice(value: number | null | undefined): string {
  return value === null || value === undefined ? "--" : currencyFormatter.format(value);
}

async function getEtfSummary(): Promise<WatchlistSummaryItem[]> {
  const res = await fetch(`${API_BASE}/api/watchlist/summary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tickers: TRACKED_ETFS }),
    cache: "no-store",
  });

  if (!res.ok) {
    return [];
  }

  return res.json();
}

export default async function LongTermPage() {
  const etfs = await getEtfSummary();

  return (
    <div className="min-h-screen bg-[#020617]">
      <div className="max-w-5xl mx-auto p-6 space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Long-Term Horizons</h1>
          <p className="mt-1 text-sm text-slate-500">
            Baseline index tracking and a compound growth model for long-horizon,
            Roth-IRA-style accumulation.
          </p>
        </div>

        <section>
          <h2 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
            Index ETF Baseline
          </h2>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
            {TRACKED_ETFS.map((ticker) => {
              const etf = etfs.find((e) => e.ticker === ticker);
              return (
                <div key={ticker} className={`${cardClasses} p-5`}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono font-bold text-lg text-slate-100">
                      {ticker}
                    </span>
                    <span
                      className={`font-mono text-sm ${changeColorClass(
                        etf?.change_percent ?? null
                      )}`}
                    >
                      {formatChangePercent(etf?.change_percent ?? null)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{ETF_NAMES[ticker]}</p>
                  <p className="mt-3 text-2xl font-semibold font-mono tracking-tight text-slate-100">
                    {formatPrice(etf?.price)}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
            Compound Wealth Projection
          </h2>
          <div className="mt-3">
            <CompoundProjection />
          </div>
        </section>
      </div>
    </div>
  );
}
