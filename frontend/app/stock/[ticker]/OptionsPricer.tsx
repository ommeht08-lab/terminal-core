"use client";

import { useEffect, useState } from "react";
import { API_BASE, OptionsPricingResponse, cardClassesFor } from "@/app/lib/analysis";

const RISK_FREE_RATE_PCT = 4.2;
const DEBOUNCE_MS = 250;

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function SliderField({
  label,
  value,
  displayValue,
  min,
  max,
  step,
  onChange,
  mutedText,
  primaryText,
}: {
  label: string;
  value: number;
  displayValue: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  mutedText: string;
  primaryText: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className={mutedText}>{label}</span>
        <span className={`font-mono ${primaryText}`}>{displayValue}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-cyan-500"
      />
    </div>
  );
}

function GreekRow({
  label,
  callValue,
  putValue,
  digits,
  mutedText,
  secondaryText,
}: {
  label: string;
  callValue: number;
  putValue: number;
  digits: number;
  mutedText: string;
  secondaryText: string;
}) {
  return (
    <tr className="border-t border-white/5">
      <td className={`py-1.5 text-xs ${mutedText}`}>{label}</td>
      <td className={`py-1.5 text-right font-mono text-sm ${secondaryText}`}>
        {callValue.toFixed(digits)}
      </td>
      <td className={`py-1.5 text-right font-mono text-sm ${secondaryText}`}>
        {putValue.toFixed(digits)}
      </td>
    </tr>
  );
}

export default function OptionsPricer({
  spotPrice,
  isExporting,
}: {
  spotPrice: number | null;
  isExporting: boolean;
}) {
  const [strike, setStrike] = useState(() =>
    spotPrice ? Math.round(spotPrice) : 100
  );
  const [daysToExpiration, setDaysToExpiration] = useState(30);
  const [impliedVolatilityPct, setImpliedVolatilityPct] = useState(30);

  const [result, setResult] = useState<OptionsPricingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!spotPrice) return;

    const handle = setTimeout(() => {
      const params = new URLSearchParams({
        S: String(spotPrice),
        K: String(strike),
        T: String(daysToExpiration / 365),
        sigma: String(impliedVolatilityPct / 100),
      });

      fetch(`${API_BASE}/api/options/pricing?${params.toString()}`)
        .then((res) => {
          if (!res.ok) throw new Error("Pricing request failed.");
          return res.json();
        })
        .then((data: OptionsPricingResponse) => {
          setResult(data);
          setError(null);
        })
        .catch((err: unknown) => {
          setResult(null);
          setError(err instanceof Error ? err.message : "Pricing request failed.");
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [spotPrice, strike, daysToExpiration, impliedVolatilityPct]);

  const primaryText = isExporting ? "text-gray-900" : "text-slate-100";
  const secondaryText = isExporting ? "text-gray-700" : "text-slate-300";
  const mutedText = isExporting ? "text-gray-500" : "text-slate-500";

  if (!spotPrice) {
    return (
      <div className={`${cardClassesFor(isExporting)} p-4`}>
        <h2 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
          Black-Scholes Options Pricer
        </h2>
        <p className={`mt-3 text-sm ${mutedText}`}>
          No live spot price available to price options against right now.
        </p>
      </div>
    );
  }

  const strikeMin = Math.max(1, Math.round(spotPrice * 0.5));
  const strikeMax = Math.round(spotPrice * 1.5);

  return (
    <div className={`${cardClassesFor(isExporting)} p-4`}>
      <h2 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
        Black-Scholes Options Pricer
      </h2>
      <p className={`mt-1 text-xs ${mutedText}`}>
        Spot {currencyFormatter.format(spotPrice)} &middot; Risk-free rate{" "}
        {RISK_FREE_RATE_PCT.toFixed(1)}% (fixed)
      </p>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SliderField
          label="Strike"
          value={strike}
          displayValue={currencyFormatter.format(strike)}
          min={strikeMin}
          max={strikeMax}
          step={1}
          onChange={setStrike}
          mutedText={mutedText}
          primaryText={primaryText}
        />
        <SliderField
          label="Days to Expiration"
          value={daysToExpiration}
          displayValue={`${daysToExpiration}d`}
          min={1}
          max={365}
          step={1}
          onChange={setDaysToExpiration}
          mutedText={mutedText}
          primaryText={primaryText}
        />
        <SliderField
          label="Implied Volatility"
          value={impliedVolatilityPct}
          displayValue={`${impliedVolatilityPct}%`}
          min={5}
          max={150}
          step={1}
          onChange={setImpliedVolatilityPct}
          mutedText={mutedText}
          primaryText={primaryText}
        />
      </div>

      {error && (
        <p className="mt-4 text-sm text-rose-400">{error}</p>
      )}

      {result && !error && (
        <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className={`text-xs ${mutedText}`}>Call Price</p>
              <p className="mt-1 text-2xl font-semibold font-mono tracking-tight text-emerald-400">
                {currencyFormatter.format(result.call.price)}
              </p>
            </div>
            <div>
              <p className={`text-xs ${mutedText}`}>Put Price</p>
              <p className="mt-1 text-2xl font-semibold font-mono tracking-tight text-rose-400">
                {currencyFormatter.format(result.put.price)}
              </p>
            </div>
          </div>

          <div>
            <table className="w-full">
              <thead>
                <tr className="text-left text-[11px] text-slate-600 uppercase tracking-wider">
                  <th className="pb-1 font-medium">Greek</th>
                  <th className="pb-1 font-medium text-right text-emerald-400/80">Call</th>
                  <th className="pb-1 font-medium text-right text-rose-400/80">Put</th>
                </tr>
              </thead>
              <tbody>
                <GreekRow
                  label="Delta"
                  callValue={result.call.delta}
                  putValue={result.put.delta}
                  digits={4}
                  mutedText={mutedText}
                  secondaryText={secondaryText}
                />
                <GreekRow
                  label="Gamma"
                  callValue={result.call.gamma}
                  putValue={result.put.gamma}
                  digits={6}
                  mutedText={mutedText}
                  secondaryText={secondaryText}
                />
                <GreekRow
                  label="Theta (1d)"
                  callValue={result.call.theta}
                  putValue={result.put.theta}
                  digits={4}
                  mutedText={mutedText}
                  secondaryText={secondaryText}
                />
                <GreekRow
                  label="Vega (1%)"
                  callValue={result.call.vega}
                  putValue={result.put.vega}
                  digits={4}
                  mutedText={mutedText}
                  secondaryText={secondaryText}
                />
                <GreekRow
                  label="Rho (1%)"
                  callValue={result.call.rho}
                  putValue={result.put.rho}
                  digits={4}
                  mutedText={mutedText}
                  secondaryText={secondaryText}
                />
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className={`mt-4 text-[11px] leading-snug ${mutedText}`}>
        Standard Black-Scholes-Merton on a non-dividend-paying underlying &mdash; a
        theoretical model, not a live options-market quote.
      </p>
    </div>
  );
}
