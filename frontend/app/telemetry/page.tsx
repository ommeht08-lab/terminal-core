"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  API_BASE,
  BotPosition,
  BotPnlResponse,
  BotPositionsResponse,
  cardClasses,
  changeColorClass,
} from "@/app/lib/analysis";
import RiskControls from "./RiskControls";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function formatPercent(fraction: number): string {
  const sign = fraction > 0 ? "+" : "";
  return `${sign}${(fraction * 100).toFixed(2)}%`;
}

function StatusPanel({ error, empty, emptyLabel }: { error: "rate_limited" | "unavailable" | null; empty: boolean; emptyLabel: string }) {
  if (error === "rate_limited") {
    return (
      <p className="text-sm text-amber-400">
        Alpaca API rate limit reached &mdash; try again shortly.
      </p>
    );
  }
  if (error === "unavailable") {
    return (
      <p className="text-sm text-rose-400">
        Alpaca connection temporarily unavailable.
      </p>
    );
  }
  if (empty) {
    return <p className="text-sm text-slate-500">{emptyLabel}</p>;
  }
  return null;
}

export default function TelemetryPage() {
  const [pnl, setPnl] = useState<BotPnlResponse | null>(null);
  const [pnlLoading, setPnlLoading] = useState(true);

  const [positions, setPositions] = useState<BotPositionsResponse | null>(null);
  const [positionsLoading, setPositionsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch(`${API_BASE}/api/bot/pnl`)
      .then((res) => res.json())
      .then((data: BotPnlResponse) => {
        if (!cancelled) setPnl(data);
      })
      .catch(() => {
        if (!cancelled) setPnl({ configured: true, error: "unavailable", equity_curve: [] });
      })
      .finally(() => {
        if (!cancelled) setPnlLoading(false);
      });

    fetch(`${API_BASE}/api/bot/positions`)
      .then((res) => res.json())
      .then((data: BotPositionsResponse) => {
        if (!cancelled) setPositions(data);
      })
      .catch(() => {
        if (!cancelled) setPositions({ configured: true, error: "unavailable", positions: [] });
      })
      .finally(() => {
        if (!cancelled) setPositionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const notConfigured = pnl?.configured === false || positions?.configured === false;

  return (
    <div className="min-h-screen bg-[#020617]">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Algo Telemetry</h1>
          <p className="mt-1 text-sm text-slate-500">
            Live read-only view of the standard-deviation execution engine&rsquo;s
            paper-trading account.
          </p>
        </div>

        {notConfigured && (
          <div className={`${cardClasses} p-4`}>
            <p className="text-sm text-slate-400">
              Telemetry isn&rsquo;t connected yet &mdash; set{" "}
              <code className="text-cyan-400">ALPACA_API_KEY</code> and{" "}
              <code className="text-cyan-400">ALPACA_SECRET_KEY</code> on the backend to
              wire this up to the execution engine&rsquo;s paper account.
            </p>
          </div>
        )}

        <div className={`${cardClasses} p-6`}>
          <h2 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
            30-Day Equity Curve
          </h2>

          {pnlLoading ? (
            <div className="mt-6 h-[280px] flex items-center justify-center">
              <p className="text-sm text-slate-500">Loading equity curve&hellip;</p>
            </div>
          ) : pnl && pnl.configured && !pnl.error && pnl.equity_curve.length > 0 ? (
            <div className="mt-6">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={pnl.equity_curve} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#ffffff10" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#64748b", fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#64748b", fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    width={70}
                    tickFormatter={(value) => currencyFormatter.format(value)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(11, 15, 25, 0.9)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: 12,
                      backdropFilter: "blur(8px)",
                    }}
                    labelStyle={{ color: "#e2e8f0" }}
                    itemStyle={{ color: "#e2e8f0" }}
                    formatter={(value) =>
                      typeof value === "number" ? currencyFormatter.format(value) : value
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="equity"
                    name="Equity"
                    stroke="#22d3ee"
                    strokeWidth={2.5}
                    dot={false}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-6 h-[280px] flex items-center justify-center">
              <StatusPanel
                error={pnl?.error ?? null}
                empty={!pnlLoading}
                emptyLabel="No equity history available yet."
              />
            </div>
          )}
        </div>

        <div className={`${cardClasses} p-6`}>
          <h2 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
            Active Positions
          </h2>

          {positionsLoading ? (
            <div className="mt-6 py-10 flex items-center justify-center">
              <p className="text-sm text-slate-500">Loading positions&hellip;</p>
            </div>
          ) : positions && positions.configured && !positions.error && positions.positions.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 uppercase tracking-wider">
                    <th className="pb-2 font-medium">Ticker</th>
                    <th className="pb-2 font-medium text-right">Quantity</th>
                    <th className="pb-2 font-medium text-right">Current Price</th>
                    <th className="pb-2 font-medium text-right">Unrealized P&amp;L</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {positions.positions.map((position: BotPosition) => (
                    <tr key={position.ticker} className="border-t border-slate-800/60">
                      <td className="py-2.5 font-sans font-semibold text-slate-100">
                        {position.ticker}
                      </td>
                      <td className="py-2.5 text-right text-slate-300">{position.quantity}</td>
                      <td className="py-2.5 text-right text-slate-300">
                        {currencyFormatter.format(position.current_price)}
                      </td>
                      <td className={`py-2.5 text-right ${changeColorClass(position.unrealized_pl)}`}>
                        {currencyFormatter.format(position.unrealized_pl)}{" "}
                        <span className="text-xs">
                          ({formatPercent(position.unrealized_plpc)})
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-6 py-10 flex items-center justify-center">
              <StatusPanel
                error={positions?.error ?? null}
                empty={!positionsLoading}
                emptyLabel="No open positions."
              />
            </div>
          )}
        </div>

        <RiskControls />
      </div>
    </div>
  );
}
