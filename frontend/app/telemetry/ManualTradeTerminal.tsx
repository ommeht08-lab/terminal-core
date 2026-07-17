"use client";

import { useState } from "react";
import { API_BASE, BrokerTradeResponse, cardClasses } from "@/app/lib/analysis";

type Side = "buy" | "sell";

export default function ManualTradeTerminal() {
  const [ticker, setTicker] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [submitting, setSubmitting] = useState<Side | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  function submitOrder(side: Side) {
    const trimmedTicker = ticker.trim().toUpperCase();
    const parsedQuantity = Number(quantity);

    if (!trimmedTicker) {
      setMessage({ type: "error", text: "Enter a ticker first." });
      return;
    }
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setMessage({ type: "error", text: "Quantity must be a positive number." });
      return;
    }

    setSubmitting(side);
    setMessage(null);

    fetch(`${API_BASE}/api/broker/trade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker: trimmedTicker, action: side, quantity: parsedQuantity }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          const detail = Array.isArray(body?.detail) ? body.detail[0]?.msg : body?.detail;
          throw new Error(detail || "Order failed.");
        }
        return res.json();
      })
      .then((data: BrokerTradeResponse) => {
        setMessage({
          type: "success",
          text: `${data.order.side.toUpperCase()} ${data.order.quantity} ${
            data.order.ticker
          } @ $${data.order.price.toFixed(2)} — ${data.order.status}.`,
        });
      })
      .catch((err: unknown) => {
        setMessage({ type: "error", text: err instanceof Error ? err.message : "Order failed." });
      })
      .finally(() => setSubmitting(null));
  }

  const disabled = submitting !== null;

  return (
    <div className={`${cardClasses} p-6`}>
      <h2 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
        Manual Trade Terminal
      </h2>
      <p className="mt-1 text-xs text-slate-600">
        Places a real market order against the connected Alpaca account. Fills post to the
        Live Execution Ledger below as &ldquo;Manual Override&rdquo;.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs text-slate-500">Ticker</span>
          <input
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            placeholder="AAPL"
            disabled={disabled}
            className="mt-1 block w-28 rounded-lg bg-slate-900/40 border border-slate-700/50 px-3 py-2 text-sm text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 disabled:opacity-50"
          />
        </label>

        <label className="block">
          <span className="text-xs text-slate-500">Quantity</span>
          <input
            type="number"
            min={0.0001}
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            disabled={disabled}
            className="mt-1 block w-24 rounded-lg bg-slate-900/40 border border-slate-700/50 px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 disabled:opacity-50"
          />
        </label>

        <button
          type="button"
          onClick={() => submitOrder("buy")}
          disabled={disabled}
          className="rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 text-sm font-semibold px-5 py-2 transition-colors"
        >
          {submitting === "buy" ? "Routing…" : "BUY"}
        </button>

        <button
          type="button"
          onClick={() => submitOrder("sell")}
          disabled={disabled}
          className="rounded-lg bg-rose-500 hover:bg-rose-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 text-sm font-semibold px-5 py-2 transition-colors"
        >
          {submitting === "sell" ? "Routing…" : "SELL"}
        </button>
      </div>

      {message && (
        <p
          className={`mt-3 text-sm ${
            message.type === "success" ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
