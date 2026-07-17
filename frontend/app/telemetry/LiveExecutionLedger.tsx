"use client";

import { useEffect, useState } from "react";
import { API_BASE, ExecutionEntry, cardClasses } from "@/app/lib/analysis";

const POLL_INTERVAL_MS = 7000;

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatTimestamp(iso: string | null): string {
  if (!iso) return "--";
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? "--" : parsed.toLocaleTimeString();
}

export default function LiveExecutionLedger() {
  const [executions, setExecutions] = useState<ExecutionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    function poll() {
      fetch(`${API_BASE}/api/bot/executions`)
        .then((res) => {
          if (!res.ok) throw new Error("request failed");
          return res.json();
        })
        .then((data: ExecutionEntry[]) => {
          if (cancelled) return;
          setExecutions(data);
          setError(false);
        })
        .catch(() => {
          if (!cancelled) setError(true);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }

    poll();
    const intervalId = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  return (
    <div className={`${cardClasses} p-6`}>
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
          Live Execution Ledger
        </h2>
        <span className="flex items-center gap-1.5 text-[11px] text-slate-600">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Polling every {POLL_INTERVAL_MS / 1000}s
        </span>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Loading execution ledger&hellip;</p>
      ) : error && executions.length === 0 ? (
        <p className="mt-4 text-sm text-rose-400">
          Couldn&rsquo;t load the execution ledger &mdash; retrying in the background.
        </p>
      ) : executions.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          No trades reported yet. The engine posts here via the authenticated
          execution webhook as it trades.
        </p>
      ) : (
        <div className="mt-4 max-h-80 overflow-y-auto rounded-lg bg-black/30 border border-slate-800/60">
          <table className="w-full text-xs font-mono">
            <thead className="sticky top-0 bg-slate-950/95 backdrop-blur">
              <tr className="text-left text-slate-500 uppercase tracking-wider">
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Ticker</th>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium text-right">Qty</th>
                <th className="px-3 py-2 font-medium text-right">Price</th>
                <th className="px-3 py-2 font-medium">Strategy</th>
              </tr>
            </thead>
            <tbody>
              {executions.map((entry) => (
                <tr key={entry.id} className="border-t border-slate-800/60">
                  <td className="px-3 py-1.5 text-slate-500">
                    {formatTimestamp(entry.timestamp)}
                  </td>
                  <td className="px-3 py-1.5 font-semibold text-slate-100">{entry.ticker}</td>
                  <td
                    className={`px-3 py-1.5 font-semibold ${
                      entry.action === "BUY" ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {entry.action}
                  </td>
                  <td className="px-3 py-1.5 text-right text-slate-300">{entry.quantity}</td>
                  <td className="px-3 py-1.5 text-right text-slate-300">
                    {currencyFormatter.format(entry.price)}
                  </td>
                  <td className="px-3 py-1.5 text-slate-500">{entry.strategy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
