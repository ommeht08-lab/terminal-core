"use client";

import { useEffect, useState } from "react";
import { API_BASE, AlgoConfig, cardClasses } from "@/app/lib/analysis";

type SaveState = "idle" | "saving" | "saved" | "error";

// maLookback/stdDevMultiplier are controlled by the parent TelemetryPage
// rather than owned locally -- the Backtest Strategy section needs to read
// these exact live values (saved or not) to simulate "what would these
// parameters have done historically", so both panels share one source of
// truth instead of drifting out of sync.
export default function RiskControls({
  maLookback,
  stdDevMultiplier,
  onMaLookbackChange,
  onStdDevMultiplierChange,
}: {
  maLookback: string;
  stdDevMultiplier: string;
  onMaLookbackChange: (value: string) => void;
  onStdDevMultiplierChange: (value: string) => void;
}) {
  const [config, setConfig] = useState<AlgoConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`${API_BASE}/api/bot/config`)
      .then((res) => {
        if (!res.ok) throw new Error("request failed");
        return res.json();
      })
      .then((data: AlgoConfig) => {
        if (cancelled) return;
        setConfig(data);
        onMaLookbackChange(String(data.ma_lookback_period));
        onStdDevMultiplierChange(String(data.std_dev_multiplier));
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // Only ever runs once on mount to hydrate the parent's state from the
    // persisted config -- intentionally excludes the onChange callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const parsedLookback = Number(maLookback);
    const parsedMultiplier = Number(stdDevMultiplier);

    if (!Number.isInteger(parsedLookback) || parsedLookback <= 0) {
      setSaveState("error");
      setSaveMessage("Lookback period must be a positive whole number.");
      return;
    }
    if (!Number.isFinite(parsedMultiplier) || parsedMultiplier <= 0) {
      setSaveState("error");
      setSaveMessage("Std dev multiplier must be a positive number.");
      return;
    }

    setSaveState("saving");
    setSaveMessage(null);

    fetch(`${API_BASE}/api/bot/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ma_lookback_period: parsedLookback,
        std_dev_multiplier: parsedMultiplier,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          const detail = Array.isArray(body?.detail) ? body.detail[0]?.msg : body?.detail;
          throw new Error(detail || "Update failed.");
        }
        return res.json();
      })
      .then((data: AlgoConfig) => {
        setConfig(data);
        setSaveState("saved");
      })
      .catch((err: unknown) => {
        setSaveState("error");
        setSaveMessage(err instanceof Error ? err.message : "Update failed.");
      });
  }

  return (
    <div className={`${cardClasses} p-6`}>
      <h2 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
        Risk Controls
      </h2>
      <p className="mt-1 text-xs text-slate-600">
        Strategy parameters persisted for the execution engine to read &mdash; this app
        writes them here, it doesn&rsquo;t push them to the engine directly.
      </p>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Loading current configuration&hellip;</p>
      ) : loadError ? (
        <p className="mt-4 text-sm text-rose-400">
          Couldn&rsquo;t load the current configuration &mdash; try refreshing.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm text-slate-400">MA Lookback Period (days)</span>
              <input
                type="number"
                min={1}
                max={500}
                step={1}
                value={maLookback}
                onChange={(e) => {
                  onMaLookbackChange(e.target.value);
                  setSaveState("idle");
                }}
                className="mt-1.5 w-full rounded-lg bg-slate-900/40 border border-slate-700/50 px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
              />
            </label>
            <label className="block">
              <span className="text-sm text-slate-400">Std Dev Multiplier</span>
              <input
                type="number"
                min={0.1}
                max={10}
                step={0.1}
                value={stdDevMultiplier}
                onChange={(e) => {
                  onStdDevMultiplierChange(e.target.value);
                  setSaveState("idle");
                }}
                className="mt-1.5 w-full rounded-lg bg-slate-900/40 border border-slate-700/50 px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
              />
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saveState === "saving"}
              className="rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 text-sm font-semibold px-4 py-2 transition-colors"
            >
              {saveState === "saving" ? "Saving…" : "Update Parameters"}
            </button>

            {saveState === "saved" && (
              <span className="text-sm text-emerald-400">
                Saved
                {config?.updated_at
                  ? ` at ${new Date(config.updated_at).toLocaleTimeString()}`
                  : ""}
                .
              </span>
            )}
            {saveState === "error" && (
              <span className="text-sm text-rose-400">{saveMessage}</span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
