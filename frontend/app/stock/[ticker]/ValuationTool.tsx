"use client";

import { useMemo, useState } from "react";
import { ValuationInputs, cardClassesFor } from "@/app/lib/analysis";

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

function InputStat({
  label,
  value,
  mutedText,
  secondaryText,
}: {
  label: string;
  value: string;
  mutedText: string;
  secondaryText: string;
}) {
  return (
    <div>
      <p className={`text-xs ${mutedText}`}>{label}</p>
      <p className={`mt-1 font-mono ${secondaryText}`}>{value}</p>
    </div>
  );
}

// Single-stage Gordon Growth DCF: next year's FCF discounted as a growing
// perpetuity at WACC, bridged from enterprise value to per-share equity
// value via debt/cash. Standard simplified DCF -- only valid when WACC
// exceeds the terminal growth rate.
function computeDcf(inputs: ValuationInputs, waccPct: number, terminalGrowthPct: number) {
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
}

export default function ValuationTool({
  inputs,
  isExporting,
}: {
  inputs: ValuationInputs;
  isExporting: boolean;
}) {
  const [waccPct, setWaccPct] = useState(10);
  const [terminalGrowthPct, setTerminalGrowthPct] = useState(2.5);

  const result = useMemo(
    () => computeDcf(inputs, waccPct, terminalGrowthPct),
    [waccPct, terminalGrowthPct, inputs]
  );

  const primaryText = isExporting ? "text-gray-900" : "text-slate-100";
  const secondaryText = isExporting ? "text-gray-700" : "text-slate-300";
  const mutedText = isExporting ? "text-gray-500" : "text-slate-500";

  return (
    <div className={`${cardClassesFor(isExporting)} p-4`}>
      <h2 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
        Interactive DCF Valuation
      </h2>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SliderField
          label="WACC"
          value={waccPct}
          displayValue={`${waccPct.toFixed(1)}%`}
          min={4}
          max={20}
          step={0.5}
          onChange={setWaccPct}
          mutedText={mutedText}
          primaryText={primaryText}
        />
        <SliderField
          label="Terminal Growth Rate"
          value={terminalGrowthPct}
          displayValue={`${terminalGrowthPct.toFixed(1)}%`}
          min={0}
          max={5}
          step={0.1}
          onChange={setTerminalGrowthPct}
          mutedText={mutedText}
          primaryText={primaryText}
        />
      </div>

      <div className="mt-4 pt-4 border-t border-white/5">
        {result === null ? (
          <p className="text-sm text-amber-400">
            This combination of inputs doesn&rsquo;t produce a valid valuation &mdash; WACC
            must be greater than the terminal growth rate.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className={`text-xs ${mutedText}`}>Implied Share Price</p>
              <p className="mt-1 text-xl font-semibold font-mono tracking-tight text-cyan-400">
                {currencyFormatter.format(result.impliedPrice)}
              </p>
            </div>
            <div>
              <p className={`text-xs ${mutedText}`}>Current Price</p>
              <p className={`mt-1 text-xl font-semibold font-mono tracking-tight ${primaryText}`}>
                {currencyFormatter.format(inputs.current_price!)}
              </p>
            </div>
            <div>
              <p className={`text-xs ${mutedText}`}>Margin of Safety</p>
              <p
                className={`mt-1 text-xl font-semibold font-mono tracking-tight ${
                  result.marginOfSafety >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {result.marginOfSafety > 0 ? "+" : ""}
                {result.marginOfSafety.toFixed(1)}%
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-white/5">
        <h3 className="text-[11px] font-semibold tracking-wider text-slate-600 uppercase">
          Inputs (FMP, most recent reported period)
        </h3>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <InputStat
            label="Free Cash Flow"
            value={compactCurrencyFormatter.format(inputs.free_cash_flow!)}
            mutedText={mutedText}
            secondaryText={secondaryText}
          />
          <InputStat
            label="Total Debt"
            value={compactCurrencyFormatter.format(inputs.total_debt!)}
            mutedText={mutedText}
            secondaryText={secondaryText}
          />
          <InputStat
            label="Cash & Equivalents"
            value={compactCurrencyFormatter.format(inputs.cash_and_equivalents!)}
            mutedText={mutedText}
            secondaryText={secondaryText}
          />
          <InputStat
            label="Shares Outstanding"
            value={compactNumberFormatter.format(inputs.shares_outstanding!)}
            mutedText={mutedText}
            secondaryText={secondaryText}
          />
        </div>
      </div>

      <p className={`mt-3 text-[11px] leading-snug ${mutedText}`}>
        Single-stage discounted cash flow model (Gordon Growth perpetuity) using the latest
        reported annual free cash flow. A simplified estimate for research purposes, not
        investment advice.
      </p>
    </div>
  );
}
