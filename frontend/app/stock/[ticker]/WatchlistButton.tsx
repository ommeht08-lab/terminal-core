"use client";

import { useEffect, useState } from "react";
import { API_BASE } from "@/app/lib/analysis";

export default function WatchlistButton({ ticker }: { ticker: string }) {
  const [isWatchlisted, setIsWatchlisted] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch(`${API_BASE}/api/watchlist`)
      .then((res) => res.json())
      .then((tickers: string[]) => {
        if (!cancelled) setIsWatchlisted(tickers.includes(ticker));
      })
      .catch(() => {
        if (!cancelled) setIsWatchlisted(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ticker]);

  async function toggle() {
    if (isWatchlisted === null || pending) return;
    setPending(true);

    const method = isWatchlisted ? "DELETE" : "POST";
    try {
      await fetch(`${API_BASE}/api/watchlist/${ticker}`, { method });
      setIsWatchlisted(!isWatchlisted);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={isWatchlisted === null || pending}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium border transition-all duration-300 active:scale-95 disabled:opacity-50 ${
        isWatchlisted
          ? "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
          : "bg-white/[0.03] text-slate-300 border-white/10 hover:bg-white/[0.08] hover:border-white/20"
      }`}
    >
      <span>{isWatchlisted ? "★" : "☆"}</span>
      {isWatchlisted ? "On Watchlist" : "Save to Watchlist"}
    </button>
  );
}
