"use client";

import { useMemo, useState } from "react";
import { ValuationInputs, cardClasses, changeColorClass } from "@/app/lib/analysis";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function SliderField({
  label,
  value,
  displayValue,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  displayValue: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>{label}</span>
        <span className="font-mono text-slate-100">{displayValue}</span>
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

export default function ValuationTool({ inputs }: { inputs: ValuationInputs }) {
  const [waccPct, setWaccPct] = useState(10);
  const [terminalGrowthPct, setTerminalGrowthPct] = useState(2.5);

  // Single-stage Gordon Growth DCF: next year's FCF discounted as a growing
  // perpetuity at WACC, bridged from enterprise value to per-share equity
  // value via debt/cash. Standard simplified DCF -- only valid when WACC
  // exceeds the terminal growth rate.
  const result = useMemo(() => {
    const wacc = waccPct / 100;
    const growth = terminalGrowthPct / 100;

    if (wacc <= growth) return null;

    const nextYearFcf = inputs.free_cash_flow! * (1 + growth);
    const enterpriseValue = nextYearFcf / (wacc - growth);
    const equityValue = enterpriseValue - inputs.total_debt! + inputs.cash_and_equivalents!;
    const impliedPrice = equityValue / inputs.shares_outstanding!;

    if (!Number.isFinite(impliedPrice) || impliedPrice <= 0) return null;

    // Margin of safety: how far below (positive) or above (negative) the
    // model's intrinsic value the current market price sits -- standard
    // value-investing convention, (intrinsic - price) / intrinsic.
    const marginOfSafety = ((impliedPrice - inputs.current_price!) / impliedPrice) * 100;

    return { impliedPrice, marginOfSafety };
  }, [waccPct, terminalGrowthPct, inputs]);

  return (
    <div className="space-y-6">
      <div className={`${cardClasses} p-6`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SliderField
            label="WACC"
            value={waccPct}
            displayValue={`${waccPct.toFixed(1)}%`}
            min={4}
            max={20}
            step={0.5}
            onChange={setWaccPct}
          />
          <SliderField
            label="Terminal Growth Rate"
            value={terminalGrowthPct}
            displayValue={`${terminalGrowthPct.toFixed(1)}%`}
            min={0}
            max={5}
            step={0.1}
            onChange={setTerminalGrowthPct}
          />
        </div>
      </div>

      <div className={`${cardClasses} p-6`}>
        {result === null ? (
          <p className="text-sm text-amber-400">
            This combination of inputs doesn&rsquo;t produce a valid valuation &mdash; WACC
            must be greater than the terminal growth rate.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-xs text-slate-500">Implied Share Price</p>
              <p className="mt-1 text-2xl font-semibold font-mono tracking-tight text-cyan-400">
                {currencyFormatter.format(result.impliedPrice)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Current Price</p>
              <p className="mt-1 text-2xl font-semibold font-mono tracking-tight text-slate-100">
                {currencyFormatter.format(inputs.current_price!)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Margin of Safety</p>
              <p
                className={`mt-1 text-2xl font-semibold font-mono tracking-tight ${changeColorClass(
                  result.marginOfSafety
                )}`}
              >
                {result.marginOfSafety > 0 ? "+" : ""}
                {result.marginOfSafety.toFixed(1)}%
              </p>
            </div>
          </div>
        )}
      </div>

      <div className={`${cardClasses} p-6`}>
        <h2 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
          Inputs (FMP, most recent reported period)
        </h2>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-sm">
          <div>
            <p className="text-xs text-slate-500">Free Cash Flow</p>
            <p className="mt-1 text-slate-200">
              {compactCurrencyFormatter.format(inputs.free_cash_flow!)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Total Debt</p>
            <p className="mt-1 text-slate-200">
              {compactCurrencyFormatter.format(inputs.total_debt!)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Cash &amp; Equivalents</p>
            <p className="mt-1 text-slate-200">
              {compactCurrencyFormatter.format(inputs.cash_and_equivalents!)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Shares Outstanding</p>
            <p className="mt-1 text-slate-200">
              {compactNumberFormatter.format(inputs.shares_outstanding!)}
            </p>
          </div>
        </div>
      </div>

      <p className="text-[11px] leading-snug text-slate-600">
        Single-stage discounted cash flow model (Gordon Growth perpetuity) using the latest
        reported annual free cash flow. A simplified estimate for research purposes, not
        investment advice.
      </p>
    </div>
  );
}
