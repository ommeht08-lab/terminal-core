"use client";

import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PortfolioOptimizeResponse, cardClasses } from "@/app/lib/analysis";

function formatPct(value: number): string {
  return `${value.toFixed(2)}%`;
}

function highlightedShape(color: string) {
  return function ShapeFn(props: { cx?: number; cy?: number }) {
    const { cx, cy } = props;
    if (cx === undefined || cy === undefined) return <g />;
    return <circle cx={cx} cy={cy} r={7} fill={color} stroke="#020617" strokeWidth={2} />;
  };
}

export default function EfficientFrontier({ data }: { data: PortfolioOptimizeResponse }) {
  if (!data.available || !data.max_sharpe_portfolio || !data.min_volatility_portfolio) {
    const message =
      data.reason === "rate_limited"
        ? `Polygon's rate limit was reached before enough tickers could be fetched (${data.tickers_used.length} of ${data.requested_count}). Try again in about a minute.`
        : "Add at least 2 tickers to your watchlist to compute an efficient frontier.";

    return (
      <div className={`${cardClasses} p-16 flex items-center justify-center text-center`}>
        <p className="text-sm text-slate-500">{message}</p>
      </div>
    );
  }

  const { max_sharpe_portfolio, min_volatility_portfolio, random_portfolios, tickers_used } =
    data;

  const sortedWeights = Object.entries(max_sharpe_portfolio.weights).sort(
    (a, b) => b[1] - a[1]
  );

  return (
    <div className={`${cardClasses} overflow-x-auto`}>
      {data.rate_limited && (
        <div className="px-4 pt-4">
          <p className="text-xs text-amber-400">
            Optimized over {tickers_used.length} of {data.requested_count} watchlist tickers
            &mdash; Polygon&rsquo;s rate limit was reached mid-fetch. Refresh in about a minute
            for fuller coverage.
          </p>
        </div>
      )}

      <div className="p-4 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div>
          <div className="flex items-center gap-4 text-xs text-slate-500 mb-2">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-slate-500" /> Random Portfolios
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" /> Max Sharpe (Tangency)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Min Volatility
            </span>
          </div>

          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="#ffffff10" strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="volatility"
                name="Volatility"
                tick={{ fill: "#64748b", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}%`}
                label={{
                  value: "Volatility (Ann.)",
                  position: "insideBottom",
                  offset: -4,
                  fill: "#64748b",
                  fontSize: 11,
                }}
              />
              <YAxis
                type="number"
                dataKey="return"
                name="Expected Return"
                tick={{ fill: "#64748b", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={56}
                tickFormatter={(value) => `${value}%`}
                label={{
                  value: "Return (Ann.)",
                  angle: -90,
                  position: "insideLeft",
                  fill: "#64748b",
                  fontSize: 11,
                }}
              />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                contentStyle={{
                  backgroundColor: "rgba(11, 15, 25, 0.9)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: 12,
                  backdropFilter: "blur(8px)",
                }}
                labelStyle={{ color: "#e2e8f0" }}
                itemStyle={{ color: "#e2e8f0" }}
                formatter={(value) => (typeof value === "number" ? `${value.toFixed(2)}%` : value)}
              />
              <Scatter
                name="Random Portfolios"
                data={random_portfolios}
                fill="#64748b"
                fillOpacity={0.35}
                line={false}
                isAnimationActive={false}
              />
              <Scatter
                name="Max Sharpe"
                data={[
                  {
                    volatility: max_sharpe_portfolio.volatility,
                    return: max_sharpe_portfolio.expected_return,
                  },
                ]}
                shape={highlightedShape("#22d3ee")}
                isAnimationActive={false}
              />
              <Scatter
                name="Min Volatility"
                data={[
                  {
                    volatility: min_volatility_portfolio.volatility,
                    return: min_volatility_portfolio.expected_return,
                  },
                ]}
                shape={highlightedShape("#34d399")}
                isAnimationActive={false}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        <div>
          <h3 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
            Max Sharpe Allocation
          </h3>
          <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-slate-500">Expected Return</p>
              <p className="mt-0.5 font-mono text-slate-100">
                {formatPct(max_sharpe_portfolio.expected_return)}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Volatility</p>
              <p className="mt-0.5 font-mono text-slate-100">
                {formatPct(max_sharpe_portfolio.volatility)}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Sharpe Ratio</p>
              <p className="mt-0.5 font-mono text-slate-100">
                {max_sharpe_portfolio.sharpe_ratio.toFixed(2)}
              </p>
            </div>
          </div>

          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase tracking-wider">
                <th className="pb-2 font-medium">Ticker</th>
                <th className="pb-2 font-medium text-right">Weight</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {sortedWeights.map(([ticker, weight]) => (
                <tr key={ticker} className="border-t border-slate-800/60">
                  <td className="py-1.5 font-sans font-semibold text-slate-100">{ticker}</td>
                  <td className="py-1.5 text-right text-slate-300">{formatPct(weight)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
