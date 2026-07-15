"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { API_BASE, HistoricalBacktestResult, cardClasses, changeColorClass } from "@/app/lib/analysis";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function StatTile({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: string;
  colorClass?: string;
}) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold font-mono tracking-tight ${
          colorClass ?? "text-slate-100"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export default function BacktestStrategy({
  maLookback,
  stdDevMultiplier,
}: {
  maLookback: string;
  stdDevMultiplier: string;
}) {
  const [ticker, setTicker] = useState("AAPL");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<HistoricalBacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleRun() {
    const parsedLookback = Number(maLookback);
    const parsedMultiplier = Number(stdDevMultiplier);

    if (!Number.isInteger(parsedLookback) || parsedLookback <= 0) {
      setError("Set a valid MA lookback period in Risk Controls above first.");
      return;
    }
    if (!Number.isFinite(parsedMultiplier) || parsedMultiplier <= 0) {
      setError("Set a valid std dev multiplier in Risk Controls above first.");
      return;
    }

    setRunning(true);
    setError(null);

    fetch(`${API_BASE}/api/backtest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticker: ticker.trim().toUpperCase() || "AAPL",
        ma_lookback_period: parsedLookback,
        std_dev_multiplier: parsedMultiplier,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 429) {
            throw new Error(
              "Polygon's rate limit was reached — try again in about a minute."
            );
          }
          const body = await res.json().catch(() => null);
          throw new Error(body?.detail || "Backtest failed.");
        }
        return res.json();
      })
      .then((data: HistoricalBacktestResult) => {
        setResult(data);
      })
      .catch((err: unknown) => {
        setResult(null);
        setError(err instanceof Error ? err.message : "Backtest failed.");
      })
      .finally(() => setRunning(false));
  }

  return (
    <div className={`${cardClasses} p-6`}>
      <h2 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
        Backtest Strategy
      </h2>
      <p className="mt-1 text-xs text-slate-600">
        Simulates the Risk Controls parameters above (MA {maLookback || "—"} /{" "}
        {stdDevMultiplier || "—"}σ) against real historical prices &mdash; a
        preview, not a guarantee the live engine behaves identically.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          placeholder="Ticker (e.g., AAPL)"
          className="w-40 rounded-lg bg-slate-900/40 border border-slate-700/50 px-3 py-2 text-sm text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
        />
        <button
          type="button"
          onClick={handleRun}
          disabled={running}
          className="rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 text-sm font-semibold px-4 py-2 transition-colors"
        >
          {running ? "Running…" : "Run Historical Backtest"}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2.5">
          <p className="text-sm text-amber-400">{error}</p>
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <StatTile
              label="Total Return"
              value={formatPct(result.total_return)}
              colorClass={changeColorClass(result.total_return)}
            />
            <StatTile
              label="Sharpe Ratio"
              value={result.sharpe_ratio.toFixed(2)}
              colorClass={changeColorClass(result.sharpe_ratio)}
            />
            <StatTile
              label="Max Drawdown"
              value={formatPct(result.max_drawdown)}
              colorClass="text-rose-400"
            />
            <StatTile label="Win Rate" value={`${result.win_rate.toFixed(1)}%`} />
            <StatTile label="Total Trades" value={String(result.total_trades)} />
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-cyan-400" /> {result.ticker} Strategy
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-slate-500" /> Buy &amp; Hold
            </span>
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <LineChart
              data={result.equity_curve}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid stroke="#ffffff10" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: "#64748b", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                minTickGap={40}
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
                dataKey="strategy_equity"
                name="Strategy"
                stroke="#22d3ee"
                strokeWidth={2.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="buy_hold_equity"
                name="Buy & Hold"
                stroke="#64748b"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
