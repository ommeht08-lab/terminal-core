"use client";

import { useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HistoryPoint } from "@/app/lib/analysis";

type Timeframe = "1M" | "3M" | "6M" | "1Y" | "5Y";

const TIMEFRAMES: Timeframe[] = ["1M", "3M", "6M", "1Y", "5Y"];

// Approximate trading days per window (252 trading days/year).
const TIMEFRAME_DAYS: Record<Timeframe, number> = {
  "1M": 21,
  "3M": 63,
  "6M": 126,
  "1Y": 252,
  "5Y": 1260,
};

function filterByTimeframe(
  history: HistoryPoint[],
  timeframe: Timeframe
): HistoryPoint[] {
  return history.slice(-TIMEFRAME_DAYS[timeframe]);
}

export default function PriceChart({ history }: { history: HistoryPoint[] }) {
  const [timeframe, setTimeframe] = useState<Timeframe>("1Y");

  if (history.length === 0) {
    return (
      <p className="text-sm text-slate-500">No historical data available.</p>
    );
  }

  const visibleHistory = filterByTimeframe(history, timeframe);

  return (
    <div>
      <div className="flex justify-end gap-1 mb-2">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              tf === timeframe
                ? "bg-white/10 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart
          data={visibleHistory}
          margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="closeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#ffffff10" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: "#64748b", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            minTickGap={40}
          />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fill: "#64748b", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={70}
          />
          <YAxis
            yAxisId="volume"
            orientation="right"
            hide
            domain={["auto", "auto"]}
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
          />
          <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
          <Bar
            dataKey="volume"
            yAxisId="volume"
            name="Volume"
            fill="#334155"
            opacity={0.4}
          />
          <Area
            type="monotone"
            dataKey="close"
            name="Close"
            stroke="#38bdf8"
            strokeWidth={2}
            fill="url(#closeGradient)"
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="sma_50"
            name="50-Day SMA"
            stroke="#22d3ee"
            strokeWidth={2.5}
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="sma_200"
            name="200-Day SMA"
            stroke="#fbbf24"
            strokeWidth={2.5}
            dot={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
