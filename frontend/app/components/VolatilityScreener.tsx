import {
  ScreenerSignal,
  VolatilityScreenerResponse,
  cardClasses,
  screenerRowClasses,
  screenerSignal,
} from "@/app/lib/analysis";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatNumber(value: number | null, digits: number): string {
  return value === null ? "--" : value.toFixed(digits);
}

function formatPct(value: number | null): string {
  if (value === null) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function signalLabel(signal: ScreenerSignal): string | null {
  if (signal === "oversold") return "Oversold";
  if (signal === "overbought") return "Overbought";
  return null;
}

function signalBadgeClasses(signal: ScreenerSignal): string {
  return signal === "oversold"
    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
    : "bg-rose-500/10 text-rose-400 border border-rose-500/20";
}

export default function VolatilityScreener({ data }: { data: VolatilityScreenerResponse }) {
  return (
    <div className={`${cardClasses} overflow-x-auto`}>
      {data.rate_limited && (
        <div className="px-4 pt-4">
          <p className="text-xs text-amber-400">
            Showing {data.returned_count} of {data.requested_count} tickers &mdash;
            Polygon&rsquo;s rate limit was reached mid-scan. Refresh in about a minute for
            fuller coverage.
          </p>
        </div>
      )}

      {data.rows.length === 0 ? (
        <div className="p-16 flex flex-col items-center justify-center gap-2 text-center">
          <p className="text-slate-300 font-medium">
            {data.requested_count === 0
              ? "Your coverage universe is empty."
              : "No screener data available right now."}
          </p>
          <p className="text-sm text-slate-500">
            {data.requested_count === 0
              ? "Search for a ticker above to begin your quantitative analysis."
              : "Polygon may be rate-limited or the watchlist tickers lack enough recent history — try again shortly."}
          </p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800/60">
              <th className="px-4 py-3 font-medium">Ticker</th>
              <th className="px-4 py-3 font-medium text-right">Price</th>
              <th className="px-4 py-3 font-medium text-right">RSI (14)</th>
              <th className="px-4 py-3 font-medium text-right">30D Std Dev</th>
              <th className="px-4 py-3 font-medium text-right">% from 20D SMA</th>
              <th className="px-4 py-3 font-medium text-right">Std Devs from SMA</th>
              <th className="px-4 py-3 font-medium text-right">Signal</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {data.rows.map((row) => {
              const signal = screenerSignal(row);
              const label = signalLabel(signal);
              return (
                <tr
                  key={row.ticker}
                  className={`border-t border-slate-800/60 transition-colors ${screenerRowClasses(
                    signal
                  )}`}
                >
                  <td className="px-4 py-2.5 font-sans font-semibold text-slate-100">
                    {row.ticker}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-300">
                    {currencyFormatter.format(row.price)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-300">
                    {formatNumber(row.rsi_14, 1)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-300">
                    {formatNumber(row.std_dev_30, 2)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-300">
                    {formatPct(row.pct_from_sma_20)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-300">
                    {formatNumber(row.std_devs_from_sma, 2)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {label && (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${signalBadgeClasses(
                          signal
                        )}`}
                      >
                        {label}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
