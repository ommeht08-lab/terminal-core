"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const MACROS = [
  { symbol: "SPY", price: "$542.10", changePct: 1.2 },
  { symbol: "QQQ", price: "$478.50", changePct: 1.5 },
  { symbol: "VIX", price: "13.40", changePct: -5.1 },
];

function MacroStrip() {
  return (
    <div className="border-t border-white/5">
      <div className="max-w-5xl mx-auto px-6 py-1.5 flex items-center gap-5 text-xs font-mono">
        {MACROS.map((m) => (
          <span key={m.symbol} className="flex items-center gap-1.5">
            <span className="text-slate-500">{m.symbol}</span>
            <span className="text-slate-300">{m.price}</span>
            <span className={m.changePct >= 0 ? "text-emerald-400" : "text-rose-400"}>
              {m.changePct >= 0 ? "+" : ""}
              {m.changePct}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Header() {
  const router = useRouter();
  const [ticker, setTicker] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const sanitized = ticker.trim().toUpperCase();
    if (!sanitized) return;

    router.push(`/stock/${sanitized}`);
  }

  return (
    <header className="sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/10">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="text-sm font-bold tracking-widest whitespace-nowrap bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent"
          >
            [ ] TERMINAL_CORE
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/journal"
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              Journal
            </Link>
          </nav>
        </div>

        <form onSubmit={handleSubmit} className="w-full max-w-xs">
          <input
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            placeholder="Enter ticker (e.g., AAPL)..."
            className="w-full rounded-lg bg-white/[0.03] border border-white/10 px-3 py-1.5 text-sm text-slate-100 placeholder-slate-600 transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </form>
      </div>

      <MacroStrip />
    </header>
  );
}
