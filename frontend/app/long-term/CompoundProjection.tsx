"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cardClasses } from "@/app/lib/analysis";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

type ProjectionPoint = {
  year: number;
  contributed: number;
  value: number;
};

// Standard future-value-of-an-annuity formula: monthly contributions,
// monthly compounding at the given annual rate. A hypothetical, user-driven
// projection based on the assumptions the sliders expose -- not a real
// historical data point, so no data-integrity concern the way a
// silently-synthesized market metric would be.
function buildProjection(
  monthlyContribution: number,
  annualReturnPct: number,
  years: number
): ProjectionPoint[] {
  const monthlyRate = annualReturnPct / 100 / 12;
  const points: ProjectionPoint[] = [];

  for (let year = 0; year <= years; year++) {
    const months = year * 12;
    const contributed = monthlyContribution * months;
    const value =
      monthlyRate === 0
        ? contributed
        : monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);

    points.push({ year, contributed: Math.round(contributed), value: Math.round(value) });
  }

  return points;
}

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

export default function CompoundProjection() {
  const [monthlyContribution, setMonthlyContribution] = useState(200);
  const [annualReturn, setAnnualReturn] = useState(10);
  const [years, setYears] = useState(20);

  const data = useMemo(
    () => buildProjection(monthlyContribution, annualReturn, years),
    [monthlyContribution, annualReturn, years]
  );

  const finalPoint = data[data.length - 1];
  const finalValue = finalPoint?.value ?? 0;
  const totalContributed = finalPoint?.contributed ?? 0;

  return (
    <div className={`${cardClasses} p-6`}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SliderField
          label="Monthly Contribution"
          value={monthlyContribution}
          displayValue={currencyFormatter.format(monthlyContribution)}
          min={0}
          max={2000}
          step={25}
          onChange={setMonthlyContribution}
        />
        <SliderField
          label="Expected Annual Return"
          value={annualReturn}
          displayValue={`${annualReturn}%`}
          min={1}
          max={15}
          step={0.5}
          onChange={setAnnualReturn}
        />
        <SliderField
          label="Years to Compound"
          value={years}
          displayValue={`${years}`}
          min={1}
          max={40}
          step={1}
          onChange={setYears}
        />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-slate-500">Total Contributed</p>
          <p className="mt-1 text-xl font-semibold font-mono tracking-tight text-slate-300">
            {currencyFormatter.format(totalContributed)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Projected Value</p>
          <p className="mt-1 text-xl font-semibold font-mono tracking-tight text-cyan-400">
            {currencyFormatter.format(finalValue)}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#ffffff10" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="year"
              tick={{ fill: "#64748b", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `Yr ${value}`}
            />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={60}
              tickFormatter={(value) => `$${Math.round(value / 1000)}k`}
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
              labelFormatter={(value) => `Year ${value}`}
              formatter={(value) =>
                typeof value === "number" ? currencyFormatter.format(value) : value
              }
            />
            <Line
              type="monotone"
              dataKey="contributed"
              name="Contributed"
              stroke="#475569"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="value"
              name="Projected Value"
              stroke="#22d3ee"
              strokeWidth={2.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-3 text-[11px] leading-snug text-slate-600">
        Hypothetical projection based on the assumptions above, not a guarantee of
        future returns. Assumes monthly compounding and contributions made at each
        month&rsquo;s end.
      </p>
    </div>
  );
}
